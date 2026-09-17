import { aiActor, meteredAiCall } from '../services/commerceAiProvider.js';
import { interpretSearch, searchAiCapabilities, transcribeSearch, validateSearchImage, validateVoiceText } from '../services/searchAiService.js';
import asyncHandler from 'express-async-handler';
export const getSearchAiCapabilities = asyncHandler(async (req, res) => {
  if (req.countryContextError) throw req.countryContextError;
  res.json(await searchAiCapabilities(req.countryContext?.countryId));
});
export const runSearchAi = mode => asyncHandler(async (req, res) => {
  if (req.countryContextError) throw req.countryContextError;
  const capabilities = await searchAiCapabilities(req.countryContext?.countryId);
  if (!capabilities[mode === 'image' ? 'image' : 'voice']) return res.status(503).json({ message: 'La recherche IA n’est pas disponible. Utilisez la recherche classique.' });
  let input;
  try {
    if (mode === 'image') input = { image: validateSearchImage(req.body?.image) };
    else if (mode === 'voice') input = { text: validateVoiceText(req.body?.text) };
    else if (!req.file || !['audio/webm', 'video/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav'].includes(req.file.mimetype) || !req.file.size) throw new Error('INVALID_INPUT');
  } catch { return res.status(400).json({ message: 'Image, audio ou texte de recherche invalide.' }); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', cancel);
  try {
    const result = await meteredAiCall({ actor: aiActor(req), feature: `search_${mode}`, model: mode === 'audio' ? process.env.SEARCH_TRANSCRIPTION_MODEL || 'gpt-transcribe' : process.env.SEARCH_AI_MODEL || 'gpt-4.1-mini' }, async onUsage => mode === 'audio' ? { text: await transcribeSearch(req.file, controller.signal, onUsage) } : await interpretSearch(input, controller.signal, onUsage));
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (error.status === 429 && !res.destroyed) return res.status(429).json({ message: error.message });
    if (!res.destroyed) res.status(503).json({ message: 'L’IA est temporairement indisponible. Vous pouvez continuer avec la recherche classique.' });
  } finally { clearTimeout(timer); res.off('close', cancel); }
});
