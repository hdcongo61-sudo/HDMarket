import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, Eye, Megaphone, MousePointerClick, Send, Users } from 'lucide-react';
import api from '../services/api';
import GlobalNotificationRequestForm from '../components/GlobalNotificationRequestForm';
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";

const STATUS_STYLES = {
  PENDING: 'bg-amber-50 border-amber-200 text-amber-700',
  SENT: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  REJECTED: 'bg-red-50 border-red-200 text-red-700'
};

const STATUS_LABELS = {
  PENDING: 'En attente de validation',
  SENT: 'Diffusée',
  REJECTED: 'Rejetée'
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

export default function SellerGlobalNotifications() {
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, requestsRes] = await Promise.all([
        api.get('/products'),
        api.get('/global-notifications/my/requests', { params: { page: 1, limit: 30 } })
      ]);
      const productItems = Array.isArray(productsRes?.data) ? productsRes.data : [];
      const requestItems = Array.isArray(requestsRes?.data?.items) ? requestsRes.data.items : [];
      setProducts(productItems);
      setRequests(requestItems);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les notifications globales.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = requests.length;
    const sent = requests.filter((item) => item.status === 'SENT').length;
    const pending = requests.filter((item) => item.status === 'PENDING').length;
    const spend = requests
      .filter((item) => item.status === 'SENT')
      .reduce((sum, item) => sum + Number(item.price || 0), 0);
    return { total, sent, pending, spend };
  }, [requests]);

  return (
    <div className="hd-my-flow hd-commerce-shell min-h-screen pb-8 pt-4 sm:py-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 sm:gap-6 sm:px-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3">
            <Link
              to="/my"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e85d00] text-white shadow-sm">
                <Megaphone className="h-5 w-5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <h1 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">Notifications globales</h1>
                <p className="text-sm font-medium text-gray-500">Payez pour promouvoir un produit auprès de tous les utilisateurs ciblés.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Demandes</p>
            <p className="mt-1 text-xl font-black text-gray-900 sm:text-2xl">{stats.total}</p>
          </article>
          <article className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Diffusées</p>
            <p className="mt-1 text-xl font-black text-emerald-700 sm:text-2xl">{stats.sent}</p>
          </article>
          <article className="rounded-xl border border-amber-100 bg-amber-50 p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">En attente</p>
            <p className="mt-1 text-xl font-black text-amber-700 sm:text-2xl">{stats.pending}</p>
          </article>
          <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Dépensé</p>
            <p className="mt-1 truncate text-base font-black text-[#e85d00] sm:text-xl">{formatCurrency(stats.spend)}</p>
          </article>
        </section>

        <GlobalNotificationRequestForm products={products} />

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="border-l-[3px] border-[#e85d00] pl-2.5 text-base font-black text-gray-900 sm:text-lg">Mes campagnes</h2>
            <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600">
              <Send className="h-3.5 w-3.5" />
              {requests.length}
            </span>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement...</p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</p>
          ) : !requests.length ? (
            <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">Aucune notification globale pour le moment.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((item, idx) => (
                <article
                  key={item.id || `global-notification-${item.createdAt || idx}`}
                  className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {item.image?.url && (
                        <img src={item.image.url} alt={item.title} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-gray-900">{item.title}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '-'}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded border px-2 py-1 text-[11px] font-bold ${STATUS_STYLES[item.status] || STATUS_STYLES.PENDING}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Ciblage</p>
                      <p className="truncate font-black text-gray-900">{item.audienceCity || 'Toutes villes'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                      <p className="text-gray-500">Payé</p>
                      <p className="truncate font-black text-[#e85d00]">{formatCurrency(item.price)}</p>
                    </div>
                    {item.status === 'SENT' ? (
                      <>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                          <p className="flex items-center gap-1 text-gray-500"><Users className="h-3 w-3" />Atteint</p>
                          <p className="font-black text-gray-900">{item.matchedCount || 0}</p>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                          <p className="flex items-center gap-1 text-gray-500"><Eye className="h-3 w-3" />Ouvertes</p>
                          <p className="font-black text-gray-900">{item.stats?.opened || 0}</p>
                        </div>
                      </>
                    ) : (
                      <div className="col-span-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                        <p className="text-gray-500">Portée estimée</p>
                        <p className="font-black text-gray-900">{item.estimatedReach || 0}</p>
                      </div>
                    )}
                  </div>

                  {item.status === 'SENT' && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-800">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {item.stats?.clicked || 0} clic(s) · objectif {item.matchedCount || 0} utilisateur(s) atteint(s)
                    </div>
                  )}

                  {item.rejectionReason && (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
                      Motif rejet: {item.rejectionReason}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
