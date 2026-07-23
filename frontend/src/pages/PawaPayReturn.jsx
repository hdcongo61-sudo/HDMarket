import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react';
import api from '../services/api';
import { getPawaPayFailure, getPawaPayRequestError } from '../utils/pawapayErrors';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const FAILED_STATUSES = new Set(['FAILED', 'EXPIRED', 'CANCELLED']);

const isTerminalCheckout = (checkout) => {
  const status = String(checkout?.status || '');
  if (FAILED_STATUSES.has(status)) return true;
  return status === 'COMPLETED' && ['CREDITED', 'FAILED'].includes(String(checkout?.creditState || ''));
};

export default function PawaPayReturn() {
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

  const completed = checkout?.status === 'COMPLETED' && checkout?.creditState === 'CREDITED';
  const creditFailed = checkout?.status === 'COMPLETED' && checkout?.creditState === 'FAILED';
  const failed = FAILED_STATUSES.has(checkout?.status) || creditFailed;
  const failure = getPawaPayFailure(
    checkout?.failureReason,
    creditFailed
      ? 'Le paiement est confirmé, mais le crédit du portefeuille nécessite une vérification.'
      : 'Le paiement n’a pas pu être finalisé.'
  );
  const returnPath = checkout?.returnPath || '/wallet';

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
            (completed
              ? `${formatPriceWithStoredSettings(checkout.amount)} ont été ajoutés à votre portefeuille HDMarket.`
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
              to={returnPath}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0b6b4f] px-4 text-sm font-black text-white"
            >
              {completed ? 'Continuer dans HDMarket' : creditFailed ? 'Voir mon portefeuille' : 'Réessayer le paiement'}
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
          <Link to="/wallet" className="inline-flex min-h-10 items-center justify-center text-xs font-black text-slate-500">
            Voir mon portefeuille
          </Link>
        </div>
      </section>
    </main>
  );
}
