<?php

declare(strict_types=1);

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Cors;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;

$request = null;

try {
    $services = require dirname(__DIR__) . '/bootstrap/app.php';
    $request = Request::capture($services['config']['proxy_shared_secret']);

    $corsResponse = Cors::apply($request, $services['config']['cors_origins']);
    if ($corsResponse instanceof Response) {
        $corsResponse->send($request->requestId);
        return;
    }

    $services['rateLimiter']->check(
        'global:' . $request->ip,
        $services['config']['rate_limit']['requests'],
        $services['config']['rate_limit']['window']
    );

    $services['router']->dispatch($request)->send($request->requestId);
} catch (ApiException $exception) {
    $requestId = $request?->requestId ?? 'bootstrap-error';
    Response::error($exception, $requestId)->send($requestId);
} catch (Throwable $exception) {
    $requestId = $request?->requestId ?? 'bootstrap-error';
    error_log(sprintf('[%s] %s in %s:%d', $requestId, $exception->getMessage(), $exception->getFile(), $exception->getLine()));
    $debug = isset($services['config']['debug']) && $services['config']['debug'];
    $apiException = new ApiException(
        500,
        'INTERNAL_ERROR',
        $debug ? $exception->getMessage() : 'Não foi possível processar a solicitação.'
    );
    Response::error($apiException, $requestId)->send($requestId);
}
