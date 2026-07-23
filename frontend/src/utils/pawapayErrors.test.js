import { describe, expect, it } from 'vitest';
import { getPawaPayFailure, getPawaPayRequestError } from './pawapayErrors';

describe('PawaPay customer errors', () => {
  it('uses the safe recovery information returned by the API', () => {
    const error = {
      response: {
        data: {
          code: 'PAWAPAY_INSUFFICIENT_BALANCE',
          message: 'Le solde de votre compte Mobile Money est insuffisant.',
          details: {
            providerCode: 'INSUFFICIENT_BALANCE',
            retryable: false,
            action: 'TOP_UP_MOBILE_MONEY'
          }
        }
      }
    };

    expect(getPawaPayRequestError(error)).toMatchObject({
      code: 'PAWAPAY_INSUFFICIENT_BALANCE',
      retryable: false,
      action: 'TOP_UP_MOBILE_MONEY'
    });
  });

  it('treats a lost browser connection as retryable', () => {
    expect(getPawaPayRequestError(new Error('Network Error'))).toMatchObject({
      code: 'PAWAPAY_NETWORK_ERROR',
      retryable: true,
      action: 'RETRY'
    });
  });

  it('shows the translated failure returned with a completed callback', () => {
    expect(
      getPawaPayFailure({
        providerCode: 'PAYMENT_NOT_APPROVED',
        message: 'Le paiement n’a pas été autorisé sur votre téléphone.',
        action: 'RETRY',
        retryable: true
      })
    ).toMatchObject({ action: 'RETRY', retryable: true });
  });
});
