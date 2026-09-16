# ChezVoust Pro — contrato atual da API

> Estado reconciliado em 26 de agosto de 2026 por inspeção e testes automatizados locais.

## Como ler o status

- **Implementado:** existe rota, persistência e regra correspondente na API PHP.
- **Parcial:** existe parte do fluxo, mas ainda falta uma etapa para a jornada completa.
- **Demonstração:** comportamento local ou simulado, sem integração de produção.
- **Roadmap:** direção de produto; não faz parte do contrato HTTP atual.

`backend/routes/api.php` continua sendo a fonte executável das rotas. Em caso de
divergência, o código prevalece e este arquivo deve ser atualizado.

## Convenções implementadas

- Base local: `/api/v1`; JSON UTF-8.
- Autenticação: `Authorization: Bearer <accessToken>`.
- Renovação: refresh token rotativo somente no cookie `cv_refresh` `HttpOnly` e `SameSite=Strict`.
- Sucesso com corpo: `{ "data": ... }`; algumas coleções paginadas também incluem
  `{ "meta": { "page", "perPage", "total", "lastPage" } }`.
- Sucesso sem corpo: HTTP `204`.
- Erro: `{ "error": { "code", "message", "fields?", "requestId" } }`.
- A API devolve `X-Request-Id`; um identificador de entrada válido pode ser enviado em
  `X-Request-Id`.
- Valores monetários são inteiros em centavos e usam `EUR` ou `USD`; a moeda deve ser enviada na cotação e na reserva.
- IDs públicos são UUIDs. O detalhe de serviço aceita UUID e também slug.
- Reservas aceitam `Idempotency-Key`.
- Horários de reserva e agenda são serializados em RFC 3339 UTC nos endpoints que os
  expõem. Outros timestamps administrativos ainda podem aparecer no formato SQL UTC e
  devem ser tratados como uma limitação de compatibilidade até a normalização global.
- Filtros são parâmetros de query. Apenas endpoints que retornam `meta` devem ser
  considerados paginados; não se deve supor paginação em toda lista.
- HTTPS é obrigatório fora do desenvolvimento local.

### Exemplos

Sucesso:

```json
{
  "data": {
    "id": "80000000-0000-4000-8000-000000000001",
    "status": "confirmed"
  }
}
```

Erro de validação:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revise os campos informados.",
    "fields": {
      "scheduledStart": ["Informe uma data válida."]
    },
    "requestId": "c4a5a366-3dcc-4f62-bb2f-b8ad86ec76f4"
  }
}
```

## Rotas públicas — implementadas

| Método | Rota | Observação |
| --- | --- | --- |
| GET | `/health` | Estado do processo HTTP; não substitui health check profundo do banco. |
| GET | `/app-config` | Configurações públicas e seguras da aplicação. |
| GET | `/home` | Promoções, categorias e profissionais em destaque. |
| GET | `/categories` | Categorias ativas. |
| GET | `/services?category=&q=&page=&perPage=` | Catálogo paginado; categoria aceita UUID ou slug. |
| GET | `/services/{idOrSlug}` | Detalhe e adicionais ativos do serviço. |
| GET | `/professionals?service=&city=&state=&ratingMin=&sort=` | Busca pública paginada. |
| GET | `/professionals/{id}` | Perfil público, vitrine profissional, experiências, cursos e serviços ofertados. |
| GET | `/avatars/{id}` | Foto pública do perfil, quando o usuário tiver enviado uma. |
| GET | `/professionals/{id}/availability` | Regras e exceções; não é uma grade final já descontada por reservas. |
| GET | `/professionals/{id}/reviews` | Avaliações publicadas. |
| GET | `/professionals/{id}/comments` | Comentários públicos publicados; não influenciam a nota. |
| POST | `/professionals/{id}/comments` | Autenticado; publica comentário de comunidade, com limite de uma publicação por minuto por perfil. |

`/providers`, `/providers/{id}`, `/providers/{id}/availability` e
`/providers/{id}/reviews` são aliases de compatibilidade para as rotas de profissionais.

## Autenticação e conta — implementadas

| Método | Rota | Acesso/uso |
| --- | --- | --- |
| POST | `/auth/register/customer` | Cadastro de cliente. |
| POST | `/auth/register/provider` | Cadastro inicial de prestador. |
| POST | `/auth/register` | Alias genérico com papel permitido pela validação. |
| POST | `/auth/login` | Cria sessão, devolve o access token e grava o refresh em cookie HttpOnly. |
| POST | `/auth/refresh` | Rotaciona o refresh token; uma repetição concorrente do cookie anterior é aceita só por 10 segundos para não derrubar outra aba legítima. |
| POST | `/auth/password/forgot` | Cria token e evento de recuperação sem enumerar conta. |
| POST | `/auth/password/reset` | Redefine senha com token descartável. |
| POST | `/auth/forgot-password` | Alias de `/auth/password/forgot`. |
| POST | `/auth/reset-password` | Alias de `/auth/password/reset`. |
| POST | `/auth/email/verify` | Confirma e-mail com token descartável. |
| POST | `/auth/logout` | Autenticado; revoga a sessão atual. |
| POST | `/auth/logout-all` | Autenticado; revoga todas as sessões da conta. |
| GET | `/auth/sessions` | Lista os dispositivos conectados e identifica a sessão atual. |
| DELETE | `/auth/sessions/{id}` | Revoga outra sessão da própria conta. |
| POST | `/auth/password/change` | Troca a senha e revoga os outros dispositivos. |
| GET/PATCH | `/me` | Consulta e atualiza o perfil básico. |
| POST | `/me/avatar` | Atualiza a foto do perfil por `multipart/form-data`, campo `avatar`; aceita JPG, PNG ou WebP de até 5 MiB, dimensões entre 96 e 2048 px por lado e no máximo 4 megapixels. A imagem é convertida para WebP no servidor. |
| GET/POST | `/me/addresses` | Lista e cria endereços próprios. |
| PUT/DELETE | `/me/addresses/{id}` | Atualiza ou remove logicamente endereço próprio. |

O backend persiste sessões, tokens de verificação e recuperação. O Compose executa
`backend/bin/worker.php` a cada 30 segundos; fora dos containers, essa execução precisa
ser agendada manualmente. O driver `log` registra somente o tipo e o agregado do evento,
sem expor o token. Em `APP_ENV=local` com debug, a própria resposta da API pode fornecer
o token de demonstração. Não existe entrega de e-mail transacional real.

O access token permanece apenas em memória no navegador. O refresh token fica em cookie
`HttpOnly`, `Secure` em produção e `SameSite=Strict`; não há refresh token em JSON nem
em armazenamento do navegador.

## Cotação, reserva e propostas — implementadas na API

### Cotação

`POST /quotes` é o endpoint canônico; `/bookings/quote` é um alias.
Ele exige cliente autenticado e aceita:

```json
{
  "serviceId": "40000000-0000-4000-8000-000000000001",
  "professionalId": "10000000-0000-4000-8000-000000000002",
  "durationMinutes": 180,
  "quantity": 1,
  "areaSqm": 80,
  "addonIds": []
}
```

O servidor resolve preço fixo, por hora ou por área, preço específico do profissional e
adicionais. O resultado é uma estimativa de referência; a criação da reserva recalcula
o valor e persiste `pricing_snapshot` e `booking_items`, sem cobrança, taxa ou comissão
da plataforma.

### Criação

`POST /bookings` aceita os mesmos campos da cotação, além de:

```json
{
  "mode": "direct",
  "addressId": "20000000-0000-4000-8000-000000000001",
  "scheduledStart": "2026-08-22T12:00:00-03:00",
  "timezone": "America/Sao_Paulo",
  "notes": "Interfone 42"
}
```

- `direct` exige `professionalId` e cria a reserva como `confirmed`.
- `marketplace` não recebe profissional e publica a solicitação como `open`.
- O alias de entrada `request` é normalizado internamente para `marketplace`.
- `providerId`, `estimatedMinutes`, `extras` e `answers.areaM2` são aliases de entrada
  para `professionalId`, `durationMinutes`, `addonIds` e `areaSqm`.
- Recorrência não é persistida no modelo atual.

### Operações disponíveis

| Método | Rota | Acesso/uso |
| --- | --- | --- |
| GET | `/bookings` | Reservas visíveis ao cliente, prestador ou admin. |
| GET | `/bookings/{id}` | Detalhe autorizado da reserva. |
| GET | `/bookings/{id}/offers` | Cliente/admin lista propostas. |
| POST | `/provider/bookings/{bookingId}/offers` | Prestador aprovado envia proposta. |
| POST | `/offers/{offerId}/accept` | Cliente aceita proposta; alias curto. |
| POST | `/bookings/{id}/offers/{offerId}/accept` | Cliente aceita proposta. |
| POST | `/provider/offers/{offerId}/withdraw` | Prestador retira proposta pendente. |
| POST | `/bookings/{id}/cancel` | Participante autorizado cancela conforme estados aceitos. |
| POST | `/bookings/{id}/reschedule` | Cliente/admin reagenda reserva confirmada sem conflito. |
| POST | `/bookings/{id}/on-the-way` | Prestador/admin informa que está a caminho. |
| POST | `/bookings/{id}/start` | Prestador/admin inicia serviço permitido. |
| POST | `/bookings/{id}/complete` | Prestador/admin conclui serviço permitido. |
| POST | `/bookings/{id}/reviews` | Cliente avalia reserva concluída. |

Confirmação de conclusão pelo cliente, disputa, política versionada de cancelamento e
recorrência automática são **roadmap**.

## Relacionamento — implementado na API

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/me/favorites` | Cliente lista profissionais favoritos. |
| POST/DELETE | `/me/favorites/{professionalId}` | Adiciona/remove favorito. |
| GET | `/conversations` | Conversas das quais o usuário participa. |
| GET/POST | `/conversations/{id}/messages` | Lista/envia mensagens de texto. |
| GET | `/conversations/{id}/events?after={sequence}&limit=50` | Consulta incremental autenticada. Devolve imediatamente as mensagens posteriores ao cursor e informa em `meta.pollAfterSeconds` quando a próxima consulta deve ocorrer (atualmente, 5 s). |
| POST | `/conversations/{id}/read` | Atualiza leitura do participante. |
| GET | `/notifications` | Lista notificações; `/me/notifications` é alias. |
| POST | `/notifications/{id}/read` | Marca uma notificação; há alias sob `/me`. |
| POST | `/notifications/read-all` | Marca todas; há alias sob `/me`. |
| GET | `/professionals/{id}/reviews` | Lista avaliações públicas. |
| POST | `/bookings/{id}/reviews` | Cria avaliação elegível. |
| GET/POST | `/professionals/{id}/comments` | Lista/publica comentários da comunidade, separados de avaliações de reserva. |

Anexos de conversa, denúncia, suporte, tickets e moderação editorial são **roadmap**. Comentários públicos passam por sanitização, controle de frequência e podem ser ocultados pela operação no banco.
O Angular integra favoritos, conversa de texto, cancelamento e avaliação; recursos sem
endpoint permanecem rotulados como demonstração.

O envio de `POST /conversations/{id}/messages` aceita `Idempotency-Key` (até 100
caracteres). Repetir a mesma chave e conteúdo devolve a mesma mensagem; reutilizá-la
com conteúdo ou conversa diferente responde `409 IDEMPOTENCY_CONFLICT`.

## Área do prestador — implementada na API

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/provider/dashboard` | Perfil e métricas agregadas. |
| GET/PATCH | `/provider/profile` | Consulta/atualiza perfil profissional. |
| GET/POST | `/provider/profile/experiences` | Lista ou adiciona experiências do próprio perfil. |
| PUT/DELETE | `/provider/profile/experiences/{id}` | Atualiza ou remove experiência própria. |
| GET/POST | `/provider/profile/courses` | Lista ou adiciona cursos do próprio perfil. |
| PUT/DELETE | `/provider/profile/courses/{id}` | Atualiza ou remove curso próprio. |
| GET | `/provider/services` | Lista ofertas do prestador. |
| PUT/DELETE | `/provider/services/{serviceId}` | Ativa, precifica ou remove oferta. |
| GET/PUT | `/provider/availability` | Consulta/substitui regras semanais. |
| GET | `/provider/jobs` | Lista trabalhos do prestador. |
| GET | `/provider/open-requests` | Solicitações abertas compatíveis. |
| GET | `/provider/opportunities` | Alias de solicitações abertas. |
| POST | `/provider/bookings/{bookingId}/offers` | Envia proposta. |
| POST | `/provider/offers/{offerId}/withdraw` | Retira proposta. |

Documentos/KYC e áreas geográficas precisas são
**roadmap**. `verificationStatus=approved` representa aprovação operacional do perfil;
não comprova identidade documental.

## Administração — núcleo implementado na API

Todas as rotas abaixo exigem papel `admin`:

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/admin/dashboard` | Métricas agregadas. |
| GET | `/admin/users` | Usuários paginados. |
| PATCH | `/admin/users/{id}/status` | Ativa ou suspende conta. |
| GET | `/admin/professionals/pending` | Perfis aguardando análise. |
| POST | `/admin/professionals/{id}/review` | Aprova/rejeita/suspende perfil. |
| POST/PATCH | `/admin/categories`, `/admin/categories/{id}` | Cria/atualiza categoria. |
| POST/PATCH | `/admin/services`, `/admin/services/{id}` | Cria/atualiza serviço. |
| GET/POST | `/admin/promotions` | Lista/cria promoção textual. |
| GET | `/admin/bookings` | Alias administrativo da listagem de reservas. |
| GET | `/admin/audit-logs` | Trilha administrativa paginada. |

O painel Angular consome as operações administrativas que possuem endpoint; qualquer
fallback sem contrato deve ser identificado como demonstração. Disputas, tickets,
documentos, RBAC granular, impersonação e exportação são
**roadmap**.

## Fora do contrato atual — roadmap

Os itens seguintes preservam a direção profissional do produto, mas não possuem contrato
executável completo nesta versão:

- gestão/listagem de sessões, consentimentos e solicitações LGPD;
- preferência de notificação e encerramento automatizado de conta;
- áreas de serviço georreferenciadas e disponibilidade final por slots;
- recorrência e ocorrências de reserva;
- disputa, ticket, anexos e uploads privados;
- KYC/documentos e selos baseados em evidência;
- resposta ou denúncia de avaliações;
- relatórios/exportações e permissões administrativas granulares;
- OpenAPI estabilizado e versionamento `/api/v2`.

Adicionar uma rota ao roadmap não a torna disponível. Ela só passa para “implementado”
quando existir no roteador, aplicar autorização/regra no servidor, persistir quando
necessário e for integrada ao consumidor correspondente.
