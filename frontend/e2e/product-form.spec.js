import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/categories/tree')
      ? { tree: [{ level: 0, name: 'Maison', slug: 'maison', children: [{ level: 1, slug: 'meubles', name: 'Meubles' }] }] }
      : path.endsWith('/tags') ? { items: [] } : {};
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
});

for (const mobile of [false, true]) {
  test(`product form preserves values across steps and validates before publishing (${mobile ? 'mobile' : 'desktop'})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 });
    await page.goto(`/e2e/fixtures/product-form.html${mobile ? '?embedded' : ''}`);
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.getByLabel('Titre de l’annonce')).toBeFocused();
    await expect(page.getByRole('alert')).toContainText('4 champs');
    await page.getByLabel('Titre de l’annonce').fill('Commode en bois clair');
    await page.getByLabel('Description détaillée', { exact: true }).fill('Trois tiroirs, bois naturel et poignées en laiton.');
    await page.getByLabel('Catégorie', { exact: true }).selectOption('meubles');
    await page.getByLabel('Prix de vente', { exact: true }).fill('75000');
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.locator('.pf-step-intro h2')).toHaveText('Photos & médias');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Livraison & garantie' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/hdmarket-product-form-sale-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Publier mon annonce' })).toBeVisible();
    await expect(page.locator('.pf-review-details')).toContainText('Commode en bois clair');
    await page.getByRole('navigation', { name: 'Étapes de l’annonce' }).getByRole('button', { name: '01 Produit' }).click();
    await expect(page.getByLabel('Titre de l’annonce')).toHaveValue('Commode en bois clair');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `/tmp/hdmarket-product-form-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true, animations: 'disabled' });
  });
}

test('editing preserves a photo-specific price and only submits at the review step', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  let savedBody = '';
  await page.route('**/api/products/test-product', route => {
    savedBody = route.request().postData() || '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ _id: 'test-product' }) });
  });
  await page.goto('/e2e/fixtures/product-form.html?edit');
  await expect(page.getByLabel('Titre de l’annonce')).toHaveValue('Commode en bois clair');
  await page.getByLabel('Titre de l’annonce').press('Enter');
  expect(savedBody).toBe('');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.locator('.pf-step-intro h2')).toHaveText('Photos & médias');
  await expect(page.locator('.pf-panel:not([hidden]) input[type="number"]').first()).toHaveValue('45000');
  await page.screenshot({ path: '/tmp/hdmarket-product-form-photos.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('navigation').getByRole('button', { name: '03 Vente' }).click();
  await page.getByRole('switch', { name: 'Activer la garantie' }).click();
  // Repeated errors must reopen their step even if the message is unchanged.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('navigation').getByRole('button', { name: '04 Vérification' }).click();
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await expect(page.locator('.pf-step-intro h2')).toHaveText('Options de vente');
    await expect(page.getByText('Indiquez une période de garantie entre 1 et 120.')).toBeVisible();
    expect(savedBody).toBe('');
  }
  await page.getByRole('switch', { name: 'Activer la garantie' }).click();
  await page.getByRole('navigation').getByRole('button', { name: '04 Vérification' }).click();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect.poll(() => savedBody).toContain('optionPrices');
  expect(savedBody).toContain('45000');
  await expect.poll(() => page.evaluate(() => window.formSaved)).toBe(true);
});

test('an older draft opens all steps and a new photo retains its unnamed price', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.addInitScript(() => localStorage.setItem('hdmarket:draft:new:test-seller', JSON.stringify({
    form: { title: 'Miroir rond', description: 'Miroir mural avec éclairage.', price: '75000', category: 'meubles' },
    expandedSections: { info: false, images: false, options: false, commercialisation: false }
  })));
  let savedBody = '';
  await page.route('**/api/products', route => {
    savedBody = route.request().postData() || '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ _id: 'new-product' }) });
  });
  await page.goto('/e2e/fixtures/product-form.html?embedded');
  await page.getByRole('button', { name: 'Reprendre', exact: true }).click();
  await expect(page.getByLabel('Titre de l’annonce')).toHaveValue('Miroir rond');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 600;
    const context = canvas.getContext('2d'); context.fillStyle = '#d8c2a2'; context.fillRect(0, 0, 600, 600);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Ajouter des photos', { exact: true }).setInputFiles({ name: 'mirror.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.getByLabel('Prix de cette option', { exact: true }).fill('42000');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Options & dimensions' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await expect(page.getByLabel('Prix de cette option', { exact: true })).toHaveValue('42000');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('navigation').getByRole('button', { name: '04 Vérification' }).click();
  await page.getByRole('button', { name: 'Publier mon annonce' }).click();
  await expect.poll(() => savedBody).toContain('"photo 1":42000');
  await expect.poll(() => page.evaluate(() => window.formSaved)).toBe(true);
});
