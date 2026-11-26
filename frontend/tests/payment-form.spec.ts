import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkoutTotalCents, stripeCheckoutUrl } from '../src/app/features/checkout/utils/payment-form.util.ts';

describe('product checkout', () => {
  it('calculates integer cent totals for quantities and shipping', () => {
    assert.equal(checkoutTotalCents(8990, 3, 1000), 27970);
    assert.equal(checkoutTotalCents(8990, 0), 8990);
    assert.equal(checkoutTotalCents(8990, 1.5), 8990);
    assert.equal(checkoutTotalCents(-1, 2), 0);
  });

  it('redirects only to the HTTPS Stripe Checkout origin', () => {
    assert.equal(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_order'), 'https://checkout.stripe.com/c/pay/cs_test_order');
    for (const url of ['//checkout.stripe.com', 'http://checkout.stripe.com', 'https://checkout.stripe.com.example.test',
      'https://user@example.test@checkout.stripe.com', 'https://checkout.stripe.com:444', 'javascript:alert(1)']) {
      assert.equal(stripeCheckoutUrl(url), null);
    }
  });
});
