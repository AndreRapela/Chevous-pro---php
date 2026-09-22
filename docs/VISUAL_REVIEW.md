# Revisão de proporção, identidade e legibilidade

Revisão das solicitações visuais acumuladas, consolidada em 18/09/2026.

## Diagnóstico

O problema não era um único tamanho global. O CSS acumulava escalas diferentes
para desktop, celular, catálogo e painéis. Algumas regras de dashboard reduziam
texto para 8–12 px, enquanto cabeçalhos e áreas decorativas continuavam grandes.
Além disso, cores verdes literais sobreviviam à troca das variáveis da marca.
As imagens também continham fundos verdes; mudar o CSS não alterava esses pixels.

A marca anterior usava uma arte muito larga com área vazia no SVG: a largura
externa parecia suficiente, mas o nome era renderizado minúsculo. A prévia de
reserva estava posicionada absolutamente e podia invadir o campo de busca.
No celular, a foto era ampliada a 145% e ficava atrás do título; os três pontos
indicavam um carrossel que não existia.

## Critérios adotados

- Fundo amplo único: azul neutro `#eaf1f6`, sem alternância com roxo/rosa.
- Cards brancos, bordas azul-acinzentadas e campos com contorno mais definido.
- Marca vinho `#934037`, com terracota e pêssego apenas em acentos e imagens.
- Texto corrido em 16 px; controles em aproximadamente 14 px; metadados em 13 px.
- Dados das tabelas em 15 px, sem reduzir a informação do painel a uma microescala.
- Categoria com título de 17 px, descrição de 14 px e altura desktop mínima de
  aproximadamente 82 px; ícone de 20 px dentro de uma base de 40 px.
- Grade de profissionais com três colunas no desktop; filtros em coluna separada.
- Hero e perfil compactos, mantendo o espaço necessário para leitura e ações.

## Solicitações atendidas no código

| Solicitação | Solução |
| --- | --- |
| Nome ChezVoust e Pro com abertura fotográfica | Nome tipográfico legível e símbolo SVG compacto, com favicon correspondente. |
| Sem verde na nova identidade | Tokens e cores fixas revisados; hero, login e cadastro com imagens na paleta quente. |
| Fundo azul, sem segunda cor ampla | Hero, categorias, serviços populares, profissionais, etapas e painéis compartilham o mesmo token. |
| Fonte pequena no site e no dashboard | Piso de legibilidade, revisão das regras antigas e tabela/atalhos ampliados. |
| Cards de categoria grandes e ícones pouco claros | Cards reduzidos, nomes maiores e símbolos próprios para cada serviço. |
| Campo de busca encoberto pela reserva | Prévia de reserva em coluna normal do layout, sem sobreposição absoluta. |
| Banner móvel estranho e pontos sem sentido | Texto e foto separados; indicadores falsos removidos. |
| Três profissionais por linha e paginação | Grade de três colunas; paginação real dos resultados preservada. |
| Links do rodapé e opções de teste | Rodapé com navegação e três perfis de demonstração na prévia local/mock; credenciais excluídas do build de produção. |
| Mais avaliações/comentários | Listas de várias entradas com carregamento de páginas adicionais preservadas. |
| Retirar blocos de benefícios e selo sobre a foto | Blocos solicitados não estão mais nos templates públicos. |
| Apenas inglês e francês | Seletor limitado aos dois idiomas; traduções incompletas revisadas. |
| Textos misturados entre idiomas | Tradução respeita palavras completas, sem substituir fragmentos dentro de outras palavras; respostas rápidas seguem o idioma escolhido e e-mails de teste permanecem intactos. |
| Retirar real | Preferência limitada a EUR/USD, padrão EUR; BRL antigo salvo não reaparece. |

BRL permanece somente como moeda-base de registros antigos da API. Os valores
continuam sendo convertidos antes de aparecer em EUR/USD; não foram simplesmente
renomeados. A conversão existente é estimativa de exibição, não cotação em tempo real.

## Assets

As fotografias originais foram preservadas. As variantes novas são JPEGs
responsivos, todas abaixo de 100 KB, em `frontend/public/images/*-warm-*`.

As edições de login e cadastro usaram as fotos existentes como referência.
Instrução de edição: preservar pessoa, rosto, expressão, pose, pele, cabelo,
mãos e ferramentas/bandeja; substituir fundos verdes pela paleta vinho,
terracota e pêssego; roupa verde por carvão, preservando costuras e detalhes;
não acrescentar texto, marcas ou pessoas. O hero utiliza a variante quente
correspondente já produzida nesta revisão.

## Publicação

O deploy público permanece cancelado conforme a última instrução específica.
Build e atualização da prévia local são independentes do deploy público.

## Verificação

- `npm run check`: lint, build de produção, inspeção do bundle, 24 testes unitários,
  estrutura e testes de SSR aprovados. O bundle não contém as senhas de demonstração.
- `npm run test:coverage`: 22 testes aprovados; 100% de linhas, funções e ramificações
  nos utilitários selecionados por esse comando, incluindo o novo utilitário de tradução.
- Revisão visual em desktop de 1280 px, tablet de 768 px e celulares de 390/320 px,
  incluindo home, login, cadastro, listagem, perfil público e painéis dos três papéis.
- Nas telas auditadas, nenhum texto visível de folha abaixo de 13 px; sem overflow
  horizontal da página nos tamanhos conferidos. O viewport temporário foi restaurado.
- No tablet, o banner passou de aproximadamente 557 px para 224 px; a imagem agora
  fica contida no card, sem determinar sua altura pela proporção natural da foto.
- Na home desktop, busca termina em aproximadamente 366 px e a prévia de reserva
  começa em 410 px: as duas áreas não se sobrepõem.
- Hero, categorias, serviços populares e etapas medidos com o mesmo fundo
  `rgb(234, 241, 246)`, correspondente a `#eaf1f6`.
- Categorias desktop: aproximadamente 82 px de altura, nomes de 17 px e metadados
  de 14 px. A grade de profissionais tem três colunas, sem inventar perfis para
  completar uma linha quando uma busca retorna menos de três.
- Paginação mock conferida: primeira página com três resultados; próxima página
  com os dois restantes; a página 2 também é preservada após recarregar a URL.
- Paginação da API real local também conferida: quatro perfis retornados no total,
  três na página 1 e o quarto na página 2, com URL `?pagina=2`.
- Perfil público mock: três avaliações e dois comentários, em listas de duas
  colunas no desktop. O carregamento de páginas adicionais continua disponível.
- Seletor conferido em EN/FR, com atualização para `fr-FR`; moedas disponíveis
  somente EUR/USD. A preferência foi restaurada para inglês/EUR.
- Resposta rápida testada apenas na API mock local: mensagem enviada em inglês,
  sem comunicação com usuários reais ou serviços externos.
- Fotos de autenticação conferidas na paleta quente e com fonte responsiva de
  resolução adequada; originais preservados.
- Logo e favicon receberam URLs versionadas: o Nginx mantém SVGs em cache por
  30 dias, e isso podia mostrar a marca anterior mesmo após reconstruir o frontend.
- Dados reais com títulos longos revelaram que a coluna interna automática do
  card podia exceder a borda. O track interno agora usa `minmax(0, 1fr)` e
  respeita a largura disponível; nomes próprios não passam pela tradução.
- Conferência final desses cards na porta 4200: largura e `scrollWidth` iguais
  a 321 px nos três cards, com conteúdo interno de aproximadamente 290 px;
  sem transbordamento do título ou botão para o card vizinho.
- Frontend e SSR reconstruídos e atualizados em 4200. HTML, CSS/JavaScript
  servidos correspondem ao novo build; home e health da API retornam HTTP 200.
  Apenas `web` e `ssr` foram recriados; API, worker, banco e volumes preservados.
  A prévia mock de testes continua em 4300.

## Ajustes adicionais de espaçamento e escala

- Cabeçalho público: navegação centralizada, com 32 px entre links; conta e
  seletor separados por 20 px, em vez dos 7,2 px anteriores. Em larguras menores
  que 1216 px, o menu recolhe sem apertar os links; todos os destinos principais
  também estão disponíveis nesse menu.
- Cabeçalho do painel: notificações, idioma, identidade e saída separados por
  20 px no desktop. Avatar e nome permanecem agrupados. No celular estreito,
  os controles usam a largura disponível, sem comprimir o rótulo francês de saída.
- Nomes e preços dos cards: 17 px e peso 800. No histórico do cliente, nome
  do profissional e preço passam a 16 px e negrito; código e data mantêm
  hierarquia secundária.
- Reserva: título principal entre 24 e 28,8 px; títulos internos de 18 px.
  O bloco de ações deixa de esticar até a altura do resumo. Nome e total em
  negrito; as definições não carregam mais o recuo padrão do navegador.
- Traduções completas adicionadas para reservar novamente, horário confirmado
  e validade das propostas. Respostas rápidas e estados de sincronização do
  chat usam a tradução ativa diretamente no componente.
- Chat: texto de 15 px, horário de 13,12 px e padding vertical de 8 px nos
  balões. A seção desktop passa de 736 px fixos para uma altura responsiva de
  480 a 608 px; na janela de teste ficou em 496 px.
- Botão de acesso à conta com altura mínima de 48 px e padding maior; frase
  de apresentação no rodapé em negrito.
- Mensagens, endereços, nomes próprios e instruções escritos pelos usuários
  são preservados. A tradução da interface não reescreve conteúdo pessoal.
  A instrução fictícia do perfil de demonstração foi atualizada para inglês.
- `npm run check` aprovado novamente: lint, build, bundle sem credenciais de
  demonstração, 24 testes unitários, estrutura e renderização SSR.
- Verificação adicional em 320, 1024, 1216 e 1280 px. Cabeçalho francês sem
  login manteve 63 px entre navegação e ações em 1216 px, sem transbordamento.
  No chat móvel selecionado, os comandos terminam em aproximadamente 707 px,
  acima da navegação inferior que começa em 761 px.
- A prévia mock foi reiniciada com `--hmr=false`: ela ainda apresentava o
  template anterior do botão de conversas apesar de servir o chunk atualizado.
  Após o reinício, a nova seta e o rótulo acessível foram conferidos no DOM.
- Build final local em 4200: `styles-NKRN4KL3.css` e `main-TQLFBYJM.js`, iguais
  aos arquivos validados pelo check. Seletor em EN/EUR; cards reais com largura
  e `scrollWidth` iguais a 321 px, nomes e preços em negrito, sem transbordamento.
  Apenas `web` e `ssr` atualizados; deploy público permanece cancelado.

## Continuação: cobertura de idioma e propostas

- Corrigido o formulário de propostas: o rótulo e o valor editável agora usam
  a preferência EUR/USD, assim como a referência exibida no card. O envio
  converte o valor para a moeda original da solicitação; os dados históricos
  em BRL não foram reescritos. Conversões continuam sendo referências fixas,
  não taxas de liquidação nem cobranças pela plataforma.
- Valores sugeridos mantêm os centavos originais quando não foram editados,
  mesmo que a exibição tenha arredondamento. Valores inválidos são rejeitados
  e o formulário bloqueia um segundo envio enquanto o primeiro está em andamento.
- Limites do formulário alinhados ao `ProviderController::createOffer`: mínimo
  de 1.000 e máximo de 10.000.000 centavos na moeda da solicitação, convertidos
  para os limites do input EUR/USD. A tela antes aceitava 100 centavos, que a API
  recusaria. Os testes cobrem esses limites sem criar propostas no banco.
- Agenda: “Início” foi substituído por um rótulo contextual de horário, evitando
  a tradução incorreta como “Home”. Dias da semana, confirmações e bloqueios
  receberam traduções completas. `data-label`, usado nos cabeçalhos móveis
  das células, passou a fazer parte dos atributos localizados.
- Completadas traduções de confirmações de reserva, estados de carregamento,
  avaliações, campos de perfil, ações administrativas e metadados das rotas.
  O plural dos comentários usa palavras completas, sem acrescentar um “s” a
  uma palavra já traduzida. O identificador Open Graph agora é EN/FR, não pt_BR.
- Nomes próprios, endereços, comentários, instituições e motivos informados
  pelos usuários são preservados nos trechos alterados; não há reescrita
  desse conteúdo no banco. O endereço novo tem uma identificação inicial
  no idioma selecionado, em vez de “Casa” em português.
- No painel administrativo, a troca de idioma também atualiza datas e valores
  carregados. O fallback de profissional ainda não definido é localizado antes
  de preservar o restante da célula de nomes, evitando português nesse estado.
- Novo `npm run test:localization`: análise dos 53 templates Angular e de
  configurações, feedbacks e rotas, cobrindo 1.079 textos/fragmentos de interface.
  Valida EN/FR, frases com números e preferências antigas PT/BRL, inclusive
  quando o armazenamento está indisponível. A checagem é parte de `npm run check`.
- `npm run check` aprovado: lint, build, bundle sem credenciais de demonstração,
  36 testes unitários, cobertura de idioma, estrutura e renderização SSR.
  Os testes de propostas usam um cliente gravador local, sem enviar ofertas reais.
- `npm run test:coverage`: 30 testes aprovados e 100% de linhas, funções e
  ramificações nos utilitários selecionados, incluindo as conversões de referência.
- O HTML SSR também passa pela localização ao terminar a renderização, antes
  da serialização. Textos e atributos da interface saem em inglês, sem depender
  do JavaScript do navegador. A árvore de nós, comentários de hidratação,
  conteúdo pessoal, scripts e valores dos campos são preservados. Frases de
  paginação já renderizadas em inglês também podem mudar para francês.
- Limite desta continuação: o canal nativo do controle visual estava indisponível.
  Não foi realizada uma nova conferência visual no navegador; os resultados acima
  vêm da análise de código e dos testes automatizados. As medições visuais das
  seções anteriores pertencem às revisões anteriores, não a esta continuação.
- Deploy público permanece cancelado; somente a atualização local foi autorizada.
- Build local final: `main-PNFBCBO3.js` e `styles-NKRN4KL3.css`. Os 37 arquivos
  JavaScript/CSS servidos em 4200 tiveram SHA-256 idêntico ao build validado.
  Home e health da API retornaram HTTP 200. O serviço SSR local também confirmou
  o texto do hero em inglês, sem o texto original em português.
  Apenas `web` e `ssr` foram recriados; IDs da API, banco e worker permaneceram
  os mesmos. Nenhum dado ou volume foi removido.
- Detectada e corrigida uma falha do proxy local: `X-Forwarded-For` e
  `X-Forwarded-Uri` eram encaminhados ao SSR, mas não faziam parte dos
  cabeçalhos confiáveis do Angular. Isso devolvia um HTML CSR vazio, embora
  o serviço SSR isolado funcionasse. Esses dois cabeçalhos são agora removidos
  no encaminhamento; host/protocolo continuam sobrescritos pelo Nginx e o IP
  do cliente mantém seu canal separado `X-Client-IP`. Não foi ampliada a lista
  de cabeçalhos confiáveis. O teste HTTP `frontend/tests/proxy-rendering.mjs`
  confere a página renderizada e os metadados, também com cabeçalhos falsificados.
- Conferência final do proxy aprovada em 4200, tanto na requisição normal como
  com os dois cabeçalhos falsificados: HTML SSR, hero em inglês e `og:locale=en_US`.
  `nginx -t` também aprovado. A API, o banco e o worker continuam com os mesmos IDs.

## Continuação: consistência dos preços e da imagem de compartilhamento

- A imagem padrão de Open Graph/Twitter ainda apontava para o asset antigo.
  Agora usa a mesma foto de paleta quente do hero, preservando os arquivos
  originais. O teste SSR verifica os dois metadados; o teste do proxy também
  confere a URL e a disponibilidade do JPEG atual.
- Corrigido o preço personalizado nulo retornado pela API: significa usar o
  preço do catálogo, mas `Number(null)` o transformava em zero. A normalização
  agora trata esse fallback antes da conversão numérica, tanto na listagem
  como na resposta de atualização. Não altera os registros do banco.
- O formulário do profissional preserva os centavos originais ao salvar um
  preço arredondado sem editá-lo, inclusive ao apenas desativar o serviço.
  Preços realmente editados continuam convertidos para a moeda de origem da API.
- Mínimos e máximos exibidos são calculados por uma função compartilhada com
  tolerância de ponto flutuante: o mínimo do profissional em EUR é 1,70,
  não 1,71 por erro de arredondamento. A proposta reutiliza a mesma função.
- Limites confirmados nos controladores PHP: profissional/proposta,
  1.000–10.000.000 centavos; criação do catálogo administrativo,
  100–10.000.000 centavos. Os campos agora têm mínimo/máximo correspondentes
  em EUR/USD. A criação administrativa também valida os centavos antes de
  chamar a API. Foram adicionadas as mensagens necessárias em EN/FR.
- `npm run check` aprovado: lint, build, bundle de produção, 47 testes,
  cobertura de 1.080 textos/fragmentos nos 53 templates, estrutura e SSR.
  Os testes compilam os métodos reais dos formulários com APIs gravadoras
  locais; nenhuma proposta, serviço ou alteração real foi enviada.
- `npm run test:coverage` aprovado: 100% de linhas, funções e ramificações
  nos utilitários selecionados, incluindo a normalização de preços e os limites.
  Não representa cobertura de 100% da aplicação inteira.
- O canal nativo do Computer Use continua indisponível (`os error 2`).
  Esta continuação não contém uma nova inspeção visual no navegador;
  as verificações realizadas são de código, testes e HTTP.
- Build validado: `main-FF4QWEE4.js`; CSS permanece `styles-NKRN4KL3.css`.
  O deploy público continua cancelado.
- Atualização local concluída em 4200: os 37 arquivos JS/CSS servidos têm
  SHA-256 idêntico ao build validado e o HTML aponta para as entradas atuais.
  O teste do proxy passou nas requisições normal e com cabeçalhos falsificados,
  incluindo metadados da paleta atual e JPEG acessível. Health da API HTTP 200.
  Apenas `web` e `ssr` foram recriados; API, banco e worker mantêm seus IDs.

## Continuação: contraste dos campos e prioridade dos metadados

- Revisitado o pedido de bordas visíveis sobre o fundo neutro. A borda anterior
  `#c3a49a` tinha contraste de 2,02:1 contra o azul `#eaf1f6`; agora usa
  `#9b776e`, com 3,50:1. Campos de busca têm uma borda externa única, sem
  uma segunda caixa de fundo dentro do input.
- O texto secundário `--ink-500` passou de `#8a7168` para `#755a51`:
  o contraste sobre o azul aumentou de 3,97:1 para 5,52:1. Placeholders usam
  essa cor com opacidade 1. Não houve aumento de cards ou alteração de margens.
- O indicador de foco usa vinho opaco nas superfícies claras, em vez do
  contorno âmbar pouco contrastante, e branco nos blocos escuros do hero/autenticação.
  Campos de busca sem borda própria têm foco no contêiner.
  As cores foram verificadas contra os critérios de
  [contraste de componentes](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html)
  e [contraste de texto](https://www.w3.org/TR/WCAG22/#contrast-minimum).
  Esses cálculos não constituem uma certificação WCAG da aplicação inteira.
- Identificado um conflito entre a atualização geral das rotas e o SEO das
  páginas carregadas. `updateRoute` agora preserva o título, URL canônica,
  JSON-LD e `noindex` específicos da página atual. Ao navegar para outra
  rota ou consulta, o estado antigo é descartado.
- Metadados já compostos podem desativar a retradução de seu conteúdo.
  Categorias/serviços continuam localizando os textos da plataforma;
  nomes, biografias, títulos pessoais e avaliações dos profissionais são
  preservados nos metadados, assim como no conteúdo protegido da interface.
- Corrigidos os nomes de WebSite/Organization no JSON-LD para `ChezVoust Pro`.
  O título genérico do catálogo é localizado antes de ser marcado como composto.
- Novos testes de contraste da paleta/seletores e dos métodos reais de SEO.
  A suíte unitária final passou com 58 testes; a cobertura de idioma continua com
  1.080 textos/fragmentos dos 53 templates em EN/FR.
- A inspeção visual pelo Computer Use foi tentada novamente, mas o canal
  nativo retornou `os error 2`. Não foi realizada uma nova medição visual
  no navegador. Os resultados de contraste são cálculos das cores declaradas.
- Deploy público continua cancelado.

### Validação final desta continuação

- `npm run check` final aprovado: lint, build, bundle sem senhas de demo,
  58 testes unitários, cobertura EN/FR, estrutura e SSR. O teste SSR usa uma
  API HTTP local de teste, exclusivamente de leitura, e confirmou categoria
  carregada, URL canônica específica, nome da marca e `noindex` da busca.
- Build final atualizado em 4200: `main-V7JPKZUB.js` e `styles-WLBZE3H2.css`.
  Os 37 arquivos JS/CSS servidos têm SHA-256 idêntico ao build validado;
  o HTML aponta para as entradas atuais e a API respondeu HTTP 200 no health.
- O teste do proxy real passou para home normal/com cabeçalhos falsificados,
  nomes de WebSite/Organization, foto atual e busca filtrada com `noindex`.
  `nginx -t` aprovado.
- Apenas `web` e `ssr` foram recriados. API `59b02e09ca73`, banco
  `b81e16ed1b76` e worker `7509bfe83e48` continuam com os mesmos IDs.
  Nenhum dado, reserva, mensagem ou volume foi alterado/removido pelos testes.

## Correção solicitada: card do herói apenas com serviços

- A faixa inferior da home desktop misturava promoção, atalhos e uma reserva
  fictícia de Ana Clara. Removidos os dois painéis e o título visual adicional:
  agora há um único card com Cleaning, Laundry, Repairs e Painting.
- Os quatro atalhos mantêm seus ícones e destinos de busca, em colunas iguais,
  com nomes de 16px em negrito, espaçamento interno curto e hover discreto.
  A navegação tem nome acessível traduzido e os ícones são decorativos.
- Removidas também as regras CSS antigas que reservavam largura/altura para
  os painéis; não foram alterados a foto, a busca nem o herói móvel.
- Inspeção real pelo navegador disponível nesta etapa: a faixa antiga tinha
  226,55px de altura em viewport de 1280px; o novo card tem 77,97px. Os quatro
  links têm a mesma posição vertical e aproximadamente 271px de largura.
- Conferido francês em 1024px: Ménage, Linge, Réparations e Peinture cabem
  sem corte, overflow horizontal ou sobreposição. O card mantém 77,97px de
  altura e fica aproximadamente 32px abaixo da busca. Em 390px, a busca
  móvel permanece visível e o card desktop fica oculto, sem overflow horizontal.
- Foco de teclado conferido no navegador: Tab alcança o atalho Laundry com
  contorno vinho sólido de 3px. Idioma original EN e viewport padrão restaurados.
- `npm run check` aprovado: lint, build, bundle, 59 testes unitários, cobertura
  EN/FR de 1.069 fragmentos dos 53 templates, estrutura e SSR. A redução dos
  fragmentos corresponde aos textos dos painéis removidos.
- Os testes SSR e do proxy real em 4200 agora verificam os quatro links, nomes,
  destinos, SVGs e ausência dos painéis removidos. O teste estrutural antigo
  que exigia espaço para a reserva fictícia foi substituído pelo novo contrato.
- Build local atualizado: `main-DRZGSHDF.js` e `styles-ZBI3WVJV.css`.
  Deploy público permanece cancelado; banco, API e worker não foram recriados.

## Ajuste solicitado: convite para profissionais na escala do site

- Medição inicial real em 1280px: card com 153,88px de altura, benefícios de
  13,12px e botão com fonte de 14,4px/altura de 41,59px. O título já estava
  próximo dos demais títulos da home; o desnível principal era nos benefícios.
- Benefícios e botão agora usam 16px, com espaçamento de 12px entre as ações.
  O botão tem altura mínima de 48px, sem alterar seu destino de cadastro.
  No desktop, a descrição passa a 17px, o título cresce discretamente para
  35,84px em 1280px e o card tem 32px de espaço interno/altura mínima de 192px.
- A borda neutra segue os demais cards. Mantidos o acento vinho, o fundo azul
  da página e o fundo discreto do próprio convite. Nenhum elemento de outras
  seções foi ampliado. Removidas as regras antigas que comprimiam este bloco.
- Duas colunas somente a partir de 1024px; abaixo disso, conteúdo e ações
  ficam em uma coluna. Não há altura fixa nem recorte por `overflow: hidden`.
  A seção ganhou nome acessível pelo título e os checks são decorativos.
- Conferência no navegador: EN em 1280px, FR em 1024px, 768px e 390px.
  Sem corte de texto ou overflow horizontal nos tamanhos conferidos. Em FR,
  o card cresce naturalmente para 204,67px/301,09px/331,36px, respectivamente.
  O botão mantém fonte de 16px e altura de 48px no celular. Idioma EN e viewport
  padrão de 1280px foram restaurados ao final.
- `npm run check` aprovado: lint, build, bundle, 60 testes unitários, cobertura
  EN/FR completa, estrutura e SSR. Adicionadas regressões da escala e do card
  flexível; SSR e proxy verificam título acessível, benefícios, checks e link.
- Novo build em 4200: `main-SGBNDPN2.js` e `styles-B4TVTLPB.css`; os 37 arquivos
  JS/CSS servidos têm SHA-256 idêntico ao build validado. Proxy e `nginx -t`
  passaram; health da API respondeu HTTP 200.
- Atualizados apenas web/SSR. IDs da API, banco e worker permaneceram os
  mesmos, sem mutações de dados ou volumes. Deploy público continua cancelado.

## Ajuste solicitado: perfil do profissional mais compacto

- Alterações restritas a `cvp-provider-detail`: avatar de 52px, nome entre
  26 e 30px, margens menores entre descrição, avaliação e selos, e cards com
  16px de espaço interno. O texto de leitura permanece em 16px; não foram
  reduzidas as fontes de outras páginas nem o convite da home.
- Medição real em EN/1280px: cabeçalho de 203,05px para 154,94px; início dos
  cards de 319,05px para 254,94px; card de apresentação de 212,30px para
  182,95px. Mais serviços aparecem na primeira tela sem retirar informações.
- Corrigido o esticamento do agendamento pelo grid: o painel estava com
  2.123,86px de altura devido à coluna de avaliações. Com `align-self: start`,
  tem altura natural de 280,53px e mantém os dois botões. Após rolar 468px,
  fica em 108px do topo, abaixo do cabeçalho, sem aumentar de altura.
- No celular, ativado o grid de duas colunas já previsto para os selos,
  que antes permanecia flex e produzia quatro linhas de largura inteira.
  Mantidos o agendamento móvel, os destinos e todos os dados do profissional.
- Conferência real em EN/1280px e FR/1024px e 768px: sem overflow horizontal.
  Em 768px, o conteúdo passa para uma coluna e o painel desktop fica oculto,
  preservando as ações móveis existentes.
- FR/390px: selos em duas colunas de 167,91px e duas linhas, com altura
  total de 91,09px em vez de 162,31px; cabeçalho de 258,53px em vez de
  329,75px. Em 320px, nome e selos quebram linhas sem overflow ou invasão
  da ação de favoritos. Idioma EN e viewport padrão de 1280px restaurados.
- `npm run check` final aprovado: lint, build, bundle, 61 testes unitários,
  cobertura EN/FR completa, estrutura e SSR. O contrato CSS passa a ignorar
  comentários de linha do Sass, além de comentários de bloco.
- Build em 4200: `main-SGBNDPN2.js` e `styles-TSDGR52M.css`; proxy e
  `nginx -t` aprovados. A primeira checagem do proxy ocorreu durante a
  inicialização do SSR e retornou 502; após carregar, a repetição passou.
- Apenas web/SSR atualizados; API, banco e worker mantidos, sem alterações
  de registros ou volumes. Deploy público permanece cancelado.

## Ajuste solicitado: harmonia de cores ao redor da foto da home

- Mantida a foto autorizada e a cor azul neutra da página. Alteradas somente
  as formas decorativas do herói desktop, sem mexer em dimensões ou posições.
- A base passa do gradiente laranja/marrom para `--brand-600`/`--brand-700`,
  aproximando-se do vinho da foto e dos botões. O círculo pequeno repete
  `--brand-700`; os círculos maiores usam `--brand-200` e `--brand-400`,
  em tons suaves da mesma escala. Bordas também usam `--brand-200`.
- Não houve edição dos pixels da pessoa, de sua roupa ou dos produtos,
  nem alteração das fotos de login/cadastro ou do banner móvel.
- `npm run check` aprovado: lint, build, bundle, 62 testes unitários,
  cobertura EN/FR completa, estrutura e SSR. Adicionada regressão das cores
  decorativas e da permanência do azul neutro.
- Inspeção real em 1280px: base renderizada de `rgb(173, 81, 68)` para
  `rgb(147, 64, 55)`; círculos em `rgb(147, 64, 55)`, `rgb(220, 154, 130)`
  e `rgb(233, 201, 184)`. Sem alteração de posição, altura ou overflow.
- Build em 4200: `main-SGBNDPN2.js` e `styles-FRH4ZWT3.css`; 37 arquivos
  JS/CSS idênticos ao build validado. Proxy, `nginx -t` e health HTTP 200
  aprovados. Apenas web/SSR atualizados; deploy público continua cancelado.

## Ajuste solicitado: variação discreta no fundo superior

- Apenas o `hero-section` recebe `--hero-background: #dce9f1`, um azul
  levemente mais fechado que o fundo geral `#eaf1f6`. Não foi introduzido
  roxo e as demais seções continuam no azul neutro anterior.
- A diferença de luminância é intencionalmente pequena: razão inferior a
  1,1:1 entre os dois fundos. Limites de inputs, foco e texto continuam
  dentro dos contratos de contraste existentes também sobre a nova cor.
- Conferência real em 1280px: topo `rgb(220, 233, 241)` e seção seguinte
  `rgb(234, 241, 246)`, encontrando-se exatamente em 506,64px. Não há
  overflow horizontal; o card branco de atalhos preserva sua separação.
- `npm run check` aprovado com 62 testes unitários, EN/FR completo, estrutura
  e SSR. Build em 4200: `main-SGBNDPN2.js` e `styles-VZRKHDTZ.css`; proxy,
  `nginx -t`, health HTTP 200 e os 37 arquivos JS/CSS aprovados. Somente
  web/SSR atualizados; banco, API e worker mantidos. Deploy segue cancelado.

## Segunda redução solicitada: identidade do profissional

- O topo da página pública agora funciona como uma identificação compacta,
  não como um segundo herói: avatar de 40px, nome de 20–22px, descrição e
  avaliação agrupadas, com favoritos preservado como alvo de toque de 42px.
- Em EN/1280px, o cabeçalho passou de 154,94px para 66,38px de altura e o
  primeiro card começa em 162,38px. Os quatro selos ficam em uma única faixa
  lateral, sem sobrepor o perfil ou aumentar a largura do documento.
- Entre 672px e 895px, o nome permanece inteiro e os selos ocupam uma faixa
  fina logo abaixo da identidade. Em 768px, o cabeçalho mede 128,75px e todos
  os quatro selos ficam visíveis, sem overflow horizontal na página.
- No celular, os selos continuam em uma única linha rolável dentro do próprio
  componente. Em 390px, a página mantém 375px de largura de conteúdo, sem
  rolagem horizontal global; todos os dados também permanecem no resumo.
- `npm run check` aprovado: lint, build, bundle, 62 testes unitários, cobertura
  EN/FR completa, estrutura e SSR. O teste visual cobre densidade, contenção
  dos selos e o painel de agendamento com altura natural.
- Build local em 4200: `main-SGBNDPN2.js` e `styles-4YYPI5UC.css`; `nginx -t`
  aprovado. Apenas web/SSR foram recriados; API, banco e worker mantiveram os
  mesmos containers. Deploy público continua cancelado.

## Compactação da página completa do profissional

- A redução deixou de se limitar ao cabeçalho: o conteúdo agora usa um limite
  de 66rem, coluna lateral de 16rem, intervalo de 14px e cards com 12px de
  espaço interno. Títulos internos ficam em 16px e o texto de leitura em 15px.
- Em EN/1280px, a altura do documento passou de 1.337px para 1.059px. A coluna
  principal caiu de 899px para 641px, sem remover perfil, serviços, avaliações,
  comentários ou ações de contratação.
- Os três serviços continuam dentro de um único card, mas passam a três colunas
  no desktop. O card foi de 271,88px para 130,77px. Em tablet e celular volta
  automaticamente para uma coluna, preservando descrições e destinos.
- O resumo passou de 182,95px para 162,47px; avaliações de 184,08px para
  147,88px; comentários de 224,08px para 176,02px. O painel lateral foi de
  280,53px para 246px e mantém os dois botões com alvos confortáveis.
- Conferência real em 1280px, 768px e 390px: sem overflow horizontal global.
  O painel lateral some nos breakpoints existentes e a barra móvel permanece.
- `npm run check` aprovado: lint, build, bundle, 62 testes unitários, cobertura
  EN/FR completa, estrutura e SSR. Build local: `main-SGBNDPN2.js` e
  `styles-XW6TZ53T.css`; `nginx -t` aprovado. Somente web/SSR atualizados;
  deploy público continua cancelado.

## Padronização final dos layouts e card lateral do perfil

- A identificação do profissional, a avaliação, as métricas, os selos e a
  disponibilidade foram organizados em uma coluna lateral de cards no desktop.
  Em tablet e celular, a mesma informação vira o primeiro card da página, sem
  perder dados nem criar uma coluna vazia.
- O grid lateral só é ativado a partir de 1024px. A largura intermediária de
  960px foi conferida com uma coluna integral; em 390px, as três métricas ficam
  em uma faixa compacta e a página não tem overflow horizontal.
- A home passou a ter um `h1` real no hero desktop. A hierarquia da página de
  serviço, das reservas e dos painéis foi normalizada para que títulos internos
  não disputem destaque com o título da página.
- Agenda profissional, tabelas administrativas e troca de etapas da reserva
  receberam contenção e regras móveis específicas. Ao avançar ou voltar no
  formulário, o novo título recebe foco e fica abaixo do cabeçalho fixo.
- Os símbolos tipográficos dos painéis foram substituídos por um conjunto
  vetorial único, usado na barra lateral e na navegação inferior.
- Traduções dinâmicas foram completadas para verificação de e-mail,
  notificações, catálogo, reserva, quantidades e favoritos. A auditoria cobre
  também os textos passados ao shell de autenticação.
- Conferência visual real realizada em 1280px, 960px e 390px para home,
  profissionais, perfil, serviço, agenda, reserva, mensagens e catálogo.
  `npm test`, `npm run lint` e `npm run build` aprovados; 62 testes unitários,
  54 templates e 1.085 fragmentos de interface EN/FR verificados.
- Nenhum deploy foi executado. A prévia usada nesta etapa permaneceu apenas em
  `127.0.0.1:4300`, conforme o cancelamento do deploy.
