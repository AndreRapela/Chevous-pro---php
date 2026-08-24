export type AdminTone = 'success' | 'warning' | 'danger' | 'neutral';

export type AdminPageKey = 'bookings' | 'customers' | 'providers' | 'catalog' | 'finance' | 'coupons' | 'support' | 'settings';

export interface AdminRow {
  id: string;
  primary: string;
  secondary: string;
  cells: string[];
  status: string;
  tone: AdminTone;
  rawStatus?: string;
}

export interface AdminPageConfig {
  eyebrow: string;
  title: string;
  description: string;
  columns: string[];
  demo?: boolean;
}
