import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MarketplaceService } from '../../../../core/data-access/marketplace.service';
import { Product } from '../../../../core/models';
import { StatePanelComponent } from '../../../../shared/components';
import { LocalizedMoneyPipe } from '../../../../shared/localization/localized-format.pipe';
import { SeoService } from '../../../../core/seo/seo.service';

@Component({
  selector: 'cvp-products',
  standalone: true,
  imports: [FormsModule, LocalizedMoneyPipe, RouterLink, StatePanelComponent],
  templateUrl: './products.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsComponent implements OnInit {
  private readonly marketplace = inject(MarketplaceService);
  private readonly seo = inject(SeoService);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';

  ngOnInit(): void {
    this.seo.update({
      title: 'Produtos para casa | Pro',
      description: 'Encontre utilidades selecionadas para cuidar, organizar e manter sua casa.',
      canonicalPath: '/produtos'
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.marketplace.products({ q: this.query.trim() || undefined }).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (failure: Error) => {
        this.error.set(failure.message);
        this.loading.set(false);
      }
    });
  }
}
