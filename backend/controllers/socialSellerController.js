import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import SocialClick from '../models/socialClickModel.js';
import SocialCampaign, { SOCIAL_CAMPAIGN_CHANNELS } from '../models/socialCampaignModel.js';
import { resolveProductBySocialCode } from '../services/socialCommerce/productResolverService.js';
import { buildShareLinks } from '../services/socialCommerce/shareLinksService.js';
import { buildCanonicalProductPath } from '../services/socialCommerce/smartUrlService.js';
import { computeSellerSocialAnalytics } from '../services/socialCommerce/socialAnalyticsService.js';

const isValidId = (value) => Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

const requireOwnedProduct = async (productId, sellerId) => {
  if (!isValidId(productId)) return null;
  const product = await Product.findById(productId).select(
    'title price discount status socialCode wholesaleEnabled wholesaleTiers installmentEnabled user'
  );
  if (!product || String(product.user) !== String(sellerId)) return null;
  return product;
};

// GET /api/social-commerce/product/:socialCode — public product lookup by
// code (used for manual verification / the seller sharing UI's preview).
// Never exposes the Mongo _id.
export const getProductBySocialCode = asyncHandler(async (req, res) => {
  const resolution = await resolveProductBySocialCode(req.params.socialCode);
  if (!resolution.found) {
    return res.status(404).json({ success: false, code: 'SOCIAL_PRODUCT_NOT_FOUND', message: 'Produit introuvable.' });
  }
  const { product, shop, socialCode } = resolution;
  return res.json({
    success: true,
    data: {
      socialCode,
      title: product.title,
      price: product.price,
      discount: product.discount,
      images: product.images,
      shopName: shop?.shopName || shop?.name || '',
      productPath: buildCanonicalProductPath(product)
    }
  });
});

// GET /api/social-commerce/resolve/:socialCode — resolves + records a click.
// Called by the frontend's /s/:socialCode redirect page (SocialRedirect.jsx).
// Public, but attaches req.user.id when the visitor happens to be logged in
// (optionalProtect) — never invasive tracking beyond that.
export const resolveSocialClick = asyncHandler(async (req, res) => {
  const resolution = await resolveProductBySocialCode(req.params.socialCode);
  if (!resolution.found) {
    return res.status(404).json({ success: false, code: 'SOCIAL_PRODUCT_NOT_FOUND', message: 'Produit introuvable.' });
  }

  const { product, shop, socialCode } = resolution;
  const source = String(req.query.source || 'OTHER').toUpperCase();
  const normalizedSource = ['TIKTOK', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK'].includes(source) ? source : 'OTHER';
  const campaignCode = String(req.query.campaign || '').trim().toUpperCase();

  let campaignId = null;
  if (campaignCode) {
    const campaign = await SocialCampaign.findOne({ campaignCode, productId: product._id }).select('_id').lean();
    if (campaign) campaignId = campaign._id;
  }

  const click = await SocialClick.create({
    socialCode,
    productId: product._id,
    shopId: shop?._id || null,
    source: normalizedSource,
    campaign: campaignCode,
    campaignId,
    sessionId: String(req.headers['x-session-id'] || req.cookies?.hd_session_id || ''),
    userId: req.user?.id || null
  });

  console.log('social.click.created', { socialCode, productId: product._id, source: normalizedSource });

  return res.json({
    success: true,
    data: {
      socialClickId: click._id,
      productPath: buildCanonicalProductPath(product),
      channel: normalizedSource,
      campaign: campaignCode
    }
  });
});

// GET /api/social-commerce/products — the caller's own products with their
// social code + a lightweight click count, for the Social Commerce
// dashboard's Products tab.
export const listMySocialProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({ user: req.user.id, status: 'approved' })
    .select('title price images socialCode createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const productIds = products.map((product) => product._id);
  const clickCounts = await SocialClick.aggregate([
    { $match: { productId: { $in: productIds } } },
    { $group: { _id: '$productId', clicks: { $sum: 1 } } }
  ]);
  const clicksByProduct = new Map(clickCounts.map((row) => [String(row._id), row.clicks]));

  return res.json({
    success: true,
    data: products.map((product) => ({
      ...product,
      clicks: clicksByProduct.get(String(product._id)) || 0
    }))
  });
});

// GET /api/social-commerce/product/:productId/share-links
export const getProductShareLinks = asyncHandler(async (req, res) => {
  const product = await requireOwnedProduct(req.params.productId, req.user.id);
  if (!product) {
    return res.status(404).json({ success: false, code: 'PRODUCT_NOT_FOUND', message: 'Produit introuvable.' });
  }
  if (!product.socialCode) {
    return res.status(409).json({
      success: false,
      code: 'SOCIAL_CODE_MISSING',
      message: 'Ce produit n’a pas encore de code social.'
    });
  }
  const links = await buildShareLinks(product, { campaign: req.query.campaign });
  return res.json({ success: true, data: links });
});

// POST /api/social-commerce/campaigns
export const createSocialCampaign = asyncHandler(async (req, res) => {
  const { name, productId, channel, startsAt, endsAt } = req.body || {};
  const product = await requireOwnedProduct(productId, req.user.id);
  if (!product) {
    return res.status(404).json({ success: false, code: 'PRODUCT_NOT_FOUND', message: 'Produit introuvable.' });
  }
  if (!name || !SOCIAL_CAMPAIGN_CHANNELS.includes(String(channel || '').toUpperCase())) {
    return res.status(400).json({ success: false, code: 'INVALID_CAMPAIGN', message: 'Nom ou canal invalide.' });
  }

  const campaign = await SocialCampaign.create({
    name: String(name).trim().slice(0, 120),
    shopId: req.user.id,
    productId: product._id,
    channel: String(channel).toUpperCase(),
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    createdBy: req.user.id
  });

  return res.status(201).json({ success: true, data: campaign });
});

// GET /api/social-commerce/campaigns — the caller's own campaigns only.
export const listSocialCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await SocialCampaign.find({ shopId: req.user.id })
    .populate('productId', 'title images socialCode')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return res.json({ success: true, data: campaigns });
});

// PATCH /api/social-commerce/campaigns/:id — toggle isActive only (spec keeps
// campaign management lightweight — no full edit surface in this phase).
export const toggleSocialCampaign = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(404).json({ success: false, code: 'CAMPAIGN_NOT_FOUND', message: 'Campagne introuvable.' });
  }
  const campaign = await SocialCampaign.findOne({ _id: req.params.id, shopId: req.user.id });
  if (!campaign) {
    return res.status(404).json({ success: false, code: 'CAMPAIGN_NOT_FOUND', message: 'Campagne introuvable.' });
  }
  campaign.isActive = Boolean(req.body?.isActive);
  await campaign.save();
  return res.json({ success: true, data: campaign });
});

// GET /api/social-commerce/analytics — the caller's own aggregate numbers
// only (spec §21/§44 seller mobile overview).
export const getSellerSocialAnalytics = asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const analytics = await computeSellerSocialAnalytics(req.user.id, { days });
  return res.json({ success: true, data: analytics });
});
