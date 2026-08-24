$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Push-Location $projectRoot

try {
    docker compose config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw 'A configuração do Docker Compose é inválida.'
    }

    $running = @(docker compose ps --services --filter status=running)
    foreach ($service in @('database', 'api', 'web', 'worker')) {
        if ($service -notin $running) {
            throw "O serviço '$service' não está em execução."
        }
    }

    $appEnvironment = (docker compose exec -T api printenv APP_ENV).Trim()
    if ($appEnvironment -ne 'local') {
        throw "O smoke test só pode limpar rate limits no ambiente local; ambiente atual: '$appEnvironment'."
    }
    $databaseUser = (docker compose exec -T database printenv MYSQL_USER).Trim()
    $databasePassword = (docker compose exec -T database printenv MYSQL_PASSWORD).Trim()
    $databaseName = (docker compose exec -T database printenv MYSQL_DATABASE).Trim()
    docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql "-u$databaseUser" $databaseName -e 'DELETE FROM api_rate_limits;'
    if ($LASTEXITCODE -ne 0) {
        throw 'Não foi possível preparar os contadores locais de rate limit.'
    }

    $health = Invoke-RestMethod -Method Get -Uri 'http://localhost:4200/api/v1/health'
    if ($null -eq $health.data) {
        throw 'O endpoint de saúde não retornou o envelope esperado.'
    }

    $accounts = @(
        @{ email = 'cliente@chezvoust.test'; password = 'Cliente@123'; role = 'customer' },
        @{ email = 'profissional@chezvoust.test'; password = 'Profissional@123'; role = 'provider' },
        @{ email = 'admin@chezvoust.test'; password = 'Admin@123'; role = 'admin' }
    )

    foreach ($account in $accounts) {
        $body = @{ email = $account.email; password = $account.password } | ConvertTo-Json
        $response = Invoke-RestMethod -Method Post -Uri 'http://localhost:4200/api/v1/auth/login' -ContentType 'application/json' -Body $body
        if ($response.data.user.role -ne $account.role) {
            throw "Papel incorreto para $($account.email)."
        }
        Write-Output "PASS login $($account.email) ($($account.role))"
    }

    Write-Output 'PASS Compose: database, api, web e worker ativos; health e autenticação funcionais.'
} finally {
    Pop-Location
}
