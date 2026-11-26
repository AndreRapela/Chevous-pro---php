<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Store;

use ChezVoust\Core\ApiException;
use Closure;

final class StripeCheckout
{
    private const API = 'https://api.stripe.com/v1/checkout/sessions';

    public function __construct(private readonly array $config, private readonly ?Closure $transport = null)
    {
    }

    public function enabled(): bool
    {
        return $this->canRetrieve()
            && str_starts_with($this->config['webhook_secret'], 'whsec_')
            && $this->config['countries'] !== []
            && $this->config['shipping_brl_cents'] >= 0
            && filter_var($this->config['return_origin'], FILTER_VALIDATE_URL) !== false
            && ($this->isTest() || str_starts_with($this->config['return_origin'], 'https://'));
    }

    public function canRetrieve(): bool
    {
        $mode = $this->config['mode'];
        $key = $this->config['secret_key'];
        return ($mode === 'test' || $mode === 'live')
            && ($mode === 'live' ? $this->config['allow_live'] : $this->config['allow_test'])
            && (str_starts_with($key, 'sk_' . $mode . '_') || str_starts_with($key, 'rk_' . $mode . '_'));
    }

    public function isTest(): bool
    {
        return $this->config['mode'] === 'test';
    }

    public function parameters(array $order, string $locale): array
    {
        $return = $this->config['return_origin'] . '/pagamento/' . rawurlencode($order['product_slug'])
            . '?pedido=' . rawurlencode($order['public_id']);
        $currency = strtolower($order['currency']);
        return [
            'mode' => 'payment',
            'payment_method_types' => ['card'],
            'adaptive_pricing' => ['enabled' => 'false'],
            'client_reference_id' => $order['public_id'],
            'metadata' => ['product_order_id' => $order['public_id']],
            'payment_intent_data' => ['metadata' => ['product_order_id' => $order['public_id']]],
            'locale' => $locale,
            'success_url' => $return,
            'cancel_url' => $return . '&cancelado=1',
            'expires_at' => strtotime($order['expires_at'] . ' UTC'),
            'line_items' => [[
                'quantity' => $order['quantity'],
                'price_data' => [
                    'currency' => $currency,
                    'unit_amount' => $order['unit_amount_cents'],
                    'product_data' => ['name' => $order['product_name']],
                ],
            ]],
            'shipping_address_collection' => ['allowed_countries' => $this->config['countries']],
            'shipping_options' => [['shipping_rate_data' => [
                'type' => 'fixed_amount',
                'display_name' => $locale === 'fr' ? 'Livraison' : 'Delivery',
                'fixed_amount' => ['currency' => $currency, 'amount' => $order['shipping_cents']],
            ]]],
        ];
    }

    public function start(array $order): array
    {
        $parameters = json_decode($order['provider_request'], true, 512, JSON_THROW_ON_ERROR);
        $session = $this->request('POST', '', $parameters, $order['public_id']);
        $url = parse_url((string) ($session['url'] ?? ''));
        if (!is_array($url) || ($url['scheme'] ?? '') !== 'https' || ($url['host'] ?? '') !== 'checkout.stripe.com'
            || isset($url['user']) || isset($url['pass']) || isset($url['port'])
            || !is_string($session['id'] ?? null) || preg_match('/^cs_' . ($this->isTest() ? 'test' : 'live') . '_[A-Za-z0-9]+$/D', $session['id']) !== 1) {
            throw new ApiException(502, 'CHECKOUT_SESSION_INVALID', 'O provedor não retornou uma sessão de pagamento válida.');
        }
        return $session;
    }

    public function retrieve(string $sessionId): array
    {
        return $this->request('GET', '/' . rawurlencode($sessionId));
    }

    public function verifySignature(string $rawBody, string $header): void
    {
        if (!str_starts_with($this->config['webhook_secret'], 'whsec_')) {
            throw new ApiException(503, 'PAYMENT_WEBHOOK_DISABLED', 'As notificações de pagamento estão indisponíveis.');
        }
        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $header) as $part) {
            [$name, $value] = array_pad(explode('=', trim($part), 2), 2, null);
            if ($name === 't' && is_string($value) && ctype_digit($value)) $timestamp = $value;
            if ($name === 'v1' && is_string($value)) $signatures[] = $value;
        }
        if ($timestamp !== null && abs(time() - (int) $timestamp) <= 300 && strlen($rawBody) <= 256 * 1024) {
            $expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, $this->config['webhook_secret']);
            foreach ($signatures as $signature) {
                if (hash_equals($expected, $signature)) return;
            }
        }
        throw new ApiException(400, 'INVALID_PAYMENT_SIGNATURE', 'Assinatura de pagamento inválida.');
    }

    private function request(string $method, string $path, array $fields = [], ?string $key = null): array
    {
        if ($this->transport !== null) return ($this->transport)($method, $path, $fields, $key);
        $handle = curl_init(self::API . $path);
        $headers = ['Stripe-Version: 2026-11-18.endive'];
        if ($key !== null) $headers[] = 'Idempotency-Key: ' . $key;
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD => $this->config['secret_key'] . ':',
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => $headers,
        ]);
        if ($method === 'POST') {
            curl_setopt($handle, CURLOPT_POST, true);
            curl_setopt($handle, CURLOPT_POSTFIELDS, http_build_query($fields, '', '&', PHP_QUERY_RFC3986));
        }
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $result = is_string($body) ? json_decode($body, true) : null;
        if (!is_array($result) || $status < 200 || $status >= 300) {
            throw new ApiException(502, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Não foi possível acessar o provedor de pagamento. Tente novamente.');
        }
        return $result;
    }
}
