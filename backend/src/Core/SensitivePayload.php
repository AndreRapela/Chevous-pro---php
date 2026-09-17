<?php

declare(strict_types=1);

namespace ChezVoust\Core;

/**
 * Cifra dados efêmeros que precisam atravessar a outbox (por exemplo, tokens
 * de e-mail). O banco guarda apenas ciphertext autenticado, nunca o token.
 */
final class SensitivePayload
{
    private string $key;

    public function __construct(string $secret)
    {
        if (strlen($secret) < 32) {
            throw new \RuntimeException('OUTBOX_ENCRYPTION_KEY precisa ter ao menos 32 caracteres.');
        }
        $this->key = hash('sha256', $secret, true);
    }

    public function encrypt(array $payload): string
    {
        $iv = random_bytes(12);
        $plaintext = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $tag = '';
        $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
        if (!is_string($ciphertext) || strlen($tag) !== 16) {
            throw new \RuntimeException('Não foi possível proteger o evento sensível.');
        }
        return json_encode([
            'v' => 1,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'ciphertext' => base64_encode($ciphertext),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    public function decrypt(string $encoded): array
    {
        try {
            $envelope = json_decode($encoded, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($envelope) || ($envelope['v'] ?? null) !== 1) {
                throw new \RuntimeException('Envelope sensível inválido.');
            }
            $iv = base64_decode((string) ($envelope['iv'] ?? ''), true);
            $tag = base64_decode((string) ($envelope['tag'] ?? ''), true);
            $ciphertext = base64_decode((string) ($envelope['ciphertext'] ?? ''), true);
            if ($iv === false || strlen($iv) !== 12 || $tag === false || strlen($tag) !== 16 || $ciphertext === false) {
                throw new \RuntimeException('Envelope sensível inválido.');
            }
            $plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $this->key, OPENSSL_RAW_DATA, $iv, $tag);
            $payload = is_string($plaintext) ? json_decode($plaintext, true, 64, JSON_THROW_ON_ERROR) : null;
            if (!is_array($payload)) {
                throw new \RuntimeException('Não foi possível abrir o evento sensível.');
            }
            return $payload;
        } catch (\JsonException $exception) {
            throw new \RuntimeException('Envelope sensível inválido.', 0, $exception);
        }
    }
}
