import { useMemo } from 'react';
import { useAppSettings } from '../context/AppSettingsContext';

const DEFAULT_COMMISSION_RATE = 3;

const resolveCommissionRateValue = (values = []) => {
  for (const candidate of values) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_COMMISSION_RATE;
};

const formatCommissionRateLabel = (value) => {
  const rounded = Number(Number(value || 0).toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, '');
};

export default function useCommissionRate() {
  const { runtime, app, getRuntimeValue } = useAppSettings();

  const commissionRatePercent = useMemo(
    () =>
      resolveCommissionRateValue([
        getRuntimeValue?.('commission_rate'),
        getRuntimeValue?.('commissionRate'),
        runtime?.commission_rate,
        runtime?.commissionRate,
        app?.commissionRate,
        DEFAULT_COMMISSION_RATE
      ]),
    [app?.commissionRate, getRuntimeValue, runtime?.commissionRate, runtime?.commission_rate]
  );

  const commissionRateLabel = useMemo(
    () => formatCommissionRateLabel(commissionRatePercent),
    [commissionRatePercent]
  );

  return {
    commissionRatePercent,
    commissionRateLabel
  };
}
