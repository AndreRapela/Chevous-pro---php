# Testes finais

Esta pasta existe somente para a etapa final de qualidade da entrega.

- `backend_core.php`: UUID, JWT, adulteração de token, validação de entrada e proxy confiável.
- `messaging_flow.ps1`: fluxo real cliente ↔ profissional, cursor incremental, sincronização curta, idempotência, confirmação de leitura e isolamento de acesso.
- `security_sessions_flow.ps1`: listagem e revogação de dispositivos, sessão atual, refresh restrito a cookie e renovação concorrente de abas.
- `booking_flow.ps1`: fluxo HTTP completo de conta, disponibilidade, reservas, propostas, execução, avaliação, notificações e administração.
- `structure.mjs`: contratos de rotas, schema, idempotência, sessão, disponibilidade, segurança e ativos autorizados.
- `frontend/tests/*.spec.ts`: testes unitários nativos do Node das regras reutilizadas pela agenda, com cobertura V8.
- `compose_smoke.ps1`: serviços Docker, endpoint de saúde e login dos três papéis.
- o build Angular valida TypeScript, templates e estilos;
- a inspeção no navegador valida as principais jornadas em larguras mobile e desktop.

Execução a partir da raiz:

```powershell
node tests/structure.mjs
php tests/backend_core.php
pwsh -File tests/messaging_flow.ps1
pwsh -File tests/security_sessions_flow.ps1
pwsh -File tests/booking_flow.ps1
PowerShell -ExecutionPolicy Bypass -File tests/compose_smoke.ps1
Set-Location frontend
npm run lint
npm run test:coverage
npm run build
```

Os testes com MySQL/Compose foram executados em 26/08/2026. A matriz transacional
de alta concorrência e expiração prolongada continua sendo um gate separado.
