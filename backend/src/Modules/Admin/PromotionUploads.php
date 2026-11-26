<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Admin;

use ChezVoust\Core\ApiException;
use DirectoryIterator;
use PDO;

final class PromotionUploads
{
    public const URL_PREFIX = '/api/v1/promotion-media/';
    private const GRACE_SECONDS = 86400;
    private const CLEANUP_KEY = 'promotion_uploads_last_cleanup';

    public function __construct(
        private readonly PDO $db,
        private readonly string $databaseName,
        private readonly string $directory = __DIR__ . '/../../../storage/uploads/promotions',
    ) {
    }

    public static function validFilename(string $filename): bool
    {
        return preg_match('/^[a-f0-9]{48}\.(?:jpg|png|webp|mp4|webm)$/D', $filename) === 1;
    }

    public function path(string $filename): ?string
    {
        if (!self::validFilename($filename)) {
            return null;
        }
        $path = $this->directory . '/' . $filename;
        return !is_link($path) && is_file($path) ? $path : null;
    }

    public function store(string $temporaryPath, string $extension): string
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0750, true) && !is_dir($this->directory)) {
            throw new ApiException(500, 'PROMOTION_MEDIA_STORAGE_UNAVAILABLE', 'Não foi possível salvar o arquivo agora.');
        }
        $filename = bin2hex(random_bytes(24)) . '.' . $extension;
        // A reservation exists even if the request stops before or during the move.
        $this->db->prepare('INSERT INTO promotion_uploads (filename, created_at, expires_at) VALUES (?, UTC_TIMESTAMP(), ?)')
            ->execute([$filename, $this->deadline()]);
        if (!move_uploaded_file($temporaryPath, $this->directory . '/' . $filename)) {
            throw new ApiException(500, 'PROMOTION_MEDIA_UPLOAD_FAILED', 'Não foi possível salvar o arquivo agora.');
        }
        return $filename;
    }

    public function withCampaignLock(callable $operation, int $wait = 5): mixed
    {
        // Shared with campaign writes, including the existing limit on the number of videos.
        $name = hash('sha256', 'promotion-video-limit:' . $this->databaseName);
        $lock = $this->db->prepare('SELECT GET_LOCK(?, ?)');
        $lock->bindValue(1, $name);
        $lock->bindValue(2, $wait, PDO::PARAM_INT);
        $lock->execute();
        if ((int) $lock->fetchColumn() !== 1) {
            if ($wait === 0) {
                return null;
            }
            throw new ApiException(409, 'PROMOTION_EDIT_BUSY', 'Outra campanha está sendo salva. Tente novamente.');
        }
        try {
            return $operation();
        } finally {
            $this->db->prepare('SELECT RELEASE_LOCK(?)')->execute([$name]);
        }
    }

    public function attachNewReferences(array $saved, array $previous, string $siteUrl): void
    {
        $attached = array_diff_key($this->campaignReferences($saved), $this->campaignReferences($previous));
        $record = $this->db->prepare(
            'INSERT INTO promotion_uploads (filename, created_at, expires_at) VALUES (?, UTC_TIMESTAMP(), NULL)
             ON DUPLICATE KEY UPDATE expires_at = NULL'
        );
        foreach ($attached as $filename => $urls) {
            if ($this->availableFor($filename, $urls, $siteUrl)) {
                $record->execute([$filename]);
            }
        }
    }

    public function writeProductReferences(array $urls, string $siteUrl, callable $write): void
    {
        $references = $this->references($urls);
        if ($references === []) {
            $write();
            return;
        }
        $this->withCampaignLock(function () use ($references, $siteUrl, $write): void {
            foreach ($references as $filename => $matches) {
                $this->availableFor($filename, $matches, $siteUrl);
            }
            $write();
        });
    }

    public function cleanUp(int $intervalSeconds = 900): int
    {
        if (!is_dir($this->directory)) {
            return 0;
        }
        return (int) $this->withCampaignLock(function () use ($intervalSeconds): int {
            $lastSweep = $this->db->query("SELECT updated_at FROM app_settings WHERE setting_key = '" . self::CLEANUP_KEY . "'")->fetchColumn();
            $now = gmdate('Y-m-d H:i:s');
            if ($lastSweep !== false && $lastSweep > gmdate('Y-m-d H:i:s', time() - $intervalSeconds)) {
                return 0;
            }

            $used = $this->referencedFiles();
            $tracked = $this->db->query('SELECT filename, expires_at FROM promotion_uploads ORDER BY expires_at, filename')
                ->fetchAll(PDO::FETCH_KEY_PAIR);
            $add = $this->db->prepare('INSERT IGNORE INTO promotion_uploads (filename, created_at, expires_at) VALUES (?, UTC_TIMESTAMP(), ?)');
            $update = $this->db->prepare('UPDATE promotion_uploads SET expires_at = ? WHERE filename = ?');
            $delete = $this->db->prepare('DELETE FROM promotion_uploads WHERE filename = ?');
            $deadline = $this->deadline();
            $removed = 0;
            foreach (new DirectoryIterator($this->directory) as $entry) {
                $filename = $entry->getFilename();
                if (self::validFilename($filename) && !$entry->isLink() && $entry->isFile()
                    && !array_key_exists($filename, $tracked)) {
                    $add->execute([$filename, isset($used[$filename]) ? null : $deadline]);
                }
            }
            foreach ($tracked as $filename => $expiry) {
                if (isset($used[$filename])) {
                    if ($expiry !== null) $update->execute([null, $filename]);
                } elseif ($expiry === null) {
                    $update->execute([$deadline, $filename]);
                } elseif ($expiry <= $now && $removed < 100 && self::validFilename($filename)) {
                    $path = $this->path($filename);
                    if ($path !== null && !@unlink($path)) {
                        error_log('[ChezVoust Pro] Falha ao remover mídia de campanha ' . $filename);
                        continue;
                    }
                    $delete->execute([$filename]);
                    $removed += (int) ($path !== null);
                }
            }
            $this->db->prepare(
                'INSERT INTO app_settings (setting_key, setting_value, is_public, updated_at) VALUES (?, JSON_OBJECT(), 0, UTC_TIMESTAMP())
                 ON DUPLICATE KEY UPDATE updated_at = UTC_TIMESTAMP()'
            )->execute([self::CLEANUP_KEY]);
            return $removed;
        }, 0);
    }

    private function referencedFiles(): array
    {
        $used = [];
        foreach ($this->db->query('SELECT image_url, cta_url, media_frame, secondary_links FROM promotions')->fetchAll() as $campaign) {
            $used += $this->campaignReferences($campaign);
        }
        // A campaign upload can also have been pasted into the product catalog.
        $products = $this->db->query('SELECT image_url, purchase_url FROM products');
        while ($product = $products->fetch()) {
            $used += $this->references([$product['image_url'], $product['purchase_url']]);
        }
        return $used;
    }

    private function campaignReferences(array $campaign): array
    {
        $frame = json_decode($campaign['media_frame'] ?? 'null', true);
        $links = json_decode($campaign['secondary_links'] ?? 'null', true);
        $urls = [$campaign['image_url'] ?? null, $campaign['cta_url'] ?? null, $frame['posterUrl'] ?? null];
        foreach (is_array($links) ? $links : [] as $link) {
            $urls[] = $link['url'] ?? null;
        }
        return $this->references($urls);
    }

    private function references(array $urls): array
    {
        $references = [];
        foreach ($urls as $url) {
            if (!is_string($url) || $url === '') {
                continue;
            }
            $path = rtrim(rawurldecode((string) parse_url(trim($url), PHP_URL_PATH)), '/');
            if (str_starts_with($path, self::URL_PREFIX)) {
                $filename = substr($path, strlen(self::URL_PREFIX));
                if (self::validFilename($filename)) {
                    $references[$filename][] = trim($url);
                }
            }
        }
        return $references;
    }

    private function availableFor(string $filename, array $urls, string $siteUrl): bool
    {
        if ($this->path($filename) !== null) {
            return true;
        }
        $host = parse_url($siteUrl, PHP_URL_HOST);
        foreach ($urls as $url) {
            $urlHost = parse_url($url, PHP_URL_HOST);
            if ($urlHost === null || ($host !== null && strcasecmp((string) $urlHost, (string) $host) === 0)) {
                throw new ApiException(422, 'PROMOTION_MEDIA_NOT_FOUND', 'O arquivo da campanha não está mais disponível. Selecione o arquivo novamente.');
            }
        }
        return false;
    }

    private function deadline(): string
    {
        return gmdate('Y-m-d H:i:s', time() + self::GRACE_SECONDS);
    }
}
