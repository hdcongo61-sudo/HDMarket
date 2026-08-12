import React, { useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronRight, Plus, ShoppingBasket } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import GlassHeader from '../components/orders/GlassHeader';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';

const STATUS = {
  PENDING_PAYMENT: ['Paiement en attente', 'bg-amber-50 text-amber-700'],
  SEARCHING_DRIVER: ['Recherche d’un livreur', 'bg-amber-50 text-amber-700'],
  DRIVER_ASSIGNED: ['Livreur assigné', 'bg-blue-50 text-blue-700'],
  SHOPPING: ['Achats en cours', 'bg-blue-50 text-blue-700'],
  WAITING_CUSTOMER_APPROVAL: ['Votre validation est requise', 'bg-orange-50 text-[#c54d00]'],
  RECEIPT_UPLOADED: ['Reçu ajouté', 'bg-violet-50 text-violet-700'],
  DELIVERING: ['En livraison', 'bg-blue-50 text-blue-700'],
  DELIVERED: ['À confirmer', 'bg-emerald-50 text-emerald-700'],
  COMPLETED: ['Terminée', 'bg-emerald-50 text-emerald-700'],
  CANCELED: ['Annulée', 'bg-gray-100 text-gray-600'],
  FAILED: ['Échouée', 'bg-red-50 text-red-700']
};

export default function BuyForMeOrders() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get('/buy-for-me/mine').then(({ data }) => setOrders(Array.isArray(data?.items) ? data.items : [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [user]);

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <div className="min-h-screen bg-[#faf8f5] pb-20">
      <GlassHeader title="Mes achats délégués" subtitle="Suivez chaque demande Acheter Pour Moi" backTo="/" right={<Link to="/buy-for-me" className="grid h-9 w-9 place-items-center rounded-full bg-[#e85d00] text-white" aria-label="Nouvelle demande"><Plus size={16} /></Link>} />
      <div className="mx-auto max-w-lg space-y-2.5 px-4 py-4">
        {loading ? <p className="py-10 text-center text-sm text-gray-400">Chargement…</p> : null}
        {!loading && orders.length === 0 ? <section className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"><ShoppingBasket className="mx-auto h-9 w-9 text-gray-300" /><p className="mt-3 text-sm text-gray-500">Aucune demande pour le moment.</p><Link to="/buy-for-me" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#e85d00] px-4 text-sm font-black text-white">Faire mes achats</Link></section> : null}
        {orders.map((order) => {
          const [label, className] = STATUS[order.status] || STATUS.SEARCHING_DRIVER;
          return <Link key={order._id} to={`/buy-for-me/${order._id}`} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#e85d00]"><ShoppingBasket size={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-gray-900">{order.preferredStore || 'Achats à la demande'}</p><p className="mt-0.5 truncate text-xs text-gray-500">{order.items?.map((item) => item.name).filter(Boolean).join(', ') || 'Liste d’achats'}</p><p className="mt-1 text-[10px] font-semibold text-gray-400">{order.authorizationMode === 'SHOPPING_BUDGET' || order.pricing?.authorizationMode === 'SHOPPING_BUDGET' ? 'Budget autorisé' : 'Estimation'} : {formatCurrency(order.estimatedShoppingValue || order.pricing?.estimatedShoppingValue || order.pricing?.shoppingBudget || order.maxShoppingBudget)} · {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></div><div className="shrink-0 text-right"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${className}`}>{label}</span><p className="mt-1 text-sm font-black text-neutral-950">{formatCurrency(order.payment?.totalPaid || order.pricing?.total)}</p></div><ChevronRight className="shrink-0 text-gray-300" size={17} /></Link>;
        })}
      </div>
    </div>
  );
}
