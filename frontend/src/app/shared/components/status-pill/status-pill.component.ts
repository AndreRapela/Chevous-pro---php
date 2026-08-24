import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BookingStatus } from '../../../core/models';

@Component({
  selector: 'cvp-status-pill',
  standalone: true,
  imports: [NgClass],
  template: `<span class="status-pill" [ngClass]="'status-' + status">{{ label }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusPillComponent {
  @Input() status: BookingStatus = 'awaiting_confirmation';

  get label(): string {
    const labels: Record<BookingStatus, string> = {
      open: 'Aberto a propostas',
      awaiting_payment: 'Aguardando pagamento',
      awaiting_confirmation: 'Aguardando confirmação',
      confirmed: 'Confirmado',
      provider_on_the_way: 'Profissional a caminho',
      in_progress: 'Em andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      disputed: 'Em análise',
      refunded: 'Estornado'
    };
    return labels[this.status];
  }
}
