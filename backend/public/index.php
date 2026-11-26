<?php

declare(strict_types=1);

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Cors;
use ChezVoust\Core\PublicReadLimiter;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;

$request = null;

try {
    $services = require dirname(__DIR__) . '/bootstrap/app.php';
    $request = Request::capture($services['config']['proxy_shared_secret']);

    $limits = $services['config']['rate_limit'];
    $scope = PublicReadLimiter::scope($request);
    $publicReads = new PublicReadLimiter(dirname(__DIR__) . '/storage/rate-limits');
    $publicKey = 'public:' . $scope . ':' . $request->ip;
    if ($scope === null || !$publicReads->check($publicKey, $limits['requests'], $limits['window'])) {
        $services['rateLimiter']->check($scope === null ? 'global:' . $request->ip : $publicKey, $limits['requests'], $limits['window']);
    }

    // Preflight também consome recursos de bootstrap. Aplicar o limite antes
    // de responder OPTIONS impede que esse caminho contorne a proteção geral.
    $corsResponse = Cors::apply($request, $services['config']['cors_origins']);
    if ($corsResponse instanceof Response) {
        $corsResponse->send($request->requestId);
        return;
    }

    $response = $services['router']->dispatch($request);
    $services['mailOutbox']->scheduleHostedDelivery();
    $response->send($request->requestId);
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
