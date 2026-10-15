import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { DashboardMetric, ProviderJob, ProviderRequest } from '../../../../core/models';
import {
  MetricGridComponent,
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import {
  LocalizedDatePipe,
  LocalizedMoneyPipe
} from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-provider-dashboard',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    LocalizedMoneyPipe,
    MetricGridComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './provider-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderDashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly marketplace = inject(MarketplaceService);
  readonly dashboard = signal<unknown>({});
  readonly metrics = computed<DashboardMetric[]>(() =>
    this.marketplace.dashboardMetricsFor('provider', this.dashboard())
  );
  readonly jobs = signal<ProviderJob[]>([]);
  readonly requests = signal<ProviderRequest[]>([]);
  readonly profile = signal<Record<string, unknown>>({});
  readonly upcomingJobs = computed(() =>
    this.jobs()
      .filter(
        (job) =>
          ['provider_on_the_way', 'in_progress'].includes(job.status) ||
          (job.status === 'confirmed' && Date.parse(job.scheduledStart) >= Date.now())
      )
      .sort((a, b) => Date.parse(a.scheduledStart) - Date.parse(b.scheduledStart))
  );
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actingJob = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      dashboard: this.marketplace.providerDashboard(),
      jobs: this.marketplace.providerJobs(),
      profile: this.marketplace.providerProfile()
    })
      .pipe(
        switchMap((base) =>
          String(base.profile['verificationStatus']) === 'approved'
            ? this.marketplace
                .providerOpenRequests()
                .pipe(switchMap((requests) => of({ ...base, requests })))
            : of({ ...base, requests: [] as ProviderRequest[] })
        )
      )
      .subscribe({
        next: ({ dashboard, jobs, profile, requests }) => {
          this.dashboard.set(dashboard);
          this.jobs.set(jobs);
          this.requests.set(requests);
          this.profile.set(profile);
          this.loading.set(false);
        },
        error: (failure: Error) => {
          this.error.set(failure.message);
          this.loading.set(false);
        }
      });
  }

  initials(value: string): string {
    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase();
  }

  verificationStatus(): string {
    return String(this.profile()['verificationStatus'] ?? 'pending');
  }
  verificationTitle(): string {
    return (
      (
        {
          approved: 'Perfil aprovado',
          pending: 'Perfil em análise',
          rejected: 'Perfil rejeitado',
          suspended: 'Perfil suspenso'
        } as Record<string, string>
      )[this.verificationStatus()] ?? 'Perfil em análise'
    );
  }
  verificationDescription(): string {
    return this.verificationStatus() === 'approved'
      ? 'O perfil está habilitado para receber oportunidades. Isso não representa certificação de identidade.'
      : 'Complete seus serviços e disponibilidade enquanto aguarda a análise da equipe.';
  }

  onTheWay(job: ProviderJob): void {
    this.runJobAction(job, 'Profissional a caminho. O cliente foi avisado.', () =>
      this.marketplace.markBookingOnTheWay(job.id)
    );
  }
  start(job: ProviderJob): void {
    this.runJobAction(job, 'Atendimento iniciado.', () => this.marketplace.startBooking(job.id));
  }
  complete(job: ProviderJob): void {
    this.runJobAction(job, 'Atendimento concluído.', () =>
      this.marketplace.completeBooking(job.id)
    );
  }

  private runJobAction(
    job: ProviderJob,
    message: string,
    action: () => ReturnType<MarketplaceService['startBooking']>
  ): void {
    if (this.actingJob()) return;
    this.actingJob.set(job.id);
    this.actionError.set('');
    this.actionSuccess.set('');
    action().subscribe({
      next: (booking) => {
        this.jobs.update((items) =>
          items.map((item) => (item.id === job.id ? { ...item, status: booking.status } : item))
        );
        this.actionSuccess.set(message);
        this.actingJob.set('');
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.actingJob.set('');
      }
    });
  }
}
