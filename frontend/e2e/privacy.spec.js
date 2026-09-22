import { test, expect } from '@playwright/test';

const storageKey = 'hdmarket:privacy-preference:v2';
test.beforeEach(async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ status: route.request().url().includes('/auth/') ? 401 : 200, json: {} }));
});

test('mobile visitor can refuse, customize and withdraw independently', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  const banner = page.getByRole('complementary', { name: 'Votre confidentialité' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Tout refuser' }).click();
  await expect(banner).toHaveCount(0);
  await page.goto('/cookies');
  await expect(page.getByRole('checkbox', { name: /Statistiques d’utilisation/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Diagnostic des erreurs/ })).not.toBeChecked();
  await page.getByRole('checkbox', { name: /Diagnostic des erreurs/ }).check();
  await page.getByRole('button', { name: 'Enregistrer mes choix' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Préférences enregistrées' })).toContainText('Statistiques : refusées · Diagnostic : autorisé');
  const receipt = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(receipt).toMatchObject({ analytics: false, diagnostics: true, version: '2026-09-20' });
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /Diagnostic des erreurs/ })).toBeChecked();
  await page.getByRole('button', { name: 'Tout refuser' }).click();
  await expect(page.getByRole('checkbox', { name: /Diagnostic des erreurs/ })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('heading', { name: 'Gérer mon choix', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('privacy-mobile.png') });
});

test('expired and legacy grants never silently enable tracking', async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem('hdmarket:privacy-preference:v1', 'analytics');
    localStorage.setItem(key, JSON.stringify({ version: '2026-09-20', savedAt: Date.now() - 181 * 86400000, analytics: true, diagnostics: true }));
  }, storageKey);
  await page.goto('/login');
  await expect(page.getByRole('complementary', { name: 'Votre confidentialité' })).toBeVisible();
  await page.goto('/cookies');
  await expect(page.getByRole('checkbox', { name: /Statistiques d’utilisation/ })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Diagnostic des erreurs/ })).not.toBeChecked();
});

test('another open tab observes withdrawal without a reload', async ({ page, context }) => {
  await page.goto('/cookies');
  await page.getByRole('button', { name: 'Tout autoriser' }).click();
  const other = await context.newPage();
  await other.route('https://**', route => route.abort());
  await other.route('**/api/**', route => route.fulfill({ status: route.request().url().includes('/auth/') ? 401 : 200, json: {} }));
  await other.goto('/cookies');
  await expect(other.getByRole('checkbox', { name: /Statistiques d’utilisation/ })).toBeChecked();
  await page.getByRole('button', { name: 'Tout refuser' }).click();
  await expect(other.getByRole('checkbox', { name: /Statistiques d’utilisation/ })).not.toBeChecked();
  await expect(other.getByRole('checkbox', { name: /Diagnostic des erreurs/ })).not.toBeChecked();
  await other.close();
});

test('Congo policies are public, linked, and usable with the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/retours-remboursements');
  await expect(page.getByRole('heading', { name: 'Retours, rétractation et remboursements', exact: true })).toBeVisible();
  await expect(page.getByText(/prévoit 14 jours ouvrables/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Préparer un email au support' })).toHaveAttribute('href', /^mailto:/);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  await page.goto('/confidentialite');
  await expect(page.getByRole('link', { name: 'Suppression de mes données', exact: true })).toHaveAttribute('href', /^mailto:/);
  await page.getByRole('link', { name: 'Accessibilité et aide à la navigation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accessibilité et aide à la navigation');
  await expect(page.getByText(/n’a pas fait l’objet d’un audit complet/)).toBeVisible();
});

test('installed PostHog SDK drops a queued event after withdrawal', async ({ page }) => {
  const sent = [];
  await page.route('**/__privacy_ingest/**', route => {
    if (route.request().method() === 'POST') sent.push(route.request().postData() || '');
    return route.fulfill({ json: { status: 1 } });
  });
  await page.goto('/e2e/fixtures/privacy-transport.html');
  await expect(page.getByText('Transport ready')).toBeVisible();
  await page.evaluate(() => window.privacyTransportTest.queueThenWithdraw());
  await page.waitForTimeout(3500);
  expect(sent).toEqual([]);
  await page.evaluate(() => window.privacyTransportTest.grantAndCapture());
  await expect.poll(() => sent.length).toBe(1);
});
