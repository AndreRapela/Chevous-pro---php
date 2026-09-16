# Comparação de produto: ChezVoust Pro × Yoojo Bélgica

Revisão executada em 26/08/2026. O domínio informado (`yoono.be`) não resolveu em DNS;
o comparável belga encontrado foi o [Yoojo Bélgica](https://yoojo.be/), marketplace de
serviços residenciais. A comparação usa as páginas públicas de
[produto](https://yoojo.be/qui-sommes-nous),
[aplicativo](https://yoojo.be/application-mobile),
[confiança e segurança](https://yoojo.be/confiance-securite) e
[cadastro de prestadores](https://yoojo.be/devenez-prestataire).

## Resultado

| Jornada/recurso | Yoojo | ChezVoust Pro após a revisão | Situação |
| --- | --- | --- | --- |
| Descoberta por categoria e busca | Catálogo amplo, com 210 serviços divulgados | Catálogo pesquisável, categorias, destaques e preços iniciais | Implementado; catálogo brasileiro menor |
| Pedido direto ou aberto ao marketplace | Descrição da necessidade e propostas | Reserva direta, cotação e solicitação aberta com propostas | Implementado |
| Comparação de prestadores | Preço, avaliações, competências e selos | Preço, avaliações, serviços, disponibilidade e perfil aprovado | Implementado com linguagem verificável |
| Agenda e disponibilidade | Prestador define agenda, zona e preço | Regras semanais, exceções, raio, serviços e preço próprio | Implementado |
| Conversa vinculada ao atendimento | Chat e contato depois da reserva | Conversa isolada por participantes e vinculada à reserva | Implementado |
| Acompanhamento da chegada | Localização em tempo real divulgada | Marco operacional “prestador a caminho”, aviso e histórico | Implementado sem fingir geolocalização |
| Reagendamento | Alteração da reserva | Reagendamento de reserva confirmada, com conflito de agenda e aviso | Implementado |
| Repetir um serviço | Nova reserva rápida/recorrência | “Agendar novamente” preserva serviço e prestador | Implementado; recorrência automática pendente |
| Gestão da conta | Conta, avaliações e histórico | Perfil, endereços, senha e dispositivos conectados | Implementado |
| Confiança | Identidade/documentos, seguro e controles de qualidade divulgados | Aprovação operacional, auditoria, RBAC e histórico | Parcial; KYC/seguro exigem fornecedor e operação reais |
| Aplicativos móveis nativos | Apps de cliente e prestador | Web responsiva com portais por papel | Web móvel pronta; apps/PWA pendentes |

## Decisões de escopo

Não foram copiados selos de identidade, seguro, rastreamento em mapa, conta bancária ou
serviços financeiros porque o repositório não possui fornecedores, contratos ou evidências para
sustentar essas afirmações. Exibir esses itens como reais seria um risco de segurança,
consumidor e reputação.

Categorias de alto risco — cuidado infantil, saúde/assistência de vulneráveis e serviços
equivalentes — também não devem ser habilitadas apenas por paridade visual. Elas exigem
políticas, checagens, consentimentos, suporte e resposta a incidentes próprios.

## Próxima paridade recomendada

1. Provedor de identidade/KYC e processo humano documentado antes de criar selos.
2. Central de suporte e disputa com SLA e anexos privados.
3. Recorrência automática com regras de série e exceções.
4. Geolocalização somente após RIPD/LGPD, consentimento e retenção definida.
5. PWA ou aplicativos nativos com notificações push.
