import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import api from '../services/api';
import { getPawaPayFailure, getPawaPayRequestError } from '../utils/pawapayErrors';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const FAILED_STATUSES = new Set(['FAILED', 'EXPIRED', 'CANCELLED']);
const safeInternalPath = (value, fallback = '/orders') => {
  const path = String(value || '').trim();
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://')
    ? path
    : fallback;
};

export const getPawaPaySuccessPath = (checkout) => {
  const completion = checkout?.completionResult || {};
  if (completion.successPath) return safeInternalPath(completion.successPath);

  const actionKind = String(checkout?.actionKind || completion.actionKind || '').toUpperCase();
  const orderIds = Array.isArray(completion.orderIds)
    ? completion.orderIds.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const entityId = String(completion.entityId || '').trim();

  if (actionKind === 'ORDER_CHECKOUT') {
    return orderIds.length === 1
      ? `/order/detail/${encodeURIComponent(orderIds[0])}`
      : '/orders';
  }
  if (actionKind === 'INSTALLMENT_CHECKOUT' || actionKind === 'INSTALLMENT_PAYMENT') {
    const orderId = orderIds[0] || entityId;
    return orderId ? `/order/detail/${encodeURIComponent(orderId)}` : '/orders';
  }
  if (actionKind === 'SPONSORSHIP_ACCEPT' || actionKind === 'SPONSORSHIP_PAY_SELF') {
    return '/sponsorships';
  }
  if (actionKind === 'BOOST_REQUEST') return '/seller/boosts';
  if (actionKind === 'SHOP_CONVERSION_REQUEST') return '/shop-conversion-request';

  return safeInternalPath(checkout?.returnPath, '/orders');
};

export const getPawaPayErrorPath = (checkout) =>
  safeInternalPath(checkout?.returnPath, '/orders');

const isTerminalCheckout = (checkout) => {
  const status = String(checkout?.status || '');
  if (FAILED_STATUSES.has(status)) return true;
  if (status !== 'COMPLETED' || !['CONFIRMED', 'FAILED'].includes(String(checkout?.paymentState || ''))) {
    return false;
  }
  if (
    checkout?.purpose === 'LISTING_FEE_FUNDING' ||
    (checkout?.autoValidationState && checkout.autoValidationState !== 'NOT_APPLICABLE')
  ) {
    return ['COMPLETED', 'FAILED'].includes(String(checkout?.autoValidationState || ''));
  }
  return true;
};

export default function PawaPayReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const checkoutId = searchParams.get('checkoutId') || '';
  const [checkout, setCheckout] = useState(null);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!checkoutId) {
      setError('Référence PawaPay manquante.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    let timer;
    let consecutiveErrors = 0;
    const load = async () => {
      try {
        const { data } = await api.get(`/payments/pawapay/checkouts/${checkoutId}`, {
          skipCache: true,
          skipDedupe: true
        });
        if (!active) return;
        setCheckout(data);
        setError('');
        setErrorHint('');
        setLoading(false);
        consecutiveErrors = 0;
        if (!isTerminalCheckout(data)) timer = setTimeout(load, 2500);
      } catch (requestError) {
        if (!active) return;
        const presentation = getPawaPayRequestError(requestError, 'Impossible de vérifier ce paiement.');
        setError(presentation.message);
        setErrorHint(presentation.hint);
        setLoading(false);
        consecutiveErrors += 1;
        if (presentation.retryable && consecutiveErrors < 5) timer = setTimeout(load, 3000);
      }
    };
    load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkoutId, reloadKey]);

  const listingPayment = checkout?.purpose === 'LISTING_FEE_FUNDING';
  const listingValidated = listingPayment && checkout?.autoValidationState === 'COMPLETED';
  const listingValidationFailed = listingPayment && checkout?.autoValidationState === 'FAILED';
  const actionPayment = Boolean(checkout?.actionKind);
  const actionCompleted = actionPayment && checkout?.autoValidationState === 'COMPLETED';
  const actionFailed = actionPayment && checkout?.autoValidationState === 'FAILED';
  const paymentCompleted = checkout?.status === 'COMPLETED' && checkout?.paymentState === 'CONFIRMED';
  const completed =
    paymentCompleted &&
    (!listingPayment || listingValidated) &&
    (!actionPayment || actionCompleted);
  const creditFailed = checkout?.status === 'COMPLETED' && checkout?.paymentState === 'FAILED';
  const failed =
    FAILED_STATUSES.has(checkout?.status) ||
    creditFailed ||
    listingValidationFailed ||
    actionFailed;
  const failure = getPawaPayFailure(
    checkout?.failureReason,
    creditFailed
      ? 'Le paiement est confirmé, mais le crédit du portefeuille nécessite une vérification.'
      : 'Le paiement n’a pas pu être finalisé.'
  );
  const successPath = getPawaPaySuccessPath(checkout);
  const errorPath = getPawaPayErrorPath(checkout);
  const failureMessage = creditFailed
    ? failure.message
    : checkout?.autoValidationError || failure.message || 'Le paiement PawaPay a échoué.';

  useEffect(() => {
    if (!completed) return undefined;
    const timer = setTimeout(() => {
      navigate(successPath, { replace: true });
    }, 700);
    return () => clearTimeout(timer);
  }, [completed, navigate, successPath]);

  useEffect(() => {
    if (!failed) return undefined;
    const timer = setTimeout(() => {
      navigate(errorPath, {
        replace: true,
        state: {
          pawaPayNotice: {
            status: 'failed',
            checkoutId,
            message: failureMessage
          }
        }
      });
    }, 2200);
    return () => clearTimeout(timer);
  }, [checkoutId, errorPath, failed, failureMessage, navigate]);

  return (
    <main className="min-h-[70vh] bg-[#f7f5f2] px-4 py-10">
      <section className="mx-auto max-w-md rounded-2xl border border-[#e5e0d8] bg-white p-6 text-center shadow-sm sm:p-8">
        {loading ? (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#0b6b4f]" />
        ) : completed ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        ) : failed || error ? (
          <XCircle className="mx-auto h-14 w-14 text-red-500" />
        ) : (
          <Clock3 className="mx-auto h-14 w-14 text-amber-500" />
        )}

        <h1 className="mt-5 text-xl font-black text-slate-950">
          {loading
            ? 'Vérification du paiement'
            : completed
              ? 'Paiement reçu'
              : failed || error
                ? creditFailed
                  ? 'Paiement à vérifier'
                  : 'Paiement non finalisé'
                : 'Paiement en cours'}
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          {error ||
            (actionCompleted
              ? `Paiement de ${formatPriceWithStoredSettings(checkout.amount)} confirmé. L’opération a été finalisée automatiquement.`
              : actionFailed
                ? checkout?.autoValidationError || 'Le paiement est confirmé, mais la finalisation nécessite une vérification.'
              : listingValidated
              ? `Paiement de ${formatPriceWithStoredSettings(checkout.amount)} confirmé. Votre annonce est maintenant validée.`
              : listingValidationFailed
                ? checkout?.autoValidationError || 'Le paiement est confirmé, mais la validation de l’annonce nécessite une vérification.'
                : completed
                  ? `Paiement de ${formatPriceWithStoredSettings(checkout.amount)} confirmé par PawaPay. Redirection automatique…`
              : failed
                ? failure.message
                : 'PawaPay confirme encore la transaction. Cette page se met à jour automatiquement.')}
        </p>
        {(errorHint || (failed && failure.hint)) ? (
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{errorHint || failure.hint}</p>
        ) : null}

        <div className="mt-6 space-y-2">
          {completed || failed ? (
            <Link
              to={completed ? successPath : errorPath}
              state={
                failed
                  ? {
                      pawaPayNotice: {
                        status: 'failed',
                        checkoutId,
                        message: failureMessage
                      }
                    }
                  : undefined
              }
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0b6b4f] px-4 text-sm font-black text-white"
            >
              {completed ? 'Continuer dans HDMarket' : creditFailed ? 'Retourner dans HDMarket' : 'Réessayer le paiement'}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError('');
                setErrorHint('');
                setReloadKey((value) => value + 1);
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white"
            >
              <RefreshCw size={16} /> Actualiser
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
