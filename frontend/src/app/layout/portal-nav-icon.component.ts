import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type PortalIcon = 'home' | 'calendar' | 'messages' | 'favorites' | 'profile' | 'requests' | 'activity' | 'catalog' | 'moderation' | 'settings';

@Component({
  selector: 'cvp-portal-nav-icon',
  standalone: true,
  host: { class: 'portal-nav-icon', 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24">
    @switch (icon) {
      @case ('home') { <path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/> }
      @case ('calendar') { <rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6"/> }
      @case ('messages') { <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/> }
      @case ('favorites') { <path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/> }
      @case ('requests') { <rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/> }
      @case ('activity') { <path d="M4 17h3l2-5 3 8 3-12 2 9h3"/> }
      @case ('catalog') { <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/> }
      @case ('moderation') { <path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6Z"/><path d="m9 12 2 2 4-5"/> }
      @case ('settings') { <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.28.75.62 1 1 .25.33.4.73.4 1.1V13c0 .37-.15.77-.4 1.1-.25.38-.6.72-1 1Z"/> }
      @default { <circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.5 5 4"/> }
    }
  </svg>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortalNavIconComponent { @Input({ required: true }) icon!: PortalIcon; }
