import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminProductOrder, ProductOrderService } from '../../../../core/data-access/product-order.service';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-store-orders',
  standalone: true,
  imports: [RouterLink, PageHeaderComponent, StatePanelComponent, LocalizedDatePipe],
  template: `
    <section class="portal-page">
      <cvp-page-header eyebrow="Loja ChezVoust" title="Pedidos da loja" description="Acompanhe os pagamentos dos produtos.">
        <a class="btn btn-secondary btn-small" routerLink="/admin/conteudo">Site e loja</a>
      </cvp-page-header>
      @if (loading()) { <cvp-state-panel kind="loading" message="Carregando os pedidos." /> }
      @else if (error()) { <cvp-state-panel kind="error" [message]="error()" (retry)="load(page())" /> }
      @else if (!orders().length) { <cvp-state-panel kind="empty" title="Nenhum pedido ainda" /> }
      @else {
        <div class="portal-card orders-table">
          <table>
            <thead><tr><th scope="col">Pedido</th><th scope="col">Produto</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col">Data</th><th scope="col">Pagamento</th></tr></thead>
            <tbody>
              @for (order of orders(); track order.id) {
                <tr>
                  <td data-cvp-no-localize>{{ order.id }}</td>
                  <td>{{ order.productName }} · {{ order.quantity }}</td>
                  <td>{{ amount(order) }}</td>
                  <td>{{ { pending: 'Pagamento pendente', paid: 'Pagamento confirmado', expired: 'Prazo do pagamento encerrado' }[order.status] }}</td>
                  <td>{{ order.createdAt | appDate:'short' }}</td>
                  <td><a [href]="stripePaymentsUrl(order)" target="_blank" rel="noopener noreferrer">Pagamentos no Stripe</a><small data-cvp-no-localize>{{ order.providerSessionId }}</small></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (lastPage() > 1) {
          <div class="order-pagination">
            <button type="button" class="btn btn-secondary btn-small" [disabled]="page() <= 1" (click)="load(page() - 1)">Anterior</button>
            <span>{{ page() }} / {{ lastPage() }}</span>
            <button type="button" class="btn btn-secondary btn-small" [disabled]="page() >= lastPage()" (click)="load(page() + 1)">Próxima</button>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .orders-table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .65rem .7rem; white-space: nowrap; border-bottom: 1px solid var(--ink-200); text-align: start; }
    table a { text-decoration: underline; }
    table small { display: block; font-size: .75rem; color: var(--ink-600); }
    .order-pagination { display: flex; align-items: center; justify-content: center; gap: .65rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoreOrdersComponent implements OnInit {
  private readonly service = inject(ProductOrderService);
  private readonly localization = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly orders = signal<AdminProductOrder[]>([]);
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    this.service.adminOrders(page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data, meta }) => {
        this.orders.set(data);
        this.page.set(page);
        this.lastPage.set(Math.max(page, Number(meta?.['lastPage']) || page));
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  amount(order: AdminProductOrder): string {
    return new Intl.NumberFormat(this.localization.locale(), { style: 'currency', currency: order.currency }).format(order.totalCents / 100);
  }

  stripePaymentsUrl(order: AdminProductOrder): string {
    return order.testMode ? 'https://dashboard.stripe.com/test/payments' : 'https://dashboard.stripe.com/payments';
  }
}
