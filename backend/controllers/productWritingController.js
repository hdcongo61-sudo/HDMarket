import { aiActor, meteredAiCall } from '../services/commerceAiProvider.js';
import { generateProductSuggestion, validateProductFacts } from '../services/productWritingService.js';

export async function writeProduct(req, res) {
  let facts;
  try { facts = validateProductFacts(req.body); }
  catch { return res.status(400).json({ message: 'Ajoutez un nom ou des caractéristiques valides, sans dépasser les limites des champs.' }); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', cancel);
  try {
    if (!process.env.OPENAI_API_KEY || process.env.PRODUCT_WRITING_AI_ENABLED !== 'true') throw new Error('NOT_CONFIGURED');
    const suggestion = await meteredAiCall({ actor: aiActor(req), feature: 'writing', model: process.env.PRODUCT_WRITING_AI_MODEL || 'gpt-4.1-mini' }, onUsage => generateProductSuggestion(facts, controller.signal, onUsage));
    return res.json(suggestion);
  } catch (error) {
    if (res.destroyed) return;
    if (error.status === 429) return res.status(429).json({ message: error.message });
    const messages = {
      NOT_CONFIGURED: [503, 'L’assistant IA n’est pas encore activé. Contactez l’administrateur.'],
      PROVIDER_LIMIT: [503, 'L’assistant est temporairement indisponible. Réessayez plus tard.'],
      INVALID_OUTPUT: [502, 'La proposition n’a pas pu être générée. Précisez les caractéristiques puis réessayez.']
    };
    const [status, message] = messages[error.message] || [502, 'L’assistant ne répond pas pour le moment. Réessayez.'];
    return res.status(status).json({ message });
  } finally {
    clearTimeout(timer); res.off('close', cancel);
  }
}
