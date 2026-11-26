<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Auth;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Audit;
use ChezVoust\Core\Controller;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Core\Validator;
use ChezVoust\Modules\Mail\MailOutbox;
use PDO;
use PDOException;
use Throwable;

final class EmailChangeController extends Controller
{
    public function __construct(
        PDO $db,
        array $config,
        private readonly RateLimiter $rateLimiter,
        private readonly Audit $audit,
        private readonly MailOutbox $mailOutbox
    ) {
        parent::__construct($db, $config);
    }

    public function pending(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT t.email FROM account_email_changes t INNER JOIN users u ON u.id = t.user_id
             WHERE t.user_id = :id AND t.expires_at > UTC_TIMESTAMP() AND t.password_digest = SHA2(u.password_hash, 256)'
        );
        $statement->execute(['id' => $auth['id']]);
        return Response::data(['email' => $statement->fetchColumn() ?: null]);
    }

    public function requestChange(Request $request, array $params, ?array $auth): Response
    {
        $userId = (int) $auth['id'];
        $this->rateLimiter->check('email-change-request:account:' . $userId, 5, 3600);
        $this->rateLimiter->check('email-change-request:ip:' . $request->ip, 30, 3600);
        $data = Validator::validate($request->body, [
            'email' => ['required', 'email', 'max:190'],
            'currentPassword' => ['required', 'string', 'min:1', 'max:128'],
            'locale' => ['sometimes', 'string', 'max:20'],
        ]);
        $email = mb_strtolower(trim($data['email']));
        return $this->transaction(function () use ($userId, $email, $data): Response {
            $user = $this->lockAccount($userId);
            if (!$user || !password_verify($data['currentPassword'], $user['password_hash'])) {
                throw new ApiException(422, 'INVALID_CURRENT_PASSWORD', 'A senha atual está incorreta.');
            }
            if ($email === mb_strtolower($user['email'])) {
                throw new ApiException(422, 'EMAIL_UNCHANGED', 'Informe um e-mail diferente do atual.');
            }
            $this->requireAvailableAddress($email);
            return $this->issue($user, $email, trim($data['locale'] ?? '') ?: $user['locale']);
        });
    }

    public function resend(Request $request, array $params, ?array $auth): Response
    {
        $userId = (int) $auth['id'];
        $this->rateLimiter->check('email-change-resend:account:' . $userId, 3, 3600);
        $data = Validator::validate($request->body, ['locale' => ['sometimes', 'string', 'max:20']]);
        return $this->transaction(function () use ($userId, $data): Response {
            $user = $this->lockAccount($userId);
            $pending = $user ? $this->activeChange($user) : false;
            if (!$pending) {
                throw new ApiException(422, 'EMAIL_CHANGE_EXPIRED', 'Solicite uma nova troca de e-mail no perfil.');
            }
            $this->requireAvailableAddress($pending['email']);
            return $this->issue($user, $pending['email'], trim($data['locale'] ?? '') ?: $user['locale']);
        });
    }

    public function verify(Request $request, array $params, ?array $auth): Response
    {
        $byCode = $auth !== null;
        $tokenHash = null;
        if ($byCode) {
            $userId = (int) $auth['id'];
            $this->rateLimiter->check('email-change-code:account:' . $userId, 8, 900);
            $data = Validator::validate($request->body, ['code' => ['required', 'string', 'regex:/^[0-9]{6}$/D']]);
            $invalid = new ApiException(422, 'INVALID_VERIFICATION_CODE', 'Código inválido ou expirado. Use o código mais recente.');
        } else {
            $this->rateLimiter->check('email-change-link:ip:' . $request->ip, 10, 3600);
            $data = Validator::validate($request->body, ['token' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/D']]);
            $tokenHash = hash('sha256', $data['token']);
            $lookup = $this->db->prepare('SELECT user_id FROM account_email_changes WHERE token_hash = :hash');
            $lookup->execute(['hash' => $tokenHash]);
            $userId = (int) $lookup->fetchColumn();
            $invalid = new ApiException(422, 'INVALID_VERIFICATION_TOKEN', 'O link de verificação é inválido ou expirou.');
        }

        try {
            return $this->transaction(function () use ($userId, $byCode, $data, $tokenHash, $invalid, $request): Response {
                $user = $this->lockAccount($userId);
                $pending = $user ? $this->activeChange($user) : false;
                if (!$pending) {
                    throw $invalid;
                }
                $valid = $byCode
                    ? $pending['code_valid'] && hash_equals($this->code($pending['token_hash']), $data['code'])
                    : hash_equals($pending['token_hash'], $tokenHash);
                if (!$valid) {
                    throw $invalid;
                }

                $this->db->prepare(
                    'UPDATE users SET email = :email, email_verified_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id'
                )->execute(['email' => $pending['email'], 'id' => $userId]);
                $this->db->prepare('DELETE FROM account_email_changes WHERE user_id = :id')->execute(['id' => $userId]);
                $this->db->prepare(
                    'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = :id AND used_at IS NULL'
                )->execute(['id' => $userId]);
                $this->db->prepare(
                    'UPDATE email_verification_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = :id AND used_at IS NULL'
                )->execute(['id' => $userId]);
                $this->audit->record($userId, 'auth.email_change', 'user', $user['public_id'], $request);
                return Response::data(['message' => 'Seu novo e-mail foi confirmado.']);
            });
        } catch (PDOException $failure) {
            if ($failure->getCode() === '23000') {
                throw new ApiException(409, 'EMAIL_ALREADY_USED', 'Já existe uma conta com este e-mail.');
            }
            throw $failure;
        }
    }

    private function lockAccount(int $id): array|false
    {
        $statement = $this->db->prepare(
            "SELECT id, public_id, email, locale, password_hash FROM users
             WHERE id = :id AND status = 'active' AND deleted_at IS NULL FOR UPDATE"
        );
        $statement->execute(['id' => $id]);
        return $statement->fetch();
    }

    private function activeChange(array $user): array|false
    {
        $statement = $this->db->prepare(
            'SELECT email, token_hash, created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE) AS code_valid
             FROM account_email_changes WHERE user_id = :id AND expires_at > UTC_TIMESTAMP() AND password_digest = :password_digest'
        );
        $statement->execute(['id' => $user['id'], 'password_digest' => hash('sha256', $user['password_hash'])]);
        return $statement->fetch();
    }

    private function requireAvailableAddress(string $email): void
    {
        $statement = $this->db->prepare('SELECT 1 FROM users WHERE email = :email');
        $statement->execute(['email' => $email]);
        if ($statement->fetchColumn()) {
            throw new ApiException(409, 'EMAIL_ALREADY_USED', 'Já existe uma conta com este e-mail.');
        }
    }

    private function issue(array $user, string $email, string $locale): Response
    {
        $token = bin2hex(random_bytes(32));
        $hash = hash('sha256', $token);
        $code = $this->code($hash);
        $this->db->prepare(
            'INSERT INTO account_email_changes (user_id, email, token_hash, password_digest, created_at, expires_at)
             VALUES (:id, :email, :hash, :password_digest, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))
             ON DUPLICATE KEY UPDATE email = VALUES(email), token_hash = VALUES(token_hash), password_digest = VALUES(password_digest),
                                     created_at = VALUES(created_at), expires_at = VALUES(expires_at)'
        )->execute(['id' => $user['id'], 'email' => $email, 'hash' => $hash, 'password_digest' => hash('sha256', $user['password_hash'])]);
        $this->mailOutbox->enqueue('email.change', $user['public_id'], $email, $token, $locale, $code);
        $response = ['email' => $email];
        if ($this->config['env'] === 'local' && $this->config['debug'] && $this->config['mail']['driver'] === 'log') {
            $response['debugVerificationToken'] = $token;
            $response['debugVerificationCode'] = $code;
        }
        return Response::data($response);
    }

    private function code(string $tokenHash): string
    {
        return EmailVerificationCode::fromTokenHash($tokenHash, $this->config['jwt']['secret']);
    }

    private function transaction(callable $operation): Response
    {
        $this->db->beginTransaction();
        try {
            $response = $operation();
            $this->db->commit();
            return $response;
        } catch (Throwable $failure) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $failure;
        }
    }
}
