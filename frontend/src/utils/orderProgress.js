// The order's life compressed to its real stops — powers the hero progress rail
// on the buyer (OrderDetail) and seller (SellerOrderDetail) order pages.
export const buildProgressSteps = ({ isInstallment, isPickup }) =>
  isInstallment
    ? ['Commandée', 'Validation', 'Tranches', 'Terminée']
    : ['Commandée', 'Payée', 'Préparation', isPickup ? 'Retrait' : 'Livraison', 'Terminée'];

const CLASSIC_STEP_INDEX = {
  pending: 0,
  pending_payment: 0,
  paid: 1,
  confirmed: 2,
  ready_for_delivery: 2,
  ready_for_pickup: 2,
  out_for_delivery: 3,
  delivering: 3,
  picked_up_confirmed: 4,
  delivered: 3,
  delivery_proof_submitted: 3,
  confirmed_by_client: 4,
  completed: 4
};

const INSTALLMENT_STEP_INDEX = {
  pending: 0,
  pending_installment: 1,
  installment_active: 2,
  overdue_installment: 2,
  completed: 3
};

export const resolveProgressStepIndex = ({ status, isInstallment }) => {
  const map = isInstallment ? INSTALLMENT_STEP_INDEX : CLASSIC_STEP_INDEX;
  if (status in map) return map[status];
  // Installment orders can surface classic delivery statuses once paid.
  if (isInstallment && status in CLASSIC_STEP_INDEX) return INSTALLMENT_STEP_INDEX.installment_active;
  return 0;
};

// One orchestrated page-load sequence; each block rises in with a small stagger.
// Spread the result onto a framer-motion component.
export const riseIn = (reduceMotion, delay = 0) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.38, ease: 'easeOut', delay }
      };
