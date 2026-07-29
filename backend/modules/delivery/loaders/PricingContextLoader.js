import { createHash } from 'node:crypto';
import City from '../../../models/cityModel.js';
import Commune from '../../../models/communeModel.js';
import DeliveryPromotion from '../../../models/deliveryPromotionModel.js';
import DeliverySpeedRule from '../../../models/deliverySpeedRuleModel.js';
import DeliveryZone from '../../../models/deliveryZoneModel.js';
import DeliveryZonePrice from '../../../models/deliveryZonePriceModel.js';
import Landmark from '../../../models/landmarkModel.js';
import PackageType from '../../../models/packageTypeModel.js';
import PeakHourRule from '../../../models/peakHourRuleModel.js';
import WeightRule from '../../../models/weightRuleModel.js';
import DeliveryPricingVersion from '../../../models/deliveryPricingVersionModel.js';
import { getManyRuntimeConfigs } from '../../../services/configService.js';
import {
  getCachedPricingContext,
  getPricingCacheStats,
  invalidatePricingContext,
  setCachedPricingContext
} from '../cache/PricingContextCache.js';

export const PRICING_SETTING_KEYS = [
  'parcel_delivery_base_price',
  'parcel_delivery_price_per_km',
  'parcel_delivery_min_price',
  'parcel_delivery_same_commune_price',
  'parcel_delivery_cross_commune_price',
  'parcel_delivery_max_distance_km',
  'parcel_pricing_fuel_surcharge_percent',
  'parcel_pricing_night_surcharge_percent',
  'parcel_pricing_weekend_surcharge_percent',
  'parcel_pricing_holiday_surcharge_percent',
  'parcel_pricing_holiday_active',
  'parcel_pricing_rain_surcharge_percent',
  'parcel_pricing_rain_active',
  'parcel_pricing_waiting_fee_per_minute',
  'parcel_pricing_free_waiting_minutes',
  'parcel_pricing_max_driver_adjustment_percent',
  'parcel_delivery_platform_commission_percent',
  'parcel_pricing_enable_surge',
  'parcel_pricing_enable_landmark',
  'parcel_pricing_enable_gps',
  'parcel_pricing_enable_commune',
  'parcel_pricing_enable_location_resolver',
  'parcel_pricing_enable_zone_matrix'
];

const toPlain = (value) => JSON.parse(JSON.stringify(value));

const buildChecksum = (snapshot) =>
  createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

const ensureVersion = async ({ checksum, snapshot, source = 'AUTOMATIC', createdBy = null }) => {
  const version = `cfg-${checksum.slice(0, 12)}`;
  return DeliveryPricingVersion.findOneAndUpdate(
    { checksum },
    {
      $setOnInsert: {
        version,
        checksum,
        snapshot,
        source,
        activatedAt: new Date(),
        createdBy
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
};

const loadContextFromDatabase = async ({ source = 'AUTOMATIC', createdBy = null } = {}) => {
  const [
    settings,
    cities,
    communes,
    zones,
    zonePrices,
    landmarks,
    packageTypes,
    weightRules,
    speedRules,
    peakHourRules,
    promotions
  ] = await Promise.all([
    getManyRuntimeConfigs(PRICING_SETTING_KEYS),
    City.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    Commune.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    DeliveryZone.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    DeliveryZonePrice.find({ isActive: true }).sort({ fromZoneId: 1, toZoneId: 1 }).lean(),
    Landmark.find({ status: 'ACTIVE' }).sort({ cityId: 1, name: 1 }).lean(),
    PackageType.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    WeightRule.find({ isActive: true }).sort({ minKg: 1 }).lean(),
    DeliverySpeedRule.find({ isActive: true }).sort({ order: 1 }).lean(),
    PeakHourRule.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
    DeliveryPromotion.find({ isActive: true }).sort({ code: 1 }).lean()
  ]);

  const snapshot = toPlain({
    settings,
    cities,
    communes,
    zones,
    zonePrices,
    landmarks,
    packageTypes,
    weightRules,
    speedRules,
    peakHourRules,
    promotions
  });
  const checksum = buildChecksum(snapshot);
  const versionRecord = await ensureVersion({ checksum, snapshot, source, createdBy });

  return {
    ...snapshot,
    pricingVersion: versionRecord.version,
    checksum,
    loadedAt: new Date().toISOString()
  };
};

export const getPricingContext = async ({ forceRefresh = false, source = 'AUTOMATIC', createdBy = null } = {}) => {
  if (!forceRefresh) {
    const cached = await getCachedPricingContext();
    if (cached?.value) {
      return { ...cached.value, cacheSource: cached.source };
    }
  } else {
    await invalidatePricingContext();
  }

  const context = await loadContextFromDatabase({ source, createdBy });
  await setCachedPricingContext(context);
  return { ...context, cacheSource: 'database' };
};

export const refreshPricingContext = (options = {}) =>
  getPricingContext({ ...options, forceRefresh: true });

export const getPricingSystemStatus = async () => {
  const context = await getPricingContext();
  const versionCount = await DeliveryPricingVersion.countDocuments();
  return {
    pricingVersion: context.pricingVersion,
    checksum: context.checksum,
    loadedAt: context.loadedAt,
    cacheSource: context.cacheSource,
    cache: getPricingCacheStats(),
    versions: versionCount,
    configuration: {
      cities: context.cities.length,
      communes: context.communes.length,
      zones: context.zones.length,
      zonePrices: context.zonePrices.length,
      landmarks: context.landmarks.length,
      packageTypes: context.packageTypes.length,
      weightRules: context.weightRules.length,
      speedRules: context.speedRules.length,
      peakHourRules: context.peakHourRules.length,
      promotions: context.promotions.length
    }
  };
};
