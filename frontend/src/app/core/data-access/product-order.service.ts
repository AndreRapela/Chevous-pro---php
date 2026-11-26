import { Injectable, inject } from '@angular/core';
import { AppCurrency, AppLanguage } from '../localization/localization.service';
import { ApiService } from '../http/api.service';

export interface ProductCheckoutQuote {
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  available: number;
  currency: AppCurrency;
  unitCents: number;
  shippingCents: number;
  enabled: boolean;
  testMode: boolean;
}

export interface ProductOrder {
  id: string;
  status: 'pending' | 'paid' | 'expired';
  productName: string;
  productSlug: string;
  quantity: number;
  totalCents: number;
  currency: AppCurrency;
  testMode: boolean;
}

export interface AdminProductOrder extends ProductOrder {
  createdAt: string;
  providerSessionId: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProductOrderService {
  private readonly api = inject(ApiService);

  quote(slug: string, currency: AppCurrency) {
    return this.api.get<ProductCheckoutQuote>(this.checkoutPath(slug), { currency });
  }

  start(quote: ProductCheckoutQuote, quantity: number, expectedTotalCents: number, locale: AppLanguage, key: string) {
    return this.api.post<{ id: string; checkoutUrl: string }>(this.checkoutPath(quote.slug),
      { currency: quote.currency, quantity, expectedTotalCents, locale },
      { headers: { 'Idempotency-Key': key } });
  }

  order(id: string) {
    return this.api.get<ProductOrder>(`product-orders/${encodeURIComponent(id)}`);
  }

  adminOrders(page: number) {
    return this.api.getEnvelope<AdminProductOrder[]>('admin/product-orders', { page });
  }

  private checkoutPath(slug: string): string {
    return `products/${encodeURIComponent(slug)}/checkout`;
  }
}
