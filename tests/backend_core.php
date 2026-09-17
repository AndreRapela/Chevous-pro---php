<?php

declare(strict_types=1);

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Jwt;
use ChezVoust\Core\Request;
use ChezVoust\Core\SensitivePayload;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

require dirname(__DIR__) . '/backend/bootstrap/autoload.php';

$passed = 0;
$failed = 0;

function check(string $name, callable $test): void
{
    global $passed, $failed;

    try {
        $test();
        $passed++;
        fwrite(STDOUT, "PASS {$name}\n");
    } catch (Throwable $exception) {
        $failed++;
        fwrite(STDERR, "FAIL {$name}: {$exception->getMessage()}\n");
    }
}

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function expectApiException(callable $callback, string $code): void
{
    try {
        $callback();
    } catch (ApiException $exception) {
        expect($exception->errorCode === $code, "Código esperado {$code}, recebido {$exception->errorCode}.");
        return;
    }

    throw new RuntimeException("Era esperada uma ApiException {$code}.");
}

check('UUID v4 válido e não repetido', static function (): void {
    $values = [];
    for ($index = 0; $index < 100; $index++) {
        $uuid = Uuid::v4();
        expect(preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $uuid) === 1, 'UUID fora do padrão v4.');
        $values[$uuid] = true;
    }
    expect(count($values) === 100, 'UUID repetido na amostra.');
});

check('JWT emite e valida claims', static function (): void {
    $jwt = new Jwt([
        'secret' => str_repeat('s', 64),
        'issuer' => 'chezvoust-test',
        'audience' => 'chezvoust-web-test',
    ]);
    $token = $jwt->issue(['sub' => 'user-1', 'sid' => 'session-1'], 60, 'access');
    $claims = $jwt->decode($token, 'access');
    expect($claims['sub'] === 'user-1', 'Subject JWT incorreto.');
    expect($claims['sid'] === 'session-1', 'Session JWT incorreta.');
    expect($claims['typ'] === 'access', 'Tipo JWT incorreto.');
});

check('JWT rejeita assinatura alterada', static function (): void {
    $jwt = new Jwt([
        'secret' => str_repeat('x', 64),
        'issuer' => 'chezvoust-test',
        'audience' => 'chezvoust-web-test',
    ]);
    $token = $jwt->issue(['sub' => 'user-1'], 60, 'access');
    $tampered = substr($token, 0, -1) . (str_ends_with($token, 'a') ? 'b' : 'a');
    expectApiException(static fn () => $jwt->decode($tampered, 'access'), 'INVALID_TOKEN');
});

check('JWT rejeita tipo incompatível', static function (): void {
    $jwt = new Jwt([
        'secret' => str_repeat('y', 64),
        'issuer' => 'chezvoust-test',
        'audience' => 'chezvoust-web-test',
    ]);
    $token = $jwt->issue(['sub' => 'user-1'], 60, 'refresh');
    expectApiException(static fn () => $jwt->decode($token, 'access'), 'EXPIRED_OR_INVALID_TOKEN');
});

check('Validator aceita e-mail e limite numérico', static function (): void {
    $result = Validator::validate(
        ['email' => 'cliente@chezvoust.test', 'rating' => '5'],
        ['email' => ['required', 'email', 'max:190'], 'rating' => ['required', 'integer', 'min:1', 'max:5']]
    );
    expect($result['rating'] === '5', 'Valor validado foi alterado inesperadamente.');
});

check('Validator rejeita número acima do máximo', static function (): void {
    expectApiException(
        static fn () => Validator::validate(['rating' => '6'], ['rating' => ['required', 'integer', 'min:1', 'max:5']]),
        'VALIDATION_ERROR'
    );
});

check('Validator rejeita UUID e e-mail inválidos', static function (): void {
    expectApiException(
        static fn () => Validator::validate(
            ['id' => 'not-a-uuid', 'email' => 'invalid'],
            ['id' => ['required', 'uuid'], 'email' => ['required', 'email']]
        ),
        'VALIDATION_ERROR'
    );
});

check('Request só confia no IP encaminhado com segredo correto', static function (): void {
    $originalServer = $_SERVER;
    $originalGet = $_GET;
    $originalCookie = $_COOKIE;

    try {
        $_SERVER = [
            'REQUEST_METHOD' => 'GET',
            'REQUEST_URI' => '/api/v1/health',
            'REMOTE_ADDR' => '172.30.0.10',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.42',
            'HTTP_X_PROXY_SECRET' => str_repeat('p', 40),
        ];
        $_GET = [];
        $_COOKIE = [];

        $trusted = Request::capture(str_repeat('p', 40));
        expect($trusted->ip === '203.0.113.42', 'IP autenticado do proxy não foi aplicado.');

        $untrusted = Request::capture(str_repeat('q', 40));
        expect($untrusted->ip === '172.30.0.10', 'IP encaminhado sem segredo válido foi aceito.');

        $_SERVER['HTTP_X_FORWARDED_FOR'] = 'not-an-ip';
        $invalid = Request::capture(str_repeat('p', 40));
        expect($invalid->ip === '172.30.0.10', 'IP encaminhado inválido foi aceito.');
    } finally {
        $_SERVER = $originalServer;
        $_GET = $originalGet;
        $_COOKIE = $originalCookie;
    }
});

check('Outbox cifra token efêmero e detecta adulteração', static function (): void {
    $protector = new SensitivePayload(str_repeat('o', 64));
    $token = str_repeat('a', 64);
    $encrypted = $protector->encrypt(['email' => 'cliente@example.com', 'token' => $token]);
    expect(!str_contains($encrypted, $token), 'Token apareceu no payload persistido.');
    expect($protector->decrypt($encrypted) === ['email' => 'cliente@example.com', 'token' => $token], 'Payload não foi recuperado corretamente.');
    $rejected = false;
    try { $protector->decrypt(substr($encrypted, 0, -2) . 'xx'); } catch (RuntimeException) { $rejected = true; }
    expect($rejected, 'Envelope adulterado foi aceito.');
});

fwrite(STDOUT, "\nResultado: {$passed} aprovados, {$failed} falhos.\n");
exit($failed === 0 ? 0 : 1);
