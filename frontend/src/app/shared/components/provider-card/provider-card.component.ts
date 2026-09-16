import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProviderProfile } from '../../../core/models';
import { AvatarComponent } from '../avatar/avatar.component';
import { RatingComponent } from '../rating/rating.component';
import { LocalizedMoneyPipe } from '../../localization/localized-format.pipe';
import { providerPublicPath } from '../../utils/public-url.util';

@Component({
  selector: 'cvp-provider-card',
  standalone: true,
  imports: [AvatarComponent, LocalizedMoneyPipe, RatingComponent, RouterLink],
  template: `
    <article class="provider-card">
      <div class="provider-card-head">
        <cvp-avatar [initials]="provider.initials" [imageUrl]="provider.avatarUrl" [label]="provider.name" size="lg" />
        <div>
          <div class="provider-name-line">
            <h3>{{ provider.name }}</h3>
            @if (provider.verified) { <span class="verified" title="Perfil aprovado"><span aria-hidden="true">✓</span><span class="sr-only">Perfil aprovado</span></span> }
          </div>
          <p>{{ provider.headline }}</p>
          <cvp-rating [rating]="provider.rating" [count]="provider.reviewCount" />
        </div>
      </div>
      <div class="chip-row" aria-label="Diferenciais">
        @for (quality of provider.qualities.slice(0, 3); track quality) { <span class="chip chip-soft">{{ quality }}</span> }
      </div>
      <div class="availability"><span class="status-dot"></span> Próximo horário: {{ provider.nextAvailability }}</div>
      <div class="card-footer">
        @if (provider.priceFromCents > 0) { <span>A partir de <strong>{{ provider.priceFromCents / 100 | appMoney:'BRL':0 }}</strong></span> } @else { <span><strong>Preço na proposta</strong></span> }
        <a class="btn btn-small btn-secondary" [routerLink]="profilePath(provider)">Ver perfil</a>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderCardComponent {
  @Input({ required: true }) provider!: ProviderProfile;
  readonly profilePath = providerPublicPath;
}
