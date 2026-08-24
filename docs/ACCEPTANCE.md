# ChezVoust Pro — critérios e estado de aceite

> Este documento não declara aprovação para produção. Ele separa o que existe no
> código, o que é demonstração e o que permanece no roadmap. A suíte local foi criada
> e executada somente após o congelamento funcional, na fase final da entrega.

## Regra desta entrega

- Código e documentação permanecem locais: sem commit, push, publicação ou deploy.
- Uma imagem editada a partir da referência autorizada é usada na capa e uma foto de eletricista gerada a pedido do usuário é usada no acesso.
- Por solicitação do produto, criação complementar e execução da suíte de testes ficam
  exclusivamente para a fase final, depois do congelamento funcional.
- Pagamento, contas, endereços e comunicação usam dados fictícios; nenhum serviço real
  deve ser acionado.

## Legenda de status

| Status | Significado |
| --- | --- |
| Implementado | Existe caminho correspondente no código e persistência quando aplicável. |
| Parcial | Parte relevante existe, mas a jornada ainda tem lacuna funcional ou de integração. |
| Demonstração | Mock, simulador ou conteúdo explicitamente fictício. |
| Roadmap | Não existe contrato executável completo nesta versão. |
| Não verificado | Pode existir no código, mas o critério ainda depende da fase final de testes. |

“Implementado” não significa “teste passou”. Todos os itens implementados continuam
**não verificados** até a fase final.

## Escopo de aceite da versão local

A versão local pode buscar aceite funcional para este núcleo:

- navegação pública, catálogo e perfis;
- cadastro, login, refresh, logout, verificação e recuperação no limite dos adapters
  locais disponíveis;
- endereços;
- cotação autoritativa, cupom, reserva direta e solicitação ao marketplace;
- proposta/aceite, bloqueio de agenda e transições básicas;
- intenção e pagamento simulados;
- favoritos, conversa de texto, notificações e avaliação;
- perfil, serviços, disponibilidade, jobs e oportunidades de prestador;
- administração básica de usuários, prestadores, catálogo, cupons, promoções e auditoria.

KYC, uploads, gateway real, webhook, estorno, crédito, ledger, repasse, recorrência,
reagendamento completo, disputa/ticket, privacidade automatizada, múltiplos papéis, PWA e
fornecedores externos não fazem parte do gate local atual. Eles possuem gate próprio
quando forem implementados.

## Matriz honesta das jornadas

| ID | Cenário | Estado do código antes dos testes finais | Condição para aceite |
| --- | --- | --- | --- |
| PUB-01 | Landing, categorias e profissionais em mobile/desktop. | Implementado. | Verificar 360, 390, 768, 1024 e 1440 px sem sobreposição ou CTA inacessível. |
| PUB-02 | Busca sem expor contato/endereço exato. | Parcial: serviço, cidade, estado e nota existem; data, distância, preço e slots não formam busca completa. | Aceitar apenas os filtros existentes e comprovar minimização de dados. |
| AUTH-01 | Cadastro, login, refresh e logout. | Implementado. | Comprovar expiração, rotação, revogação, papéis e mensagens de erro. |
| AUTH-02 | Verificação e recuperação de senha. | Parcial: API, tokens e worker existem; o ambiente local usa token debug e não entrega e-mail real. | Comprovar fluxo local sem enumeração e documentar claramente a entrega demo. |
| CLI-01 | Configuração de endereço, serviço, quantidade/área, data e horário. | Implementado no núcleo. Recorrência, materiais e formulário dinâmico são roadmap. | Validar campos aplicáveis aos três tipos de preço. |
| CLI-02 | Cotação e composição do preço antes da confirmação. | Implementado na API e integrado ao fluxo web pelo endpoint de cotação. | Comparar UI, snapshot e valores persistidos em todos os cenários. |
| CLI-03 | Reserva direta, hold e pagamento simulado. | Implementado com simulador. | Comprovar idempotência, expiração, sucesso, recusa e timeout sem dupla reserva. |
| CLI-04 | Solicitação aberta, proposta e aceite. | Implementado na API e nas telas de cliente/prestador. | Comprovar que só prestador aprovado/compatível propõe e apenas uma oferta é aceita. |
| CLI-05 | Lista/detalhe/cancelamento de reserva. | Parcial: lista, detalhe e cancelamento básico existem; reagendamento, política versionada e disputa são roadmap. | Testar propriedade, estados permitidos e histórico. |
| CLI-06 | Conversa, favorito, notificação e avaliação. | API e jornadas web implementadas, incluindo leitura de notificações. | Testar participantes, leitura, remoção de favorito e avaliação única após conclusão. |
| PRE-01 | Perfil, serviços, preço e disponibilidade. | Implementado sem documentos/KYC e sem área geográfica calculada. | Comprovar ownership, validação e que aprovação é operacional, não identidade verificada. |
| PRE-02 | Jobs, oportunidades e propostas. | Implementado no núcleo. | Comprovar filtro por serviço, aprovação, concorrência e ausência de acesso alheio. |
| PRE-03 | Ganhos e repasses. | Parcial: há métrica local de ganhos; saldo, banco e repasse real são roadmap. | Não aceitar alegação financeira além da métrica derivada de dados locais. |
| ADM-01 | Dashboard, usuários e aprovação de perfil. | Implementado no núcleo da API. | Testar papel, filtros, estados, auditoria e integração das ações expostas. |
| ADM-02 | Catálogo, cupons, promoções e auditoria. | Implementado no núcleo da API. | Testar validação, paginação quando aplicável e persistência. |
| OPS-01 | Tickets, suporte e disputas. | Roadmap. | Criar modelo, rotas, autorização, UI e auditoria antes de abrir gate. |
| FIN-01 | Gateway, webhook, refund, ledger e repasse. | Roadmap; somente simulador local existe. | Exigir sandbox, assinatura, idempotência, reconciliação e segregação de papéis. |
| PRIV-01 | Consentimentos e solicitações do titular. | Roadmap; há apenas documentação orientativa em `LGPD.md`. | Implementar protocolo, autenticação, retenção e resposta operacional. |
| PRIV-02 | Documentos e anexos privados. | Roadmap; não há upload atual. | Implementar armazenamento privado, autorização, MIME/tamanho, retenção e auditoria. |

## Critérios de pronto para uma funcionalidade implementada

Uma capacidade só muda de “implementada” para “aceita” quando:

- interface mobile/desktop possui loading, vazio, erro e texto `pt-BR` quando aplicável;
- regra e autorização são aplicadas no servidor, não apenas ocultadas no frontend;
- dados persistem com integridade e operações sensíveis deixam trilha adequada;
- contrato de request, response e erro coincide com `API.md`;
- condições concorrentes e repetição idempotente foram exercitadas quando pertinentes;
- nenhum segredo, dado real, imagem não autorizada ou promessa operacional falsa é introduzido;
- fallback fictício aparece como “Demonstração” e não como evento real;
- configuração e limites ficam documentados.

## Regras críticas do núcleo a comprovar

- Login demo funciona com as três contas documentadas após inicialização limpa.
- Cotação e criação calculam os mesmos valores para preço fixo, horário e por área.
- Cupom respeita validade, mínimo, limite e concorrência.
- Snapshot e itens da reserva preservam a composição aceita.
- Dois fluxos concorrentes não ocupam o mesmo prestador no mesmo intervalo.
- Hold/pagamento expirado não mantém agenda bloqueada.
- Repetir criação com a mesma chave idempotente não duplica reserva ou intenção.
- Aceitar proposta mantém preço, itens e snapshot coerentes.
- Status muda somente para ator/estado autorizado e registra histórico.
- Simulação de pagamento não aceita reserva cancelada, hold vencido ou usuário alheio.
- Avaliação só é criada após conclusão e não duplica a mesma reserva/cliente.
- Mensagem e detalhe de reserva não vazam para não participante.
- Admin não acessa senha, token bruto ou dado de cartão inexistente.
- Outbox não registra token/segredo em log técnico.

## Qualidade de interface a verificar

- larguras mínimas: 360, 390, 768, 1024 e 1440 px;
- operações principais por teclado, foco visível e ordem lógica;
- labels, mensagens de erro associadas e estados ARIA coerentes;
- contraste WCAG 2.2 AA nas jornadas essenciais;
- alvos de toque confortáveis e navegação inferior sem cobrir conteúdo;
- datas, moeda e pluralização em `pt-BR` sem deslocamento de fuso;
- envio duplicado bloqueado durante ações longas;
- loading não mascara falha e vazio oferece próximo passo;
- nenhuma tela depende de fotografia;
- conteúdo mock/fallback identificado como demonstração.

Não há alegação de conformidade WCAG ou de Web Vitals antes da medição final.

## Qualidade técnica a verificar

- instalação limpa a partir de exemplos, schema e seed fictício;
- imagens Docker sem segredo local e com extensões PHP requeridas;
- respostas `204`, envelopes de erro e paginação consumidos corretamente pelo Angular;
- datas de reserva em RFC 3339 com fuso explícito;
- SQL parametrizado e valores monetários sem overflow;
- rate limit e auditoria distinguem clientes atrás do proxy configurado;
- logs sem senha, refresh/access token, token de verificação/reset ou mensagem privada;
- worker/outbox repetível e falha diagnosticável;
- seed restrito a desenvolvimento e sem redefinição inesperada em ambiente persistente;
- build de produção sem debug, source maps sensíveis ou CORS irrestrito;
- schema existente atualizado por estratégia de migrations antes de produção;
- backup/restauração e observabilidade definidos para qualquer implantação real.

## Fase final única de testes

Após o congelamento funcional, a execução seguiu esta ordem de referência:

1. Revisão estática final de configuração, schema, rotas, contratos e permissões.
2. Instalação/build reproduzível de frontend, backend e containers.
3. Testes unitários de preço, cupom, validação, estado e autorização.
4. Integração com MySQL para transações, locks, idempotência, outbox e expiração.
5. E2E das jornadas públicas e dos papéis `customer`, `provider` e `admin`.
6. Matriz manual responsiva e navegadores suportados.
7. Acessibilidade automatizada e manual por teclado/leitor de tela.
8. Segurança: autenticação, IDOR, injeção, XSS, CSRF/CORS, rate limit e vazamento.
9. Desempenho: Web Vitals, consultas principais e p95 da API em ambiente definido.
10. Recuperação: sessão expirada, pagamento recusado/expirado, conflito de agenda e
    restauração de backup quando aplicável.
11. Regressão integral após correções, com relatório e riscos residuais.

Não executar testes destrutivos contra serviços reais. Nesta versão, gateway e e-mail
devem permanecer em modo local/fictício.

### Resultado desta máquina — 24/08/2026

| Verificação | Resultado |
| --- | --- |
| Build Angular de produção | Aprovado. |
| TypeScript sem emissão | Aprovado. |
| Auditoria de dependências de produção | Aprovada, 0 vulnerabilidades encontradas. |
| Sintaxe PHP | Aprovada em 33 arquivos. |
| Núcleo PHP (UUID, JWT, validação e proxy confiável) | 8/8 cenários aprovados. |
| Estrutura | 95 registros de rota, 35 tabelas e 6 variantes WebP autorizadas. |
| Navegador local | Landing, reserva, notificações e painéis dos três papéis aprovados em 390 px, 1280 px e 1440 px; console sem erros ou avisos. |
| Integração MySQL/Compose | Smoke e fluxo HTTP completo aprovados: quatro serviços ativos, healthcheck, seed, autenticação, agenda, reserva, proposta, pagamento, execução, mensagens, notificações e administração. |

O resultado acima valida a construção e a demonstração local, mas não encerra os
gates de concorrência transacional, matriz completa de acessibilidade, segurança
dinâmica, desempenho, backup/restauração ou homologação com fornecedores externos.

## Gate de aceite local

A versão local só pode ser declarada aceita quando:

- todos os cenários do núcleo marcados como implementados passam na fase final;
- nenhum defeito bloqueador, crítico ou alto permanece aberto;
- não há acesso indevido, divergência de preço/snapshot ou conflito de agenda;
- telas não apresentam KYC, repasse, banco, pagamento real ou operação fictícia como fato;
- itens parciais estão desabilitados, rotulados ou removidos da jornada principal;
- riscos moderados/baixos possuem registro e decisão explícita.

O aceite local não autoriza produção. Fornecedores, contratos, homologação financeira,
revisão jurídica/LGPD, infraestrutura, observabilidade e autorização de deploy formam um
gate separado.
