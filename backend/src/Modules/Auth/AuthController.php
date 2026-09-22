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
use ChezVoust\Core\SensitivePayload;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;
use PDO;
use PDOException;

final class AuthController extends Controller
{
    // Hash propositalmente inválido para qualquer senha. Ele força o mesmo
    // trabalho criptográfico na tentativa com e-mail inexistente, evitando o
    // atalho temporal causado pelo short-circuit de `||` no login.
    private const DUMMY_PASSWORD_HASH = '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

    public function __construct(
        PDO $db,
        array $config,
        private readonly Jwt $jwt,
        private readonly RateLimiter $rateLimiter,
        private readonly Audit $audit,
        private readonly SensitivePayload $sensitivePayload
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
                'payload' => $this->sensitivePayload->encrypt(['email' => $email, 'token' => $verificationToken]),
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
        // O teto por IP contém abuso volumétrico sem bloquear uma rede inteira
        // após poucas tentativas. O balde mais estrito é isolado por conta e IP.
        $this->rateLimiter->check('login-ip:' . $request->ip, 100, 900);
        $data = Validator::validate($request->body, [
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'max:128'],
            'remember' => ['sometimes', 'boolean'],
        ]);
        $email = mb_strtolower(trim((string) $data['email']));
        $this->rateLimiter->check('login-account-ip:' . $email . ':' . $request->ip, 10, 900);

        $statement = $this->db->prepare(
            'SELECT id, public_id, role, name, email, phone, avatar_path, avatar_updated_at, password_hash, status, email_verified_at
             FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1'
        );
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        $passwordHash = $user ? (string) $user['password_hash'] : self::DUMMY_PASSWORD_HASH;
        $passwordMatches = password_verify((string) $data['password'], $passwordHash);
        if (!$user || !$passwordMatches) {
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
        $refreshToken = (string) ($request->cookies['cv_refresh'] ?? '');
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
                'SELECT s.id AS auth_session_id, s.refresh_token_hash, s.previous_refresh_token_hash, s.previous_refresh_expires_at,
                        u.id, u.public_id, u.role, u.name, u.email, u.phone, u.avatar_path, u.avatar_updated_at, u.status, u.email_verified_at
                 FROM auth_sessions s
                 INNER JOIN users u ON u.id = s.user_id
                 WHERE s.public_id = :session AND u.public_id = :subject
                   AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()
                 FOR UPDATE'
            );
            $statement->execute(['session' => $sessionId, 'subject' => $subject]);
            $user = $statement->fetch();
            $tokenHash = hash('sha256', $refreshToken);
            $currentToken = $user && hash_equals((string) $user['refresh_token_hash'], $tokenHash);
            $previousExpiry = $user ? strtotime((string) ($user['previous_refresh_expires_at'] ?? '') . ' UTC') : false;
            $graceToken = $user && !$currentToken
                && is_string($user['previous_refresh_token_hash'] ?? null)
                && hash_equals((string) $user['previous_refresh_token_hash'], $tokenHash)
                && $previousExpiry !== false && $previousExpiry >= time();
            if (!$user || $user['status'] !== 'active' || (!$currentToken && !$graceToken)) {
                if ($user && !$graceToken) {
                    $this->db->prepare('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = :id')
                        ->execute(['id' => $user['auth_session_id']]);
                }
                $this->db->commit();
                throw new ApiException(401, 'INVALID_REFRESH_TOKEN', 'O token de renovação não é válido.');
            }

            $newRefresh = null;
            if ($currentToken) {
                $newRefresh = $this->jwt->issue([
                    'sub' => $user['public_id'], 'sid' => $sessionId, 'role' => $user['role'], 'rem' => $remember,
                ], $this->config['jwt']['refresh_ttl'], 'refresh');
                $expires = gmdate('Y-m-d H:i:s', time() + $this->config['jwt']['refresh_ttl']);
                $this->db->prepare(
                    'UPDATE auth_sessions
                     SET previous_refresh_token_hash = refresh_token_hash,
                         previous_refresh_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 SECOND),
                         refresh_token_hash = :hash, expires_at = :expires, last_used_at = UTC_TIMESTAMP()
                     WHERE id = :id'
                )->execute(['hash' => hash('sha256', $newRefresh), 'expires' => $expires, 'id' => $user['auth_session_id']]);
            } else {
                // A segunda aba recebeu o cookie recém-rotacionado do navegador.
                // Só emite access token e nunca sobrescreve esse cookie com o antigo.
                $this->db->prepare('UPDATE auth_sessions SET last_used_at = UTC_TIMESTAMP() WHERE id = :id')
                    ->execute(['id' => $user['auth_session_id']]);
            }
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
        if ($newRefresh !== null) {
            $this->setRefreshCookie($newRefresh, $remember);
        }

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
        $this->audit->record((int) $auth['id'], 'auth.logout_all', 'user', $auth['publicId'], $request);
        return Response::noContent();
    }

    public function sessions(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, ip_address AS ipAddress, user_agent AS userAgent,
                    DATE_FORMAT(created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS createdAt,
                    DATE_FORMAT(last_used_at, \'%Y-%m-%dT%H:%i:%sZ\') AS lastUsedAt,
                    DATE_FORMAT(expires_at, \'%Y-%m-%dT%H:%i:%sZ\') AS expiresAt
             FROM auth_sessions
             WHERE user_id = :user_id AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()
             ORDER BY last_used_at DESC, created_at DESC'
        );
        $statement->execute(['user_id' => $auth['id']]);
        $sessions = $statement->fetchAll();
        foreach ($sessions as &$session) {
            $session['current'] = hash_equals((string) $auth['sessionId'], (string) $session['id']);
            $session['device'] = $this->deviceLabel((string) ($session['userAgent'] ?? ''));
        }
        unset($session);
        return Response::data($sessions);
    }

    public function revokeSession(Request $request, array $params, ?array $auth): Response
    {
        if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', (string) $params['id']) !== 1) {
            throw new ApiException(404, 'SESSION_NOT_FOUND', 'Sessão não encontrada.');
        }
        if (hash_equals((string) $auth['sessionId'], (string) $params['id'])) {
            throw new ApiException(409, 'CURRENT_SESSION', 'Use a opção sair para encerrar este dispositivo.');
        }
        $statement = $this->db->prepare(
            'UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
             WHERE public_id = :session AND user_id = :user_id AND revoked_at IS NULL'
        );
        $statement->execute(['session' => $params['id'], 'user_id' => $auth['id']]);
        if ($statement->rowCount() !== 1) {
            throw new ApiException(404, 'SESSION_NOT_FOUND', 'Sessão não encontrada.');
        }
        $this->audit->record((int) $auth['id'], 'auth.session_revoke', 'auth_session', (string) $params['id'], $request);
        return Response::noContent();
    }

    public function changePassword(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check('password-change:' . $auth['id'] . ':' . $request->ip, 5, 3600);
        $data = Validator::validate($request->body, [
            'currentPassword' => ['required', 'string', 'max:128'],
            'newPassword' => ['required', 'string', 'min:8', 'max:128'],
        ]);
        $this->assertStrongPassword((string) $data['newPassword']);
        if (hash_equals((string) $data['currentPassword'], (string) $data['newPassword'])) {
            throw new ApiException(422, 'PASSWORD_UNCHANGED', 'A nova senha deve ser diferente da senha atual.');
        }
        $statement = $this->db->prepare('SELECT password_hash FROM users WHERE id = :id AND deleted_at IS NULL');
        $statement->execute(['id' => $auth['id']]);
        $hash = (string) $statement->fetchColumn();
        if ($hash === '' || !password_verify((string) $data['currentPassword'], $hash)) {
            throw new ApiException(422, 'INVALID_CURRENT_PASSWORD', 'A senha atual está incorreta.');
        }

        $this->db->beginTransaction();
        try {
            $this->db->prepare('UPDATE users SET password_hash = :hash, updated_at = UTC_TIMESTAMP() WHERE id = :id')
                ->execute([
                    'hash' => password_hash((string) $data['newPassword'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT),
                    'id' => $auth['id'],
                ]);
            $this->db->prepare(
                'UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP()
                 WHERE user_id = :user_id AND public_id <> :current_session AND revoked_at IS NULL'
            )->execute(['user_id' => $auth['id'], 'current_session' => $auth['sessionId']]);
            $this->notify(
                (int) $auth['id'],
                'security.password_changed',
                'Senha atualizada',
                'Sua senha foi alterada e os outros dispositivos foram desconectados.'
            );
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        $this->audit->record((int) $auth['id'], 'auth.password_change', 'user', $auth['publicId'], $request);
        return Response::data(['message' => 'Senha atualizada. Os outros dispositivos foram desconectados.']);
    }

    public function me(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, role, name, email, phone, avatar_path AS avatarPath, avatar_updated_at AS avatarUpdatedAt, status, locale, timezone, email_verified_at AS emailVerifiedAt,
                    created_at AS createdAt FROM users WHERE id = :id'
        );
        $statement->execute(['id' => $auth['id']]);
        $user = $statement->fetch();
        $user['avatarUrl'] = $this->avatarUrl((string) $user['id'], $user['avatarPath'] ?? null, $user['avatarUpdatedAt'] ?? null);
        unset($user['avatarPath'], $user['avatarUpdatedAt']);
        return Response::data($user);
    }

    public function updateMe(Request $request, array $params, ?array $auth): Response
    {
        $data = Validator::validate($request->body, [
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'min:10', 'max:20'],
            'locale' => ['sometimes', 'string', 'in:pt-BR,en-US,fr-FR'],
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

        // Mantém custo criptográfico constante mesmo quando a conta não existe.
        // O endpoint continua devolvendo a mesma resposta pública em ambos os casos.
        password_verify('password-reset-timing-probe', self::DUMMY_PASSWORD_HASH);
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
                'payload' => $this->sensitivePayload->encrypt(['email' => $user['email'], 'token' => $token]),
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
        $this->rateLimiter->check('password-reset:' . $request->ip, 10, 3600);
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
            $this->notify(
                (int) $token['user_id'],
                'security.password_reset',
                'Senha redefinida',
                'Sua senha foi redefinida com sucesso. Entre novamente para continuar.'
            );
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
        $this->rateLimiter->check('email-verify:' . $request->ip, 10, 3600);
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
            $this->notify(
                (int) $token['user_id'],
                'account.email_verified',
                'E-mail confirmado',
                'Seu endereço de e-mail foi confirmado e todos os recursos da conta estão disponíveis.'
            );
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
            'samesite' => 'Strict',
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
            'samesite' => 'Strict',
        ]);
    }

    private function publicUser(array $user): array
    {
        return [
            'id' => $user['public_id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'avatarUrl' => $this->avatarUrl((string) $user['public_id'], $user['avatar_path'] ?? null, $user['avatar_updated_at'] ?? null),
            'role' => $user['role'],
            'emailVerified' => $user['email_verified_at'] !== null,
        ];
    }

    private function avatarUrl(string $publicId, mixed $path, mixed $updatedAt): ?string
    {
        if (!is_string($path) || $path === '') {
            return null;
        }
        return '/api/v1/avatars/' . rawurlencode($publicId) . '?v=' . urlencode((string) ($updatedAt ?? '0'));
    }

    private function assertStrongPassword(string $password): void
    {
        if (!preg_match('/[a-z]/', $password) || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
            throw new ApiException(422, 'WEAK_PASSWORD', 'A senha deve conter letra minúscula, maiúscula, número e símbolo.', [
                'password' => ['Use ao menos uma letra minúscula, uma maiúscula, um número e um símbolo.'],
            ]);
        }
    }

    private function deviceLabel(string $userAgent): string
    {
        $browser = str_contains($userAgent, 'Edg/') ? 'Edge'
            : (str_contains($userAgent, 'Chrome/') ? 'Chrome'
            : (str_contains($userAgent, 'Firefox/') ? 'Firefox'
            : (str_contains($userAgent, 'Safari/') ? 'Safari' : 'Navegador')));
        $system = str_contains($userAgent, 'Android') ? 'Android'
            : (str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad') ? 'iOS'
            : (str_contains($userAgent, 'Windows') ? 'Windows'
            : (str_contains($userAgent, 'Mac OS') ? 'macOS'
            : (str_contains($userAgent, 'Linux') ? 'Linux' : 'dispositivo desconhecido'))));
        return $browser . ' em ' . $system;
    }
}
