$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$baseUrl = if ($env:CVP_API_URL) { $env:CVP_API_URL.TrimEnd('/') } else { 'http://localhost:8080/api/v1' }

function Assert-True([bool]$condition, [string]$message) {
    if (-not $condition) { throw $message }
}

function Login([string]$email, [string]$password) {
    $body = @{ email = $email; password = $password; remember = $false } | ConvertTo-Json
    return (Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType 'application/json' -Body $body).data
}

function Invoke-Api([string]$method, [string]$path, [hashtable]$headers = @{}, $body = $null) {
    $parameters = @{ Uri = "$baseUrl$path"; Method = $method; Headers = $headers }
    if ($null -ne $body) {
        $parameters.ContentType = 'application/json'
        $parameters.Body = $body | ConvertTo-Json -Depth 8
    }
    return Invoke-RestMethod @parameters
}

function Expect-Status([int]$expected, [scriptblock]$action, [string]$message) {
    try {
        & $action | Out-Null
    } catch {
        $actual = [int]$_.Exception.Response.StatusCode
        Assert-True ($actual -eq $expected) "$message HTTP esperado: $expected; recebido: $actual."
        return
    }
    throw "$message A requisição foi aceita inesperadamente."
}

function Find-Slot([string]$professionalId, [int]$durationMinutes, [int]$minimumDayOffset) {
    foreach ($offset in $minimumDayOffset..($minimumDayOffset + 45)) {
        $date = (Get-Date).Date.AddDays($offset).ToString('yyyy-MM-dd')
        $availability = Invoke-Api Get "/professionals/$professionalId/availability?date=$date&duration=$durationMinutes"
        $slots = @($availability.data.slots)
        if ($slots.Count -gt 0) {
            return @{ date = $date; time = [string]$slots[0] }
        }
    }
    throw 'Nenhum horário futuro foi encontrado para o profissional de demonstração.'
}

Push-Location $projectRoot
try {
    $environment = (docker compose exec -T api printenv APP_ENV).Trim()
    Assert-True ($environment -eq 'local') "Este teste grava dados e só pode rodar no ambiente local; ambiente atual: '$environment'."

    $databaseUser = (docker compose exec -T database printenv MYSQL_USER).Trim()
    $databasePassword = (docker compose exec -T database printenv MYSQL_PASSWORD).Trim()
    $databaseName = (docker compose exec -T database printenv MYSQL_DATABASE).Trim()
    docker compose exec -T -e "MYSQL_PWD=$databasePassword" database mysql "-u$databaseUser" $databaseName -e 'DELETE FROM api_rate_limits;'
    Assert-True ($LASTEXITCODE -eq 0) 'Não foi possível limpar os rate limits do ambiente local antes do teste.'

    $customer = Login 'cliente@chezvoust.test' 'Cliente@123'
    $provider = Login 'profissional@chezvoust.test' 'Profissional@123'
    $admin = Login 'admin@chezvoust.test' 'Admin@123'
    $customerHeaders = @{ Authorization = "Bearer $($customer.accessToken)" }
    $providerHeaders = @{ Authorization = "Bearer $($provider.accessToken)" }
    $adminHeaders = @{ Authorization = "Bearer $($admin.accessToken)" }

    $services = @((Invoke-Api Get '/services?perPage=50').data)
    $professionals = @((Invoke-Api Get '/professionals?perPage=50').data)
    $professional = $professionals | Where-Object id -eq $provider.user.id | Select-Object -First 1
    Assert-True ($null -ne $professional) 'O profissional seed aprovado não aparece no catálogo público.'
    $service = $services | Where-Object { $professional.serviceIds -contains $_.id } | Select-Object -First 1
    Assert-True ($null -ne $service) 'Cliente e profissional não possuem serviço compatível.'

    $addresses = @((Invoke-Api Get '/me/addresses' $customerHeaders).data)
    $address = $addresses | Select-Object -First 1
    Assert-True ($null -ne $address) 'A conta cliente não possui endereço seed.'

    $temporaryAddress = (Invoke-Api Post '/me/addresses' $customerHeaders @{
        label = 'Teste E2E'; street = 'Rua de Teste'; number = '42'; complement = 'Sala 1'
        neighborhood = 'Centro'; city = 'São Paulo'; state = 'SP'; postalCode = '01001000'; isDefault = $false
    }).data
    $updatedAddress = (Invoke-Api Put "/me/addresses/$($temporaryAddress.id)" $customerHeaders @{
        label = 'Teste E2E atualizado'; street = 'Rua de Teste'; number = '43'; complement = ''
        neighborhood = 'Centro'; city = 'São Paulo'; state = 'SP'; postalCode = '01001000'; isDefault = $false
    }).data
    Assert-True ($updatedAddress.label -eq 'Teste E2E atualizado') 'A edição de endereço não persistiu.'
    Invoke-Api Delete "/me/addresses/$($temporaryAddress.id)" $customerHeaders | Out-Null

    Invoke-Api Post "/me/favorites/$($professional.id)" $customerHeaders | Out-Null
    $favorites = @((Invoke-Api Get '/me/favorites' $customerHeaders).data)
    Assert-True ($favorites.id -contains $professional.id) 'O profissional favoritado não apareceu na lista.'
    Invoke-Api Delete "/me/favorites/$($professional.id)" $customerHeaders | Out-Null

    $duration = [int]$service.defaultDurationMinutes
    $slot = Find-Slot $professional.id $duration 1
    $scheduledStart = "$($slot.date)T$($slot.time):00"
    $quotePayload = @{
        serviceId = $service.id; professionalId = $professional.id; durationMinutes = $duration
        quantity = 1; addonIds = @(); currency = 'BRL'
    }
    $quote = (Invoke-Api Post '/bookings/quote' $customerHeaders $quotePayload).data
    Assert-True ([int]$quote.totalCents -gt 0 -and @($quote.items).Count -gt 0 -and $quote.currency -eq 'BRL') 'A cotação em BRL não retornou preço, moeda e itens válidos.'
    $usdQuotePayload = $quotePayload.Clone()
    $usdQuotePayload.currency = 'USD'
    $usdQuote = (Invoke-Api Post '/bookings/quote' $customerHeaders $usdQuotePayload).data
    $usdRatio = [double]$usdQuote.totalCents / [double]$quote.totalCents
    Assert-True ($usdQuote.currency -eq 'USD' -and $usdRatio -ge 0.19 -and $usdRatio -le 0.21) 'A cotação em USD não aplicou a moeda e a taxa configuradas.'

    $bookingPayload = $quotePayload.Clone()
    $bookingPayload.addressId = $address.id
    $bookingPayload.mode = 'direct'
    $bookingPayload.scheduledStart = $scheduledStart
    $bookingPayload.timezone = 'America/Sao_Paulo'
    $bookingPayload.notes = 'Fluxo E2E direto'
    $bookingKey = "booking-e2e-$([guid]::NewGuid())"
    $bookingHeaders = $customerHeaders.Clone()
    $bookingHeaders['Idempotency-Key'] = $bookingKey
    $booking = (Invoke-Api Post '/bookings' $bookingHeaders $bookingPayload).data
    Assert-True ($booking.status -eq 'confirmed' -and $booking.allowedActions -contains 'cancel') 'A reserva direta não foi confirmada.'
    $customerBookingNotice = @((Invoke-Api Get '/me/notifications?perPage=50' $customerHeaders).data) | Where-Object { $_.type -eq 'booking.confirmed' -and $_.data.bookingId -eq $booking.id } | Select-Object -First 1
    $providerBookingNotice = @((Invoke-Api Get '/me/notifications?perPage=50' $providerHeaders).data) | Where-Object { $_.type -eq 'booking.confirmed' -and $_.data.bookingId -eq $booking.id } | Select-Object -First 1
    Assert-True ($null -ne $customerBookingNotice -and $null -ne $providerBookingNotice) 'Cliente e profissional não receberam avisos da reserva confirmada.'
    $repeatedBooking = (Invoke-Api Post '/bookings' $bookingHeaders $bookingPayload).data
    Assert-True ($repeatedBooking.id -eq $booking.id) 'A criação idempotente devolveu outra reserva.'
    $conflictingPayload = $bookingPayload.Clone()
    $conflictingPayload.notes = 'Mesmo identificador, outros dados'
    Expect-Status 409 { Invoke-Api Post '/bookings' $bookingHeaders $conflictingPayload } 'O conflito de idempotência não foi rejeitado.'

    $rescheduleSlot = Find-Slot $professional.id $duration 2
    $rescheduled = (Invoke-Api Post "/bookings/$($booking.id)/reschedule" $customerHeaders @{
        scheduledStart = "$($rescheduleSlot.date)T$($rescheduleSlot.time):00"; timezone = 'America/Sao_Paulo'
    }).data
    Assert-True ($rescheduled.status -eq 'confirmed' -and $rescheduled.allowedActions -contains 'reschedule') 'O cliente não conseguiu reagendar a reserva confirmada.'

    $onTheWay = (Invoke-Api Post "/bookings/$($booking.id)/on-the-way" $providerHeaders @{}).data
    Assert-True ($onTheWay.status -eq 'provider_on_the_way' -and $onTheWay.allowedActions -contains 'start') 'O profissional não conseguiu avisar que está a caminho.'
    $arrivalMessage = (Invoke-Api Post "/conversations/$($booking.conversationId)/messages" $providerHeaders @{ body = 'Estou a caminho do atendimento.' }).data
    Assert-True ($arrivalMessage.body -eq 'Estou a caminho do atendimento.') 'O chat ficou indisponível enquanto o profissional estava a caminho.'
    $started = (Invoke-Api Post "/bookings/$($booking.id)/start" $providerHeaders @{}).data
    $completed = (Invoke-Api Post "/bookings/$($booking.id)/complete" $providerHeaders @{}).data
    Assert-True ($started.status -eq 'in_progress' -and $completed.status -eq 'completed') 'O profissional não conseguiu iniciar e concluir o serviço.'
    $review = (Invoke-Api Post "/bookings/$($booking.id)/reviews" $customerHeaders @{ rating = 5; comment = 'Fluxo E2E concluído com sucesso.' }).data
    Assert-True ([int]$review.rating -eq 5) 'A avaliação do serviço não foi registrada.'
    Invoke-Api Post "/reviews/$($review.id)/reply" $providerHeaders @{ reply = 'Obrigado pela avaliação E2E.' } | Out-Null
    $reviewReplyNotice = @((Invoke-Api Get '/me/notifications?perPage=50' $customerHeaders).data) | Where-Object { $_.type -eq 'review.replied' -and $_.data.bookingId -eq $booking.id } | Select-Object -First 1
    Assert-True ($null -ne $reviewReplyNotice) 'O cliente não foi avisado sobre a resposta à avaliação.'

    $conversationMessage = (Invoke-Api Post "/conversations/$($booking.conversationId)/messages" $customerHeaders @{ body = 'Mensagem do fluxo E2E.' }).data
    Assert-True ($conversationMessage.body -eq 'Mensagem do fluxo E2E.') 'A conversa da nova reserva não aceitou mensagem.'

    $marketSlot = Find-Slot $professional.id $duration 3
    $marketPayload = @{
        serviceId = $service.id; addressId = $address.id; mode = 'marketplace'
        scheduledStart = "$($marketSlot.date)T$($marketSlot.time):00"; timezone = 'America/Sao_Paulo'
        durationMinutes = $duration; quantity = 1; addonIds = @(); notes = 'Fluxo E2E marketplace'; currency = 'BRL'
    }
    $marketHeaders = $customerHeaders.Clone()
    $marketHeaders['Idempotency-Key'] = "market-e2e-$([guid]::NewGuid())"
    $marketBooking = (Invoke-Api Post '/bookings' $marketHeaders $marketPayload).data
    Assert-True ($marketBooking.status -eq 'open' -and $marketBooking.allowedActions -contains 'offers') 'A solicitação ao marketplace não ficou aberta.'
    $opportunityNotice = @((Invoke-Api Get '/me/notifications?perPage=50' $providerHeaders).data) | Where-Object { $_.type -eq 'booking.opportunity' -and $_.data.bookingId -eq $marketBooking.id } | Select-Object -First 1
    Assert-True ($null -ne $opportunityNotice) 'O profissional compatível não recebeu a nova oportunidade.'
    $requests = @((Invoke-Api Get '/provider/open-requests?perPage=50' $providerHeaders).data)
    Assert-True ($requests.id -contains $marketBooking.id) 'O profissional compatível não recebeu a oportunidade aberta.'
    $offer = (Invoke-Api Post "/provider/bookings/$($marketBooking.id)/offers" $providerHeaders @{ amountCents = [int]$quote.subtotalCents; message = 'Proposta E2E' }).data
    $offers = @((Invoke-Api Get "/bookings/$($marketBooking.id)/offers" $customerHeaders).data)
    Assert-True ($offers.id -contains $offer.id) 'A proposta enviada não apareceu para o cliente.'
    $accepted = (Invoke-Api Post "/bookings/$($marketBooking.id)/offers/$($offer.id)/accept" $customerHeaders @{}).data
    Assert-True ($accepted.status -eq 'confirmed' -and $accepted.professionalId -eq $professional.id) 'A proposta não foi aceita corretamente.'
    $cancelled = (Invoke-Api Post "/bookings/$($marketBooking.id)/cancel" $customerHeaders @{ reason = 'Encerramento controlado do teste E2E' }).data
    Assert-True ($cancelled.status -eq 'cancelled') 'A solicitação de teste não foi cancelada.'

    $exceptionDate = (Get-Date).Date.AddDays((Get-Random -Minimum 365 -Maximum 3650)).ToString('yyyy-MM-dd')
    $exception = (Invoke-Api Post '/provider/availability-exceptions' $providerHeaders @{
        date = $exceptionDate; type = 'unavailable'; reason = 'Exceção temporária do teste E2E'
    }).data
    $exceptions = @((Invoke-Api Get '/provider/availability-exceptions' $providerHeaders).data)
    Assert-True ($exceptions.id -contains $exception.id) 'A exceção de agenda não foi listada.'
    Invoke-Api Delete "/provider/availability-exceptions/$($exception.id)" $providerHeaders | Out-Null

    $notifications = Invoke-Api Get '/me/notifications?perPage=50' $customerHeaders
    Assert-True ($null -ne $notifications.meta.unreadCount) 'O contrato de notificações não retornou unreadCount.'
    Invoke-Api Post '/me/notifications/read-all' $customerHeaders @{} | Out-Null
    $adminDashboard = (Invoke-Api Get '/admin/dashboard' $adminHeaders).data
    $adminUsers = Invoke-Api Get '/admin/users?page=1&perPage=5' $adminHeaders
    Assert-True ($null -ne $adminDashboard.metrics -and $null -ne $adminUsers.meta.total) 'Os contratos administrativos estão incompletos.'

    Write-Output "PASS fluxo completo: endereços, favoritos, disponibilidade, cotação, idempotência, reserva, reagendamento, chegada, execução, avaliação, mensagens, propostas, agenda, notificações e administração."
} finally {
    Pop-Location
}
