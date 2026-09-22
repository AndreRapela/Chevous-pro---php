$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$php = Get-Command php -ErrorAction SilentlyContinue

if ($null -ne $php) {
    & $php.Source tests/backend_core.php
    if ($LASTEXITCODE -ne 0) { throw 'Os testes centrais do backend falharam.' }
    $files = Get-ChildItem (Join-Path $projectRoot 'backend') -Recurse -Filter *.php |
        Where-Object { $_.FullName -notmatch '[\\/]vendor[\\/]' }
    foreach ($file in $files) {
        & $php.Source -l $file.FullName | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Sintaxe PHP inválida: $($file.FullName)" }
    }
    Write-Output "PASS backend local: testes centrais e sintaxe de $($files.Count) arquivos PHP."
    exit 0
}

docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'PHP não está no PATH e o Docker não está disponível para executar a validação isolada.'
}

Push-Location $projectRoot
try {
    docker build --tag chezvoust-pro-backend-check:local ./backend | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível construir a imagem de validação do backend.' }
    docker run --rm --mount "type=bind,source=$projectRoot,target=/workspace" -w /workspace chezvoust-pro-backend-check:local `
        sh -lc "php tests/backend_core.php && find backend -name '*.php' -not -path '*/vendor/*' -print0 | xargs -0 -n1 php -l"
    if ($LASTEXITCODE -ne 0) { throw 'A validação isolada do backend falhou.' }
    Write-Output 'PASS backend em Docker: testes centrais e sintaxe PHP.'
} finally {
    Pop-Location
}
