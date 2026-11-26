<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Admin;

use ChezVoust\Core\ApiException;
use ChezVoust\Core\Controller;
use ChezVoust\Core\Request;
use ChezVoust\Core\Response;
use ChezVoust\Modules\Catalog\PromotionVideo;
use PDO;

final class PromotionMediaController extends Controller
{
    private const MAX_BYTES = 25 * 1024 * 1024;

    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
    ];

    public function __construct(PDO $db, array $config, private readonly PromotionUploads $uploads)
    {
        parent::__construct($db, $config);
    }

    public function upload(Request $request, array $params, ?array $auth): Response
    {
        $file = $request->files['media'] ?? null;
        if (!is_array($file) || (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new ApiException(422, 'PROMOTION_MEDIA_REQUIRED', 'Escolha uma imagem ou vídeo para enviar.');
        }
        if ((int) ($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new ApiException(422, 'PROMOTION_MEDIA_UPLOAD_FAILED', 'Não foi possível receber o arquivo. Use uma imagem ou vídeo de até 25 MB.');
        }

        $temporaryPath = (string) ($file['tmp_name'] ?? '');
        $size = (int) ($file['size'] ?? 0);
        if ($size < 1 || $size > self::MAX_BYTES || !is_uploaded_file($temporaryPath)) {
            throw new ApiException(422, 'INVALID_PROMOTION_MEDIA_SIZE', 'O arquivo deve ter no máximo 25 MB.');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($temporaryPath);
        if (!is_string($mime) || !isset(self::MIME_EXTENSIONS[$mime])) {
            throw new ApiException(422, 'INVALID_PROMOTION_MEDIA_TYPE', 'Envie uma imagem JPG, PNG ou WebP, ou um vídeo MP4 ou WebM.');
        }
        $isVideo = str_starts_with($mime, 'video/');
        $duration = $isVideo ? PromotionVideo::requireDuration(PromotionVideo::duration($temporaryPath, self::MIME_EXTENSIONS[$mime])) : null;

        $filename = $this->uploads->store($temporaryPath, self::MIME_EXTENSIONS[$mime]);

        return Response::data([
            'url' => PromotionUploads::URL_PREFIX . $filename,
            'mediaType' => $isVideo ? 'video' : 'image',
            'videoDurationMs' => $duration,
        ], 201);
    }

    public function media(Request $request, array $params, ?array $auth): Response
    {
        $filename = (string) ($params['filename'] ?? '');
        $path = $this->uploads->path($filename);
        if ($path === null) {
            throw new ApiException(404, 'PROMOTION_MEDIA_NOT_FOUND', 'Arquivo não encontrado.');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (!is_string($mime) || !isset(self::MIME_EXTENSIONS[$mime])) {
            throw new ApiException(404, 'PROMOTION_MEDIA_NOT_FOUND', 'Arquivo não encontrado.');
        }

        $length = (int) filesize($path);
        $headers = [
            'Content-Type' => $mime,
            'Content-Length' => (string) $length,
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ];
        if (str_starts_with($mime, 'video/')) {
            $headers['Accept-Ranges'] = 'bytes';
            $range = $request->headers['range'] ?? '';
            if (preg_match('/^bytes=(\d*)-(\d*)$/D', $range, $matches) === 1 && ($matches[1] !== '' || $matches[2] !== '')) {
                $start = $matches[1] === '' ? max(0, $length - (int) $matches[2]) : (int) $matches[1];
                $end = $matches[1] === '' || $matches[2] === '' ? $length - 1 : min($length - 1, (int) $matches[2]);
                if ($start >= $length || $end < $start) {
                    $headers['Content-Range'] = 'bytes */' . $length;
                    $headers['Content-Length'] = '0';
                    return new Response('', 416, $headers, rawBody: true);
                }

                $bytes = $end - $start + 1;
                $headers['Content-Length'] = (string) $bytes;
                $headers['Content-Range'] = "bytes {$start}-{$end}/{$length}";
                return new Response(null, 206, $headers, stream: static function () use ($path, $start, $bytes): void {
                    $file = fopen($path, 'rb');
                    if ($file === false) return;
                    $output = fopen('php://output', 'wb');
                    if ($output !== false) {
                        stream_copy_to_stream($file, $output, $bytes, $start);
                        fclose($output);
                    }
                    fclose($file);
                });
            }
        }
        return new Response(null, 200, $headers, $path);
    }
}
