import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { MarketplaceService } from '../../../core/data-access/marketplace.service';
import { LocalizationService } from '../../../core/localization/localization.service';
import { ADMIN_DEMO_ROWS, ADMIN_PAGES } from '../data/admin-page.config';
import { AdminPageKey, AdminRow, AdminTone } from '../models/admin-page.model';

export interface AdminTableResult {
  rows: AdminRow[];
  total: number;
  page: number;
  lastPage: number;
}

@Injectable({ providedIn: 'root' })
export class AdminTableDataService {
  private readonly marketplace = inject(MarketplaceService);
  private readonly localization = inject(LocalizationService);

  load(key: AdminPageKey, page = 1): Observable<AdminTableResult> {
    if (ADMIN_PAGES[key].demo) return of({ rows: ADMIN_DEMO_ROWS, total: ADMIN_DEMO_ROWS.length, page: 1, lastPage: 1 });
    if (key === 'support') {
      return this.marketplace.adminContentReports({ page }).pipe(map((response) => this.result(response.data.map((item) => this.reportRow(item)), response.meta)));
    }
    if (key === 'customers') {
      return this.marketplace.adminUsers({ role: 'customer', page }).pipe(map((response) => this.result(response.data.map((item) => this.userRow(item)), response.meta)));
    }
    if (key === 'providers') {
      return this.marketplace.adminPendingProviders({ page }).pipe(map((response) => this.result(response.data.map((item) => this.providerRow(item)), response.meta)));
    }
    if (key === 'catalog') {
      return this.marketplace.services().pipe(map((items) => ({
        rows: items.map((item) => ({ id: item.id, primary: item.name, secondary: item.slug, cells: [item.categoryId || '—', this.money(item.priceFromCents), item.pricingType ?? item.unit], status: 'Publicado', tone: 'success' as AdminTone })),
        total: items.length, page: 1, lastPage: 1
      })));
    }
    return this.marketplace.adminBookings({ page }).pipe(map((response) => this.result(response.data.map((item) => this.bookingRow(item)), response.meta)));
  }

  reviewProvider(id: string, status: 'approved' | 'rejected', notes: string) {
    return this.marketplace.adminReviewProvider(id, status, notes);
  }

  updateUserStatus(id: string, status: 'active' | 'suspended', reason: string) {
    return this.marketplace.adminUserStatus(id, status, reason);
  }

  resolveContentReport(id: string, action: 'hide' | 'retain', note: string) {
    return this.marketplace.adminResolveContentReport(id, action, note);
  }

  private bookingRow(value: unknown): AdminRow { const item = this.record(value); const status = this.text(item, 'status'); return { id: this.text(item, 'id'), primary: this.text(item, 'serviceName', 'Serviço'), secondary: this.shortId(this.text(item, 'id')), cells: [`${this.text(item, 'customerName')} / ${this.text(item, 'professionalName', 'A definir')}`, this.date(this.text(item, 'scheduledStart')), this.money(this.amount(item, 'totalCents'), this.currency(item))], status: this.label(status), tone: this.statusTone(status), rawStatus: status }; }
  private userRow(value: unknown): AdminRow { const item = this.record(value); const status = this.text(item, 'status'); return { id: this.text(item, 'id'), primary: this.text(item, 'name'), secondary: this.shortId(this.text(item, 'id')), cells: [this.text(item, 'email'), this.date(this.text(item, 'createdAt')), this.text(item, 'role')], status: this.label(status), tone: this.statusTone(status), rawStatus: status }; }
  private providerRow(value: unknown): AdminRow { const item = this.record(value); const status = this.text(item, 'verificationStatus', 'pending'); return { id: this.text(item, 'id'), primary: this.text(item, 'name'), secondary: this.text(item, 'headline', 'Perfil profissional'), cells: [this.text(item, 'email'), `${this.text(item, 'city')}, ${this.text(item, 'state')}`, this.date(this.text(item, 'createdAt'))], status: status === 'pending' ? 'Aguardando análise' : this.label(status), tone: 'warning', rawStatus: status }; }
  private reportRow(value: unknown): AdminRow { const item = this.record(value); const status = this.text(item, 'status'); const type = this.text(item, 'contentType').replaceAll('_', ' '); return { id: this.text(item, 'id'), primary: type, secondary: this.shortId(this.text(item, 'contentId')), cells: [this.text(item, 'reporterName'), this.text(item, 'reason'), this.date(this.text(item, 'createdAt'))], status: this.label(status), tone: status === 'pending' ? 'warning' : status === 'resolved' ? 'danger' : 'neutral', rawStatus: status }; }
  private record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
  private text(item: Record<string, unknown>, key: string, fallback = '—'): string { const value = item[key]; return typeof value === 'string' && value ? value : fallback; }
  private amount(item: Record<string, unknown>, key: string): number { const value = Number(item[key]); return Number.isFinite(value) ? value : 0; }
  private money(cents: number, sourceCurrency: 'BRL' | 'EUR' | 'USD' = 'BRL'): string { return this.localization.formatMoney(cents / 100, sourceCurrency); }
  private currency(item: Record<string, unknown>): 'BRL' | 'EUR' | 'USD' { const currency = this.text(item, 'currency', 'BRL').toUpperCase(); return currency === 'EUR' || currency === 'USD' ? currency : 'BRL'; }
  private date(value: string): string { const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value; const date = new Date(normalized); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(this.localization.locale(), { dateStyle: 'short', timeStyle: 'short' }).format(date); }
  private label(value: string): string { return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }
  private shortId(value: string): string { return value ? value.slice(0, 8).toUpperCase() : '—'; }
  private statusTone(status: string): AdminTone { return ['completed', 'confirmed', 'active', 'approved'].includes(status) ? 'success' : ['cancelled', 'suspended', 'rejected', 'disputed'].includes(status) ? 'danger' : ['pending', 'awaiting_confirmation', 'open'].includes(status) ? 'warning' : 'neutral'; }
  private metaTotal(meta: Record<string, unknown> | undefined, fallback: number): number { const total = Number(meta?.['total']); return Number.isFinite(total) ? total : fallback; }
  private result(rows: AdminRow[], meta?: Record<string, unknown>): AdminTableResult { const total = this.metaTotal(meta, rows.length); const page = Math.max(1, Number(meta?.['page']) || 1); const perPage = Math.max(1, Number(meta?.['perPage']) || rows.length || 1); return { rows, total, page, lastPage: Math.max(1, Number(meta?.['lastPage']) || Math.ceil(total / perPage)) }; }
}
