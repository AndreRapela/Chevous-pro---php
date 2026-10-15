# Revisão de código e estrutura — 13/10/2026

## Resultado e escopo

Escopo: Angular, API PHP, schema/migrações, infraestrutura, testes e documentação.
A revisão manual abrangeu sessão, serialização, busca/paginação, localização, reserva,
mensagens, validação e estilos. O design, os contratos do produto e o checkout frontal
foram preservados. Processamento financeiro permanece fora do escopo.

Baseline de código: `3b6c38aec5b8781eaf0cbb7a2f44408cc40922da`.
Este relatório reúne inspeção estática e validação local; não inclui pentest,
certificação de acessibilidade ou homologação da infraestrutura pública.

## Diagnóstico inicial

Fundamentos existentes: Angular standalone, `OnPush`, rotas por feature, lazy loading,
TypeScript estrito, SQL parametrizado, RBAC, refresh rotativo, idempotência, locks de
agenda, outbox, migrações versionadas e CI.

Achados:

- apresentação extensa embutida nos componentes, dificultando revisar comportamento;
- 4.641 linhas no arquivo global de estilos, incluindo refinamentos duplicados;
- um serviço de localização com dados e algoritmo misturados;
- mapeamento de DTOs concentrado junto às chamadas HTTP;
- reconhecimento da API por substring no interceptor de autenticação;
- encerramento de sessão também diante de falhas transitórias após renovar o token;
- respostas antigas de busca capazes de substituir resultados mais recentes;
- metadados de paginação pouco defensivos e duplicação dentro da página recebida;
- conversão booleana que tratava a string `'0'` como verdadeira;
- validação PHP permissiva para datas, números e campos obrigatórios;
- corpo JSON sem um limite explícito de tamanho/profundidade;
- diferença entre a disponibilidade anunciada pelo catálogo e a aceita pela reserva;
- documentação desatualizada, inclusive negando recursos já implementados;
- dependências com avisos de segurança e testes de regressão insuficientes para esses casos.

## Correções realizadas

### Organização e legibilidade

Foram extraídos 46 templates maiores para arquivos `.component.html`. Os componentes
mantêm estado, eventos, efeitos e coordenação; a apresentação pode ser revisada
separadamente. Templates pequenos continuam inline.

`styles.scss` passou a ser uma entrada de composição, com 17 imports ordenados. Os
27 arquivos SCSS globais distribuem fundação, shells, componentes, páginas, portais,
acessibilidade e refinamentos responsivos. A ordem da cascata foi preservada. Foram
removidas 111 declarações idênticas redundantes, comparadas por contexto, seletor,
propriedade, valor e prioridade, sem eliminar regras de keyframes.

Os estilos permanecem parcialmente globais. A migração para escopos de componente
depende de comparação visual por jornada e breakpoint.

O dicionário EN/FR foi separado em `translations.data.ts`; o serviço mantém o
comportamento de localização. Um índice por idioma evita percorrer todo o dicionário
em cada tradução exata, preservando a prioridade PT → EN → FR e o primeiro alias
encontrado. Português continua sendo uma fonte interna legada, não um idioma oferecido
pela interface.

Os 22 métodos de conversão de dados foram movidos para `MarketplaceMapper`, que não
faz HTTP nem altera estado da aplicação. A fachada `MarketplaceService` mantém a API
consumida pelas features. A conversão booleana passou a aceitar apenas representações
explícitas: `true`, `1`, `'1'` e `'true'`.

Foi adotada formatação reproduzível para TypeScript, HTML, SCSS e PHP, com versões
fixadas no lockfile. O CI verifica formatação antes de lint/build. O plugin PHP possui
limitações conhecidas; essa adoção não é uma certificação PSR/PER. Referências:
[instalação do Prettier](https://prettier.io/docs/install) e
[plugin oficial para PHP](https://github.com/prettier/plugin-php).

Durante a validação integrada, foi identificado um problema de precedência ao formatar
uma chamada ao retorno de `require`. O bootstrap foi reescrito para carregar e depois
chamar `$registerRoutes`, explicitamente. Um teste permanente compara a árvore
sintática dos arquivos PHP antes/depois da formatação e roda antes de `npm run format`.
Uma comparação adicional com a versão anterior confirmou equivalência nos 29 arquivos
PHP que só receberam mudanças de apresentação; os arquivos com alterações funcionais
foram examinados e testados separadamente.

### Sessão e fronteira de autenticação

O interceptor agora resolve a URL e compara a origem exata e o caminho da API
configurada. Domínios semelhantes, caminhos como `/api/v10`, outras origens, troca
de protocolo, URLs inválidas e URLs com credenciais não recebem o token. A mesma
regra suporta a origem interna configurada para SSR.

Uma resposta `401` da API pode renovar a sessão e repetir a chamada uma vez. Rejeição
de renovação por autenticação encerra a sessão; falhas de rede/servidor não fazem o
usuário perder a sessão automaticamente. Falhas em serviços externos não acionam
renovação nem navegação para login. Os testes executam o initializer real do
interceptor com dependências controladas.

`SessionRefreshService` passou a respeitar o token de configuração da URL da API.
O armazenamento de preferências/sessão trata também a exceção ao acessar o próprio
objeto de storage, não somente a falha de `getItem`/`setItem`. O access token continua
em memória e o refresh em cookie HttpOnly; nenhum novo armazenamento de segredo foi
introduzido.

### Busca, paginação e ciclo de vida

O catálogo usa `switchMap` para cancelar a requisição anterior quando o filtro muda.
Assim, uma busca lenta não substitui a busca atual. Erros são tratados dentro do
fluxo, permitindo que uma nova busca ou tentativa continue funcionando.

Catálogo e profissionais usam a mesma leitura defensiva de paginação. Valores
fracionários, não finitos ou fora do intervalo não viram páginas válidas.
`mergeUniqueById` remove duplicações tanto contra a lista existente quanto dentro
da nova página.

No checkout, consultas são encerradas ao destruir o componente; timer e formulários
de cartão/entrega são limpos. A ação de conclusão não prossegue para produto sem
estoque. O checkout permanece uma simulação frontal: não envia cartão à API, não
persiste dados financeiros e não executa cobrança.

### Validação e limites da API

`Validator` rejeita obrigatórios nulos, vazios ou formados só por espaços. Continua
aceitando zero e `false` quando válidos, e listas vazias nos contratos que permitem
limpar uma coleção, como regras de disponibilidade.

Inteiros não aceitam booleanos ou floats; números devem ser finitos. Datas devem
usar formatos explícitos de calendário/timestamp. Expressões relativas e datas que
o PHP normalizaria silenciosamente são rejeitadas. Uma regra de validação desconhecida
é erro de programação, não uma permissão silenciosa.

JSON tem limite de 1 MiB, profundidade de 64 níveis e raiz obrigatoriamente objeto.
Listas internas são preservadas. Sintaxe/raiz inválida retorna `400`; corpo acima do
limite retorna `413`. Essa limitação não altera o contrato multipart de avatar.

JWT rejeita timestamps não inteiros e expiração exatamente no instante atual. Emissor,
audiência, tipo, assinatura, sessão persistida e revogação continuam sendo controles
independentes.

### Disponibilidade e reserva

A regra compartilhada `AvailabilityPolicy` é usada pelo catálogo e pela escrita de
reservas. Ela avalia regras semanais, exceções disponíveis e bloqueios; indisponibilidade
tem precedência. Limites adjacentes não geram sobreposição falsa, e a janela deve caber
no mesmo dia de trabalho.

`ScheduleReservationService` exige transação ativa, obtém o lock por profissional/dia,
valida a política e verifica reservas/holds conflitantes. O dia de trabalho é calculado
no fuso configurado do profissional, não no fuso escolhido pelo cliente. Criação
direta, reagendamento e aceite de proposta usam esse serviço.

Os testes HTTP em MySQL comprovaram os casos que motivaram a correção: exceção anunciada
pelo catálogo pode ser reservada; bloqueio prevalece; cliente não contorna horário ao
trocar de fuso; janela cruzando meia-noite é rejeitada; conflito retorna `409`. Isso
complementa os locks, mas não equivale a um ensaio de alta concorrência distribuída.

### Dependências e segurança operacional

A auditoria inicial de dependências de produção encontrou um aviso moderado para
`@angular/ssr` e um crítico para `proxy-addr`. Foram atualizados SSR, CLI e build para
20.3.39 e aplicados patches compatíveis no lockfile, sem `audit fix --force` ou troca
de versão principal. A última auditoria completa, incluindo desenvolvimento, retornou
zero vulnerabilidades conhecidas.

O aviso do Angular afeta um caminho específico do `CommonEngine` no Windows; o projeto
usa `AngularNodeAppEngine`. O servidor Express também não confia indiscriminadamente
em proxy. A presença dos avisos no grafo de dependências não comprova exploração do
site. Fontes primárias:
[advisory do Angular](https://github.com/angular/angular-cli/security/advisories/GHSA-7g7c-h8rr-7p6q) e
[advisory de proxy-addr](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).

Os fluxos que gravam dados agora exigem URL de loopback, porta correspondente ao projeto
Compose selecionado e ambiente `local`/`testing`. A integração foi executada em um
projeto Compose isolado, com banco novo e dados fictícios. Containers foram parados
após os testes; volumes foram preservados.

O overlay de produção foi validado: banco/API/web sem portas publicadas indevidas,
build de produção e ausência do segredo da outbox no frontend. Isso valida configuração,
não a infraestrutura do domínio público.

## Boas práticas: avaliação por camada

| Área | Avaliação atual | Evidência/limite |
| --- | --- | --- |
| Frontend por feature | Adequado ao projeto | Rotas próprias, lazy loading, `core`/`shared` sem dependência reversa de features. |
| Componentes | Mais legíveis e delimitados | Templates maiores externos; limites por bytes/instruções executáveis, não por linhas minificadas. |
| Acesso a dados | Responsabilidades mais claras | Fachada HTTP separada do mapper; contratos públicos preservados. |
| Localização | Dados separados do algoritmo | Índice testado e cobertura EN/FR de frases conhecidas. Conteúdo livre de usuários não é traduzido automaticamente. |
| Estilos | Organizados, ainda parcialmente globais | Módulos e cascata explícitos; comparação visual completa permanece necessária. |
| Backend | Monólito modular, não Clean Architecture integral | Preço/agenda extraídos; outros controllers ainda combinam SQL e orquestração. |
| Persistência | Base consistente | Prepared statements, FKs, unicidades, transações, valores em centavos e migrações versionadas. |
| Segurança | Controles existentes reforçados | Testes de sessão/participação, fronteira de token e validação; não houve pentest externo. |
| Testes/CI | Melhor proteção contra regressões | Formatação, sintaxe, lint, contratos, unitários, SSR, dependências e integração. |
| Operação | Precisa de homologação própria | TLS, segredos, restauração, alertas e fornecedores não são comprovados por build local. |

Os gates de arquitetura verificam templates externos, composição modular do SCSS,
separação do dicionário e uso da política comum de disponibilidade. Os limites de
tamanho são critérios de manutenção, não métricas de desempenho.

## Cobertura e lacunas de teste

A suíte passou de 105 para 127 testes do frontend e de nove para 19 testes centrais
PHP. Os novos casos cobrem fronteira de autenticação, falhas transitórias de sessão,
concorrência de buscas, conversão de DTOs, validação e regras de disponibilidade.

Resultado da versão revisada:

| Verificação | Resultado local |
| --- | --- |
| Formatação e lint de TS/templates | Aprovados. |
| Build Angular de produção | Aprovado, sem aviso de orçamento. |
| Testes do frontend | 127 aprovados, zero falhos, zero ignorados. |
| Cobertura dos utilitários explicitamente selecionados | 17 arquivos; 100% de linhas, funções e ramificações; 49 casos no gate. |
| Localização | 57 templates, 1.292 frases de interface, EN/FR completos no contrato. |
| Estrutura/arquitetura | Aprovadas; 119 registros de rota, 35 tabelas no schema, 22 assets visuais. |
| Núcleo PHP | 19 aprovados, zero falhos. |
| Sintaxe PHP | 38 arquivos válidos. |
| Bundle de produção | Sem senhas de demonstração. |
| SSR | Home, catálogo, detalhe, metadados dinâmicos, idioma, noindex, 404 e rejeição de host aprovados. |
| Auditoria npm completa | Zero vulnerabilidades conhecidas na execução. |
| Compose de produção | Contratos de isolamento/configuração aprovados. |
| Integração PHP/MySQL real | Cinco scripts aprovados, descritos abaixo. |
| Inspeção visual manual atual | Não concluída: a prévia estava indisponível no navegador. |

As integrações exercitaram:

1. Saúde do ambiente, inicialização/migrações e login dos três papéis.
2. Outbox, limite de tentativas, descarte e remoção de payload sensível.
3. Sessões, dispositivos, revogação, refresh por cookie e rotação concorrente de abas.
4. Mensagens, entrega incremental/SSE, idempotência, leitura e isolamento entre participantes.
5. Reserva, exceções de agenda, preços, propostas, execução, avaliação, notificações e administração.

O comando unitário descobre `tests/*.spec.ts`, evitando que um arquivo novo fique fora
da lista executada. Testes de contratos foram adaptados para ler templates e estilos
externos. Uma asserção SSR foi corrigida para aceitar espaços de formatação ao redor
do texto sem relaxar o destino, a semântica ou a presença do CTA.

O percentual de 100% se aplica somente aos utilitários listados no gate. Componentes,
serviços Angular, controllers PHP e as 119 rotas não possuem cobertura integral.
Testes de contrato e doubles precisam ser complementados por E2E em navegador.

Para ampliar a confiança, os próximos testes devem priorizar E2E de browser por papel,
acessibilidade, matriz de preços/estados/permissões, DST/fusos, corrida de propostas,
cancelamento/reagendamento simultâneos, expiração prolongada e erros dos fornecedores.

## Desempenho e interface

O build inicial passou de 946,75 kB para 945,83 kB. O CSS global minificado passou de
243,66 kB para 240,66 kB. A variação não comprova ganho perceptível de velocidade.
O bundle inicial permanece próximo do aviso de 950 kB.

Permanecem lazy loading, imagens responsivas, carregamento por páginas e suspensão da
sincronização de mensagens quando a aba está oculta. Não foram medidos LCP, INP, CLS,
p95 da API ou custo de consultas sob carga; não se declara alcance dessas metas.

Os contratos automatizados protegem aspectos de contraste, layout responsivo, banners,
serviços e fluxo de reserva. A confirmação visual em 390/820/1280 px permanece pendente.
Os registros anteriores em `VISUAL_REVIEW.md` são históricos, não evidência da versão
atual. A prévia mock atual está em `http://127.0.0.1:4313/` enquanto seu processo local
estiver ativo.

## Pendências de homologação

Pendências:

- Fazer a comparação visual atual em celular/tablet/desktop, incluindo EN/FR, teclado,
  leitor de tela, foco, zoom e screenshots. Lint de acessibilidade não certifica WCAG.
- Exercitar alta concorrência e expiração de locks/holds em homologação. Um conflito
  controlado prova o caso testado, não todas as condições de corrida.
- Medir Web Vitals e consultas/API sob carga antes de escolher otimizações adicionais.
- Extrair casos de uso/repositórios dos controllers que ainda concentram SQL e
  orquestração, com testes de contrato para preservar as regras.
- Reduzir gradualmente CSS global/refinamentos após comparação visual. A reorganização
  atual mantém overrides existentes para preservar o layout.
- Homologar TLS, segredos, backup restaurável, rollback de migrações, alertas, retenção
  de dados e entrega do Resend no ambiente real.
- Checkout frontal é demonstração; KYC, MFA administrativo, recorrência, disputas e
  privacidade automatizada permanecem no roadmap. Pagamento real não está implementado.
- Homologar a implantação integrada da API, SSR e banco. Publicação estática de
  demonstração não comprova esses serviços.

## Como repetir a validação

Na pasta `frontend`, execute `npm ci`, `npm run check` e
`npm run test:dependencies`. Na raiz, execute `pwsh -File tests/backend_check.ps1` e
`node tests/production_compose.mjs`. Para os fluxos com banco, use Compose descartável,
`COMPOSE_PROJECT_NAME` e URLs de loopback correspondentes às portas desse projeto.
Os comandos e proteções estão em `tests/README.md`.

Cada validação deve registrar revisão Git, ambiente e comandos executados. Mudanças
posteriores exigem nova execução dos gates afetados.
