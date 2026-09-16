<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
$db = new Database($config['database']);
$pdo = $db->pdo();
$sql = file_get_contents(dirname(__DIR__, 2) . '/database/schema.sql');
if ($sql === false) {
    throw new RuntimeException('database/schema.sql não encontrado.');
}
$lockName = 'chezvoust_schema_migrations';
$lock = $pdo->prepare('SELECT GET_LOCK(:name, 30)');
$lock->execute(['name' => $lockName]);
if ((int) $lock->fetchColumn() !== 1) {
    throw new RuntimeException('Não foi possível obter o bloqueio das migrações.');
}

try {
    $statements = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement !== '') {
            $pdo->exec($statement);
        }
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            migration VARCHAR(190) NOT NULL,
            applied_at DATETIME NOT NULL,
            PRIMARY KEY (migration)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    $directory = dirname(__DIR__, 2) . '/database/migrations';
    $files = is_dir($directory) ? glob($directory . '/*.sql') : [];
    sort($files, SORT_STRING);
    $alreadyApplied = $pdo->prepare('SELECT 1 FROM schema_migrations WHERE migration = :migration');
    $record = $pdo->prepare('INSERT INTO schema_migrations (migration, applied_at) VALUES (:migration, UTC_TIMESTAMP())');
    foreach ($files as $file) {
        $migration = basename($file);
        $alreadyApplied->execute(['migration' => $migration]);
        if ($alreadyApplied->fetchColumn()) {
            continue;
        }
        $migrationSql = file_get_contents($file);
        if ($migrationSql === false || trim($migrationSql) === '') {
            throw new RuntimeException('Migração vazia ou ilegível: ' . $migration);
        }
        $pdo->exec($migrationSql);
        $record->execute(['migration' => $migration]);
        fwrite(STDOUT, 'Migração aplicada: ' . $migration . "\n");
    }
} finally {
    $release = $pdo->prepare('SELECT RELEASE_LOCK(:name)');
    $release->execute(['name' => $lockName]);
}

fwrite(STDOUT, "Schema ChezVoust Pro atualizado.\n");
