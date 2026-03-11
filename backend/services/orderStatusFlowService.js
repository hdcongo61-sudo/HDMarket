const CANCELLATION_WINDOW_MS = 30 * 60 * 1000;

const TERMINAL_STATUSES = new Set([
  'cancelled',
  'delivered',
  'completed',
  'confirmed_by_client',
  'picked_up_confirmed'
]);

const DELIVERED_LIKE_STATUSES = new Set([
  'delivery_proof_submitted',
  'delivered',
  'confirmed_by_client',
  'completed',
  'picked_up_confirmed'
]);

const SELLER_ALLOWED_STATUSES = new Set([
  'pending',
  'pending_payment',
  'paid',
  'confirmed',
  'ready_for_pickup',
  'picked_up_confirmed',
  'ready_for_delivery',
  'delivering',
  'out_for_delivery',
  'delivered',
  'cancelled'
]);

const SELLER_ALLOWED_INSTALLMENT_SALE_STATUSES = new Set([
  'confirmed',
  'delivering',
  'delivered',
  'cancelled'
]);

const toStatus = (value) => String(value || '').trim();

const pushAction = (actions, action) => {
  if (!action || !action.key) return;
  actions.push(action);
};

const buildAction = (key, nextStatus = null, meta = {}) => ({
  key,
  nextStatus: nextStatus ? String(nextStatus) : null,
  ...meta
});

export const isPickupOrder = (order = {}) =>
  String(order?.deliveryMode || '').toUpperCase() === 'PICKUP';

export const isPlatformDeliveryOrder = (order = {}) =>
  String(order?.platformDeliveryMode || '').toUpperCase() === 'PLATFORM_DELIVERY' ||
  Boolean(order?.platformDeliveryRequestId) ||
  ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED'].includes(
    String(order?.platformDeliveryStatus || '').toUpperCase()
  );

export const hasMinimumDeliveryProofImages = (order = {}, minCount = 1) =>
  Array.isArray(order?.deliveryProofImages) &&
  order.deliveryProofImages.length >= Math.max(1, Number(minCount) || 1);

export const hasValidDeliveryEvidence = (order = {}) =>
  hasMinimumDeliveryProofImages(order, 1) &&
  Boolean(String(order?.clientSignatureImage || '').trim()) &&
  Boolean(order?.deliveryDate);

export const hasAllInstallmentsSettled = (order = {}) => {
  const schedule = Array.isArray(order?.installmentPlan?.schedule) ? order.installmentPlan.schedule : [];
  if (!schedule.length) return false;
  return schedule.every((entry) => ['paid', 'waived'].includes(String(entry?.status || '')));
};

const isWithinCancellationWindow = (order = {}, now = new Date()) => {
  if (!order?.createdAt) return false;
  if (order?.cancellationWindowSkippedAt) return false;
  const status = toStatus(order.status);
  if (TERMINAL_STATUSES.has(status)) return false;
  const createdAt = new Date(order.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return now.getTime() - createdAt.getTime() <= CANCELLATION_WINDOW_MS;
};

export const getOrderAllowedActions = (order = {}, options = {}) => {
  const now = options.now instanceof Date ? options.now : new Date();
  const status = toStatus(order.status);
  const pickupOrder = isPickupOrder(order);
  const platformDeliveryOrder = isPlatformDeliveryOrder(order);
  const installmentOrder = toStatus(order.paymentType) === 'installment';
  const actions = {
    buyer: [],
    seller: [],
    admin: [],
    courier: []
  };

  const canCancelBuyer =
    !TERMINAL_STATUSES.has(status) &&
    !DELIVERED_LIKE_STATUSES.has(status) &&
    status !== 'dispute_opened' &&
    isWithinCancellationWindow(order, now);
  if (canCancelBuyer) {
    pushAction(actions.buyer, buildAction('cancel_order', 'cancelled'));
  }

  if (
    status === 'delivery_proof_submitted' &&
    hasValidDeliveryEvidence(order) &&
    !platformDeliveryOrder &&
    !pickupOrder
  ) {
    pushAction(actions.buyer, buildAction('confirm_delivery', 'completed'));
  }

  if (installmentOrder) {
    const allSettled = hasAllInstallmentsSettled(order);
    if (!allSettled || status !== 'completed') {
      if (status === 'pending_installment') {
        pushAction(actions.seller, buildAction('confirm_installment_sale', 'installment_active'));
      }
      pushAction(actions.seller, buildAction('wait_installment_settlement', null));
    } else {
      const saleStatus = toStatus(order.installmentSaleStatus || 'confirmed');
      if (!saleStatus || saleStatus === 'confirmed') {
        pushAction(actions.seller, buildAction('start_delivery', 'delivering'));
      } else if (saleStatus === 'delivering') {
        pushAction(actions.seller, buildAction('submit_delivery_proof', 'delivered'));
      }
    }
  } else if (pickupOrder) {
    if (['pending', 'pending_payment', 'paid'].includes(status)) {
      pushAction(actions.seller, buildAction('confirm_order', 'confirmed'));
    } else if (status === 'confirmed') {
      pushAction(actions.seller, buildAction('mark_ready_for_pickup', 'ready_for_pickup'));
    } else if (status === 'ready_for_pickup') {
      pushAction(actions.seller, buildAction('submit_pickup_proof', 'picked_up_confirmed'));
    }
  } else {
    if (['pending', 'pending_payment', 'paid'].includes(status)) {
      pushAction(actions.seller, buildAction('confirm_order', 'confirmed'));
    } else if (status === 'confirmed') {
      pushAction(actions.seller, buildAction('mark_ready_for_delivery', 'ready_for_delivery'));
    } else if (status === 'ready_for_delivery') {
      pushAction(actions.seller, buildAction('start_delivery', 'delivering'));
    } else if (status === 'delivering' || status === 'out_for_delivery') {
      pushAction(actions.seller, buildAction('submit_delivery_proof', 'delivery_proof_submitted'));
    } else if (status === 'delivery_proof_submitted') {
      pushAction(actions.seller, buildAction('wait_client_confirmation', null));
    }
  }

  if (!TERMINAL_STATUSES.has(status)) {
    pushAction(actions.admin, buildAction('review_order', null));
  }

  if (status === 'ready_for_delivery') {
    pushAction(actions.courier, buildAction('pickup_package', 'out_for_delivery'));
  } else if (status === 'out_for_delivery') {
    pushAction(actions.courier, buildAction('confirm_dropoff', 'delivered'));
  }

  return {
    allowedActions: actions,
    nextAction: {
      buyer: actions.buyer[0] || null,
      seller: actions.seller[0] || null,
      admin: actions.admin[0] || null,
      courier: actions.courier[0] || null
    }
  };
};

const throwTransitionError = (message, code = null, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  throw error;
};

export const assertSellerStatusTransition = ({ order, nextStatus }) => {
  const status = toStatus(nextStatus);
  const currentStatus = toStatus(order?.status);

  if (!status) {
    throwTransitionError('Statut invalide.');
  }

  if (toStatus(order?.paymentType) === 'installment') {
    if (currentStatus !== 'completed' || !hasAllInstallmentsSettled(order)) {
      throwTransitionError(
        'Le statut de vente de la commande tranche peut être mis à jour uniquement après paiement complet des tranches.'
      );
    }

    if (!SELLER_ALLOWED_INSTALLMENT_SALE_STATUSES.has(status)) {
      throwTransitionError('Statut de vente invalide pour une commande tranche complétée.');
    }

    const previousSaleStatus = toStatus(order?.installmentSaleStatus || 'confirmed');
    if (status === 'delivering' && previousSaleStatus !== 'confirmed') {
      throwTransitionError('La vente doit être confirmée avant de passer en livraison.');
    }
    if (status === 'delivered' && previousSaleStatus !== 'delivering') {
      throwTransitionError('La commande doit être en cours de livraison avant d’être marquée livrée.');
    }
    if (status === 'delivered' && !hasValidDeliveryEvidence(order)) {
      throwTransitionError('Preuve de livraison obligatoire avant le statut livré.');
    }
    if (status === 'cancelled' && previousSaleStatus === 'delivered') {
      throwTransitionError("Impossible d'annuler une commande déjà livrée.");
    }

    return { mode: 'installment_sale', previousSaleStatus };
  }

  if (!SELLER_ALLOWED_STATUSES.has(status)) {
    throwTransitionError('Statut invalide.');
  }

  if (status === 'delivery_proof_submitted' || status === 'confirmed_by_client') {
    throwTransitionError('Utilisez le workflow de preuve de livraison pour ce statut.');
  }

  if (
    isPickupOrder(order) &&
    [
      'ready_for_delivery',
      'delivering',
      'out_for_delivery',
      'delivery_proof_submitted',
      'delivered',
      'confirmed_by_client'
    ].includes(status)
  ) {
    throwTransitionError('Cette commande est en retrait boutique. Utilisez les statuts de retrait.');
  }

  if (status === 'cancelled' && DELIVERED_LIKE_STATUSES.has(currentStatus)) {
    throwTransitionError("Impossible d'annuler une commande déjà livrée.");
  }

  if (status === 'delivered' && !isPickupOrder(order) && !hasValidDeliveryEvidence(order)) {
    throwTransitionError('Preuve de livraison obligatoire: photo(s) + signature client.');
  }

  if (isPickupOrder(order) && status === 'picked_up_confirmed') {
    if (!hasValidDeliveryEvidence(order) || !hasMinimumDeliveryProofImages(order, 3)) {
      throwTransitionError(
        'Retrait impossible sans preuve complète (signature client + 3 photos minimum).'
      );
    }
    if (!['confirmed', 'ready_for_pickup'].includes(currentStatus)) {
      throwTransitionError('La commande doit être prête à récupérer avant validation du retrait.');
    }
  }

  return { mode: 'default', previousStatus: currentStatus };
};

export const assertSellerCanSubmitDeliveryProof = ({ order, deliveryProofResubmissionLimit = 3 }) => {
  const status = toStatus(order?.status);
  const pickupOrder = isPickupOrder(order);
  const platformDeliveryOrder = isPlatformDeliveryOrder(order);

  if (status === 'cancelled') {
    throwTransitionError('Impossible de soumettre une preuve pour une commande annulée.');
  }

  if (toStatus(order?.paymentType) === 'installment' && status !== 'completed') {
    throwTransitionError(
      'La preuve de livraison est disponible après la complétion du paiement en tranches.'
    );
  }
  if (toStatus(order?.paymentType) === 'installment' && !hasAllInstallmentsSettled(order)) {
    throwTransitionError('La livraison est disponible uniquement après paiement complet de toutes les tranches.');
  }

  if (
    toStatus(order?.paymentType) !== 'installment' &&
    !(
      pickupOrder
        ? ['paid', 'confirmed', 'ready_for_pickup', 'picked_up_confirmed']
        : [
            'paid',
            'confirmed',
            'ready_for_delivery',
            'delivering',
            'out_for_delivery',
            'delivery_proof_submitted'
          ]
    ).includes(status)
  ) {
    throwTransitionError(
      pickupOrder
        ? 'La commande doit être prête au retrait avant la preuve de retrait.'
        : 'La commande doit être prête/en cours de livraison avant la preuve de livraison.'
    );
  }

  if (pickupOrder && status === 'picked_up_confirmed' && toStatus(order?.deliveryStatus) === 'verified') {
    throwTransitionError('Le retrait est déjà confirmé.', null, 409);
  }
  if (toStatus(order?.deliveryStatus) === 'verified') {
    throwTransitionError('La livraison est déjà confirmée par le client.', null, 409);
  }
  if (Number(order?.deliveryProofAttemptCount || 0) >= Number(deliveryProofResubmissionLimit || 0)) {
    throwTransitionError(
      `Limite atteinte: ${deliveryProofResubmissionLimit} soumissions de preuve maximum.`,
      'DELIVERY_PROOF_LIMIT',
      429
    );
  }

  return {
    isPickupOrder: pickupOrder,
    isPlatformDeliveryOrder: platformDeliveryOrder,
    minimumProofImages: pickupOrder ? 3 : 1
  };
};
