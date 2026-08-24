<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Auth;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Jwt;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;
use PDOException;

final class AuthController extends Controller
{
    public function __construct(
        PDO $db,
        array $config,
        private readonly Jwt $jwt,
        private readonly RateLimiter $rateLimiter,
        private readonly Audit $audit
    ) {
        parent::__construct($db, $config);
    }

    public function registerCustomer(Request $request, array $params, ?array $auth): Response
    {
        return $this->register($request, 'customer');
    }

    public function registerProvider(Request $request, array $params, ?array $auth): Response
    {
        return $this->register($request, 'provider');
    }

    public function registerGeneric(Request $request, array $params, ?array $auth): Response
    {
        $role = (string) ($request->body['role'] ?? 'customer');
        if (!in_array($role, ['customer', 'provider'], true)) {
            throw new ApiException(422, 'INVALID_ROLE', 'Escolha cadastro de cliente ou prestador.');
        }
        return $this->register($request, $role);
    }

    private function register(Request $request, string $role): Response
    {
        $this->rateLimiter->check('register:' . $request->ip, 8, 3600);
        $data = Validator::validate($request->body, [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'min:10', 'max:20'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:2'],
        ]);
        $this->assertStrongPassword((string) $data['password']);

        $email = mb_strtolower(trim((string) $data['email']));
        $userPublicId = Uuid::v4();
        $verificationToken = bin2hex(random_bytes(32));

        try {
            $this->db->beginTransaction();
            $statement = $this->db->prepare(
                'INSERT INTO users (public_id, role, name, email, password_hash, phone, status, locale, timezone, created_at, updated_at)
                 VALUES (:public_id, :role, :name, :email, :password_hash, :phone, \'active\', :locale, :timezone, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $statement->execute([
                'public_id' => $userPublicId,
                'role' => $role,
                'name' => trim((string) $data['name']),
                'email' => $email,
                'password_hash' => password_hash((string) $data['password'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT),
                'phone' => isset($data['phone']) ? preg_replace('/\D+/', '', (string) $data['phone']) : null,
                'locale' => $this->config['locale'],
                'timezone' => $this->config['timezone'],
            ]);
            $userId = (int) $this->db->lastInsertId();

            if ($role === 'provider') {
                $profile = $this->db->prepare(
                    'INSERT INTO professional_profiles
                        (user_id, verification_status, base_city, base_state, rating_avg, reviews_count, completed_jobs, created_at, updated_at)
                     VALUES (:user_id, \'pending\', :city, :state, 0, 0, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
                );
                $profile->execute([
                    'user_id' => $userId,
                    'city' => $data['city'] ?? null,
                    'state' => isset($data['state']) ? strtoupper((string) $data['state']) : null,
                ]);
            }

            $verification = $this->db->prepare(
                'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
                 VALUES (:user_id, :token_hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR), UTC_TIMESTAMP())'
            );
            $verification->execute(['user_id' => $userId, 'token_hash' => hash('sha256', $verificationToken)]);

            $event = $this->db->prepare(
                'INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, available_at, created_at)
                 VALUES (\'email.verify\', \'user\', :aggregate_id, :payload, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $event->execute([
                'aggregate_id' => $userPublicId,
                'payload' => json_encode(['email' => $email, 'token' => $verificationToken], JSON_THROW_ON_ERROR),
            ]);
            $this->db->commit();
        } catch (PDOException $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($exception->getCode() === '23000') {
                throw new ApiException(409, 'EMAIL_ALREADY_USED', 'Já existe uma conta com este e-mail.');
            }
            throw $exception;
        }

        $response = [
            'user' => ['id' => $userPublicId, 'name' => trim((string) $data['name']), 'email' => $email, 'role' => $role],
            'message' => 'Conta criada. Verifique seu e-mail para concluir o cadastro.',
        ];
        if ($this->config['env'] === 'local' && $this->config['debug']) {
            $response['debugVerificationToken'] = $verificationToken;
        }
        return Response::data($response, 201);
    }

    public function login(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check('login:' . $request->ip, 10, 900);
        $data = Validator::validate($request->body, [
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:128'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $email = mb_strtolower(trim((string) $data['email']));

        $statement = $this->db->prepare(
            'SELECT id, public_id, role, name, email, phone, password_hash, status, email_verified_at
             FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        if (!$user || !password_verify((string) $data['password'], $user['password_hash'])) {
            usleep(random_int(80000, 160000));
            throw new ApiException(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.');
        }
        if ($user['status'] !== 'active') {
            throw new ApiException(403, 'ACCOUNT_UNAVAILABLE', 'Esta conta está suspensa ou indisponível.');
        }

        if (password_needs_rehash($user['password_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
            $rehash = $this->db->prepare('UPDATE users SET password_hash = :hash, updated_at = UTC_TIMESTAMP() WHERE id = :id');
            $rehash->execute([
                'hash' => password_hash((string) $data['password'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT),
                'id' => $user['id'],
            ]);
        }

        $tokens = $this->createSession($user, $request, (bool) ($data['remember'] ?? false));
        $this->db->prepare('UPDATE users SET last_login_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id')
            ->execute(['id' => $user['id']]);
        $this->audit->record((int) $user['id'], 'auth.login', 'user', $user['public_id'], $request);

        return Response::data([
            'user' => $this->publicUser($user),
            'accessToken' => $tokens['accessToken'],
            'tokenType' => 'Bearer',
            'expiresIn' => $this->config['jwt']['access_ttl'],
        ]);
    }

    public function refresh(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check('refresh:' . $request->ip, 30, 900);
        $refreshToken = (string) ($request->body['refreshToken'] ?? $request->cookies['cv_refresh'] ?? '');
        if ($refreshToken === '') {
            throw new ApiException(401, 'REFRESH_TOKEN_REQUIRED', 'Informe o token de renovação.');
        }

        $claims = $this->jwt->decode($refreshToken, 'refresh');
        $sessionId = (string) ($claims['sid'] ?? '');
        $subject = (string) ($claims['sub'] ?? '');
        $remember = (bool) ($claims['rem'] ?? false);

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT s.id AS auth_session_id, s.refresh_token_hash, u.id, u.public_id, u.role, u.name, u.email, u.phone, u.status, u.email_verified_at
                 FROM auth_sessions s
                 INNER JOIN users u ON u.id = s.user_id
                 WHERE s.public_id = :session AND u.public_id = :subject
                   AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()
                 FOR UPDATE'
            );
            $statement->execute(['session' => $sessionId, 'subject' => $subject]);
            $user = $statement->fetch();
            if (!$user || $user['status'] !== 'active' || !hash_equals($user['refresh_token_hash'], hash('sha256', $refreshToken))) {
                if ($user) {
                    $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = :id')
                        ->execute(['id' => $user['auth_session_id']]);
                }
                $this->db->commit();
                throw new ApiException(401, 'INVALID_REFRESH_TOKEN', 'O token de renovação não é válido.');
            }

            $newRefresh = $this->jwt->issue([
                'sub' => $user['public_id'], 'sid' => $sessionId, 'role' => $user['role'], 'rem' => $remember,
            ], $this->config['jwt']['refresh_ttl'], 'refresh');
            $expires = gmdate('Y-m-d H:i:s', time() + $this->config['jwt']['refresh_ttl']);
            $this->db->prepare(
                'UPDATE auth_sessions SET refresh_token_hash = :hash, expires_at = :expires, last_used_at = UTC_TIMESTAMP() WHERE id = :id'
            )->execute(['hash' => hash('sha256', $newRefresh), 'expires' => $expires, 'id' => $user['auth_session_id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }

        $access = $this->jwt->issue([
            'sub' => $user['public_id'], 'sid' => $sessionId, 'role' => $user['role'],
        ], $this->config['jwt']['access_ttl'], 'access');
        $this->setRefreshCookie($newRefresh, $remember);

        return Response::data([
            'user' => $this->publicUser($user),
            'accessToken' => $access,
            'tokenType' => 'Bearer',
            'expiresIn' => $this->config['jwt']['access_ttl'],
        ]);
    }

    public function logout(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE public_id = :session AND user_id = :user_id')
            ->execute(['session' => $auth['sessionId'], 'user_id' => $auth['id']]);
        $this->clearRefreshCookie();
        $this->audit->record((int) $auth['id'], 'auth.logout', 'user', $auth['publicId'], $request);
        return Response::noContent();
    }

    public function logoutAll(Request $request, array $params, ?array $auth): Response
    {
        $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND revoked_at IS NULL')
            ->execute(['user_id' => $auth['id']]);
        $this->clearRefreshCookie();
        return Response::noContent();
    }

    public function me(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, role, name, email, phone, status, locale, timezone, email_verified_at AS emailVerifiedAt,
                    created_at AS createdAt FROM users WHERE id = :id'
        );
        $statement->execute(['id' => $auth['id']]);
        return Response::data($statement->fetch());
    }

    public function updateMe(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'min:10', 'max:20'],
            'locale' => ['sometimes', 'string', 'in:pt-BR'],
            'timezone' => ['sometimes', 'string', 'max:80'],
        ]);
        if ($data === []) {
            throw new ApiException(422, 'NO_CHANGES', 'Informe ao menos um campo para atualizar.');
        }
        $assignments = [];
        $values = ['id' => $auth['id']];
        foreach ($data as $field => $value) {
            $column = ['name' => 'name', 'phone' => 'phone', 'locale' => 'locale', 'timezone' => 'timezone'][$field];
            $assignments[] = $column . ' = :' . $field;
            $values[$field] = $field === 'phone' && $value !== null ? preg_replace('/\D+/', '', (string) $value) : $value;
        }
        $this->db->prepare('UPDATE users SET ' . implode(', ', $assignments) . ', updated_at = UTC_TIMESTAMP() WHERE id = :id')->execute($values);
        return $this->me($request, [], $auth);
    }

    public function forgotPassword(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check('forgot:' . $request->ip, 5, 3600);
        $data = Validator::validate($request->body, ['email' => ['required', 'email', 'max:190']]);
        $statement = $this->db->prepare('SELECT id, public_id, email FROM users WHERE email = :email AND status = \'active\' LIMIT 1');
        $statement->execute(['email' => mb_strtolower(trim((string) $data['email']))]);
        $user = $statement->fetch();
        $debugToken = null;
        if ($user) {
            $token = bin2hex(random_bytes(32));
            $debugToken = $token;
            $this->db->prepare('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = :user_id AND used_at IS NULL')
                ->execute(['user_id' => $user['id']]);
            $this->db->prepare(
                'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
                 VALUES (:user_id, :hash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR), UTC_TIMESTAMP())'
            )->execute(['user_id' => $user['id'], 'hash' => hash('sha256', $token)]);
            $this->db->prepare(
                'INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, available_at, created_at)
                 VALUES (\'email.password_reset\', \'user\', :aggregate_id, :payload, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'aggregate_id' => $user['public_id'],
                'payload' => json_encode(['email' => $user['email'], 'token' => $token], JSON_THROW_ON_ERROR),
            ]);
        }
        $response = ['message' => 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.'];
        if ($debugToken !== null && $this->config['env'] === 'local' && $this->config['debug']) {
            $response['debugResetToken'] = $debugToken;
        }
        return Response::data($response);
    }

    public function resetPassword(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'token' => ['required', 'string', 'min:64', 'max:64'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ]);
        $this->assertStrongPassword((string) $data['password']);

        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT id, user_id FROM password_reset_tokens
                 WHERE token_hash = :hash AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE'
            );
            $statement->execute(['hash' => hash('sha256', (string) $data['token'])]);
            $token = $statement->fetch();
            if (!$token) {
                throw new ApiException(422, 'INVALID_RESET_TOKEN', 'O link de recuperação é inválido ou expirou.');
            }
            $this->db->prepare('UPDATE users SET password_hash = :hash, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute([
                    'hash' => password_hash((string) $data['password'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT),
                    'id' => $token['user_id'],
                ]);
            $this->db->prepare('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $token['id']]);
            $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = :id AND revoked_at IS NULL')->execute(['id' => $token['user_id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['message' => 'Senha atualizada com sucesso.']);
    }

    public function verifyEmail(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, ['token' => ['required', 'string', 'min:64', 'max:64']]);
        $this->db->beginTransaction();
        try {
            $statement = $this->db->prepare(
                'SELECT id, user_id FROM email_verification_tokens
                 WHERE token_hash = :hash AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() FOR UPDATE'
            );
            $statement->execute(['hash' => hash('sha256', (string) $data['token'])]);
            $token = $statement->fetch();
            if (!$token) {
                throw new ApiException(422, 'INVALID_VERIFICATION_TOKEN', 'O link de verificação é inválido ou expirou.');
            }
            $this->db->prepare('UPDATE users SET email_verified_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['id' => $token['user_id']]);
            $this->db->prepare('UPDATE email_verification_tokens SET used_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute(['id' => $token['id']]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['message' => 'E-mail verificado com sucesso.']);
    }

    private function createSession(array $user, Request $request, bool $remember): array
    {
        $sessionId = Uuid::v4();
        $refreshToken = $this->jwt->issue([
            'sub' => $user['public_id'], 'sid' => $sessionId, 'role' => $user['role'], 'rem' => $remember,
        ], $this->config['jwt']['refresh_ttl'], 'refresh');
        $accessToken = $this->jwt->issue([
            'sub' => $user['public_id'], 'sid' => $sessionId, 'role' => $user['role'],
        ], $this->config['jwt']['access_ttl'], 'access');

        $statement = $this->db->prepare(
            'INSERT INTO auth_sessions
                (public_id, user_id, refresh_token_hash, ip_address, user_agent, expires_at, created_at, last_used_at)
             VALUES (:public_id, :user_id, :hash, :ip, :user_agent, :expires, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $statement->execute([
            'public_id' => $sessionId,
            'user_id' => $user['id'],
            'hash' => hash('sha256', $refreshToken),
            'ip' => $request->ip,
            'user_agent' => mb_substr($request->headers['user-agent'] ?? 'unknown', 0, 500),
            'expires' => gmdate('Y-m-d H:i:s', time() + $this->config['jwt']['refresh_ttl']),
        ]);
        $this->setRefreshCookie($refreshToken, $remember);
        return ['accessToken' => $accessToken, 'refreshToken' => $refreshToken];
    }

    private function setRefreshCookie(string $token, bool $remember): void
    {
        $options = [
            'path' => '/api/v1/auth',
            'secure' => $this->config['jwt']['cookie_secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ];
        if ($remember) {
            $options['expires'] = time() + $this->config['jwt']['refresh_ttl'];
        }
        setcookie('cv_refresh', $token, $options);
    }

    private function clearRefreshCookie(): void
    {
        setcookie('cv_refresh', '', [
            'expires' => time() - 3600,
            'path' => '/api/v1/auth',
            'secure' => $this->config['jwt']['cookie_secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => $user['public_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'role' => $user['role'],
            'emailVerified' => $user['email_verified_at'] !== null,
        ];
    }

    private function assertStrongPassword(string $password): void
    {
        if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
            throw new ApiException(422, 'WEAK_PASSWORD', 'A senha deve conter letra minúscula, maiúscula, número e símbolo.', [
                'password' => ['Use ao menos uma letra minúscula, uma maiúscula, um número e um símbolo.'],
            ]);
        }
    }
}
