import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-avatar',
  standalone: true,
  template: `<span class="avatar" [class.avatar-lg]="size === 'lg'" [class.avatar-sm]="size === 'sm'" aria-hidden="true">{{ initials }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarComponent {
  @Input() initials = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
}
