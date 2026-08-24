<?php

declare(strict_types=1);

namespace ChezVoust\Core;

final class Router
{
    private array $routes = [];

    public function __construct(private readonly Auth $auth)
    {
    }

    public function add(string $method, string $path, callable|array $handler, bool $authenticated = false, array $roles = []): void
    {
        $pattern = preg_replace('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', '(?P<$1>[^/]+)', rtrim($path, '/'));
        $this->routes[] = [
            'method' => strtoupper($method),
            'path' => $path,
            'pattern' => '#^' . ($pattern === '' ? '/' : $pattern) . '/?$#',
            'handler' => $handler,
            'authenticated' => $authenticated,
            'roles' => $roles,
        ];
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method || preg_match($route['pattern'], $request->path, $matches) !== 1) {
                continue;
            }

            $params = [];
            foreach ($matches as $key => $value) {
                if (is_string($key)) {
                    $params[$key] = $value;
                }
            }
            $user = $route['authenticated'] ? $this->auth->requireUser($request, $route['roles']) : null;
            $response = call_user_func($route['handler'], $request, $params, $user);
            if (!$response instanceof Response) {
                throw new \LogicException('Handlers da API devem retornar uma instância de Response.');
            }
            return $response;
        }

        throw new ApiException(404, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    }
}
