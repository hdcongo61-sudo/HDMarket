const ORDER_GROUP_STATUS_MAP = {
  buyer: {
    all: [],
    payment_due: ['pending_payment'],
    active: ['pending', 'paid', 'confirmed', 'ready_for_delivery', 'pending_installment', 'installment_active'],
    pickup: ['ready_for_pickup', 'picked_up_confirmed'],
    delivery: ['out_for_delivery', 'delivering', 'delivery_proof_submitted'],
    completed: ['confirmed_by_client', 'delivered', 'completed'],
    cancelled: ['cancelled']
  },
  seller: {
    all: [],
    new: ['pending_payment', 'paid', 'pending', 'pending_installment'],
    prepare: ['confirmed', 'ready_for_delivery'],
    handoff: ['ready_for_pickup', 'out_for_delivery', 'delivering', 'delivery_proof_submitted'],
    payment: ['pending_payment', 'paid', 'pending_installment', 'installment_active', 'overdue_installment'],
    installments: ['pending_installment', 'installment_active', 'overdue_installment', 'completed'],
    completed: ['picked_up_confirmed', 'confirmed_by_client', 'delivered', 'completed'],
    problems: ['overdue_installment', 'dispute_opened', 'cancelled']
  }
};

export const ORDER_FILTER_GROUPS = {
  buyer: [
    { key: 'all', label: 'Toutes', description: 'Toutes vos commandes' },
    { key: 'payment_due', label: 'À payer', description: 'Paiement ou preuve attendu' },
    { key: 'active', label: 'En cours', description: 'Commandes en préparation' },
    { key: 'pickup', label: 'À récupérer', description: 'Retrait boutique' },
    { key: 'delivery', label: 'Livraison', description: 'Suivi livraison' },
    { key: 'completed', label: 'Terminées', description: 'Achats finalisés' },
    { key: 'cancelled', label: 'Annulées', description: 'Commandes annulées' }
  ],
  seller: [
    { key: 'all', label: 'Toutes', description: 'Toutes les commandes' },
    { key: 'new', label: 'Nouvelles', description: 'À traiter maintenant' },
    { key: 'prepare', label: 'À préparer', description: 'Préparation vendeur' },
    { key: 'handoff', label: 'Livraison/retrait', description: 'Remise client ou livreur' },
    { key: 'payment', label: 'Paiement', description: 'Paiement à suivre' },
    { key: 'installments', label: 'Tranches', description: 'Ventes échelonnées' },
    { key: 'completed', label: 'Terminées', description: 'Commandes clôturées' },
    { key: 'problems', label: 'Problèmes', description: 'Retards ou annulations' }
  ]
};

export const getOrderGroupStatuses = (role = 'buyer', group = 'all') =>
  ORDER_GROUP_STATUS_MAP[role]?.[group] || [];

export const isOrderGroupKey = (role = 'buyer', value = '') =>
  Object.prototype.hasOwnProperty.call(ORDER_GROUP_STATUS_MAP[role] || {}, String(value || ''));

export const getOrderItems = (order) => {
  if (Array.isArray(order?.items) && order.items.length) return order.items;
  if (order?.productSnapshot) {
    return [{ snapshot: order.productSnapshot, quantity: 1, product: order.product }];
  }
  return [];
};

export const getOrderTotal = (order) => {
  const items = getOrderItems(order);
  const computed = items.reduce(
    (sum, item) => sum + Number(item?.snapshot?.price || 0) * Number(item?.quantity || 1),
    0
  );
  return Number(order?.totalAmount ?? computed);
};

export const getOrderItemCount = (order) =>
  getOrderItems(order).reduce((sum, item) => sum + Number(item?.quantity || 1), 0);

export const getOrderDisplayStatus = (order) => {
  const rawStatus = String(order?.status || 'pending').toLowerCase();
  if (String(order?.paymentType || '') === 'installment' && rawStatus === 'completed') {
    return String(order?.installmentSaleStatus || 'confirmed').toLowerCase();
  }
  const normalized = {
    pending_payment: 'payment_due',
    paid: 'confirmed',
    ready_for_pickup: 'pickup_ready',
    picked_up_confirmed: 'completed',
    ready_for_delivery: 'confirmed',
    out_for_delivery: 'delivering',
    delivery_proof_submitted: 'delivered',
    confirmed_by_client: 'completed'
  };
  return normalized[rawStatus] || rawStatus;
};

export const getOrderProgress = (order) => {
  const status = getOrderDisplayStatus(order);
  if (['cancelled', 'dispute_opened'].includes(status)) return 0;
  if (['completed', 'delivered'].includes(status)) return 100;
  if (['delivering', 'pickup_ready'].includes(status)) return 75;
  if (['confirmed', 'ready_for_delivery'].includes(status)) return 50;
  if (['payment_due', 'pending', 'pending_installment'].includes(status)) return 20;
  return 35;
};

export const getOrderPaymentState = (order) => {
  const status = String(order?.status || '').toLowerCase();
  const paymentType = String(order?.paymentType || '').toLowerCase();
  const paidAmount = Number(order?.paidAmount || 0);
  const totalAmount = getOrderTotal(order);
  const remainingAmount = Number(order?.remainingAmount ?? Math.max(0, totalAmount - paidAmount));

  if (paymentType === 'installment') {
    const progress = order?.installmentProgress;
    return {
      type: 'installment',
      label: 'Paiement par tranche',
      paidAmount,
      remainingAmount,
      progress: Number(progress?.percent ?? progress?.percentage ?? 0),
      needsAction: ['pending_installment', 'overdue_installment'].includes(status)
    };
  }

  const paidStatuses = new Set([
    'paid',
    'ready_for_pickup',
    'picked_up_confirmed',
    'ready_for_delivery',
    'out_for_delivery',
    'delivery_proof_submitted',
    'confirmed_by_client',
    'confirmed',
    'delivering',
    'delivered',
    'completed'
  ]);

  return {
    type: 'standard',
    label: paidStatuses.has(status) ? 'Paiement reçu' : 'Paiement à compléter',
    paidAmount,
    remainingAmount,
    progress: totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0,
    needsAction: !paidStatuses.has(status)
  };
};

export const getOrderDeliveryState = (order) => {
  const status = String(order?.status || '').toLowerCase();
  const pickup = String(order?.deliveryMode || '').toLowerCase() === 'pickup' || Boolean(order?.pickup);
  if (status === 'cancelled') return { mode: pickup ? 'pickup' : 'delivery', label: 'Annulée', active: false };
  if (pickup) {
    if (['ready_for_pickup'].includes(status)) return { mode: 'pickup', label: 'Prête au retrait', active: true };
    if (['picked_up_confirmed', 'completed', 'confirmed_by_client'].includes(status)) {
      return { mode: 'pickup', label: 'Retrait confirmé', active: false };
    }
    return { mode: 'pickup', label: 'Retrait en préparation', active: true };
  }
  if (['out_for_delivery', 'delivering'].includes(status)) return { mode: 'delivery', label: 'En livraison', active: true };
  if (['delivery_proof_submitted'].includes(status)) return { mode: 'delivery', label: 'Preuve soumise', active: true };
  if (['delivered', 'confirmed_by_client', 'completed'].includes(status)) {
    return { mode: 'delivery', label: 'Livrée', active: false };
  }
  return { mode: 'delivery', label: 'Livraison à préparer', active: true };
};

export const getOrderPrimaryAction = (order, role = 'buyer') => {
  const status = String(order?.status || '').toLowerCase();
  const payment = getOrderPaymentState(order);
  const delivery = getOrderDeliveryState(order);

  if (status === 'cancelled') {
    return { key: 'view', label: 'Voir le détail', tone: 'neutral' };
  }

  if (role === 'seller') {
    if (order?.cancellationWindow?.isActive) {
      return { key: 'wait', label: 'Fenêtre client active', tone: 'muted' };
    }
    if (payment.type === 'installment' && payment.needsAction) {
      return { key: 'validate_installment', label: 'Valider la tranche', tone: 'urgent' };
    }
    if (['pending', 'paid'].includes(status)) return { key: 'confirm', label: 'Confirmer', tone: 'primary' };
    if (['confirmed', 'ready_for_delivery'].includes(status)) {
      return { key: 'prepare', label: delivery.mode === 'pickup' ? 'Marquer prêt' : 'Préparer livraison', tone: 'primary' };
    }
    if (['ready_for_pickup', 'out_for_delivery', 'delivering'].includes(status)) {
      return { key: 'handoff', label: delivery.mode === 'pickup' ? 'Suivre retrait' : 'Suivre livraison', tone: 'primary' };
    }
    return { key: 'view', label: 'Voir le détail', tone: 'neutral' };
  }

  if (payment.needsAction) return { key: 'pay', label: 'Finaliser le paiement', tone: 'urgent' };
  if (['ready_for_pickup'].includes(status)) return { key: 'pickup', label: 'Voir le retrait', tone: 'primary' };
  if (['out_for_delivery', 'delivering', 'delivery_proof_submitted'].includes(status)) {
    return { key: 'track', label: 'Suivre la livraison', tone: 'primary' };
  }
  if (['delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'].includes(status)) {
    return { key: 'review', label: 'Voir / noter', tone: 'neutral' };
  }
  return { key: 'view', label: 'Voir le détail', tone: 'neutral' };
};

export const getOrderUiState = (order, role = 'buyer') => {
  const payment = getOrderPaymentState(order);
  const delivery = getOrderDeliveryState(order);
  const progress = getOrderProgress(order);
  const primaryAction = getOrderPrimaryAction(order, role);
  const displayStatus = getOrderDisplayStatus(order);

  return {
    displayStatus,
    progress,
    payment,
    delivery,
    primaryAction,
    isUrgent: primaryAction.tone === 'urgent' || displayStatus === 'overdue_installment',
    nextStep:
      role === 'seller'
        ? primaryAction.label
        : payment.needsAction
          ? 'Paiement requis pour continuer'
          : delivery.label
  };
};

export const countOrdersByGroup = (orders = [], role = 'buyer') => {
  const list = Array.isArray(orders) ? orders : [];
  const groups = ORDER_FILTER_GROUPS[role] || ORDER_FILTER_GROUPS.buyer;
  return groups.reduce((acc, group) => {
    if (group.key === 'all') {
      acc[group.key] = list.length;
      return acc;
    }
    const statuses = new Set(getOrderGroupStatuses(role, group.key));
    acc[group.key] = list.filter((order) => statuses.has(String(order?.status || '').toLowerCase())).length;
    return acc;
  }, {});
};
