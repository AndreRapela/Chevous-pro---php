import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type PortalIcon =
  | 'home'
  | 'calendar'
  | 'messages'
  | 'favorites'
  | 'profile'
  | 'requests'
  | 'activity'
  | 'catalog'
  | 'moderation'
  | 'settings';

@Component({
  selector: 'cvp-portal-nav-icon',
  standalone: true,
  host: { class: 'portal-nav-icon', 'aria-hidden': 'true' },
  templateUrl: './portal-nav-icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalNavIconComponent {
  @Input({ required: true }) icon!: PortalIcon;
}
