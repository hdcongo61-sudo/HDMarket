import { test, expect } from '@playwright/test';
const fixture = '/e2e/fixtures/conversion.html';
const orderId = '111111111111111111111111';
const disputeId = '222222222222222222222222';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('test-auth', '1');
    localStorage.setItem('qm_token', 'fixture-token');
  });
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
});
test('a buyer can select an undelivered order and submit the non-receipt reason', async ({ page }) => {
  await page.route('**/api/disputes/eligible-orders', route => route.fulfill({ json: [{ _id: orderId, status: 'out_for_delivery', totalAmount: 3000, allowedDisputeReasons: ['not_received'] }] }));
  let submitted = '';
  await page.route('**/api/disputes', route => { submitted = route.request().postData() || ''; return route.fulfill({ status: 201, json: {} }); });
  await page.goto(`${fixture}?screen=complaints&orderId=${orderId}`);
  await expect(page.locator('select').nth(1)).toHaveValue('not_received');
  await expect(page.locator('select').nth(1).locator('option')).toHaveText(['Non reçu']);
  await page.locator('textarea').fill('Ma commande reste en livraison et je ne l’ai pas reçue.');
  await page.locator('button[type="submit"]').click();
  await expect.poll(() => submitted).toContain('not_received');
  expect(submitted).toContain(orderId);
});
test('evidence downloads use the authenticated endpoint and never the public URL', async ({ page }) => {
  const publicRequests = [];
  page.on('request', request => { if (request.url().includes('/uploads/disputes/')) publicRequests.push(request.url()); });
  await page.route('**/api/disputes/me', route => route.fulfill({ json: [{ _id: disputeId, status: 'OPEN', description: 'Photo du produit', orderId: { _id: orderId }, proofImages: [{ filename: 'receipt.pdf', originalName: 'Reçu.pdf', url: 'uploads/disputes/receipt.pdf' }] }] }));
  let authorization;
  await page.route('**/api/private-attachments/disputes/receipt.pdf', route => {
    authorization = route.request().headers().authorization;
    return route.fulfill({ contentType: 'application/octet-stream', body: 'test document', headers: { 'Cache-Control': 'private, no-store' } });
  });
  await page.goto(`${fixture}?screen=complaints`);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Reçu.pdf' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('Reçu.pdf');
  expect(authorization).toBe('Bearer fixture-token');
  expect(publicRequests).toEqual([]);
});
test('a closed dispute exposes a refund retry without resubmitting the decision', async ({ page }) => {
  await page.route('**/api/disputes/admin**', route => route.fulfill({ json: [{ _id: disputeId, status: 'RESOLVED_CLIENT', adminDecision: 'Retour accepté', resolutionType: 'refund_partial', resolutionAmount: 2000, refundError: 'Échec du remboursement', orderId: { _id: orderId, refundStatus: 'failed' } }] }));
  let retryCount = 0, decisionCount = 0;
  await page.route(`**/api/disputes/admin/${disputeId}/decision`, route => { decisionCount++; return route.fulfill({ json: {} }); });
  await page.route(`**/api/disputes/admin/${disputeId}/retry-refund`, route => { retryCount++; return route.fulfill({ json: { message: 'Remboursement en cours de vérification.', refund: { status: 'PROCESSING' } } }); });
  await page.goto(`${fixture}?screen=admin-complaints`);
  await page.getByRole('button', { name: 'Relancer / vérifier le remboursement' }).click();
  await expect.poll(() => retryCount).toBe(1);
  expect(decisionCount).toBe(0);
});
test('clearing personal location submits empty city and commune fields', async ({ page }) => {
  let fields;
  await page.route('**/api/users/profile', async route => {
    if (route.request().method() !== 'PUT') return route.fulfill({ json: {} });
    fields = route.request().postData();
    return route.fulfill({ json: { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Test Buyer', email: 'test@example.invalid', accountType: 'person', city: '', commune: '' } });
  });
  await page.goto(`${fixture}?screen=profile`);
  await expect(page.locator('select[name="city"]')).toHaveValue('Brazzaville');
  await page.locator('select[name="city"]').selectOption('');
  await page.getByRole('button', { name: 'Sauvegarder les modifications' }).click();
  await expect.poll(() => fields).toBeTruthy();
  for (const name of ['city', 'cityId', 'commune', 'communeId']) expect(fields).toContain(`name="${name}"\r\n\r\n\r\n`);
  await expect(page.locator('select[name="city"]')).toHaveValue('');
});
