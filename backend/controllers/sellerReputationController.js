import asyncHandler from 'express-async-handler';
import { getSellerReputation, recalculateSellerLevel } from '../services/sellerReputationService.js';
import User from '../models/userModel.js';

// ─── PUBLIC ──────────────────────────────────────────────

export const getSellerReputationBySlug = asyncHandler(async (req, res) => {
  const seller = await User.findOne({ slug: req.params.slug })
    .select('_id')
    .lean();
  if (!seller) return res.status(404).json({ message: 'Boutique introuvable' });

  const reputation = await getSellerReputation(seller._id);
  if (!reputation) return res.status(404).json({ message: 'Réputation non disponible' });

  res.json(reputation);
});

export const getSellerReputationById = asyncHandler(async (req, res) => {
  const reputation = await getSellerReputation(req.params.id);
  if (!reputation) return res.status(404).json({ message: 'Réputation non disponible' });
  res.json(reputation);
});

// ─── ADMIN ───────────────────────────────────────────────

export const adminRecalculateSellerLevel = asyncHandler(async (req, res) => {
  const result = await recalculateSellerLevel(req.params.id);
  if (!result) return res.status(404).json({ message: 'Vendeur introuvable ou pas une boutique' });
  res.json({ message: 'Niveau recalculé', ...result });
});

export const adminListSellersByLevel = asyncHandler(async (req, res) => {
  const { level } = req.query;
  const query = { accountType: 'shop' };
  if (level && ['debutant', 'confirme', 'avance', 'or', 'diamant'].includes(level)) {
    query.sellerLevel = level;
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [sellers, total] = await Promise.all([
    User.find(query)
      .select('shopName sellerLevel totalCompletedOrders avgRating disputeRate shopVerified followersCount')
      .sort({ totalCompletedOrders: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ]);

  res.json({ items: sellers, total, page, pages: Math.ceil(total / limit) });
});
