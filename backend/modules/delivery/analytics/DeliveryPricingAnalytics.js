import DeliveryPricingEvent from '../../../models/deliveryPricingEventModel.js';

export const recordPricingCalculation = async (payload = {}) => {
  try {
    await DeliveryPricingEvent.create({
      pricingVersion: payload.pricingVersion || '',
      durationMs: Math.max(0, Number(payload.durationMs || 0)),
      cacheSource: ['memory', 'redis', 'database'].includes(payload.cacheSource)
        ? payload.cacheSource
        : 'unknown',
      pickupCommuneId: payload.pickupCommuneId || null,
      dropoffCommuneId: payload.dropoffCommuneId || null,
      distanceMeters: Math.max(0, Number(payload.distanceMeters || 0)),
      price: Math.max(0, Number(payload.price || 0)),
      packageTypeId: payload.packageTypeId || null,
      deliverySpeed: payload.deliverySpeed || 'STANDARD',
      resolvedPickupFrom: payload.resolvedPickupFrom || 'UNRESOLVED',
      resolvedDropoffFrom: payload.resolvedDropoffFrom || 'UNRESOLVED',
      breakdown: Array.isArray(payload.breakdown) ? payload.breakdown : []
    });
  } catch {
    // Pricing must never fail because analytics storage is unavailable.
  }
};

export const getPricingAnalyticsSummary = async ({ days = 30 } = {}) => {
  const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const [summary] = await DeliveryPricingEvent.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        calculations: { $sum: 1 },
        averageDurationMs: { $avg: '$durationMs' },
        averagePrice: { $avg: '$price' },
        totalQuotedValue: { $sum: '$price' },
        memoryHits: { $sum: { $cond: [{ $eq: ['$cacheSource', 'memory'] }, 1, 0] } },
        redisHits: { $sum: { $cond: [{ $eq: ['$cacheSource', 'redis'] }, 1, 0] } },
        databaseLoads: { $sum: { $cond: [{ $eq: ['$cacheSource', 'database'] }, 1, 0] } }
      }
    }
  ]);

  const calculations = Number(summary?.calculations || 0);
  const cacheHits = Number(summary?.memoryHits || 0) + Number(summary?.redisHits || 0);
  return {
    days: safeDays,
    calculations,
    averageDurationMs: Number(Number(summary?.averageDurationMs || 0).toFixed(2)),
    averagePrice: Math.round(Number(summary?.averagePrice || 0)),
    totalQuotedValue: Math.round(Number(summary?.totalQuotedValue || 0)),
    cacheHitRate: calculations ? Number(((cacheHits / calculations) * 100).toFixed(2)) : 0,
    memoryHits: Number(summary?.memoryHits || 0),
    redisHits: Number(summary?.redisHits || 0),
    databaseLoads: Number(summary?.databaseLoads || 0)
  };
};
