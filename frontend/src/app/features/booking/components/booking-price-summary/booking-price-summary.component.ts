import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { BookingQuote, Service } from '../../../../core/models';
import { LocalizationService } from '../../../../core/localization/localization.service';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';

@Component({
  selector: 'cvp-booking-price-summary',
  standalone: true,
  imports: [LocalizedMoneyPipe],
  templateUrl: './booking-price-summary.component.html',
  styles: `:host { display: block; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookingPriceSummaryComponent {
  private readonly localization = inject(LocalizationService);
  @Input({ required: true }) service!: Service;
  @Input() homeSize = 0;
  @Input() quote: BookingQuote | null = null;
  @Input() loading = false;
  @Input() marketplace = false;

  get detailLabel(): string {
    if (this.quote?.pricingType === 'area' || this.service.pricingType === 'area')
      return `${this.quote?.areaSqm ?? this.homeSize} m²`;
    if (this.quote?.pricingType === 'hourly' || this.service.pricingType === 'hourly') {
      const hours = (this.quote?.durationMinutes ?? this.service.durationMinutes) / 60;
      return `${hours} ${this.localization.translate(hours === 1 ? 'hora' : 'horas')}`;
    }
    const quantity = this.quote?.quantity ?? 1;
    return `${quantity} ${this.localization.translate(quantity === 1 ? 'unidade' : 'unidades')}`;
  }
}
