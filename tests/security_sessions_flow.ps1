$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:8080/api/v1'

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw $message }
}

function Login([Microsoft.PowerShell.Commands.WebRequestSession]$session) {
    return (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -WebSession $session -ContentType 'application/json' -Body (@{
        email = 'cliente@chezvoust.test'; password = 'Cliente@123'; remember = $true
    } | ConvertTo-Json)).data
}

$firstBrowser = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$secondBrowser = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$first = Login $firstBrowser
$second = Login $secondBrowser
$staleTab = New-Object Microsoft.PowerShell.Commands.WebRequestSession
foreach ($cookie in $firstBrowser.Cookies.GetCookies("$baseUrl/auth/refresh")) {
    $staleTab.Cookies.Add((New-Object System.Net.Cookie($cookie.Name, $cookie.Value, $cookie.Path, $cookie.Domain)))
}
$firstRefresh = (Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -WebSession $firstBrowser).data
$graceRefresh = (Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -WebSession $staleTab).data
Assert-True ($null -ne $graceRefresh.accessToken) 'A renovação concorrente de duas abas não recebeu um access token.'
$firstHeaders = @{ Authorization = "Bearer $($firstRefresh.accessToken)" }
$secondHeaders = @{ Authorization = "Bearer $($second.accessToken)" }

Invoke-RestMethod -Uri "$baseUrl/me" -Headers $firstHeaders | Out-Null

$sessions = @((Invoke-RestMethod -Uri "$baseUrl/auth/sessions" -Headers $firstHeaders).data)
Assert-True ($sessions.Count -ge 2) 'A conta deveria listar as duas sessões de teste.'
$current = @($sessions | Where-Object current)
$others = @($sessions | Where-Object { -not $_.current })
Assert-True ($current.Count -eq 1 -and $others.Count -ge 1) 'A API não identificou corretamente a sessão atual.'

foreach ($other in $others) {
    Invoke-RestMethod -Uri "$baseUrl/auth/sessions/$($other.id)" -Method Delete -Headers $firstHeaders | Out-Null
}
$revokedStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/me" -Headers $secondHeaders | Out-Null
    $revokedStatus = 200
} catch {
    $revokedStatus = [int]$_.Exception.Response.StatusCode
}
Assert-True ($revokedStatus -eq 401) "A sessão revogada respondeu HTTP $revokedStatus em vez de 401."

$bodyOnlyRefreshStatus = 0
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/refresh" -Method Post -ContentType 'application/json' -Body (@{ refreshToken = 'token-no-corpo' } | ConvertTo-Json) | Out-Null
    $bodyOnlyRefreshStatus = 200
} catch {
    $bodyOnlyRefreshStatus = [int]$_.Exception.Response.StatusCode
}
Assert-True ($bodyOnlyRefreshStatus -eq 401) 'A renovação aceitou token enviado no corpo em vez do cookie HttpOnly.'

Write-Output 'PASS segurança de sessão: listagem, identificação do dispositivo atual, revogação e refresh restrito a cookie.'
