import React from 'react';
import { formatPriceWithStoredSettings as money } from '../utils/priceFormatter';

export const shoppingTransferStatus = status => ({
  READY: 'À traiter', WAITING_REFERENCE: 'Vérification du paiement initial', WAITING_ACCOUNT: 'Compte Mobile Money à configurer',
  PROCESSING: 'En cours', NEEDS_ATTENTION: 'Vérification en cours', COMPLETED: 'Confirmé', FAILED: 'À relancer par l’assistance'
}[status] || status);

export default function ShoppingFinancialStatus({ order }) {
  const refunds = (order.transfers || []).filter(item => item.type === 'REFUND');
  return <section className="rounded-2xl border border-orange-100 bg-white p-4">
    <h2 className="text-sm font-black text-gray-900">Votre paiement</h2>
    <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><dt>Montant payé</dt><dd className="font-bold">{money(order.payment?.totalPaid || 0)}</dd></div>
      {order.refundDue > 0 ? <div className="flex justify-between"><dt>Remboursement demandé</dt><dd className="font-bold">{money(order.refundDue)}</dd></div> : null}
      {order.refundedAmount > 0 ? <div className="flex justify-between"><dt>Remboursement confirmé</dt><dd className="font-bold">{money(order.refundedAmount)}</dd></div> : null}</dl>
    {refunds.map(refund => <p key={refund._id} className="mt-2 rounded-lg bg-orange-50 p-2 text-xs text-orange-900">{money(refund.amount)} · {shoppingTransferStatus(refund.status)} · vers le compte Mobile Money ayant payé</p>)}
    {order.status === 'COMPLETED' && !order.settlementVersion ? <p className="mt-2 text-xs text-orange-800">Ancienne demande : contactez l’assistance pour vérifier le remboursement ou le versement.</p> : null}
  </section>;
}
