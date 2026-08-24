import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile } from '../../../../core/models';
import { AvatarComponent, RatingComponent, StatePanelComponent } from '../../../../shared/components';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-provider-step',
  standalone: true,
  imports: [AvatarComponent, CurrencyPipe, RatingComponent, ReactiveFormsModule, StatePanelComponent],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-provider-title">
      <span class="eyebrow">Compare e escolha</span><h1 id="step-provider-title" tabindex="-1">Quem vai cuidar da sua casa?</h1><p>Todos os perfis abaixo oferecem o serviço selecionado.</p>
      @if (!providers.length) { <cvp-state-panel kind="empty" title="Nenhum profissional disponível" message="Volte e escolha outra data ou horário." /> }
      @else { <div class="provider-choice-list">@for (person of providers; track person.id) { <label class="provider-choice" [class.selected]="form.controls.providerId.value === person.id"><input type="radio" formControlName="providerId" [value]="person.id" (change)="quoteRequested.emit()"><cvp-avatar [initials]="person.initials" size="lg" /><div><div class="provider-name-line"><strong>{{ person.name }}</strong>@if (person.verified) { <span class="verified" aria-label="Perfil aprovado">✓</span> }</div><small>{{ person.headline }}</small><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /><div class="chip-row">@for (quality of person.qualities.slice(0, 2); track quality) { <span class="chip chip-soft">{{ quality }}</span> }</div></div><div class="provider-choice-price"><strong>{{ person.priceFromCents > 0 ? (person.priceFromCents / 100 | currency:'BRL':'symbol':'1.0-0':'pt-BR') : 'Calcular no resumo' }}</strong><small>valor de referência</small><i aria-hidden="true"></i></div></label> }</div> }
      @if (invalid) { <small class="field-error">Escolha um profissional para continuar.</small> }
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProviderStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input() providers: ProviderProfile[] = [];
  @Output() readonly quoteRequested = new EventEmitter<void>();

  get invalid(): boolean {
    const control = this.form.controls.providerId;
    return control.invalid && (control.touched || control.dirty);
  }
}
