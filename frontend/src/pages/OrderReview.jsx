import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MessageSquare, ShieldOff, Star } from 'lucide-react';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const ReviewActionButton = ({ onClick, disabled, variant = 'secondary', children }) => {
  const tone =
    variant === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-black'
      : variant === 'danger'
      ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[46px] items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
    >
      {children}
    </button>
  );
};

export default function OrderReview() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const requestedProductId = String(searchParams.get('productId') || '').trim();
  const [selectedProductId, setSelectedProductId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reviewQuery = useQuery({
    queryKey: ['orders', 'review', orderId],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${orderId}/review`, { skipCache: true });
      return data || {};
    },
    enabled: Boolean(orderId)
  });

  const items = Array.isArray(reviewQuery.data?.items) ? reviewQuery.data.items : [];

  useEffect(() => {
    if (!items.length) return;
    const preferred = items.find((item) => String(item.productId) === requestedProductId);
    setSelectedProductId((current) => current || preferred?.productId || items[0]?.productId || '');
  }, [items, requestedProductId]);

  const selectedItem = useMemo(
    () => items.find((item) => String(item.productId) === String(selectedProductId)) || items[0] || null,
    [items, selectedProductId]
  );

  const reviewState = reviewQuery.data?.reviewState || {};
  const reviewCompleted = reviewState.status === 'DONE';
  const reminderDisabled = Boolean(reviewState.disabled);
  const reminderSkipped = reviewState.status === 'SKIPPED';

  const submitReminderAction = async (action) => {
    setActionSubmitting(action);
    setError('');
    setSuccess('');
    try {
      await api.post(
        `/orders/${orderId}/review/action`,
        { action },
        { silentGlobalError: true }
      );
      await reviewQuery.refetch();
      if (action === 'skip') {
        setSuccess('Rappel marqué comme déjà traité.');
      } else if (action === 'disable') {
        setSuccess('Les rappels sont désactivés pour cette commande.');
      }
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          'Impossible de mettre à jour le rappel.'
      );
    } finally {
      setActionSubmitting('');
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedItem?.productId) return;
    if (!rating && !String(comment || '').trim()) {
      setError('Ajoutez une note ou un commentaire pour continuer.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      if (rating > 0) {
        await api.put(
          `/products/${selectedItem.productId}/rating`,
          { value: rating, productId: selectedItem.productId },
          { silentGlobalError: true }
        );
      }
      if (String(comment || '').trim()) {
        await api.post(
          `/products/${selectedItem.productId}/comments`,
          { message: String(comment).trim(), productId: selectedItem.productId },
          { silentGlobalError: true }
        );
      }
      await api.post(
        `/orders/${orderId}/review/action`,
        { action: 'done' },
        { silentGlobalError: true }
      );
      setSuccess('Votre avis a été enregistré.');
      setComment('');
      await reviewQuery.refetch();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Impossible d'enregistrer votre avis."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (reviewQuery.isLoading) {
    return (
      <main className="hd-order-flow hd-commerce-shell min-h-screen px-4 py-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-gray-600">Chargement de la page d'avis...</p>
        </div>
      </main>
    );
  }

  if (reviewQuery.error) {
    return (
      <main className="hd-order-flow hd-commerce-shell min-h-screen px-4 py-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <p className="text-sm text-red-700">
            {reviewQuery.error?.response?.data?.message ||
              reviewQuery.error?.message ||
              'Impossible de charger cette commande.'}
          </p>
          <div className="mt-4">
            <Link to="/orders" className="text-sm font-semibold text-neutral-900 underline">
              Retour aux commandes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="hd-order-flow hd-commerce-shell min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                Avis post-achat
              </p>
              <h1 className="mt-2 text-2xl font-black text-gray-900">Comment s&apos;est passée votre commande ?</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
                Partagez votre expérience pour aider les autres acheteurs et donner un retour utile au vendeur.
              </p>
            </div>
            <Link
              to={`/orders/detail/${encodeURIComponent(orderId || '')}`}
              className="inline-flex min-h-[44px] items-center rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Voir la commande
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700">
              Statut avis: {reviewState.status || 'PENDING'}
            </span>
            {reviewState.sentAt ? (
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
                Rappel envoyé
              </span>
            ) : null}
            {reviewCompleted ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                Avis terminé
              </span>
            ) : null}
            {reminderDisabled ? (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
                Rappel désactivé
              </span>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Produits achetés</h2>
              <p className="text-sm text-gray-500">Choisissez le produit que vous souhaitez noter.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const active = String(item.productId) === String(selectedItem?.productId || '');
              return (
                <button
                  key={`${item.productId}-${item._id}`}
                  type="button"
                  onClick={() => setSelectedProductId(item.productId)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-lg shadow-neutral-900/10'
                      : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/70">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold">{item.title}</p>
                      <p className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>
                        {item.shopName} · Qté {item.quantity}
                      </p>
                      <p className={`mt-1 text-xs font-semibold ${active ? 'text-white' : 'text-[#FF6A00]'}`}>
                        {formatPriceWithStoredSettings(item.unitPrice || 0)} / unité
                      </p>
                      {Array.isArray(item.selectedAttributes) && item.selectedAttributes.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.selectedAttributes.map((entry) => (
                            <span
                              key={`${item.productId}-${entry.name}-${entry.value}`}
                              className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                active ? 'bg-white/15 text-white' : 'bg-white text-gray-700'
                              }`}
                            >
                              {entry.name}: {entry.value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {selectedItem ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-gray-900">{selectedItem.title}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <Link
                    to={
                      selectedItem.slug
                        ? buildProductPath({ slug: selectedItem.slug })
                        : `/product/${encodeURIComponent(selectedItem.productId || '')}`
                    }
                    className="font-semibold text-neutral-900 underline"
                  >
                    Voir le produit
                  </Link>
                  <Link to={buildShopPath({ _id: selectedItem.shopId })} className="font-semibold text-neutral-700 underline">
                    {selectedItem.shopName}
                  </Link>
                </div>
              </div>
              {selectedItem.shopLogo ? (
                <img
                  src={selectedItem.shopLogo}
                  alt={selectedItem.shopName}
                  className="h-14 w-14 rounded-2xl object-cover ring-1 ring-gray-200"
                />
              ) : null}
            </div>

            {(error || success) && (
              <div
                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                  error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                {error || success}
              </div>
            )}

            {reviewCompleted ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Votre avis est déjà pris en compte.</p>
                    <p className="mt-1 text-sm">
                      Vous pouvez retourner au produit si vous souhaitez ajuster votre commentaire ou votre note.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5">
                  <p className="text-sm font-semibold text-gray-800">Votre note</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
                          value <= rating
                            ? 'border-amber-400 bg-amber-50 text-amber-600'
                            : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'
                        }`}
                      >
                        <Star className={`h-5 w-5 ${value <= rating ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="order-review-comment" className="text-sm font-semibold text-gray-800">
                    Votre commentaire
                  </label>
                  <div className="mt-2 rounded-3xl border border-gray-200 bg-gray-50 p-3">
                    <textarea
                      id="order-review-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      rows={5}
                      placeholder="Partagez votre expérience, la qualité du produit, la livraison ou le service du vendeur..."
                      className="w-full resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ReviewActionButton
                    variant="primary"
                    onClick={handleSubmitReview}
                    disabled={submitting}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {submitting ? 'Envoi...' : 'Soumettre mon avis'}
                  </ReviewActionButton>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ReviewActionButton
                      onClick={() => submitReminderAction('skip')}
                      disabled={Boolean(actionSubmitting)}
                    >
                      Déjà fait
                    </ReviewActionButton>
                    <ReviewActionButton
                      variant="danger"
                      onClick={() => submitReminderAction('disable')}
                      disabled={Boolean(actionSubmitting)}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Ne plus rappeler
                    </ReviewActionButton>
                  </div>
                </div>
              </>
            )}

            {reminderSkipped ? (
              <p className="mt-4 text-sm text-gray-500">
                Ce rappel a déjà été marqué comme traité.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
