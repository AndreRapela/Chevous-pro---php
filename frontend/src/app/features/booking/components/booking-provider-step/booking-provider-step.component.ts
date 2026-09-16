import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ProviderProfile } from '../../../../core/models';
import { AvatarComponent, RatingComponent, StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-provider-step',
  standalone: true,
  imports: [AvatarComponent, LocalizedMoneyPipe, RatingComponent, ReactiveFormsModule, StatePanelComponent],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-provider-title">
      <span class="eyebrow">Compare e escolha</span><h1 id="step-provider-title" tabindex="-1">Quem vai cuidar da sua casa?</h1><p>Escolha agora ou publique a solicitação para receber propostas de profissionais compatíveis.</p>
      <div class="provider-choice-list">
        <label class="provider-choice marketplace-choice" [class.selected]="form.controls.providerId.value === marketplaceValue"><input type="radio" formControlName="providerId" [value]="marketplaceValue" (change)="quoteRequested.emit()"><span class="marketplace-choice-icon" aria-hidden="true">+</span><div><div class="provider-name-line"><strong>Receber propostas</strong></div><small>Profissionais interessados poderão enviar um valor de referência e uma mensagem. Você escolhe com calma.</small><div class="chip-row"><span class="chip chip-soft">Sem compromisso</span><span class="chip chip-soft">Compare ofertas</span></div></div><div class="provider-choice-price"><strong>Após escolher</strong><small>reserva confirmada</small><i aria-hidden="true"></i></div></label>
        @for (person of providers; track person.id) { <label class="provider-choice" [class.selected]="form.controls.providerId.value === person.id"><input type="radio" formControlName="providerId" [value]="person.id" (change)="quoteRequested.emit()"><cvp-avatar [initials]="person.initials" size="lg" /><div><div class="provider-name-line"><strong>{{ person.name }}</strong>@if (person.verified) { <span class="verified" aria-label="Perfil aprovado">✓</span> }</div><small>{{ person.headline }}</small><cvp-rating [rating]="person.rating" [count]="person.reviewCount" /><div class="chip-row">@for (quality of person.qualities.slice(0, 2); track quality) { <span class="chip chip-soft">{{ quality }}</span> }</div></div><div class="provider-choice-price"><strong>{{ person.priceFromCents > 0 ? (person.priceFromCents / 100 | appMoney:'BRL':0) : 'Calcular no resumo' }}</strong><small>valor de referência</small><i aria-hidden="true"></i></div></label> }
      </div>
      @if (!providers.length) { <cvp-state-panel kind="empty" title="Nenhum perfil livre nesse horário" message="Você ainda pode receber propostas ou voltar para escolher outro horário." /> }
      @if (invalid) { <small class="field-error">Escolha um profissional ou a opção de receber propostas.</small> }
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingProviderStepComponent {
  readonly marketplaceValue = '__marketplace__';
  @Input({ required: true }) form!: BookingForm;
  @Input() providers: ProviderProfile[] = [];
  @Output() readonly quoteRequested = new EventEmitter<void>();

  get invalid(): boolean {
    const control = this.form.controls.providerId;
    return control.invalid && (control.touched || control.dirty);
  }
}
