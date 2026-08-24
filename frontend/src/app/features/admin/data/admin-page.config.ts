import { AdminPageConfig, AdminPageKey, AdminRow } from '../models/admin-page.model';

export const ADMIN_PAGES: Record<AdminPageKey, AdminPageConfig> = {
  bookings: { eyebrow: 'Operação', title: 'Reservas', description: 'Acompanhe o ciclo das reservas retornadas pela API.', columns: ['Reserva', 'Cliente / Profissional', 'Data', 'Valor'] },
  customers: { eyebrow: 'Comunidade', title: 'Clientes', description: 'Gerencie o estado das contas de clientes.', columns: ['Cliente', 'Contato', 'Cadastro', 'Papel'] },
  providers: { eyebrow: 'Rede profissional', title: 'Prestadores pendentes', description: 'Aprove ou rejeite perfis que aguardam análise.', columns: ['Profissional', 'Contato', 'Local', 'Cadastro'] },
  catalog: { eyebrow: 'Oferta da plataforma', title: 'Catálogo', description: 'Consulte serviços e preços-base publicados.', columns: ['Serviço', 'Categoria', 'Preço-base', 'Cobrança'] },
  finance: { eyebrow: 'Conciliação', title: 'Pagamentos', description: 'Consulte os pagamentos registrados pela API.', columns: ['Pagamento', 'Reserva', 'Criação', 'Valor'] },
  coupons: { eyebrow: 'Promoções', title: 'Cupons', description: 'Consulte regras, limites e uso dos cupons.', columns: ['Cupom', 'Desconto', 'Uso', 'Vigência'] },
  support: { eyebrow: 'Demonstração', title: 'Suporte', description: 'Prévia visual: a API atual não expõe chamados de suporte.', columns: ['Recurso', 'Estado', 'Origem', 'Observação'], demo: true },
  settings: { eyebrow: 'Demonstração', title: 'Configurações', description: 'Prévia visual: a API atual não expõe configurações administrativas.', columns: ['Configuração', 'Escopo', 'Valor', 'Observação'], demo: true }
};

export const ADMIN_DEMO_ROWS: AdminRow[] = [
  {
    id: 'demo',
    primary: 'Funcionalidade não integrada',
    secondary: 'Dados demonstrativos',
    cells: ['Demonstração', 'Sem endpoint', 'Nenhuma ação disponível'],
    status: 'Demonstração',
    tone: 'neutral'
  }
];

export function isAdminPageKey(value: string): value is AdminPageKey {
  return Object.hasOwn(ADMIN_PAGES, value);
}
