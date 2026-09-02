import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, ShieldExclamationIcon, StarIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { buildProductPath, buildShopPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import GlassHeader from '../components/orders/GlassHeader';

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
      <div className="hd-order-flow min-h-screen bg-[#f6f3ee]">
        <GlassHeader title="Votre avis" subtitle="Chargement..." backTo={`/orders/detail/${encodeURIComponent(orderId || '')}`} />
        <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6">
          <div className="animate-pulse rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#e7dfd5]">
            <div className="h-5 w-40 rounded bg-gray-200" />
            <div className="mt-4 h-28 rounded-2xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  if (reviewQuery.error) {
    return (
      <div className="hd-order-flow min-h-screen bg-[#f6f3ee]">
        <GlassHeader title="Votre avis" subtitle="Commande indisponible" backTo="/orders" />
        <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6">
          <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-red-100">
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
        </div>
      </div>
    );
  }

  return (
    <div className="hd-order-flow min-h-screen bg-[#f6f3ee]">
      <GlassHeader title="Votre avis" subtitle={`Commande #${String(orderId || '').slice(-6)}`} backTo={`/orders/detail/${encodeURIComponent(orderId || '')}`} />
      <div className="mx-auto max-w-3xl space-y-4 px-3 py-4 pb-28 sm:px-6 sm:py-6">
        <section className="relative overflow-hidden rounded-[28px] bg-[#e85d00] p-5 text-white shadow-[0_16px_42px_rgba(232,93,0,0.22)] sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/20 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="relative">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/70">
                Avis post-achat
              </p>
              <h1 className="mt-2 text-2xl font-black">Comment s&apos;est passée votre commande ?</h1>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/75">
                Partagez votre expérience pour aider les autres acheteurs et donner un retour utile au vendeur.
              </p>
            </div>
            <Link
              to={`/orders/detail/${encodeURIComponent(orderId || '')}`}
              className="relative inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 text-sm font-black text-[#e85d00] transition active:scale-95"
            >
              Voir la commande
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-white">
              Statut avis: {reviewState.status || 'PENDING'}
            </span>
            {reviewState.sentAt ? (
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-white">
                Rappel envoyé
              </span>
            ) : null}
            {reviewCompleted ? (
              <span className="rounded-full bg-emerald-400/20 px-3 py-1.5 text-white">
                Avis terminé
              </span>
            ) : null}
            {reminderDisabled ? (
              <span className="rounded-full bg-black/10 px-3 py-1.5 text-white">
                Rappel désactivé
              </span>
            ) : null}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#e7dfd5]">
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
                      ? 'border-[#e85d00] bg-[#e85d00] text-white shadow-sm shadow-orange-900/10'
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
                      <p className={`mt-1 text-xs font-semibold ${active ? 'text-white' : 'text-[#e85d00]'}`}>
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
          <section className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-[#e7dfd5]">
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
                  <CheckCircleIcon className="mt-0.5 h-5 w-5" />
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
                        <StarIcon className={`h-5 w-5 ${value <= rating ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <label htmlFor="order-review-comment" className="text-sm font-semibold text-gray-800">
                    Votre commentaire
                  </label>
                  <div className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
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
                    <ChatBubbleLeftRightIcon className="mr-2 h-4 w-4" />
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
                      <ShieldExclamationIcon className="mr-2 h-4 w-4" />
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
    </div>
  );
}
