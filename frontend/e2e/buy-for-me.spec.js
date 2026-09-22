import { test, expect } from '@playwright/test';
test.setTimeout(60_000);

const id = '111111111111111111111111';
const order = extra => ({ _id: id, status: 'DELIVERED', settlementVersion: 1, payment: { totalPaid: 12000 },
  pickup: { address: 'Magasin test' }, dropoff: { address: 'Adresse test' }, pricing: { shoppingBudget: 10000, deliveryFee: 1000, cashAdvanceFee: 500, serviceCommission: 500 },
  items: [{ _id: '222222222222222222222222', name: 'Riz', quantity: 1, estimatedUnitPrice: 10000, estimatedTotal: 10000, status: 'FOUND' }],
  additionalPayment: { status: 'NONE' }, transfers: [], disputes: [], ...extra });
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ json: { items: [] } }));
  await page.addInitScript(() => { window.open = () => null; });
});
test('blocks stale estimates and submits the refreshed price', async ({ page }) => {
  await page.route('**/api/buy-for-me/capabilities', route => route.fulfill({ json: { enabled: true } }));
  let releaseEstimate, submitted;
  await page.route('**/api/buy-for-me/estimate', async route => {
    const amount = route.request().postDataJSON().items[0].estimatedUnitPrice;
    if (amount === 20000) await new Promise(resolve => { releaseEstimate = resolve; });
    await route.fulfill({ json: { total: amount * 1.05 + 1500, breakdown: [] } });
  });
  await page.route('**/api/payments/pawapay/checkouts', route => {
    submitted = route.request().postDataJSON(); return route.fulfill({ status: 400, json: { message: 'Test uniquement' } });
  });
  await page.goto('/e2e/fixtures/buy-for-me.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Prix par article/ }).click();
  await page.getByLabel('Produit 1', { exact: true }).fill('Riz');
  await page.getByLabel('Prix unitaire estimé (FCFA)', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Choisir la livraison' }).click();
  await page.getByLabel('Adresse de livraison : adresse', { exact: true }).fill('Adresse test');
  await page.getByRole('button', { name: 'Vérifier ma demande' }).click();
  const pay = page.getByRole('button', { name: /Payer et trouver un livreur/ });
  await expect(pay).toBeEnabled();
  await page.getByRole('button', { name: 'Modifier les articles' }).click();
  await page.getByLabel('Prix unitaire estimé (FCFA)', { exact: true }).fill('20000');
  await page.getByRole('button', { name: 'Choisir la livraison' }).click();
  await page.getByRole('button', { name: 'Vérifier ma demande' }).click();
  await expect(pay).toBeDisabled();
  await expect.poll(() => Boolean(releaseEstimate)).toBe(true); releaseEstimate();
  await expect(pay).toBeEnabled(); await pay.click();
  await expect.poll(() => submitted?.amount).toBe(22500);
  expect(submitted.actionContext.items[0].estimatedUnitPrice).toBe(20000);
  expect(submitted.actionContext.balancePreference).toBe('ORIGINAL_PAYMENT');
});
test('shows pending refunds and blocks confirmation while a dispute is open', async ({ page }) => {
  await page.route('**/api/buy-for-me/mine/*', route => route.fulfill({ json: order({ disputeOpen: true,
    refundDue: 2000, transfers: [{ _id: 'refund', type: 'REFUND', amount: 2000, status: 'PROCESSING' }], disputes: [{ _id: 'd', status: 'OPEN', reason: 'Article manquant' }] }) }));
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=detail');
  await expect(page.getByText(/Les achats et le règlement sont suspendus/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmer la bonne réception' })).toHaveCount(0);
  await expect(page.getByText(/En cours · vers le compte Mobile Money ayant payé/)).toBeVisible();
});
test('submits a customer dispute and preserves order details', async ({ page }) => {
  let disputed = false;
  await page.route('**/api/buy-for-me/mine/*', route => route.fulfill({ json: order({ disputeOpen: disputed }) }));
  await page.route('**/api/buy-for-me/mine/*/disputes', route => { disputed = true; return route.fulfill({ json: { _id: 'dispute' } }); });
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=detail');
  await page.getByLabel('Décrivez le problème').fill('Un article est manquant');
  await page.getByRole('button', { name: 'Signaler et suspendre la demande' }).click();
  await expect(page.getByText(/Les achats et le règlement sont suspendus/)).toBeVisible();
  await expect(page.getByText('Liste d’achats')).toBeVisible();
});
test('reads receipt images through the authenticated API', async ({ page }) => {
  await page.route('**/api/buy-for-me/mine/*', route => route.fulfill({ json: order({ receiptId: {
    receiptImageUrl: 'api/buy-for-me/media/333333333333333333333333', storeName: 'Magasin test', amountSpent: 8000
  } }) }));
  await page.route('**/api/buy-for-me/media/*', route => route.fulfill({ contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2kAAAAASUVORK5CYII=', 'base64') }));
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=detail');
  await expect(page.getByAltText('Reçu du magasin')).toHaveAttribute('src', /^blob:/);
});
test('admin can review a dispute and request safe transfer recovery', async ({ page }) => {
  const actions = [];
  await page.route('**/api/buy-for-me/admin/disputes', route => route.fulfill({ json: { items: [{ _id: 'd', status: 'OPEN', reason: 'Article manquant', customerId: { name: 'Client test' }, orderId: { _id: id } }] } }));
  await page.route('**/api/buy-for-me/admin/transfers', route => route.fulfill({ json: { items: [{ _id: 't', orderId: id, type: 'REFUND', amount: 12000, status: 'NEEDS_ATTENTION' }] } }));
  await page.route('**/api/buy-for-me/admin/disputes/d', route => { actions.push(route.request().postDataJSON()); return route.fulfill({ json: {} }); });
  await page.route('**/api/buy-for-me/admin/transfers/t/retry', route => { actions.push('retry'); return route.fulfill({ json: {} }); });
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=admin');
  await page.getByLabel('Décision expliquée au client').fill('Nous examinons le reçu.');
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect.poll(() => actions[0]?.status).toBe('IN_REVIEW');
  await page.getByRole('button', { name: 'Vérifier / relancer' }).click();
  await expect.poll(() => actions.includes('retry')).toBe(true);
});
test('courier notification selects its job and shows payouts', async ({ page }) => {
  await page.route('**/api/buy-for-me/courier/jobs*', route => route.fulfill({ json: { items: new URL(route.request().url()).searchParams.has('orderId') ? [order({ status: 'SHOPPING', claimable: false, disputeOpen: true })] : [] } }));
  await page.route('**/api/buy-for-me/courier/transfers', route => route.fulfill({ json: { items: [{ _id: 't', orderId: id, amount: 9500, status: 'WAITING_ACCOUNT' }], payoutAccount: {} } }));
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=courier');
  await expect(page.getByText('Liste du client')).toBeVisible();
  await expect(page.getByText('Mission suspendue pendant l’examen du litige.')).toBeVisible();
  await expect(page.getByText(/Compte Mobile Money à configurer/)).toBeVisible();
});
test('keeps paid history available when new requests are disabled', async ({ page }) => {
  await page.route('**/api/buy-for-me/mine?*', route => route.fulfill({ json: { items: [order({ preferredStore: 'Magasin test', createdAt: new Date().toISOString() })] } }));
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=history', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Magasin test')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nouvelle demande' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Magasin test/ })).toHaveAttribute('href', `/buy-for-me/${id}`);
});
