import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Deterministic offline API: never submit orders or contact production.
  await page.route('**/api/**', route => route.fulfill({
    status: route.request().url().includes('/auth/') ? 401 : 200,
    contentType: 'application/json', body: '{}'
  }));
});
test('login remains usable without the API', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]').first()).toBeEnabled();
});
test('guests cannot open founder tools', async ({ page }) => {
  await page.goto('/admin/founder-tools');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Mes outils & ma routine' })).toHaveCount(0);
});

test('guests can open the cart without a login redirect', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /Mon panier/ })).toBeVisible();
  await expect(page).toHaveURL(/\/cart$/);
});

test('a cached long launch animation does not block a direct link', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hd_boot_splash_pref', JSON.stringify({ desktop: { enabled: true, durationMs: 60000 }, mobile: { enabled: true, durationMs: 60000 } })));
  await page.goto('/login');
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('.hdsplash')).toHaveCount(0);
});
