import { describe, expect, it } from 'vitest';
import { detectOffPlatformPaymentRisk } from './chatSafety.js';

describe('off-platform payment scam detection', () => {
  it('flags a payment request paired with a phone number', () => {
    expect(detectOffPlatformPaymentRisk('Envoyez-moi directement sur Mobile Money au 06 123 45 67')).toBe(true);
    expect(detectOffPlatformPaymentRisk('Payez directement hors plateforme, contactez le +242 06 123 45 67')).toBe(true);
    expect(detectOffPlatformPaymentRisk('vire moi la somme au 242061234567 via airtel money')).toBe(true);
  });

  it('does not flag an ordinary message that only shares a phone number', () => {
    expect(detectOffPlatformPaymentRisk('Vous pouvez me joindre au 06 123 45 67 pour la livraison')).toBe(false);
  });

  it('does not flag payment language with no phone number present', () => {
    expect(detectOffPlatformPaymentRisk('Le paiement direct est possible en boutique')).toBe(false);
  });

  it('handles empty or missing input safely', () => {
    expect(detectOffPlatformPaymentRisk('')).toBe(false);
    expect(detectOffPlatformPaymentRisk(undefined)).toBe(false);
    expect(detectOffPlatformPaymentRisk(null)).toBe(false);
  });
});
