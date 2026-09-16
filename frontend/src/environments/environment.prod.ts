export const environment = {
  production: true,
  apiUrl: '/api/v1',
  useMockApi: false,
  demoAccounts: null as { customer: readonly [string, string]; provider: readonly [string, string]; admin: readonly [string, string] } | null,
  locale: 'pt-BR',
  currency: 'BRL'
} as const;
