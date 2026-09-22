$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$baseUrl = if ($env:CVP_API_URL) { $env:CVP_API_URL.TrimEnd('/') } else { 'http://localhost:8080/api/v1' }

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw $message }
}

function New-SafeMessageToken {
    # Evita sequências numéricas que a moderação deve interpretar como telefone.
    return ([guid]::NewGuid().ToString('N') -replace '[0-9]', 'x')
}

function Login([string]$email, [string]$password) {
    $body = @{ email = $email; password = $password } | ConvertTo-Json
    return (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $body).data
}

function Auth-Headers([string]$token) {
    return @{ Authorization = "Bearer $token" }
}

function Latest-Sequence([string]$conversationId, [hashtable]$headers) {
    [int64]$cursor = 0
    do {
        $messages = @((Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages?after=$cursor&limit=100" -Headers $headers).data)
        if ($messages.Count) { $cursor = [int64]$messages[-1].sequence }
    } while ($messages.Count -eq 100)
    return $cursor
}

Push-Location $projectRoot
try {
    $environment = (docker compose exec -T api printenv APP_ENV).Trim()
    Assert-True ($environment -eq 'local') "Este teste grava mensagens e só pode rodar no ambiente local; ambiente atual: '$environment'."

    $databaseUser = (docker compose exec -T database printenv MYSQL_USER).Trim()
    $databasePassword = (docker compose exec -T database printenv MYSQL_PASSWORD).Trim()
    $databaseName = (docker compose exec -T database printenv MYSQL_DATABASE).Trim()
    docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql "-u$databaseUser" $databaseName -e 'DELETE FROM api_rate_limits;'
    Assert-True ($LASTEXITCODE -eq 0) 'Não foi possível limpar os rate limits do ambiente local antes do teste.'

    $customer = Login 'cliente@chezvoust.test' 'Cliente@123'
    $provider = Login 'profissional@chezvoust.test' 'Profissional@123'
    $admin = Login 'admin@chezvoust.test' 'Admin@123'
    $customerHeaders = Auth-Headers $customer.accessToken
    $providerHeaders = Auth-Headers $provider.accessToken
    $adminHeaders = Auth-Headers $admin.accessToken

    $customerConversations = @((Invoke-RestMethod -Uri "$baseUrl/conversations" -Headers $customerHeaders).data)
    $providerConversations = @((Invoke-RestMethod -Uri "$baseUrl/conversations" -Headers $providerHeaders).data)
    Assert-True ($customerConversations.Count -gt 0) 'A conta cliente não possui conversa para o teste.'
    $chatStatuses = @('confirmed', 'provider_on_the_way', 'in_progress', 'completed', 'disputed')
    $conversation = $customerConversations |
        Where-Object { $chatStatuses -contains $_.bookingStatus -and $providerConversations.id -contains $_.id } |
        Select-Object -First 1
    Assert-True ($null -ne $conversation) 'Cliente e profissional não possuem conversa compartilhada com chat disponível.'
    $conversationId = $conversation.id
    Assert-True ($providerConversations.id -contains $conversationId) 'Cliente e profissional não compartilham a conversa seed.'

    $providerCursor = Latest-Sequence $conversationId $providerHeaders
    $customerBody = "e2e-cliente-$(New-SafeMessageToken)"
    $customerMessage = (Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $customerHeaders -ContentType 'application/json' -Body (@{ body = $customerBody } | ConvertTo-Json)).data
    $providerDelta = @((Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages?after=$providerCursor&limit=100" -Headers $providerHeaders).data)
    Assert-True ($providerDelta.Count -eq 1) "O profissional deveria receber uma mensagem incremental; recebeu $($providerDelta.Count)."
    Assert-True ($providerDelta[0].body -eq $customerBody -and $providerDelta[0].senderId -eq $customer.user.id) 'Conteúdo ou autoria cliente para profissional incorretos.'

    $providerBody = "e2e-profissional-$(New-SafeMessageToken)"
    $providerMessage = (Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $providerHeaders -ContentType 'application/json' -Body (@{ body = $providerBody } | ConvertTo-Json)).data
    $customerDelta = @((Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages?after=$($customerMessage.sequence)&limit=100" -Headers $customerHeaders).data)
    Assert-True ($customerDelta.Count -eq 1) "O cliente deveria receber uma mensagem incremental; recebeu $($customerDelta.Count)."
    Assert-True ($customerDelta[0].body -eq $providerBody -and $customerDelta[0].senderId -eq $provider.user.id) 'Conteúdo ou autoria profissional para cliente incorretos.'
    Assert-True ($customerDelta[0].senderName -eq $provider.user.name -and $customerDelta[0].messageType -eq 'text' -and $null -ne $customerDelta[0].createdAt) 'O contrato ChatMessage está incompleto.'

    $emptyDelta = @((Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages?after=$($providerMessage.sequence)&limit=100" -Headers $customerHeaders).data)
    Assert-True ($emptyDelta.Count -eq 0) 'O cursor incremental devolveu mensagens já processadas.'

    $liveCursor = Latest-Sequence $conversationId $providerHeaders
    $emptySync = Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/events?after=$liveCursor&limit=50" -Headers $providerHeaders
    Assert-True (@($emptySync.data).Count -eq 0) 'A sincronização incremental devolveu mensagens já processadas.'
    Assert-True ([int]$emptySync.meta.pollAfterSeconds -eq 10) 'A API não informou a cadência esperada para a próxima sincronização.'
    $liveBody = "e2e-live-$(New-SafeMessageToken)"
    $liveMessage = (Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $customerHeaders -ContentType 'application/json' -Body (@{ body = $liveBody } | ConvertTo-Json)).data
    $liveResponse = Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/events?after=$liveCursor&limit=50" -Headers $providerHeaders
    $liveDelta = @($liveResponse.data)
    Assert-True ($liveDelta.Count -eq 1 -and $liveDelta[0].id -eq $liveMessage.id -and $liveDelta[0].body -eq $liveBody) 'A sincronização incremental não entregou a mensagem nova.'

    $idempotencyKey = [guid]::NewGuid().ToString()
    $idempotencyHeaders = @{ Authorization = "Bearer $($customer.accessToken)"; 'Idempotency-Key' = $idempotencyKey }
    $idempotentBody = "e2e-idempotente-$(New-SafeMessageToken)"
    $firstIdempotent = (Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $idempotencyHeaders -ContentType 'application/json' -Body (@{ body = $idempotentBody } | ConvertTo-Json)).data
    $secondIdempotent = (Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $idempotencyHeaders -ContentType 'application/json' -Body (@{ body = $idempotentBody } | ConvertTo-Json)).data
    Assert-True ($firstIdempotent.id -eq $secondIdempotent.id -and $firstIdempotent.sequence -eq $secondIdempotent.sequence) 'Repetir o envio com a mesma chave criou uma mensagem duplicada.'
    $idempotencyConflict = 0
    try {
        Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages" -Method Post -Headers $idempotencyHeaders -ContentType 'application/json' -Body (@{ body = "$idempotentBody-conteudo-alterado" } | ConvertTo-Json) | Out-Null
        $idempotencyConflict = 200
    } catch {
        $idempotencyConflict = [int]$_.Exception.Response.StatusCode
    }
    Assert-True ($idempotencyConflict -eq 409) "Uma chave de mensagem reutilizada com outro conteúdo respondeu HTTP $idempotencyConflict em vez de 409."

    Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/read" -Method Post -Headers $customerHeaders -ContentType 'application/json' -Body (@{ lastSequence = $providerMessage.sequence } | ConvertTo-Json) | Out-Null
    $readConversation = @((Invoke-RestMethod -Uri "$baseUrl/conversations" -Headers $customerHeaders).data) | Where-Object id -eq $conversationId
    Assert-True ([int]$readConversation.unreadCount -eq 0) 'A confirmação de leitura não zerou o contador.'

    $foreignStatus = 0
    try {
        Invoke-RestMethod -Uri "$baseUrl/conversations/$conversationId/messages?after=0&limit=1" -Headers $adminHeaders | Out-Null
        $foreignStatus = 200
    } catch {
        $foreignStatus = [int]$_.Exception.Response.StatusCode
    }
    Assert-True ($foreignStatus -eq 404) "Uma conta alheia à conversa recebeu HTTP $foreignStatus em vez de 404."

    Write-Output "PASS mensagens: entrega incremental, idempotência, leitura e isolamento por participante (conversa $conversationId)."
} finally {
    Pop-Location
}
