import { test, expect } from '@playwright/test';

test('startup recovers without transition events and keeps a wordmark for a failed logo', async ({ page }) => {
  await page.route('**/splash-test', route => route.fulfill({
    contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>'
  }));
  await page.route('**/missing-brand.png', route => route.abort());
  await page.goto('/splash-test');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite-tailwind4/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite-tailwind4/deps/react-dom_client.js');
    const { default: BootSplash } = await import('/src/components/BootSplash.jsx');
    window.splashDone = 0;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(BootSplash, {
      logoSrc: '/missing-brand.png', minDuration: 600,
      onDone: () => { window.splashDone++; }
    }));
  });
  await page.addStyleTag({ content: '.hdsplash { transition: none !important; }' });
  await expect(page.locator('.hdsplash-wordmark')).toHaveText('HDMarket');
  await expect(page.locator('.hdsplash')).toHaveCount(0);
  expect(await page.evaluate(() => window.splashDone)).toBe(1);
});
