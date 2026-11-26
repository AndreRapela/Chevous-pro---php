import { environment as productionEnvironment } from './environment.prod';

export const environment = { ...productionEnvironment, demoPortalPath: '/demo/entrar' } as const;
