const ACTION_HINTS = {
  CHANGE_PHONE: 'Vérifiez le numéro Mobile Money puis réessayez.',
  CHANGE_AMOUNT: 'Modifiez le montant puis réessayez.',
  CHOOSE_OTHER_METHOD: 'Essayez un autre opérateur ou un autre moyen de paiement.',
  TOP_UP_MOBILE_MONEY: 'Rechargez votre compte Mobile Money avant de réessayer.',
  WAIT: 'Attendez quelques minutes avant une nouvelle tentative.',
  CHECK_STATUS: 'Ne relancez pas immédiatement le paiement : vérifiez d’abord son statut.',
  CONTACT_SUPPORT: 'Si le problème continue, contactez l’assistance HDMarket.',
  CHECK_DETAILS: 'Vérifiez les informations saisies puis réessayez.',
  RETRY: 'Vous pouvez réessayer sans modifier votre commande.'
};

const normalizePresentation = (value, fallbackMessage) => {
  const details = value?.details || value || {};
  const action = String(details.action || 'RETRY');
  return {
    message: String(value?.message || details.message || fallbackMessage),
    code: String(value?.code || details.providerCode || 'PAWAPAY_ERROR'),
    providerCode: String(details.providerCode || ''),
    action,
    retryable: Boolean(details.retryable),
    hint: ACTION_HINTS[action] || ''
  };
};

export const getPawaPayRequestError = (
  error,
  fallbackMessage = 'Impossible de contacter PawaPay pour le moment.'
) => {
  if (!error?.response) {
    return {
      message: 'La connexion réseau a été interrompue. Vérifiez votre connexion puis réessayez.',
      code: 'PAWAPAY_NETWORK_ERROR',
      providerCode: '',
      action: 'RETRY',
      retryable: true,
      hint: ACTION_HINTS.RETRY
    };
  }
  return normalizePresentation(error.response.data, fallbackMessage);
};

export const getPawaPayFailure = (
  failure,
  fallbackMessage = 'Le paiement n’a pas pu être finalisé.'
) => normalizePresentation(failure, fallbackMessage);

export default getPawaPayRequestError;
