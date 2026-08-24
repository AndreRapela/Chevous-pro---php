<?php

declare(strict_types=1);

use ChezVoust\Core\Database;
use ChezVoust\Core\Env;

require dirname(__DIR__) . '/bootstrap/autoload.php';
Env::load(dirname(__DIR__) . '/.env');
$config = require dirname(__DIR__) . '/config/app.php';
$db = new Database($config['database']);
$sql = file_get_contents(dirname(__DIR__, 2) . '/database/schema.sql');
if ($sql === false) {
    throw new RuntimeException('database/schema.sql não encontrado.');
}
$statements = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];
foreach ($statements as $statement) {
    $statement = trim($statement);
    if ($statement !== '') {
        $db->pdo()->exec($statement);
    }
}
fwrite(STDOUT, "Schema ChezVoust Pro aplicado.\n");
