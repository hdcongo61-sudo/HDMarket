import asyncHandler from 'express-async-handler';
import { ensureDefaultCountry } from '../services/countryService.js';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import QuotationRequest from '../models/quotationRequestModel.js';
import QuotationItem from '../models/quotationItemModel.js';
import { createNotification } from '../utils/notificationService.js';
import {
  QUOTATION_ACTIVE_STATUSES,
  QUOTATION_SELLER_RESPONSE_STATUSES,
  QUOTATION_VALIDITY_HOURS,
  quotationCanCreateOrder
} from '../utils/quotationRules.js';
import {
  buildSelectedAttributesSelectionKey,
  resolveSelectedAttributesImage,
  resolveSelectedAttributesPrice,
  validateSelectedAttributesForProduct
} from '../utils/productAttributes.js';

const objectId = (value) => String(value?._id || value || '');
const money = (value) => Math.round(Math.max(0, Number(value || 0)) * 100) / 100;
const cleanText = (value, max = 2000) => String(value || '').trim().slice(0, max);
const isAdmin = (user) => ['admin', 'manager', 'founder'].includes(String(user?.role || '').toLowerCase());

const parseDate = (value, { future = false } = {}) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (future && date.getTime() <= Date.now()) return null;
  return date;
};

const hydrateQuotation = async (quotationOrId) => {
  const id = objectId(quotationOrId);
  const quotation = await QuotationRequest.findById(id)
    .populate('buyer', 'name email phone profileImage city')
    .populate('seller', 'name shopName shopLogo shopSlug slug phone city')
    .populate('order', '_id status totalAmount paymentStatus')
    .lean();
  if (!quotation) return null;
  const items = await QuotationItem.find({ quotation: quotation._id })
    .populate('product', 'title slug images price quotationEnabled status user')
    .sort({ createdAt: 1 })
    .lean();
  return { ...quotation, items };
};

const notify = ({ quotation, recipientId, actorId, type, title, message, deepLink }) =>
  createNotification({
    userId: recipientId,
    actorId,
    type,
    title,
    message,
    deepLink,
    actionLink: deepLink,
    actionLabel: 'Ouvrir le devis',
    entityType: 'quotation',
    entityId: objectId(quotation),
    metadata: { quotationId: objectId(quotation), deepLink },
    priority: 'HIGH',
    allowSelf: false
  }).catch(() => null);

export const expireDueQuotations = async () => {
  const due = await QuotationRequest.find({
    status: { $in: QUOTATION_ACTIVE_STATUSES },
    responseUpdating: { $ne: true },
    expirationDate: { $ne: null, $lte: new Date() }
  }).select('_id buyer seller expiredNotifiedAt').limit(250);
  if (!due.length) return 0;
  const ids = due.map((entry) => entry._id);
  await QuotationRequest.updateMany(
    { _id: { $in: ids }, status: { $in: QUOTATION_ACTIVE_STATUSES }, responseUpdating: { $ne: true } },
    { $set: { status: 'EXPIRED' } }
  );
  await Promise.all(due.filter((entry) => !entry.expiredNotifiedAt).map(async (entry) => {
    await notify({
      quotation: entry,
      recipientId: entry.buyer,
      actorId: entry.seller,
      type: 'quotation_expired',
      title: 'Devis expiré',
      message: 'Ce devis ne peut plus être utilisé pour commander.',
      deepLink: '/my-quotations'
    });
    await QuotationRequest.updateOne({ _id: entry._id }, { $set: { expiredNotifiedAt: new Date() } });
  }));
  return due.length;
};

const normalizeRequestedItems = (body = {}) => {
  const raw = Array.isArray(body.items) && body.items.length
    ? body.items
    : body.productId
      ? [{ productId: body.productId, quantity: body.quantity, requestedPrice: body.requestedPrice }]
      : [];
  const merged = new Map();
  raw.forEach((entry) => {
    const productId = objectId(entry?.productId || entry?.product);
    if (!mongoose.Types.ObjectId.isValid(productId)) return;
    const selectedAttributes = Array.isArray(entry?.selectedAttributes)
      ? entry.selectedAttributes.slice(0, 20).map((attribute) => ({
          name: cleanText(attribute?.name, 80),
          value: cleanText(attribute?.value, 160)
        })).filter((attribute) => attribute.name && attribute.value)
      : [];
    const selectionKey = buildSelectedAttributesSelectionKey(selectedAttributes);
    const quantity = Math.min(9999, Math.max(1, Math.trunc(Number(entry?.quantity || 1))));
    const requestedPriceRaw = entry?.requestedPrice;
    const requestedPrice = requestedPriceRaw === '' || requestedPriceRaw == null
      ? null
      : money(requestedPriceRaw);
    const lineKey = `${productId}:${selectionKey}`;
    const existing = merged.get(lineKey);
    merged.set(lineKey, existing
      ? { ...existing, quantity: Math.min(9999, existing.quantity + quantity) }
      : { productId, quantity, requestedPrice, selectedAttributes, selectionKey });
  });
  return Array.from(merged.values()).slice(0, 30);
};

export const createQuotation = asyncHandler(async (req, res) => {
  const requestedItems = normalizeRequestedItems(req.body);
  if (!requestedItems.length) return res.status(400).json({ message: 'Ajoutez au moins un produit au devis.' });
  if (requestedItems.some((entry) => entry.requestedPrice != null && !(entry.requestedPrice > 0))) {
    return res.status(400).json({ message: 'Le prix unitaire souhaité doit être supérieur à zéro.' });
  }
  const deliveryCity = cleanText(req.body?.deliveryCity, 120);
  if (!deliveryCity) return res.status(400).json({ message: 'La ville de livraison est requise.' });
  const expectedDeliveryDate = req.body?.expectedDeliveryDate
    ? parseDate(req.body.expectedDeliveryDate, { future: true })
    : null;
  if (req.body?.expectedDeliveryDate && !expectedDeliveryDate) {
    return res.status(400).json({ message: 'La date de livraison souhaitée doit être future.' });
  }

  const products = await Product.find({ _id: { $in: requestedItems.map((entry) => entry.productId) } })
    .select('title slug images price currency countryId user quotationEnabled status attributes')
    .lean();
  const uniqueRequestedProductIds = new Set(requestedItems.map((entry) => entry.productId));
  if (products.length !== uniqueRequestedProductIds.size) return res.status(404).json({ message: 'Un produit du devis est introuvable.' });
  if (products.some((product) => product.status !== 'approved')) {
    return res.status(400).json({ message: 'Tous les produits doivent être disponibles à la vente.' });
  }
  if (products.some((product) => product.quotationEnabled === false)) {
    return res.status(400).json({ message: 'Un produit ne permet pas les demandes de devis.' });
  }
  const sellerIds = new Set(products.map((product) => objectId(product.user)));
  if (sellerIds.size !== 1) return res.status(400).json({ message: 'Un devis groupé doit concerner une seule boutique.' });
  const sellerId = Array.from(sellerIds)[0];
  if (sellerId === objectId(req.user.id)) return res.status(400).json({ message: 'Vous ne pouvez pas demander un devis à votre propre boutique.' });
  const fallbackCountry = await ensureDefaultCountry();
  const countryIds = new Set(products.map((product) => objectId(product.countryId || fallbackCountry._id)));
  const currencies = new Set(products.map((product) => cleanText(product.currency || fallbackCountry.currency.code, 8).toUpperCase()));
  if (countryIds.size !== 1) return res.status(409).json({ message: 'Un devis ne peut pas mélanger plusieurs pays.', code: 'CROSS_BORDER_NOT_SUPPORTED' });
  if (currencies.size !== 1) return res.status(409).json({ message: 'Un devis ne peut pas mélanger plusieurs devises.', code: 'CURRENCY_NOT_SUPPORTED' });
  const quotationCountryId = Array.from(countryIds)[0];
  const quotationCurrency = Array.from(currencies)[0];

  const byId = new Map(products.map((product) => [objectId(product._id), product]));
  const items = requestedItems.map((entry) => {
    const product = byId.get(entry.productId);
    const selection = validateSelectedAttributesForProduct({
      productAttributes: product.attributes,
      selectedAttributes: entry.selectedAttributes
    });
    if (!selection.valid) {
      throw Object.assign(new Error(selection.message), { statusCode: 400 });
    }
    const resolvedPrice = resolveSelectedAttributesPrice({
      productAttributes: product.attributes,
      selectedAttributes: selection.selectedAttributes,
      basePrice: product.price
    });
    const resolvedImage = resolveSelectedAttributesImage({
      productAttributes: product.attributes,
      selectedAttributes: selection.selectedAttributes,
      images: product.images
    });
    return {
      product: product._id,
      selectedAttributes: selection.selectedAttributes,
      selectionKey: selection.selectionKey,
      quantity: entry.quantity,
      originalPrice: money(resolvedPrice.unitPrice),
      currency: quotationCurrency,
      requestedPrice: entry.requestedPrice,
      quotedPrice: null,
      snapshot: { title: product.title, image: resolvedImage.image || product.images?.[0] || '', slug: product.slug || '' }
    };
  });
  const originalSubtotal = money(items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0));
  const requestedPrice = items.length === 1 ? items[0].requestedPrice : null;
  const quotation = await QuotationRequest.create({
    buyer: req.user.id,
    seller: sellerId,
    countryId: quotationCountryId,
    status: 'PENDING',
    message: cleanText(req.body?.message),
    deliveryCity,
    expectedDeliveryDate,
    requestedPrice,
    currency: quotationCurrency,
    itemCount: items.length,
    originalSubtotal,
    quotedSubtotal: 0
  });
  try {
    await QuotationItem.insertMany(items.map((item) => ({ ...item, quotation: quotation._id })));
  } catch (error) {
    await QuotationRequest.deleteOne({ _id: quotation._id });
    throw error;
  }
  await notify({
    quotation,
    recipientId: sellerId,
    actorId: req.user.id,
    type: 'quotation_request_received',
    title: 'Nouvelle demande de devis',
    message: `${items.length} produit${items.length > 1 ? 's' : ''} à négocier.`,
    deepLink: `/seller/quotations/${quotation._id}`
  });
  res.status(201).json(await hydrateQuotation(quotation._id));
});

export const listBuyerQuotations = asyncHandler(async (req, res) => {
  await expireDueQuotations();
  const status = cleanText(req.query?.status, 30).toUpperCase();
  const filter = { buyer: req.user.id };
  if (status && status !== 'ALL') filter.status = status;
  const rows = await QuotationRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ items: await Promise.all(rows.map((row) => hydrateQuotation(row._id))) });
});

export const listSellerQuotations = asyncHandler(async (req, res) => {
  await expireDueQuotations();
  const status = cleanText(req.query?.status, 30).toUpperCase();
  const filter = { seller: req.user.id };
  if (status && status !== 'ALL') {
    filter.status = status === 'PENDING' ? { $in: ['PENDING', 'COUNTERED'] } : status;
  }
  const rows = await QuotationRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ items: await Promise.all(rows.map((row) => hydrateQuotation(row._id))) });
});

export const getQuotation = asyncHandler(async (req, res) => {
  await expireDueQuotations();
  const quotation = await hydrateQuotation(req.params.id);
  if (!quotation) return res.status(404).json({ message: 'Devis introuvable.' });
  const allowed = isAdmin(req.user) || [objectId(quotation.buyer), objectId(quotation.seller)].includes(objectId(req.user.id));
  if (!allowed) return res.status(403).json({ message: 'Ce devis ne vous appartient pas.' });
  res.json(quotation);
});

const resolveValidity = (body = {}) => {
  const custom = body.expirationDate ? parseDate(body.expirationDate, { future: true }) : null;
  if (body.expirationDate) return custom ? { date: custom, hours: Math.max(1, Math.ceil((custom - Date.now()) / 3600000)) } : null;
  const hours = Number(body.validityHours || 48);
  if (!QUOTATION_VALIDITY_HOURS.has(hours)) return null;
  return { date: new Date(Date.now() + hours * 3600000), hours };
};

export const sellerRespondQuotation = asyncHandler(async (req, res) => {
  const action = cleanText(req.body?.action, 30).toUpperCase();
  if (!['ACCEPT', 'REJECT', 'COUNTER'].includes(action)) return res.status(400).json({ message: 'Action de devis invalide.' });
  const current = await QuotationRequest.findOne({
    _id: req.params.id,
    seller: req.user.id,
    status: { $in: QUOTATION_SELLER_RESPONSE_STATUSES },
    responseUpdating: { $ne: true }
  });
  if (!current) return res.status(409).json({ message: 'Ce devis a déjà été traité ou a expiré.' });
  if (current.expirationDate && current.expirationDate <= new Date()) {
    current.status = 'EXPIRED';
    await current.save();
    return res.status(409).json({ message: 'Ce devis est expiré.' });
  }
  const items = await QuotationItem.find({ quotation: current._id });
  if (!items.length) return res.status(409).json({ message: 'Le devis ne contient aucun produit.' });

  if (action === 'REJECT') {
    const updated = await QuotationRequest.findOneAndUpdate(
      { _id: current._id, seller: req.user.id, status: current.status },
      { $set: { status: 'REJECTED', sellerMessage: cleanText(req.body?.message), rejectedAt: new Date(), respondedAt: new Date() } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: 'Le devis a été modifié. Actualisez la page.' });
    await notify({ quotation: updated, recipientId: updated.buyer, actorId: req.user.id, type: 'quotation_rejected', title: 'Devis refusé', message: updated.sellerMessage || 'Le vendeur ne peut pas donner suite.', deepLink: '/my-quotations' });
    return res.json(await hydrateQuotation(updated._id));
  }

  const validity = resolveValidity(req.body);
  if (!validity) return res.status(400).json({ message: 'Choisissez une durée de validité correcte.' });
  const estimatedDeliveryDate = req.body?.estimatedDeliveryDate
    ? parseDate(req.body.estimatedDeliveryDate, { future: true })
    : null;
  if (req.body?.estimatedDeliveryDate && !estimatedDeliveryDate) {
    return res.status(400).json({ message: 'La date de livraison estimée doit être future.' });
  }
  const proposals = new Map((Array.isArray(req.body?.items) ? req.body.items : []).map((entry) => [
    objectId(entry.itemId || entry.quotationItemId) || `${objectId(entry.productId || entry.product)}:${cleanText(entry.selectionKey, 500)}`,
    money(entry.unitPrice)
  ]));
  if ((Array.isArray(req.body?.items) ? req.body.items : []).some((entry) => !(Number(entry?.unitPrice) > 0))) {
    return res.status(400).json({ message: 'Chaque prix proposé doit être supérieur à zéro.' });
  }
  const discount = Math.min(100, Math.max(0, Number(req.body?.discount || 0)));
  let quotedSubtotal = 0;
  for (const item of items) {
    const explicit = proposals.get(objectId(item._id)) ?? proposals.get(`${objectId(item.product)}:${item.selectionKey || ''}`);
    const base = action === 'ACCEPT' && item.requestedPrice != null ? item.requestedPrice : item.originalPrice;
    const proposed = explicit > 0 ? explicit : money(base * (1 - discount / 100));
    if (!(proposed > 0)) return res.status(400).json({ message: 'Chaque prix proposé doit être supérieur à zéro.' });
    item.quotedPrice = proposed;
    quotedSubtotal += proposed * item.quantity;
  }
  const updateLock = await QuotationRequest.findOneAndUpdate(
    { _id: current._id, seller: req.user.id, status: current.status, responseUpdating: { $ne: true } },
    { $set: { responseUpdating: true } },
    { new: true }
  );
  if (!updateLock) return res.status(409).json({ message: 'Le devis est déjà en cours de modification.' });
  try {
    await Promise.all(items.map((item) => item.save()));
  } catch (error) {
    await QuotationRequest.updateOne({ _id: current._id, responseUpdating: true }, { $set: { responseUpdating: false } });
    throw error;
  }
  const targetStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'COUNTERED';
  const updated = await QuotationRequest.findOneAndUpdate(
    { _id: current._id, seller: req.user.id, status: current.status, responseUpdating: true },
    { $set: {
      status: targetStatus,
      sellerMessage: cleanText(req.body?.message),
      discountPercent: discount,
      deliveryFee: money(req.body?.deliveryFee),
      estimatedDeliveryDate,
      validityPeriodHours: validity.hours,
      expirationDate: validity.date,
      quotedSubtotal: money(quotedSubtotal),
      requestedPrice: items.length === 1 ? items[0].requestedPrice : null,
      respondedAt: new Date(),
      pricesLockedAt: action === 'ACCEPT' ? new Date() : null,
      acceptedAt: action === 'ACCEPT' ? new Date() : null,
      wasCountered: action === 'COUNTER' ? true : current.wasCountered,
      responseUpdating: false
    } },
    { new: true }
  );
  if (!updated) {
    await QuotationRequest.updateOne({ _id: current._id, responseUpdating: true }, { $set: { responseUpdating: false } });
    return res.status(409).json({ message: 'Le devis a été modifié. Actualisez la page.' });
  }
  await notify({
    quotation: updated,
    recipientId: updated.buyer,
    actorId: req.user.id,
    type: action === 'ACCEPT' ? 'quotation_accepted' : 'quotation_countered',
    title: action === 'ACCEPT' ? 'Devis accepté par le vendeur' : 'Nouvelle contre-offre',
    message: updated.sellerMessage || (action === 'ACCEPT' ? 'Votre devis est prêt.' : 'Le vendeur vous propose un nouveau prix.'),
    deepLink: `/my-quotations/${updated._id}`
  });
  res.json(await hydrateQuotation(updated._id));
});

export const buyerRejectQuotation = asyncHandler(async (req, res) => {
  const updated = await QuotationRequest.findOneAndUpdate(
    { _id: req.params.id, buyer: req.user.id, status: { $in: ['COUNTERED', 'ACCEPTED'] } },
    { $set: { status: 'REJECTED', rejectedAt: new Date() } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: 'Ce devis ne peut plus être refusé.' });
  await notify({ quotation: updated, recipientId: updated.seller, actorId: req.user.id, type: 'quotation_rejected', title: 'Offre refusée par l’acheteur', message: 'L’acheteur a décliné votre offre.', deepLink: `/seller/quotations/${updated._id}` });
  res.json(await hydrateQuotation(updated._id));
});

export const buyerAcceptCounter = asyncHandler(async (req, res) => {
  const updated = await QuotationRequest.findOneAndUpdate(
    { _id: req.params.id, buyer: req.user.id, status: 'COUNTERED', responseUpdating: { $ne: true }, expirationDate: { $gt: new Date() } },
    { $set: { status: 'ACCEPTED', acceptedAt: new Date(), pricesLockedAt: new Date() } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: 'Cette contre-offre n’est plus disponible.' });
  await notify({ quotation: updated, recipientId: updated.seller, actorId: req.user.id, type: 'quotation_accepted', title: 'Contre-offre acceptée', message: 'L’acheteur peut maintenant finaliser sa commande.', deepLink: `/seller/quotations/${updated._id}` });
  res.json(await hydrateQuotation(updated._id));
});

export const createQuotationOrder = asyncHandler(async (req, res) => {
  const quotation = await QuotationRequest.findOne({ _id: req.params.id, buyer: req.user.id });
  if (!quotation) return res.status(404).json({ message: 'Devis introuvable.' });
  if (quotation.status === 'ORDER_CREATED' && quotation.order) {
    return res.json({ orderId: quotation.order, quotationId: quotation._id, alreadyCreated: true });
  }
  if (!quotationCanCreateOrder(quotation)) {
    if (quotation.status !== 'ACCEPTED') return res.status(409).json({ message: 'Seul un devis accepté peut créer une commande.' });
    if (!quotation.pricesLockedAt) return res.status(409).json({ message: 'Les prix de ce devis ne sont pas verrouillés.' });
    quotation.status = 'EXPIRED';
    await quotation.save();
    return res.status(409).json({ message: 'Ce devis est expiré.' });
  }
  const items = await QuotationItem.find({ quotation: quotation._id });
  const products = await Product.find({ _id: { $in: items.map((item) => item.product) } }).lean();
  const seller = await User.findById(quotation.seller).select('name shopName shopAddress phone city commune').lean();
  const byId = new Map(products.map((product) => [objectId(product._id), product]));
  const quotedProductIds = new Set(items.map((item) => objectId(item.product)));
  if (
    products.length !== quotedProductIds.size ||
    products.some((product) => String(product.user) !== String(quotation.seller) || product.status !== 'approved') ||
    items.some((item) => !(Number(item.quotedPrice) > 0))
  ) {
    return res.status(409).json({ message: 'Les lignes du devis ne sont pas valides.' });
  }
  const orderItems = items.map((item) => {
    const product = byId.get(objectId(item.product));
    const unitPrice = money(item.quotedPrice);
    return {
      product: item.product,
      quantity: item.quantity,
      unitPrice,
      lineTotal: money(unitPrice * item.quantity),
      selectedAttributes: item.selectedAttributes || [],
      snapshot: {
        title: item.snapshot?.title || product.title,
        price: unitPrice,
        basePrice: item.originalPrice,
        image: item.snapshot?.image || product.images?.[0] || '',
        shopName: seller?.shopName || seller?.name || 'Vendeur HDMarket',
        shopId: quotation.seller,
        shopAddress: seller?.shopAddress || '',
        shopPhone: seller?.phone || '',
        shopCity: product.city || '',
        shopCommune: seller?.commune || '',
        deliveryAvailable: product.deliveryAvailable !== false,
        pickupAvailable: product.pickupAvailable !== false,
        deliveryFeeEnabled: false,
        deliveryFee: 0,
        slug: item.snapshot?.slug || product.slug || ''
      }
    };
  });
  const subtotal = money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const deliveryFee = money(quotation.deliveryFee);
  const total = money(subtotal + deliveryFee);
  let order;
  try {
    order = await Order.create({
      customer: req.user.id,
      createdBy: req.user.id,
      items: orderItems,
      deliveryAddress: cleanText(req.body?.deliveryAddress || req.user?.address || quotation.deliveryCity, 500),
      deliveryCity: quotation.deliveryCity,
      expectedDeliveryDate: quotation.estimatedDeliveryDate || quotation.expectedDeliveryDate,
      status: 'pending_payment',
      paymentType: 'full',
      paymentMode: 'STANDARD',
      paymentStatus: 'PENDING',
      itemsSubtotal: subtotal,
      deliveryFeeTotal: deliveryFee,
      deliveryFeeLocked: true,
      deliveryFeeSource: 'PRODUCT_FEE',
      totalAmount: total,
      countryId: quotation.countryId,
      currency: quotation.currency,
      paidAmount: 0,
      remainingAmount: total,
      quotationRequest: quotation._id,
      quotationSnapshot: {
        applied: true,
        currency: quotation.currency,
        originalSubtotal: quotation.originalSubtotal,
        quotedSubtotal: subtotal,
        savings: money(Math.max(0, quotation.originalSubtotal - subtotal)),
        sellerMessage: quotation.sellerMessage,
        acceptedAt: quotation.acceptedAt
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Order.findOne({ quotationRequest: quotation._id }).lean();
      if (existing) return res.json({ orderId: existing._id, quotationId: quotation._id, alreadyCreated: true });
    }
    throw error;
  }
  const finalized = await QuotationRequest.findOneAndUpdate(
    { _id: quotation._id, buyer: req.user.id, status: 'ACCEPTED', order: null },
    { $set: { status: 'ORDER_CREATED', order: order._id } },
    { new: true }
  );
  if (!finalized) {
    await Order.deleteOne({ _id: order._id, paymentStatus: 'PENDING' });
    return res.status(409).json({ message: 'Une commande existe déjà pour ce devis.' });
  }
  await notify({ quotation: finalized, recipientId: finalized.seller, actorId: req.user.id, type: 'quotation_order_created', title: 'Commande issue d’un devis', message: 'L’acheteur a créé sa commande au prix négocié.', deepLink: `/seller/orders/detail/${order._id}` });
  res.status(201).json({ orderId: order._id, quotationId: quotation._id, totalAmount: total });
});

export const adminListQuotations = asyncHandler(async (req, res) => {
  await expireDueQuotations();
  const status = cleanText(req.query?.status, 30).toUpperCase();
  const filter = status && status !== 'ALL' ? { status } : {};
  const rows = await QuotationRequest.find(filter).sort({ createdAt: -1 }).limit(300).lean();
  res.json({ items: await Promise.all(rows.map((row) => hydrateQuotation(row._id))) });
});

export const adminQuotationAnalytics = asyncHandler(async (_req, res) => {
  await expireDueQuotations();
  const [statusRows, totals, topProducts, topSellers, counteredCount] = await Promise.all([
    QuotationRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    QuotationRequest.aggregate([{ $match: { quotedSubtotal: { $gt: 0 } } }, { $group: { _id: null, requests: { $sum: 1 }, original: { $sum: '$originalSubtotal' }, quoted: { $sum: '$quotedSubtotal' } } }]),
    QuotationItem.aggregate([{ $group: { _id: '$product', requests: { $sum: 1 }, quantity: { $sum: '$quantity' } } }, { $sort: { requests: -1 } }, { $limit: 10 }, { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } }, { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } }, { $project: { requests: 1, quantity: 1, title: '$product.title', slug: '$product.slug' } }]),
    QuotationRequest.aggregate([{ $group: { _id: '$seller', requests: { $sum: 1 }, orders: { $sum: { $cond: [{ $eq: ['$status', 'ORDER_CREATED'] }, 1, 0] } } } }, { $sort: { requests: -1 } }, { $limit: 10 }, { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } }, { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } }, { $project: { requests: 1, orders: 1, name: { $ifNull: ['$seller.shopName', '$seller.name'] } } }]),
    QuotationRequest.countDocuments({ wasCountered: true })
  ]);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
  const summary = totals[0] || { requests: 0, original: 0, quoted: 0 };
  const accepted = Number(byStatus.ACCEPTED || 0) + Number(byStatus.ORDER_CREATED || 0);
  const requests = Object.values(byStatus).reduce((sum, value) => sum + Number(value || 0), 0);
  const quotedOriginal = Number(summary.original || 0);
  const quotedTotal = Number(summary.quoted || 0);
  res.json({
    requests,
    byStatus,
    acceptedRate: requests ? (accepted / requests) * 100 : 0,
    rejectedRate: requests ? (Number(byStatus.REJECTED || 0) / requests) * 100 : 0,
    counterOfferRate: requests ? (Number(counteredCount || 0) / requests) * 100 : 0,
    conversionRate: requests ? (Number(byStatus.ORDER_CREATED || 0) / requests) * 100 : 0,
    averageDiscount: quotedOriginal > 0 ? Math.max(0, ((quotedOriginal - quotedTotal) / quotedOriginal) * 100) : 0,
    revenue: await Order.aggregate([{ $match: { quotationRequest: { $ne: null } } }, { $group: { _id: null, total: { $sum: '$paidAmount' } } }]).then((rows) => Number(rows[0]?.total || 0)),
    topProducts,
    topSellers
  });
});
