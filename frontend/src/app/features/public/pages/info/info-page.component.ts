import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { INFO_PAGES } from '../../data/info-page-content';

@Component({
  selector: 'cvp-info-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './info-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InfoPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly page =
    INFO_PAGES[String(this.route.snapshot.data['page'] ?? 'how')] ?? INFO_PAGES['how']!;
}
