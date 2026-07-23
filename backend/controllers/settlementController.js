import asyncHandler from 'express-async-handler';
import SellerPayout from '../models/sellerPayoutModel.js';
import SellerSettlement from '../models/sellerSettlementModel.js';
import User from '../models/userModel.js';
import {
  normalizePayoutPhone,
  processSellerSettlements,
  reconcileSellerPayout,
  retryFailedSellerPayout
} from '../services/sellerSettlementService.js';
import { getPawaPayPayoutStatus, predictPawaPayProvider } from '../services/pawapayService.js';
import { invalidateSellerCache, invalidateUserCache } from '../utils/cache.js';

export const getMySellerSettlements = asyncHandler(async (req, res) => {
  const [settlements, payouts, totals] = await Promise.all([
    SellerSettlement.find({ seller: req.user.id })
      .populate('order', 'status totalAmount paidAmount completedAt settlementStatus')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    SellerPayout.find({ seller: req.user.id }).sort({ createdAt: -1 }).limit(50).lean(),
    SellerSettlement.aggregate([
      { $match: { seller: req.user._id } },
      {
        $group: {
          _id: '$status',
          amount: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);
  const user = await User.findById(req.user.id).select('accountType payoutAccount').lean();
  res.json({
    payoutAccount: user?.payoutAccount || {},
    settlements,
    payouts,
    summary: Object.fromEntries(totals.map((entry) => [
      String(entry._id || '').toLowerCase(),
      { amount: entry.amount, count: entry.count }
    ]))
  });
});

export const updateMyPayoutAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || user.accountType !== 'shop') {
    return res.status(403).json({ message: 'Un compte boutique est requis pour recevoir des versements.' });
  }
  if (!user.phoneVerified) {
    return res.status(400).json({
      message: 'Vérifiez d’abord le numéro de téléphone de votre profil avant de l’utiliser pour les versements.'
    });
  }
  const requestedPhone = normalizePayoutPhone(req.body.phoneNumber);
  const verifiedUserPhone = normalizePayoutPhone(user.phone);
  if (!requestedPhone || requestedPhone !== verifiedUserPhone) {
    return res.status(400).json({
      message: 'Pour votre sécurité, le compte de versement doit utiliser le numéro vérifié de votre profil.'
    });
  }
  const prediction = await predictPawaPayProvider(requestedPhone);
  const predictedProvider = String(
    prediction?.provider ||
    prediction?.data?.provider ||
    prediction?.providerCode ||
    ''
  ).trim().toUpperCase();
  if (!['MTN_MOMO_COG', 'AIRTEL_COG'].includes(predictedProvider)) {
    return res.status(400).json({
      message: 'PawaPay n’a pas reconnu ce numéro comme un compte MTN MoMo ou Airtel Money du Congo.'
    });
  }

  user.payoutAccount = {
    provider: predictedProvider,
    phoneNumber: requestedPhone,
    verifiedAt: new Date()
  };
  await user.save();
  await Promise.allSettled([
    invalidateUserCache(user._id, ['users', 'notifications']),
    invalidateSellerCache(user._id, ['dashboard', 'orders'])
  ]);
  await processSellerSettlements().catch(() => {});
  res.json({
    message: 'Compte de versement Mobile Money vérifié avec PawaPay.',
    payoutAccount: user.payoutAccount
  });
});

export const listSellerPayoutsAdmin = asyncHandler(async (req, res) => {
  const status = String(req.query.status || '').trim().toUpperCase();
  const query = status ? { status } : {};
  const payouts = await SellerPayout.find(query)
    .populate('seller', 'name shopName email phone payoutAccount')
    .populate({
      path: 'settlements',
      populate: { path: 'order', select: 'status totalAmount settlementStatus' }
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(req.query.limit || 50))))
    .lean();
  res.json({ payouts });
});

export const retrySellerPayoutAdmin = asyncHandler(async (req, res) => {
  const result = await retryFailedSellerPayout(String(req.params.payoutId || '').trim());
  if (!result) return res.status(404).json({ message: 'Versement échoué introuvable.' });
  res.json({ message: 'Nouvelle tentative de versement programmée.', result });
});

export const refreshSellerPayoutAdmin = asyncHandler(async (req, res) => {
  const payoutId = String(req.params.payoutId || '').trim();
  const payout = await SellerPayout.findOne({ payoutId });
  if (!payout) return res.status(404).json({ message: 'Versement introuvable.' });
  const providerStatus = await getPawaPayPayoutStatus(payoutId, { timeoutMs: 12_000 });
  const reconciled = await reconcileSellerPayout(payoutId, providerStatus);
  res.json({ payout: reconciled });
});
