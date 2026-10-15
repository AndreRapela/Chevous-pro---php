import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Service } from '../../../../core/models';
import { BookingForm } from '../../models/booking-form.model';
import { homeSizeRange } from '../../utils/booking-home-size.util';

@Component({
  selector: 'cvp-booking-details-step',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './booking-details-step.component.html',
  styleUrl: './booking-details-step.component.scss',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingDetailsStepComponent {
  @Input({ required: true }) form!: BookingForm;
  @Input({ required: true }) service!: Service;
  @Output() readonly quoteRequested = new EventEmitter<void>();

  get sizeRange() {
    return homeSizeRange(this.service);
  }
  get areaPricing(): boolean {
    return this.service.pricingType === 'area' || this.service.unit === 'm²';
  }
  get quantityMinimum(): number {
    return Math.max(1, this.service.minimumQuantity || 1);
  }
  get quantityMaximum(): number {
    return Math.max(this.quantityMinimum, this.service.maximumQuantity || 10000);
  }

  updateQuantity(change: -1 | 1): void {
    const control = this.form.controls.quantity;
    if (control.disabled) return;
    const current = Number.isSafeInteger(control.value) ? control.value : this.quantityMinimum;
    const next = Math.max(this.quantityMinimum, Math.min(this.quantityMaximum, current + change));
    if (next === control.value) return;
    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
    this.quoteRequested.emit();
  }

  selected(id: string): boolean {
    return this.form.controls.addonIds.value.includes(id);
  }

  toggleAddon(id: string, checked: boolean): void {
    const values = this.form.controls.addonIds.value.filter((value) => value !== id);
    this.form.controls.addonIds.setValue(checked ? [...values, id] : values);
    this.quoteRequested.emit();
  }
}
