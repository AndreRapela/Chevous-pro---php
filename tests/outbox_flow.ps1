$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$aggregate = "outbox-e2e-$([guid]::NewGuid())"
Push-Location $projectRoot

try {
    $environment = (docker compose exec -T api printenv APP_ENV).Trim()
    if ($environment -ne 'local') { throw "Este teste só pode alterar a outbox local; ambiente atual: '$environment'." }
    $databaseUser = (docker compose exec -T database printenv MYSQL_USER).Trim()
    $databasePassword = (docker compose exec -T database printenv MYSQL_PASSWORD).Trim()
    $databaseName = (docker compose exec -T database printenv MYSQL_DATABASE).Trim()

    $insert = "INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, attempts, available_at, created_at) VALUES ('test.unsupported', 'audit', '$aggregate', JSON_OBJECT('token', 'must-be-erased'), 7, UTC_TIMESTAMP(), UTC_TIMESTAMP());"
    docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql "-u$databaseUser" $databaseName -e $insert
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o evento sintético da outbox.' }

    docker compose exec -T api php bin/worker.php | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'O worker falhou ao processar o evento sintético.' }

    $query = "SELECT attempts, failed_at IS NOT NULL, JSON_LENGTH(payload), last_error IS NOT NULL FROM outbox_events WHERE aggregate_id = '$aggregate';"
    $row = (docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql -N -B "-u$databaseUser" $databaseName -e $query).Trim()
    if ($row -notmatch '^8\s+1\s+0\s+1$') {
        throw "O descarte seguro da outbox retornou valores inesperados: '$row'."
    }
    Write-Output 'PASS outbox: descarte após 8 tentativas, erro registrado e payload sensível apagado.'
} finally {
    if ($databaseUser -and $databaseName -and $databasePassword) {
        $delete = "DELETE FROM outbox_events WHERE aggregate_id = '$aggregate';"
        docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql "-u$databaseUser" $databaseName -e $delete | Out-Null
    }
    Pop-Location
}
