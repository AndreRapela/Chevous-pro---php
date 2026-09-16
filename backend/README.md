# ChezVoust Pro — API PHP

API REST autocontida para o marketplace de serviços domésticos ChezVoust Pro.

## Requisitos

- PHP 8.4 ou superior com `pdo_mysql`, `mbstring`, `json`, `openssl` e `fileinfo`.
- MySQL 8.
- Apache com `mod_rewrite`, PHP-FPM/Nginx ou servidor embutido do PHP para desenvolvimento.

Não há framework nem dependência externa de Composer.

## Configuração local

1. Crie um banco MySQL vazio com charset `utf8mb4`.
2. Copie `.env.example` para `.env` e defina as credenciais locais.
3. Substitua `JWT_SECRET` por uma sequência aleatória com pelo menos 32 caracteres.
4. A partir da raiz do projeto, aplique o schema e o seed:

```bash
php backend/bin/migrate.php
php backend/bin/seed.php
```

5. Inicie a API para desenvolvimento:

```bash
php -S 127.0.0.1:8080 -t backend/public backend/public/index.php
```

O Apache deve apontar o `DocumentRoot` para `backend/public`. O `Dockerfile` já faz essa configuração.

## Contas fictícias do seed

| Papel | E-mail | Senha |
| --- | --- | --- |
| Cliente | `cliente@chezvoust.test` | `Cliente@123` |
| Prestador | `profissional@chezvoust.test` | `Profissional@123` |
| Administrador | `admin@chezvoust.test` | `Admin@123` |

As senhas são transformadas por `password_hash` durante a execução do seed; nenhum hash ou segredo real é versionado.

## Contrato HTTP

- Base: `/api/v1`.
- Resposta: `{ "data": ... }`; listas incluem `meta`.
- Erro: `{ "error": { "code", "message", "fields?", "requestId" } }`.
- Autenticação: `Authorization: Bearer <accessToken>`.
- Renovação: refresh JWT rotativo somente no cookie `cv_refresh` `HttpOnly`, `Secure` fora do local e `SameSite=Strict`.
- Datas persistidas em UTC e exibidas conforme o timezone da reserva.
- Valores de referência em centavos inteiros, com base em `BRL` e opções de exibição em `EUR` e `USD`; a plataforma não processa pagamentos.
- Criação de reserva aceita `Idempotency-Key`.

Grupos principais:

- `/auth`, `/me`, `/me/addresses` — conta, sessão e endereços.
- `/home`, `/categories`, `/services`, `/professionals` — catálogo e descoberta.
- `/bookings`, `/offers`, `/quotes` — reserva direta e solicitações ao marketplace.
- `/conversations`, `/notifications`, `/me/favorites` — relacionamento.
- `/provider` — perfil, serviços, agenda, oportunidades e jobs.
- `/admin` — dashboard, usuários, aprovação, catálogo, promoções e auditoria.

`routes/api.php` é a fonte definitiva da lista de rotas.

## Worker local

Execute periodicamente:

```bash
php backend/bin/worker.php
```

Ele processa a outbox em modo de log ou entrega transacional configurada.

## Segurança implementada

- JWT HS256 com emissor, audiência, tipo, validade, sessão persistida e revogação.
- Refresh token rotativo e armazenado somente como SHA-256.
- Senha Argon2id quando disponível, com fallback seguro do PHP.
- RBAC `customer`, `provider` e `admin`, mais verificação de propriedade/participação.
- PDO com prepared statements reais, validação por lista permitida, CORS explícito e rate limit em MySQL.
- Locks transacionais por profissional/dia para evitar dupla reserva.
- Auditoria administrativa, request ID, idempotência e mensagens sem HTML.

## Testes

Os testes foram mantidos fora das etapas de construção e executados somente na fase
final. A partir da raiz, consulte `tests/README.md` para os comandos. A validação com
MySQL real deve ser executada pelo ambiente Compose antes da homologação.
