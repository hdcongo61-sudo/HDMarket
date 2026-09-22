import { test, expect } from '@playwright/test';
const fixture = '/e2e/fixtures/conversion.html';
const productId = '111111111111111111111111';
const sellerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
});

test('home suppresses service and free-delivery promotions disabled by the admin', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('test-flags', JSON.stringify({ enable_pay_for_other: false, enable_full_payment_free_delivery: false, enable_buy_for_me: false, enable_parcel_delivery: false })));
  await page.goto(`${fixture}?screen=home`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href="/buy-for-me"]')).toHaveCount(0);
  await expect(page.locator('a[href="/parcels/new"]')).toHaveCount(0);
  await expect(page.getByText(/PAIEMENT PAR UN PROCHE|Livraison offerte/i)).toHaveCount(0);
  await expect(page.locator('main, [class*="min-h-screen"]').first()).toBeVisible();
});

test('gallery photo selects the same priced item that is sent to the cart', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const product = { _id: productId, slug: 'conversion.html', title: 'Commode et miroir', status: 'approved', price: 170000, listingFeeSettled: true, user: { _id: sellerId, name: 'Boutique' },
    images: ['/test-commode.svg', '/test-miroir.svg'], attributes: [{ name: 'Modèle', type: 'select', options: ['Commode', 'Miroir'], defaultValue: 'Commode', optionPrices: { commode: 170000, miroir: 45000 }, optionImages: { commode: 0, miroir: 1 } }] };
  await page.route('**/test-*.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="orange"/></svg>' }));
  await page.route('**/api/products/public/conversion.html', route => route.fulfill({ json: product }));
  let selected;
  await page.route('**/api/cart/preview', route => {
    selected = route.request().postDataJSON().items[0].selectedAttributes;
    return route.fulfill({ json: { items: [{ product, quantity: 1, unitPrice: 45000, lineTotal: 45000, selectedAttributes: selected }], totals: { quantity: 1, subtotal: 45000 } } });
  });
  await page.goto(`${fixture}?screen=product`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Image suivante', exact: true }).first().click();
  await expect(page.getByText(/45\s*000\s*FCFA/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter au panier', exact: true }).last().click();
  await expect(page.getByTestId('cart-total')).toHaveText('45000');
  expect(selected).toEqual([{ name: 'Modèle', value: 'Miroir' }]);
});

test('disabled services disappear from benefits and footer after a capability refresh', async ({ page }) => {
  let enabled = true;
  await page.route('**/api/buy-for-me/capabilities', route => route.fulfill({ json: { enabled } }));
  await page.route('**/api/parcels/capabilities', route => route.fulfill({ json: { enabled } }));
  await page.goto(`${fixture}?screen=services`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href="/buy-for-me"]').first()).toBeVisible();
  await expect(page.locator('a[href="/parcels/new"]').first()).toBeVisible();
  enabled = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // React Query also refreshes after the shared settings event.
  await page.evaluate(async () => {
    const settings = await import('/src/utils/settingsRefresh.js');
    settings.emitSettingsRefresh?.();
  });
  await expect(page.locator('a[href="/buy-for-me"]')).toHaveCount(0, { timeout: 35000 });
  await expect(page.locator('a[href="/parcels/new"]')).toHaveCount(0);
});

test('PawaPay-only checkout offers an enabled sponsor and charges delivery when the benefit is disabled', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('test-auth', '1');
    localStorage.setItem('test-flags', JSON.stringify({ enable_pay_for_other: true, enable_full_payment_free_delivery: false }));
  });
  const product = { _id: productId, price: 10000, title: 'Article test', user: { _id: sellerId, name: 'Boutique' }, images: [], deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: true, deliveryFee: 1200 };
  await page.route('**/api/cart', route => route.fulfill({ json: { items: [{ product, quantity: 1, unitPrice: 10000, lineTotal: 10000 }], totals: { quantity: 1, subtotal: 10000 } } }));
  await page.route('**/api/cart/delivery-estimate', route => route.fulfill({ json: { subtotal: 10000, deliveryFeeTotal: 750, total: 10750, bySeller: { [sellerId]: { fee: 750, source: 'COMMUNE_FIXED' } } } }));
  await page.goto(`${fixture}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Un proche paie', { exact: true })).toBeVisible();
  await page.getByText('Un proche paie', { exact: true }).click();
  await expect(page.getByText(/Numéro du proche/).first()).toBeVisible();
  await page.getByText('PawaPay', { exact: true }).first().click();
  // Persist a complete delivery destination, then exercise the real quote UI.
  await page.evaluate(() => {
    sessionStorage.setItem('hdmarket:checkout-draft:bbbbbbbbbbbbbbbbbbbbbbbb:cccccccccccccccccccccccc', JSON.stringify({ savedAt: Date.now(), draft: { deliveryMode: 'DELIVERY', paymentPercent: 100, shippingAddress: { cityId: 'dddddddddddddddddddddddd', communeId: 'eeeeeeeeeeeeeeeeeeeeeeee', addressLine: 'Rue test', phone: '+242060000001' } } }));
    sessionStorage.removeItem('hdmarket:delivery-preference:cccccccccccccccccccccccc');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /payer.*10\s*750/i }).last()).toBeVisible();
  await expect(page.getByText('Paiement intégral — livraison offerte.')).toHaveCount(0);
});
