# Testes e verificação automática

- `backend_core.php`: UUID, JWT, adulteração de token, validação de entrada e proxy confiável.
- `backend_check.ps1`: executa os testes centrais e a análise de sintaxe com o
  PHP local ou, quando ele não estiver instalado, dentro da imagem Docker.
- `messaging_flow.ps1`: fluxo real cliente ↔ profissional, cursor incremental, sincronização curta, idempotência, confirmação de leitura e isolamento de acesso.
- `security_sessions_flow.ps1`: listagem e revogação de dispositivos, sessão atual, refresh restrito a cookie e renovação concorrente de abas.
- `booking_flow.ps1`: fluxo HTTP completo de conta, disponibilidade, reservas, propostas, execução, avaliação, notificações e administração.
- `structure.mjs`: contratos de rotas, schema, idempotência, sessão, disponibilidade, segurança e ativos autorizados.
- `architecture.mjs`: direção de dependências, limites de tamanho, lazy loading/noindex do checkout e proibição de persistir dados financeiros no front.
- `frontend/tests/*.spec.ts`: testes unitários nativos do Node das regras reutilizadas pela agenda, checkout, localização, SEO e componentes críticos.
- `compose_smoke.ps1`: serviços Docker, endpoint de saúde e login dos três papéis.
- `outbox_flow.ps1`: limite de tentativas, diagnóstico e remoção do payload
  sensível de eventos irrecuperáveis.
- `product_checkout.php` valida reservas, repetição e expiração com respostas simuladas do Stripe.
- `promotion_storage.php` valida a retenção das mídias referenciadas e a coleta das que perderam seus vínculos.
- `frontend/tests/promotions.browser.spec.mjs` testa a rotação da home no Chromium e o envio de vídeos de 60 e 61 segundos por arquivo e por link. Os WebM em `frontend/tests/fixtures/` têm quadros pretos de 32 × 32 pixels a 1 quadro por segundo.
- `frontend_mirror.mjs` compara os arquivos compartilhados das duas cópias do frontend e lista as divergências.
- `production_compose.mjs`: garante que o overlay público não publique portas nem
  entregue segredos desnecessários ao frontend.
- o build Angular valida TypeScript, templates e estilos;
- a inspeção no navegador valida as principais jornadas em larguras mobile e desktop.

Execução a partir da raiz:

```powershell
node tests/structure.mjs
node tests/production_compose.mjs
node tests/frontend_mirror.mjs
pwsh -File tests/backend_check.ps1
pwsh -File tests/messaging_flow.ps1
pwsh -File tests/security_sessions_flow.ps1
pwsh -File tests/booking_flow.ps1
PowerShell -ExecutionPolicy Bypass -File tests/compose_smoke.ps1
PowerShell -ExecutionPolicy Bypass -File tests/outbox_flow.ps1
Get-Content -Raw tests/product_checkout.php | docker compose exec -T api php /dev/stdin /var/www/html
Get-Content -Raw tests/promotion_storage.php | docker compose exec -T api php /dev/stdin /var/www/html
Set-Location frontend
npm run lint
npm run test:coverage
npm run build
npx playwright install --only-shell chromium
npm run test:browser
```

O gate `test:coverage` exige 100% apenas para os utilitários puros explicitamente
listados em `test:coverage:utils`. Ele não representa cobertura integral do Angular
ou dos controladores PHP; esses caminhos são complementados pelos testes de
contrato, SSR e fluxos HTTP/Compose descritos acima.

Para executar contra um projeto Compose isolado ou portas alternativas, defina
`CVP_API_URL` (por exemplo, `http://localhost:18080/api/v1`) e `CVP_WEB_URL`
(por exemplo, `http://localhost:14200`) antes dos scripts PowerShell.

Os fluxos com MySQL/Compose fazem parte do job `integration` da CI. O job
`frontend` executa o Chromium após o build. O job `frontend-mirror` verifica o
branch `main` do espelho nos pushes. Em pull requests, usa o branch de mesmo nome
no espelho quando ele existe e recorre a `main` nos demais casos. Para comparar
outro checkout local, passe o caminho dele para `node tests/frontend_mirror.mjs`.
