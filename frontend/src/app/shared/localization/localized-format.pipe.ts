import { formatDate } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { AppCurrency, LocalizationService } from '../../core/localization/localization.service';

@Pipe({ name: 'appMoney', standalone: true, pure: false })
export class LocalizedMoneyPipe implements PipeTransform {
  private readonly localization = inject(LocalizationService);
  transform(value: number | null | undefined, sourceCurrency: AppCurrency = 'BRL', maximumFractionDigits = 2): string {
    return this.localization.formatMoney(Number(value), sourceCurrency, maximumFractionDigits);
  }
}

@Pipe({ name: 'appDate', standalone: true, pure: false })
export class LocalizedDatePipe implements PipeTransform {
  private readonly localization = inject(LocalizationService);
  transform(value: string | number | Date | null | undefined, format = 'mediumDate', timezone?: string): string {
    if (value === null || value === undefined || value === '') return '';
    try { return formatDate(value, format, this.localization.locale(), timezone); } catch { return String(value); }
  }
}

@Pipe({ name: 'appNumber', standalone: true, pure: false })
export class LocalizedNumberPipe implements PipeTransform {
  private readonly localization = inject(LocalizationService);
  transform(value: number | null | undefined, minimumFractionDigits = 0, maximumFractionDigits = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '';
    return new Intl.NumberFormat(this.localization.locale(), { minimumFractionDigits, maximumFractionDigits }).format(value);
  }
}
