$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$webUrl = if ($env:CVP_WEB_URL) { $env:CVP_WEB_URL.TrimEnd('/') } else { 'http://localhost:4200' }
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

    $health = Invoke-RestMethod -Method Get -Uri "$webUrl/api/v1/health"
    if ($health.data.status -ne 'ok' -or $health.data.checks.database -ne 'ok' -or $health.data.checks.worker -ne 'ok') {
        throw 'O endpoint de saúde deve confirmar o banco e um ciclo recente do worker.'
    }

    $privacyProbe = 'cvp-link-privacy-' + [guid]::NewGuid().ToString('N')
    $queryMarker = "$privacyProbe-query"
    $referrerMarker = "$privacyProbe-referrer"
    foreach ($path in @('/redefinir-senha', '/verificar-email')) {
        $page = Invoke-WebRequest -Uri "$webUrl$($path)?token=$queryMarker" -UserAgent $privacyProbe
        if ((@($page.Headers['Referrer-Policy']) -join ', ') -ne 'no-referrer') {
            throw "A página $path deve responder com Referrer-Policy no-referrer."
        }
    }
    $null = Invoke-WebRequest -Uri "$webUrl/api/v1/health?token=$queryMarker" -UserAgent $privacyProbe -Headers @{
        Referer = "$webUrl/verificar-email?token=$referrerMarker"
    }
    foreach ($service in @('web', 'api')) {
        $logs = @(docker compose logs --no-color --since 2m $service | Where-Object { $_.Contains($privacyProbe) })
        if ($LASTEXITCODE -ne 0 -or -not ($logs -match '"GET /api/v1/health HTTP/')) {
            throw "O log de acesso de $service deve registrar o caminho da chamada de teste."
        }
        if ($logs -match "$queryMarker|$referrerMarker") {
            throw "O log de acesso de $service registrou a consulta ou o Referer da chamada de teste."
        }
    }
    Write-Output 'PASS privacidade dos links: Referrer-Policy e logs de acesso do Nginx e do Apache.'

    $accounts = @(
        @{ email = 'cliente@chezvoust.test'; password = 'Cliente@123'; role = 'customer' },
        @{ email = 'profissional@chezvoust.test'; password = 'Profissional@123'; role = 'provider' },
        @{ email = 'admin@chezvoust.test'; password = 'Admin@123'; role = 'admin' }
    )

    foreach ($account in $accounts) {
        $body = @{ email = $account.email; password = $account.password } | ConvertTo-Json
        $response = Invoke-RestMethod -Method Post -Uri "$webUrl/api/v1/auth/login" -ContentType 'application/json' -Body $body
        if ($response.data.user.role -ne $account.role) {
            throw "Papel incorreto para $($account.email)."
        }
        Write-Output "PASS login $($account.email) ($($account.role))"
    }

    Write-Output 'PASS Compose: database, api, web e worker ativos; health e autenticação funcionais.'
} finally {
    Pop-Location
}
