import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Service } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';

@Component({
  selector: 'cvp-booking-details-step',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="wizard-step" [formGroup]="form" aria-labelledby="step-details-title">
      <span class="eyebrow">Conte um pouco mais</span><h1 id="step-details-title" tabindex="-1">Como será o serviço?</h1><p>Usamos esses detalhes para calcular o valor no servidor e preparar o profissional.</p>
      <div class="selected-service"><span class="service-symbol">{{ service.symbol }}</span><div><strong>{{ service.name }}</strong><small>{{ service.description }}</small></div><a routerLink="/servicos">Trocar</a></div>
      @if (service.pricingType === 'area') {
        <fieldset><legend>Tamanho aproximado da área</legend><div class="range-value"><strong>{{ form.controls.homeSize.value }} m²</strong><span>Entre {{ service.minimumQuantity || 20 }} m² e {{ service.maximumQuantity || 400 }} m²</span></div><input class="range" type="range" [min]="service.minimumQuantity || 20" [max]="service.maximumQuantity || 400" step="1" formControlName="homeSize" aria-label="Área em metros quadrados" (input)="quoteRequested.emit()"><div class="range-labels"><span>{{ service.minimumQuantity || 20 }} m²</span><span>{{ service.maximumQuantity || 400 }} m²</span></div></fieldset>
      } @else if (service.pricingType === 'hourly') {
        <label for="booking-duration">Duração estimada<select id="booking-duration" formControlName="durationMinutes" (change)="quoteRequested.emit()"><option [value]="60">1 hora</option><option [value]="120">2 horas</option><option [value]="180">3 horas</option><option [value]="240">4 horas</option><option [value]="360">6 horas</option><option [value]="480">8 horas</option></select></label>
        <label for="booking-quantity">Quantidade de profissionais/unidades<input id="booking-quantity" type="number" [min]="service.minimumQuantity || 1" [max]="service.maximumQuantity || 100" formControlName="quantity" (change)="quoteRequested.emit()"></label>
      } @else if ((service.maximumQuantity || 1) > 1) {
        <label for="booking-quantity">Quantidade<input id="booking-quantity" type="number" [min]="service.minimumQuantity || 1" [max]="service.maximumQuantity || 100" formControlName="quantity" (change)="quoteRequested.emit()"></label>
      } @else {
        <div class="privacy-note"><span aria-hidden="true">✓</span><div><strong>Preço por serviço</strong><p>O valor cobre uma unidade deste serviço. Você revisará o cálculo antes de confirmar.</p></div></div>
      }
      @if (service.addons?.length) {
        <fieldset><legend>Adicionais <span class="optional">Opcional</span></legend><div class="toggle-list">@for (addon of service.addons; track addon.id) { <label class="check-row"><input type="checkbox" [checked]="selected(addon.id)" (change)="toggleAddon(addon.id, $any($event.target).checked)"><span><strong>{{ addon.name }}</strong><small>{{ addon.description }}</small></span></label> }</div></fieldset>
      }
      <label>Observações para o profissional <span class="optional">Opcional</span><textarea formControlName="notes" rows="4" maxlength="500" placeholder="Ex.: tenho dois gatos; trazer escada..."></textarea><small class="field-hint">{{ form.controls.notes.value.length }}/500 caracteres</small></label>
    </section>
  `,
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingDetailsStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input({ required: true }) service!: Service;
  @Output() readonly quoteRequested = new EventEmitter<void>();

  selected(id: string): boolean { return this.form.controls.addonIds.value.includes(id); }

  toggleAddon(id: string, checked: boolean): void {
    const values = this.form.controls.addonIds.value.filter((value) => value !== id);
    this.form.controls.addonIds.setValue(checked ? [...values, id] : values);
    this.quoteRequested.emit();
  }
}
