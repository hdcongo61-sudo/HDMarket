import { describe, expect, it } from 'vitest';
import { createPawaPayError, getPawaPayFailurePresentation } from './pawapayErrors.js';

describe('PawaPay failure presentation', () => {
  it('gives an actionable balance message', () => {
    expect(
      getPawaPayFailurePresentation({ failureCode: 'INSUFFICIENT_BALANCE' })
    ).toEqual({
      providerCode: 'INSUFFICIENT_BALANCE',
      message: 'Le solde de votre compte Mobile Money est insuffisant.',
      action: 'TOP_UP_MOBILE_MONEY',
      retryable: false
    });
  });

  it('does not use an unknown provider message as the customer message', () => {
    const error = createPawaPayError({
      failure: {
        failureCode: 'NEW_PRIVATE_PROVIDER_ERROR',
        failureMessage: 'Sensitive internal provider data'
      },
      status: 400
    });

    expect(error.message).not.toContain('Sensitive');
    expect(error.details).toMatchObject({
      providerCode: 'NEW_PRIVATE_PROVIDER_ERROR',
      retryable: true,
      action: 'RETRY'
    });
  });
});
