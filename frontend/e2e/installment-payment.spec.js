import { expect, test } from '@playwright/test';
const path = '/e2e/fixtures/conversion.html';
const countryId = 'cccccccccccccccccccccccc', sellerId = 'aaaaaaaaaaaaaaaaaaaaaaaa', productId = '111111111111111111111111';
test.setTimeout(60000);
const product = { _id: productId, title: 'Article en tranches', price: 12000, images: [], attributes: [], countryId,
  user: { _id: sellerId, name: 'Boutique test' }, deliveryAvailable: true, pickupAvailable: true, deliveryFeeEnabled: true, deliveryFee: 1500,
  installmentEnabled: true, installmentMinAmount: 3000, installmentDuration: 90, installmentStartDate: '2020-01-01', installmentEndDate: '2099-01-01' };
const cart = { items: [{ product, quantity: 1, unitPrice: 12000, lineTotal: 12000, selectedAttributes: [] }], totals: { subtotal: 12000, quantity: 1 }, countryId, currency: 'XAF' };
test.beforeEach(async ({ page, context }) => {
  await context.route('https://**', route => route.abort());
  await context.route('**/api/**', route => route.fulfill({ json: { items: [] } }));
  await page.addInitScript(({ countryId }) => {
    localStorage.setItem('test-auth', '1');
    sessionStorage.setItem(`hdmarket:checkout-draft:bbbbbbbbbbbbbbbbbbbbbbbb:${countryId}`, JSON.stringify({ savedAt: Date.now(), draft: {
      paymentMode: 'installment', deliveryMode: 'DELIVERY', shippingAddress: { cityId: 'dddddddddddddddddddddddd', communeId: 'eeeeeeeeeeeeeeeeeeeeeeee', addressLine: 'Adresse test', phone: '+242060000001' }
    } }));
  }, { countryId });
  await context.route('**/api/cart', route => route.fulfill({ json: cart }));
  await context.route('**/api/cart/delivery-estimate', route => route.fulfill({ json: { subtotal: 12000, deliveryFeeTotal: 1500, total: 13500, bySeller: { [sellerId]: { fee: 1500, source: 'PRODUCT_FEE' } } } }));
});

test('installment checkout includes delivery in the balance and sends the exact first payment', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  let submitted;
  await context.route('**/api/payments/pawapay/checkouts', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 400, json: { message: 'Arrêt du test avant prestataire.' } });
  });
  await page.goto(`${path}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/13\s*500/).first()).toBeVisible();
  await expect(page.getByText(/10\s*500/).first()).toBeVisible();
  const pay = page.getByRole('button', { name: /Payer.*3\s*000|Confirmer.*3\s*000/ }).last();
  await pay.click();
  await expect.poll(() => submitted).toMatchObject({ amount: 3000, purpose: 'INSTALLMENT_FUNDING', actionContext: { kind: 'INSTALLMENT_CHECKOUT', firstPaymentAmount: 3000, deliveryMode: 'DELIVERY' } });
  expect(errors).toEqual([]);
});

test('unknown delivery fees block installment checkout', async ({ page, context }) => {
  await context.route('**/api/cart/delivery-estimate', route => route.fulfill({ status: 503, json: { message: 'Estimation indisponible.' } }));
  await page.goto(`${path}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Total à confirmer/ }).last()).toBeDisabled();
});

test('a small delivery balance is included in the first payment instead of creating an unpayable tranche', async ({ page, context }) => {
  await context.route('**/api/cart', route => route.fulfill({ json: { ...cart,
    items: [{ ...cart.items[0], product: { ...product, installmentMinAmount: 12000, deliveryFee: 5 } }] } }));
  await context.route('**/api/cart/delivery-estimate', route => route.fulfill({ json: { subtotal: 12000, deliveryFeeTotal: 5, total: 12005,
    bySeller: { [sellerId]: { fee: 5, source: 'PRODUCT_FEE' } } } }));
  let submitted;
  await context.route('**/api/payments/pawapay/checkouts', route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ status: 400, json: { message: 'Arrêt du test avant prestataire.' } });
  });
  await page.goto(`${path}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Payer.*12\s*005|Confirmer.*12\s*005/ }).last().click();
  await expect.poll(() => submitted).toMatchObject({ amount: 12005, actionContext: { firstPaymentAmount: 12005 } });
});

test('the disabled flag removes the new installment payment option', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('test-flags', JSON.stringify({ enable_installments: false })));
  await page.goto(`${path}?screen=checkout`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cart-loading')).toHaveText('false');
  await expect(page.getByRole('button', { name: /Paiement par tranche/ })).toHaveCount(0);
});

for (const cancelled of [false, true]) {
  test(`installment detail ${cancelled ? 'hides payment after cancellation' : 'sends the exact integer installment'}`, async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    const order = { _id: '777777777777777777777777', status: cancelled ? 'cancelled' : 'installment_active',
      countryId, paymentType: 'installment', paymentSource: 'pawapay', paymentStatus: 'PARTIAL', paymentMode: 'INSTALLMENT',
      installmentSaleStatus: cancelled ? 'cancelled' : '', deliveryMode: 'PICKUP', totalAmount: 10000, paidAmount: 3000, remainingAmount: 7000,
      createdAt: new Date().toISOString(), customer: { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Client test' }, items: [{ product, quantity: 1, snapshot: { title: product.title, price: 10000, shopId: sellerId, shopName: 'Boutique test' } }],
      installmentPlan: { totalAmount: 10000, amountPaid: 3000, remainingAmount: 7000, saleConfirmationConfirmedAt: new Date().toISOString(), schedule: [
        { amount: 3000, status: 'paid', dueDate: '2026-09-21' }, { amount: 2333, status: 'pending', dueDate: '2026-10-21' },
        { amount: 2333, status: 'pending', dueDate: '2026-11-21' }, { amount: 2334, status: 'pending', dueDate: '2026-12-21' }
      ] } };
    await context.route('**/api/orders/detail/*', route => route.fulfill({ json: order }));
    let submitted;
    await context.route('**/api/payments/pawapay/checkouts', route => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 400, json: { message: 'Arrêt du test avant prestataire.' } });
    });
    await page.goto(`${path}?screen=installment-order`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Échéancier et preuves transactionnelles')).toBeVisible();
    const button = page.getByRole('button', { name: 'Payer la tranche avec PawaPay' });
    if (cancelled) await expect(button).toHaveCount(0);
    else {
      await button.click();
      await expect.poll(() => submitted).toMatchObject({ amount: 2333, actionContext: { kind: 'INSTALLMENT_PAYMENT', scheduleIndex: 1, amount: 2333 } });
    }
    expect(errors).toEqual([]);
  });
}
