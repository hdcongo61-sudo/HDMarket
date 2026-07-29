import asyncHandler from 'express-async-handler';
import { getPricingAnalyticsSummary } from '../modules/delivery/analytics/DeliveryPricingAnalytics.js';
import {
  getPricingSystemStatus,
  refreshPricingContext
} from '../modules/delivery/loaders/PricingContextLoader.js';
import { seedGeneratedBrazzavillePricingData } from '../modules/delivery/seeds/generatedBrazzavillePricingData.js';

export const getDeliveryPricingSystemOverview = asyncHandler(async (req, res) => {
  const [system, analytics] = await Promise.all([
    getPricingSystemStatus(),
    getPricingAnalyticsSummary({ days: req.query?.days })
  ]);
  res.json({ system, analytics });
});

export const refreshDeliveryPricingSystem = asyncHandler(async (req, res) => {
  const context = await refreshPricingContext({
    source: 'ADMIN_REFRESH',
    createdBy: req.user?._id || req.user?.id || null
  });
  res.json({
    message: 'Contexte de tarification actualisé.',
    pricingVersion: context.pricingVersion,
    loadedAt: context.loadedAt,
    cacheSource: context.cacheSource
  });
});

export const installGeneratedDeliveryPricingData = asyncHandler(async (req, res) => {
  const result = await seedGeneratedBrazzavillePricingData({
    actorId: req.user?._id || req.user?.id || null
  });
  res.status(201).json(result);
});
