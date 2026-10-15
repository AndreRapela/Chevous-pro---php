import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { AvailabilityException, AvailabilityRule, ProviderJob } from '../../../../core/models';
import { LocalizationService } from '../../../../core/localization/localization.service';
import {
  PageHeaderComponent,
  StatePanelComponent,
  StatusPillComponent
} from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';
import { hasOverlappingRules } from '../../../booking/utils/availability.util';

@Component({
  selector: 'cvp-provider-schedule',
  standalone: true,
  imports: [
    LocalizedDatePipe,
    FormsModule,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
    StatusPillComponent
  ],
  templateUrl: './provider-schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProviderScheduleComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly localization = inject(LocalizationService);
  readonly jobs = signal<ProviderJob[]>([]);
  readonly rules = signal<AvailabilityRule[]>([]);
  readonly exceptions = signal<AvailabilityException[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  readonly confirmTarget = signal('');
  readonly minDate = this.localDate(new Date());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      jobs: this.marketplace.providerJobs(),
      rules: this.marketplace.providerAvailability(),
      exceptions: this.marketplace.providerAvailabilityExceptions()
    }).subscribe({
      next: ({ jobs, rules, exceptions }) => {
        this.jobs.set(jobs);
        this.rules.set(rules);
        this.exceptions.set(exceptions);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.loadError.set(failure.message);
        this.loading.set(false);
      }
    });
  }

  saveAvailability(): void {
    if (hasOverlappingRules(this.rules())) {
      this.actionError.set(
        'Revise os horários: início deve ser anterior ao fim e as faixas do mesmo dia não podem se sobrepor.'
      );
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.saveProviderAvailability(this.rules()).subscribe({
      next: (rules) => {
        this.rules.set(rules);
        this.success.set('Disponibilidade salva.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  addRule(): void {
    this.rules.update((rules) => [...rules, { weekday: 1, startTime: '08:00', endTime: '17:00' }]);
  }
  removeRule(index: number): void {
    this.rules.update((rules) => rules.filter((_, current) => current !== index));
  }

  addException(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const date = String(data.get('date') ?? '');
    const startTime = String(data.get('startTime') ?? '');
    const endTime = String(data.get('endTime') ?? '');
    if (
      !date ||
      date < this.minDate ||
      !!startTime !== !!endTime ||
      (!!startTime && startTime >= endTime)
    ) {
      this.actionError.set(
        'Informe uma data válida e, se usar horário parcial, um início anterior ao fim.'
      );
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace
      .createProviderAvailabilityException({
        date,
        type: 'unavailable',
        startTime: startTime || null,
        endTime: endTime || null,
        reason: String(data.get('reason') ?? '').trim() || null
      })
      .subscribe({
        next: (item) => {
          this.exceptions.update((items) =>
            [...items, item].sort((a, b) => a.date.localeCompare(b.date))
          );
          this.success.set('Bloqueio adicionado.');
          this.acting.set(false);
          form.reset();
        },
        error: (failure: Error) => {
          this.actionError.set(failure.message);
          this.acting.set(false);
        }
      });
  }

  removeException(item: AvailabilityException): void {
    if (!item.id) return;
    this.acting.set(true);
    this.marketplace.removeProviderAvailabilityException(item.id).subscribe({
      next: () => {
        this.exceptions.update((items) => items.filter((current) => current.id !== item.id));
        this.success.set('Bloqueio removido.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  transition(job: ProviderJob): void {
    if (this.acting()) return;
    const request =
      job.status === 'in_progress'
        ? this.marketplace.completeBooking(job.id)
        : this.marketplace.startBooking(job.id);
    this.acting.set(true);
    this.actionError.set('');
    request.subscribe({
      next: (booking) => {
        this.jobs.update((items) =>
          items.map((item) => (item.id === job.id ? { ...item, status: booking.status } : item))
        );
        this.success.set(
          booking.status === 'in_progress' ? 'Serviço iniciado.' : 'Serviço concluído.'
        );
        this.confirmTarget.set('');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  onTheWay(job: ProviderJob): void {
    if (this.acting() || job.status !== 'confirmed') return;
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.markBookingOnTheWay(job.id).subscribe({
      next: (booking) => {
        this.jobs.update((items) =>
          items.map((item) => (item.id === job.id ? { ...item, status: booking.status } : item))
        );
        this.success.set('Cliente avisado: você está a caminho.');
        this.acting.set(false);
      },
      error: (failure: Error) => {
        this.actionError.set(failure.message);
        this.acting.set(false);
      }
    });
  }

  weekday(value: number): string {
    return (
      ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][value] ??
      `Dia ${value}`
    );
  }

  ruleLabel(label: string, index: number): string {
    return `${this.localization.translate(label)} ${index + 1}`;
  }

  private localDate(value: Date): string {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
}
