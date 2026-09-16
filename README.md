# ChezVoust Pro

Marketplace mobile-first de serviços domésticos para clientes, profissionais e
equipes de operação. O projeto combina um frontend Angular, uma API REST em PHP
puro e um banco MySQL 8. A identidade visual usa tipografia, iniciais, CSS e três
fotos autorizadas, entregues em seis variantes WebP responsivas para evitar downloads
desnecessários em celulares.

## O que está incluído

- catálogo, busca, perfis, favoritos e navegação pública responsiva;
- estimativa autoritativa e reserva em cinco etapas, com endereço, agenda, profissional
  e resumo;
- agenda, cancelamento básico, conversa vinculada à reserva e avaliação pós-serviço;
- painéis separados de cliente, profissional e administrador, protegidos por papel;
- perfil, serviços, disponibilidade, oportunidades, propostas e jobs do profissional;
- administração básica de usuários, prestadores, reservas, catálogo, promoções e auditoria;
- API REST com autenticação JWT/refresh, RBAC, validação, idempotência, rate limit,
  proxy autenticado, locks de agenda, outbox e persistência MySQL;
- modo demonstrativo do Angular para navegar sem uma API ativa.

Recorrência automática, KYC/documentos, disputas, suporte operacional e automações de
privacidade estão identificados nos
documentos como escopo parcial ou roadmap; não são apresentados como prontos.

## Arquitetura

```text
frontend/   Angular standalone e responsivo para celular, tablet e desktop
backend/    API REST PHP 8.4 sem dependências obrigatórias de framework
database/   schema e dados demonstrativos para MySQL 8
docs/       produto, arquitetura, contrato da API, LGPD e aceite
compose.yaml ambiente local completo
```

O backend segue um monólito modular: um único processo HTTP, módulos de domínio
separados e persistência via PDO. Essa escolha deixa a instalação simples sem
impedir a evolução futura de chat e notificações por provedores
externos.

## Início rápido da interface

Pré-requisito: Node.js 22 ou 24 e npm.

```powershell
Set-Location frontend
npm ci
npm start
```

Acesse `http://localhost:4200`. O ambiente de desenvolvimento consome `/api/v1`
por padrão; mantenha a API do Compose ativa para usar os dados demonstrativos do
banco. Para navegar sem backend, execute `npm run start:mock`.

## Ambiente completo com containers

Pré-requisito: Docker com Compose v2.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Web: `http://localhost:4200`
- API: `http://localhost:8080/api/v1`
- MySQL: `localhost:3306`

Para trabalhar no frontend com recarga automática, mantenha a API do Compose ativa e
execute `npm start` dentro de `frontend`; o proxy local encaminha `/api/v1` para a API
real. O modo de interface com dados isolados está disponível apenas por
`npm run start:mock` e não representa comunicação entre duas contas.

Antes de qualquer uso fora da máquina local, substitua todos os segredos do arquivo
`.env`, desative o modo de depuração e siga o checklist de [segurança](SECURITY.md).

## Produção e segurança operacional

Use `compose.production.yaml` somente com um arquivo de ambiente fora do repositório e
um proxy externo que termine TLS em HTTPS na porta 443. O Nginx do projeto serve a
aplicação na rede interna; ele não emite certificado nem deve ser exposto diretamente
em HTTP na internet. Banco, API e processo de SSR ficam sem portas públicas no overlay
de produção.

Antes da primeira subida, faça backup restaurável do banco e valide a migração em um
ambiente de homologação. A migração `202609120001_remove_coupon_feature.sql` elimina
dados de cupons de versões antigas; ela é idempotente para bancos novos, mas a remoção
dos registros é intencional. Configure `APP_URL`, `FRONTEND_ORIGINS` e
`SSR_ALLOWED_HOSTS` com o domínio HTTPS público (inclua cada variação de domínio
realmente usada), defina segredos aleatórios e mantenha `AUTO_SEED=false`. Após a
publicação, envie `https://seu-dominio/sitemap.xml` ao Search Console; `robots.txt`,
canonicals e metadados sociais são entregues automaticamente pela aplicação.

## Execução sem containers

1. Crie um banco MySQL 8 e execute `database/schema.sql`.
2. Copie `backend/.env.example` para `backend/.env` e configure a conexão.
3. Execute `php backend/bin/seed.php` a partir da raiz para aplicar os dados demo com senhas protegidas.
4. Sirva `backend/public` com PHP 8.4+.
5. Configure a URL da API no ambiente Angular e inicie o frontend.

Exemplo para a API:

```powershell
Set-Location backend
php -S 127.0.0.1:8080 -t public public/index.php
```

## Contas de demonstração

As contas abaixo existem apenas nos dados de desenvolvimento e devem ser removidas
ou substituídas em qualquer implantação real:

| Papel | E-mail | Senha |
|---|---|---|
| Cliente | `cliente@chezvoust.test` | `Cliente@123` |
| Profissional | `profissional@chezvoust.test` | `Profissional@123` |
| Administrador | `admin@chezvoust.test` | `Admin@123` |

## Qualidade e testes

Resultado da validação local mais recente:

- lint Angular/TypeScript/templates e build de produção aprovados;
- testes unitários do frontend: 12/12, cobrindo agenda, chat, perfil, registros profissionais e paginação;
- inspeção estrutural: 107 rotas REST, 34 tabelas e seis variantes WebP autorizadas;
- lint, build de produção e testes do Angular aprovados por `npm run check`.

Os fluxos PHP/MySQL, Compose, testes reais em dispositivos, matriz de concorrência,
acessibilidade e segurança dinâmica permanecem gates obrigatórios antes da
homologação. Comandos e escopo estão em `tests/README.md` e `docs/ACCEPTANCE.md`.

## Limites intencionais

- e-mail, SMS e verificação de identidade exigem configuração operacional antes da produção;
- uma foto de capa foi editada a partir da referência autorizada; as fotos de eletricista e garçonete foram geradas a pedido do usuário e todas são servidas em WebP responsivo;
- nenhuma publicação, deploy, commit ou envio para repositório remoto é realizado automaticamente;
- integrações de produção exigem credenciais e decisões comerciais do responsável pelo produto.
