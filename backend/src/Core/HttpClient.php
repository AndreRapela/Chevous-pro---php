<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class HttpClient
{
    /** @return array{status:int,body:array<string,mixed>} */
    public function postJson(string $url, array $payload, array $headers = []): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('A extensão cURL é obrigatória para integrações externas.');
        }
        $handle = curl_init($url);
        if ($handle === false) {
            throw new \RuntimeException('Não foi possível iniciar a conexão externa.');
        }
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $encoded,
            CURLOPT_HTTPHEADER => [...$headers, 'Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if (!is_string($body)) {
            throw new \RuntimeException('Falha na conexão externa' . ($error !== '' ? ': ' . $error : '.'));
        }
        $decoded = json_decode($body, true);
        return ['status' => $status, 'body' => is_array($decoded) ? $decoded : []];
    }

    /** @return array{status:int,body:array<string,mixed>} */
    public function postForm(string $url, array $payload, array $headers = []): array
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('A extensão cURL é obrigatória para integrações externas.');
        }
        $handle = curl_init($url);
        if ($handle === false) {
            throw new \RuntimeException('Não foi possível iniciar a conexão externa.');
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($payload),
            CURLOPT_HTTPHEADER => [...$headers, 'Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
        ]);
        $body = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if (!is_string($body)) {
            throw new \RuntimeException('Falha na conexão externa' . ($error !== '' ? ': ' . $error : '.'));
        }
        $decoded = json_decode($body, true);
        return ['status' => $status, 'body' => is_array($decoded) ? $decoded : []];
    }
}
