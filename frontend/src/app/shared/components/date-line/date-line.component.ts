import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LocalizedDatePipe } from '../../localization/localized-format.pipe';

@Component({
  selector: 'cvp-date-line',
  standalone: true,
  imports: [LocalizedDatePipe],
  template: `<time [attr.datetime]="value">{{ value | appDate:'EEEE, d MMM, HH:mm' }}</time>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateLineComponent {
  @Input() value = '';
}
