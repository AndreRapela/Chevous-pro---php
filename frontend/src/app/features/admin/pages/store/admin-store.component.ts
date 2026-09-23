import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Product, Promotion } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

type PromotionDraft = Omit<Promotion, 'id'> & { id?: string };
type ProductDraft = Omit<Product, 'id'> & { id?: string };

@Component({
  selector: 'cvp-admin-store',
  standalone: true,
  imports: [FormsModule, LocalizedMoneyPipe, PageHeaderComponent, StatePanelComponent],
  template: `
    <section class="portal-page admin-store-page">
      <cvp-page-header eyebrow="Conteúdo do site" title="Site e loja" description="Edite a publicidade da home e todos os produtos exibidos na loja.">
        <a class="btn btn-secondary btn-small" href="/produtos" target="_blank" rel="noopener">Abrir loja</a>
      </cvp-page-header>

      <aside class="admin-locked-note"><span aria-hidden="true">◈</span><div><strong>Outdoor inicial protegido</strong><p>O banner principal do início não aparece neste editor e permanece inalterável, conforme definido.</p></div></aside>

      @if (loading()) { <cvp-state-panel kind="loading" message="Carregando o conteúdo da loja." /> }
      @else if (error()) { <cvp-state-panel kind="error" title="Conteúdo indisponível" [message]="error()" (retry)="load()" /> }
      @else {
        @if (success()) { <p class="success-message" role="status">{{ success() }}</p> }
        @if (actionError()) { <p class="field-error" role="alert">{{ actionError() }}</p> }

        <section class="portal-card admin-content-editor" aria-labelledby="campaign-editor-title">
          <div class="card-title-row"><div><span class="eyebrow">Publicidade da home</span><h2 id="campaign-editor-title">Campanha em destaque</h2></div><span class="admin-status" [class]="promotionDraft.active ? 'admin-status success' : 'admin-status neutral'">{{ promotionDraft.active ? 'Publicada' : 'Oculta' }}</span></div>
          <div class="admin-editor-layout">
            <form class="admin-editor-form" #promotionForm="ngForm" (ngSubmit)="savePromotion(promotionForm.valid === true)">
              <div class="form-grid">
                <label class="span-two">Título<input name="promotionTitle" [(ngModel)]="promotionDraft.title" required minlength="3" maxlength="160"></label>
                <label class="span-two">Descrição<textarea name="promotionSubtitle" [(ngModel)]="promotionDraft.subtitle" maxlength="300" rows="3"></textarea></label>
                <label>Selo<input name="promotionBadge" [(ngModel)]="promotionDraft.badgeText" maxlength="80" placeholder="Ex.: Novidades na loja"></label>
                <label>Texto do botão<input name="promotionCta" [(ngModel)]="promotionDraft.ctaLabel" maxlength="60" placeholder="Ver produtos"></label>
                <label class="span-two">Destino do botão<input data-cvp-no-localize name="promotionUrl" [(ngModel)]="promotionDraft.ctaUrl" required maxlength="255" placeholder="/produtos"></label>
                <label class="span-two">URL da arte<input data-cvp-no-localize name="promotionImage" [(ngModel)]="promotionDraft.imageUrl" maxlength="1024" placeholder="/images/minha-campanha.webp"></label>
                <label class="span-two">Condições<small>Aparecem abaixo da publicidade.</small><input name="promotionTerms" [(ngModel)]="promotionDraft.termsText" maxlength="300"></label>
                <label>Cor do fundo<input name="promotionBackground" [(ngModel)]="promotionDraft.backgroundColor" type="color"></label>
                <label>Cor do texto<input name="promotionText" [(ngModel)]="promotionDraft.textColor" type="color"></label>
                <label class="toggle-line span-two"><input name="promotionActive" [(ngModel)]="promotionDraft.active" type="checkbox"> Exibir esta campanha na home</label>
              </div>
              <button class="btn btn-primary" type="submit" [disabled]="saving() || promotionForm.invalid">{{ saving() ? 'Salvando…' : 'Salvar campanha' }}</button>
            </form>
            <div class="admin-campaign-preview">
              <span>Prévia</span>
              <article data-cvp-no-localize [style.background]="promotionDraft.backgroundColor" [style.color]="promotionDraft.textColor">
                <div><small>{{ promotionDraft.badgeText || 'Selo da campanha' }}</small><h3>{{ promotionDraft.title || 'Título da campanha' }}</h3><p>{{ promotionDraft.subtitle || 'Descrição da publicidade.' }}</p><b>{{ promotionDraft.ctaLabel || 'Ver produtos' }} →</b></div>
                @if (promotionDraft.imageUrl) { <img [src]="promotionDraft.imageUrl" alt="Prévia da arte da campanha"> }
              </article>
            </div>
          </div>
        </section>

        <section class="portal-card admin-products-card" aria-labelledby="products-editor-title">
          <div class="card-title-row"><div><span class="eyebrow">Rota /produtos</span><h2 id="products-editor-title">Produtos da loja</h2></div><button class="btn btn-primary btn-small" type="button" (click)="startNewProduct()">Adicionar produto</button></div>
          @if (editingProduct()) {
            <form class="admin-product-form" #productForm="ngForm" (ngSubmit)="saveProduct(productForm.valid === true)">
              <div class="card-title-row"><h3>{{ productDraft.id ? 'Editar produto' : 'Novo produto' }}</h3><button class="text-button" type="button" (click)="cancelProductEdit()">Fechar</button></div>
              <div class="form-grid">
                <label>Nome<input name="productName" [(ngModel)]="productDraft.name" required minlength="2" maxlength="160"></label>
                <label>Identificador da URL<input name="productSlug" [(ngModel)]="productDraft.slug" maxlength="180" placeholder="gerado pelo nome"></label>
                <label class="span-two">Descrição<textarea name="productDescription" [(ngModel)]="productDraft.shortDescription" maxlength="300" rows="3"></textarea></label>
                <label>Preço<input name="productPrice" [(ngModel)]="productPrice" type="number" min="0.01" max="1000000" step="0.01" required></label>
                <label>Preço anterior<input name="productComparePrice" [(ngModel)]="productComparePrice" type="number" min="0.01" max="1000000" step="0.01" placeholder="Opcional"></label>
                <label>Estoque<input name="productStock" [(ngModel)]="productDraft.inventoryCount" type="number" min="0" max="1000000" step="1" required></label>
                <label>Selo<input name="productBadge" [(ngModel)]="productDraft.badgeText" maxlength="80" placeholder="Ex.: Mais vendido"></label>
                <label class="span-two">URL da imagem<input data-cvp-no-localize name="productImage" [(ngModel)]="productDraft.imageUrl" maxlength="1024" placeholder="/images/produto.webp"></label>
                <label class="span-two">Link para concluir a compra<input data-cvp-no-localize name="productPurchase" [(ngModel)]="productDraft.purchaseUrl" required maxlength="1024" placeholder="/ajuda?produto=... ou https://..."></label>
                <label>Ordem de exibição<input name="productOrder" [(ngModel)]="productDraft.sortOrder" type="number" min="0" max="999" step="1"></label>
                <div class="admin-checks"><label class="toggle-line"><input name="productFeatured" [(ngModel)]="productDraft.featured" type="checkbox"> Produto em destaque</label><label class="toggle-line"><input name="productActive" [(ngModel)]="productDraft.active" type="checkbox"> Produto publicado</label></div>
              </div>
              <div class="card-actions"><button class="btn btn-secondary" type="button" (click)="cancelProductEdit()">Cancelar</button><button class="btn btn-primary" type="submit" [disabled]="saving() || productForm.invalid">{{ saving() ? 'Salvando…' : 'Salvar produto' }}</button></div>
            </form>
          }

          @if (!products().length) { <cvp-state-panel kind="empty" title="Nenhum produto cadastrado" message="Adicione o primeiro item da loja." /> }
          @else {
            <div class="admin-product-list">
              @for (product of products(); track product.id) {
                <article>
                  <div class="admin-product-thumb" data-cvp-no-localize>@if (product.imageUrl) { <img [src]="product.imageUrl" alt=""> } @else { <span aria-hidden="true">⌂</span> }</div>
                  <div class="admin-product-info" data-cvp-no-localize><div><strong>{{ product.name }}</strong>@if (product.badgeText) { <span>{{ product.badgeText }}</span> }</div><small>{{ product.shortDescription || 'Sem descrição' }}</small><b>{{ product.priceCents / 100 | appMoney:product.currency }}</b></div>
                  <div class="admin-product-meta"><span class="admin-status" [class]="product.active ? 'admin-status success' : 'admin-status neutral'">{{ product.active ? 'Publicado' : 'Oculto' }}</span><small>{{ product.inventoryCount }} em estoque</small><button class="btn btn-secondary btn-small" type="button" (click)="editProduct(product)">Editar</button></div>
                </article>
              }
            </div>
          }
        </section>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminStoreComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly editingProduct = signal(false);
  promotionDraft: PromotionDraft = this.emptyPromotion();
  productDraft: ProductDraft = this.emptyProduct();
  productPrice: number | null = null;
  productComparePrice: number | null = null;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ promotions: this.marketplace.adminPromotions(), products: this.marketplace.adminProducts() }).subscribe({
      next: ({ promotions, products }) => { this.promotionDraft = { ...(promotions[0] ?? this.emptyPromotion()) }; this.products.set(products); this.loading.set(false); },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  savePromotion(valid: boolean): void {
    if (!valid || this.saving()) return;
    this.beginSave();
    const request = this.promotionDraft.id
      ? this.marketplace.adminUpdatePromotion(this.promotionDraft.id, this.promotionPayload())
      : this.marketplace.adminCreatePromotion(this.promotionPayload());
    request.subscribe({ next: () => { this.success.set('Campanha atualizada na home.'); this.saving.set(false); this.load(); }, error: (failure: Error) => this.failSave(failure) });
  }

  startNewProduct(): void { this.productDraft = this.emptyProduct(); this.productPrice = null; this.productComparePrice = null; this.editingProduct.set(true); this.clearMessages(); }
  editProduct(product: Product): void { this.productDraft = { ...product }; this.productPrice = product.priceCents / 100; this.productComparePrice = product.compareAtPriceCents == null ? null : product.compareAtPriceCents / 100; this.editingProduct.set(true); this.clearMessages(); }
  cancelProductEdit(): void { this.editingProduct.set(false); }

  saveProduct(valid: boolean): void {
    if (!valid || this.saving() || this.productPrice == null) return;
    this.beginSave();
    const payload: Record<string, unknown> = {
      name: this.productDraft.name.trim(), slug: this.productDraft.slug.trim() || undefined,
      shortDescription: this.productDraft.shortDescription.trim() || null, priceCents: Math.round(this.productPrice * 100),
      compareAtPriceCents: this.productComparePrice == null ? null : Math.round(this.productComparePrice * 100),
      currency: this.productDraft.currency, imageUrl: this.productDraft.imageUrl?.trim() || null,
      purchaseUrl: this.productDraft.purchaseUrl.trim(), badgeText: this.productDraft.badgeText.trim() || null,
      inventoryCount: Number(this.productDraft.inventoryCount) || 0, featured: this.productDraft.featured,
      active: this.productDraft.active, sortOrder: Number(this.productDraft.sortOrder) || 0
    };
    const request = this.productDraft.id
      ? this.marketplace.adminUpdateProduct(this.productDraft.id, payload)
      : this.marketplace.adminCreateProduct(payload);
    request.subscribe({
      next: () => { this.success.set(this.productDraft.id ? 'Produto atualizado.' : 'Produto criado e adicionado à loja.'); this.saving.set(false); this.editingProduct.set(false); this.load(); },
      error: (failure: Error) => this.failSave(failure)
    });
  }

  private promotionPayload(): Record<string, unknown> {
    return {
      title: this.promotionDraft.title.trim(), subtitle: this.promotionDraft.subtitle.trim() || null,
      ctaLabel: this.promotionDraft.ctaLabel.trim() || null, ctaUrl: this.promotionDraft.ctaUrl.trim() || null,
      imageUrl: this.promotionDraft.imageUrl?.trim() || null, badgeText: this.promotionDraft.badgeText.trim() || null,
      termsText: this.promotionDraft.termsText.trim() || null, backgroundColor: this.promotionDraft.backgroundColor,
      textColor: this.promotionDraft.textColor, active: this.promotionDraft.active, sortOrder: this.promotionDraft.sortOrder ?? 0
    };
  }

  private beginSave(): void { this.clearMessages(); this.saving.set(true); }
  private failSave(failure: Error): void { this.actionError.set(failure.message); this.saving.set(false); }
  private clearMessages(): void { this.success.set(''); this.actionError.set(''); }
  private emptyPromotion(): PromotionDraft { return { title: '', subtitle: '', ctaLabel: 'Ver produtos', ctaUrl: '/produtos', imageUrl: '/images/promo-laundry-discount-v1.webp', badgeText: 'Novidades na loja', termsText: '', backgroundColor: '#096653', textColor: '#FFFFFF', active: true, sortOrder: 10 }; }
  private emptyProduct(): ProductDraft { return { name: '', slug: '', shortDescription: '', priceCents: 0, compareAtPriceCents: null, currency: 'BRL', imageUrl: null, purchaseUrl: '/ajuda?produto=', badgeText: '', inventoryCount: 0, featured: false, active: true, sortOrder: 0 }; }
}
