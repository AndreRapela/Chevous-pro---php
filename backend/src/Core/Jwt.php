<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Jwt
{
    public function __construct(private readonly array $config)
    {
        if (strlen($this->config['secret']) < 32) {
            throw new \RuntimeException('JWT_SECRET deve possuir pelo menos 32 caracteres.');
        }
    }

    public function issue(array $claims, int $ttl, string $type): string
    {
        $now = time();
        $payload = array_merge($claims, [
            'iss' => $this->config['issuer'],
            'aud' => $this->config['audience'],
            'iat' => $now,
            'nbf' => $now - 5,
            'exp' => $now + $ttl,
            'typ' => $type,
            'jti' => Uuid::v4(),
        ]);

        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
        $segments = [
            self::base64UrlEncode(json_encode($header, JSON_THROW_ON_ERROR)),
            self::base64UrlEncode(json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)),
        ];
        $signature = hash_hmac('sha256', implode('.', $segments), $this->config['secret'], true);
        $segments[] = self::base64UrlEncode($signature);

        return implode('.', $segments);
    }

    public function decode(string $token, ?string $expectedType = null): array
    {
        $segments = explode('.', $token);
        if (count($segments) !== 3) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $segments;
        $header = json_decode(self::base64UrlDecode($encodedHeader), true);
        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        $signature = self::base64UrlDecode($encodedSignature);

        if (!is_array($header) || !is_array($payload) || ($header['alg'] ?? '') !== 'HS256') {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }

        $expected = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $this->config['secret'], true);
        if (!hash_equals($expected, $signature)) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }

        $now = time();
        if (($payload['iss'] ?? null) !== $this->config['issuer']
            || ($payload['aud'] ?? null) !== $this->config['audience']
            || !isset($payload['exp'], $payload['nbf'])
            || (int) $payload['exp'] < $now
            || (int) $payload['nbf'] > $now + 30
            || ($expectedType !== null && ($payload['typ'] ?? null) !== $expectedType)
        ) {
            throw new ApiException(401, 'EXPIRED_OR_INVALID_TOKEN', 'A sessão expirou ou o token é inválido.');
        }

        return $payload;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        $encoded = $value;
        if (preg_match('/^[A-Za-z0-9_-]*$/', $encoded) !== 1) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }
        $padding = strlen($value) % 4;
        if ($padding !== 0) {
            $value .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false || !hash_equals(self::base64UrlEncode($decoded), $encoded)) {
            throw new ApiException(401, 'INVALID_TOKEN', 'Token de autenticação inválido.');
        }
        return $decoded;
    }
}
