# Qualidade e testes

Os testes acompanham a implementação e a regressão. Adicione um caso reproduzível
para alterações de regra, segurança, contrato ou comportamento assíncrono.

- `backend_core.php`: UUID, JWT, adulteração de token, validação estrita, limites JSON,
  proxy confiável, cifra da outbox e política de disponibilidade.
- `backend_check.ps1`: executa os testes centrais e a análise de sintaxe com o
  PHP local ou, quando ele não estiver instalado, dentro da imagem Docker.
- `messaging_flow.ps1`: fluxo real cliente ↔ profissional, cursor incremental, sincronização curta, idempotência, confirmação de leitura e isolamento de acesso.
- `security_sessions_flow.ps1`: listagem e revogação de dispositivos, sessão atual, refresh restrito a cookie e renovação concorrente de abas.
- `booking_flow.ps1`: fluxo HTTP completo de conta, disponibilidade, reservas, propostas,
  execução, avaliação, notificações e administração; inclui exceções de horário,
  precedência de bloqueios, troca de dia e fuso do cliente.
- `integration_support.ps1`: protege os fluxos que gravam dados; exige loopback, porta
  correspondente ao projeto Compose selecionado e `APP_ENV=local` ou `testing`.
- `structure.mjs`: contratos de rotas, schema, idempotência, sessão, disponibilidade, segurança e inventário de assets.
- `architecture.mjs`: direção de dependências, limites de tamanho, lazy loading/noindex do checkout e proibição de persistir dados financeiros no front.
- `frontend/tests/*.spec.ts`: testes unitários nativos do Node das regras reutilizadas pela agenda, checkout, localização, SEO e componentes críticos.
- `frontend/tests/php-format.spec.ts`: compara a árvore sintática antes/depois da
  formatação de cada arquivo PHP, ignorando apenas diferenças de apresentação.
- `frontend/tests/support`: leitura de templates/estilos externos para contratos e
  harness que compila métodos reais; os testes não copiam a implementação de produção.
- `compose_smoke.ps1`: serviços Docker, endpoint de saúde e login dos três papéis.
- `outbox_flow.ps1`: limite de tentativas, diagnóstico e remoção do payload
  sensível de eventos irrecuperáveis.
- `production_compose.mjs`: garante que o overlay público não publique portas nem
  entregue segredos desnecessários ao frontend; valida também imagens com revisão
  obrigatória, sem rebuild nem bind de código local no overlay do registry.
- o build Angular valida TypeScript, templates e estilos;
- a inspeção manual no navegador complementa os contratos em celular, tablet e desktop;
  não é substituída pelo build ou por uma contagem de testes.

Execução a partir da raiz:

```powershell
node tests/structure.mjs
node tests/architecture.mjs
node tests/production_compose.mjs
pwsh -File tests/backend_check.ps1
Set-Location frontend
npm run check
npm run test:dependencies
```

`npm run check` executa formatação, lint, build, inspeção do bundle, unitários,
localização, estrutura, arquitetura, cobertura dos utilitários e SSR. Para formatar,
execute `npm run format`; o teste de preservação sintática do PHP precede a escrita.
O CI também audita dependências de desenvolvimento, não apenas as de produção.

Fluxos HTTP que gravam dados, com o Compose local já ativo:

```powershell
pwsh -File tests/messaging_flow.ps1
pwsh -File tests/security_sessions_flow.ps1
pwsh -File tests/booking_flow.ps1
pwsh -File tests/compose_smoke.ps1
pwsh -File tests/outbox_flow.ps1
```

O gate `test:coverage` exige 100% apenas para os utilitários puros explicitamente
listados em `test:coverage:utils`. Ele não representa cobertura integral do Angular
ou dos controladores PHP; esses caminhos são complementados pelos testes de
contrato, SSR e fluxos HTTP/Compose descritos acima.

Para executar contra um projeto Compose isolado ou portas alternativas, defina
`COMPOSE_PROJECT_NAME`, `CVP_API_URL` (por exemplo, `http://localhost:18080/api/v1`) e
`CVP_WEB_URL` (por exemplo, `http://localhost:14200`) antes dos scripts PowerShell.
As portas devem ser as publicadas pelo projeto selecionado. Use banco e credenciais
fictícias próprias; os scripts não são um procedimento de teste para produção.

Esses fluxos com MySQL/Compose também fazem parte do job `integration` do CI. A
matriz transacional de alta concorrência e expiração prolongada continua sendo um
gate separado.

Resultados, análise da adequação dos testes e lacunas conhecidas estão em
`docs/CODE_AUDIT_2026-10-13.md`. Nenhum percentual aqui representa cobertura total do sistema.
