import { FormBuilder, Validators } from '@angular/forms';

export function createBookingForm(formBuilder: FormBuilder) {
  return formBuilder.nonNullable.group({
    homeSize: [80, [Validators.required, Validators.min(20), Validators.max(400)]],
    quantity: [1, [Validators.required, Validators.min(1), Validators.max(10000)]],
    durationMinutes: [120, [Validators.required, Validators.min(30), Validators.max(1440)]],
    addonIds: formBuilder.nonNullable.control<string[]>([]),
    notes: ['', Validators.maxLength(500)],
    address: formBuilder.nonNullable.group({
      postalCode: ['', Validators.required],
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
