export interface InfoSection {
  title: string;
  text: string;
  symbol: string;
}

export interface InfoPageContent {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
}

export const INFO_PAGES: Record<string, InfoPageContent> = {
  how: {
    eyebrow: 'Sua rotina, simplificada', title: 'Como funciona', intro: 'Da busca à contratação, você acompanha cada etapa com clareza.',
    sections: [
      { symbol: '1', title: 'Descreva sua necessidade', text: 'Escolha um serviço e conte os detalhes do espaço, endereço e melhor horário.' },
      { symbol: '2', title: 'Compare profissionais', text: 'Veja experiência, avaliações, preço inicial e disponibilidade antes de decidir.' },
      { symbol: '3', title: 'Confirme com segurança', text: 'Revise o valor de referência, confirme a reserva e receba a atualização pelo painel.' },
      { symbol: '4', title: 'Converse e avalie', text: 'Alinhe detalhes no chat e compartilhe sua experiência quando o serviço terminar.' }
    ]
  },
  safety: {
    eyebrow: 'Confiança em cada etapa', title: 'Segurança ChezVoust', intro: 'Camadas de proteção para clientes e profissionais usarem a plataforma com tranquilidade.',
    sections: [
      { symbol: '✓', title: 'Perfil aprovado', text: 'A aprovação habilita o perfil na plataforma; não representa certificação documental ou de identidade.' },
      { symbol: '◇', title: 'Preço transparente', text: 'O valor de referência e as regras de cancelamento são apresentados antes da confirmação.' },
      { symbol: '○', title: 'Avaliações autênticas', text: 'Somente clientes com serviço concluído podem publicar uma avaliação.' },
      { symbol: '!', title: 'Suporte e mediação', text: 'O módulo de chamados e disputas ainda não está integrado e permanece como requisito antes da operação comercial.' }
    ]
  },
  help: {
    eyebrow: 'Orientações da plataforma', title: 'Central de ajuda', intro: 'Veja o que já pode ser resolvido nesta versão e quais recursos ainda estão em evolução.',
    sections: [
      { symbol: '?', title: 'Agendamentos', text: 'Acompanhe detalhes, propostas e cancelamentos pelo painel. Reagendamento ainda não está disponível.' },
      { symbol: '$', title: 'Valores e propostas', text: 'Use os valores de referência e as propostas recebidas para combinar os detalhes diretamente com o profissional.' },
      { symbol: '○', title: 'Conta e segurança', text: 'Atualize dados pessoais, endereços e senha e consulte as notificações recebidas.' },
      { symbol: '+', title: 'Chamados de suporte', text: 'A abertura de chamados ainda não possui endpoint nem acompanhamento nesta versão.' }
    ]
  },
  terms: {
    eyebrow: 'Transparência', title: 'Termos de uso', intro: 'Condições gerais para utilização da plataforma ChezVoust Pro.',
    sections: [
      { symbol: '1', title: 'Uso da plataforma', text: 'A plataforma conecta clientes e profissionais e registra as etapas da contratação.' },
      { symbol: '2', title: 'Responsabilidades', text: 'Cada pessoa deve manter dados verdadeiros e respeitar as regras de convivência e segurança.' },
      { symbol: '3', title: 'Valores e cancelamentos', text: 'Valores de referência e regras aplicáveis são apresentados antes da confirmação da reserva.' }
    ]
  },
  privacy: {
    eyebrow: 'Privacidade por padrão', title: 'Aviso de privacidade', intro: 'Como cuidamos dos dados necessários para operar a plataforma.',
    sections: [
      { symbol: '1', title: 'Dados utilizados', text: 'Coletamos dados de conta, reserva, atendimento e segurança conforme a finalidade informada.' },
      { symbol: '2', title: 'Seus controles', text: 'Correções de dados básicos estão disponíveis no perfil. Um canal operacional para acesso e exclusão deve ser configurado antes da produção.' },
      { symbol: '3', title: 'Proteção', text: 'Aplicamos controles técnicos e organizacionais compatíveis com o risco de cada operação.' }
    ]
  }
};
