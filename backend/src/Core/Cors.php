<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Cors
{
    public static function apply(Request $request, array $allowedOrigins): ?Response
    {
        $origin = $request->headers['origin'] ?? '';
        if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
            throw new ApiException(403, 'ORIGIN_NOT_ALLOWED', 'Origem não autorizada.');
        }
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Vary: Origin');
        }

        if ($request->method === 'OPTIONS') {
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, X-Request-Id');
            header('Access-Control-Max-Age: 600');
            return Response::noContent();
        }

        return null;
    }
}
