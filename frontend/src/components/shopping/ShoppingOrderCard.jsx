import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { formatPriceWithStoredSettings as money } from '../../utils/priceFormatter';

export const shoppingStatus = order => order.disputeOpen ? 'Signalement en cours' : ({
  PENDING_PAYMENT: 'Paiement à vérifier', SEARCHING_DRIVER: 'Recherche d’un livreur', DRIVER_ASSIGNED: 'Livreur assigné', SHOPPING: 'Achats en cours',
  WAITING_CUSTOMER_APPROVAL: 'Votre accord est attendu', RECEIPT_UPLOADED: 'Achats prêts', DELIVERING: 'En route vers vous', DELIVERED: 'Confirmez la réception',
  COMPLETED: 'Terminée', CANCELED: 'Annulée', FAILED: 'Échouée'
}[order.status] || 'Suivi des achats');

export function ShoppingProgress({ order }) {
  if (['CANCELED', 'FAILED'].includes(order.status)) return null;
  const step = { PENDING_PAYMENT: 0, SEARCHING_DRIVER: 0, DRIVER_ASSIGNED: 1, SHOPPING: 1, WAITING_CUSTOMER_APPROVAL: 1, RECEIPT_UPLOADED: 1, DELIVERING: 2, DELIVERED: 3, COMPLETED: 3 }[order.status] ?? 0;
  return <ol className="shop-progress" aria-label="Progression des achats">{['Demande', 'Achats', 'Livraison', 'Réception'].map((label, index) => <li key={label} className={index <= step ? 'is-done' : ''} aria-current={index === step ? 'step' : undefined}>{label}</li>)}</ol>;
}

export default function ShoppingOrderCard({ order }) {
  const attention = order.disputeOpen || ['WAITING_CUSTOMER_APPROVAL', 'DELIVERED', 'PENDING_PAYMENT'].includes(order.status);
  return <Link to={`/buy-for-me/${order._id}`} className="shop-order">
    <div className="shop-row"><span className={`shop-badge ${attention ? 'shop-badge--action' : ''}`}>{shoppingStatus(order)}</span><span className="shop-muted" style={{ fontSize: 10 }}>#{String(order._id).slice(-6).toUpperCase()}</span></div>
    <h3 className="shop-order-title mt-3">{order.preferredStore || 'Mes achats du quotidien'}</h3>
    <p className="shop-order-items">{(order.items || []).map(item => `${item.quantity} × ${item.name}`).join(' · ') || 'Voir la liste d’achats'}</p>
    <div className="shop-row"><span className="shop-muted">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Demande en cours'}</span><strong className="text-sm">{money(order.payment?.totalPaid || 0)} <span className="shop-muted">payés</span></strong></div>
    {!['COMPLETED', 'CANCELED', 'FAILED'].includes(order.status) ? <ShoppingProgress order={order} /> : null}
    <div className="shop-row mt-4"><span className="shop-link">{attention ? 'Voir ce qui est attendu' : 'Ouvrir le suivi'}</span><ChevronRightIcon /></div>
  </Link>;
}
