<?php

declare(strict_types=1);

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Database;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Uuid;
use ChezVoust\Modules\Store\ProductOrderController;
use ChezVoust\Modules\Store\ProductOrderLifecycle;
use ChezVoust\Modules\Store\StripeCheckout;

$services = require ($argv[1] ?? dirname(__DIR__) . '/backend') . '/bootstrap/app.php';
$config = $services['config'];
if (!in_array($config['env'], ['local', 'development', 'testing'], true)) {
    throw new RuntimeException('Use a local test database.');
}
$db = $services['db'];
$shippingCents = 1000;
$config['store_payment'] = [
    'mode' => 'test', 'allow_test' => true, 'allow_live' => false, 'secret_key' => 'sk_test_fixture',
    'webhook_secret' => 'whsec_fixture', 'return_origin' => 'http://localhost:4201',
    'countries' => ['FR'], 'shipping_brl_cents' => $shippingCents,
];

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function apiError(callable $operation, string $code): void
{
    try {
        $operation();
    } catch (ApiException $error) {
        check($error->errorCode === $code, 'Unexpected API error: ' . $error->errorCode);
        return;
    }
    throw new RuntimeException('The operation should have failed: ' . $code);
}

$fixtureId = Uuid::v4();
$fixtureSlug = 'checkout-test-' . $fixtureId;
$db->prepare("INSERT INTO products (public_id, name, slug, price_cents, currency, purchase_url, inventory_count, active, created_at, updated_at)
    VALUES (:id, 'Checkout fixture', :slug, 3000, 'BRL', '/ajuda', 2, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())")
    ->execute(['id' => $fixtureId, 'slug' => $fixtureSlug]);
$productId = $db->lastInsertId();
$stock = static function () use ($db, $productId): int {
    $statement = $db->prepare('SELECT inventory_count FROM products WHERE id = :id');
    $statement->execute(['id' => $productId]);
    return (int) $statement->fetchColumn();
};
$stored = static function (string $id) use ($db): array {
    $statement = $db->prepare('SELECT * FROM product_orders WHERE public_id = :id');
    $statement->execute(['id' => $id]);
    return $statement->fetch();
};
$status = static fn (string $id): string => $stored($id)['status'];
$markDue = static function (string $id) use ($db): void {
    $db->prepare('UPDATE product_orders SET reconcile_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE public_id = :id')
        ->execute(['id' => $id]);
};

try {
    $sessions = [];
    $providerParameters = [];
    $postCount = $getCount = 0;
    $losePostResponse = $failRetrieve = $finishLate = false;
    $other = (new Database($config['database']))->pdo();
    $stripe = new StripeCheckout($config['store_payment'], static function ($method, $path, $fields, $idempotencyKey) use (
        $db, $other, $productId, $markDue, &$sessions, &$providerParameters, &$postCount, &$getCount,
        &$losePostResponse, &$failRetrieve, &$finishLate
    ): array {
        check(!$db->inTransaction(), 'Provider calls must run outside the reservation transaction.');
        $other->beginTransaction();
        try {
            $lock = $other->prepare('SELECT inventory_count FROM products WHERE id = :id FOR UPDATE NOWAIT');
            $lock->execute(['id' => $productId]);
            check($lock->fetchColumn() !== false, 'Another connection must be able to lock the product during the provider call.');
        } finally {
            $other->rollBack();
        }

        if ($method === 'GET') {
            $getCount++;
            if ($failRetrieve) throw new ApiException(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Fixture offline.');
            foreach ($sessions as $session) {
                if ($path === '/' . $session['id']) return $session;
            }
            throw new RuntimeException('Unknown fixture session.');
        }

        $postCount++;
        check($method === 'POST' && $path === '', 'Unexpected provider request.');
        $id = $fields['metadata']['product_order_id'];
        check($id === $idempotencyKey, 'Provider must receive a unique checkout idempotency key.');
        check($fields['payment_method_types'] === ['card'], 'Unexpected payment methods.');
        check($fields['shipping_address_collection']['allowed_countries'] === ['FR'], 'Missing shipping configuration.');
        if (isset($sessions[$id])) {
            check($providerParameters[$id] === $fields, 'A retry must send identical Stripe parameters.');
            return $sessions[$id];
        }
        $providerParameters[$id] = $fields;
        $price = $fields['line_items'][0]['price_data'];
        $sessionId = 'cs_test_' . str_replace('-', '', $id);
        $sessions[$id] = [
            'id' => $sessionId, 'mode' => 'payment', 'livemode' => false, 'status' => 'open', 'payment_status' => 'unpaid',
            'amount_total' => $price['unit_amount'] * $fields['line_items'][0]['quantity'] + $fields['shipping_options'][0]['shipping_rate_data']['fixed_amount']['amount'],
            'currency' => $price['currency'], 'metadata' => $fields['metadata'],
            'url' => 'https://checkout.stripe.com/c/pay/' . $sessionId,
        ];
        if ($losePostResponse) throw new ApiException(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Fixture response lost after creation.');
        if ($finishLate) $markDue($id);
        return $sessions[$id];
    });
    $controller = new ProductOrderController($db, $config, $stripe, new RateLimiter($db));
    $lifecycle = new ProductOrderLifecycle($db, $stripe);
    $reconcile = static fn (): bool => $lifecycle->reconcileDue(3, (int) $productId);

    $input = ['quantity' => 1, 'currency' => 'BRL', 'locale' => 'en', 'checkoutKey' => Uuid::v4(), 'expectedTotalCents' => 4000];
    apiError(fn () => $controller->createOrder($fixtureSlug, array_replace($input, ['expectedTotalCents' => 1])), 'PRODUCT_PRICE_CHANGED');
    check($stock() === 2 && $postCount === 0, 'Rejecting the price cannot reserve stock or call Stripe.');
    $losePostResponse = true;
    apiError(fn () => $controller->createOrder($fixtureSlug, $input), 'PAYMENT_PROVIDER_UNAVAILABLE');
    $pendingId = array_key_last($sessions);
    check($stock() === 1 && $stored($pendingId)['provider_session_id'] === null && !$reconcile(),
        'An ambiguous timeout must keep one short-lived reservation available for retry.');
    $losePostResponse = false;

    $order = $controller->createOrder($fixtureSlug, array_replace($input, ['locale' => 'fr']));
    check($order['id'] === $pendingId && $stock() === 1 && $status($order['id']) === 'pending',
        'A retry must reuse the same order and original provider parameters.');
    check($stored($order['id'])['provider_request'] === null, 'Remove the parameters once the session is attached.');
    check($order === $controller->createOrder($fixtureSlug, $input) && $stock() === 1 && $postCount === 2 && count($sessions) === 1,
        'A retry must reuse the provider session without reserving another unit.');
    apiError(fn () => $controller->createOrder($fixtureSlug, array_replace($input, [
        'checkoutKey' => Uuid::v4(), 'quantity' => 2, 'expectedTotalCents' => 7000,
    ])), 'PRODUCT_STOCK_CHANGED');

    $paid = array_replace($sessions[$order['id']], ['payment_status' => 'paid', 'status' => 'complete']);
    apiError(fn () => $lifecycle->applySession(array_replace($paid, ['amount_total' => 1])), 'PAYMENT_TOTAL_MISMATCH');
    check($status($order['id']) === 'pending', 'An incorrect provider amount cannot mark the order as paid.');
    $sessions[$order['id']] = $paid;
    $markDue($order['id']);
    $reconcile();
    $lifecycle->applySession($paid);
    check($status($order['id']) === 'paid' && $stock() === 1 && $getCount === 1,
        'Reconciliation can confirm a payment without a webhook or releasing the sold unit.');

    $second = $controller->createOrder($fixtureSlug, array_replace($input, ['checkoutKey' => Uuid::v4()]));
    check($stock() === 0, 'A pending checkout must reserve the last unit.');
    $markDue($second['id']);
    $disabled = new StripeCheckout(array_replace($config['store_payment'], ['mode' => 'disabled']));
    $offline = new ProductOrderLifecycle($db, $disabled);
    check(!$offline->reconcileDue(3, (int) $productId) && $stock() === 0,
        'A linked reservation must stay intact without access to the correct provider environment.');
    $failRetrieve = true;
    $reconcile();
    $reconcile();
    check($status($second['id']) === 'pending' && $stock() === 0 && $getCount === 2,
        'An outage must keep linked stock reserved and defer the next check.');
    $failRetrieve = false;
    $markDue($second['id']);
    $reconcile();
    check($status($second['id']) === 'pending' && $stock() === 0 && $getCount === 3,
        'An open session must stay reserved.');

    $expired = array_replace($sessions[$second['id']], ['status' => 'expired', 'amount_total' => 3000]);
    $sessions[$second['id']] = $expired;
    $markDue($second['id']);
    $reconcile();
    $lifecycle->applySession($expired);
    $reconcile();
    check($status($second['id']) === 'expired' && $stock() === 1 && $getCount === 4,
        'Expiration without a webhook must release stock once, even when shipping was never selected.');

    $abandoned = array_replace($input, ['checkoutKey' => Uuid::v4()]);
    $losePostResponse = true;
    apiError(fn () => $controller->createOrder($fixtureSlug, $abandoned), 'PAYMENT_PROVIDER_UNAVAILABLE');
    $abandonedId = array_key_last($sessions);
    $losePostResponse = false;
    $markDue($abandonedId);
    $offline->reconcileDue(3, (int) $productId);
    $reconcile();
    check($status($abandonedId) === 'expired' && $stock() === 1 && $getCount === 4,
        'An expired setup reservation must release stock even with the provider disabled.');
    apiError(fn () => $controller->createOrder($fixtureSlug, $abandoned), 'CHECKOUT_ALREADY_USED');

    $finishLate = true;
    apiError(fn () => $controller->createOrder($fixtureSlug, array_replace($input, ['checkoutKey' => Uuid::v4()])), 'CHECKOUT_ALREADY_USED');
    $lateId = array_key_last($sessions);
    $reconcile();
    check($stored($lateId)['provider_session_id'] === null && $status($lateId) === 'expired' && $stock() === 1,
        'A late Stripe response must never expose a checkout whose reservation has expired.');

    $raw = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => $paid]], JSON_THROW_ON_ERROR);
    $timestamp = time();
    $digest = hash_hmac('sha256', $timestamp . '.' . $raw, $config['store_payment']['webhook_secret']);
    $signature = 't=' . $timestamp . ',v1=' . $digest;
    $stripe->verifySignature($raw, $signature);
    apiError(fn () => $stripe->verifySignature($raw . ' ', $signature), 'INVALID_PAYMENT_SIGNATURE');
    apiError(fn () => $stripe->verifySignature($raw, 't=1,v1=' . $digest), 'INVALID_PAYMENT_SIGNATURE');
    echo "PASS store payment: lock duration, timeout replay, inventory, payment and expiry reconciliation, webhook signature.\n";
} finally {
    $db->prepare('DELETE FROM product_orders WHERE product_id = :id')->execute(['id' => $productId]);
    $db->prepare('DELETE FROM products WHERE id = :id AND slug = :slug')->execute(['id' => $productId, 'slug' => $fixtureSlug]);
}
