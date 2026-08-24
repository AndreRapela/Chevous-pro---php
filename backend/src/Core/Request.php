<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Request
{
    private function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        public readonly array $body,
        public readonly array $headers,
        public readonly array $cookies,
        public readonly string $ip,
        public readonly string $requestId
    ) {
    }

    public static function capture(string $trustedProxySecret = ''): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = '/' . trim(rawurldecode($path), '/');
        if ($path === '//') {
            $path = '/';
        }

        $headers = function_exists('getallheaders') ? (getallheaders() ?: []) : [];
        foreach ($_SERVER as $name => $value) {
            if (!str_starts_with((string) $name, 'HTTP_') || !is_scalar($value)) {
                continue;
            }
            $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr((string) $name, 5)))));
            if (!array_key_exists($headerName, $headers)) {
                $headers[$headerName] = (string) $value;
            }
        }
        $normalizedHeaders = [];
        foreach ($headers as $name => $value) {
            $normalizedHeaders[strtolower((string) $name)] = (string) $value;
        }

        $body = [];
        $raw = file_get_contents('php://input') ?: '';
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (!is_array($decoded) || json_last_error() !== JSON_ERROR_NONE) {
                throw new ApiException(400, 'INVALID_JSON', 'O corpo da requisição deve conter JSON válido.');
            }
            $body = $decoded;
        }

        // O IP encaminhado só é aceito quando o proxy prova conhecer o segredo interno.
        // O Nginx substitui X-Forwarded-For pelo endereço observado, evitando spoofing
        // de uma cadeia fornecida pelo próprio cliente.
        $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '127.0.0.1');
        $providedProxySecret = $normalizedHeaders['x-proxy-secret'] ?? '';
        $forwardedIp = trim($normalizedHeaders['x-forwarded-for'] ?? '');
        if (
            strlen($trustedProxySecret) >= 32
            && hash_equals($trustedProxySecret, $providedProxySecret)
            && filter_var($forwardedIp, FILTER_VALIDATE_IP) !== false
        ) {
            $ip = $forwardedIp;
        }
        $providedRequestId = $normalizedHeaders['x-request-id'] ?? '';
        $requestId = preg_match('/^[a-zA-Z0-9._-]{8,80}$/', $providedRequestId) ? $providedRequestId : Uuid::v4();

        return new self($method, $path, $_GET, $body, $normalizedHeaders, $_COOKIE, $ip, $requestId);
    }

    public function bearerToken(): ?string
    {
        $authorization = $this->headers['authorization'] ?? '';
        if (preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches) !== 1) {
            return null;
        }

        return trim($matches[1]);
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }
}
