import { describe, expect, it } from 'vitest';
import { detectIntent, INTENTS } from './intentDetectorService.js';

describe('intentDetectorService', () => {
  it('exposes exactly the intents the spec requires', () => {
    expect(INTENTS).toEqual([
      'PRICE',
      'AVAILABILITY',
      'DELIVERY',
      'ORDER',
      'PRODUCT_INFO',
      'SHOP_INFO',
      'WHOLESALE',
      'INSTALLMENT',
      'GREETING',
      'UNKNOWN'
    ]);
  });

  it.each([
    ['prix HD-8F42K', 'PRICE'],
    ['combien HD-8F42K', 'PRICE'],
    ['available HD-8F42K', 'AVAILABILITY'],
    ['vous livrez HD-8F42K ?', 'DELIVERY'],
    ['je veux acheter HD-8F42K', 'ORDER'],
    ['vente en gros HD-8F42K', 'WHOLESALE'],
    ['paiement par tranche HD-8F42K', 'INSTALLMENT'],
    ['Bonjour', 'GREETING'],
    ['xyz totally unrelated text', 'UNKNOWN']
  ])('detects %s as %s', (text, expected) => {
    expect(detectIntent({ text }).intent).toBe(expected);
  });

  it('is case-insensitive and accent-insensitive', () => {
    expect(detectIntent({ text: 'COMBIEN ça coûte' }).intent).toBe('PRICE');
    expect(detectIntent({ text: 'Coûte combien HD-1' }).intent).toBe('PRICE');
  });

  it('prioritizes more specific intents over generic PRICE when both keywords appear', () => {
    expect(detectIntent({ text: 'prix en gros HD-8F42K' }).intent).toBe('WHOLESALE');
  });

  it('returns UNKNOWN for empty/whitespace text', () => {
    expect(detectIntent({ text: '' }).intent).toBe('UNKNOWN');
    expect(detectIntent({ text: '   ' }).intent).toBe('UNKNOWN');
    expect(detectIntent({}).intent).toBe('UNKNOWN');
  });
});
