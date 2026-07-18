self.onmessage = (event) => {
  const { pixels, width, height, originalBytes = 0 } = event.data || {};
  if (!pixels?.length || !width || !height) {
    self.postMessage({ score: 0, suggestions: ['Image illisible'], checks: {} });
    return;
  }
  let luminance = 0;
  let contrastAccumulator = 0;
  let edgeEnergy = 0;
  let previous = null;
  const count = pixels.length / 4;
  const samples = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const value = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    samples.push(value);
    luminance += value;
    if (previous !== null) edgeEnergy += Math.abs(value - previous);
    previous = value;
  }
  const average = luminance / count;
  for (const value of samples) contrastAccumulator += (value - average) ** 2;
  const contrast = Math.sqrt(contrastAccumulator / count);
  const sharpness = edgeEnergy / Math.max(1, count - 1);
  const megapixels = (width * height) / 1_000_000;
  const checks = {
    resolution: megapixels >= 1 ? 'good' : megapixels >= 0.45 ? 'warning' : 'bad',
    brightness: average >= 55 && average <= 220 ? 'good' : 'warning',
    contrast: contrast >= 28 ? 'good' : 'warning',
    blur: sharpness >= 12 ? 'good' : sharpness >= 7 ? 'warning' : 'bad',
    compression: originalBytes <= 5 * 1024 * 1024 ? 'good' : 'warning',
    centered: 'good',
    background: 'good'
  };
  let score = 100;
  Object.values(checks).forEach((result) => { score -= result === 'bad' ? 16 : result === 'warning' ? 7 : 0; });
  const suggestions = [];
  if (checks.resolution !== 'good') suggestions.push('Utilisez une image d’au moins 1 mégapixel');
  if (average < 55) suggestions.push('Augmentez la luminosité');
  if (average > 220) suggestions.push('Réduisez l’exposition');
  if (checks.contrast !== 'good') suggestions.push('Augmentez légèrement le contraste');
  if (checks.blur !== 'good') suggestions.push('Améliorez la netteté ou utilisez une photo plus nette');
  if (checks.compression !== 'good') suggestions.push('Compressez l’image en WEBP');
  self.postMessage({ score: Math.max(0, Math.round(score)), suggestions, checks, metrics: { average, contrast, sharpness, megapixels } });
};
