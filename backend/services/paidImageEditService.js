import { reserveAiUsage, finishAiUsage, commerceGenerate, objectSchema, textSchema } from './commerceAiProvider.js';
import ImageEditJob from '../models/imageEditJobModel.js';
import PawaPayCheckout from '../models/pawapayCheckoutModel.js';
import { getRuntimeConfig } from './configService.js';
import { isCloudinaryConfigured, uploadToCloudinary, getCloudinaryFolder } from '../utils/cloudinaryUploader.js';

export const IMAGE_EDIT_OPERATIONS = {
  background: 'Changer le fond',
  cleanup: 'Retirer un élément du décor',
  lighting: 'Améliorer la lumière',
  custom: 'Retouche personnalisée',
  marketing: 'Pack marketing : photo, bannières et textes'
};
export async function imageEditPricing(countryId) {
  const enabled = Boolean(process.env.OPENAI_API_KEY) && isCloudinaryConfigured() && await getRuntimeConfig('image_edit_ai_enabled', { countryId }) === true;
  const prices = Object.fromEntries(await Promise.all(Object.keys(IMAGE_EDIT_OPERATIONS).map(async key => [key, Number(await getRuntimeConfig(`image_edit_price_${key}`, { countryId }))])));
  return { enabled, currency: 'XAF', operations: Object.entries(IMAGE_EDIT_OPERATIONS).map(([id, label]) => ({ id, label, amount: prices[id] })) };
}
export function isImageEditPaid(job, checkout) {
  return Boolean(checkout && checkout.checkoutId === job.checkoutId && String(checkout.imageEditJob) === String(job._id) && String(checkout.user) === String(job.user) && checkout.purpose === 'IMAGE_EDIT_FUNDING' && checkout.status === 'COMPLETED' && checkout.paymentState === 'CONFIRMED' && checkout.amount === job.amount && checkout.currency === job.currency);
}
export async function paidCheckoutFor(job) {
  const checkout = job.checkoutId ? await PawaPayCheckout.findOne({ checkoutId: job.checkoutId }).lean() : null;
  return { checkout, paid: isImageEditPaid(job, checkout) };
}
export function validateImageEditInput({ operation, prompt, marketingTitle, marketingFacts }) {
  if (!Object.hasOwn(IMAGE_EDIT_OPERATIONS, operation) || typeof prompt !== 'string' || prompt.trim().length < 5 || prompt.length > 1000) throw new Error('Décrivez la modification souhaitée (5 à 1 000 caractères).');
  const input = { operation, prompt: prompt.trim() };
  if (operation === 'marketing') {
    if (typeof marketingTitle !== 'string' || !marketingTitle.trim() || marketingTitle.length > 200 || typeof marketingFacts !== 'string' || !marketingFacts.trim() || marketingFacts.length > 2000) throw new Error('Ajoutez un titre (200 caractères maximum) et les caractéristiques réelles (2 000 maximum).');
    Object.assign(input, { marketingTitle: marketingTitle.trim(), marketingFacts: marketingFacts.trim() });
  }
  return input;
}

export async function performImageEdit(job) {
  let usage;
  try {
    let resultUrl = job.resultUrl;
    if (!resultUrl) {
    usage = await reserveAiUsage({ actor: String(job.user), feature: 'photo', model: process.env.PRODUCT_IMAGE_AI_MODEL || 'gpt-image-2.5-sunburst', image: true });
    const original = await fetch(job.sourceUrl, { signal: AbortSignal.timeout(30000) });
    if (!original.ok) throw new Error('SOURCE_UNAVAILABLE');
    const blob = await original.blob();
    if (blob.size > 10 * 1024 * 1024) throw new Error('SOURCE_TOO_LARGE');
    const body = new FormData();
    body.append('model', process.env.PRODUCT_IMAGE_AI_MODEL || 'gpt-image-2.5-sunburst');
    body.append('image[]', blob, 'product.png');
    body.append('prompt', `Retouche une photo de produit pour une annonce. Préserve fidèlement le produit, ses couleurs, logos, dimensions et défauts. Ne crée pas de caractéristiques trompeuses ni de texte publicitaire. Opération : ${IMAGE_EDIT_OPERATIONS[job.operation]}. Demande du vendeur : ${job.prompt}`);
    body.append('n', '1'); body.append('size', '1024x1024'); body.append('quality', 'medium'); body.append('output_format', 'png');
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body, signal: AbortSignal.timeout(180000)
    });
    if (!response.ok) throw new Error('PROVIDER_FAILED');
    const result = await response.json();
    await finishAiUsage(usage, result.usage);
    usage = null;
    const encoded = result.data?.[0]?.b64_json;
    if (!encoded) throw new Error('NO_RESULT');
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new Error('INVALID_RESULT');
    const uploaded = await uploadToCloudinary({ buffer, resourceType: 'image', folder: getCloudinaryFolder(['image-studio', String(job.user)]), options: { public_id: `paid-edit-${job._id}-${job.runToken}`, overwrite: true } });
    resultUrl = uploaded.secure_url;
    const checkpoint = await ImageEditJob.updateOne({ _id: job._id, state: 'PROCESSING', runToken: job.runToken }, { $set: { resultUrl } });
    if (checkpoint.matchedCount === 0) return;
    }
    let marketingCopy;
    if (job.operation === 'marketing') {
      marketingCopy = await commerceGenerate({ actor: String(job.user), feature: 'marketing', paid: true, data: { title: job.marketingTitle, facts: job.marketingFacts }, schema: objectSchema({ headline: textSchema, whatsapp: textSchema, facebook: textSchema }), instructions: 'Prépare un pack marketing : headline de 80 caractères maximum, whatsapp de 500 maximum, facebook de 800 maximum. Utilise uniquement les caractéristiques fournies. Pas de faux prix, promotions, urgence, coordonnées ni hashtags trompeurs.' });
      for (const [key, max] of Object.entries({ headline: 80, whatsapp: 500, facebook: 800 })) if (typeof marketingCopy[key] !== 'string' || !marketingCopy[key].trim() || marketingCopy[key].length > max) throw new Error('INVALID_COPY');
    }
    await ImageEditJob.updateOne({ _id: job._id, state: 'PROCESSING', runToken: job.runToken }, { $set: { state: 'COMPLETED', resultUrl, ...(marketingCopy ? { marketingCopy } : {}), error: '' } });
  } catch {
    if (usage) await finishAiUsage(usage, null, 'failed').catch(() => {});
    await ImageEditJob.updateOne({ _id: job._id, state: 'PROCESSING', runToken: job.runToken }, { $set: { state: 'FAILED', error: 'La retouche n’a pas abouti. Réessayez sans repayer, ou contactez le support avec la référence.' } });
  }
}
