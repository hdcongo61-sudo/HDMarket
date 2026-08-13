import { describe, expect, it } from 'vitest';
import { getQuotationStatus, quotationSavings } from './quotationUtils';

describe('quotation presentation helpers', () => {
  it('calculates savings without ever returning a negative amount', () => {
    expect(quotationSavings({ originalSubtotal: 50000, quotedSubtotal: 42000 })).toBe(8000);
    expect(quotationSavings({ originalSubtotal: 50000, quotedSubtotal: 52000 })).toBe(0);
  });

  it('exposes every terminal status used by the quotation workflow', () => {
    expect(getQuotationStatus('EXPIRED').label).toBe('Expiré');
    expect(getQuotationStatus('ORDER_CREATED').label).toBe('Commande créée');
  });
});
