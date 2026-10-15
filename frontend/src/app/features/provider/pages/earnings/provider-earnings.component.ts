import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { ProviderJob } from '../../../../core/models';
import {
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-provider-activity',
  standalone: true,
  imports: [LocalizedDatePipe, PageHeaderComponent, StatePanelComponent, StatusPillComponent],
  templateUrl: './provider-earnings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderActivityComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  readonly jobs = signal<ProviderJob[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completedCount = computed(
    () => this.jobs().filter((job) => job.status === 'completed').length
  );
  readonly activeCount = computed(
    () =>
      this.jobs().filter((job) =>
        ['confirmed', 'provider_on_the_way', 'in_progress'].includes(job.status)
      ).length
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.providerJobs().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }
}
