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
- cotação autoritativa no servidor com preço fixo, por hora ou por área, adicionais,
  cupom, taxa e comissão;
- reserva direta e solicitação ao marketplace;
- proposta do prestador e aceite do cliente;
- bloqueio de agenda, histórico básico e estados de reserva;
- intenção e transação de pagamento inteiramente simuladas;
- favoritos, conversas de texto, notificações e avaliação;
- perfil, serviços, disponibilidade, jobs e oportunidades do prestador;
- métricas e operações administrativas básicas de usuário, aprovação de perfil,
  catálogo, cupom, promoção e auditoria.

“Implementado” descreve a existência do fluxo no código; não substitui a validação final
de concorrência, segurança, acessibilidade, desempenho e navegadores.

### 2. Modo demonstração

- `npm start` usa `MockApiService` por padrão para navegação sem API.
- O build de container usa a API PHP real.
- Pagamento usa driver `fake`; `success`, `declined` e `timeout` são cenários locais.
- E-mail usa outbox/driver de log; o Compose executa o worker, mas não há entrega externa.
- Quando uma tela apresenta fallback sem endpoint correspondente, ela deve trazer rótulo
  visível de “Demonstração” e não simular confirmação operacional silenciosamente.
- Dados do seed e mock são fictícios e existem somente para desenvolvimento.

### 3. Roadmap

Não estão prontos hoje: KYC/documentos, upload, mapas, SMS/WhatsApp, seguro, gateway real,
webhook, estorno, crédito, ledger, split, repasse, recorrência, reagendamento completo,
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
| Financeiro especializado | Roadmap; não existe papel separado, conciliação ou repasse real. |

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
- perfil público com região, oferta e avaliações, sem contato ou endereço exato;
- páginas informativas de funcionamento, segurança, ajuda, termos e privacidade;
- layouts responsivos baseados em CSS, sem fotografia obrigatória.

Filtros por data, distância real, preço e slots livres permanecem parciais/roadmap. A
aprovação operacional do perfil não deve ser rotulada como “identidade verificada”.

### Cliente

No núcleo atual, o cliente pode:

1. cadastrar-se, entrar e manter sessão;
2. salvar endereço;
3. escolher serviço, tamanho/quantidade, data, horário e profissional;
4. solicitar cotação calculada pelo backend e validar cupom;
5. criar reserva direta ou, pela API, solicitação para propostas;
6. criar intenção e simular o resultado de pagamento local;
7. acompanhar reservas e usar as ações existentes de cancelar e avaliar;
8. favoritar profissional e conversar pelo fluxo web; notificações permanecem
   disponíveis na API e podem ter apresentação parcial na interface;
9. consultar histórico básico.

Recorrência, materiais, política versionada de cancelamento, reagendamento, chegada,
confirmação bilateral, disputa, suporte e meios de pagamento reais são roadmap.

### Prestador

No núcleo da API, o prestador pode:

1. cadastrar perfil inicial sujeito a aprovação operacional;
2. atualizar apresentação, cidade, estado e raio informativo;
3. ativar serviços e definir preço;
4. definir regras semanais de disponibilidade;
5. consultar dashboard e jobs;
6. consultar solicitações compatíveis por serviço;
7. enviar ou retirar proposta;
8. iniciar e concluir reservas autorizadas.

Área geográfica com cálculo de distância, documentos, verificação de identidade, conta
bancária, saldo, extrato e repasse são roadmap. Números exibidos sem fonte de API devem
ser identificados como demonstração.

### Administração

O núcleo administrativo da API oferece:

- métricas agregadas;
- listagem e suspensão/reativação de usuários;
- fila e decisão de aprovação operacional de prestadores;
- criação/edição básica de categorias e serviços;
- listagem/criação de cupons e promoções textuais;
- consulta de reservas, pagamentos simulados e auditoria.

Relatórios exportáveis, documentos, moderação completa, suporte, disputas, refund,
repasse, conciliação e permissões granulares são roadmap. A interface não deve apresentar
transferências, bancos ou eventos financeiros fictícios como ocorrências reais.

## Regras que o produto já assume

- Valores de reserva são recalculados pelo servidor e congelados em snapshot.
- Dinheiro trafega em centavos; cartão bruto nunca entra no sistema.
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
- Datas, moeda, CEP, telefone e textos em padrão brasileiro.
- Navegação por teclado, foco visível, rótulos e contraste WCAG 2.2 AA como critérios da
  fase final de validação, não como certificação já concluída.
- Nenhuma tela depende de fotografia; mídia enviada por usuário só poderá existir quando
  houver upload privado e política de retenção.

## Roadmap funcional priorizado

### Próxima evolução do núcleo

- disponibilidade por slots descontando reservas e região real de atendimento;
- recorrência e reagendamento com histórico e política versionada;
- suporte, disputa e moderação;
- preferências, consentimentos e solicitações do titular;
- migrations incrementais e worker agendado;
- contrato OpenAPI e testes automatizados na fase autorizada.

### Dependente de fornecedores e decisão comercial

- gateway marketplace com tokenização externa, webhook, refund, split e repasse;
- KYC/documentos com processo verificável e base legal;
- mapas/CEP, geolocalização e acompanhamento;
- e-mail transacional, SMS/WhatsApp e push;
- armazenamento privado e varredura de anexos;
- seguro, antifraude e serviços regulados;
- aplicativo empacotado, PWA/offline e expansão internacional.

## Limites desta entrega

- Código e dados permanecem locais, sem commit, push, publicação ou deploy.
- Uma imagem editada a partir da referência autorizada é incorporada à capa e uma foto de eletricista gerada a pedido do usuário é usada na tela de acesso.
- O pagamento é somente simulado e não movimenta dinheiro.
- Contas, endereços, mensagens e valores de demonstração são fictícios.
- Operação real exige credenciais, contratos, homologação, política de privacidade,
  segurança, testes finais e autorização explícita.
