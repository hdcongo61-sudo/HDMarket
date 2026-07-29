/**
 * Time-based surcharges — two layers that stack:
 *   1) Blanket global toggles (fuel/night/weekend/holiday/rain %, admin sets
 *      once and it just applies — simple, no schedule to manage).
 *   2) Named PeakHourRule windows (e.g. "Morning Rush 07:00-09:00") for
 *      finer-grained, multiple-window control.
 * Every surcharge is computed against the same pre-surcharge subtotal (not
 * compounded) so each can be shown as its own breakdown line without the
 * math becoming opaque to the customer.
 */
import PeakHourRule from '../../models/peakHourRuleModel.js';
import RuleEngine from '../../modules/delivery/rules/RuleEngine.js';
import { getManyRuntimeConfigs } from '../configService.js';

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 5;

const isNight = (date) => {
  const hour = date.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
};

const isWeekend = (date) => [0, 6].includes(date.getDay());

const timeToMinutes = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const matchesPeakHourRule = (rule, date) => {
  if (!rule.daysOfWeek?.includes(date.getDay())) return false;
  const startMinutes = timeToMinutes(rule.startTime);
  const endMinutes = timeToMinutes(rule.endTime);
  if (startMinutes === null || endMinutes === null) return true; // all-day rule
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  if (startMinutes <= endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes; // window crosses midnight
};

export const computeTimeContributions = async ({ at = new Date(), pricingContext = null } = {}) => {
  const settings = pricingContext?.settings || await getManyRuntimeConfigs([
      'parcel_pricing_fuel_surcharge_percent',
      'parcel_pricing_night_surcharge_percent',
      'parcel_pricing_weekend_surcharge_percent',
      'parcel_pricing_holiday_surcharge_percent',
      'parcel_pricing_holiday_active',
      'parcel_pricing_rain_surcharge_percent',
      'parcel_pricing_rain_active',
      'parcel_pricing_enable_surge'
    ]);

  const fuelPercent = Number(settings.parcel_pricing_fuel_surcharge_percent || 0);
  const nightPercent = Number(settings.parcel_pricing_night_surcharge_percent || 0);
  const weekendPercent = Number(settings.parcel_pricing_weekend_surcharge_percent || 0);
  const holidayPercent = Number(settings.parcel_pricing_holiday_surcharge_percent || 0);
  const rainPercent = Number(settings.parcel_pricing_rain_surcharge_percent || 0);
  const rules = [
    { contribution: { label: 'Carburant', percent: fuelPercent } },
    { matches: ({ date }) => isNight(date), contribution: { label: 'Nuit', percent: nightPercent } },
    { matches: ({ date }) => isWeekend(date), contribution: { label: 'Week-end', percent: weekendPercent } },
    {
      enabled: Boolean(settings.parcel_pricing_holiday_active),
      contribution: { label: 'Jour férié', percent: holidayPercent }
    },
    {
      enabled: Boolean(settings.parcel_pricing_rain_active),
      contribution: { label: 'Intempéries', percent: rainPercent }
    }
  ];

  if (settings.parcel_pricing_enable_surge) {
    const peakRules = pricingContext?.peakHourRules || await PeakHourRule.find({ isActive: true }).lean();
    peakRules.forEach((rule) => {
      rules.push({
        matches: ({ date }) => matchesPeakHourRule(rule, date),
        contribution:
          rule.surchargeType === 'PERCENT'
            ? { label: rule.name, percent: Number(rule.surchargeValue || 0) }
            : { label: rule.name, fixed: Number(rule.surchargeValue || 0) }
      });
    });
  }

  return new RuleEngine(rules).evaluate({ date: at, settings });
};

/** Applies a list of {label, percent?, fixed?} contributions against a base subtotal. */
export const applyTimeContributions = (contributions, subtotal) =>
  contributions.map((contribution) => ({
    label: contribution.label,
    amount: contribution.fixed != null
      ? Number(contribution.fixed)
      : Math.round((subtotal * Number(contribution.percent || 0)) / 100)
  }));
