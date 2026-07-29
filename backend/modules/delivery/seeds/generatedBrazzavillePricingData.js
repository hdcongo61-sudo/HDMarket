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
import { setRuntimeConfig } from '../../../services/configService.js';
import { refreshPricingContext } from '../loaders/PricingContextLoader.js';

const GENERATED_DESCRIPTION =
  'Donnée de démonstration générée pour HDMarket. Vérifier les coordonnées et tarifs avant production.';

const ZONES = [
  { key: 'CENTRE', name: 'Brazzaville Centre', color: '#e85d00', order: 1 },
  { key: 'SUD', name: 'Brazzaville Sud', color: '#16a34a', order: 2 },
  { key: 'NORD', name: 'Brazzaville Nord', color: '#2563eb', order: 3 },
  { key: 'PERIPHERIE', name: 'Brazzaville Périphérie', color: '#7c3aed', order: 4 }
];

const COMMUNES = [
  { name: 'Makélékélé', latitude: -4.282, longitude: 15.252, zone: 'SUD', order: 1 },
  { name: 'Bacongo', latitude: -4.273, longitude: 15.249, zone: 'SUD', order: 2 },
  { name: 'Poto-Poto', latitude: -4.262, longitude: 15.285, zone: 'CENTRE', order: 3 },
  { name: 'Moungali', latitude: -4.252, longitude: 15.282, zone: 'CENTRE', order: 4 },
  { name: 'Ouenzé', latitude: -4.242, longitude: 15.292, zone: 'NORD', order: 5 },
  { name: 'Talangaï', latitude: -4.215, longitude: 15.291, zone: 'NORD', order: 6 },
  { name: 'Mfilou', latitude: -4.246, longitude: 15.22, zone: 'PERIPHERIE', order: 7 },
  { name: 'Madibou', latitude: -4.327, longitude: 15.21, zone: 'PERIPHERIE', order: 8 },
  { name: 'Djiri', latitude: -4.175, longitude: 15.29, zone: 'PERIPHERIE', order: 9 }
];

const ZONE_PRICES = {
  CENTRE: { CENTRE: 1500, SUD: 2200, NORD: 2300, PERIPHERIE: 3000 },
  SUD: { CENTRE: 2200, SUD: 1600, NORD: 2800, PERIPHERIE: 2700 },
  NORD: { CENTRE: 2300, SUD: 2800, NORD: 1700, PERIPHERIE: 2600 },
  PERIPHERIE: { CENTRE: 3000, SUD: 2700, NORD: 2600, PERIPHERIE: 2200 }
};

const LANDMARKS = [
  { name: 'Centre communal Makélékélé', commune: 'Makélékélé', offset: [0.001, -0.001], aliases: ['centre makelekele', 'mairie makelekele'] },
  { name: 'Marché de Bacongo', commune: 'Bacongo', offset: [-0.001, 0.001], aliases: ['marche bacongo', 'bacongo marche'] },
  { name: 'Centre Poto-Poto', commune: 'Poto-Poto', offset: [0.001, 0.001], aliases: ['poto poto centre', 'centre poto poto'] },
  { name: 'Rond-point Moungali', commune: 'Moungali', offset: [-0.001, 0.001], aliases: ['rond point moungali', 'rp moungali'] },
  { name: 'Centre Ouenzé', commune: 'Ouenzé', offset: [0.001, -0.001], aliases: ['ouenze centre', 'centre ouenze'] },
  { name: 'Centre Talangaï', commune: 'Talangaï', offset: [-0.001, -0.001], aliases: ['talangai centre', 'centre talangai'] },
  { name: 'Centre Mfilou', commune: 'Mfilou', offset: [0.001, 0.001], aliases: ['mfilou centre', 'centre mfilou'] },
  { name: 'Centre Madibou', commune: 'Madibou', offset: [-0.001, 0.001], aliases: ['madibou centre', 'centre madibou'] },
  { name: 'Centre Djiri', commune: 'Djiri', offset: [0.001, -0.001], aliases: ['djiri centre', 'centre djiri'] }
];

const PACKAGE_TYPES = [
  { name: 'Documents', extraPrice: 0, priority: 10, specialNotes: 'Protéger de la pluie.', order: 1 },
  { name: 'Petit colis', extraPrice: 200, priority: 20, specialNotes: 'Manipulation standard.', order: 2 },
  { name: 'Nourriture', extraPrice: 300, priority: 40, specialNotes: 'Transport rapide et à plat.', order: 3 },
  { name: 'Médicaments', extraPrice: 400, priority: 80, specialNotes: 'Prioritaire. Éviter la chaleur.', order: 4 },
  { name: 'Fragile', extraPrice: 700, priority: 100, specialNotes: 'Manipuler avec précaution.', order: 5 },
  { name: 'Volumineux', extraPrice: 1200, priority: 60, specialNotes: 'Vérifier la capacité du véhicule.', order: 6 }
];

const WEIGHT_RULES = [
  { minKg: 0, maxKg: 1, mode: 'FIXED_EXTRA', fixedExtra: 0, multiplier: 1 },
  { minKg: 1.01, maxKg: 5, mode: 'FIXED_EXTRA', fixedExtra: 500, multiplier: 1 },
  { minKg: 5.01, maxKg: 15, mode: 'FIXED_EXTRA', fixedExtra: 1200, multiplier: 1 },
  { minKg: 15.01, maxKg: 30, mode: 'MULTIPLIER', fixedExtra: 0, multiplier: 1.5 }
];

const SPEED_RULES = [
  { key: 'STANDARD', label: 'Standard', extraPrice: 0, etaMinutes: 120, order: 1 },
  { key: 'EXPRESS', label: 'Express', extraPrice: 800, etaMinutes: 60, order: 2 },
  { key: 'IMMEDIATE', label: 'Immédiat', extraPrice: 1500, etaMinutes: 35, order: 3 }
];

const PEAK_RULES = [
  {
    name: 'Pointe du matin',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '07:00',
    endTime: '09:00',
    surchargeType: 'PERCENT',
    surchargeValue: 10,
    order: 1
  },
  {
    name: 'Pointe du soir',
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '16:30',
    endTime: '19:00',
    surchargeType: 'PERCENT',
    surchargeValue: 12,
    order: 2
  }
];

const RUNTIME_SETTINGS = {
  enable_parcel_delivery: true,
  parcel_delivery_base_price: 1000,
  parcel_delivery_price_per_km: 175,
  parcel_delivery_min_price: 1200,
  parcel_delivery_same_commune_price: 1500,
  parcel_delivery_cross_commune_price: 2500,
  parcel_delivery_max_distance_km: 35,
  parcel_pricing_fuel_surcharge_percent: 3,
  parcel_pricing_night_surcharge_percent: 15,
  parcel_pricing_weekend_surcharge_percent: 5,
  parcel_pricing_waiting_fee_per_minute: 100,
  parcel_pricing_free_waiting_minutes: 5,
  parcel_pricing_max_driver_adjustment_percent: 20,
  parcel_delivery_platform_commission_percent: 15,
  parcel_pricing_enable_surge: true,
  parcel_pricing_enable_landmark: true,
  parcel_pricing_enable_gps: true,
  parcel_pricing_enable_commune: true,
  parcel_pricing_enable_location_resolver: true,
  parcel_pricing_enable_zone_matrix: true
};

export const seedGeneratedBrazzavillePricingData = async ({ actorId = null } = {}) => {
  const city = await City.findOneAndUpdate(
    { name: 'Brazzaville' },
    {
      $set: {
        isActive: true,
        isDefault: true,
        order: 1,
        deliveryAvailable: true,
        latitude: -4.2634,
        longitude: 15.2429,
        updatedBy: actorId
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const zoneEntries = await Promise.all(
    ZONES.map((zone) =>
      DeliveryZone.findOneAndUpdate(
        { name: zone.name },
        { $set: { color: zone.color, order: zone.order, isActive: true, updatedBy: actorId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    )
  );
  const zoneByKey = new Map(ZONES.map((zone, index) => [zone.key, zoneEntries[index]]));

  const communeEntries = [];
  for (const item of COMMUNES) {
    const commune = await Commune.findOneAndUpdate(
      { cityId: city._id, name: item.name },
      {
        $set: {
          isActive: true,
          deliveryPolicy: 'DEFAULT_RULE',
          fixedFee: 0,
          order: item.order,
          latitude: item.latitude,
          longitude: item.longitude,
          zoneId: zoneByKey.get(item.zone)._id,
          updatedBy: actorId
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    communeEntries.push(commune);
  }
  const communeByName = new Map(communeEntries.map((commune) => [commune.name, commune]));

  const zonePriceWrites = [];
  for (const [fromKey, destinations] of Object.entries(ZONE_PRICES)) {
    for (const [toKey, price] of Object.entries(destinations)) {
      zonePriceWrites.push(
        DeliveryZonePrice.findOneAndUpdate(
          { fromZoneId: zoneByKey.get(fromKey)._id, toZoneId: zoneByKey.get(toKey)._id },
          { $set: { price, isActive: true, updatedBy: actorId } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        )
      );
    }
  }
  await Promise.all(zonePriceWrites);

  await Promise.all(
    LANDMARKS.map((item) => {
      const commune = communeByName.get(item.commune);
      return Landmark.findOneAndUpdate(
        { cityId: city._id, name: item.name },
        {
          $set: {
            communeId: commune._id,
            latitude: Number(commune.latitude) + item.offset[0],
            longitude: Number(commune.longitude) + item.offset[1],
            aliases: item.aliases,
            description: GENERATED_DESCRIPTION,
            status: 'ACTIVE',
            updatedBy: actorId
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    })
  );

  await Promise.all(
    PACKAGE_TYPES.map((item) =>
      PackageType.findOneAndUpdate(
        { name: item.name },
        { $set: { ...item, isActive: true, updatedBy: actorId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    )
  );

  await Promise.all(
    WEIGHT_RULES.map((item) =>
      WeightRule.findOneAndUpdate(
        { minKg: item.minKg, maxKg: item.maxKg },
        { $set: { ...item, isActive: true, updatedBy: actorId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    )
  );

  await Promise.all(
    SPEED_RULES.map((item) =>
      DeliverySpeedRule.findOneAndUpdate(
        { key: item.key },
        { $set: { ...item, isActive: true, updatedBy: actorId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    )
  );

  await Promise.all(
    PEAK_RULES.map((item) =>
      PeakHourRule.findOneAndUpdate(
        { name: item.name },
        { $set: { ...item, isActive: true, updatedBy: actorId } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
    )
  );

  await DeliveryPromotion.findOneAndUpdate(
    { code: 'BIENVENUE10' },
    {
      $set: {
        discountType: 'PERCENT',
        discountValue: 10,
        zoneRestrictionId: null,
        maxUses: 500,
        expiresAt: null,
        isActive: true,
        updatedBy: actorId
      },
      $setOnInsert: { usedCount: 0 }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  for (const [key, value] of Object.entries(RUNTIME_SETTINGS)) {
    await setRuntimeConfig(key, value, {
      updatedBy: actorId,
      description: 'Configuration de démonstration générée pour le module livraison.'
    });
  }

  const context = await refreshPricingContext({
    source: 'GENERATED_DEMO',
    createdBy: actorId
  });

  return {
    generated: true,
    warning: 'Coordonnées et tarifs de démonstration à valider avant mise en production.',
    pricingVersion: context.pricingVersion,
    counts: {
      cities: 1,
      communes: COMMUNES.length,
      zones: ZONES.length,
      zonePrices: zonePriceWrites.length,
      landmarks: LANDMARKS.length,
      packageTypes: PACKAGE_TYPES.length,
      weightRules: WEIGHT_RULES.length,
      speedRules: SPEED_RULES.length,
      peakHourRules: PEAK_RULES.length,
      promotions: 1
    }
  };
};

export default seedGeneratedBrazzavillePricingData;
