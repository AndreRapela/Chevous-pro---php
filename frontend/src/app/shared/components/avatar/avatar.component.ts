import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-avatar',
  standalone: true,
  template: `<span class="avatar" [class.avatar-lg]="size === 'lg'" [class.avatar-sm]="size === 'sm'" [attr.aria-label]="label || null">@if (imageUrl) { <img [src]="imageUrl" [alt]="label || 'Foto de perfil'" loading="lazy"> } @else { {{ initials }} }</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarComponent {
  @Input() initials = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() imageUrl?: string | null;
  @Input() label = '';
}
