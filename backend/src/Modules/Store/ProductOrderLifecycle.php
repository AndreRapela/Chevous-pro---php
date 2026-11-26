<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Store;

use ChezVoust\Core\ApiException;
use PDO;
use Throwable;

final class ProductOrderLifecycle
{
    // Leave enough time to retry session creation while honoring Stripe's 30-minute minimum.
    public const CHECKOUT_SECONDS = 33 * 60;
    public const SETUP_SECONDS = 90;

    public function __construct(private readonly PDO $db, private readonly StripeCheckout $stripe)
    {
    }

    public function openCheckout(string $id): string
    {
        $lookup = $this->db->prepare(
            "SELECT * FROM product_orders WHERE public_id = :id AND status = 'pending'
             AND expires_at > UTC_TIMESTAMP() AND (provider_session_id IS NOT NULL OR reconcile_at > UTC_TIMESTAMP())"
        );
        $lookup->execute(['id' => $id]);
        $order = $lookup->fetch();
        if (!$order) {
            throw new ApiException(409, 'CHECKOUT_ALREADY_USED', 'Atualize o pedido para iniciar outro pagamento.');
        }
        if ($order['provider_session_id'] !== null) {
            return $order['provider_checkout_url'];
        }

        // Retries send the same parameters and idempotency key, even after an ambiguous timeout.
        $session = $this->stripe->start($order);
        $attach = $this->db->prepare(
            "UPDATE product_orders SET provider_session_id = :session, provider_checkout_url = :url,
             provider_request = NULL, reconcile_at = expires_at WHERE public_id = :id AND status = 'pending'
             AND provider_session_id IS NULL AND reconcile_at > UTC_TIMESTAMP()"
        );
        $attach->execute(['id' => $id, 'session' => $session['id'], 'url' => $session['url']]);

        $lookup->execute(['id' => $id]);
        $attached = $lookup->fetch();
        if (!$attached || $attached['provider_session_id'] !== $session['id']) {
            throw new ApiException(409, 'CHECKOUT_ALREADY_USED', 'Atualize o pedido para iniciar outro pagamento.');
        }
        return $attached['provider_checkout_url'];
    }

    public function reconcileDue(int $limit, ?int $productId = null): bool
    {
        $limit = max(1, min(5, $limit));
        $product = $productId === null ? '' : ' AND product_id = :product';
        $provider = $this->stripe->canRetrieve() ? ' OR is_test = :test' : '';
        $parameters = $productId === null ? [] : ['product' => $productId];
        if ($provider !== '') {
            $parameters['test'] = (int) $this->stripe->isTest();
        }
        $due = $this->db->prepare(
            "SELECT public_id, provider_session_id, is_test FROM product_orders
             WHERE status = 'pending' AND reconcile_at <= UTC_TIMESTAMP()
             AND (provider_session_id IS NULL{$provider}){$product}
             ORDER BY reconcile_at, public_id LIMIT {$limit}"
        );
        $due->execute($parameters);
        $orders = $due->fetchAll();
        foreach ($orders as $order) {
            $this->reconcileOrder($order);
        }
        return $orders !== [];
    }

    public function reconcileOrder(array $order): void
    {
        if ($order['provider_session_id'] === null) {
            $this->applyFinalState($order['public_id'], null);
            return;
        }
        if (!$this->stripe->canRetrieve() || (bool) $order['is_test'] !== $this->stripe->isTest()) {
            return;
        }

        $retry = $this->db->prepare(
            "UPDATE product_orders SET reconcile_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 60 SECOND)
             WHERE public_id = :id AND status = 'pending' AND reconcile_at <= UTC_TIMESTAMP()"
        );
        $retry->execute(['id' => $order['public_id']]);
        if ($retry->rowCount() === 0) {
            return;
        }
        try {
            $session = $this->stripe->retrieve($order['provider_session_id']);
            if (($session['id'] ?? null) === $order['provider_session_id']
                && ($session['metadata']['product_order_id'] ?? null) === $order['public_id']) {
                $this->applySession($session);
            }
        } catch (ApiException $failure) {
            // A provider failure keeps the reservation intact and leaves the next attempt scheduled.
            error_log('[ChezVoust Pro] Checkout ' . $order['public_id'] . ': ' . $failure->errorCode);
        }
    }

    public function applySession(array $session): void
    {
        $orderId = $session['metadata']['product_order_id'] ?? null;
        $sessionId = $session['id'] ?? null;
        if (!is_string($orderId) || !is_string($sessionId) || ($session['mode'] ?? null) !== 'payment') {
            return;
        }
        $paid = ($session['status'] ?? null) === 'complete' && ($session['payment_status'] ?? null) === 'paid';
        $expired = ($session['status'] ?? null) === 'expired' && ($session['payment_status'] ?? null) === 'unpaid';
        if ($paid || $expired) {
            $this->applyFinalState($orderId, $session, $paid);
        }
    }

    private function applyFinalState(string $id, ?array $session, bool $paid = false): void
    {
        $condition = $session === null
            ? 'provider_session_id IS NULL AND reconcile_at <= UTC_TIMESTAMP()'
            : 'provider_session_id = :session';
        $params = $session === null ? ['id' => $id] : ['id' => $id, 'session' => $session['id']];
        $this->db->beginTransaction();
        try {
            $lookup = $this->db->prepare(
                "SELECT * FROM product_orders WHERE public_id = :id AND status = 'pending' AND {$condition} FOR UPDATE"
            );
            $lookup->execute($params);
            $order = $lookup->fetch();
            if ($order && ($session === null || ($session['livemode'] ?? null) === !(bool) $order['is_test'])) {
                if ($paid) {
                    $total = (int) $order['unit_amount_cents'] * (int) $order['quantity'] + (int) $order['shipping_cents'];
                    if ((int) ($session['amount_total'] ?? -1) !== $total
                        || ($session['currency'] ?? null) !== strtolower($order['currency'])) {
                        throw new ApiException(409, 'PAYMENT_TOTAL_MISMATCH', 'O total confirmado não corresponde ao pedido.');
                    }
                    $this->db->prepare(
                        "UPDATE product_orders SET status = 'paid', paid_at = UTC_TIMESTAMP(), reconcile_at = NULL WHERE public_id = :id"
                    )->execute(['id' => $id]);
                } else {
                    // Expired sessions may omit shipping if the customer never got to that step.
                    $this->db->prepare(
                        "UPDATE product_orders SET status = 'expired', reconcile_at = NULL, provider_request = NULL WHERE public_id = :id"
                    )->execute(['id' => $id]);
                    $this->db->prepare('UPDATE products SET inventory_count = inventory_count + :quantity WHERE id = :id')
                        ->execute(['quantity' => $order['quantity'], 'id' => $order['product_id']]);
                }
            }
            $this->db->commit();
        } catch (Throwable $failure) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $failure;
        }
    }
}
