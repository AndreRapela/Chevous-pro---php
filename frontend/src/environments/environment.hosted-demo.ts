import { environment as mockEnvironment } from './environment.mock';

export const environment = {
  ...mockEnvironment,
  production: true,
  apiUrl: '/demo/mock-api',
  hostedDemo: true
} as const;
