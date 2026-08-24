import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BookingFormValue } from '../models/booking-form.model';

interface StoredBookingDraft {
  version: 2;
  serviceId: string;
  step: number;
  value: BookingFormValue;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class BookingDraftStorageService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly key = 'cvp_booking_draft';

  load(serviceId: string): StoredBookingDraft | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredBookingDraft;
      const valid = stored.version === 2 && stored.serviceId === serviceId && Number.isInteger(stored.step) && stored.step >= 0 && stored.step <= 4 && typeof stored.savedAt === 'number' && Date.now() - stored.savedAt <= 24 * 60 * 60 * 1000 && stored.value && typeof stored.value === 'object';
      if (!valid) this.clear();
      return valid ? stored : null;
    } catch {
      this.clear();
      return null;
    }
  }

  save(serviceId: string, step: number, value: BookingFormValue): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const draft: StoredBookingDraft = { version: 2, serviceId, step, value, savedAt: Date.now() };
    try { sessionStorage.setItem(this.key, JSON.stringify(draft)); } catch { /* A reserva continua mesmo sem armazenamento local. */ }
  }

  clear(): void {
    if (isPlatformBrowser(this.platformId)) { try { sessionStorage.removeItem(this.key); } catch { /* armazenamento indisponível */ } }
  }
}
