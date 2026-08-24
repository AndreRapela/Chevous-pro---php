import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DashboardMetric } from '../../../core/models';

@Component({
  selector: 'cvp-metric-grid',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="metric-grid">
      @for (metric of metrics; track metric.label) {
        <article class="metric-card" [ngClass]="'metric-' + (metric.tone || 'neutral')">
          <p>{{ metric.label }}</p>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.hint }}</small>
        </article>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricGridComponent {
  @Input() metrics: DashboardMetric[] = [];
}
