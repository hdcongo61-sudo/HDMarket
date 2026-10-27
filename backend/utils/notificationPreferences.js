const ALIASES = Object.freeze({
  order_placed: ['order_created'],
  order_accepted: ['order_created'],
  order_rejected: ['order_cancelled'],
  order_completed: ['order_delivered'],
  product_approved: ['product_approval'],
  product_rejected: ['product_rejection'],
  payment_validated: ['payment_pending'],
  payment_proof_submitted: ['payment_pending'],
  delivery_assigned: ['delivery_request_assigned'],
  delivery_in_progress: ['delivery_request_in_progress'],
  delivery_completed: ['delivery_request_delivered'],
  order_delivery_fee_updated: ['order_address_updated']
});

export const userAllowsNotificationType = (user, type) => {
  const prefs = user?.notificationPreferences || {};
  const aliases = ALIASES[type] || [];
  if (aliases.some(key => prefs[key] === false)) return false;
  if (typeof prefs[type] === 'boolean') return prefs[type];
  for (const key of aliases) {
    if (typeof prefs[key] === 'boolean') return prefs[key];
  }
  return true;
};

export const shouldRespectUserPreference = ({ actionRequired = false, audience = 'USER' } = {}) =>
  !actionRequired && String(audience || 'USER').trim().toUpperCase() === 'USER';
