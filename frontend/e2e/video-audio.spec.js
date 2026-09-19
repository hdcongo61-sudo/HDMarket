import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/products')
      ? [{ _id: 'test-product', title: 'Commode', price: 75000 }]
      : path.endsWith('/tags') ? { items: [] } : {};
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
});

// Generate a real, short video with an audio track; no external media needed.
async function createVideo(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 160; canvas.height = 120;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = 'red'; drawing.fillRect(0, 0, 160, 120);
    const context = new AudioContext();
    await context.resume();
    const destination = context.createMediaStreamDestination();
    const tone = context.createOscillator();
    tone.connect(destination); tone.start();
    const stream = canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    await new Promise(resolve => {
      recorder.onstop = resolve; recorder.start();
      const draw = setInterval(() => drawing.fillRect(0, 0, 160, 120), 33);
      setTimeout(() => { clearInterval(draw); recorder.stop(); }, 1200);
    });
    tone.stop(); stream.getTracks().forEach(track => track.stop()); await context.close();
    return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer()));
  });
}

test('mute produces a playable file with no audio and supports cancellation', async ({ page }) => {
  await page.route('**/audio-editor-test', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Mute test</body></html>' }));
  await page.goto('/audio-editor-test');
  const bytes = await createVideo(page);
  const result = await page.evaluate(async bytes => {
    const { muteVideo } = await import('/src/services/videoAudioEditor.js');
    const file = new File([new Uint8Array(bytes)], 'original.mp4', { type: 'video/mp4' });
    const output = await muteVideo(file);
    async function inspect(file) {
      const video = document.createElement('video');
      video.muted = true;
      const url = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve; video.onerror = reject; video.src = url;
      });
      await video.play();
      const capture = video.captureStream();
      const result = { width: video.videoWidth, audioTracks: capture.getAudioTracks().length, size: file.size };
      video.pause(); capture.getTracks().forEach(track => track.stop()); URL.revokeObjectURL(url);
      return result;
    }
    const original = await inspect(file), muted = await inspect(output);
    const controller = new AbortController(); controller.abort();
    let cancelled = false;
    try { await muteVideo(file, { signal: controller.signal }); } catch (error) { cancelled = error.name === 'AbortError'; }
    const activeController = new AbortController();
    let cancelledDuringRender = false;
    try {
      await muteVideo(file, { signal: activeController.signal, onProgress: () => activeController.abort() });
    } catch (error) { cancelledDuringRender = error.name === 'AbortError'; }
    return { original, muted, cancelled, cancelledDuringRender };
  }, bytes);
  expect(result.original.audioTracks).toBe(1);
  expect(result.muted.audioTracks).toBe(0);
  expect(result.muted.width).toBe(160);
  expect(result.muted.size).toBeGreaterThan(100);
  expect(result.cancelled).toBe(true);
  expect(result.cancelledDuringRender).toBe(true);
});

test('seller videos offer only mute and apply the silent file', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/e2e/fixtures/product-form.html?videos');
  const bytes = await createVideo(page);
  await page.getByRole('combobox').selectOption('test-product');
  await page.locator('input[type="file"]').setInputFiles({ name: 'original.mp4', mimeType: 'video/mp4', buffer: Buffer.from(bytes) });
  await page.getByText('Couper le son', { exact: true }).click();
  await expect(page.locator('input[accept="audio/*"]')).toHaveCount(0);
  await expect(page.getByRole('combobox')).toHaveCount(1); // Product selector only.
  await expect(page.getByText('Vos 4 sons les plus utilisés')).toHaveCount(0);
  await page.getByRole('button', { name: 'Préparer la vidéo sans son' }).click();
  await expect(page.getByRole('button', { name: 'Appliquer la vidéo sans son' })).toBeVisible();
  await expect(page.locator('details video')).toHaveJSProperty('videoWidth', 160);
  await page.getByRole('button', { name: 'Appliquer la vidéo sans son' }).click();
  await expect(page.getByText('original-sans-son.webm', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Appliquer la vidéo sans son' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('product form retains only the mute toggle and sends the mute choice', async ({ page }) => {
  let body = '';
  await page.route('**/api/products/test-product', route => {
    body = route.request().postData() || '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ _id: 'test-product' }) });
  });
  await page.goto('/e2e/fixtures/product-form.html?edit');
  const bytes = await createVideo(page);
  await page.getByRole('navigation').getByRole('button', { name: '02 Photos' }).click();
  await page.locator('#product-form-video-input').setInputFiles({ name: 'original.mp4', mimeType: 'video/mp4', buffer: Buffer.from(bytes) });
  await expect(page.locator('input[accept="audio/*"]')).toHaveCount(0);
  await expect(page.getByText('Modifier le son', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Préparer la vidéo sans son' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Couper le son', exact: true }).click();
  await expect(page.locator('video').first()).toHaveJSProperty('muted', true);
  await page.getByRole('button', { name: 'Activer le son', exact: true }).click();
  await expect(page.locator('video').first()).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: 'Couper le son', exact: true }).click();
  await page.getByRole('navigation').getByRole('button', { name: '04 Vérification' }).click();
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect.poll(() => page.evaluate(() => window.formSaved)).toBe(true);
  expect(body).toMatch(/name="videoMuted"\r\n\r\ntrue/);
});
