import { test, expect } from '@playwright/test';
test.setTimeout(60_000);
const id = '111111111111111111111111';
const sample = { _id: id, name: 'Courses de la semaine', storeType: 'SUPERMARKET', shoppingBudget: 10000, authorizationMode: 'SHOPPING_BUDGET', items: [{ name: 'Riz', quantity: 2, estimatedUnitPrice: 0 }] };
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/buy-for-me/capabilities', route => route.fulfill({ json: { enabled: true } }));
  await page.addInitScript(() => { window.open = () => null; });
});
test('provides a separate service home and bottom navigation on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=home', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Votre liste/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Préparer mes achats' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Navigation Acheter pour moi' });
  expect((await nav.boundingBox()).y).toBeGreaterThan(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shopping-home-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('shopping-home-desktop.png'), fullPage: true });
  await nav.getByRole('link', { name: 'Mes listes' }).click();
  await expect(page.getByRole('heading', { name: 'Mes listes', exact: true })).toBeVisible();
});
test('saves a reusable list without payment and opens a fresh draft', async ({ page }, testInfo) => {
  let saved;
  await page.route('**/api/buy-for-me/lists', route => {
    if (route.request().method() === 'POST') { saved = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { ...saved, _id: id } }); }
    return route.fulfill({ json: { items: [{ ...saved, _id: id }] } });
  });
  await page.route(`**/api/buy-for-me/lists/${id}`, route => route.fulfill({ json: { ...saved, _id: id } }));
  await page.goto('/e2e/fixtures/buy-for-me.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Choisir la livraison' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Budget d’achats/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Produit 1', { exact: true }).fill('Riz');
  await page.getByLabel('Budget d’achats autorisé', { exact: true }).fill('10000');
  await page.getByText('Enregistrer cette liste pour plus tard', { exact: true }).click();
  await page.getByLabel('Nom de la liste').fill('Mes courses');
  await page.getByRole('button', { name: 'Enregistrer la liste', exact: true }).click();
  await expect(page.getByText('Liste enregistrée dans Mes listes.')).toBeVisible();
  expect(saved.items[0].name).toBe('Riz'); expect(saved).not.toHaveProperty('payment'); expect(saved).not.toHaveProperty('dropoff');
  await page.screenshot({ path: testInfo.outputPath('shopping-form-desktop.png'), fullPage: true });
  await page.getByRole('link', { name: 'Retour à Acheter pour moi' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Mes listes' }).click();
  await page.getByRole('link', { name: /Utiliser cette liste/ }).click();
  await expect(page.getByLabel('Produit 1', { exact: true })).toHaveValue('Riz');
  await expect(page.getByText(/Liste reprise/)).toBeVisible();
  await page.getByRole('button', { name: 'Choisir la livraison' }).click();
  await expect(page.getByLabel('Adresse de livraison : adresse', { exact: true })).toHaveValue('');
});
test('completes the budget flow with a reviewed total and no horizontal overflow', async ({ page }, testInfo) => {
  let paid;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/buy-for-me/estimate', route => route.fulfill({ json: { total: 12000, breakdown: [{ key: 'estimatedShoppingValue', label: 'Budget d’achats', amount: 10000 }, { key: 'deliveryFee', label: 'Livraison', amount: 1000 }, { key: 'serviceCommission', label: 'Frais HDMarket', amount: 500 }, { key: 'cashAdvanceFee', label: 'Frais d’avance', amount: 500 }] } }));
  await page.route('**/api/payments/pawapay/checkouts', route => { paid = route.request().postDataJSON(); return route.fulfill({ status: 400, json: { message: 'Simulation uniquement' } }); });
  await page.goto('/e2e/fixtures/buy-for-me.html', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Produit 1', { exact: true }).fill('Riz');
  await page.getByLabel('Budget d’achats autorisé', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Choisir la livraison' }).click();
  await page.getByLabel('Adresse de livraison : adresse', { exact: true }).fill('Marché de Moungali, portail bleu');
  await page.getByRole('button', { name: 'Vérifier ma demande' }).click();
  await expect(page.getByRole('heading', { name: 'Tout est prêt ?' })).toBeVisible();
  const pay = page.getByRole('button', { name: /Payer et trouver/ });
  await expect(pay).toBeEnabled();
  await expect(pay).toHaveCSS('background-color', 'rgb(232, 93, 0)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shopping-review-mobile.png'), fullPage: true });
  await pay.click(); await expect.poll(() => paid?.amount).toBe(12000);
  expect(paid.actionContext.authorizationMode).toBe('SHOPPING_BUDGET');
  expect(paid.actionContext.balancePreference).toBe('ORIGINAL_PAYMENT');
});
test('reorders from history as an editable request without the old payment or address', async ({ page }) => {
  let checkouts = 0;
  await page.route('**/api/payments/pawapay/checkouts', route => { checkouts++; return route.fulfill({ json: {} }); });
  await page.route(`**/api/buy-for-me/mine/${id}`, route => route.fulfill({ json: { ...sample, status: 'COMPLETED', settlementVersion: 1, payment: { totalPaid: 12000, checkoutId: 'old-paid-checkout' }, dropoff: { address: 'Old private address' } } }));
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=detail', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Commander à nouveau' }).click();
  await expect(page.getByLabel('Produit 1', { exact: true })).toHaveValue('Riz');
  await expect(page.getByLabel('Budget d’achats autorisé', { exact: true })).toHaveValue('10000');
  await page.getByRole('button', { name: 'Choisir la livraison' }).click();
  await expect(page.getByLabel('Adresse de livraison : adresse', { exact: true })).toHaveValue('');
  expect(checkouts).toBe(0);
});
test('keeps the service readable in dark mode at a narrow mobile width', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=home', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Votre liste/ })).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shopping-home-dark-mobile.png'), fullPage: true });
});
test('filters past purchases and keeps network failures distinct from an empty history', async ({ page }) => {
  await page.route('**/api/buy-for-me/mine?*', route => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({ json: { items: [{ ...sample, status: scope === 'history' ? 'COMPLETED' : 'SHOPPING', preferredStore: scope === 'history' ? 'Ancien magasin' : 'Magasin actuel', payment: { totalPaid: 12000 } }], counts: { active: 1, history: 1 }, totalPages: 1 } });
  });
  await page.goto('/e2e/fixtures/buy-for-me.html?screen=history', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Magasin actuel')).toBeVisible();
  await page.getByRole('button', { name: /Historique/ }).click();
  await expect(page.getByText('Ancien magasin')).toBeVisible();
  await page.route('**/api/buy-for-me/mine?*', route => route.fulfill({ status: 503, json: { message: 'Service momentanément indisponible' } }));
  await page.getByRole('button', { name: /En cours/ }).click();
  await expect(page.getByRole('alert')).toContainText('Service momentanément indisponible');
  await expect(page.getByText('Aucun achat en cours.')).toHaveCount(0);
});
