import { describe, it, expect } from 'vitest';
import { formatPriceWithCurrency } from './priceFormatter';

const XAF = {
  code: 'XAF',
  symbol: 'FCFA',
  decimals: 0,
  exchangeRateToDefault: 1,
  formatting: { symbolPosition: 'suffix', thousandSeparator: ' ', decimalSeparator: ',' }
};

describe('formatPriceWithCurrency', () => {
  it('formats numbers with the configured symbol', () => {
    expect(formatPriceWithCurrency(420000, XAF)).toBe('420 000 FCFA');
    expect(formatPriceWithCurrency(0, XAF)).toBe('0 FCFA');
  });

  it('falls back to FCFA when symbol/code are not strings (never renders [object Object])', () => {
    const corrupted = {
      code: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA', decimals: 0 },
      symbol: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA', decimals: 0 },
      name: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA', decimals: 0 },
      decimals: 0,
      isDefault: true,
      isActive: true,
      exchangeRateToDefault: 1
    };
    expect(formatPriceWithCurrency(420000, corrupted)).toBe('420 000 FCFA');
    expect(formatPriceWithCurrency(0, corrupted)).toBe('0 FCFA');
  });

  it('recovers values from a leaked Mongoose subdocument (_doc)', () => {
    const leaked = {
      $__parent: {},
      $__: {},
      $isNew: false,
      _doc: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA', decimals: 0 },
      isDefault: true,
      isActive: true,
      exchangeRateToDefault: 1,
      formatting: { symbolPosition: 'suffix', thousandSeparator: ' ', decimalSeparator: ',' }
    };
    expect(formatPriceWithCurrency(420000, leaked)).toBe('420 000 FCFA');
  });

  it('survives a missing currency entirely', () => {
    expect(formatPriceWithCurrency(1234, null, null)).toBe('1 234 FCFA');
  });

  it('supports prefix positioning and decimals', () => {
    const usd = {
      code: 'USD',
      symbol: '$',
      decimals: 2,
      exchangeRateToDefault: 1,
      formatting: { symbolPosition: 'prefix', thousandSeparator: ',', decimalSeparator: '.' }
    };
    expect(formatPriceWithCurrency(1234.5, usd)).toBe('$ 1,234.50');
  });
});
