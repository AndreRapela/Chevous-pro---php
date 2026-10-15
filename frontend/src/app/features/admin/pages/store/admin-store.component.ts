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
  templateUrl: './admin-store.component.html',
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

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      promotions: this.marketplace.adminPromotions(),
      products: this.marketplace.adminProducts()
    }).subscribe({
      next: ({ promotions, products }) => {
        this.promotionDraft = { ...(promotions[0] ?? this.emptyPromotion()) };
        this.products.set(products);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  savePromotion(valid: boolean): void {
    if (!valid || this.saving()) return;
    this.beginSave();
    const request = this.promotionDraft.id
      ? this.marketplace.adminUpdatePromotion(this.promotionDraft.id, this.promotionPayload())
      : this.marketplace.adminCreatePromotion(this.promotionPayload());
    request.subscribe({
      next: () => {
        this.success.set('Campanha atualizada na home.');
        this.saving.set(false);
        this.load();
      },
      error: (failure: Error) => this.failSave(failure)
    });
  }

  startNewProduct(): void {
    this.productDraft = this.emptyProduct();
    this.productPrice = null;
    this.productComparePrice = null;
    this.editingProduct.set(true);
    this.clearMessages();
  }
  editProduct(product: Product): void {
    this.productDraft = { ...product };
    this.productPrice = product.priceCents / 100;
    this.productComparePrice =
      product.compareAtPriceCents == null ? null : product.compareAtPriceCents / 100;
    this.editingProduct.set(true);
    this.clearMessages();
  }
  cancelProductEdit(): void {
    this.editingProduct.set(false);
  }

  saveProduct(valid: boolean): void {
    if (!valid || this.saving() || this.productPrice == null) return;
    this.beginSave();
    const payload: Record<string, unknown> = {
      name: this.productDraft.name.trim(),
      slug: this.productDraft.slug.trim() || undefined,
      shortDescription: this.productDraft.shortDescription.trim() || null,
      priceCents: Math.round(this.productPrice * 100),
      compareAtPriceCents:
        this.productComparePrice == null ? null : Math.round(this.productComparePrice * 100),
      currency: this.productDraft.currency,
      imageUrl: this.productDraft.imageUrl?.trim() || null,
      purchaseUrl: this.productDraft.purchaseUrl.trim(),
      badgeText: this.productDraft.badgeText.trim() || null,
      inventoryCount: Number(this.productDraft.inventoryCount) || 0,
      featured: this.productDraft.featured,
      active: this.productDraft.active,
      sortOrder: Number(this.productDraft.sortOrder) || 0
    };
    const request = this.productDraft.id
      ? this.marketplace.adminUpdateProduct(this.productDraft.id, payload)
      : this.marketplace.adminCreateProduct(payload);
    request.subscribe({
      next: () => {
        this.success.set(
          this.productDraft.id ? 'Produto atualizado.' : 'Produto criado e adicionado à loja.'
        );
        this.saving.set(false);
        this.editingProduct.set(false);
        this.load();
      },
      error: (failure: Error) => this.failSave(failure)
    });
  }

  private promotionPayload(): Record<string, unknown> {
    return {
      title: this.promotionDraft.title.trim(),
      subtitle: this.promotionDraft.subtitle.trim() || null,
      ctaLabel: this.promotionDraft.ctaLabel.trim() || null,
      ctaUrl: this.promotionDraft.ctaUrl.trim() || null,
      imageUrl: this.promotionDraft.imageUrl?.trim() || null,
      badgeText: this.promotionDraft.badgeText.trim() || null,
      termsText: this.promotionDraft.termsText.trim() || null,
      backgroundColor: this.promotionDraft.backgroundColor,
      textColor: this.promotionDraft.textColor,
      active: this.promotionDraft.active,
      sortOrder: this.promotionDraft.sortOrder ?? 0
    };
  }

  private beginSave(): void {
    this.clearMessages();
    this.saving.set(true);
  }
  private failSave(failure: Error): void {
    this.actionError.set(failure.message);
    this.saving.set(false);
  }
  private clearMessages(): void {
    this.success.set('');
    this.actionError.set('');
  }
  private emptyPromotion(): PromotionDraft {
    return {
      title: '',
      subtitle: '',
      ctaLabel: 'Ver produtos',
      ctaUrl: '/produtos',
      imageUrl: '/images/promo-laundry-discount-v1.webp',
      badgeText: 'Novidades na loja',
      termsText: '',
      backgroundColor: '#096653',
      textColor: '#FFFFFF',
      active: true,
      sortOrder: 10
    };
  }
  private emptyProduct(): ProductDraft {
    return {
      name: '',
      slug: '',
      shortDescription: '',
      priceCents: 0,
      compareAtPriceCents: null,
      currency: 'BRL',
      imageUrl: null,
      purchaseUrl: '/ajuda?produto=',
      badgeText: '',
      inventoryCount: 0,
      featured: false,
      active: true,
      sortOrder: 0
    };
  }
}
