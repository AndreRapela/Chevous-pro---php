<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
if (!in_array($config['env'], ['local', 'development', 'testing'], true)) {
    throw new RuntimeException('O seed demonstrativo só pode ser executado em ambiente local ou de teste.');
}
$db = new Database($config['database']);
$sql = file_get_contents(dirname(__DIR__, 2) . '/database/seed.sql');
if ($sql === false) {
    throw new RuntimeException('database/seed.sql não encontrado.');
}
$algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
$sql = str_replace(
    ['{{CLIENT_PASSWORD_HASH}}', '{{PROVIDER_PASSWORD_HASH}}', '{{ADMIN_PASSWORD_HASH}}'],
    [
        password_hash('Cliente@123', $algorithm),
        password_hash('Profissional@123', $algorithm),
        password_hash('Admin@123', $algorithm),
    ],
    $sql
);
$statements = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];
foreach ($statements as $statement) {
    $statement = trim($statement);
    if ($statement !== '') {
        $db->pdo()->exec($statement);
    }
}
fwrite(STDOUT, "Dados fictícios brasileiros carregados.\n");
