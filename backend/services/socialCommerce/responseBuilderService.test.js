import { describe, expect, it } from 'vitest';
import { buildSocialResponse, buildUnknownProductResponse, buildGreetingResponse } from './responseBuilderService.js';

process.env.HDMARKET_PUBLIC_URL = 'https://hdmarket.cg';

const baseProduct = {
  title: 'Table basse LED',
  price: 45000,
  discount: 0,
  currency: 'XAF',
  wholesaleEnabled: false,
  wholesaleTiers: [],
  installmentEnabled: false,
  deliveryAvailable: true,
  pickupAvailable: true
};

const shop = { shopName: 'ETS HD Home Decor', shopVerified: true, city: 'Brazzaville' };

// Match production's exact formatting (Node's fr-FR toLocaleString uses a
// narrow no-break space as the thousands separator, not a plain space) by
// calling the same method here instead of retyping the separator by hand.
const money = (amount) => `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;

describe('responseBuilderService', () => {
  it('PRICE response includes live price, shop name and the smart link', () => {
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'PRICE', product: baseProduct, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain('Table basse LED');
    expect(text).toContain(money(45000));
    expect(text).toContain('ETS HD Home Decor');
    expect(text).toContain('https://hdmarket.cg/s/HD-8F42K?source=whatsapp');
  });

  it('reflects a price change immediately — no caching (Scenario D)', () => {
    const updated = { ...baseProduct, price: 40000 };
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'PRICE', product: updated, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain(money(40000));
    expect(text).not.toContain(money(45000));
  });

  it('applies the discount to the PRICE response', () => {
    const discounted = { ...baseProduct, discount: 10 };
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'PRICE', product: discounted, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain(money(40500));
  });

  it('WHOLESALE response shows the minimum tier quantity when enabled', () => {
    const wholesale = { ...baseProduct, wholesaleEnabled: true, wholesaleTiers: [{ minQty: 5, unitPrice: 40000 }, { minQty: 10, unitPrice: 38000 }] };
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'WHOLESALE', product: wholesale, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain('5 unités');
  });

  it('WHOLESALE response says unavailable when the product has no wholesale tiers', () => {
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'WHOLESALE', product: baseProduct, shop, socialCode: 'HD-8F42K' });
    expect(text).toMatch(/pas de tarif de gros/);
  });

  it('INSTALLMENT response mentions "paiement par tranche" when enabled', () => {
    const installment = { ...baseProduct, installmentEnabled: true };
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'INSTALLMENT', product: installment, shop, socialCode: 'HD-8F42K' });
    expect(text).toMatch(/paiement par tranche/);
  });

  it('ORDER response points back to the HDMarket smart link, not a bare confirmation', () => {
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'ORDER', product: baseProduct, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain('commander');
    expect(text).toContain('https://hdmarket.cg/s/HD-8F42K');
  });

  it('formats currency from the product, never hardcoding FCFA for a different currency', () => {
    const usdProduct = { ...baseProduct, currency: 'USD', price: 100 };
    const text = buildSocialResponse({ channel: 'WHATSAPP', intent: 'PRICE', product: usdProduct, shop, socialCode: 'HD-8F42K' });
    expect(text).toContain('$');
    expect(text).not.toContain('FCFA');
  });

  it('buildUnknownProductResponse never hallucinates a product', () => {
    const text = buildUnknownProductResponse();
    expect(text).toMatch(/n.*ai pas trouvé/i);
    expect(text).toContain('HD-XXXXX');
  });

  it('buildGreetingResponse explains how to use the bot', () => {
    expect(buildGreetingResponse()).toContain('HD-XXXXX');
  });
});
