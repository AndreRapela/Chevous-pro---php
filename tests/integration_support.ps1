function Assert-IntegrationTarget([string]$url, [string]$service = 'api') {
    $target = [Uri]$url
    if (-not $target.IsAbsoluteUri -or -not $target.IsLoopback -or $target.Scheme -notin @('http', 'https')) {
        throw 'Testes que gravam dados só podem acessar URLs de loopback.'
    }
    $composeFile = Join-Path $PSScriptRoot '..\compose.yaml'
    $published = docker compose -f $composeFile port $service 80
    if ($LASTEXITCODE -ne 0 -or $published -notmatch ':(\d+)\s*$' -or [int]$Matches[1] -ne $target.Port) {
        throw 'A URL de teste não corresponde à porta publicada pelo projeto Compose selecionado.'
    }
    $environment = (docker compose -f $composeFile exec -T api printenv APP_ENV).Trim()
    if ($LASTEXITCODE -ne 0 -or $environment -notin @('local', 'testing')) {
        throw 'Os fluxos destrutivos de teste exigem APP_ENV=local ou APP_ENV=testing.'
    }
}
