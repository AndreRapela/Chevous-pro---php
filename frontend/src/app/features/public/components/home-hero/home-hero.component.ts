import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ServiceIconComponent } from '../../../../shared/components/service-icon/service-icon.component';

@Component({
  selector: 'cvp-home-hero',
  standalone: true,
  imports: [FormsModule, RouterLink, ServiceIconComponent],
  templateUrl: './home-hero.component.html',
  styleUrl: './home-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHeroComponent {
  @Input() query = '';
  @Output() readonly queryChange = new EventEmitter<string>();
  @Output() readonly searchRequested = new EventEmitter<void>();

  updateQuery(value: string): void {
    this.query = value;
    this.queryChange.emit(value);
  }

  submitSearch(): void {
    this.searchRequested.emit();
  }
}
