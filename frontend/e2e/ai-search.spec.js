import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/ai/capabilities')) return route.fulfill({ json: { image: true, voice: true } });
    if (path.endsWith('/ai/voice')) return route.fulfill({ json: { query: 'téléphone', label: 'Téléphone d’occasion', minPrice: null, maxPrice: 50000, condition: 'used' } });
    if (path.endsWith('/ai/image')) return route.fulfill({ json: { query: 'sac', label: 'Un sac', minPrice: null, maxPrice: null, condition: '' } });
    if (path.endsWith('/by-color')) return route.fulfill({ json: { results: [], hasMore: false } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/e2e/fixtures/ai-search.html');
});
test('voice intent is reviewed and preserves the budget when searching', async ({ page }) => {
  await page.getByRole('button', { name: 'Recherche vocale', exact: true }).click();
  await page.getByRole('textbox', { name: 'Votre recherche' }).fill('Je cherche un téléphone occasion à moins de 50000');
  await page.getByRole('button', { name: 'Comprendre ma demande avec l’IA' }).click();
  await expect(page.getByLabel('Recherche finale')).toBeEmpty();
  await page.getByRole('button', { name: 'Utiliser cette proposition' }).click();
  await page.getByRole('button', { name: 'Rechercher les produits' }).click();
  await expect(page.getByLabel('Recherche finale')).toContainText('maxPrice=50000&condition=used');
});
test('a provider failure leaves ordinary voice search usable', async ({ page }) => {
  await page.route('**/api/search/ai/voice', route => route.fulfill({ status: 503, json: { message: 'IA indisponible' } }));
  await page.getByRole('button', { name: 'Recherche vocale', exact: true }).click();
  await page.getByRole('textbox', { name: 'Votre recherche' }).fill('chaussures');
  await page.getByRole('button', { name: 'Comprendre ma demande avec l’IA' }).click();
  await expect(page.getByRole('alert')).toContainText('IA indisponible');
  await page.getByRole('button', { name: 'Rechercher les produits' }).click();
  await expect(page.getByLabel('Recherche finale')).toHaveText('/search?q=chaussures');
});
test('image recognition requires a click and applies a reviewed keyword to catalogue search', async ({ page }) => {
  let recognitionRequests = 0;
  let searchedKeyword = '';
  page.on('request', req => {
    if (req.url().includes('/ai/image')) recognitionRequests += 1;
    if (req.url().includes('/by-color')) searchedKeyword = req.postDataJSON().query;
  });
  const encoded = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; canvas.getContext('2d').fillRect(0, 0, 64, 64); return canvas.toDataURL('image/jpeg').split(',')[1]; });
  await page.getByRole('button', { name: 'Ouvrir photo' }).click();
  await page.locator('input[type=file]').last().setInputFiles({ name: 'sac.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(encoded, 'base64') });
  const identify = page.getByRole('button', { name: 'Identifier cet article avec l’IA' });
  await expect(identify).toBeEnabled(); expect(recognitionRequests).toBe(0);
  await identify.click();
  await page.getByRole('button', { name: 'Utiliser ce mot-clé, puis appliquer les filtres' }).click();
  await expect(page.getByRole('textbox', { name: 'Préciser le produit' })).toHaveValue('sac');
  await page.getByRole('button', { name: 'Appliquer le cadrage et les filtres' }).click();
  await expect.poll(() => searchedKeyword).toBe('sac'); expect(recognitionRequests).toBe(1);
});

test('recorded audio is sent only after confirmation and fills an editable query', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/search/ai/transcribe', route => { requests += 1; return route.fulfill({ json: { text: 'sac noir' } }); });
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
    window.MediaRecorder = class {
      static isTypeSupported() { return true; }
      state = 'inactive';
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['fake audio'], { type: 'audio/webm' }) }); this.onstop(); }
    };
  });
  await page.getByRole('button', { name: 'Recherche vocale', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer pour l’IA' }).click();
  await page.getByRole('button', { name: 'Arrêter l’enregistrement IA' }).click();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Envoyer et transcrire' }).click();
  await expect(page.getByRole('textbox', { name: 'Votre recherche' })).toHaveValue('sac noir');
  await expect(page.getByLabel('Recherche finale')).toBeEmpty(); expect(requests).toBe(1);
});
