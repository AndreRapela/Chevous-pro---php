<?php

declare(strict_types=1);

namespace ChezVoust\Modules\Catalog;

use ChezVoust\Core\ApiException;

final class PromotionVideo
{
    public const LIMIT = 10;
    public const MAX_DURATION_MS = 60_000;

    public static function hasSource(mixed $type, mixed $url): bool
    {
        return $type === 'video' && is_string($url) && trim($url) !== '';
    }

    public static function requireDuration(?int $milliseconds): int
    {
        if ($milliseconds === null || $milliseconds <= 0) {
            throw new ApiException(422, 'PROMOTION_VIDEO_UNKNOWN_DURATION', 'Não foi possível confirmar a duração do vídeo.');
        }
        if ($milliseconds > self::MAX_DURATION_MS) {
            throw new ApiException(422, 'PROMOTION_VIDEO_TOO_LONG', 'O vídeo da campanha deve ter no máximo 1 minuto.');
        }
        return $milliseconds;
    }

    public static function duration(string $path, string $extension): ?int
    {
        if (!is_file($path) || filesize($path) > 25 * 1024 * 1024) return null;
        $bytes = file_get_contents($path);
        if ($bytes === false) return null;
        $milliseconds = $extension === 'mp4' ? self::mp4Duration($bytes) : self::webmDuration($bytes);
        return $milliseconds !== null && is_finite($milliseconds) && $milliseconds > 0
            ? (int) ceil(min($milliseconds, self::MAX_DURATION_MS + 1))
            : null;
    }

    private static function mp4Duration(string $bytes): ?float
    {
        $movie = self::mp4Box($bytes, 0, strlen($bytes), 'moov');
        if ($movie === null) return null;
        $header = self::mp4Box($bytes, $movie[0], $movie[1], 'mvhd');
        if ($header === null || $header[0] >= $header[1]) return null;
        [$start, $end] = $header;
        $version = ord($bytes[$start]);
        if ($version === 0 && $start + 20 <= $end) {
            $scale = unpack('N', $bytes, $start + 12)[1];
            $duration = unpack('N', $bytes, $start + 16)[1];
            if ($duration === 0xffffffff) return null;
        } elseif ($version === 1 && $start + 32 <= $end) {
            $scale = unpack('N', $bytes, $start + 20)[1];
            $duration = self::unsigned64($bytes, $start + 24);
        } else {
            return null;
        }
        return $duration !== null && $scale > 0 ? $duration / $scale * 1000 : null;
    }

    private static function mp4Box(string $bytes, int $offset, int $end, string $name): ?array
    {
        while ($offset + 8 <= $end) {
            $size = unpack('N', $bytes, $offset)[1];
            $type = substr($bytes, $offset + 4, 4);
            $head = 8;
            if ($size === 1 && $offset + 16 <= $end) {
                $size = self::unsigned64($bytes, $offset + 8);
                $head = 16;
            } elseif ($size === 0) {
                $size = $end - $offset;
            }
            if ($size === null || $size < $head || $size > $end - $offset) return null;
            if ($type === $name) return [$offset + $head, $offset + $size];
            $offset += $size;
        }
        return null;
    }

    private static function unsigned64(string $bytes, int $offset): ?int
    {
        $parts = unpack('Nhigh/Nlow', $bytes, $offset);
        if ($parts['high'] > 0x7fffffff) return null;
        return ($parts['high'] << 32) | $parts['low'];
    }

    private static function webmDuration(string $bytes): ?float
    {
        $segment = self::ebmlElement($bytes, 0, strlen($bytes), 0x18538067);
        if ($segment === null) return null;
        $info = self::ebmlElement($bytes, $segment[0], $segment[1], 0x1549a966);
        if ($info === null) return null;
        $duration = self::ebmlElement($bytes, $info[0], $info[1], 0x4489);
        if ($duration === null) return null;
        $ticks = match ($duration[1] - $duration[0]) {
            4 => unpack('G', $bytes, $duration[0])[1],
            8 => unpack('E', $bytes, $duration[0])[1],
            default => null,
        };
        $scale = self::ebmlElement($bytes, $info[0], $info[1], 0x2ad7b1);
        $nanoseconds = 1_000_000;
        if ($scale !== null) {
            $length = $scale[1] - $scale[0];
            if ($length < 1 || $length > 7) return null;
            $nanoseconds = 0;
            for ($position = $scale[0]; $position < $scale[1]; ++$position) {
                $nanoseconds = ($nanoseconds << 8) | ord($bytes[$position]);
            }
        }
        return $ticks !== null && $nanoseconds > 0 ? $ticks * $nanoseconds / 1_000_000 : null;
    }

    private static function ebmlElement(string $bytes, int $offset, int $end, int $target): ?array
    {
        while ($offset < $end) {
            $id = self::ebmlInteger($bytes, $offset, $end, true);
            $size = self::ebmlInteger($bytes, $offset, $end, false);
            if ($id === null || $size === null) return null;
            if ($size === -1 && $id === 0x18538067) $size = $end - $offset;
            if ($size < 0 || $size > $end - $offset) return null;
            if ($id === $target) return [$offset, $offset + $size];
            $offset += $size;
        }
        return null;
    }

    private static function ebmlInteger(string $bytes, int &$offset, int $end, bool $isId): ?int
    {
        if ($offset >= $end) return null;
        $first = ord($bytes[$offset]);
        $mask = 0x80;
        $width = 1;
        while ($mask !== 0 && ($first & $mask) === 0) {
            $mask >>= 1;
            ++$width;
        }
        if ($mask === 0 || $width > ($isId ? 4 : 8) || $offset + $width > $end) return null;
        $value = $isId ? $first : $first & ($mask - 1);
        for ($index = 1; $index < $width; ++$index) {
            $value = ($value << 8) | ord($bytes[$offset + $index]);
        }
        $offset += $width;
        return !$isId && $value === (1 << (7 * $width)) - 1 ? -1 : $value;
    }
}
