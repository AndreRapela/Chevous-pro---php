<?php

declare(strict_types=1);

use ChezVoust\Core\Env;

$origins = array_values(array_filter(array_map(
    'trim',
    explode(',', Env::get('FRONTEND_ORIGINS', 'http://localhost:4200'))
)));
$environment = Env::get('APP_ENV', 'production');
$isLocalEnvironment = in_array($environment, ['local', 'development', 'testing'], true);
$debug = Env::bool('APP_DEBUG', false);
$localJwtSecret = 'local-only-change-this-secret-32-chars';
$jwtSecret = Env::get('JWT_SECRET', $isLocalEnvironment ? $localJwtSecret : '');
$localProxySecret = 'local-only-proxy-secret-change-before-public-use';
$proxySharedSecret = Env::get('PROXY_SHARED_SECRET', $isLocalEnvironment ? $localProxySecret : '');
$cookieSecure = Env::bool('REFRESH_COOKIE_SECURE', !$isLocalEnvironment);

if (!$isLocalEnvironment) {
    $unsafeSecrets = [
        '',
        $localJwtSecret,
        'replace-with-at-least-32-random-characters',
        'replace_with_at_least_64_random_characters_before_exposing_the_api',
        'local_only_change_this_64_character_secret_before_any_public_use',
    ];
    if (in_array($jwtSecret, $unsafeSecrets, true)) {
        throw new RuntimeException('JWT_SECRET seguro e exclusivo é obrigatório fora do ambiente local.');
    }
    $unsafeProxySecrets = [
        '',
        $localProxySecret,
        'replace-with-an-independent-32-character-secret',
        'replace_with_an_independent_64_character_secret_before_public_use',
    ];
    if (in_array($proxySharedSecret, $unsafeProxySecrets, true) || strlen($proxySharedSecret) < 32) {
        throw new RuntimeException('PROXY_SHARED_SECRET seguro e exclusivo é obrigatório fora do ambiente local.');
    }
    if (!$cookieSecure) {
        throw new RuntimeException('REFRESH_COOKIE_SECURE deve permanecer habilitado fora do ambiente local.');
    }
    if ($debug) {
        throw new RuntimeException('APP_DEBUG deve permanecer desabilitado fora do ambiente local.');
    }
}

return [
    'name' => Env::get('APP_NAME', 'ChezVoust Pro'),
    'env' => $environment,
    'debug' => $debug,
    'url' => rtrim(Env::get('APP_URL', 'http://localhost:8080'), '/'),
    'timezone' => Env::get('APP_TIMEZONE', 'America/Sao_Paulo'),
    'locale' => Env::get('APP_LOCALE', 'pt-BR'),
    'currency' => Env::get('APP_CURRENCY', 'BRL'),
    'cors_origins' => $origins,
    'proxy_shared_secret' => $proxySharedSecret,
    'database' => [
        'host' => Env::get('DB_HOST', '127.0.0.1'),
        'port' => Env::int('DB_PORT', 3306),
        'name' => Env::get('DB_DATABASE', 'chezvoust_pro'),
        'username' => Env::get('DB_USERNAME', 'chezvoust'),
        'password' => Env::get('DB_PASSWORD', ''),
    ],
    'jwt' => [
        'secret' => $jwtSecret,
        'issuer' => Env::get('JWT_ISSUER', 'chezvoust-pro-api'),
        'audience' => Env::get('JWT_AUDIENCE', 'chezvoust-pro-web'),
        'access_ttl' => Env::int('ACCESS_TOKEN_TTL', 900),
        'refresh_ttl' => Env::int('REFRESH_TOKEN_TTL', 2592000),
        'cookie_secure' => $cookieSecure,
    ],
    'rate_limit' => [
        'requests' => Env::int('RATE_LIMIT_REQUESTS', 120),
        'window' => Env::int('RATE_LIMIT_WINDOW', 60),
    ],
    'payment_driver' => Env::get('PAYMENT_DRIVER', 'fake'),
    'mail_driver' => Env::get('MAIL_DRIVER', 'log'),
    'upload_max_bytes' => Env::int('UPLOAD_MAX_BYTES', 5242880),
];
