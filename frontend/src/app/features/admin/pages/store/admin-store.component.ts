import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, OnInit, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, defer, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Product, Promotion, PromotionLink, PromotionMediaFrame, PromotionPlacement, Service } from '../../../../core/models';
import { PageHeaderComponent, StatePanelComponent } from '../../../../shared/components';
import { PromotionMediaComponent } from '../../../../shared/components/promotion-media/promotion-media.component';
import { LocalizedCatalogTextPipe, LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { DEFAULT_MEDIA_FRAME, promotionLinksAt } from '../../../../shared/utils/promotion-media.util';
import { MAX_PROMOTION_VIDEOS, NORMAL_ROTATION_WEIGHT } from '../../../../shared/utils/promotion-rotation.util';
import { CampaignCutoutComponent } from './campaign-cutout.component';
import { PromotionDraft, promotionPayload } from './campaign-draft';
import { MAX_CAMPAIGN_UPLOAD, MAX_CAMPAIGN_VIDEO_INPUT } from './campaign-media-limits';
import { CampaignPosterComponent } from './campaign-poster.component';
import { CampaignVideoOptimizerComponent } from './campaign-video-optimizer.component';
import { campaignVideoDuration } from './campaign-video-duration';

type ProductDraft = Omit<Product, 'id'> & { id?: string };

@Component({
  selector: 'cvp-admin-store',
  standalone: true,
  imports: [FormsModule, RouterLink, LocalizedCatalogTextPipe, LocalizedMoneyPipe, PageHeaderComponent, PromotionMediaComponent, CampaignCutoutComponent, CampaignPosterComponent, CampaignVideoOptimizerComponent, StatePanelComponent],
  templateUrl: './admin-store.component.html',
  styleUrl: './admin-store.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminStoreComponent implements OnDestroy, OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly injector = inject(Injector);
  private readonly promotionTitleField = viewChild<ElementRef<HTMLInputElement>>('promotionTitleField');
  readonly promotionPoster = viewChild<CampaignPosterComponent>('promotionPoster');
  readonly promotionOptimizer = viewChild<CampaignVideoOptimizerComponent>('promotionOptimizer');
  readonly promotions = signal<Promotion[]>([]);
  readonly products = signal<Product[]>([]);
  readonly campaignServices = signal<Service[]>([]);
  readonly campaignServicesLoading = signal(false);
  readonly campaignServicesError = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly editingPromotion = signal(false);
  readonly editingProduct = signal(false);
  readonly cutoutSource = signal('');
  readonly rotationOptions = ['Poucas vezes', 'Às vezes', 'Normalmente', 'Frequentemente', 'Maior frequência'];
  private savedVideoUrl: string | null = null;
  promotionDraft: PromotionDraft = this.emptyPromotion();
  productDraft: ProductDraft = this.emptyProduct();
  productPrice: number | null = null;
  productComparePrice: number | null = null;
  promotionUploadFile: File | null = null;
  promotionUploadFileName = '';
  promotionLocalPreviewUrl = '';
  get promotionPreviewUrl(): string { return this.promotionOptimizer()?.previewUrl() || this.promotionLocalPreviewUrl || this.promotionDraft.imageUrl || ''; }
  get effectiveMediaFrame(): PromotionMediaFrame | null {
    if (this.promotionDraft.placement === 'services') {
      return { ...DEFAULT_MEDIA_FRAME, fit: 'cover', ...this.promotionDraft.mediaFrame, layout: 'background' };
    }
    return this.promotionDraft.mediaFrame ?? (this.promotionDraft.mediaType === 'video' ? DEFAULT_MEDIA_FRAME : null);
  }
  get campaignServiceMissing(): boolean {
    const selected = this.promotionDraft.serviceId;
    return !!selected && !this.campaignServices().some((service) => service.id === selected);
  }

  ngOnDestroy(): void { this.releasePromotionPreview(); }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ promotions: this.marketplace.adminPromotions(), products: this.marketplace.adminProducts() }).subscribe({
      next: ({ promotions, products }) => {
        this.promotions.set(promotions);
        this.products.set(products);
        this.loading.set(false);
      },
      error: (failure: Error) => { this.error.set(failure.message); this.loading.set(false); }
    });
  }

  startNewPromotion(): void {
    this.savedVideoUrl = null;
    const lastOrder = Math.max(0, ...this.promotions().map((campaign) => campaign.sortOrder ?? 0));
    this.promotionDraft = { ...this.emptyPromotion(), sortOrder: Math.min(999, lastOrder + 10) };
    this.openPromotionEditor();
  }

  editPromotion(campaign: Promotion): void {
    this.savedVideoUrl = campaign.mediaType === 'video' ? campaign.imageUrl : null;
    this.promotionDraft = {
      ...campaign,
      serviceId: campaign.serviceId ?? null,
      secondaryLinks: campaign.secondaryLinks?.map((link) => ({ ...link, placement: link.placement ?? 'below' })) ?? []
    };
    if (campaign.placement === 'services') this.loadCampaignServices();
    this.openPromotionEditor();
  }

  setPromotionPlacement(placement: PromotionPlacement): void {
    this.promotionDraft.placement = placement;
    if (placement === 'services') {
      if (!this.promotionDraft.id && this.promotionDraft.ctaUrl === '/produtos' && this.promotionDraft.ctaLabel === 'Ver produtos') {
        this.promotionDraft.ctaUrl = '';
        this.promotionDraft.ctaLabel = '';
      }
      this.loadCampaignServices();
    } else {
      this.promotionDraft.serviceId = null;
      if (!this.promotionDraft.id && !this.promotionDraft.ctaUrl && !this.promotionDraft.ctaLabel) {
        this.promotionDraft.ctaUrl = '/produtos';
        this.promotionDraft.ctaLabel = 'Ver produtos';
      }
    }
  }

  loadCampaignServices(): void {
    if (this.campaignServices().length || this.campaignServicesLoading()) return;
    this.campaignServicesLoading.set(true);
    this.campaignServicesError.set('');
    this.marketplace.services().subscribe({
      next: (services) => {
        this.campaignServices.set(services);
        this.campaignServicesLoading.set(false);
      },
      error: (failure: Error) => {
        this.campaignServicesError.set(failure.message);
        this.campaignServicesLoading.set(false);
      }
    });
  }

  private openPromotionEditor(): void {
    this.clearMessages();
    this.editingPromotion.set(true);
    afterNextRender(() => this.promotionTitleField()?.nativeElement.focus(), { injector: this.injector });
  }

  cancelPromotionEdit(): void {
    this.cutoutSource.set('');
    this.clearSelectedPromotionMedia();
    this.clearMessages();
    this.editingPromotion.set(false);
  }

  savePromotion(valid: boolean): void {
    const optimizer = this.promotionOptimizer();
    if (!valid || !this.editingPromotion() || this.saving() || this.cutoutSource() || optimizer?.blocksSave()) return;
    const uploadFile = optimizer?.processed()?.file ?? this.promotionUploadFile;
    if (uploadFile && uploadFile.size > MAX_CAMPAIGN_UPLOAD) return;
    const source = uploadFile ?? this.promotionDraft.imageUrl?.trim();
    const video = this.promotionDraft.mediaType === 'video' && source;
    if (video && !this.savedVideoUrl && this.promotions().filter((campaign) => campaign.mediaType === 'video' && campaign.imageUrl).length >= MAX_PROMOTION_VIDEOS) {
      this.actionError.set('É possível cadastrar no máximo 10 vídeos de campanha.');
      return;
    }
    this.beginSave();
    const duration = video && video !== this.savedVideoUrl
      ? defer(() => campaignVideoDuration(video))
      : of(video ? this.promotionDraft.videoDurationMs ?? null : null);
    const upload: Observable<{ videoDurationMs: number | null } | null> = uploadFile
      ? this.marketplace.adminUploadPromotionMedia(uploadFile).pipe(tap((media) => {
          this.promotionDraft.imageUrl = media.url;
          this.promotionDraft.mediaType = media.mediaType;
          this.clearSelectedPromotionMedia();
        }))
      : of(null);
    duration.pipe(
      switchMap((measured) => upload.pipe(map((media) => media?.videoDurationMs ?? measured))),
      switchMap((videoDurationMs) => (this.promotionPoster()?.save() ?? of(null)).pipe(map((posterUrl) => ({ posterUrl, videoDurationMs })))),
      switchMap(({ posterUrl, videoDurationMs }) => {
        this.promotionDraft.videoDurationMs = videoDurationMs;
        if (this.promotionDraft.mediaType === 'video') {
          this.promotionDraft.mediaFrame = { ...DEFAULT_MEDIA_FRAME, ...this.promotionDraft.mediaFrame, posterUrl };
        }
        const payload = promotionPayload(this.promotionDraft);
        return this.promotionDraft.id
          ? this.marketplace.adminUpdatePromotion(this.promotionDraft.id, payload)
          : this.marketplace.adminCreatePromotion(payload);
      })
    ).subscribe({
      next: () => {
        this.editingPromotion.set(false);
        this.success.set('Campanha salva.');
        this.saving.set(false);
        this.load();
      },
      error: (failure: Error) => this.failSave(failure)
    });
  }

  selectPromotionMedia(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
    if (!supportedTypes.includes(file.type)) {
      this.actionError.set('Escolha uma imagem JPG, PNG ou WebP, ou um vídeo MP4 ou WebM.');
      return;
    }
    const isVideo = file.type.startsWith('video/');
    if (file.size > (isVideo ? MAX_CAMPAIGN_VIDEO_INPUT : MAX_CAMPAIGN_UPLOAD)) {
      this.actionError.set(isVideo ? 'Escolha um vídeo de até 100 MB para otimizar.' : 'O arquivo deve ter no máximo 25 MB.');
      return;
    }
    this.usePromotionFile(file);
    this.promotionDraft.mediaFrame ??= { ...DEFAULT_MEDIA_FRAME };
  }

  setPromotionFit(fit: PromotionMediaFrame['fit'] | 'original'): void {
    this.promotionDraft.mediaFrame = fit === 'original' ? null : {
      ...DEFAULT_MEDIA_FRAME, ...this.promotionDraft.mediaFrame, fit
    };
  }

  setFrameValue(field: 'x' | 'y' | 'size', value: number): void {
    const frame = this.promotionDraft.mediaFrame ?? DEFAULT_MEDIA_FRAME;
    this.promotionDraft.mediaFrame = { ...frame, [field]: value };
  }

  applyPromotionCutout(file: File): void {
    this.usePromotionFile(file);
    this.promotionDraft.mediaFrame = { ...this.promotionDraft.mediaFrame, ...DEFAULT_MEDIA_FRAME, size: this.promotionDraft.mediaFrame?.size ?? 100, backgroundKey: null };
  }

  setPromotionLayout(layout: 'side' | 'background'): void {
    const frame = this.promotionDraft.mediaFrame ?? DEFAULT_MEDIA_FRAME;
    this.promotionDraft.mediaFrame = layout === 'background'
      ? { ...frame, layout, fit: 'cover', size: 100 }
      : { ...frame, layout };
  }

  setVideoBackground(enabled: boolean): void {
    this.promotionDraft.mediaFrame = {
      ...DEFAULT_MEDIA_FRAME,
      ...this.promotionDraft.mediaFrame,
      backgroundKey: enabled ? { color: '#00ff00', tolerance: 65 } : null
    };
  }

  updateVideoBackground(change: Partial<NonNullable<PromotionMediaFrame['backgroundKey']>>): void {
    const frame = this.promotionDraft.mediaFrame;
    if (!frame?.backgroundKey) return;
    this.promotionDraft.mediaFrame = { ...frame, backgroundKey: { ...frame.backgroundKey, ...change } };
  }

  previewLinks(place: 'banner' | 'below'): PromotionLink[] {
    if (this.promotionDraft.placement === 'services') {
      return place === 'banner' ? (this.promotionDraft.secondaryLinks ?? []).filter((link) => !!link.label.trim()) : [];
    }
    return promotionLinksAt(this.promotionDraft.secondaryLinks, place).filter((link) => !!link.label.trim());
  }

  private usePromotionFile(file: File): void {
    this.cutoutSource.set('');
    this.clearMessages();
    this.releasePromotionPreview();
    this.promotionUploadFile = file;
    this.promotionUploadFileName = file.name;
    this.promotionLocalPreviewUrl = URL.createObjectURL(file);
    this.promotionDraft.imageUrl = '';
    this.promotionDraft.mediaType = file.type.startsWith('video/') ? 'video' : 'image';
  }

  onPromotionUrlChanged(): void {
    this.cutoutSource.set('');
    if (this.promotionUploadFile) this.clearSelectedPromotionMedia();
  }

  clearPromotionMedia(input?: HTMLInputElement): void {
    this.cutoutSource.set('');
    this.promotionDraft.imageUrl = '';
    this.promotionDraft.mediaType = 'image';
    this.promotionDraft.mediaFrame = null;
    this.clearSelectedPromotionMedia();
    if (input) input.value = '';
    this.clearMessages();
  }

  addPromotionLink(): void {
    const links = this.promotionDraft.secondaryLinks ?? [];
    if (links.length < 3) this.promotionDraft.secondaryLinks = [...links, { label: '', url: '', placement: 'below' }];
  }

  removePromotionLink(index: number): void {
    this.promotionDraft.secondaryLinks = (this.promotionDraft.secondaryLinks ?? []).filter((_, current) => current !== index);
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

  private beginSave(): void { this.clearMessages(); this.saving.set(true); }
  private failSave(failure: Error): void { this.actionError.set(failure.message); this.saving.set(false); }
  private clearMessages(): void { this.success.set(''); this.actionError.set(''); }
  private releasePromotionPreview(): void { if (this.promotionLocalPreviewUrl) URL.revokeObjectURL(this.promotionLocalPreviewUrl); this.promotionLocalPreviewUrl = ''; }
  private clearSelectedPromotionMedia(): void { this.releasePromotionPreview(); this.promotionUploadFile = null; this.promotionUploadFileName = ''; }
  private emptyPromotion(): PromotionDraft { return { placement: 'home', serviceId: null, title: '', subtitle: '', ctaLabel: 'Ver produtos', ctaUrl: '/produtos', imageUrl: null, mediaType: 'image', rotationWeight: NORMAL_ROTATION_WEIGHT, buttonPlacement: 'banner', secondaryLinks: [], badgeText: '', termsText: '', backgroundColor: '#096653', textColor: '#FFFFFF', active: true, sortOrder: 10 }; }
  private emptyProduct(): ProductDraft { return { name: '', slug: '', shortDescription: '', priceCents: 0, compareAtPriceCents: null, currency: 'BRL', imageUrl: null, purchaseUrl: '/ajuda?produto=', badgeText: '', inventoryCount: 0, featured: false, active: true, sortOrder: 0 }; }
}
