<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Response
{
    public function __construct(
        public readonly mixed $payload = null,
        public readonly int $status = 200,
        public readonly array $headers = [],
        public readonly ?string $filePath = null,
        public readonly bool $rawBody = false
    ) {
    }

    public static function data(mixed $data, int $status = 200, ?array $meta = null): self
    {
        $payload = ['data' => $data];
        if ($meta !== null) {
            $payload['meta'] = $meta;
        }
        return new self($payload, $status);
    }

    public static function noContent(): self
    {
        return new self(null, 204);
    }

    public static function file(string $path, string $mimeType, int $cacheSeconds = 0): self
    {
        return new self(null, 200, [
            'Content-Type' => $mimeType,
            'Content-Length' => (string) filesize($path),
            'Cache-Control' => $cacheSeconds > 0 ? 'public, max-age=' . $cacheSeconds : 'no-store',
        ], $path);
    }

    /** Resposta pública textual (por exemplo robots.txt e sitemap.xml). */
    public static function text(string $body, string $mimeType, int $cacheSeconds = 0): self
    {
        return new self($body, 200, [
            'Content-Type' => $mimeType,
            'Cache-Control' => $cacheSeconds > 0 ? 'public, max-age=' . $cacheSeconds : 'no-store',
        ], null, true);
    }

    public static function error(ApiException $exception, string $requestId): self
    {
        $error = [
            'code' => $exception->errorCode,
            'message' => $exception->getMessage(),
            'requestId' => $requestId,
        ];
        if ($exception->fields !== []) {
            $error['fields'] = $exception->fields;
        }
        return new self(['error' => $error], $exception->status);
    }

    public function send(string $requestId): void
    {
        http_response_code($this->status);
        if ($this->filePath === null && !$this->rawBody) {
            header('Content-Type: application/json; charset=utf-8');
            // A API retorna endereços, sessões e conversas. Nunca permita que um
            // navegador ou proxy guarde essas respostas autenticadas em cache.
            header('Cache-Control: no-store, private');
            header('Pragma: no-cache');
        }
        header('X-Request-Id: ' . $requestId);
        header('X-Content-Type-Options: nosniff');
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        if ($this->filePath !== null) {
            readfile($this->filePath);
            return;
        }

        if ($this->rawBody) {
            echo $this->payload;
            return;
        }

        if ($this->status !== 204 && $this->payload !== null) {
            echo json_encode($this->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
