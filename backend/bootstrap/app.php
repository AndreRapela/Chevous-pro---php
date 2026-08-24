<?php

declare(strict_types=1);

use ChezVoust\Core\Audit;
use ChezVoust\Core\Auth;
use ChezVoust\Core\Database;
use ChezVoust\Core\Env;
use ChezVoust\Core\Jwt;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Router;

require __DIR__ . '/autoload.php';

Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
date_default_timezone_set($config['timezone']);

$database = new Database($config['database']);
$pdo = $database->pdo();
$jwt = new Jwt($config['jwt']);
$auth = new Auth($pdo, $jwt);
$rateLimiter = new RateLimiter($pdo);
$audit = new Audit($pdo);
$router = new Router($auth);

$services = [
    'config' => $config,
    'database' => $database,
    'db' => $pdo,
    'jwt' => $jwt,
    'auth' => $auth,
    'rateLimiter' => $rateLimiter,
    'audit' => $audit,
    'router' => $router,
];

(require dirname(__DIR__) . '/routes/api.php')($services);

return $services;
