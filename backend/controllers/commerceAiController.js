import asyncHandler from 'express-async-handler';
import { aiActor, aiError } from '../services/commerceAiProvider.js';
import { sellerCoach, shoppingAssistant, complementaryProducts, sellerReply, founderBrief } from '../services/commerceAiService.js';
import { getPlatformFinance } from '../services/platformFinanceService.js';
import PlatformExpense from '../models/platformExpenseModel.js';
import AiBrief from '../models/aiBriefModel.js';
import { getRuntimeConfig } from '../services/configService.js';

export const commerceCapabilities = asyncHandler(async (_req, res) => res.json({ enabled: Boolean(process.env.OPENAI_API_KEY) && await getRuntimeConfig('commerce_ai_enabled') === true }));
export const runCommerceAi = mode => asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const controller = new AbortController();
  const abort = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', abort);
  try {
    const context = { actor: aiActor(req), user: req.user, country: req.countryContext, signal: controller.signal };
    let result;
    if (mode === 'coach') result = await sellerCoach(context);
    if (mode === 'shopping') result = await shoppingAssistant({ ...context, input: req.body?.query });
    if (mode === 'complements') {
      const exclude = req.body?.exclude || [];
      if (!Array.isArray(exclude) || exclude.length > 100) throw aiError('Liste de produits invalide.');
      result = await complementaryProducts({ ...context, productId: req.body?.productId, exclude });
    }
    if (mode === 'reply') {
      if (req.body?.consent !== true) throw aiError('Confirmez l’envoi du texte sélectionné à OpenAI.');
      result = await sellerReply({ ...context, conversationId: req.params.id, question: req.body?.question });
    }
    if (mode === 'founder') result = await founderBrief(context);
    if (!controller.signal.aborted) res.json(result);
  } catch (error) {
    if (!controller.signal.aborted) res.status(error.status || 503).json({ message: error.status ? error.message : 'Le service est indisponible. Réessayez plus tard.' });
  } finally { res.off('close', abort); }
});
export const founderFinance = asyncHandler(async (_req, res) => { res.set('Cache-Control', 'private, no-store'); res.json(await getPlatformFinance()); });
export const recordPlatformExpense = asyncHandler(async (req, res) => {
  const { reference, category, amount, currency, note = '', incurredAt } = req.body || {};
  if (typeof reference !== 'string' || !/^[\w-]{8,100}$/.test(reference) || !['provider_ai', 'payment_fees', 'hosting', 'refund', 'other'].includes(category) || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e10 || !/^[A-Z]{3}$/.test(currency || '') || typeof note !== 'string' || note.length > 300 || !incurredAt || !Number.isFinite(Date.parse(incurredAt)) || Date.parse(incurredAt) > Date.now()) throw aiError('Vérifiez la référence, le montant, la devise et la date.');
  try {
    const expense = await PlatformExpense.create({ reference, category, amount, currency, note, incurredAt, createdBy: req.user.id });
    await AiBrief.deleteOne({ _id: `founder:${new Date().toISOString().slice(0, 10)}` });
    res.status(201).json({ expense });
  } catch (e) { if (e.code === 11000) return res.status(409).json({ message: 'Cette référence de dépense existe déjà.' }); throw e; }
});
