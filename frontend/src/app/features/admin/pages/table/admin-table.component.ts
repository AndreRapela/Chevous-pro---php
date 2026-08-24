import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ServiceCategory } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { AdminTableDataService } from '../../data-access/admin-table-data.service';
import { ADMIN_PAGES, isAdminPageKey } from '../../data/admin-page.config';
import { AdminPageKey, AdminRow } from '../../models/admin-page.model';

@Component({
  selector: 'cvp-admin-table',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page">
      <cvp-page-header [eyebrow]="config.eyebrow" [title]="config.title" [description]="config.description">@if (config.demo) { <span class="chip chip-soft">Demonstração</span> }</cvp-page-header>
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (key === 'catalog') { <details class="portal-card admin-create-panel"><summary>Adicionar serviço ao catálogo</summary><form class="inline-action-form" (submit)="createService($event)"><div class="form-grid"><label>Categoria<select name="categoryId" required><option value="">Selecione</option>@for (category of categories(); track category.id) { <option [value]="category.id">{{ category.name }}</option> }</select></label><label>Nome<input name="name" required minlength="2" maxlength="120"></label><label>Forma de cobrança<select name="pricingType" required><option value="fixed">Valor fixo</option><option value="hourly">Por hora</option><option value="area">Por m²</option></select></label><label>Preço-base (R$)<input name="price" type="number" min="1" step="0.01" required></label><label>Duração padrão (min)<input name="duration" type="number" min="30" max="1440" step="30" value="120" required></label><label class="span-two">Descrição curta<input name="description" maxlength="250"></label></div><button class="btn btn-primary btn-small" type="submit" [disabled]="acting()">Criar serviço</button></form></details> }
      @if (key === 'coupons') { <details class="portal-card admin-create-panel"><summary>Criar cupom</summary><form class="inline-action-form" (submit)="createCoupon($event)"><div class="form-grid"><label>Código<input name="code" required minlength="3" maxlength="50"></label><label>Nome<input name="name" required maxlength="120"></label><label>Tipo<select name="discountType"><option value="percent">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>Desconto<input name="discountValue" type="number" min="1" step="1" required></label><label>Pedido mínimo (R$)<input name="minimumOrder" type="number" min="0" step="0.01" value="0"></label><label>Limite de usos <span class="optional">Opcional</span><input name="usageLimit" type="number" min="1"></label><label>Início <span class="optional">Opcional</span><input name="startsAt" type="datetime-local"></label><label>Fim <span class="optional">Opcional</span><input name="endsAt" type="datetime-local"></label></div><button class="btn btn-primary btn-small" type="submit" [disabled]="acting()">Criar cupom</button></form></details> }
      <section class="portal-card admin-table-card">
        <div class="admin-filters"><label class="search-field"><span aria-hidden="true">⌕</span><span class="sr-only">Buscar</span><input [(ngModel)]="query" placeholder="Buscar nos resultados carregados"></label><select [(ngModel)]="status" aria-label="Filtrar por status"><option value="">Todos os status</option><option value="success">Ativos e concluídos</option><option value="warning">Pendentes</option><option value="danger">Atenção</option></select><button class="btn btn-secondary btn-small" type="button" (click)="load()">Atualizar</button></div>
        @if (loading()) { <cvp-state-panel kind="loading" /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Dados indisponíveis" [message]="error()" (retry)="load()" /> }
        @else if (!filteredRows().length) { <cvp-state-panel kind="empty" title="Nenhum resultado" message="Ajuste a busca ou remova os filtros." /> }
        @else { <div class="table-wrap"><table class="admin-table"><thead><tr>@for (column of config.columns; track column) { <th>{{ column }}</th> }<th>Status</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>@for (row of filteredRows(); track row.id) { <tr><td><strong>{{ row.primary }}</strong><small>{{ row.secondary }}</small></td>@for (cell of row.cells; track $index) { <td>{{ cell }}</td> }<td><span class="admin-status" [class]="'admin-status ' + row.tone">{{ row.status }}</span></td><td>@if (key === 'providers') { <div class="card-actions"><button class="btn btn-primary btn-small" type="button" (click)="requestAction(row, 'approved')">Aprovar</button><button class="btn btn-danger btn-small" type="button" (click)="requestAction(row, 'rejected')">Rejeitar</button></div> } @else if (key === 'customers') { <button class="btn btn-secondary btn-small" type="button" (click)="requestAction(row, row.rawStatus === 'suspended' ? 'active' : 'suspended')">{{ row.rawStatus === 'suspended' ? 'Ativar' : 'Suspender' }}</button> } @else { <span class="muted">—</span> }</td></tr> }</tbody></table></div><div class="pagination"><span>Mostrando {{ filteredRows().length }} de {{ total() }} registros · página {{ page() }} de {{ lastPage() }}</span>@if (lastPage() > 1) { <div class="card-actions"><button class="btn btn-secondary btn-small" type="button" [disabled]="page() <= 1" (click)="goTo(page() - 1)">Anterior</button><button class="btn btn-secondary btn-small" type="button" [disabled]="page() >= lastPage()" (click)="goTo(page() + 1)">Próxima</button></div> }</div> }
        @if (pendingAction(); as pending) { <form class="inline-action-form admin-confirm-action" (submit)="confirmAction($event)"><h2>Confirmar: {{ actionLabel(pending.status) }}</h2><p>Esta ação será registrada no histórico administrativo.</p><label>Justificativa<textarea required minlength="3" maxlength="1000" placeholder="Explique o motivo da alteração"></textarea></label><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" (click)="pendingAction.set(null)">Voltar</button><button class="btn btn-danger btn-small" type="submit">Confirmar ação</button></div></form> }
      </section>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTableComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly data = inject(AdminTableDataService);
  private readonly marketplace = inject(MarketplaceService);
  readonly key: AdminPageKey = this.pageKey();
  readonly config = ADMIN_PAGES[this.key];
  readonly rows = signal<AdminRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly pendingAction = signal<{ row: AdminRow; status: 'approved' | 'rejected' | 'active' | 'suspended' } | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly acting = signal(false);
  readonly categories = signal<ServiceCategory[]>([]);
  query = '';
  status = '';

  ngOnInit(): void { this.load(); if (this.key === 'catalog') this.marketplace.categories().subscribe({ next: (categories) => this.categories.set(categories), error: (failure: Error) => this.actionError.set(failure.message) }); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.data.load(this.key, this.page()).subscribe({
      next: (result) => { this.rows.set(result.rows); this.total.set(result.total); this.page.set(result.page); this.lastPage.set(result.lastPage); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  filteredRows(): AdminRow[] {
    const query = this.query.trim().toLocaleLowerCase('pt-BR');
    return this.rows().filter((row) => (!this.status || row.tone === this.status) && (!query || `${row.primary} ${row.secondary} ${row.cells.join(' ')} ${row.status}`.toLocaleLowerCase('pt-BR').includes(query)));
  }

  requestAction(row: AdminRow, status: 'approved' | 'rejected' | 'active' | 'suspended'): void { this.pendingAction.set({ row, status }); }
  confirmAction(event: Event): void {
    event.preventDefault(); const pending = this.pendingAction(); if (!pending) return;
    const reason = (event.currentTarget as HTMLFormElement).querySelector('textarea')?.value.trim() ?? '';
    if (reason.length < 3) return;
    if (pending.status === 'approved' || pending.status === 'rejected') this.reviewProvider(pending.row, pending.status, reason);
    else this.toggleUser(pending.row, pending.status, reason);
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
      next: () => { this.rows.update((items) => items.map((item) => item.id === row.id ? { ...item, rawStatus: status, status: status === 'active' ? 'Ativo' : 'Suspenso', tone: status === 'active' ? 'success' : 'danger' } : item)); this.success.set(status === 'active' ? 'Cliente reativado.' : 'Cliente suspenso.'); this.pendingAction.set(null); },
      error: (failure: Error) => this.actionError.set(failure.message)
    });
  }

  goTo(page: number): void { if (page < 1 || page > this.lastPage()) return; this.page.set(page); this.load(); }
  actionLabel(status: string): string { return ({ approved: 'aprovar prestador', rejected: 'rejeitar prestador', active: 'ativar cliente', suspended: 'suspender cliente' } as Record<string, string>)[status] ?? status; }

  createService(event: Event): void {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; if (!form.reportValidity() || this.acting()) return; const data = new FormData(form);
    this.acting.set(true); this.actionError.set('');
    this.marketplace.adminCreateService({ categoryId: String(data.get('categoryId')), name: String(data.get('name')).trim(), pricingType: String(data.get('pricingType')), priceCents: Math.round(Number(data.get('price')) * 100), defaultDurationMinutes: Number(data.get('duration')), shortDescription: String(data.get('description')).trim() || null }).subscribe({ next: () => { this.success.set('Serviço criado no catálogo.'); this.acting.set(false); form.reset(); this.load(); }, error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); } });
  }

  createCoupon(event: Event): void {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; if (!form.reportValidity() || this.acting()) return; const data = new FormData(form); const discountType = String(data.get('discountType')); const startsAt = this.apiDate(String(data.get('startsAt') ?? '')); const endsAt = this.apiDate(String(data.get('endsAt') ?? ''));
    if (startsAt && endsAt && endsAt <= startsAt) { this.actionError.set('O término do cupom precisa ser posterior ao início.'); return; }
    this.acting.set(true); this.actionError.set('');
    this.marketplace.adminCreateCoupon({ code: String(data.get('code')).trim().toUpperCase(), name: String(data.get('name')).trim(), discountType, discountValue: discountType === 'fixed' ? Math.round(Number(data.get('discountValue')) * 100) : Number(data.get('discountValue')), minimumOrderCents: Math.round(Number(data.get('minimumOrder') || 0) * 100), usageLimit: data.get('usageLimit') ? Number(data.get('usageLimit')) : null, startsAt, endsAt, active: true }).subscribe({ next: () => { this.success.set('Cupom criado.'); this.acting.set(false); form.reset(); this.load(); }, error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); } });
  }

  private pageKey(): AdminPageKey {
    const value = String(this.route.snapshot.data['page'] ?? 'bookings');
    return isAdminPageKey(value) ? value : 'bookings';
  }

  private apiDate(value: string): string | null { return value ? `${value.replace('T', ' ')}:00` : null; }

}
