/**
 * DeliveryPricingEngine — orchestrates every pricing module in the order
 * described in the pricing spec:
 *
 *   Resolve GPS -> Landmark -> Commune -> City
 *   -> Determine Zone -> Base Zone Price -> Distance Adjustment
 *   -> Package Extra -> Weight Extra -> Delivery Speed
 *   -> Peak Hour / Fuel / other time surcharges -> Waiting Fee -> Promotion
 *   -> Final Price
 *
 * Each module only knows its own contribution; this file is the only place
 * that knows the overall order, so any module can change independently.
 */
import DeliverySpeedRule from '../../models/deliverySpeedRuleModel.js';
import { recordPricingCalculation } from '../../modules/delivery/analytics/DeliveryPricingAnalytics.js';
import { getPricingContext } from '../../modules/delivery/loaders/PricingContextLoader.js';
import { resolveLocationCoordinates } from './LocationResolverService.js';
import { resolveZoneBasePrice } from './ZonePricingService.js';
import { computeDistanceAdjustment } from './GPSDistanceService.js';
import { computePackageContribution } from './PackagePricingService.js';
import { computeWeightContribution } from './WeightPricingService.js';
import { computeTimeContributions, applyTimeContributions } from './TimePricingService.js';
import { computeWaitingFee } from './WaitingFeeService.js';
import { resolvePromotion, computePromotionDiscount, markPromotionUsed } from './PromotionService.js';
import { buildFinalPrice } from './FinalPriceService.js';

const createHttpError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const resolveDeliverySpeedExtra = async (deliverySpeedKey, pricingContext = null) => {
  const key = String(deliverySpeedKey || 'STANDARD').toUpperCase();
  const rule = pricingContext
    ? pricingContext.speedRules.find((entry) => String(entry.key || '').toUpperCase() === key)
    : await DeliverySpeedRule.findOne({ key, isActive: true }).lean();
  if (!rule) return { amount: 0, label: '', etaMinutes: null };
  return { amount: Math.max(0, Number(rule.extraPrice || 0)), label: rule.label, etaMinutes: rule.etaMinutes };
};

/**
 * @param {Object} params
 * @param {Object} params.pickup - { cityId, communeId, address, coordinates }
 * @param {Object} params.dropoff - same shape as pickup
 * @param {string} [params.packageTypeId]
 * @param {number} [params.weightKg]
 * @param {string} [params.deliverySpeed] - STANDARD | EXPRESS | IMMEDIATE
 * @param {string} [params.promoCode]
 * @param {number} [params.waitingMinutes]
 * @param {Date} [params.at]
 */
export const estimateDeliveryPrice = async ({
  pickup,
  dropoff,
  packageTypeId = null,
  weightKg = null,
  deliverySpeed = 'STANDARD',
  promoCode = '',
  waitingMinutes = 0,
  at = new Date()
} = {}) => {
  const startedAt = Date.now();
  const pricingContext = await getPricingContext();
  const settings = pricingContext.settings;

  const cascadeEnabled = settings.parcel_pricing_enable_location_resolver !== false;
  const resolverOptions = {
    enableLandmark: cascadeEnabled && settings.parcel_pricing_enable_landmark !== false,
    enableCommune: cascadeEnabled && settings.parcel_pricing_enable_commune !== false
  };

  const [resolvedPickup, resolvedDropoff] = await Promise.all([
    resolveLocationCoordinates(pickup, resolverOptions, pricingContext),
    resolveLocationCoordinates(dropoff, resolverOptions, pricingContext)
  ]);

  const gpsEnabled = settings.parcel_pricing_enable_gps !== false;
  const distanceInfo = gpsEnabled
    ? computeDistanceAdjustment({
        pickupCoordinates: resolvedPickup.coordinates,
        dropoffCoordinates: resolvedDropoff.coordinates,
        pricePerKm: settings.parcel_delivery_price_per_km
      })
    : { distanceMeters: null, amount: 0 };

  if (Number.isFinite(distanceInfo.distanceMeters)) {
    const maxDistanceKm = Math.max(1, Number(settings.parcel_delivery_max_distance_km || 30));
    if (distanceInfo.distanceMeters / 1000 > maxDistanceKm) {
      throw createHttpError(`La distance dépasse la zone de service (${maxDistanceKm} km max).`, 400);
    }
  }

  const lines = [];

  // ── Base price: zone matrix if configured, else the legacy GPS/flat rule ──
  let zoneInfo = null;
  if (settings.parcel_pricing_enable_zone_matrix) {
    zoneInfo = await resolveZoneBasePrice({
      pickupCommuneId: pickup?.communeId,
      dropoffCommuneId: dropoff?.communeId,
      pricingContext
    });
  }

  if (zoneInfo) {
    lines.push({ label: 'Prix de base (zone)', amount: zoneInfo.price });
    if (Number.isFinite(distanceInfo.distanceMeters)) {
      lines.push({ label: 'Ajustement distance', amount: distanceInfo.amount });
    }
  } else if (Number.isFinite(distanceInfo.distanceMeters)) {
    const basePrice = Math.max(0, Number(settings.parcel_delivery_base_price || 0));
    lines.push({ label: 'Prix de base', amount: basePrice });
    lines.push({ label: 'Ajustement distance', amount: distanceInfo.amount });
  } else {
    const sameCommune =
      pickup?.communeId && dropoff?.communeId && String(pickup.communeId) === String(dropoff.communeId);
    const flatPrice = sameCommune
      ? Number(settings.parcel_delivery_same_commune_price || 1500)
      : Number(settings.parcel_delivery_cross_commune_price || 2500);
    lines.push({ label: sameCommune ? 'Forfait même commune' : 'Forfait communes différentes', amount: flatPrice });
  }

  // ── Package / weight / speed extras ──
  const [packageInfo, weightInfo, speedInfo] = await Promise.all([
    computePackageContribution(packageTypeId, pricingContext),
    computeWeightContribution(Number(weightKg), pricingContext),
    resolveDeliverySpeedExtra(deliverySpeed, pricingContext)
  ]);

  if (packageInfo.amount > 0) lines.push({ label: 'Type de colis', amount: packageInfo.amount });

  let subtotal = lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  if (weightInfo.multiplier !== 1) {
    const beforeWeight = subtotal;
    subtotal *= weightInfo.multiplier;
    lines.push({ label: 'Poids (multiplicateur)', amount: subtotal - beforeWeight });
  }
  if (weightInfo.fixedExtra > 0) {
    lines.push({ label: 'Poids (supplément)', amount: weightInfo.fixedExtra });
    subtotal += weightInfo.fixedExtra;
  }
  if (speedInfo.amount > 0) {
    lines.push({ label: speedInfo.label || 'Vitesse de livraison', amount: speedInfo.amount });
    subtotal += speedInfo.amount;
  }

  // ── Time-based surcharges (fuel/night/weekend/holiday/rain/peak hours) ──
  const timeContributions = await computeTimeContributions({ at, pricingContext });
  const timeLines = applyTimeContributions(timeContributions, subtotal);
  lines.push(...timeLines);
  subtotal += timeLines.reduce((sum, line) => sum + line.amount, 0);

  // ── Waiting fee (0 at initial estimate; recomputed once courier logs it) ──
  const waitingFee = await computeWaitingFee(waitingMinutes);
  if (waitingFee.amount > 0) lines.push({ label: 'Frais d’attente', amount: waitingFee.amount });

  // ── Promotion ──
  let appliedPromotion = null;
  if (promoCode) {
    appliedPromotion = await resolvePromotion({
      code: promoCode,
      zoneId: zoneInfo?.toZoneId,
      pricingContext
    });
    if (appliedPromotion) {
      const discount = computePromotionDiscount(appliedPromotion, subtotal + waitingFee.amount);
      if (discount.amount !== 0) lines.push(discount);
    }
  }

  const minPrice = Math.max(0, Number(settings.parcel_delivery_min_price || 0));
  const { total, breakdown } = buildFinalPrice({ lines, minPrice });

  const result = {
    distanceMeters: Number.isFinite(distanceInfo.distanceMeters) ? Math.round(distanceInfo.distanceMeters) : 0,
    price: total,
    breakdown,
    resolvedPickup,
    resolvedDropoff,
    appliedPromotionId: appliedPromotion?._id || null,
    pricingVersion: pricingContext.pricingVersion
  };

  void recordPricingCalculation({
    pricingVersion: pricingContext.pricingVersion,
    durationMs: Date.now() - startedAt,
    cacheSource: pricingContext.cacheSource,
    pickupCommuneId: pickup?.communeId || null,
    dropoffCommuneId: dropoff?.communeId || null,
    distanceMeters: result.distanceMeters,
    price: result.price,
    packageTypeId,
    deliverySpeed,
    resolvedPickupFrom: resolvedPickup.resolvedFrom,
    resolvedDropoffFrom: resolvedDropoff.resolvedFrom,
    breakdown
  });

  return result;
};

export const finalizePromotionUsage = (promotionId) => {
  if (!promotionId) return Promise.resolve();
  return markPromotionUsed(promotionId);
};
