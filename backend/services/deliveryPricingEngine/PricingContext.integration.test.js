import { describe, expect, it } from 'vitest';
import { computePackageContribution } from './PackagePricingService.js';
import { resolveLocationCoordinates } from './LocationResolverService.js';
import { resolvePromotion, computePromotionDiscount } from './PromotionService.js';
import { computeTimeContributions, applyTimeContributions } from './TimePricingService.js';
import { computeWeightContribution } from './WeightPricingService.js';
import { resolveZoneBasePrice } from './ZonePricingService.js';

const pricingContext = {
  settings: {
    parcel_pricing_fuel_surcharge_percent: 3,
    parcel_pricing_night_surcharge_percent: 15,
    parcel_pricing_weekend_surcharge_percent: 5,
    parcel_pricing_holiday_surcharge_percent: 0,
    parcel_pricing_holiday_active: false,
    parcel_pricing_rain_surcharge_percent: 0,
    parcel_pricing_rain_active: false,
    parcel_pricing_enable_surge: true
  },
  communes: [
    { _id: 'commune-centre', cityId: 'city-1', zoneId: 'zone-centre', latitude: -4.26, longitude: 15.28 },
    { _id: 'commune-sud', cityId: 'city-1', zoneId: 'zone-sud', latitude: -4.28, longitude: 15.25 }
  ],
  cities: [{ _id: 'city-1', latitude: -4.2634, longitude: 15.2429 }],
  landmarks: [
    {
      _id: 'landmark-1',
      cityId: 'city-1',
      communeId: 'commune-centre',
      name: 'Rond-point Test',
      aliases: ['rp test'],
      latitude: -4.251,
      longitude: 15.281
    }
  ],
  zonePrices: [
    { fromZoneId: 'zone-centre', toZoneId: 'zone-sud', price: 2200 }
  ],
  packageTypes: [
    { _id: 'fragile', name: 'Fragile', extraPrice: 700 }
  ],
  weightRules: [
    { minKg: 0, maxKg: 1, mode: 'FIXED_EXTRA', fixedExtra: 0, multiplier: 1 },
    { minKg: 1.01, maxKg: 5, mode: 'FIXED_EXTRA', fixedExtra: 500, multiplier: 1 }
  ],
  peakHourRules: [
    {
      name: 'Pointe du matin',
      daysOfWeek: [1],
      startTime: '07:00',
      endTime: '09:00',
      surchargeType: 'PERCENT',
      surchargeValue: 10
    }
  ],
  promotions: [
    {
      _id: 'promo-1',
      code: 'BIENVENUE10',
      discountType: 'PERCENT',
      discountValue: 10,
      usedCount: 0,
      maxUses: 100,
      isActive: true
    }
  ]
};

describe('delivery pricing context integration', () => {
  it('resolves zone, package, and weight rules without database calls', async () => {
    const [zone, parcel, weight] = await Promise.all([
      resolveZoneBasePrice({
        pickupCommuneId: 'commune-centre',
        dropoffCommuneId: 'commune-sud',
        pricingContext
      }),
      computePackageContribution('fragile', pricingContext),
      computeWeightContribution(2.5, pricingContext)
    ]);

    expect(zone.price).toBe(2200);
    expect(parcel.amount).toBe(700);
    expect(weight.fixedExtra).toBe(500);
  });

  it('applies cached time rules and promotions deterministically', async () => {
    const mondayMorning = new Date('2026-07-27T07:30:00.000Z');
    const timeRules = await computeTimeContributions({
      at: mondayMorning,
      pricingContext
    });
    const lines = applyTimeContributions(timeRules, 2000);
    const promotion = await resolvePromotion({
      code: 'bienvenue10',
      pricingContext
    });
    const discount = computePromotionDiscount(promotion, 2000);

    expect(lines).toEqual(
      expect.arrayContaining([
        { label: 'Carburant', amount: 60 },
        { label: 'Pointe du matin', amount: 200 }
      ])
    );
    expect(discount.amount).toBe(-200);
  });

  it('resolves locations through the provider abstraction using cached local data', async () => {
    const resolved = await resolveLocationCoordinates(
      {
        cityId: 'city-1',
        communeId: 'commune-centre',
        address: 'Près du rond-point test'
      },
      { enableLandmark: true, enableCommune: true },
      pricingContext
    );

    expect(resolved.resolvedFrom).toBe('LANDMARK');
    expect(resolved.provider).toBe('LOCAL');
    expect(resolved.coordinates).toEqual({ lng: 15.281, lat: -4.251 });
  });
});
