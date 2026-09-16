<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Users;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\RateLimiter;
use ChezVoust\Core\Response;
use ChezVoust\Core\Uuid;
use ChezVoust\Core\Validator;

final class AccountController extends Controller
{
    public function __construct(\PDO $db, array $config, private readonly RateLimiter $rateLimiter)
    {
        parent::__construct($db, $config);
    }

    public function updateAvatar(Request $request, array $params, ?array $auth): Response
    {
        $this->rateLimiter->check('avatar:user:' . $auth['id'], 12, 3600);
        $this->rateLimiter->check('avatar:ip:' . $request->ip, 36, 3600);
        $file = $request->files['avatar'] ?? null;
        if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new ApiException(422, 'AVATAR_REQUIRED', 'Escolha uma imagem válida para o perfil.');
        }
        if ((int) ($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new ApiException(422, 'AVATAR_UPLOAD_FAILED', 'Não foi possível receber a foto. Use uma imagem de até 5 MB e tente novamente.');
        }
        $maxBytes = max(1, (int) ($this->config['upload_max_bytes'] ?? 5 * 1024 * 1024));
        $size = (int) ($file['size'] ?? 0);
        $temporaryPath = (string) ($file['tmp_name'] ?? '');
        if ($size < 1 || $size > $maxBytes || !is_uploaded_file($temporaryPath)) {
            throw new ApiException(422, 'INVALID_AVATAR', 'A foto deve ter no máximo 5 MB.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiException(422, 'INVALID_AVATAR', 'Envie uma imagem JPG, PNG ou WebP.');
        }
        $dimensions = @getimagesize($temporaryPath);
        if ($dimensions === false || $dimensions[0] < 96 || $dimensions[1] < 96 || $dimensions[0] > 2048 || $dimensions[1] > 2048 || $dimensions[0] * $dimensions[1] > 4_000_000) {
            throw new ApiException(422, 'INVALID_AVATAR_DIMENSIONS', 'A foto precisa ter entre 96 e 2048 pixels por lado e até 4 megapixels.');
        }
        $user = $this->requireRow('SELECT public_id, avatar_path FROM users WHERE id = :id', ['id' => $auth['id']]);
        $directory = dirname(__DIR__, 3) . '/storage/uploads/avatars';
        if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
            throw new ApiException(500, 'AVATAR_STORAGE_UNAVAILABLE', 'Não foi possível salvar a foto agora.');
        }
        $target = $directory . DIRECTORY_SEPARATOR . $user['public_id'] . '-' . bin2hex(random_bytes(8)) . '.webp';
        $image = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($temporaryPath),
            'image/png' => @imagecreatefrompng($temporaryPath),
            'image/webp' => @imagecreatefromwebp($temporaryPath),
        };
        if ($image === false) {
            throw new ApiException(422, 'INVALID_AVATAR', 'Não foi possível ler esta imagem.');
        }
        if ($dimensions[0] > 1024 || $dimensions[1] > 1024) {
            $ratio = min(1024 / $dimensions[0], 1024 / $dimensions[1]);
            $resized = imagescale($image, max(1, (int) round($dimensions[0] * $ratio)), max(1, (int) round($dimensions[1] * $ratio)));
            if ($resized === false) {
                imagedestroy($image);
                throw new ApiException(422, 'INVALID_AVATAR', 'Não foi possível processar esta imagem.');
            }
            imagedestroy($image);
            $image = $resized;
        }
        imagepalettetotruecolor($image);
        imagealphablending($image, true);
        imagesavealpha($image, true);
        $saved = @imagewebp($image, $target, 85);
        imagedestroy($image);
        if (!$saved) {
            throw new ApiException(500, 'AVATAR_UPLOAD_FAILED', 'Não foi possível salvar a foto agora.');
        }
        $this->db->prepare('UPDATE users SET avatar_path = :path, avatar_updated_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = :id')
            ->execute(['path' => $target, 'id' => $auth['id']]);
        $oldPath = (string) ($user['avatar_path'] ?? '');
        $realDirectory = realpath($directory);
        $realOldPath = $oldPath !== '' ? realpath($oldPath) : false;
        if ($realDirectory !== false && $realOldPath !== false && str_starts_with($realOldPath, $realDirectory . DIRECTORY_SEPARATOR)) {
            @unlink($realOldPath);
        }
        return $this->profile($auth['id']);
    }

    private function profile(int $userId): Response
    {
        $row = $this->requireRow(
            'SELECT public_id AS id, role, name, email, phone, avatar_path AS avatarPath, avatar_updated_at AS avatarUpdatedAt FROM users WHERE id = :id',
            ['id' => $userId]
        );
        $row['avatarUrl'] = $this->avatarUrl((string) $row['id'], $row['avatarPath'] ?? null, $row['avatarUpdatedAt'] ?? null);
        unset($row['avatarPath'], $row['avatarUpdatedAt']);
        return Response::data($row);
    }

    private function avatarUrl(string $publicId, mixed $path, mixed $updatedAt): ?string
    {
        if (!is_string($path) || $path === '') {
            return null;
        }
        return '/api/v1/avatars/' . rawurlencode($publicId) . '?v=' . urlencode((string) ($updatedAt ?? '0'));
    }

    public function addresses(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'SELECT public_id AS id, label, street, number, complement, neighborhood, city, state,
                    postal_code AS postalCode, is_default AS isDefault
             FROM addresses WHERE user_id = :user_id AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC'
        );
        $statement->execute(['user_id' => $auth['id']]);
        return Response::data($statement->fetchAll());
    }

    public function createAddress(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedAddress($request->body);
        $publicId = Uuid::v4();
        $this->db->beginTransaction();
        try {
            if (!empty($data['isDefault'])) {
                $this->db->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = :user_id')->execute(['user_id' => $auth['id']]);
            }
            $this->db->prepare(
                'INSERT INTO addresses
                    (public_id, user_id, label, street, number, complement, neighborhood, city, state, postal_code, is_default, created_at, updated_at)
                 VALUES (:public_id, :user_id, :label, :street, :number, :complement, :neighborhood, :city, :state, :postal_code, :is_default, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            )->execute([
                'public_id' => $publicId, 'user_id' => $auth['id'], 'label' => $data['label'], 'street' => $data['street'],
                'number' => $data['number'], 'complement' => $data['complement'] ?? null, 'neighborhood' => $data['neighborhood'],
                'city' => $data['city'], 'state' => strtoupper((string) $data['state']),
                'postal_code' => preg_replace('/\D+/', '', (string) $data['postalCode']), 'is_default' => !empty($data['isDefault']) ? 1 : 0,
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $publicId] + $data, 201);
    }

    public function updateAddress(Request $request, array $params, ?array $auth): Response
    {
        $data = $this->validatedAddress($request->body);
        $address = $this->requireRow(
            'SELECT id FROM addresses WHERE public_id = :id AND user_id = :user_id AND deleted_at IS NULL',
            ['id' => $params['id'], 'user_id' => $auth['id']],
            'Endereço não encontrado.'
        );
        $this->db->beginTransaction();
        try {
            if (!empty($data['isDefault'])) {
                $this->db->prepare('UPDATE addresses SET is_default = 0 WHERE user_id = :user_id')->execute(['user_id' => $auth['id']]);
            }
            $this->db->prepare(
                'UPDATE addresses SET label = :label, street = :street, number = :number, complement = :complement,
                    neighborhood = :neighborhood, city = :city, state = :state, postal_code = :postal_code,
                    is_default = :is_default, updated_at = UTC_TIMESTAMP() WHERE id = :id'
            )->execute([
                'label' => $data['label'], 'street' => $data['street'], 'number' => $data['number'],
                'complement' => $data['complement'] ?? null, 'neighborhood' => $data['neighborhood'], 'city' => $data['city'],
                'state' => strtoupper((string) $data['state']), 'postal_code' => preg_replace('/\D+/', '', (string) $data['postalCode']),
                'is_default' => !empty($data['isDefault']) ? 1 : 0, 'id' => $address['id'],
            ]);
            $this->db->commit();
        } catch (\Throwable $exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $exception;
        }
        return Response::data(['id' => $params['id']] + $data);
    }

    public function deleteAddress(Request $request, array $params, ?array $auth): Response
    {
        $statement = $this->db->prepare(
            'UPDATE addresses SET deleted_at = UTC_TIMESTAMP(), is_default = 0, updated_at = UTC_TIMESTAMP()
             WHERE public_id = :id AND user_id = :user_id AND deleted_at IS NULL'
        );
        $statement->execute(['id' => $params['id'], 'user_id' => $auth['id']]);
        if ($statement->rowCount() === 0) {
            throw new ApiException(404, 'ADDRESS_NOT_FOUND', 'Endereço não encontrado.');
        }
        return Response::noContent();
    }

    private function validatedAddress(array $body): array
    {
        return Validator::validate($body, [
            'label' => ['required', 'string', 'min:2', 'max:60'], 'street' => ['required', 'string', 'min:2', 'max:180'],
            'number' => ['required', 'string', 'max:20'], 'complement' => ['nullable', 'string', 'max:100'],
            'neighborhood' => ['required', 'string', 'max:100'], 'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'min:2', 'max:2'], 'postalCode' => ['required', 'string', 'min:8', 'max:9'],
            'isDefault' => ['sometimes', 'boolean'],
        ]);
    }
}
