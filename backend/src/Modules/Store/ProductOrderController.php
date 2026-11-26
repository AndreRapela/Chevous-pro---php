<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Store;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;
use PDOException;
use Throwable;

final class ProductOrderController extends Controller
{
    private readonly ProductOrderLifecycle $lifecycle;

    public function __construct(PDO $db, array $config, private readonly StripeCheckout $stripe, private readonly RateLimiter $rateLimiter)
    {
        parent::__construct($db, $config);
        $this->lifecycle = new ProductOrderLifecycle($db, $stripe);
    }

    public function quote(Request $request, array $params, ?array $auth): Response
    {
        $input = Validator::validate($request->query, ['currency' => ['required', 'string', 'in:BRL,EUR,USD']]);
        $product = $this->product($params['slug']);
        if ($this->lifecycle->reconcileDue(1, (int) $product['id'])) {
            $product = $this->product($params['slug']);
        }
        $shipping = max(0, $this->config['store_payment']['shipping_brl_cents']);
        return Response::data([
            'name' => $product['name'], 'slug' => $product['slug'], 'description' => $product['short_description'],
            'imageUrl' => $product['image_url'], 'available' => min(10, (int) $product['inventory_count']),
            'currency' => $input['currency'],
            'unitCents' => $this->convert((int) $product['price_cents'], $product['currency'], $input['currency']),
            'shippingCents' => $this->convert($shipping, 'BRL', $input['currency']),
            'enabled' => $this->stripe->enabled(), 'testMode' => $this->stripe->enabled() && $this->stripe->isTest(),
        ]);
    }

    public function create(Request $request, array $params, ?array $auth): Response
    {
        $this->requireEnabled();
        $this->rateLimiter->check('product-checkout:' . $request->ip, 12, 600);
        $input = Validator::validate(['checkoutKey' => $request->headers['idempotency-key'] ?? ''] + $request->body, [
            'quantity' => ['required', 'integer', 'min:1', 'max:10'],
            'currency' => ['required', 'string', 'in:BRL,EUR,USD'],
            'locale' => ['required', 'string', 'in:en,fr'],
            'expectedTotalCents' => ['required', 'integer', 'min:1', 'max:99999999'],
            'checkoutKey' => ['required', 'uuid'],
        ]);
        return Response::data($this->createOrder($params['slug'], $input), 201);
    }

    public function createOrder(string $slug, array $input): array
    {
        $this->requireEnabled();
        try {
            $id = $this->reserve($slug, $input);
        } catch (ApiException $failure) {
            if ($failure->errorCode !== 'PRODUCT_STOCK_CHANGED'
                || !$this->lifecycle->reconcileDue(1, (int) $this->product($slug)['id'])) {
                throw $failure;
            }
            $id = $this->reserve($slug, $input);
        }
        return ['id' => $id, 'checkoutUrl' => $this->lifecycle->openCheckout($id)];
    }

    private function reserve(string $slug, array $input): string
    {
        $quantity = (int) $input['quantity'];
        $currency = $input['currency'];
        $checkoutKey = strtolower($input['checkoutKey']);
        $this->db->beginTransaction();
        try {
            $product = $this->product($slug, true);
            $existing = $this->db->prepare('SELECT * FROM product_orders WHERE checkout_key = :key');
            $existing->execute(['key' => $checkoutKey]);
            if ($order = $existing->fetch()) {
                $sameRequest = (int) $order['product_id'] === (int) $product['id'] && (int) $order['quantity'] === $quantity
                    && $order['currency'] === $currency && $this->totalCents($order) === (int) $input['expectedTotalCents']
                    && (bool) $order['is_test'] === $this->stripe->isTest();
                if (!$sameRequest) {
                    throw new ApiException(409, 'CHECKOUT_ALREADY_USED', 'Atualize o pedido para iniciar outro pagamento.');
                }
                $this->db->commit();
                return $order['public_id'];
            }
            if ($quantity > (int) $product['inventory_count']) {
                throw new ApiException(409, 'PRODUCT_STOCK_CHANGED', 'A quantidade disponível mudou. Atualize o pedido.');
            }
            $unit = $this->convert((int) $product['price_cents'], $product['currency'], $currency);
            $shipping = $this->convert($this->config['store_payment']['shipping_brl_cents'], 'BRL', $currency);
            if ($unit < 1 || $unit * $quantity + $shipping !== (int) $input['expectedTotalCents']) {
                throw new ApiException(409, 'PRODUCT_PRICE_CHANGED', 'O total mudou. Atualize o pedido antes de pagar.');
            }
            $order = [
                'public_id' => Uuid::v4(), 'checkout_key' => $checkoutKey, 'product_id' => (int) $product['id'],
                'product_name' => $product['name'], 'product_slug' => $product['slug'], 'quantity' => $quantity,
                'unit_amount_cents' => $unit, 'shipping_cents' => $shipping, 'currency' => $currency,
                'is_test' => (int) $this->stripe->isTest(),
                'expires_at' => gmdate('Y-m-d H:i:s', time() + ProductOrderLifecycle::CHECKOUT_SECONDS),
            ];
            $order['provider_request'] = json_encode($this->stripe->parameters($order, $input['locale']), JSON_THROW_ON_ERROR);
            $setupSeconds = ProductOrderLifecycle::SETUP_SECONDS;
            $this->db->prepare(
                "INSERT INTO product_orders (public_id, checkout_key, product_id, product_name, product_slug, quantity,
                 unit_amount_cents, shipping_cents, currency, is_test, expires_at, provider_request, reconcile_at, created_at)
                 VALUES (:public_id, :checkout_key, :product_id, :product_name, :product_slug, :quantity,
                 :unit_amount_cents, :shipping_cents, :currency, :is_test, :expires_at, :provider_request,
                 DATE_ADD(UTC_TIMESTAMP(), INTERVAL {$setupSeconds} SECOND), UTC_TIMESTAMP())"
            )->execute($order);
            $this->db->prepare('UPDATE products SET inventory_count = inventory_count - :quantity WHERE id = :id')
                ->execute(['quantity' => $quantity, 'id' => $product['id']]);
            $this->db->commit();
            return $order['public_id'];
        } catch (Throwable $failure) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            if ($failure instanceof PDOException && (string) $failure->getCode() === '23000') {
                throw new ApiException(409, 'CHECKOUT_ALREADY_USED', 'Atualize o pedido para iniciar outro pagamento.');
            }
            throw $failure;
        }
    }

    public function status(Request $request, array $params, ?array $auth): Response
    {
        $order = $this->findOrder($params['id']);
        if ($order['status'] === 'pending' && $order['reconcile_at'] !== null && $order['reconcile_at'] <= gmdate('Y-m-d H:i:s')) {
            $this->rateLimiter->check('product-order-sync:' . $request->ip, 15, 60);
            $this->lifecycle->reconcileOrder($order);
            $order = $this->findOrder($params['id']);
        }
        return Response::data($this->publicOrder($order));
    }

    public function reconcileAfterResponse(): void
    {
        if (!function_exists('fastcgi_finish_request')) {
            return;
        }
        register_shutdown_function(function (): void {
            ignore_user_abort(true);
            fastcgi_finish_request();
            try {
                $this->lifecycle->reconcileDue(1);
            } catch (Throwable $failure) {
                error_log('[ChezVoust Pro] Falha ao reconciliar pedidos da loja: ' . $failure::class);
            }
        });
    }

    public function adminOrders(Request $request, array $params, ?array $auth): Response
    {
        [$page, $perPage, $offset] = $this->pagination($request, 25, 50);
        $total = (int) $this->db->query('SELECT COUNT(*) FROM product_orders')->fetchColumn();
        $orders = $this->db->query("SELECT * FROM product_orders ORDER BY created_at DESC, public_id DESC LIMIT {$perPage} OFFSET {$offset}")->fetchAll();
        return Response::data(array_map(fn (array $order): array => $this->publicOrder($order) + [
            'createdAt' => str_replace(' ', 'T', $order['created_at']) . 'Z',
            'providerSessionId' => $order['provider_session_id'],
        ], $orders), meta: ['page' => $page, 'lastPage' => max(1, (int) ceil($total / $perPage))]);
    }

    public function webhook(Request $request, array $params, ?array $auth): Response
    {
        $this->stripe->verifySignature($request->rawBody, $request->headers['stripe-signature'] ?? '');
        if (in_array($request->body['type'] ?? '', ['checkout.session.completed', 'checkout.session.expired'], true)
            && is_bool($request->body['livemode'] ?? null)
            && ($request->body['livemode'] ?? null) === ($request->body['data']['object']['livemode'] ?? null)
            && is_array($request->body['data']['object'] ?? null)) {
            $this->lifecycle->applySession($request->body['data']['object']);
        }
        return Response::noContent();
    }

    private function requireEnabled(): void
    {
        if (!$this->stripe->enabled()) {
            throw new ApiException(503, 'STORE_CHECKOUT_DISABLED', 'O pagamento online está indisponível no momento.');
        }
    }

    private function product(string $slug, bool $lock = false): array
    {
        return $this->requireRow(
            'SELECT id, name, slug, short_description, image_url, currency, price_cents, inventory_count
             FROM products WHERE slug = :slug AND active = 1' . ($lock ? ' FOR UPDATE' : ''),
            ['slug' => $slug],
            'Produto indisponível para pagamento.'
        );
    }

    private function findOrder(string $id): array
    {
        return $this->requireRow('SELECT * FROM product_orders WHERE public_id = :id', ['id' => $id], 'Pedido não encontrado.');
    }

    private function convert(int $cents, string $from, string $to): int
    {
        $source = $this->config['currency_rates'][$from] ?? 0;
        $target = $this->config['currency_rates'][$to] ?? 0;
        if ($source <= 0 || $target <= 0) throw new ApiException(422, 'UNSUPPORTED_CURRENCY', 'Moeda indisponível para pagamento.');
        return (int) round($cents / $source * $target);
    }

    private function totalCents(array $order): int
    {
        return (int) $order['unit_amount_cents'] * (int) $order['quantity'] + (int) $order['shipping_cents'];
    }

    private function publicOrder(array $order): array
    {
        return [
            'id' => $order['public_id'], 'status' => $order['status'],
            'productName' => $order['product_name'], 'productSlug' => $order['product_slug'], 'quantity' => (int) $order['quantity'],
            'totalCents' => $this->totalCents($order), 'currency' => $order['currency'], 'testMode' => (bool) $order['is_test'],
        ];
    }
}
