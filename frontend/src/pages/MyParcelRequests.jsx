import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, ChevronRight, Plus } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';

const STATUS_LABELS = {
  PENDING: { label: 'En attente', className: 'bg-amber-50 text-amber-700' },
  ACCEPTED: { label: 'Livreur assigné', className: 'bg-blue-50 text-blue-700' },
  IN_PROGRESS: { label: 'En cours', className: 'bg-blue-50 text-blue-700' },
  DELIVERED: { label: 'Livré', className: 'bg-emerald-50 text-emerald-700' },
  CANCELED: { label: 'Annulé', className: 'bg-gray-100 text-gray-500' },
  FAILED: { label: 'Échoué', className: 'bg-red-50 text-red-700' },
  REJECTED: { label: 'Refusé', className: 'bg-red-50 text-red-700' }
};

export default function MyParcelRequests() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .get('/parcels/mine')
      .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen bg-[#faf8f5] pb-24">
      <GlassHeader
        title="Mes colis"
        subtitle="Courses à la demande"
        backTo="/profile"
        right={
          <Link
            to="/parcels/new"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#e85d00] text-white"
            aria-label="Nouvelle course"
          >
            <Plus size={16} />
          </Link>
        }
      />

      <div className="mx-auto max-w-lg space-y-2.5 px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Chargement…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
            <Package className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">Aucune course pour le moment.</p>
            <Link
              to="/parcels/new"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#e85d00] px-4 text-sm font-black text-white"
            >
              Envoyer un colis
            </Link>
          </div>
        ) : (
          items.map((item) => {
            const statusMeta = STATUS_LABELS[item.status] || STATUS_LABELS.PENDING;
            return (
              <Link
                key={item._id}
                to={`/parcels/${item._id}`}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff0e4] text-[#e85d00]">
                  <Package size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {item.pickup?.communeName || item.pickup?.address} → {item.dropoff?.communeName || item.dropoff?.address}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                  <p className="mt-1 text-sm font-black text-neutral-950">{formatCurrency(item.deliveryPrice)}</p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
