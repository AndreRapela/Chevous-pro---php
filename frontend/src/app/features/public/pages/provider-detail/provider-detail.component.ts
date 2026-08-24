import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ProviderProfile, Service } from '../../../../core/models';
import { AvatarComponent, RatingComponent, StatePanelComponent } from '../../../../shared/components';

@Component({
  selector: 'cvp-provider-detail',
  standalone: true,
  imports: [AvatarComponent, CurrencyPipe, DatePipe, RatingComponent, RouterLink, StatePanelComponent],
  template: `
    @if (loading()) { <div class="container section"><cvp-state-panel kind="loading" message="Abrindo o perfil profissional." /></div> }
    @else if (error()) { <div class="container section"><cvp-state-panel kind="error" title="Perfil indisponível" [message]="error()" (retry)="load()" /></div> }
    @else if (provider(); as person) {
      <section class="profile-hero"><div class="container profile-hero-inner">
        <cvp-avatar [initials]="person.initials" size="lg" />
        <div class="profile-intro"><div class="provider-name-line"><h1>{{ person.name }}</h1>@if (person.verified) { <span class="verified">✓<span class="sr-only">Perfil aprovado</span></span> }</div><p>{{ person.headline }} · {{ person.neighborhood }}, {{ person.city }}</p><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /><div class="chip-row">@for (quality of person.qualities; track quality) { <span class="chip chip-soft">{{ quality }}</span> }</div></div>
        <button class="icon-button favorite-button" type="button" [attr.aria-label]="favorite() ? 'Remover dos favoritos' : 'Adicionar aos favoritos'" [attr.aria-pressed]="favorite()" (click)="toggleFavorite()"><span aria-hidden="true">{{ favorite() ? '♥' : '♡' }}</span></button>
      </div></section>
      <section class="section section-tight"><div class="container detail-layout">
        <div class="detail-main">
          <section class="content-card"><h2>Sobre</h2><p>{{ person.bio }}</p><div class="profile-facts"><div><strong>{{ person.completedJobs }}</strong><span>serviços concluídos</span></div><div><strong>{{ person.responseTime }}</strong><span>tempo de resposta</span></div><div><strong>{{ person.rating.toFixed(2).replace('.', ',') }}</strong><span>avaliação média</span></div></div></section>
          <section class="content-card"><h2>Serviços oferecidos</h2><div class="compact-service-list">@for (service of offeredServices(); track service.id) { <a [routerLink]="['/agendar', service.id]"><span class="service-symbol">{{ service.symbol }}</span><span><strong>{{ service.name }}</strong><small>{{ service.description }}</small></span><span>→</span></a> }</div></section>
          <section class="content-card"><div class="section-heading"><h2>Avaliações</h2><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /></div>
            @if (person.reviews.length) { <div class="review-list">@for (review of person.reviews; track review.id) { <article><div class="review-head"><span class="avatar avatar-sm">{{ review.initials }}</span><div><strong>{{ review.author }}</strong><span class="rating"><span aria-hidden="true">★</span> {{ review.rating }}</span></div><time [attr.datetime]="review.createdAt">{{ review.createdAt | date:'d MMM yyyy':'':'pt-BR' }}</time></div><p>{{ review.comment }}</p></article> }</div> }
            @else { <p class="muted">As próximas avaliações aparecerão aqui.</p> }
          </section>
        </div>
        <aside class="booking-aside"><span class="eyebrow">Próximo horário</span><strong>{{ person.nextAvailability }}</strong><p>@if (person.priceFromCents > 0) { A partir de <b>{{ person.priceFromCents / 100 | currency:'BRL':'symbol':'1.0-0':'pt-BR' }}</b> } @else { <b>Preço calculado na reserva</b> }</p><a class="btn btn-primary btn-block" [routerLink]="['/agendar', defaultServiceId()]" [queryParams]="{ profissional: person.id }">Escolher este profissional</a><small>Você só paga após revisar todos os detalhes.</small></aside>
      </div></section>
      <div class="mobile-sticky-action"><div><small>{{ person.priceFromCents > 0 ? 'A partir de' : 'Valor' }}</small><strong>{{ person.priceFromCents > 0 ? (person.priceFromCents / 100 | currency:'BRL':'symbol':'1.0-0':'pt-BR') : 'na reserva' }}</strong></div><a class="btn btn-primary" [routerLink]="['/agendar', defaultServiceId()]" [queryParams]="{ profissional: person.id }">Agendar</a></div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderDetailComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload = new BehaviorSubject(0);
  readonly provider = signal<ProviderProfile | null>(null);
  readonly offeredServices = signal<Service[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly favorite = signal(false);
  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
      this.reload
    ]).pipe(
      switchMap(([id]) => {
        this.loading.set(true);
        this.error.set('');
        return this.marketplace.provider(id).pipe(
          switchMap((provider) => forkJoin({ services: this.marketplace.services(), reviews: this.marketplace.providerReviews(id), favorites: this.auth.user()?.role === 'customer' ? this.marketplace.favorites() : of([] as ProviderProfile[]) }).pipe(
            map(({ services, reviews, favorites }) => ({ provider: { ...provider, reviews }, services: services.filter((service) => provider.serviceIds.includes(service.id)), favorite: favorites.some((item) => item.id === provider.id), error: '' }))
          )),
          catchError((failure: Error) => of({ provider: null, services: [] as Service[], favorite: false, error: failure.message }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      this.provider.set(result.provider);
      this.offeredServices.set(result.services);
      this.favorite.set(result.favorite);
      this.error.set(result.error);
      this.loading.set(false);
    });
  }

  load(): void {
    this.reload.next(this.reload.value + 1);
  }
  toggleFavorite(): void {
    const person = this.provider();
    if (!person) return;
    if (this.auth.user()?.role !== 'customer') {
      void this.router.navigate(['/entrar'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.favorite.update((value) => !value);
    this.marketplace.favorite(person.id, this.favorite()).subscribe({ error: () => this.favorite.update((value) => !value) });
  }
  defaultServiceId(): string { return this.offeredServices()[0]?.id ?? 'clean-home'; }
}
