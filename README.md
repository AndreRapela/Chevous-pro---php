# ChezVoust Pro

Marketplace mobile-first de serviços domésticos para clientes, profissionais e
equipes de operação. O projeto combina um frontend Angular, uma API REST em PHP
puro e um banco MySQL 8. A identidade visual usa tipografia, iniciais, CSS e três
fotos autorizadas, entregues em seis variantes WebP responsivas para evitar downloads
desnecessários em celulares.

## O que está incluído

- catálogo, busca, perfis, favoritos e navegação pública responsiva;
- cotação autoritativa e reserva em cinco etapas, com endereço, agenda, profissional,
  cupom, intenção de pagamento e resumo;
- agenda, cancelamento básico, conversa vinculada à reserva e avaliação pós-serviço;
- painéis separados de cliente, profissional e administrador, protegidos por papel;
- perfil, serviços, disponibilidade, oportunidades, propostas e jobs do profissional;
- administração básica de usuários, prestadores, reservas, catálogo, cupons, promoções e auditoria;
- API REST com autenticação JWT/refresh, RBAC, validação, idempotência, rate limit,
  proxy autenticado, locks de agenda, outbox e persistência MySQL;
- pagamento inteiramente simulado para desenvolvimento, sem coleta de cartão;
- modo demonstrativo do Angular para navegar sem uma API ativa.

Recorrência, reagendamento completo, KYC/documentos, gateway real, estorno, repasse,
disputas, suporte operacional e automações de privacidade estão identificados nos
documentos como escopo parcial ou roadmap; não são apresentados como prontos.

## Arquitetura

```text
frontend/   Angular standalone e responsivo para celular, tablet e desktop
backend/    API REST PHP 8.2+ sem dependências obrigatórias de framework
database/   schema e dados demonstrativos para MySQL 8
docs/       produto, arquitetura, contrato da API, LGPD e aceite
compose.yaml ambiente local completo
```

O backend segue um monólito modular: um único processo HTTP, módulos de domínio
separados e persistência via PDO. Essa escolha deixa a instalação simples sem
impedir a substituição futura de chat, notificações ou pagamentos por provedores
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

## Execução sem containers

1. Crie um banco MySQL 8 e execute `database/schema.sql`.
2. Copie `backend/.env.example` para `backend/.env` e configure a conexão.
3. Execute `php backend/bin/seed.php` a partir da raiz para aplicar os dados demo com senhas protegidas.
4. Sirva `backend/public` com PHP 8.2+.
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

Resultado da validação estática local em 24/08/2026:

- lint Angular/TypeScript/templates e build de produção aprovados;
- testes unitários da agenda: 3/3, com 100% de linhas e funções no módulo coberto;
- auditoria das dependências de produção: nenhuma vulnerabilidade encontrada;
- inspeção estrutural: 95 registros de rota, 35 tabelas e seis variantes WebP autorizadas;
- suíte do núcleo PHP: 8/8 testes aprovados e lint PHP integral;
- Compose validado com MySQL, API, web e worker saudáveis, incluindo login dos três papéis;
- fluxo HTTP completo aprovado para conta, agenda, reserva, proposta, pagamento simulado,
  execução, avaliação, mensagens, notificações e administração;
- inspeção visual e interativa aprovada em desktop e mobile. A última validação
  com Docker/MySQL foi feita em 24/08/2026.

A matriz completa de concorrência transacional, desempenho, acessibilidade e
segurança dinâmica permanece como gate antes de homologação. Comandos e escopo
estão em `tests/README.md` e `docs/ACCEPTANCE.md`.

## Limites intencionais

- pagamento, repasse, e-mail, SMS e verificação de identidade são adaptadores simulados;
- uma foto de capa foi editada a partir da referência autorizada; as fotos de eletricista e garçonete foram geradas a pedido do usuário e todas são servidas em WebP responsivo;
- nenhuma publicação, deploy, commit ou envio para repositório remoto é realizado automaticamente;
- integrações de produção exigem credenciais e decisões comerciais do responsável pelo produto.
