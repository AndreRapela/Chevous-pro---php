<?php

declare(strict_types=1);

use ChezVoust\Core\ApiException;
use ChezVoust\Core\PublicReadLimiter;
use ChezVoust\Core\Uuid;
use ChezVoust\Modules\Admin\PromotionUploads;

$backend = $argv[1] ?? dirname(__DIR__) . '/backend';
$services = require $backend . '/bootstrap/app.php';
if (!in_array($services['config']['env'], ['local', 'development', 'testing'], true)) {
    throw new RuntimeException('Use a local test database.');
}

function verify(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$db = $services['db'];
// The cleanup sees only fixture records and can never remove real media during this test.
foreach (['promotions', 'promotion_uploads', 'products', 'app_settings'] as $table) {
    $definition = $db->query("SHOW CREATE TABLE {$table}")->fetchColumn(1);
    $db->exec(preg_replace('/^CREATE TABLE /', 'CREATE TEMPORARY TABLE ', $definition));
}
$directory = sys_get_temp_dir() . '/cvp-media-' . Uuid::v4();
mkdir($directory, 0750);
$uploads = new PromotionUploads($db, $services['config']['database']['name'], $directory);
$registry = $db->prepare('SELECT filename, expires_at FROM promotion_uploads WHERE filename = ?');
$lookup = static function (string $filename) use ($registry): array|false {
    $registry->execute([$filename]);
    return $registry->fetch();
};
$register = $db->prepare('INSERT INTO promotion_uploads VALUES (?, UTC_TIMESTAMP(), ?)');
$past = gmdate('Y-m-d H:i:s', time() - 5);
$future = gmdate('Y-m-d H:i:s', time() + 3600);
$fixture = [];

try {
    foreach (['main.mp4', 'poster.webp', 'link.png', 'product.jpg', 'pending.png', 'interrupted.mp4', 'legacy.mp4', 'missing.webp'] as $label) {
        $filename = bin2hex(random_bytes(24)) . '.' . pathinfo($label, PATHINFO_EXTENSION);
        $fixture[$label] = $filename;
        if ($label !== 'missing.webp') {
            file_put_contents($directory . '/' . $filename, 'test data');
        }
    }
    $url = static fn (string $label): string => PromotionUploads::URL_PREFIX . $fixture[$label];
    $register->execute([$fixture['pending.png'], $future]);
    foreach (['main.mp4', 'poster.webp', 'link.png', 'product.jpg', 'interrupted.mp4', 'missing.webp'] as $label) {
        $register->execute([$fixture[$label], $past]);
    }
    touch($directory . '/' . $fixture['legacy.mp4'], time() - 72 * 3600);
    file_put_contents($directory . '/readme.txt', 'unmanaged file');

    $campaign = Uuid::v4();
    $shared = Uuid::v4();
    $insert = $db->prepare("INSERT INTO promotions (public_id, title, image_url, media_type, media_frame, secondary_links, active, created_at, updated_at)
        VALUES (?, 'Fixture', ?, 'video', ?, ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())");
    $insert->execute([
        $campaign, $url('main.mp4'),
        json_encode(['posterUrl' => 'https://shop.test' . $url('poster.webp') . '?v=2'], JSON_THROW_ON_ERROR),
        json_encode([['url' => $url('link.png')]], JSON_THROW_ON_ERROR),
    ]);
    $insert->execute([$shared, $url('main.mp4'), null, null]);
    $db->prepare("INSERT INTO products (public_id, name, slug, price_cents, purchase_url, image_url, created_at, updated_at)
        VALUES (?, 'Fixture', 'media-fixture', 500, '/ajuda', ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())")
        ->execute([Uuid::v4(), $url('product.jpg')]);

    verify($uploads->cleanUp(0) === 1, 'Only the expired interrupted upload should be removed.');
    foreach (['main.mp4', 'poster.webp', 'link.png', 'product.jpg'] as $label) {
        verify($uploads->path($fixture[$label]) !== null && $lookup($fixture[$label])['expires_at'] === null,
            'Every persisted reference must keep the file, including disabled campaigns, posters and links.');
    }
    verify($uploads->path($fixture['interrupted.mp4']) === null && $lookup($fixture['missing.webp']) === false,
        'Expire abandoned files and rows left by interruptions before moving the file.');
    verify($lookup($fixture['pending.png'])['expires_at'] === $future, 'Keep a fresh pending upload.');
    verify($lookup($fixture['legacy.mp4'])['expires_at'] > $future, 'Give untracked old files a full grace period at discovery.');

    $db->prepare('DELETE FROM promotions WHERE public_id = ?')->execute([$campaign]);
    $uploads->cleanUp(0);
    verify($lookup($fixture['main.mp4'])['expires_at'] === null, 'A shared file still has a reference.');
    verify($lookup($fixture['poster.webp'])['expires_at'] > $future, 'Start a grace period when a poster loses its final reference.');
    $db->prepare('UPDATE promotion_uploads SET expires_at = ? WHERE filename IN (?, ?)')->execute([
        $past, $fixture['poster.webp'], $fixture['legacy.mp4'],
    ]);
    verify($uploads->cleanUp(0) === 2 && $uploads->cleanUp(0) === 0, 'Removal after grace is repeatable.');
    verify(file_exists($directory . '/readme.txt'), 'Do not touch unrelated files.');

    $limiter = new PublicReadLimiter($directory);
    verify($limiter->check('catalog:192.0.2.10', 1, 60), 'The first catalog request is allowed.');
    verify($limiter->check('media:192.0.2.10', 1, 60), 'Media uses a separate counter.');
    try {
        $limiter->check('catalog:192.0.2.10', 1, 60);
        throw new RuntimeException('A public read over its limit must be rejected.');
    } catch (ApiException $failure) {
        verify($failure->status === 429 && $failure->errorCode === 'RATE_LIMITED', 'Use the existing rate-limit response.');
    }
    $bucket = $directory . '/public-' . hash('sha256', 'catalog:192.0.2.10') . '.bucket';
    touch($bucket, time() - 72 * 3600);
    $limiter->prune();
    verify(!file_exists($bucket), 'Remove stale public buckets.');

    echo "PASS campaign registrations, references, grace period, safe cleanup and public rate-limit buckets.\n";
} finally {
    foreach (new DirectoryIterator($directory) as $file) {
        if ($file->isFile() || $file->isLink()) unlink($file->getPathname());
    }
    rmdir($directory);
}
