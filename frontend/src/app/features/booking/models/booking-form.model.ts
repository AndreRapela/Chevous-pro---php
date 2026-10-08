import { FormBuilder, Validators } from '@angular/forms';
import { Service } from '../../../core/models';
import { homeSizeRange } from '../utils/booking-home-size.util';

export function createBookingForm(formBuilder: FormBuilder) {
  return formBuilder.nonNullable.group({
    homeSize: [80, [Validators.required, Validators.min(20), Validators.max(400)]],
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    durationMinutes: [120, [Validators.required, Validators.min(30), Validators.max(1440)]],
    addonIds: formBuilder.nonNullable.control<string[]>([]),
    notes: ['', Validators.maxLength(500)],
    address: formBuilder.nonNullable.group({
      postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}-\d{3}$/)]],
      street: ['', Validators.required],
      number: ['', Validators.required],
      complement: [''],
      neighborhood: ['', Validators.required],
      city: ['São Paulo', Validators.required],
      state: ['SP', Validators.required]
    }),
    date: ['', Validators.required],
    time: ['', Validators.required],
    providerId: ['', Validators.required],
    terms: [false, Validators.requiredTrue]
  });
}

export type BookingForm = ReturnType<typeof createBookingForm>;
export type BookingFormValue = ReturnType<BookingForm['getRawValue']>;

export function configureBookingFormForService(form: BookingForm, service: Service): void {
  const minimum = Math.max(1, service.minimumQuantity || 1);
  const maximum = Math.max(minimum, service.maximumQuantity || 10000);
  const range = homeSizeRange(service);
  form.controls.homeSize.setValidators([Validators.required, Validators.min(range?.minimum ?? 1), Validators.max(range?.maximum ?? 10000)]);
  form.controls.homeSize.setValue(Math.min(range?.maximum ?? 10000, Math.max(range?.minimum ?? 1, 80)));
  const areaPricing = service.pricingType === 'area' || service.unit === 'm²';
  form.controls.quantity.setValidators([Validators.required, Validators.min(areaPricing ? 1 : minimum), Validators.max(areaPricing ? 10000 : maximum)]);
  form.controls.quantity.setValue(areaPricing ? 1 : minimum);
  form.controls.durationMinutes.setValue(Math.min(1440, Math.max(30, service.durationMinutes)));
  form.controls.homeSize.updateValueAndValidity();
  form.controls.quantity.updateValueAndValidity();
  form.controls.durationMinutes.updateValueAndValidity();
}
