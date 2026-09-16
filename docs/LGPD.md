# ChezVoust Pro — privacidade e LGPD

Este é um guia técnico de privacidade por padrão, não parecer jurídico. Contratos, bases
legais, prazos e atuação como marketplace devem ser validados por profissional habilitado
antes da operação real.

## Papéis e governança

ChezVoust Pro tende a ser controladora dos dados usados para conta, intermediação,
segurança, suporte e operação. Gateway, e-mail, hospedagem, KYC e armazenamento tendem a
ser operadores quando tratam dados sob instruções. Prestadores podem assumir papel
próprio para dados tratados fora da plataforma; isso deve estar explícito nos termos.

Antes de produção:

- nomear encarregado/canal de privacidade e publicar contato;
- manter inventário, registro das operações, matriz de base legal e suboperadores;
- celebrar contratos de tratamento e mapear transferências internacionais;
- realizar RIPD para geolocalização, KYC, antifraude, ranking e serviços envolvendo
  pessoas vulneráveis;
- versionar termos, avisos e consentimentos, guardando evidência de aceite.

## Inventário mínimo

| Dados | Finalidade | Base a validar | Retenção proposta |
| --- | --- | --- | --- |
| Nome, contato, credencial | Conta, autenticação e comunicação | Contrato; legítimo interesse/segurança | Enquanto ativa e depois pelo prazo necessário às obrigações. |
| CPF/CNPJ e documentos do prestador | Verificação, fraude, contrato e repasse | Contrato; obrigação legal/regulatória | Configurável por tipo e exigência do fornecedor/jurídico. |
| Endereço do serviço | Busca, preço e execução | Contrato | Na reserva pelo prazo de defesa; endereços salvos até remoção/encerramento. |
| Agenda, respostas e histórico | Contratar, executar, suportar e comprovar | Contrato; exercício regular de direitos | Até expirar obrigação/defesa definida na tabela de retenção. |
| Chat, anexos e tickets | Coordenação, segurança e disputa | Contrato; exercício regular de direitos | Janela limitada, com bloqueio quando houver litígio. |
| Localização | Compatibilidade e, se ativada, acompanhamento | Contrato para área aproximada; consentimento destacado para precisão | Precisa somente durante a necessidade; depois reduzir/anonimizar. |
| Logs e auditoria | Segurança, fraude e responsabilização | Legítimo interesse; exercício regular de direitos | Janela proporcional ao risco, com acesso restrito. |
| Marketing e cookies não essenciais | Comunicação e análise opcional | Consentimento | Até revogação, expiração ou mudança de finalidade. |

O sistema deve possuir uma tabela de retenção por classe, com gatilho, prazo, destino
(`excluir`, `anonimizar` ou `bloquear`) e exceção por obrigação legal/litígio. “Guardar
para sempre” não é uma política válida.

## Transparência e consentimento

- Aviso de privacidade em linguagem simples informa controlador, finalidade, dados,
  compartilhamentos, retenção, direitos e canal do encarregado.
- Consentimento é granular, livre, destacado, versionado e revogável; não é usado para
  substituir base contratual necessária.
- Marketing, geolocalização precisa e cookies opcionais permanecem desligados até escolha.
- Banner de cookies oferece “Aceitar opcionais”, “Recusar opcionais” e “Configurar” com
  igual facilidade. O consentimento pode ser alterado depois.
- Mudança material de finalidade exige novo aviso e, quando aplicável, novo consentimento.

## Direitos do titular

A área de privacidade e o atendimento devem permitir confirmação/acesso, correção,
informação sobre compartilhamento, portabilidade quando aplicável, anonimização, bloqueio,
eliminação, oposição, revogação e revisão/explicação de decisão automatizada.

Fluxo operacional:

1. Registrar protocolo, tipo, origem e prazo, sem pedir dados excessivos.
2. Validar identidade proporcionalmente ao risco; nunca solicitar documento completo por
   e-mail aberto se houver canal seguro.
3. Localizar dados e compartilhamentos nos módulos/suboperadores.
4. Aplicar exceções legais de modo fundamentado e informar a resposta em linguagem clara.
5. Executar correção, exportação, anonimização ou exclusão e registrar evidência.
6. Comunicar operadores afetados e encerrar o protocolo sem expor dados de terceiros.

A ANPD descreve esses direitos, inclusive confirmação, acesso, correção, portabilidade,
eliminação, revogação e revisão automatizada, em sua página de
[direitos dos titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares).

## Privacidade por padrão

- Busca usa CEP/região e distância aproximada; não revela endereço ou posição exata.
- Endereço completo só é exibido ao prestador confirmado e pelo tempo necessário.
- Chat oculta contato pessoal por padrão; anexos exigem autorização contextual.
- Perfil público contém apenas nome de exibição, região aproximada, oferta, avaliações e
  verificações permitidas — nunca CPF, documento, telefone, e-mail ou dados bancários.
- Painéis mascaram dados e separam permissões de suporte e verificação.
- Exportações têm finalidade, filtro, expiração e log; não são enviadas por link público.
- Ambientes de desenvolvimento usam dados fictícios; cópia de produção é proibida sem
  anonimização formal.

## Crianças, dados sensíveis e serviços de cuidado

Cadastro direto exige maioridade. Categorias de cuidado de crianças, idosos, saúde ou
pessoas com deficiência ficam desativadas até existirem política específica, verificação
adequada, consentimentos/representação, prevenção de abuso, treinamento e canal de
emergência. Dados de saúde, biometria e antecedentes não devem ser coletados “por
precaução”; somente com necessidade comprovada, base legal e proteção reforçada.

## Segurança dos dados

- TLS, hash forte de senha, rotação/revogação de sessão e MFA para funções críticas.
- Criptografia de campos recuperáveis sensíveis e backups; chaves fora do banco.
- RBAC, menor privilégio, auditoria de leitura de documentos e revisão periódica de acesso.
- Upload privado, validação de tipo/tamanho, varredura quando disponível e URL temporária.
- Minimização de logs, redaction, limites de retenção e alertas de abuso.
- Contratos e avaliações de fornecedores cobrem segurança, exclusão, incidentes e
  subcontratação.

## Incidentes

Manter plano com canal interno, triagem, contenção, preservação de evidência, avaliação de
risco, decisão, comunicação e lições aprendidas. O controlador deve manter registro dos
incidentes. Quando o evento puder causar risco ou dano relevante, a regulamentação vigente
prevê comunicação à ANPD e aos titulares em três dias úteis, ressalvado prazo específico;
ver a orientação oficial de
[Comunicação de Incidente de Segurança](https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/comunicado-de-incidente-de-seguranca-cis).

O sistema deve permitir extrair rapidamente categorias de dados, titulares afetados,
período, controles existentes e medidas adotadas. Comunicação pública ou regulatória é
decisão do controlador com jurídico/encarregado, não uma ação automática da aplicação.

## Checklist de liberação

- Avisos e termos aprovados, publicados e versionados.
- Canal do encarregado funcional e fluxo de direitos ensaiado.
- Inventário, bases, retenção e suboperadores aprovados.
- Segredos trocados, HTTPS, acesso mínimo, backups e logs seguros.
- Gateways reais sem captura de cartão pela aplicação.
- Geolocalização, cookies, marketing e recursos regulados protegidos por flags.
- Plano de incidente e contatos atualizados.
- Nenhuma alegação de identidade, seguro ou background check sem processo verificável.
