# ChezVoust Pro — produto atual e visão profissional

> Estado reconciliado em 19 de agosto de 2026. Este documento separa o núcleo entregue,
> o modo de demonstração e o roadmap. A visão permanece ampla; apenas capacidades com
> suporte no código são apresentadas como disponíveis hoje.

## Visão

ChezVoust Pro é um marketplace brasileiro, web responsivo e mobile-first, para conectar
clientes a profissionais de serviços domésticos. A experiência combina descoberta,
preço transparente, reserva, agenda e relacionamento dentro de uma identidade própria.

As referências visuais fornecidas orientam composição, paleta e hierarquia. A capa
usa uma foto da profissional editada a partir da referência autorizada pelo usuário; os demais elementos usam
tipografia, CSS, símbolos e avatares por iniciais.

## Três camadas de produto

### 1. Núcleo implementado

Existe código de frontend, API e banco para:

- landing page, catálogo, promoções textuais e profissionais;
- cadastro, login, sessão rotativa, logout, verificação e recuperação na API;
- endereços de cliente;
- estimativa autoritativa no servidor com preço fixo, por hora ou por área e adicionais,
  sem cobrança, cupom, taxa ou comissão da plataforma;
- reserva direta e solicitação ao marketplace;
- proposta do prestador e aceite do cliente;
- bloqueio de agenda, histórico básico e estados de reserva;
- favoritos, conversas de texto, notificações, comentários de comunidade e avaliação verificada;
- foto de perfil, dados pessoais, vitrine profissional, experiências, cursos, serviços, disponibilidade, jobs e oportunidades do prestador;
- métricas e operações administrativas básicas de usuário, aprovação de perfil,
  catálogo, promoção e auditoria.

“Implementado” descreve a existência do fluxo no código; não substitui a validação final
de concorrência, segurança, acessibilidade, desempenho e navegadores.

### 2. Modo demonstração

- `npm start` usa `MockApiService` por padrão para navegação sem API.
- O build de container usa a API PHP real.
- E-mail usa outbox/driver de log no desenvolvimento e Resend na configuração de produção.
- Quando uma tela apresenta fallback sem endpoint correspondente, ela deve trazer rótulo
  visível de “Demonstração” e não simular confirmação operacional silenciosamente.
- Dados do seed e mock são fictícios e existem somente para desenvolvimento.

### 3. Roadmap

Não estão prontos hoje: KYC/documentos, upload, mapas, SMS/WhatsApp, seguro,
recorrência automática,
disputa/ticket, privacidade automatizada, múltiplos papéis por conta, PWA e aplicativo de
loja. Esses itens preservam a evolução profissional sem criar promessa de disponibilidade.

## Perfis atuais e futuros

| Perfil | Estado atual |
| --- | --- |
| Visitante | Implementado no frontend público e catálogo da API. |
| Cliente | Papel `customer`; autenticação, endereços, reservas e relacionamento no núcleo. |
| Prestador | Papel `provider`; perfil, serviços, disponibilidade, jobs e propostas no núcleo. |
| Administrador | Papel `admin`; dashboard e operações administrativas básicas. |
| Suporte especializado | Roadmap; não existe papel separado nem módulo de ticket/disputa. |

Cada conta possui hoje um único papel. A combinação cliente + prestador na mesma conta
exige mudança futura do modelo de autorização.

## Catálogo demonstrativo real

O seed contém sete categorias ativas:

1. Limpeza.
2. Lavanderia.
3. Reparos.
4. Pintura.
5. Montagem.
6. Jardinagem.
7. Organização.

Os serviços demonstram três modelos de preço: fixo, por hora e por área. Mudanças,
transportes e cuidados com animais não fazem parte do catálogo atual; podem ser avaliados
futuramente sob regras comerciais e de segurança adequadas.

## Jornadas disponíveis

### Experiência pública

- landing page de chamariz com proposta de valor, categorias, promoção textual,
  profissionais recomendados, benefícios, FAQ e CTA;
- catálogo por categoria e texto;
- busca de profissional por serviço, cidade, estado e nota na API;
- perfil público com região, oferta, foto, experiência, cursos, comentários de comunidade e avaliações verificadas, sem contato ou endereço exato;
- páginas informativas de funcionamento, segurança, ajuda, termos e privacidade;
- layouts responsivos baseados em CSS, sem fotografia obrigatória.

Filtros por data, distância real, preço e slots livres permanecem parciais/roadmap. A
aprovação operacional do perfil não deve ser rotulada como “identidade verificada”.

### Cliente

No núcleo atual, o cliente pode:

1. cadastrar-se, entrar e manter sessão;
2. salvar endereço;
3. escolher serviço, tamanho/quantidade, data, horário e profissional;
4. solicitar estimativa calculada pelo backend;
5. criar reserva direta ou publicar pela interface uma solicitação para propostas;
6. acompanhar reservas e usar as ações existentes de cancelar e avaliar;
7. favoritar profissional, conversar pelo fluxo web e abrir o destino das notificações;
8. consultar histórico básico.

Recorrência automática, materiais, política versionada de cancelamento,
confirmação bilateral, disputa e suporte são roadmap.

### Prestador

No núcleo da API, o prestador pode:

1. cadastrar perfil inicial sujeito a aprovação operacional;
2. atualizar foto, dados pessoais, apresentação, cidade, estado e raio informativo;
3. cadastrar experiências profissionais e cursos/certificados exibidos na vitrine pública;
4. ativar serviços e definir preço;
5. definir regras semanais de disponibilidade;
6. consultar dashboard e jobs;
7. consultar solicitações compatíveis por serviço;
8. enviar ou retirar proposta;
9. iniciar e concluir reservas autorizadas.

Área geográfica com cálculo de distância, documentos, verificação de identidade, conta
bancária, saldo, extrato e repasse são roadmap. Números exibidos sem fonte de API devem
ser identificados como demonstração.

### Administração

O núcleo administrativo da API oferece:

- métricas agregadas;
- listagem e suspensão/reativação de usuários;
- fila e decisão de aprovação operacional de prestadores;
- criação/edição básica de categorias e serviços;
- gestão de promoções textuais;
- consulta de reservas, moderação de conteúdo e auditoria.

Relatórios exportáveis, documentos, suporte, disputas e permissões granulares são
roadmap.

## Regras que o produto já assume

- Valores de reserva são recalculados pelo servidor e congelados em snapshot.
- Valores de referência trafegam em centavos e não há coleta de dados de pagamento.
- Reserva direta exige profissional que ofereça o serviço.
- Agenda usa locks/holds para reduzir dupla reserva; a garantia final depende dos testes
  concorrentes da fase de aceite.
- Prestador precisa de perfil `approved` para aparecer publicamente e disputar
  oportunidades; isso significa aprovação operacional, não KYC documental.
- Conversas e dados de reserva são limitados aos participantes autorizados.
- Avaliação exige reserva concluída e é única conforme a restrição do banco.
- Ações administrativas disponíveis são protegidas pelo papel `admin` e geram auditoria
  onde implementado.
- Recursos sem fornecedor ou endpoint ficam desabilitados, removidos ou marcados como
  demonstração/roadmap.

## Direção de experiência

- Mobile-first a partir de 360 px, com navegação inferior e CTAs adequados a toque.
- Desktop com cabeçalho horizontal, grades amplas e resumo lateral na reserva.
- Verde como ação principal, fundo menta e acentos coral/amarelo, sem reproduzir a
  identidade de terceiros.
- Estados de loading, vazio e erro nas jornadas integradas.
- Datas e textos em inglês ou francês; moeda em EUR ou USD conforme a preferência do usuário.
- Navegação por teclado, foco visível, rótulos e contraste WCAG 2.2 AA como critérios da
  fase final de validação, não como certificação já concluída.
- Fotos de perfil usam upload autenticado, validação de tipo/tamanho/dimensão, armazenamento fora da pasta pública e entrega por endpoint com tipo de conteúdo validado. Política de retenção e varredura antimalware continuam dependentes da operação de produção.

## Roadmap funcional priorizado

### Próxima evolução do núcleo

- disponibilidade por slots descontando reservas e região real de atendimento;
- recorrência automática e política de cancelamento versionada;
- suporte, disputa e moderação;
- preferências, consentimentos e solicitações do titular;
- pipeline de rollback e validação prévia das migrações;
- contrato OpenAPI e ampliação da cobertura automatizada.

### Dependente de fornecedores e decisão comercial

- KYC/documentos com processo verificável e base legal;
- mapas/CEP, geolocalização e acompanhamento;
- e-mail transacional, SMS/WhatsApp e push;
- armazenamento privado e varredura de anexos;
- seguro, antifraude e serviços regulados;
- aplicativo empacotado, PWA/offline e expansão internacional.

## Limites desta entrega

- Código e dados permanecem locais, sem commit, push, publicação ou deploy.
- Uma imagem editada a partir da referência autorizada é incorporada à capa e uma foto de eletricista gerada a pedido do usuário é usada na tela de acesso.
- A plataforma não processa pagamentos nem coleta dados financeiros.
- Contas, endereços, mensagens e valores de demonstração são fictícios.
- Operação real exige credenciais, contratos, homologação, política de privacidade,
  segurança, testes finais e autorização explícita.
