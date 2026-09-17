export const environment = {
  production: true,
  apiUrl: '/api/v1',
  useMockApi: false,
  demoAccounts: {
    customer: ['cliente@chezvoust.test', 'Cliente@123'],
    provider: ['profissional@chezvoust.test', 'Profissional@123'],
    admin: ['admin@chezvoust.test', 'Admin@123']
  } as { customer: readonly [string, string]; provider: readonly [string, string]; admin: readonly [string, string] },
  locale: 'pt-BR',
  currency: 'BRL'
} as const;
