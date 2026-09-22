import { expect, test } from '@playwright/test';
const countryId = 'cccccccccccccccccccccccc';
const sellerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const productId = '111111111111111111111111';
const path = '/e2e/fixtures/conversion.html';
// The fixture imports several real pages; cold Vite compilation can exceed 30s.
test.setTimeout(60000);
const product = { _id: productId, title: 'Article test', price: 10000, user: { _id: sellerId, name: 'Boutique test' },
  deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: true, deliveryFee: 1200, images: [], attributes: [], countryId };
const pricedCart = (selections) => {
  const grouped = new Map();
  for (const item of selections) {
    const value = item.selectedAttributes?.[0]?.value || 'S';
    const previous = grouped.get(value);
    const quantity = (previous?.quantity || 0) + item.quantity;
    const unitPrice = value === 'S' ? 8000 : 12000;
    grouped.set(value, { product, quantity, selectedAttributes: [{ name: 'Taille', value }], selectionKey: `taille:${value.toLowerCase()}`, unitPrice, lineTotal: unitPrice * quantity });
  }
  const items = [...grouped.values()];
  return { items, countryId, currency: 'XAF', totals: { quantity: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0) }, rejected: [] };
};
test.beforeEach(async ({ page }) => {
  // All services are simulated. No payment, message or production write is made.
  await page.route('https://**', (route) => route.abort());
  await page.route('**/api/**', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/cart', (route) => route.fulfill({ json: pricedCart([]) }));
  await page.route('**/api/cart/preview', (route) => route.fulfill({ json: pricedCart(route.request().postDataJSON().items) }));
  await page.route('**/api/cart/delivery-estimate', (route) => {
    const cart = pricedCart(route.request().postDataJSON().items);
    return route.fulfill({ json: { subtotal: cart.totals.subtotal, deliveryFeeTotal: 750, total: cart.totals.subtotal + 750, bySeller: { [sellerId]: { fee: 750, source: 'COMMUNE_FIXED' } } } });
  });
});

test('guests keep selected options after refresh and merge once after login', async ({ page }) => {
  let merges = 0;
  await page.route('**/api/cart/merge', (route) => {
    expect(route.request().headers()['x-country-id']).toBe(countryId);
    merges++;
    return route.fulfill({ json: pricedCart([...route.request().postDataJSON().items, { productId, quantity: 2, selectedAttributes: [{ name: 'Taille', value: 'S' }] }]) });
  });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ajouter S', exact: true }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('8000');
  await page.getByRole('button', { name: 'Ajouter L', exact: true }).click();
  await expect(page.getByTestId('cart-total')).toHaveText('20000');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cart-quantity')).toHaveText('2');
  await expect(page.getByTestId('cart-total')).toHaveText('20000');
  await page.getByRole('button', { name: 'Connexion de test' }).click();
  await expect(page.getByTestId('cart-quantity')).toHaveText('4');
  await expect(page.getByTestId('cart-total')).toHaveText('36000');
  expect(merges).toBe(1);
  expect(await page.evaluate((id) => localStorage.getItem(`hdmarket:guest-cart:${id}`), countryId)).toBeNull();
});

test('guest cart shows destination delivery and the full estimated total', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ajouter S', exact: true }).click();
  await page.getByLabel('Mode de réception').selectOption('DELIVERY');
  const estimate = page.getByRole('region', { name: 'Estimation de livraison' });
  await expect(estimate).toContainText('À calculer');
  await estimate.getByRole('combobox', { name: 'Ville', exact: true }).selectOption('dddddddddddddddddddddddd');
  await estimate.getByRole('combobox', { name: 'Commune', exact: true }).selectOption('eeeeeeeeeeeeeeeeeeeeeeee');
  await expect(estimate).toContainText(/8\s*750/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await estimate.screenshot({ path: testInfo.outputPath('mobile-delivery-estimate.png') });
});

test('a blocked popup falls back to the same tab with the original checkout', async ({ page }) => {
  let payments = 0;
  await page.addInitScript(() => { window.open = () => null; localStorage.setItem('test-auth', '1'); });
  await page.route('**/api/payments/pawapay/checkouts', (route) => {
    payments++;
    return route.fulfill({ json: { checkoutId: 'checkout-test', redirectUrl: `${path}?screen=return&checkoutId=checkout-test` } });
  });
  await page.route('**/api/payments/pawapay/checkouts/checkout-test', (route) => route.fulfill({ json: { checkoutId: 'checkout-test', status: 'WAITING_PAYMENT', paymentState: 'PENDING' } }));
  await page.goto(`${path}?screen=payment`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Payer avec PawaPay/ }).click();
  await expect(page).toHaveURL(/screen=return/);
  await expect(page.getByRole('heading', { name: 'Paiement en cours' })).toBeVisible();
  expect(payments).toBe(1);
});

test('checkout recovers delivery details after reload and does not allow unknown delivery fees', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('test-auth', '1'));
  await page.route('**/api/cart', (route) => route.fulfill({ json: pricedCart([{ productId, quantity: 1 }]) }));
  await page.goto(`${path}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cart-loading')).toHaveText('false');
  await page.evaluate(({ countryId }) => {
    sessionStorage.setItem(`hdmarket:checkout-draft:bbbbbbbbbbbbbbbbbbbbbbbb:${countryId}`, JSON.stringify({ savedAt: Date.now(), draft: { deliveryMode: 'DELIVERY', paymentPercent: 70, shippingAddress: { cityId: 'dddddddddddddddddddddddd', communeId: 'eeeeeeeeeeeeeeeeeeeeeeee', addressLine: 'Adresse de test', phone: '+242060000001' } } }));
    sessionStorage.removeItem(`hdmarket:delivery-preference:${countryId}`);
  }, { countryId });
  await page.route('**/api/cart/delivery-estimate', (route) => route.fulfill({ status: 503, json: { message: 'Estimation temporairement indisponible.' } }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[value="Adresse de test"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /Total à confirmer/ }).last()).toBeDisabled();
  await expect(page.getByText('Estimation temporairement indisponible.', { exact: false }).first()).toBeVisible();
});

test('registration reaches submission without address or gender fields', async ({ page }) => {
  await page.goto(`${path}?screen=register`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Prénom', { exact: true }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Buyer');
  await page.getByLabel('Téléphone', { exact: true }).fill('060000001');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByPlaceholder('Mot de passe', { exact: true }).fill('TestPassword9');
  await page.getByPlaceholder('Confirmer le mot de passe', { exact: true }).fill('TestPassword9');
  await page.getByRole('checkbox').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Créer mon compte', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: /Adresse|Genre|Ville/ })).toHaveCount(0);
});

test('verified checkout completion clears its recovery draft', async ({ page }) => {
  await page.addInitScript(({ countryId }) => {
    localStorage.setItem('test-auth', '1');
    sessionStorage.setItem(`hdmarket:checkout-draft:bbbbbbbbbbbbbbbbbbbbbbbb:${countryId}`, JSON.stringify({ savedAt: Date.now(), draft: { deliveryMode: 'DELIVERY' } }));
  }, { countryId });
  await page.route('**/api/payments/pawapay/checkouts/confirmed-test', (route) => route.fulfill({ json: {
    checkoutId: 'confirmed-test', status: 'COMPLETED', paymentState: 'CONFIRMED', actionKind: 'ORDER_CHECKOUT', autoValidationState: 'COMPLETED', completionResult: { orderIds: ['created-order'] }
  } }));
  await page.goto(`${path}?screen=return&checkoutId=confirmed-test`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Paiement reçu' })).toBeVisible();
  await expect(page).toHaveURL(/\/order\/detail\/created-order$/);
  expect(await page.evaluate(({ countryId }) => sessionStorage.getItem(`hdmarket:checkout-draft:bbbbbbbbbbbbbbbbbbbbbbbb:${countryId}`), { countryId })).toBeNull();
});
