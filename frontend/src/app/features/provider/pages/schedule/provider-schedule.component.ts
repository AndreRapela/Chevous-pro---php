import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { AvailabilityException, AvailabilityRule, ProviderJob } from '../../../../core/models';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { PageHeaderComponent, StatePanelComponent, StatusPillComponent } from '../../../../shared/components';
import { LocalizedDatePipe } from '../../../../shared/localization/localized-format.pipe';
import { hasOverlappingRules } from '../../../booking/utils/availability.util';

@Component({
  selector: 'cvp-provider-schedule',
  standalone: true,
  imports: [LocalizedDatePipe, FormsModule, PageHeaderComponent, RouterLink, StatePanelComponent, StatusPillComponent],
  template: `
    <section class="portal-page provider-operations-page provider-schedule-page">
      <cvp-page-header eyebrow="Organize sua semana" title="Minha agenda" description="Defina sua disponibilidade e acompanhe atendimentos."><button class="btn btn-primary" type="button" [disabled]="acting()" (click)="saveAvailability()">Salvar disponibilidade</button></cvp-page-header>
      @if (success()) { <div class="alert alert-success" role="status">{{ success() }}</div> }
      @if (actionError()) { <div class="alert alert-error" role="alert">{{ actionError() }}</div> }
      @if (loading()) { <cvp-state-panel kind="loading" /> }
      @else if (loadError()) { <cvp-state-panel kind="error" title="Agenda indisponível" [message]="loadError()" (retry)="load()" /> }
      @else {
        <section class="portal-card"><div class="card-title-row"><h2>Horários disponíveis</h2><button class="btn btn-secondary btn-small" type="button" (click)="addRule()">+ Adicionar horário</button></div>@if (!rules().length) { <p class="muted">Adicione os dias e horários em que você atende.</p> } @else { <div class="table-wrap availability-table"><table><thead><tr><th>Dia</th><th>Horário de início</th><th>Horário de término</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>@for (rule of rules(); track $index) { <tr><td data-label="Dia"><select [(ngModel)]="rule.weekday" [name]="'weekday-' + $index" [attr.aria-label]="ruleLabel('Dia do horário', $index)"><option [ngValue]="0">Domingo</option><option [ngValue]="1">Segunda</option><option [ngValue]="2">Terça</option><option [ngValue]="3">Quarta</option><option [ngValue]="4">Quinta</option><option [ngValue]="5">Sexta</option><option [ngValue]="6">Sábado</option></select></td><td data-label="Horário de início"><input type="time" [(ngModel)]="rule.startTime" [name]="'start-' + $index" [attr.aria-label]="ruleLabel('Horário de início', $index)"></td><td data-label="Horário de término"><input type="time" [(ngModel)]="rule.endTime" [name]="'end-' + $index" [attr.aria-label]="ruleLabel('Horário de término', $index)"></td><td><button class="text-button" type="button" (click)="removeRule($index)">Remover horário</button></td></tr> }</tbody></table></div> }</section>
        <section class="portal-card"><div class="card-title-row"><h2>Bloqueios e exceções</h2></div><form class="inline-action-form" (submit)="addException($event)"><div class="form-grid"><label>Data<input name="date" type="date" [min]="minDate" required></label><label>Horário de início <span class="optional">Dia todo se vazio</span><input name="startTime" type="time"></label><label>Horário de término<input name="endTime" type="time"></label></div><label>Motivo <span class="optional">Opcional</span><input name="reason" maxlength="250" placeholder="Ex.: compromisso pessoal"></label><button class="btn btn-secondary btn-small" type="submit" [disabled]="acting()">Adicionar bloqueio</button></form>@if (exceptions().length) { <div class="timeline-list">@for (item of exceptions(); track item.id) { <article><time>{{ item.date | appDate:'MMM d':'UTC' }}</time><span class="timeline-dot"></span><div><strong>{{ item.startTime && item.endTime ? item.startTime + '–' + item.endTime : 'Dia inteiro' }}</strong><p>@if (item.reason) { <span data-cvp-no-localize>{{ item.reason }}</span> } @else { Indisponível }</p></div><button class="text-button" type="button" (click)="removeException(item)">Remover</button></article> }</div> } @else { <p class="muted">Nenhum bloqueio futuro.</p> }</section>
        <section class="portal-card"><div class="card-title-row"><h2>Atendimentos</h2></div>@if (jobs().length) { <div class="timeline-list">@for (job of jobs(); track job.id) { <article><time>{{ job.scheduledStart | appDate:'MMM d, HH:mm' }}</time><span class="timeline-dot"></span><div><cvp-status-pill [status]="job.status" /><h3>{{ job.serviceName }}</h3><p data-cvp-no-localize>{{ job.customerName }} · {{ job.city }}, {{ job.state }}</p></div><div class="card-actions">@if (job.conversationId) { <a class="btn btn-secondary btn-small" routerLink="/prestador/mensagens" [queryParams]="{ conversa: job.conversationId }">Mensagem</a> }@if (job.status === 'confirmed') { <button class="btn btn-secondary btn-small" type="button" [disabled]="acting()" (click)="onTheWay(job)">Estou a caminho</button> }@if (job.status === 'confirmed' || job.status === 'provider_on_the_way' || job.status === 'in_progress') { @if (confirmTarget() === job.id) { <button class="btn btn-secondary btn-small" type="button" (click)="confirmTarget.set('')">Voltar</button><button class="btn btn-primary btn-small" type="button" [disabled]="acting()" (click)="transition(job)">{{ job.status === 'in_progress' ? 'Confirmar conclusão' : 'Confirmar início' }}</button> } @else { <button class="btn btn-primary btn-small" type="button" (click)="confirmTarget.set(job.id)">{{ job.status === 'in_progress' ? 'Concluir serviço' : 'Iniciar serviço' }}</button> } }</div></article> }</div> } @else { <p class="muted">Nenhum atendimento na agenda.</p> }</section>
      }
    </section>
  `,
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

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({ jobs: this.marketplace.providerJobs(), rules: this.marketplace.providerAvailability(), exceptions: this.marketplace.providerAvailabilityExceptions() }).subscribe({
      next: ({ jobs, rules, exceptions }) => { this.jobs.set(jobs); this.rules.set(rules); this.exceptions.set(exceptions); this.loading.set(false); },
      error: (failure: Error) => { this.loadError.set(failure.message); this.loading.set(false); }
    });
  }

  saveAvailability(): void {
    if (hasOverlappingRules(this.rules())) {
      this.actionError.set('Revise os horários: início deve ser anterior ao fim e as faixas do mesmo dia não podem se sobrepor.');
      return;
    }
    this.acting.set(true);
    this.actionError.set('');
    this.marketplace.saveProviderAvailability(this.rules()).subscribe({
      next: (rules) => { this.rules.set(rules); this.success.set('Disponibilidade salva.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  addRule(): void { this.rules.update((rules) => [...rules, { weekday: 1, startTime: '08:00', endTime: '17:00' }]); }
  removeRule(index: number): void { this.rules.update((rules) => rules.filter((_, current) => current !== index)); }

  addException(event: Event): void {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form);
    const date = String(data.get('date') ?? ''); const startTime = String(data.get('startTime') ?? ''); const endTime = String(data.get('endTime') ?? '');
    if (!date || date < this.minDate || (!!startTime !== !!endTime) || (!!startTime && startTime >= endTime)) { this.actionError.set('Informe uma data válida e, se usar horário parcial, um início anterior ao fim.'); return; }
    this.acting.set(true); this.actionError.set('');
    this.marketplace.createProviderAvailabilityException({ date, type: 'unavailable', startTime: startTime || null, endTime: endTime || null, reason: String(data.get('reason') ?? '').trim() || null }).subscribe({
      next: (item) => { this.exceptions.update((items) => [...items, item].sort((a, b) => a.date.localeCompare(b.date))); this.success.set('Bloqueio adicionado.'); this.acting.set(false); form.reset(); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  removeException(item: AvailabilityException): void {
    if (!item.id) return; this.acting.set(true);
    this.marketplace.removeProviderAvailabilityException(item.id).subscribe({
      next: () => { this.exceptions.update((items) => items.filter((current) => current.id !== item.id)); this.success.set('Bloqueio removido.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  transition(job: ProviderJob): void {
    if (this.acting()) return;
    const request = job.status === 'in_progress' ? this.marketplace.completeBooking(job.id) : this.marketplace.startBooking(job.id);
    this.acting.set(true); this.actionError.set('');
    request.subscribe({
      next: (booking) => { this.jobs.update((items) => items.map((item) => item.id === job.id ? { ...item, status: booking.status } : item)); this.success.set(booking.status === 'in_progress' ? 'Serviço iniciado.' : 'Serviço concluído.'); this.confirmTarget.set(''); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  onTheWay(job: ProviderJob): void {
    if (this.acting() || job.status !== 'confirmed') return;
    this.acting.set(true); this.actionError.set('');
    this.marketplace.markBookingOnTheWay(job.id).subscribe({
      next: (booking) => { this.jobs.update((items) => items.map((item) => item.id === job.id ? { ...item, status: booking.status } : item)); this.success.set('Cliente avisado: você está a caminho.'); this.acting.set(false); },
      error: (failure: Error) => { this.actionError.set(failure.message); this.acting.set(false); }
    });
  }

  weekday(value: number): string {
    return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][value] ?? `Dia ${value}`;
  }

  ruleLabel(label: string, index: number): string {
    return `${this.localization.translate(label)} ${index + 1}`;
  }

  private localDate(value: Date): string { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
}
