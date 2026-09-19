import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Never hit the real payment backend from browser regression tests.
  await page.route('**/api/**', (route) => route.fulfill({ json: [] }));
});

test('a missing runtime key falls back to the configured rate instead of zero', async ({ page }) => {
  await page.goto('/e2e/fixtures/publication-payment.html?fallback');
  await expect(page.getByTestId('rate')).toHaveText('0.1');
  await expect(page.getByRole('button', { name: /Confirmer et payer avec PawaPay/ })).toContainText('190');
});

test('open payment pages refresh the commission automatically and support zero fees', async ({ page }) => {
  let rate = 3;
  await page.route('**/api/settings/public*', (route) => route.fulfill({ json: { runtime: { commission_rate: rate }, app: { commissionRate: 3 } } }));
  await page.clock.install();
  await page.goto('/e2e/fixtures/publication-payment.html');
  await expect(page.getByTestId('rate')).toHaveText('3');
  await expect(page.getByRole('button', { name: /Confirmer et payer avec PawaPay/ })).toContainText(/5\s*700/);
  rate = 0.1;
  await page.clock.fastForward(31_000);
  await expect(page.getByTestId('rate')).toHaveText('0.1');
  await expect(page.getByRole('button', { name: /Confirmer et payer avec PawaPay/ })).toContainText('190');
  rate = 0;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('rate')).toHaveText('0');
  await expect(page.getByRole('button', { name: /Confirmer et payer avec PawaPay/ })).toHaveCount(0);
  await expect(page.getByText(/Aucun frais de publication à payer/)).toBeVisible();
});

test('verification displays amountPaid consistently even if the legacy amount is zero', async ({ page }) => {
  await page.route('**/api/payments/admin?*', (route) => route.fulfill({ json: [{
    _id: 'confirmed-payment', amount: 0, amountPaid: 190, commissionDueAmount: 190,
    transactionNumber: 'confirmed-checkout', paymentMethod: 'pawapay', status: 'verified',
    product: { _id: 'listing', title: 'Commode', price: 190000 }, user: { name: 'Vendeur' }
  }] }));
  await page.goto('/e2e/fixtures/publication-payment.html?verify&status=verified');
  const paid = page.getByText('Payé', { exact: true }).locator('..');
  await expect(paid).toContainText('190');
});
