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
