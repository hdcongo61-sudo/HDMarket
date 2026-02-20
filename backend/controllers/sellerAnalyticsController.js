import asyncHandler from 'express-async-handler';
import User from '../models/userModel.js';
import SellerAnalyticsReport from '../models/sellerAnalyticsReportModel.js';
import {
  buildAnalyticsRange,
  computeSellerAnalytics,
  generateSellerAnalyticsPdfBuffer
} from '../utils/sellerAnalyticsService.js';

const hasSellerAnalyticsAccess = (user) => {
  if (!user) return false;
  if (user.accountType === 'shop') return true;
  const role = String(user.role || '').toLowerCase();
  return role === 'boutique_owner' || role === 'vendeur';
};

const sanitizeFilenamePart = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const getSellerAnalytics = asyncHandler(async (req, res) => {
  const seller = await User.findById(req.user.id).select('name shopName city accountType role').lean();
  if (!seller) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (!hasSellerAnalyticsAccess(seller)) {
    return res.status(403).json({ message: 'Cette analytics est réservée aux vendeurs et boutiques.' });
  }

  const analytics = await computeSellerAnalytics({
    sellerId: req.user.id,
    dateFrom: req.query?.dateFrom,
    dateTo: req.query?.dateTo,
    maxDays: 365
  });

  res.json(analytics);
});

export const downloadSellerAnalyticsPdf = asyncHandler(async (req, res) => {
  const seller = await User.findById(req.user.id).select('name shopName city accountType role').lean();
  if (!seller) {
    return res.status(404).json({ message: 'Utilisateur introuvable.' });
  }

  if (!hasSellerAnalyticsAccess(seller)) {
    return res.status(403).json({ message: 'Cette analytics est réservée aux vendeurs et boutiques.' });
  }

  const range = buildAnalyticsRange({
    dateFrom: req.query?.dateFrom,
    dateTo: req.query?.dateTo,
    maxDays: 365
  });

  const analytics = await computeSellerAnalytics({
    sellerId: req.user.id,
    dateFrom: req.query?.dateFrom,
    dateTo: req.query?.dateTo,
    maxDays: 365
  });

  const buffer = await generateSellerAnalyticsPdfBuffer({
    analytics,
    sellerName: seller.shopName || seller.name,
    sellerCity: seller.city || ''
  });

  const sellerPart = sanitizeFilenamePart(seller.shopName || seller.name || 'seller');
  const startPart = range.startDate.toISOString().slice(0, 10);
  const endPart = range.endDate.toISOString().slice(0, 10);
  const filename = `hdmarket-analytics-${sellerPart}-${startPart}-${endPart}.pdf`;

  const report = await SellerAnalyticsReport.create({
    sellerId: req.user.id,
    periodStart: range.startDate,
    periodEnd: range.endDate,
    fileName: filename,
    format: 'pdf',
    generatedAt: new Date(),
    metricsSnapshot: {
      revenue: Number(analytics?.summary?.revenue || 0),
      orders: Number(analytics?.summary?.orders || 0),
      conversionRate: Number(analytics?.summary?.conversionRate || 0),
      installmentPaid: Number(analytics?.installment?.amountPaidSoFar || 0),
      installmentRemaining: Number(analytics?.installment?.remainingAmount || 0)
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('X-Report-Id', String(report._id));
  res.send(buffer);
});

