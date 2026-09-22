# Testes finais

Esta pasta existe somente para a etapa final de qualidade da entrega.

- `backend_core.php`: UUID, JWT, adulteração de token, validação de entrada e proxy confiável.
- `backend_check.ps1`: executa os testes centrais e a análise de sintaxe com o
  PHP local ou, quando ele não estiver instalado, dentro da imagem Docker.
- `messaging_flow.ps1`: fluxo real cliente ↔ profissional, cursor incremental, sincronização curta, idempotência, confirmação de leitura e isolamento de acesso.
- `security_sessions_flow.ps1`: listagem e revogação de dispositivos, sessão atual, refresh restrito a cookie e renovação concorrente de abas.
- `booking_flow.ps1`: fluxo HTTP completo de conta, disponibilidade, reservas, propostas, execução, avaliação, notificações e administração.
- `structure.mjs`: contratos de rotas, schema, idempotência, sessão, disponibilidade, segurança e ativos autorizados.
- `frontend/tests/*.spec.ts`: testes unitários nativos do Node das regras reutilizadas pela agenda, com cobertura V8.
- `compose_smoke.ps1`: serviços Docker, endpoint de saúde e login dos três papéis.
- `outbox_flow.ps1`: limite de tentativas, diagnóstico e remoção do payload
  sensível de eventos irrecuperáveis.
- `production_compose.mjs`: garante que o overlay público não publique portas nem
  entregue segredos desnecessários ao frontend.
- o build Angular valida TypeScript, templates e estilos;
- a inspeção no navegador valida as principais jornadas em larguras mobile e desktop.

Execução a partir da raiz:

```powershell
node tests/structure.mjs
node tests/production_compose.mjs
pwsh -File tests/backend_check.ps1
pwsh -File tests/messaging_flow.ps1
pwsh -File tests/security_sessions_flow.ps1
pwsh -File tests/booking_flow.ps1
PowerShell -ExecutionPolicy Bypass -File tests/compose_smoke.ps1
PowerShell -ExecutionPolicy Bypass -File tests/outbox_flow.ps1
Set-Location frontend
npm run lint
npm run test:coverage
npm run build
```

Para executar contra um projeto Compose isolado ou portas alternativas, defina
`CVP_API_URL` (por exemplo, `http://localhost:18080/api/v1`) e `CVP_WEB_URL`
(por exemplo, `http://localhost:14200`) antes dos scripts PowerShell.

Esses fluxos com MySQL/Compose também fazem parte do job `integration` do CI. A
matriz transacional de alta concorrência e expiração prolongada continua sendo um
gate separado.
