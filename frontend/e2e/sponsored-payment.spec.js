import { expect, test } from '@playwright/test';
const path = '/e2e/fixtures/conversion.html';
test.setTimeout(60000);
test.beforeEach(async ({ context, page }) => {
  await page.addInitScript(() => localStorage.setItem('test-auth', '1'));
  // Context routes also cover payment popups. No provider or production traffic.
  await context.route('https://**', route => route.abort());
  await context.route('**/api/**', route => route.fulfill({ json: { items: [] } }));
});

for (const kind of ['SPONSORSHIP_ACCEPT', 'SPONSORSHIP_PAY_SELF']) {
  for (const option of ['deposit', 'full']) {
    test(`${kind}: ${option} opens the quoted amount and refreshes after confirmation`, async ({ context, page }) => {
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await page.setViewportSize({ width: 390, height: 844 });
      let completed = false, submitted;
      const self = kind === 'SPONSORSHIP_PAY_SELF';
      const expectedAmount = option === 'deposit' ? 5001 : 21502;
      const group = () => ({ requestGroupId: 'sponsored-group', totalAmount: 21502, depositAmount: 5001,
        orderCount: 2, productTitles: ['Article test'], requester: { name: 'Client test' }, payer: { name: 'Proche test' },
        status: completed ? self ? 'self_paid' : 'accepted' : self ? 'declined' : 'pending',
        paidAmount: completed ? expectedAmount : 0, remainingAmount: completed ? 21502 - expectedAmount : 21502 });
      await context.route('**/api/orders/sponsor/incoming', route => route.fulfill({ json: { requests: self ? [] : [group()] } }));
      await context.route('**/api/orders/sponsor/sent', route => route.fulfill({ json: { requests: self ? [group()] : [] } }));
      await context.route('**/api/payments/pawapay/checkouts', route => {
        submitted = route.request().postDataJSON();
        return route.fulfill({ json: { checkoutId: 'sponsored-test',
          redirectUrl: `http://127.0.0.1:4174${path}?screen=return&checkoutId=sponsored-test` } });
      });
      await context.route('**/api/payments/pawapay/checkouts/sponsored-test', route => {
        completed = true;
        return route.fulfill({ json: { checkoutId: 'sponsored-test', status: 'COMPLETED', paymentState: 'CONFIRMED',
          autoValidationState: 'COMPLETED', actionKind: kind, returnPath: '/sponsorships',
          completionResult: { actionKind: kind, successPath: '/sponsorships' } } });
      });
      await page.goto(`${path}?screen=sponsorships`, { waitUntil: 'domcontentloaded' });
      if (self) await page.getByRole('button', { name: 'Mes demandes' }).click();
      await page.getByRole('button', { name: self ? 'Payer moi-même' : 'Approuver & payer' }).click();
      await expect(page.getByRole('button', { name: /Continuer avec PawaPay/ })).toContainText(/5\s*001/);
      if (option === 'full') await page.getByRole('button', { name: /Paiement intégral/ }).click();
      await page.getByRole('button', { name: /Continuer avec PawaPay/ }).click();
      await expect(page.getByText('Paiement confirmé.', { exact: true })).toBeVisible();
      expect(submitted).toMatchObject({ amount: expectedAmount, purpose: 'CHECKOUT_FUNDING',
        actionContext: { kind, paymentOption: option, groupId: 'sponsored-group' } });
      await expect(page.getByRole('button', { name: /Continuer avec PawaPay/ })).toHaveCount(0);
      if (option === 'deposit') await expect(page.getByText('Acompte confirmé', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(pageErrors).toEqual([]);
    });
  }
}
