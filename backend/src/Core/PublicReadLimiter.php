<?php

declare(strict_types=1);

namespace ChezVoust\Core;

use DirectoryIterator;

final class PublicReadLimiter
{
    public function __construct(private readonly string $directory)
    {
    }

    public static function scope(Request $request): ?string
    {
        if ($request->method !== 'GET') {
            return null;
        }
        // The router still authenticates the participant before serving chat updates.
        if (preg_match('#^/api/v1/conversations/[^/]+/events$#D', $request->path) === 1) {
            return 'chat';
        }
        if (preg_match('#^/api/v1/(?:promotion-media|avatars)/[^/]+$#D', $request->path) === 1) {
            return 'media';
        }
        if (preg_match('#^/api/v1/(?:app-config|home|categories|products|seo/(?:robots\.txt|sitemap\.xml)|(?:services|professionals|providers)(?:/[^/]+)?)$#D', $request->path) === 1) {
            return 'catalog';
        }
        return null;
    }

    /** Returns false when the filesystem is unavailable so the caller can use the SQL limiter. */
    public function check(string $key, int $limit, int $windowSeconds): bool
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0750, true) && !is_dir($this->directory)) {
            return false;
        }
        $path = $this->directory . '/public-' . hash('sha256', $key) . '.bucket';
        $file = @fopen($path, 'c+');
        if ($file === false) {
            return false;
        }
        try {
            if (!@flock($file, LOCK_EX) || (fstat($file)['nlink'] ?? 0) === 0) {
                return false;
            }
            $stored = fgets($file, 64);
            $now = time();
            $expires = 0;
            $hits = 0;
            if (is_string($stored) && preg_match('/^(\d{1,12}):(\d{1,12})\n$/D', $stored, $matches) === 1) {
                $expires = (int) $matches[1];
                $hits = (int) $matches[2];
            }
            if ($expires <= $now) {
                $expires = $now + max(1, min($windowSeconds, 86400));
                $hits = 0;
            }
            if ($hits >= max(1, $limit)) {
                $retry = $expires - $now;
                throw new ApiException(429, 'RATE_LIMITED', "Muitas tentativas. Tente novamente em {$retry} segundos.");
            }
            $data = $expires . ':' . ($hits + 1) . "\n";
            return rewind($file) && @fwrite($file, $data) === strlen($data)
                && @ftruncate($file, strlen($data)) && @fflush($file);
        } finally {
            fclose($file);
        }
    }

    public function prune(): void
    {
        if (!is_dir($this->directory)) {
            return;
        }
        $maintenance = @fopen($this->directory . '/.public-maintenance', 'c+');
        if ($maintenance === false) {
            return;
        }
        try {
            if (!@flock($maintenance, LOCK_EX | LOCK_NB)) {
                return;
            }
            $now = time();
            if ((int) fgets($maintenance, 32) > $now - 900) {
                return;
            }
            $this->removeStaleBuckets($now - 2 * 86400);
            rewind($maintenance);
            fwrite($maintenance, $now . "\n");
        } finally {
            fclose($maintenance);
        }
    }

    private function removeStaleBuckets(int $cutoff): void
    {
        foreach (new DirectoryIterator($this->directory) as $entry) {
            if ($entry->isLink() || !$entry->isFile() || $entry->getMTime() >= $cutoff
                || preg_match('/^public-[a-f0-9]{64}\.bucket$/D', $entry->getFilename()) !== 1) {
                continue;
            }
            $file = @fopen($entry->getPathname(), 'r+');
            if ($file === false) {
                continue;
            }
            try {
                if (!@flock($file, LOCK_EX | LOCK_NB)) {
                    continue;
                }
                $current = fstat($file);
                if (($current['nlink'] ?? 0) > 0 && $current['mtime'] < $cutoff) {
                    @unlink($entry->getPathname());
                }
            } finally {
                fclose($file);
            }
        }
    }
}
