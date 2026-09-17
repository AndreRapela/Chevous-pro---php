import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProfessionalComment, ProviderProfile, Review, Service } from '../../../../core/models';
import { AvatarComponent, RatingComponent, ServiceIconComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedDatePipe, LocalizedMoneyPipe, LocalizedNumberPipe } from '../../../../shared/localization/localized-format.pipe';
import { mergeUniqueById, pageFromMeta, totalFromMeta } from '../../../../shared/utils/pagination.util';
import { providerPublicPath } from '../../../../shared/utils/public-url.util';
import { SeoService } from '../../../../core/seo/seo.service';

@Component({
  selector: 'cvp-provider-detail',
  standalone: true,
  imports: [AvatarComponent, LocalizedDatePipe, LocalizedMoneyPipe, LocalizedNumberPipe, RatingComponent, RouterLink, ServiceIconComponent, StatePanelComponent],
  template: `
    @if (loading()) { <div class="container section"><cvp-state-panel kind="loading" message="Abrindo o perfil profissional." /></div> }
    @else if (error()) { <div class="container section"><cvp-state-panel kind="error" title="Perfil indisponível" [message]="error()" (retry)="load()" /></div> }
    @else if (provider(); as person) {
      <section class="profile-hero profile-showcase-hero"><div class="container profile-hero-inner">
        <cvp-avatar [initials]="person.initials" [imageUrl]="person.avatarUrl" [label]="person.name" size="lg" />
        <div class="profile-intro"><div class="provider-name-line"><h1 data-cvp-no-localize>{{ person.name }}</h1>@if (person.verified) { <span class="verified" title="Perfil aprovado">✓<span class="sr-only">Perfil aprovado</span></span> }</div><p><span data-cvp-no-localize>{{ person.headline }}</span> · <span data-cvp-no-localize>{{ person.city }}</span>@if (person.state) {, <span data-cvp-no-localize>{{ person.state }}</span> }</p><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /></div>
        <button class="icon-button favorite-button" type="button" [attr.aria-label]="favorite() ? 'Remover dos favoritos' : 'Adicionar aos favoritos'" [attr.aria-pressed]="favorite()" (click)="toggleFavorite()"><span aria-hidden="true">{{ favorite() ? '♥' : '♡' }}</span></button>
        <div class="chip-row profile-summary-tags"><span class="chip chip-soft">{{ person.completedJobs }} serviços concluídos</span>@if (person.yearsExperience) { <span class="chip chip-soft">{{ person.yearsExperience }} anos de experiência</span> }@for (quality of person.qualities.slice(0, 2); track quality) { <span class="chip chip-soft" data-cvp-no-localize>{{ quality }}</span> }</div>
      </div></section>
      <section class="section section-tight"><div class="container detail-layout">
        <div class="detail-main">
          <section class="content-card professional-summary-card"><div class="section-heading"><div><span class="eyebrow">Perfil aprovado na plataforma</span><h2>Sobre <span data-cvp-no-localize>{{ person.name.split(' ')[0] }}</span></h2></div><span class="verified-transaction-badge">★ Nota de {{ person.rating | appNumber:2:2 }}</span></div><p data-cvp-no-localize>{{ person.bio }}</p><div class="profile-facts"><div><strong>{{ person.completedJobs }}</strong><span>serviços concluídos</span></div><div><strong>{{ person.reviewCount }}</strong><span>avaliações de reservas</span></div><div><strong data-cvp-no-localize>{{ person.responseTime }}</strong><span>tempo de resposta</span></div></div></section>

          @if (person.experiences?.length) { <section class="content-card"><div class="section-heading"><div><span class="eyebrow">Trajetória</span><h2>Experiência profissional</h2></div></div><div class="public-timeline">@for (experience of person.experiences; track experience.id) { <article><span class="timeline-dot"></span><div><strong data-cvp-no-localize>{{ experience.role }}</strong><span><span data-cvp-no-localize>{{ experience.company }}</span> · {{ experience.startedAt | appDate:'yyyy' }}–{{ experience.current ? 'atual' : (experience.endedAt | appDate:'yyyy') }}</span>@if (experience.description) { <p data-cvp-no-localize>{{ experience.description }}</p> }</div></article> }</div></section> }

          @if (person.courses?.length) { <section class="content-card"><div class="section-heading"><div><span class="eyebrow">Formação</span><h2>Cursos e certificados</h2></div></div><div class="public-credentials">@for (course of person.courses; track course.id) { <article><span aria-hidden="true">✓</span><div><strong data-cvp-no-localize>{{ course.title }}</strong><small><span data-cvp-no-localize>{{ course.institution }}</span>@if (course.completedAt) { · {{ course.completedAt | appDate:'yyyy' }} }</small></div>@if (course.certificateUrl) { <a [href]="course.certificateUrl" target="_blank" rel="noopener noreferrer">Certificado ↗</a> }</article> }</div></section> }

          <section class="content-card"><h2>Serviços oferecidos</h2><div class="compact-service-list">@for (service of offeredServices(); track service.id) { <a [routerLink]="['/servicos', service.slug]"><span class="service-symbol"><cvp-service-icon [category]="service.categoryId" [serviceSlug]="service.slug" /></span><span><strong>{{ service.name }}</strong><small>{{ service.description }}</small></span><span>→</span></a> }</div></section>

          <section class="content-card feedback-section"><div class="section-heading"><div><span class="eyebrow">Reservas concluídas</span><h2>Avaliações verificadas</h2><p>Somente clientes que fecharam negócio pela plataforma podem avaliar com estrelas.</p></div><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /></div>
            @if (reviews().length) { <div class="review-list">@for (review of reviews(); track review.id) { <article><div class="review-head"><span class="avatar avatar-sm">{{ review.initials }}</span><div><strong data-cvp-no-localize>{{ review.author }}</strong><span><span class="rating"><span aria-hidden="true">★</span> {{ review.rating }}</span><em class="verified-transaction-badge">Reserva verificada</em></span></div><time [attr.datetime]="review.createdAt">{{ review.createdAt | appDate:'d MMM yyyy' }}</time></div>@if (review.serviceName) { <small class="review-service" data-cvp-no-localize>{{ review.serviceName }}</small> }<p data-cvp-no-localize>{{ review.comment }}</p>@if (review.providerReply) { <div class="provider-reply"><strong>Resposta do profissional</strong><p data-cvp-no-localize>{{ review.providerReply }}</p></div> }@if (auth.user()) { <button class="text-button" type="button" (click)="startReport('review', review.id)">Denunciar avaliação</button> }</article> }</div>@if (reviewPage() < reviewLastPage()) { <div class="feedback-load-more"><button class="btn btn-secondary btn-small" type="button" [disabled]="loadingMoreReviews()" (click)="loadMoreReviews()">{{ loadingMoreReviews() ? 'Carregando…' : 'Ver mais avaliações' }}</button></div> } } @else { <p class="muted">As avaliações de reservas concluídas aparecerão aqui.</p> }
          </section>

          @if (reportTarget(); as target) { <section class="content-card report-content-form"><h2>Denunciar conteúdo</h2><p>Explique o problema para que a equipe de moderação possa analisar.</p><form (submit)="submitReport($event, reportReason.value)"><label for="report-reason">Motivo</label><textarea #reportReason id="report-reason" maxlength="500" minlength="8" required placeholder="Descreva o motivo da denúncia"></textarea><div class="card-actions"><button class="btn btn-secondary btn-small" type="button" (click)="reportTarget.set(null)">Cancelar</button><button class="btn btn-danger btn-small" type="submit" [disabled]="reportSending()">{{ reportSending() ? 'Enviando…' : 'Enviar denúncia' }}</button></div>@if (reportError()) { <p class="field-error" role="alert">{{ reportError() }}</p> }</form></section> }

          <section class="content-card feedback-section community-comments"><div class="section-heading"><div><span class="eyebrow">Comunidade</span><h2>Comentários públicos</h2><p>Espaço para comentários de membros da plataforma. Não altera a nota profissional.</p></div><span class="comment-count">{{ commentTotal() }} comentário{{ commentTotal() === 1 ? '' : 's' }}</span></div>
            @if (auth.user()) { <div class="comment-composer"><label for="public-comment">Deixe um comentário</label><textarea #commentInput id="public-comment" maxlength="1200" placeholder="Compartilhe uma observação respeitosa e útil."></textarea><div><small>{{ commentInput.value.length }}/1200</small><button class="btn btn-secondary btn-small" type="button" [disabled]="commentSending()" (click)="postComment(commentInput)">{{ commentSending() ? 'Publicando…' : 'Publicar comentário' }}</button></div>@if (commentError()) { <span class="field-error" role="alert">{{ commentError() }}</span> }</div> } @else { <p class="muted">Quer deixar um comentário? <a [routerLink]="['/entrar']" [queryParams]="{ returnUrl: router.url }">Entre na sua conta</a>.</p> }
            @if (comments().length) { <div class="review-list comment-list">@for (comment of comments(); track comment.id) { <article><div class="review-head"><span class="avatar avatar-sm">{{ comment.initials }}</span><div><strong data-cvp-no-localize>{{ comment.author }}</strong><span>Comentário da comunidade</span></div><time [attr.datetime]="comment.createdAt">{{ comment.createdAt | appDate:'d MMM yyyy' }}</time></div><p data-cvp-no-localize>{{ comment.comment }}</p>@if (auth.user()) { <button class="text-button" type="button" (click)="startReport('professional_comment', comment.id)">Denunciar comentário</button> }</article> }</div>@if (commentPage() < commentLastPage()) { <div class="feedback-load-more"><button class="btn btn-secondary btn-small" type="button" [disabled]="loadingMoreComments()" (click)="loadMoreComments()">{{ loadingMoreComments() ? 'Carregando…' : 'Ver mais comentários' }}</button></div> } } @else { <p class="muted">Ainda não há comentários públicos.</p> }
          </section>
        </div>
        <aside class="booking-aside"><span class="eyebrow">Próximo horário</span><strong data-cvp-no-localize>{{ person.nextAvailability }}</strong><p>@if (person.priceFromCents > 0) { A partir de <b>{{ person.priceFromCents / 100 | appMoney:'BRL':0 }}</b> } @else { <b>Preço calculado na reserva</b> }</p><button class="btn btn-secondary btn-block" type="button" (click)="startConversation(person.id)">Conversar antes de agendar</button><a class="btn btn-primary btn-block" [routerLink]="['/agendar', defaultServiceId()]" [queryParams]="{ profissional: person.id }">Escolher este profissional</a>@if (conversationError()) { <span class="field-error" role="alert">{{ conversationError() }}</span> }<small>Conversa, valor de referência e detalhes ficam protegidos pela plataforma.</small></aside>
      </div></section>
      <div class="mobile-sticky-action"><div><small>{{ person.priceFromCents > 0 ? 'A partir de' : 'Valor' }}</small><strong>{{ person.priceFromCents > 0 ? (person.priceFromCents / 100 | appMoney:'BRL':0) : 'na reserva' }}</strong></div><button class="btn btn-secondary" type="button" (click)="startConversation(person.id)">Conversar</button><a class="btn btn-primary" [routerLink]="['/agendar', defaultServiceId()]" [queryParams]="{ profissional: person.id }">Agendar</a></div>@if (conversationError()) { <p class="mobile-conversation-error field-error" role="alert">{{ conversationError() }}</p> }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderDetailComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);
  private readonly reload = new BehaviorSubject(0);
  readonly provider = signal<ProviderProfile | null>(null);
  readonly offeredServices = signal<Service[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly comments = signal<ProfessionalComment[]>([]);
  readonly reviewPage = signal(1);
  readonly reviewLastPage = signal(1);
  readonly commentPage = signal(1);
  readonly commentLastPage = signal(1);
  readonly commentTotal = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly favorite = signal(false);
  readonly commentSending = signal(false);
  readonly commentError = signal('');
  readonly loadingMoreReviews = signal(false);
  readonly loadingMoreComments = signal(false);
  readonly reportTarget = signal<{ type: 'professional_comment' | 'review'; id: string } | null>(null);
  readonly reportSending = signal(false);
  readonly reportError = signal('');
  readonly conversationError = signal('');

  ngOnInit(): void {
    combineLatest([this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), this.reload]).pipe(
      switchMap(([id]) => {
        this.loading.set(true); this.error.set('');
        return this.marketplace.provider(id).pipe(
          switchMap((provider) => forkJoin({ services: this.marketplace.services({ professional: id }), reviews: this.marketplace.providerReviewsPage(id), comments: this.marketplace.providerCommentsPage(id), favorites: this.auth.user()?.role === 'customer' ? this.marketplace.favorites() : of([] as ProviderProfile[]) }).pipe(
            map(({ services, reviews, comments, favorites }) => ({ provider, reviews, comments, services, favorite: favorites.some((item) => item.id === provider.id), error: '' }))
          )),
          catchError((failure: Error) => of({ provider: null, reviews: null, comments: null, services: [] as Service[], favorite: false, error: failure.message }))
        );
      }), takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => { this.provider.set(result.provider); this.offeredServices.set(result.services); this.reviews.set(result.reviews?.data ?? []); this.comments.set(result.comments?.data ?? []); this.reviewPage.set(pageFromMeta(result.reviews?.meta, 'page')); this.reviewLastPage.set(pageFromMeta(result.reviews?.meta, 'lastPage')); this.commentPage.set(pageFromMeta(result.comments?.meta, 'page')); this.commentLastPage.set(pageFromMeta(result.comments?.meta, 'lastPage')); this.commentTotal.set(totalFromMeta(result.comments?.meta)); this.favorite.set(result.favorite); this.error.set(result.error); this.loading.set(false); if (result.provider) this.updateSeo(result.provider, result.reviews?.data ?? []); });
  }

  load(): void { this.reload.next(this.reload.value + 1); }
  toggleFavorite(): void { const person = this.provider(); if (!person) return; if (this.auth.user()?.role !== 'customer') { void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } }); return; } this.favorite.update((value) => !value); this.marketplace.favorite(person.id, this.favorite()).subscribe({ error: () => this.favorite.update((value) => !value) }); }
  startConversation(professionalId: string): void { if (this.auth.user()?.role !== 'customer') { void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } }); return; } this.conversationError.set(''); this.marketplace.startProfessionalConversation(professionalId).subscribe({ next: ({ conversationId }) => void this.router.navigate(['/conta/mensagens'], { queryParams: { conversa: conversationId } }), error: (failure: Error) => this.conversationError.set(failure.message || 'Não foi possível iniciar a conversa agora.') }); }
  postComment(input: HTMLTextAreaElement): void { const person = this.provider(); const comment = input.value.trim(); if (!person || this.commentSending()) return; if (comment.length < 3) { this.commentError.set('Escreva pelo menos 3 caracteres.'); return; } this.commentSending.set(true); this.commentError.set(''); this.marketplace.createProviderComment(person.id, comment).subscribe({ next: (created) => { this.comments.update((items) => [created, ...items]); this.commentTotal.update((total) => total + 1); input.value = ''; this.commentSending.set(false); }, error: (failure: Error) => { this.commentError.set(failure.message); this.commentSending.set(false); } }); }
  loadMoreReviews(): void { const person = this.provider(); const nextPage = this.reviewPage() + 1; if (!person || this.loadingMoreReviews() || nextPage > this.reviewLastPage()) return; this.loadingMoreReviews.set(true); this.marketplace.providerReviewsPage(person.id, nextPage).subscribe({ next: (response) => { this.reviews.update((items) => mergeUniqueById(items, response.data)); this.reviewPage.set(pageFromMeta(response.meta, 'page')); this.reviewLastPage.set(pageFromMeta(response.meta, 'lastPage')); this.loadingMoreReviews.set(false); }, error: () => this.loadingMoreReviews.set(false) }); }
  loadMoreComments(): void { const person = this.provider(); const nextPage = this.commentPage() + 1; if (!person || this.loadingMoreComments() || nextPage > this.commentLastPage()) return; this.loadingMoreComments.set(true); this.marketplace.providerCommentsPage(person.id, nextPage).subscribe({ next: (response) => { this.comments.update((items) => mergeUniqueById(items, response.data)); this.commentPage.set(pageFromMeta(response.meta, 'page')); this.commentLastPage.set(pageFromMeta(response.meta, 'lastPage')); this.commentTotal.set(totalFromMeta(response.meta)); this.loadingMoreComments.set(false); }, error: () => this.loadingMoreComments.set(false) }); }
  startReport(type: 'professional_comment' | 'review', id: string): void { if (!this.auth.user()) { void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } }); return; } this.reportError.set(''); this.reportTarget.set({ type, id }); }
  submitReport(event: Event, reason: string): void { event.preventDefault(); const target = this.reportTarget(); if (!target || reason.trim().length < 8 || this.reportSending()) return; this.reportSending.set(true); this.reportError.set(''); this.marketplace.reportContent(target.type, target.id, reason.trim()).subscribe({ next: () => { this.reportSending.set(false); this.reportTarget.set(null); }, error: (failure: Error) => { this.reportError.set(failure.message); this.reportSending.set(false); } }); }
  defaultServiceId(): string { return this.offeredServices()[0]?.id ?? 'clean-home'; }

  private updateSeo(provider: ProviderProfile, reviews: Review[]): void {
    const canonicalPath = providerPublicPath(provider).join('/');
    const title = `${provider.name} | ${provider.headline} | ChezVoust Pro`;
    const description = provider.bio || `${provider.name} atende em ${provider.city}. Veja experiência, serviços e avaliações de reservas.`;
    const person: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: provider.name,
      description,
      jobTitle: provider.headline,
      url: canonicalPath,
      address: {
        '@type': 'PostalAddress',
        addressLocality: provider.city,
        ...(provider.state ? { addressRegion: provider.state } : {})
      },
      knowsAbout: provider.qualities
    };
    if (provider.avatarUrl) person['image'] = provider.avatarUrl;
    if (provider.reviewCount > 0) {
      person['aggregateRating'] = {
        '@type': 'AggregateRating',
        ratingValue: provider.rating,
        reviewCount: provider.reviewCount,
        bestRating: 5,
        worstRating: 1
      };
      person['review'] = reviews.slice(0, 5).map((review) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: review.author },
        reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
        reviewBody: review.comment,
        datePublished: review.createdAt
      }));
    }
    this.seo.update({
      title,
      description,
      canonicalPath,
      type: 'profile',
      imagePath: provider.avatarUrl ?? undefined,
      structuredData: [
        person,
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Início', item: '/' },
            { '@type': 'ListItem', position: 2, name: 'Profissionais', item: '/profissionais' },
            { '@type': 'ListItem', position: 3, name: provider.name, item: canonicalPath }
          ]
        }
      ]
    });
  }
}
