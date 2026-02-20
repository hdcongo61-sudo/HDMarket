export const formatPriceWithCurrency = (
  value,
  currency = {
    code: 'XAF',
    symbol: 'FCFA',
    decimals: 0,
    exchangeRateToDefault: 1,
    formatting: { symbolPosition: 'suffix', thousandSeparator: ' ', decimalSeparator: ',' }
  },
  fallbackCurrency = null
) => {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const activeCurrency = currency || fallbackCurrency;
  const decimals = Math.max(0, Number(activeCurrency?.decimals ?? 0));
  const rate = Number(activeCurrency?.exchangeRateToDefault ?? 1) || 1;
  const converted = safeAmount * rate;

  const formatting = activeCurrency?.formatting || {};
  const thousandSeparator = formatting.thousandSeparator || ' ';
  const decimalSeparator = formatting.decimalSeparator || ',';
  const symbolPosition = formatting.symbolPosition === 'prefix' ? 'prefix' : 'suffix';
  const symbol = activeCurrency?.symbol || activeCurrency?.code || 'FCFA';

  const fixed = converted.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split('.');
  const withThousand = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  const numericPart =
    decimals > 0 ? `${withThousand}${decimalSeparator}${decimalPart || ''.padEnd(decimals, '0')}` : withThousand;

  return symbolPosition === 'prefix' ? `${symbol} ${numericPart}` : `${numericPart} ${symbol}`;
};

const readStoredValue = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const getStoredCurrencySettings = () => {
  const payload = readStoredValue('hd_public_currency_settings') || {};
  const currencies = Array.isArray(payload.currencies) ? payload.currencies : [];
  const defaultCurrency = payload.defaultCurrency || currencies.find((item) => item?.isDefault) || null;
  const preferredCode = String(readStoredValue('hd_pref_currency') || '').toUpperCase();
  const selected =
    currencies.find((item) => String(item?.code || '').toUpperCase() === preferredCode) ||
    defaultCurrency ||
    null;
  return { selected, defaultCurrency };
};

export const formatPriceWithStoredSettings = (value) => {
  const { selected, defaultCurrency } = getStoredCurrencySettings();
  return formatPriceWithCurrency(value, selected || defaultCurrency || undefined, defaultCurrency || null);
};
