import AiSearchOutcome from '../models/aiSearchOutcomeModel.js';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import AiBrief from '../models/aiBriefModel.js';
import { buildCountryDataFilter } from './countryService.js';
import { withVerifiedPublicProductFilter } from '../utils/publicProductVisibility.js';
import { getConversationForUser } from './conversationService.js';
import { getPlatformFinance } from './platformFinanceService.js';
import { aiError, commerceGenerate, objectSchema, textSchema, listSchema } from './commerceAiProvider.js';

const publicFields = 'title description price currency city condition images slug category user deliveryAvailable pickupAvailable';
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const boundedText = (value, max = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw aiError(`Saisissez un texte de 1 à ${max} caractères.`);
  return value.trim();
};
const requireId = value => { if (!mongoose.isValidObjectId(value)) throw aiError('Référence invalide.'); return value; };
export const productCard = p => ({ id: String(p._id), title: p.title, price: p.price, currency: p.currency || 'XAF', city: p.city, condition: p.condition, image: p.images?.[0] || '', url: `/product/${encodeURIComponent(p.slug || p._id)}`, description: String(p.description || '').slice(0, 800), deliveryAvailable: Boolean(p.deliveryAvailable), pickupAvailable: Boolean(p.pickupAvailable) });
const reportSchema = objectSchema({ summary: textSchema, actions: listSchema(objectSchema({ title: textSchema, detail: textSchema, sourceId: textSchema })) });
export function validateReport(result, sources) {
  boundedText(result?.summary, 2000);
  if (!Array.isArray(result.actions) || result.actions.length > 6) throw aiError('Réponse IA invalide.', 502);
  return { summary: result.summary, actions: result.actions.map(a => {
    boundedText(a.title, 150); boundedText(a.detail, 1200);
    const source = sources.find(s => s.id === a.sourceId);
    if (!source) throw aiError('La suggestion ne correspond pas aux données disponibles.', 502);
    return { title: a.title, detail: a.detail, source };
  }) };
}
export async function sellerCoach({ actor, signal }) {
  const cacheId = `coach:${actor}:${new Date().toISOString().slice(0, 10)}`;
  const cached = await AiBrief.findById(cacheId).lean();
  if (cached?.result) return { ...cached.result, cached: true };
  const products = await Product.find({ user: actor, status: { $in: ['approved', 'pending'] } }).select('title slug description images viewsCount salesCount price currency').sort({ viewsCount: -1 }).limit(30).lean();
  if (!products.length) return { summary: 'Publiez votre premier produit pour recevoir des conseils personnalisés.', actions: [] };
  const sources = products.map(p => ({ id: String(p._id), title: p.title, url: `/product/${encodeURIComponent(p.slug || p._id)}/edit` }));
  const data = products.map(p => ({ id: String(p._id), title: p.title, viewsLifetime: p.viewsCount || 0, salesLifetime: p.salesCount || 0, descriptionLength: p.description?.length || 0, photos: p.images?.length || 0 }));
  const result = validateReport(await commerceGenerate({ actor, feature: 'coach', signal, data, schema: reportSchema, instructions: 'Analyse au maximum 30 annonces de ce vendeur. Propose au plus 4 actions concrètes, prioritaires, basées sur les compteurs cumulés et informations manquantes. Les vues ne sont pas des visiteurs uniques; ne calcule pas un taux de conversion ni un gain financier garanti. sourceId doit être un identifiant fourni. Le vendeur doit pouvoir vérifier chaque constat.' }), sources);
  result.generatedAt = new Date();
  await AiBrief.updateOne({ _id: cacheId }, { $set: { result, expiresAt: new Date(Date.now() + 86400000) } }, { upsert: true });
  return result;
}
export function validateShoppingIntent(intent) {
  if (!Array.isArray(intent?.keywords) || intent.keywords.length > 5 || intent.keywords.some(x => typeof x !== 'string' || x.length > 60)) throw aiError('Recherche IA invalide.', 502);
  for (const key of ['minPrice', 'maxPrice']) if (intent[key] !== null && (typeof intent[key] !== 'number' || !Number.isFinite(intent[key]) || intent[key] < 0 || intent[key] > 1e10)) throw aiError('Budget invalide.', 502);
  if (intent.minPrice !== null && intent.maxPrice !== null && intent.minPrice > intent.maxPrice) throw aiError('Budget incohérent.', 502);
  if (!['', 'new', 'used'].includes(intent.condition) || typeof intent.city !== 'string' || intent.city.length > 100 || typeof intent.followUp !== 'string' || intent.followUp.length > 400) throw aiError('Recherche IA invalide.', 502);
  return intent;
}
export async function shoppingAssistant({ actor, input, country, signal }) {
  const text = boundedText(input, 1000);
  const schema = objectSchema({ keywords: listSchema(textSchema), minPrice: { type: ['number', 'null'] }, maxPrice: { type: ['number', 'null'] }, city: textSchema, condition: { type: 'string', enum: ['', 'new', 'used'] }, followUp: textSchema });
  const intent = validateShoppingIntent(await commerceGenerate({ actor, feature: 'shopping', signal, schema, data: { request: text, currency: country?.currency || 'XAF' }, instructions: 'Extrais les critères explicites. keywords: au plus 5 mots de produit essentiels, sans ville/prix/adjectifs vagues. Utilise null pour les budgets absents; aucune conversion de devise. city et condition vides si non indiqués. Si aucun type de produit n’est indiqué ou si la devise demandée diffère, keywords=[] et followUp pose une seule question utile. Sinon followUp peut demander une précision facultative.' }));
  if (!intent.keywords.filter(x => x.trim()).length) return { summary: intent.followUp || 'Quel type de produit recherchez-vous ?', products: [], intent };
  const filters = [buildCountryDataFilter(country), { status: 'approved' }, ...intent.keywords.filter(x => x.trim()).map(word => ({ $or: [{ title: { $regex: escaped(word.trim()), $options: 'i' } }, { description: { $regex: escaped(word.trim()), $options: 'i' } }] }))];
  const price = {};
  if (intent.minPrice !== null) price.$gte = intent.minPrice;
  if (intent.maxPrice !== null) price.$lte = intent.maxPrice;
  if (Object.keys(price).length) filters.push({ price });
  if (intent.city) filters.push({ city: { $regex: `^${escaped(intent.city)}$`, $options: 'i' } });
  if (intent.condition) filters.push({ condition: intent.condition });
  const products = await Product.find(await withVerifiedPublicProductFilter({ $and: filters })).select(publicFields).sort({ price: 1, _id: 1 }).limit(6).lean();
  await AiSearchOutcome.create({ resultCount: products.length, countryId: country.countryId });
  return { summary: products.length ? 'Comparez ces annonces correspondant à vos critères. Confirmez la disponibilité avec le vendeur.' : 'Aucune annonce ne correspond à ces critères. Essayez un autre produit ou élargissez votre budget ou votre ville.', followUp: intent.followUp, products: products.map(productCard), intent };
}
export function selectComplementResults(result, candidates) {
  if (!Array.isArray(result?.items) || result.items.length > 3) throw aiError('Suggestions invalides.', 502);
  const seen = new Set();
  return result.items.flatMap(item => {
    const product = candidates.find(p => String(p._id) === item.id);
    if (!product || seen.has(item.id)) return [];
    seen.add(item.id); boundedText(item.reason, 300);
    return [{ ...productCard(product), reason: item.reason }];
  });
}
export async function complementaryProducts({ actor, productId, exclude = [], country, signal }) {
  requireId(productId);
  const base = await Product.findOne(await withVerifiedPublicProductFilter({ $and: [{ _id: productId, status: 'approved' }, buildCountryDataFilter(country)] })).select(publicFields).lean();
  if (!base) throw aiError('Produit introuvable.', 404);
  const ids = [...new Set([productId, ...exclude])].slice(0, 100).map(requireId);
  const candidates = await Product.find(await withVerifiedPublicProductFilter({ $and: [{ user: base.user, status: 'approved', _id: { $nin: ids }, currency: base.currency || 'XAF' }, buildCountryDataFilter(country)] })).select(publicFields).sort({ salesCount: -1 }).limit(30).lean();
  if (!candidates.length) return { summary: 'Aucun complément disponible dans cette boutique.', products: [] };
  const result = await commerceGenerate({ actor, feature: 'complements', signal, data: { product: productCard(base), candidates: candidates.map(productCard) }, schema: objectSchema({ items: listSchema(objectSchema({ id: textSchema, reason: textSchema })) }), instructions: 'Choisis au plus 3 compléments réellement utiles à ce produit. Évite les substituts. Retourne [] en cas de doute. Ne déclare jamais une compatibilité technique sans preuve explicite dans les descriptions des deux produits. Donne une raison courte et factuelle, sans prix ni remise. Identifiants exclusivement parmi candidates.' });
  return { summary: 'Suggestions de la même boutique. Vérifiez les dimensions et la compatibilité avant achat. Aucune remise automatique.', products: selectComplementResults(result, candidates) };
}
export const redactPersonalText = text => text.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email masqué]').replace(/(?:\+?\d[\s().-]*){7,}/g, '[numéro masqué]');
export async function sellerReply({ actor, user, conversationId, question, signal }) {
  requireId(conversationId);
  const { conversation, access } = await getConversationForUser({ id: conversationId, user, requireMessagePermission: true });
  if (!access.canAccess || !access.isSeller) throw aiError('Réservé au vendeur de cette conversation et à ses assistants autorisés.', 403);
  const input = redactPersonalText(boundedText(question, 1000));
  const [order, product, shop] = await Promise.all([
    conversation.orderId ? Order.findOne({ _id: conversation.orderId, seller: conversation.sellerId }).select('status deliveryMode').lean() : null,
    conversation.productId ? Product.findOne({ _id: conversation.productId, user: conversation.sellerId }).select('title price currency description deliveryAvailable pickupAvailable').lean() : null,
    User.findById(conversation.sellerId).select('shopHours freeDeliveryEnabled freeDeliveryNote').lean()
  ]);
  const result = await commerceGenerate({ actor, feature: 'reply', signal, data: { question: input, order: order ? { status: order.status, deliveryMode: order.deliveryMode } : null, product: product ? { title: product.title, price: product.price, currency: product.currency, description: redactPersonalText(String(product.description || '').slice(0, 1000)), deliveryAvailable: product.deliveryAvailable, pickupAvailable: product.pickupAvailable } : null, shop: shop ? { hours: shop.shopHours, freeDeliveryEnabled: shop.freeDeliveryEnabled } : null }, schema: objectSchema({ reply: textSchema }), instructions: 'Rédige une réponse courtoise de vendeur de moins de 900 caractères. Si un fait manque, propose de le vérifier. Aucun remboursement, délai précis, changement de commande ou paiement hors plateforme promis. Ne révèle aucune information privée. Le texte sera relu avant envoi.' });
  return { reply: boundedText(result?.reply, 900) };
}
export async function founderBrief({ actor, signal }) {
  const id = `founder:${new Date().toISOString().slice(0, 10)}`;
  const cached = await AiBrief.findById(id).lean();
  if (cached?.result) return { ...cached.result, cached: true };
  const finance = await getPlatformFinance();
  const sources = [{ id: 'finance', title: 'Encaissements et coûts enregistrés', url: '/admin/founder-intelligence#finance' }, { id: 'usage', title: 'Consommation IA', url: '/admin/founder-intelligence#finance' }, { id: 'jobs', title: 'Retouches à vérifier', url: '/admin/image-edits' }, { id: 'searches', title: 'Résultats de recherche IA', url: '/admin/founder-intelligence#finance' }];
  const result = validateReport(await commerceGenerate({ actor, feature: 'founder', signal, data: { finance: finance.currencies, usage: finance.usage, jobs: finance.jobsNeedingReview, searches: finance.searches, limitations: finance.limitations, sources }, schema: reportSchema, instructions: 'Rédige un brief fondateur avec au plus 4 actions prioritaires appuyées sur ces seules données. Sépare volume marchand, recettes plateforme, coûts saisis et estimations USD. Pas de bénéfice net ni de conversion monétaire sans données complètes. Ne prétends pas connaître les recherches sans résultat ni les abandons si ces mesures sont absentes. sourceId: finance, usage, jobs ou searches uniquement.' }), sources);
  result.generatedAt = new Date();
  await AiBrief.updateOne({ _id: id }, { $set: { result, expiresAt: new Date(Date.now() + 86400000) } }, { upsert: true });
  return result;
}
