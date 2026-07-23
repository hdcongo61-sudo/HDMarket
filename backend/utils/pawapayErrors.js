const FAILURE_PRESENTATIONS = {
  NO_AUTHENTICATION: {
    message: 'Le paiement mobile est temporairement indisponible.',
    action: 'CONTACT_SUPPORT'
  },
  AUTHENTICATION_ERROR: {
    message: 'Le paiement mobile est temporairement indisponible.',
    action: 'CONTACT_SUPPORT'
  },
  AUTHORISATION_ERROR: {
    message: 'Le paiement mobile est temporairement indisponible.',
    action: 'CONTACT_SUPPORT'
  },
  HTTP_SIGNATURE_ERROR: {
    message: 'Le paiement mobile est temporairement indisponible.',
    action: 'CONTACT_SUPPORT'
  },
  INVALID_INPUT: {
    message: 'Les informations de paiement n’ont pas pu être validées.',
    action: 'CHECK_DETAILS'
  },
  MISSING_PARAMETER: {
    message: 'Certaines informations de paiement sont manquantes.',
    action: 'CHECK_DETAILS'
  },
  UNSUPPORTED_PARAMETER: {
    message: 'Une information de paiement n’est pas prise en charge.',
    action: 'CHECK_DETAILS'
  },
  INVALID_PARAMETER: {
    message: 'Une information de paiement est invalide.',
    action: 'CHECK_DETAILS'
  },
  DUPLICATE_METADATA_FIELD: {
    message: 'La demande de paiement contient une information en double.',
    action: 'CHECK_DETAILS'
  },
  INVALID_PHONE_NUMBER: {
    message: 'Le numéro Mobile Money est invalide. Vérifiez le pays et le numéro.',
    action: 'CHANGE_PHONE'
  },
  PAYER_NOT_FOUND: {
    message: 'Ce numéro ne correspond pas à un compte Mobile Money actif.',
    action: 'CHANGE_PHONE'
  },
  RECIPIENT_NOT_FOUND: {
    message: 'Le bénéficiaire ne correspond pas à un compte Mobile Money actif.',
    action: 'CHANGE_PHONE'
  },
  AMOUNT_OUT_OF_BOUNDS: {
    message: 'Ce montant dépasse les limites autorisées par l’opérateur Mobile Money.',
    action: 'CHANGE_AMOUNT'
  },
  INVALID_AMOUNT: {
    message: 'Le montant n’est pas accepté par l’opérateur Mobile Money.',
    action: 'CHANGE_AMOUNT'
  },
  INVALID_CURRENCY: {
    message: 'Cette devise n’est pas disponible pour ce paiement.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  INVALID_PROVIDER: {
    message: 'Cet opérateur Mobile Money n’est pas disponible.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  DEPOSITS_NOT_ALLOWED: {
    message: 'Les paiements ne sont pas disponibles avec cet opérateur.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  PAYOUTS_NOT_ALLOWED: {
    message: 'Les transferts ne sont pas disponibles avec cet opérateur.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  REFUNDS_NOT_ALLOWED: {
    message: 'Les remboursements ne sont pas disponibles avec cet opérateur.',
    action: 'CONTACT_SUPPORT'
  },
  PROVIDER_TEMPORARILY_UNAVAILABLE: {
    message: 'L’opérateur Mobile Money est momentanément indisponible. Réessayez dans quelques minutes.',
    action: 'RETRY',
    retryable: true
  },
  PAYMENT_NOT_APPROVED: {
    message: 'Le paiement n’a pas été autorisé sur votre téléphone. Vous pouvez réessayer.',
    action: 'RETRY',
    retryable: true
  },
  INSUFFICIENT_BALANCE: {
    message: 'Le solde de votre compte Mobile Money est insuffisant.',
    action: 'TOP_UP_MOBILE_MONEY'
  },
  PAYMENT_IN_PROGRESS: {
    message: 'Une opération Mobile Money est déjà en cours. Attendez quelques minutes avant de réessayer.',
    action: 'WAIT',
    retryable: true
  },
  WALLET_LIMIT_REACHED: {
    message: 'La limite de votre compte Mobile Money a été atteinte.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  PAYER_LIMIT_REACHED: {
    message: 'La limite de votre compte Mobile Money a été atteinte.',
    action: 'CHOOSE_OTHER_METHOD'
  },
  PAWAPAY_WALLET_OUT_OF_FUNDS: {
    message: 'Ce transfert ne peut pas être exécuté pour le moment.',
    action: 'CONTACT_SUPPORT'
  },
  DEPOSIT_ALREADY_REFUNDED: {
    message: 'Ce paiement a déjà été entièrement remboursé.',
    action: 'CONTACT_SUPPORT'
  },
  AMOUNT_TOO_LARGE: {
    message: 'Le montant demandé est supérieur au montant remboursable.',
    action: 'CHANGE_AMOUNT'
  },
  REFUND_IN_PROGRESS: {
    message: 'Un remboursement est déjà en cours pour ce paiement.',
    action: 'WAIT',
    retryable: true
  },
  MANUALLY_CANCELLED: {
    message: 'Cette opération a été annulée.',
    action: 'CONTACT_SUPPORT'
  },
  UNKNOWN_ERROR: {
    message: 'PawaPay n’a pas encore pu confirmer l’opération. Vérifiez son statut avant de recommencer.',
    action: 'CHECK_STATUS',
    retryable: true
  },
  UNSPECIFIED_FAILURE: {
    message: 'L’opérateur n’a pas pu finaliser le paiement. Vous pouvez réessayer.',
    action: 'RETRY',
    retryable: true
  },
  AMOUNT_MISMATCH: {
    message: 'Le montant confirmé ne correspond pas au montant attendu. Contactez l’assistance.',
    action: 'CONTACT_SUPPORT'
  },
  CURRENCY_MISMATCH: {
    message: 'La devise confirmée ne correspond pas à la devise attendue. Contactez l’assistance.',
    action: 'CONTACT_SUPPORT'
  },
  CHECKOUT_REJECTED: {
    message: 'PawaPay n’a pas pu ouvrir la page de paiement.',
    action: 'RETRY',
    retryable: true
  }
};

const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

export const extractPawaPayFailure = (payload) => {
  const failure = payload?.failureReason || payload?.error || payload || {};
  const providerCode = normalizeCode(
    failure?.failureCode || failure?.code || payload?.failureCode || payload?.code
  );
  const providerMessage = String(
    failure?.failureMessage || failure?.message || payload?.failureMessage || payload?.message || ''
  ).slice(0, 500);
  return { providerCode, providerMessage };
};

export const getPawaPayFailurePresentation = (failure) => {
  const { providerCode } = extractPawaPayFailure(failure);
  const presentation = FAILURE_PRESENTATIONS[providerCode] || {
    message: 'Le paiement mobile n’a pas pu être finalisé. Réessayez ou choisissez un autre moyen de paiement.',
    action: 'RETRY',
    retryable: true
  };

  return {
    providerCode: providerCode || 'UNSPECIFIED_FAILURE',
    message: presentation.message,
    action: presentation.action,
    retryable: Boolean(presentation.retryable)
  };
};

export const createPawaPayError = ({
  failure,
  status = 502,
  code,
  message,
  retryable,
  action,
  meta
} = {}) => {
  const presentation = getPawaPayFailurePresentation(failure || { failureCode: code });
  const normalizedCode = normalizeCode(code || presentation.providerCode || 'REQUEST_FAILED');
  const error = new Error(message || presentation.message);
  error.status = status;
  error.code = normalizedCode.startsWith('PAWAPAY_') ? normalizedCode : `PAWAPAY_${normalizedCode}`;
  error.details = {
    providerCode: presentation.providerCode,
    retryable: retryable ?? presentation.retryable,
    action: action || presentation.action
  };
  if (meta) error.meta = meta;
  return error;
};

export default getPawaPayFailurePresentation;
