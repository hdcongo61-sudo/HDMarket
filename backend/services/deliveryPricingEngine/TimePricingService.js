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

export const computeTimeContributions = async ({ at = new Date() } = {}) => {
  const settings = await getManyRuntimeConfigs([
    'parcel_pricing_fuel_surcharge_percent',
    'parcel_pricing_night_surcharge_percent',
    'parcel_pricing_weekend_surcharge_percent',
    'parcel_pricing_holiday_surcharge_percent',
    'parcel_pricing_holiday_active',
    'parcel_pricing_rain_surcharge_percent',
    'parcel_pricing_rain_active',
    'parcel_pricing_enable_surge'
  ]);

  const contributions = [];

  const fuelPercent = Number(settings.parcel_pricing_fuel_surcharge_percent || 0);
  if (fuelPercent > 0) contributions.push({ label: 'Carburant', percent: fuelPercent });

  if (isNight(at)) {
    const nightPercent = Number(settings.parcel_pricing_night_surcharge_percent || 0);
    if (nightPercent > 0) contributions.push({ label: 'Nuit', percent: nightPercent });
  }

  if (isWeekend(at)) {
    const weekendPercent = Number(settings.parcel_pricing_weekend_surcharge_percent || 0);
    if (weekendPercent > 0) contributions.push({ label: 'Week-end', percent: weekendPercent });
  }

  if (settings.parcel_pricing_holiday_active) {
    const holidayPercent = Number(settings.parcel_pricing_holiday_surcharge_percent || 0);
    if (holidayPercent > 0) contributions.push({ label: 'Jour férié', percent: holidayPercent });
  }

  if (settings.parcel_pricing_rain_active) {
    const rainPercent = Number(settings.parcel_pricing_rain_surcharge_percent || 0);
    if (rainPercent > 0) contributions.push({ label: 'Intempéries', percent: rainPercent });
  }

  if (settings.parcel_pricing_enable_surge) {
    const rules = await PeakHourRule.find({ isActive: true }).lean();
    rules.forEach((rule) => {
      if (!matchesPeakHourRule(rule, at)) return;
      if (rule.surchargeType === 'PERCENT') {
        if (Number(rule.surchargeValue || 0) > 0) {
          contributions.push({ label: rule.name, percent: Number(rule.surchargeValue) });
        }
      } else if (Number(rule.surchargeValue || 0) > 0) {
        contributions.push({ label: rule.name, fixed: Number(rule.surchargeValue) });
      }
    });
  }

  return contributions;
};

/** Applies a list of {label, percent?, fixed?} contributions against a base subtotal. */
export const applyTimeContributions = (contributions, subtotal) =>
  contributions.map((contribution) => ({
    label: contribution.label,
    amount: contribution.fixed != null
      ? Number(contribution.fixed)
      : Math.round((subtotal * Number(contribution.percent || 0)) / 100)
  }));
