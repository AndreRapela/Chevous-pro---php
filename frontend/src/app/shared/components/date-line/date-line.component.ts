import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'cvp-date-line',
  standalone: true,
  imports: [DatePipe],
  template: `<time [attr.datetime]="value">{{ value | date:'EEEE, d MMM, HH:mm':'':'pt-BR' }}</time>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateLineComponent {
  @Input() value = '';
}
