export const environment = {
  production: false,
  apiUrl: '/api/v1',
  useMockApi: true,
  demoAccounts: {
    customer: ['cliente@chezvoust.test', 'demo'],
    provider: ['profissional@chezvoust.test', 'demo'],
    admin: ['admin@chezvoust.test', 'demo']
  },
  locale: 'pt-BR',
  currency: 'BRL'
} as const;
