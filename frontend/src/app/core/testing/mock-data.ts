import {
  Booking,
  DashboardMetric,
  MessagePreview,
  ProviderProfile,
  Service,
  ServiceCategory
} from '../models';

export const MOCK_CATEGORIES: ServiceCategory[] = [
  { id: 'cleaning', slug: 'limpeza', name: 'Limpeza', shortName: 'Limpeza', description: 'Rotina, pesada e pós-obra.', symbol: 'LI', serviceCount: 8 },
  { id: 'laundry', slug: 'lavanderia', name: 'Lavanderia', shortName: 'Lavanderia', description: 'Roupas lavadas e passadas.', symbol: 'LV', serviceCount: 4 },
  { id: 'repairs', slug: 'reparos', name: 'Reparos e montagem', shortName: 'Reparos', description: 'Pequenos consertos e instalações.', symbol: 'RP', serviceCount: 13 },
  { id: 'painting', slug: 'pintura', name: 'Pintura', shortName: 'Pintura', description: 'Renove ambientes internos e externos.', symbol: 'PT', serviceCount: 6 },
  { id: 'gardening', slug: 'jardinagem', name: 'Jardinagem', shortName: 'Jardim', description: 'Poda, manutenção e paisagismo.', symbol: 'JD', serviceCount: 7 },
  { id: 'moving', slug: 'mudancas', name: 'Mudanças', shortName: 'Mudanças', description: 'Carregamento, montagem e transporte.', symbol: 'MD', serviceCount: 5 },
  { id: 'care', slug: 'cuidados', name: 'Cuidados', shortName: 'Cuidados', description: 'Apoio para crianças, idosos e pets.', symbol: 'CD', serviceCount: 9 },
  { id: 'technology', slug: 'tecnologia', name: 'Tecnologia', shortName: 'Tecnologia', description: 'Instalação e suporte em casa.', symbol: 'TI', serviceCount: 6 }
];

export const MOCK_SERVICES: Service[] = [
  { id: 'clean-home', categoryId: 'cleaning', slug: 'limpeza-residencial', name: 'Limpeza residencial', description: 'Limpeza completa adaptada ao tamanho da sua casa.', symbol: 'LR', priceFromCents: 12000, unit: 'serviço', durationMinutes: 240, addons: [{ id: 'addon-fridge', name: 'Limpeza interna da geladeira', description: 'Higienização das prateleiras e gavetas.', priceCents: 3500, pricingType: 'fixed' }], popular: true },
  { id: 'clean-heavy', categoryId: 'cleaning', slug: 'limpeza-pesada', name: 'Limpeza pesada', description: 'Cuidado detalhado para ambientes que precisam de atenção extra.', symbol: 'LP', priceFromCents: 22000, unit: 'serviço', durationMinutes: 360 },
  { id: 'clean-post', categoryId: 'cleaning', slug: 'limpeza-pos-obra', name: 'Limpeza pós-obra', description: 'Remoção de poeira e resíduos após reforma.', symbol: 'PO', priceFromCents: 35000, unit: 'serviço', durationMinutes: 480 },
  { id: 'laundry-wash', categoryId: 'laundry', slug: 'lavar-e-passar', name: 'Lavar e passar', description: 'Cuidado completo com suas roupas do dia a dia.', symbol: 'LP', priceFromCents: 9000, unit: 'serviço', durationMinutes: 180, popular: true },
  { id: 'repair-furniture', categoryId: 'repairs', slug: 'montagem-de-moveis', name: 'Montagem de móveis', description: 'Montagem segura de móveis de diferentes marcas.', symbol: 'MM', priceFromCents: 11000, unit: 'serviço', durationMinutes: 120, popular: true },
  { id: 'repair-electric', categoryId: 'repairs', slug: 'reparos-eletricos', name: 'Reparos elétricos', description: 'Trocas, instalações e pequenos diagnósticos.', symbol: 'EL', priceFromCents: 14000, unit: 'serviço', durationMinutes: 120 },
  { id: 'repair-equipment', categoryId: 'repairs', slug: 'manutencao-de-equipamentos', name: 'Manutenção de equipamentos', description: 'Diagnóstico e pequenos reparos em equipamentos domésticos.', symbol: 'ME', priceFromCents: 16000, unit: 'serviço', durationMinutes: 120 },
  { id: 'paint-room', categoryId: 'painting', slug: 'pintura-de-ambiente', name: 'Pintura de ambiente', description: 'Pintura cuidadosa com proteção dos seus móveis.', symbol: 'PA', priceFromCents: 42000, unit: 'serviço', durationMinutes: 480 },
  { id: 'garden-care', categoryId: 'gardening', slug: 'manutencao-de-jardim', name: 'Manutenção de jardim', description: 'Corte, poda e limpeza para manter tudo em ordem.', symbol: 'MJ', priceFromCents: 16000, unit: 'serviço', durationMinutes: 180 },
  { id: 'moving-help', categoryId: 'moving', slug: 'ajuda-na-mudanca', name: 'Ajuda na mudança', description: 'Apoio para organizar, carregar e montar.', symbol: 'AM', priceFromCents: 18000, unit: 'hora', durationMinutes: 240 },
  { id: 'care-pet', categoryId: 'care', slug: 'cuidador-de-pets', name: 'Cuidador de pets', description: 'Companhia e cuidados na sua casa ou em passeios.', symbol: 'CP', priceFromCents: 7000, unit: 'diária', durationMinutes: 240 },
  { id: 'care-elder', categoryId: 'care', slug: 'companhia-para-idosos', name: 'Companhia para idosos', description: 'Acompanhamento atencioso para a rotina.', symbol: 'CI', priceFromCents: 10000, unit: 'hora', durationMinutes: 180 },
  { id: 'tech-wifi', categoryId: 'technology', slug: 'configuracao-wifi', name: 'Configuração de Wi-Fi', description: 'Rede estável, segura e funcionando em toda a casa.', symbol: 'WI', priceFromCents: 13000, unit: 'serviço', durationMinutes: 90 },
  { id: 'tech-photo', categoryId: 'technology', slug: 'fotografia-residencial-e-eventos', name: 'Fotografia residencial e de eventos', description: 'Fotos profissionais para imóveis, celebrações e projetos pessoais.', symbol: 'FT', priceFromCents: 25000, unit: 'serviço', durationMinutes: 120 }
];

export const MOCK_PROVIDERS: ProviderProfile[] = [
  {
    id: 'ana-clara', name: 'Ana Clara Souza', initials: 'AS', headline: 'Especialista em limpeza residencial',
    bio: 'Trabalho com atenção aos detalhes e respeito à rotina de cada família. Levo meus materiais básicos e confirmo todas as preferências antes de começar.',
    city: 'São Paulo', neighborhood: 'Vila Mariana', verified: true, topProvider: true, rating: 4.96, reviewCount: 128, completedJobs: 214,
    responseTime: 'Responde em até 10 min', priceFromCents: 12000, serviceIds: ['clean-home', 'clean-heavy', 'laundry-wash'],
    qualities: ['Pontual', 'Cuidadosa', 'Muito elogiada'], nextAvailability: 'Hoje, 14:00',
    avatarUrl: '/images/perfil-limpeza-ana-clara-640.jpg', state: 'SP', yearsExperience: 6,
    experiences: [{ id: 'experience-1', role: 'Especialista em limpeza residencial', company: 'Atuação autônoma', description: 'Atendimento residencial com organização e cuidado nos detalhes.', startedAt: '2019-01-01', endedAt: null, current: true }],
    courses: [{ id: 'course-1', title: 'Higienização e limpeza profissional', institution: 'Instituto Casa', completedAt: '2022-10-01', certificateUrl: null }],
    reviews: [
      { id: 'r1', author: 'Marina', initials: 'MC', rating: 5, comment: 'Serviço impecável e comunicação excelente do início ao fim.', createdAt: '2026-08-12' },
      { id: 'r2', author: 'Rafael', initials: 'RM', rating: 5, comment: 'Muito pontual, organizada e cuidadosa com o apartamento.', createdAt: '2026-08-03' }
    ]
  },
  {
    id: 'lucas-mendes', name: 'Lucas Mendes', initials: 'LM', headline: 'Montador e faz-tudo',
    bio: 'Experiência com montagem, instalações e pequenos reparos. Explico o serviço e deixo o ambiente organizado.',
    city: 'São Paulo', neighborhood: 'Pinheiros', verified: true, rating: 4.91, reviewCount: 86, completedJobs: 147,
    responseTime: 'Responde em até 30 min', priceFromCents: 11000, serviceIds: ['repair-furniture', 'repair-electric', 'tech-wifi'],
    qualities: ['Ferramentas próprias', 'Organizado', 'Bom diagnóstico'], nextAvailability: 'Amanhã, 09:00',
    avatarUrl: '/images/perfil-montador-lucas-mendes-640.jpg', state: 'SP', yearsExperience: 8,
    reviews: [
      { id: 'r3', author: 'Bianca', initials: 'BS', rating: 5, comment: 'Montagem rápida e tudo ficou muito firme.', createdAt: '2026-08-10' },
      { id: 'r3b', author: 'Felipe', initials: 'FL', rating: 5, comment: 'Explicou cada etapa e deixou tudo limpo depois da instalação.', createdAt: '2026-08-06' },
      { id: 'r3c', author: 'Renata', initials: 'RN', rating: 4, comment: 'Foi pontual e resolveu o reparo da tomada com bastante cuidado.', createdAt: '2026-07-28' }
    ]
  },
  {
    id: 'juliana-lima', name: 'Juliana Lima', initials: 'JL', headline: 'Cuidados com a casa e pets',
    bio: 'Gosto de criar uma rotina tranquila para os pets e manter os responsáveis sempre informados.',
    city: 'Rio de Janeiro', neighborhood: 'Tijuca', verified: true, topProvider: true, rating: 4.98, reviewCount: 73, completedJobs: 112,
    responseTime: 'Responde em até 15 min', priceFromCents: 7000, serviceIds: ['care-pet', 'clean-home'],
    qualities: ['Carinhosa', 'Envia atualizações', 'Flexível'], nextAvailability: 'Hoje, 16:30',
    reviews: [{ id: 'r4', author: 'Diego', initials: 'DA', rating: 5, comment: 'Meus gatos ficaram super tranquilos com a Juliana.', createdAt: '2026-08-14' }]
  },
  {
    id: 'marcos-ribeiro', name: 'Marcos Ribeiro', initials: 'MR', headline: 'Jardineiro e pintor residencial',
    bio: 'Atendimento caprichado para áreas verdes e renovação de ambientes.',
    city: 'Belo Horizonte', neighborhood: 'Pampulha', verified: true, rating: 4.88, reviewCount: 54, completedJobs: 96,
    responseTime: 'Responde em até 1 h', priceFromCents: 15000, serviceIds: ['garden-care', 'paint-room'],
    qualities: ['Trabalho limpo', 'Planejado', 'Confiável'], nextAvailability: 'Qui, 08:00', reviews: []
  },
  {
    id: 'carla-ferraz', name: 'Carla Ferraz', initials: 'CF', headline: 'Acompanhante domiciliar',
    bio: 'Acompanhamento com escuta, paciência e respeito à autonomia de cada pessoa.',
    city: 'Curitiba', neighborhood: 'Água Verde', verified: true, rating: 4.94, reviewCount: 42, completedJobs: 81,
    responseTime: 'Responde em até 20 min', priceFromCents: 10000, serviceIds: ['care-elder'],
    qualities: ['Paciente', 'Atenta', 'Perfil aprovado'], nextAvailability: 'Sex, 10:00', reviews: []
  },
  {
    id: 'rafael-nunes', name: 'Rafael Nunes', initials: 'RN', headline: 'Eletricista residencial',
    bio: 'Realizo instalações, diagnósticos e reparos elétricos com atenção à segurança e ao acabamento.',
    city: 'São Paulo', neighborhood: 'Mooca', verified: true, topProvider: true, rating: 4.93, reviewCount: 61, completedJobs: 118,
    responseTime: 'Responde em até 20 min', priceFromCents: 14000, serviceIds: ['repair-electric'],
    qualities: ['Bom diagnóstico', 'Ferramentas próprias', 'Confiável'], nextAvailability: 'Amanhã, 09:00',
    avatarUrl: '/images/perfil-eletricista-rafael-nunes-640.jpg', state: 'SP', yearsExperience: 7,
    reviews: [{ id: 'r5', author: 'Camila', initials: 'CA', rating: 5, comment: 'Encontrou o problema rapidamente e deixou a instalação segura.', createdAt: '2026-08-18' }]
  },
  {
    id: 'bruno-almeida', name: 'Bruno Almeida', initials: 'BA', headline: 'Técnico de equipamentos domésticos',
    bio: 'Faço diagnóstico, manutenção preventiva e pequenos reparos em equipamentos usados no dia a dia.',
    city: 'Belo Horizonte', neighborhood: 'Savassi', verified: true, rating: 4.89, reviewCount: 47, completedJobs: 92,
    responseTime: 'Responde em até 30 min', priceFromCents: 16000, serviceIds: ['repair-equipment'],
    qualities: ['Bom diagnóstico', 'Organizado', 'Ferramentas próprias'], nextAvailability: 'Qui, 08:00',
    avatarUrl: '/images/perfil-tecnico-bruno-almeida-640.jpg', state: 'MG', yearsExperience: 6,
    reviews: [{ id: 'r6', author: 'Paulo', initials: 'PS', rating: 5, comment: 'Explicou o defeito com clareza e entregou o equipamento funcionando.', createdAt: '2026-08-16' }]
  },
  {
    id: 'diego-amaral', name: 'Diego Amaral', initials: 'DA', headline: 'Fotógrafo residencial e de eventos',
    bio: 'Produzo ensaios de imóveis, celebrações e projetos pessoais com direção cuidadosa e entrega digital.',
    city: 'Rio de Janeiro', neighborhood: 'Botafogo', verified: true, topProvider: true, rating: 4.97, reviewCount: 79, completedJobs: 136,
    responseTime: 'Responde em até 15 min', priceFromCents: 25000, serviceIds: ['tech-photo'],
    qualities: ['Pontual', 'Cuidadoso', 'Muito elogiado'], nextAvailability: 'Hoje, 16:30',
    avatarUrl: '/images/perfil-fotografo-diego-amaral-640.jpg', state: 'RJ', yearsExperience: 9,
    reviews: [{ id: 'r7', author: 'Lívia', initials: 'LM', rating: 5, comment: 'As fotos ficaram naturais e foram entregues antes do prazo.', createdAt: '2026-08-19' }]
  },
  {
    id: 'eduardo-santos', name: 'Eduardo Santos', initials: 'ES', headline: 'Técnico de redes e conectividade',
    bio: 'Instalo e organizo redes residenciais, melhorando o alcance do Wi-Fi e a estabilidade da conexão.',
    city: 'São Paulo', neighborhood: 'Santana', verified: true, rating: 4.92, reviewCount: 58, completedJobs: 104,
    responseTime: 'Responde em até 20 min', priceFromCents: 13000, serviceIds: ['tech-wifi', 'repair-electric'],
    qualities: ['Bom diagnóstico', 'Organizado', 'Confiável'], nextAvailability: 'Hoje, 14:00',
    avatarUrl: '/images/perfil-redes-eduardo-santos-640.jpg', state: 'SP', yearsExperience: 8,
    reviews: [{ id: 'r8', author: 'Renan', initials: 'RC', rating: 5, comment: 'O sinal passou a funcionar bem em todos os cômodos.', createdAt: '2026-08-17' }]
  },
  {
    id: 'helena-martins', name: 'Helena Martins', initials: 'HM', headline: 'Pintora residencial',
    bio: 'Renovo paredes e ambientes com preparação cuidadosa, proteção dos móveis e acabamento uniforme.',
    city: 'Curitiba', neighborhood: 'Batel', verified: true, rating: 4.95, reviewCount: 66, completedJobs: 109,
    responseTime: 'Responde em até 20 min', priceFromCents: 42000, serviceIds: ['paint-room'],
    qualities: ['Trabalho limpo', 'Planejado', 'Cuidadosa'], nextAvailability: 'Sex, 10:00',
    avatarUrl: '/images/perfil-pintora-helena-martins-640.jpg', state: 'PR', yearsExperience: 7,
    reviews: [{ id: 'r9', author: 'Natália', initials: 'NF', rating: 5, comment: 'Protegeu todos os móveis e o acabamento ficou excelente.', createdAt: '2026-08-15' }]
  },
  {
    id: 'marina-castro', name: 'Marina Castro', initials: 'MC', headline: 'Organizadora de mudanças',
    bio: 'Planejo a organização antes e depois da mudança para que cada ambiente fique funcional desde o primeiro dia.',
    city: 'São Paulo', neighborhood: 'Perdizes', verified: true, rating: 4.90, reviewCount: 35, completedJobs: 72,
    responseTime: 'Responde em até 30 min', priceFromCents: 18000, serviceIds: ['moving-help'],
    qualities: ['Planejada', 'Organizada', 'Cuidadosa'], nextAvailability: 'Amanhã, 13:00', state: 'SP', yearsExperience: 5, reviews: []
  },
  {
    id: 'felipe-rocha', name: 'Felipe Rocha', initials: 'FR', headline: 'Jardineiro residencial',
    bio: 'Cuido de jardins, vasos e pequenas áreas verdes com poda, limpeza e manutenção periódica.',
    city: 'Campinas', neighborhood: 'Cambuí', verified: true, rating: 4.87, reviewCount: 48, completedJobs: 89,
    responseTime: 'Responde em até 1 h', priceFromCents: 16000, serviceIds: ['garden-care'],
    qualities: ['Pontual', 'Confiável', 'Trabalho limpo'], nextAvailability: 'Qui, 09:30', state: 'SP', yearsExperience: 8, reviews: []
  },
  {
    id: 'camila-azevedo', name: 'Camila Azevedo', initials: 'CA', headline: 'Especialista em lavanderia',
    bio: 'Lavo, passo e organizo roupas respeitando as orientações de cada tecido e as preferências da família.',
    city: 'Rio de Janeiro', neighborhood: 'Copacabana', verified: true, topProvider: true, rating: 4.96, reviewCount: 84, completedJobs: 153,
    responseTime: 'Responde em até 15 min', priceFromCents: 9000, serviceIds: ['laundry-wash'],
    qualities: ['Cuidadosa', 'Organizada', 'Muito elogiada'], nextAvailability: 'Hoje, 17:00', state: 'RJ', yearsExperience: 7, reviews: []
  },
  {
    id: 'andre-martins', name: 'André Martins', initials: 'AM', headline: 'Ajudante de mudanças e montagem',
    bio: 'Ajudo no carregamento, na proteção dos itens e na montagem dos móveis para uma mudança mais tranquila.',
    city: 'Belo Horizonte', neighborhood: 'Funcionários', verified: true, rating: 4.89, reviewCount: 57, completedJobs: 101,
    responseTime: 'Responde em até 30 min', priceFromCents: 18000, serviceIds: ['moving-help', 'repair-furniture'],
    qualities: ['Ágil', 'Ferramentas próprias', 'Organizado'], nextAvailability: 'Amanhã, 08:00', state: 'MG', yearsExperience: 6, reviews: []
  },
  {
    id: 'beatriz-gomes', name: 'Beatriz Gomes', initials: 'BG', headline: 'Cuidadora de idosos e pets',
    bio: 'Ofereço companhia atenciosa, apoio à rotina e atualizações frequentes para toda a família.',
    city: 'Curitiba', neighborhood: 'Centro Cívico', verified: true, rating: 4.97, reviewCount: 69, completedJobs: 124,
    responseTime: 'Responde em até 10 min', priceFromCents: 10000, serviceIds: ['care-elder', 'care-pet'],
    qualities: ['Paciente', 'Atenta', 'Envia atualizações'], nextAvailability: 'Hoje, 15:30', state: 'PR', yearsExperience: 9, reviews: []
  },
  {
    id: 'thiago-costa', name: 'Thiago Costa', initials: 'TC', headline: 'Técnico de Wi-Fi residencial',
    bio: 'Configuro roteadores, redes e dispositivos conectados para melhorar cobertura, estabilidade e segurança.',
    city: 'São Paulo', neighborhood: 'Tatuapé', verified: true, rating: 4.92, reviewCount: 52, completedJobs: 98,
    responseTime: 'Responde em até 20 min', priceFromCents: 13000, serviceIds: ['tech-wifi'],
    qualities: ['Bom diagnóstico', 'Didático', 'Organizado'], nextAvailability: 'Amanhã, 10:00', state: 'SP', yearsExperience: 7, reviews: []
  },
  {
    id: 'renata-barbosa', name: 'Renata Barbosa', initials: 'RB', headline: 'Profissional de limpeza pesada',
    bio: 'Realizo limpeza detalhada, pós-mudança e cuidados periódicos com atenção aos produtos e superfícies.',
    city: 'Santos', neighborhood: 'Gonzaga', verified: true, rating: 4.94, reviewCount: 76, completedJobs: 139,
    responseTime: 'Responde em até 20 min', priceFromCents: 22000, serviceIds: ['clean-heavy', 'clean-post', 'clean-home'],
    qualities: ['Cuidadosa', 'Pontual', 'Trabalho limpo'], nextAvailability: 'Qui, 11:00', state: 'SP', yearsExperience: 8, reviews: []
  },
  {
    id: 'gustavo-freitas', name: 'Gustavo Freitas', initials: 'GF', headline: 'Técnico de reparos residenciais',
    bio: 'Resolvo pequenos problemas elétricos e de equipamentos com diagnóstico claro e execução segura.',
    city: 'Rio de Janeiro', neighborhood: 'Méier', verified: true, rating: 4.88, reviewCount: 44, completedJobs: 83,
    responseTime: 'Responde em até 45 min', priceFromCents: 14500, serviceIds: ['repair-electric', 'repair-equipment'],
    qualities: ['Confiável', 'Bom diagnóstico', 'Ferramentas próprias'], nextAvailability: 'Sex, 08:30', state: 'RJ', yearsExperience: 10, reviews: []
  },
  {
    id: 'patricia-oliveira', name: 'Patrícia Oliveira', initials: 'PO', headline: 'Pintora e renovadora de ambientes',
    bio: 'Faço preparação e pintura de paredes com proteção do mobiliário, acabamento uniforme e ambiente organizado.',
    city: 'Campinas', neighborhood: 'Taquaral', verified: true, rating: 4.93, reviewCount: 63, completedJobs: 107,
    responseTime: 'Responde em até 30 min', priceFromCents: 42000, serviceIds: ['paint-room'],
    qualities: ['Planejada', 'Cuidadosa', 'Trabalho limpo'], nextAvailability: 'Amanhã, 14:00', state: 'SP', yearsExperience: 6, reviews: []
  },
  {
    id: 'joao-pedro-alves', name: 'João Pedro Alves', initials: 'JA', headline: 'Montador e marceneiro',
    bio: 'Monto, ajusto e reforço móveis residenciais, sempre conferindo alinhamento, estabilidade e acabamento.',
    city: 'Belo Horizonte', neighborhood: 'Santa Efigênia', verified: true, rating: 4.91, reviewCount: 71, completedJobs: 132,
    responseTime: 'Responde em até 25 min', priceFromCents: 11000, serviceIds: ['repair-furniture'],
    qualities: ['Ferramentas próprias', 'Caprichoso', 'Organizado'], nextAvailability: 'Hoje, 18:00', state: 'MG', yearsExperience: 9, reviews: []
  }
];

const cleaningService = MOCK_SERVICES[0];
const repairService = MOCK_SERVICES[4];
const ana = MOCK_PROVIDERS[0];
const lucas = MOCK_PROVIDERS[1];

if (!cleaningService || !repairService || !ana || !lucas) {
  throw new Error('Dados de demonstração incompletos.');
}

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'bk-1001', code: 'CVP-1001', service: cleaningService, provider: ana, customerName: 'Marina Costa', status: 'confirmed',
    scheduledAt: '2026-08-20T14:00:00-03:00', addressLabel: 'Vila Mariana, São Paulo', notes: 'Prioritize the kitchen and bathrooms.',
    price: { subtotalCents: 14400, serviceFeeCents: 0, discountCents: 0, totalCents: 14400, currency: 'BRL' }, canCancel: true, canReview: false, canMessage: true, conversationId: 'conversation-1', allowedActions: ['cancel', 'message']
  },
  {
    id: 'bk-0988', code: 'CVP-0988', service: repairService, provider: lucas, customerName: 'Marina Costa', status: 'completed',
    scheduledAt: '2026-08-08T09:00:00-03:00', addressLabel: 'Vila Mariana, São Paulo',
    price: { subtotalCents: 11000, serviceFeeCents: 0, discountCents: 0, totalCents: 11000, currency: 'BRL' }, canCancel: false, canReview: true, canMessage: false, allowedActions: ['review']
  }
];

export const MOCK_MESSAGES: MessagePreview[] = [
  { id: 'm1', bookingId: 'bk-1001', personName: 'Ana Clara Souza', initials: 'AS', lastMessage: 'Perfect! I will arrive a few minutes early.', sentAt: '10:42', unread: 1 },
  { id: 'm2', bookingId: 'bk-0988', personName: 'Lucas Mendes', initials: 'LM', lastMessage: 'Thank you for your trust.', sentAt: '08 ago', unread: 0 }
];

export const CUSTOMER_METRICS: DashboardMetric[] = [
  { label: 'Próximo serviço', value: 'Qui, 14h', hint: 'Limpeza residencial', tone: 'brand' },
  { label: 'Economia no mês', value: '€42', hint: 'Cupons e benefícios', tone: 'amber' },
  { label: 'Serviços concluídos', value: '8', hint: 'Nos últimos 12 meses', tone: 'neutral' }
];

export const PROVIDER_METRICS: DashboardMetric[] = [
  { label: 'Serviços em agosto', value: '€3,480', hint: '+18% em relação a julho', tone: 'brand' },
  { label: 'Novas solicitações', value: '6', hint: '3 precisam de resposta', tone: 'coral' },
  { label: 'Sua avaliação', value: '4,96', hint: '128 avaliações', tone: 'amber' }
];

export const ADMIN_METRICS: DashboardMetric[] = [
  { label: 'Reservas hoje', value: '184', hint: '+12% contra terça passada', tone: 'brand' },
  { label: 'GMV no mês', value: '€428k', hint: '87% da meta mensal', tone: 'amber' },
  { label: 'Prestadores em análise', value: '27', hint: 'Dados demonstrativos', tone: 'coral' },
  { label: 'Chamados abertos', value: '14', hint: '2 com prioridade alta', tone: 'neutral' }
];
