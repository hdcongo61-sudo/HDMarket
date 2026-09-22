const DELIVERED = ['delivery_proof_submitted', 'delivered', 'confirmed_by_client', 'completed', 'picked_up_confirmed'];
const WAITING = ['pending', 'paid', 'confirmed', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'delivering', 'installment_active', 'installment_paid', 'overdue_installment'];
export const DISPUTABLE_ORDER_STATUSES = [...DELIVERED, ...WAITING];

export const disputeEligibility = ({ order, reason, thresholds, escrowSettings, now = new Date() }) => {
  const denied = (message, status = 400) => ({ allowed: false, message, status });
  const escrow = String(order.paymentSource || '').toLowerCase() === 'pawapay' && Number(order.paidAmount) > 0;
  if (escrow && !escrowSettings.disputeEnabled) return denied('Les litiges escrow sont temporairement désactivés.', 403);
  if (escrow && ['RELEASED', 'REFUNDED'].includes(order.escrowStatus)) return denied('Les fonds ont déjà été libérés ou remboursés.', 409);
  if (!DELIVERED.includes(order.status)) {
    if (order.status === 'pending' && !(Number(order.paidAmount) > 0)) return denied('Cette commande attend encore sa confirmation.');
    if (reason !== 'not_received' || !WAITING.includes(order.status)) {
      return denied('Avant la remise, sélectionnez le motif « Non reçu » pour une commande confirmée.');
    }
    // The post-delivery deadline cannot expire before delivery has happened.
    return { allowed: true, disputeWindowEndsAt: null };
  }
  const deliveredAt = new Date(order.deliveredAt || order.deliverySubmittedAt || order.updatedAt || order.createdAt);
  const windowMs = escrow ? Number(escrowSettings.maximumDisputeTimeMinutes) * 60_000 : Number(thresholds.disputeWindowHours) * 3_600_000;
  const end = new Date(deliveredAt.getTime() + windowMs);
  const release = order.autoReleaseAt ? new Date(order.autoReleaseAt) : null;
  const disputeWindowEndsAt = release && release < end ? release : end;
  if (!Number.isFinite(disputeWindowEndsAt.getTime()) || now > disputeWindowEndsAt) {
    return denied('Le délai pour bloquer les fonds est dépassé. Contactez le support pour votre demande de retour.');
  }
  return { allowed: true, disputeWindowEndsAt };
};
