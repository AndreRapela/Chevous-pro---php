<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Users;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;

final class MediaController extends Controller
{
    public function avatar(Request $request, array $params, ?array $auth): Response
    {
        $user = $this->requireRow(
            'SELECT avatar_path FROM users WHERE public_id = :id AND status = \'active\' AND deleted_at IS NULL',
            ['id' => $params['id']],
            'Foto de perfil não encontrada.'
        );
        $path = (string) ($user['avatar_path'] ?? '');
        $base = realpath(dirname(__DIR__, 3) . '/storage/uploads/avatars');
        $realPath = $path !== '' ? realpath($path) : false;
        if ($base === false || $realPath === false || !str_starts_with($realPath, $base . DIRECTORY_SEPARATOR)) {
            throw new ApiException(404, 'AVATAR_NOT_FOUND', 'Foto de perfil não encontrada.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($realPath);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiException(404, 'AVATAR_NOT_FOUND', 'Foto de perfil não encontrada.');
        }
        return Response::file($realPath, $mime, 86400);
    }
}
