<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Response
{
    public function __construct(
        public readonly mixed $payload = null,
        public readonly int $status = 200,
        public readonly array $headers = []
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
        header('Content-Type: application/json; charset=utf-8');
        header('X-Request-Id: ' . $requestId);
        header('X-Content-Type-Options: nosniff');
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }

        if ($this->status !== 204 && $this->payload !== null) {
            echo json_encode($this->payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        }
    }
}
