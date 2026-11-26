export const environment = {
  production: false,
  apiUrl: '/api/v1',
  useMockApi: true,
  demoPortalPath: null as string | null,
  hostedDemo: false,
  demoAccounts: {
    customer: ['cliente@chezvoust.test', 'demo'],
    provider: ['profissional@chezvoust.test', 'demo'],
    admin: ['admin@chezvoust.test', 'demo']
  },
  locale: 'en-US',
  currency: 'EUR'
} as const;
