import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ServiceCategory } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { AdminTableDataService } from '../../data-access/admin-table-data.service';
import { ADMIN_PAGES, isAdminPageKey } from '../../data/admin-page.config';
import { AdminPageKey, AdminRow } from '../../models/admin-page.model';
import { LocalizationService } from '../../../../core/localization/localization.service';
import {
  displayReferenceBound,
  referenceAmountToCents
} from '../../../../core/localization/reference-currency.util';

@Component({
  selector: 'cvp-admin-table',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, StatePanelComponent],
  templateUrl: './admin-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTableComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(AdminTableDataService);
  private readonly marketplace = inject(MarketplaceService);
  readonly localization = inject(LocalizationService);
  readonly key: AdminPageKey = this.pageKey();
  readonly config = ADMIN_PAGES[this.key];
  readonly rows = signal<AdminRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly pendingAction = signal<{
    row: AdminRow;
    status: 'approved' | 'rejected' | 'active' | 'suspended' | 'hide' | 'retain';
  } | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly acting = signal(false);
  readonly categories = signal<ServiceCategory[]>([]);
  query = '';
  status = '';
  private initialized = false;

  constructor() {
    effect(() => {
      this.localization.currency();
      this.localization.language();
      if (this.initialized) this.load();
    });
  }

  ngOnInit(): void {
    this.initialized = true;
    this.load();
    if (this.key === 'catalog')
      this.marketplace.categories().subscribe({
        next: (categories) => this.categories.set(categories),
        error: (failure: Error) => this.actionError.set(failure.message)
      });
  }

  personalCell(index: number): boolean {
    return this.key === 'providers' || this.key === 'support'
      ? index <= 1
      : (this.key === 'customers' || this.key === 'bookings') && index === 0;
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.data.load(this.key, this.page()).subscribe({
      next: (result) => {
        this.rows.set(result.rows);
        this.total.set(result.total);
        this.page.set(result.page);
        this.lastPage.set(result.lastPage);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  filteredRows(): AdminRow[] {
    const query = this.query.trim().toLocaleLowerCase('pt-BR');
    return this.rows().filter(
      (row) =>
        (!this.status || row.tone === this.status) &&
        (!query ||
          `${row.primary} ${row.secondary} ${row.cells.join(' ')} ${row.status}`
            .toLocaleLowerCase('pt-BR')
            .includes(query))
    );
  }

  requestAction(
    row: AdminRow,
    status: 'approved' | 'rejected' | 'active' | 'suspended' | 'hide' | 'retain'
  ): void {
    this.pendingAction.set({ row, status });
  }
  confirmAction(event: Event): void {
    event.preventDefault();
    const pending = this.pendingAction();
    if (!pending) return;
    const reason =
      (event.currentTarget as HTMLFormElement).querySelector('textarea')?.value.trim() ?? '';
    if (reason.length < 3) return;
    if (pending.status === 'approved' || pending.status === 'rejected')
      this.reviewProvider(pending.row, pending.status, reason);
    else if (pending.status === 'active' || pending.status === 'suspended')
      this.toggleUser(pending.row, pending.status, reason);
    else this.resolveReport(pending.row, pending.status, reason);
  }
  reviewProvider(row: AdminRow, status: 'approved' | 'rejected', notes: string): void {
    this.actionError.set('');
    this.data.reviewProvider(row.id, status, notes).subscribe({
      next: () => {
        this.rows.update((items) => items.filter((item) => item.id !== row.id));
        this.total.update((value) => Math.max(0, value - 1));
        this.success.set(status === 'approved' ? 'Perfil aprovado.' : 'Perfil rejeitado.');
        this.pendingAction.set(null);
      },
      error: (failure: Error) => this.actionError.set(failure.message)
    });
  }

  toggleUser(row: AdminRow, status: 'active' | 'suspended', reason: string): void {
    this.data.updateUserStatus(row.id, status, reason).subscribe({
      next: () => {
        this.rows.update((items) =>
          items.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  rawStatus: status,
                  status: status === 'active' ? 'Ativo' : 'Suspenso',
                  tone: status === 'active' ? 'success' : 'danger'
                }
              : item
          )
        );
        this.success.set(status === 'active' ? 'Cliente reativado.' : 'Cliente suspenso.');
        this.pendingAction.set(null);
      },
      error: (failure: Error) => this.actionError.set(failure.message)
    });
  }

  resolveReport(row: AdminRow, action: 'hide' | 'retain', note: string): void {
    this.data.resolveContentReport(row.id, action, note).subscribe({
      next: () => {
        this.rows.update((items) =>
          items.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: action === 'hide' ? 'Resolvida — ocultado' : 'Descartada — mantido',
                  tone: action === 'hide' ? 'danger' : 'neutral',
                  rawStatus: action === 'hide' ? 'resolved' : 'dismissed'
                }
              : item
          )
        );
        this.success.set(
          action === 'hide'
            ? 'Conteúdo ocultado e decisão registrada.'
            : 'Conteúdo mantido e decisão registrada.'
        );
        this.pendingAction.set(null);
      },
      error: (failure: Error) => this.actionError.set(failure.message)
    });
  }

  goTo(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.page.set(page);
    this.load();
  }
  actionLabel(status: string): string {
    return (
      (
        {
          approved: 'aprovar prestador',
          rejected: 'rejeitar prestador',
          active: 'ativar cliente',
          suspended: 'suspender cliente',
          hide: 'ocultar conteúdo denunciado',
          retain: 'manter conteúdo denunciado'
        } as Record<string, string>
      )[status] ?? status
    );
  }

  createService(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity() || this.acting()) return;
    const data = new FormData(form);
    const priceCents = this.toBaseCents(data.get('price'));
    if (!Number.isFinite(priceCents) || priceCents < 100 || priceCents > 10000000) {
      this.actionError.set('Informe um preço-base válido.');
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace
      .adminCreateService({
        categoryId: String(data.get('categoryId')),
        name: String(data.get('name')).trim(),
        pricingType: String(data.get('pricingType')),
        priceCents,
        defaultDurationMinutes: Number(data.get('duration')),
        shortDescription: String(data.get('description')).trim() || null
      })
      .subscribe({
        next: () => {
          this.success.set('Serviço criado no catálogo.');
          this.acting.set(false);
          form.reset();
          this.load();
        },
        error: (failure: Error) => {
          this.actionError.set(failure.message);
          this.acting.set(false);
        }
      });
  }

  minimumDisplayPrice(): number {
    return displayReferenceBound(100, 'BRL', this.localization.currency(), 'minimum');
  }
  maximumDisplayPrice(): number {
    return displayReferenceBound(10000000, 'BRL', this.localization.currency(), 'maximum');
  }

  private pageKey(): AdminPageKey {
    const value = String(this.route.snapshot.data['page'] ?? 'bookings');
    return isAdminPageKey(value) ? value : 'bookings';
  }

  private toBaseCents(value: FormDataEntryValue | number | null): number {
    return typeof value === 'string' || typeof value === 'number'
      ? referenceAmountToCents(String(value), this.localization.currency(), 'BRL')
      : NaN;
  }
}
