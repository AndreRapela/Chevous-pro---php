import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Product } from '../../../../core/models';
import { StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { SeoService } from '../../../../core/seo/seo.service';

@Component({
  selector: 'cvp-products',
  standalone: true,
  imports: [FormsModule, LocalizedMoneyPipe, StatePanelComponent],
  template: `
    <section class="page-hero store-hero">
      <div class="container store-hero-inner">
        <div><span class="eyebrow">Loja ChezVoust</span><h1>Produtos para facilitar o cuidado com a casa.</h1><p>Utilidades selecionadas para limpeza, organização e manutenção da sua rotina.</p></div>
        <form class="search-field store-search" role="search" (ngSubmit)="load()">
          <span aria-hidden="true">⌕</span><label class="sr-only" for="product-search">Buscar produtos</label>
          <input id="product-search" name="productQuery" [(ngModel)]="query" placeholder="Buscar na loja">
          <button class="btn btn-primary btn-small" type="submit">Buscar</button>
        </form>
      </div>
    </section>

    <section class="section store-results" aria-labelledby="products-title">
      <div class="container">
        <div class="section-heading"><div><span class="eyebrow">Escolhas para sua casa</span><h2 id="products-title">Produtos disponíveis</h2></div>@if (!loading() && !error()) { <span class="muted">{{ products().length }} {{ products().length === 1 ? 'produto' : 'produtos' }}</span> }</div>
        @if (loading()) { <cvp-state-panel kind="loading" message="Carregando os produtos da loja." /> }
        @else if (error()) { <cvp-state-panel kind="error" title="Não conseguimos carregar a loja" [message]="error()" (retry)="load()" /> }
        @else if (!products().length) { <cvp-state-panel kind="empty" title="Nenhum produto encontrado" message="Tente buscar por outro termo." /> }
        @else {
          <div class="product-grid">
            @for (product of products(); track product.id) {
              <article class="product-card" [class.product-featured]="product.featured">
                <div class="product-media">
                  @if (product.imageUrl) { <img data-cvp-no-localize [src]="product.imageUrl" [alt]="product.name" width="720" height="480" loading="lazy" decoding="async"> }
                  @else { <span class="product-placeholder" aria-hidden="true">⌂</span> }
                  @if (product.badgeText) { <span class="product-badge" data-cvp-no-localize>{{ product.badgeText }}</span> }
                </div>
                <div class="product-copy">
                  <h2 data-cvp-no-localize>{{ product.name }}</h2>
                  <p data-cvp-no-localize>{{ product.shortDescription }}</p>
                  <div class="product-price">
                    @if (product.compareAtPriceCents && product.compareAtPriceCents > product.priceCents) { <del>{{ product.compareAtPriceCents / 100 | appMoney:product.currency }}</del> }
                    <strong>{{ product.priceCents / 100 | appMoney:product.currency }}</strong>
                  </div>
                  <div class="product-stock" [class.out-of-stock]="product.inventoryCount < 1"><span aria-hidden="true"></span>{{ product.inventoryCount > 0 ? 'Disponível para compra' : 'Temporariamente indisponível' }}</div>
                  <a class="btn btn-primary product-buy" [class.disabled]="product.inventoryCount < 1" [attr.aria-disabled]="product.inventoryCount < 1" [attr.tabindex]="product.inventoryCount < 1 ? -1 : null" [attr.href]="product.inventoryCount > 0 ? product.purchaseUrl : null" [attr.rel]="external(product.purchaseUrl) ? 'noopener noreferrer' : null">Comprar agora <span aria-hidden="true">→</span></a>
                </div>
              </article>
            }
          </div>
          <p class="store-disclaimer">A compra é concluída no endereço indicado em cada produto. Valores, frete e disponibilidade são confirmados antes da finalização.</p>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly seo = inject(SeoService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';

  ngOnInit(): void {
    this.seo.update({ title: 'Produtos para casa | Pro', description: 'Encontre utilidades selecionadas para cuidar, organizar e manter sua casa.', canonicalPath: '/produtos' });
    this.load();
  }

  load(): void {
    this.loading.set(true); this.error.set('');
    this.marketplace.products({ q: this.query.trim() || undefined }).subscribe({
      next: (products) => { this.products.set(products); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  external(url: string): boolean { return /^https:\/\//i.test(url); }
}
