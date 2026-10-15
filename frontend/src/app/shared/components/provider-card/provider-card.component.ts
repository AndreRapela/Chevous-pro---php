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
  templateUrl: './provider-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderCardComponent {
  @Input({ required: true }) provider!: ProviderProfile;
  readonly profilePath = providerPublicPath;
}
