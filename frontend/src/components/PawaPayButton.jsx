import React, { useRef, useState } from 'react';
import { ArrowUpRight, Loader2, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { getPawaPayRequestError } from '../utils/pawapayErrors';
import { createIdempotencyKey } from '../utils/idempotency';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

export default function PawaPayButton({
  amount,
  purpose = 'CHECKOUT_FUNDING',
  productId = '',
  promoCode = '',
  actionContext = null,
  returnPath = '/orders',
  label = 'Payer avec PawaPay',
  onBeforeStart = null,
  className = ''
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const idempotencyKeyRef = useRef(createIdempotencyKey('pawapay-checkout'));
  const normalizedAmount = Math.round(Number(amount || 0));

  const startCheckout = async () => {
    if (loading || normalizedAmount < 10) {
      setError('Le montant minimum est de 10 FCFA.');
      setErrorHint('Modifiez le montant puis réessayez.');
      return;
    }

    setLoading(true);
    setError('');
    setErrorHint('');
    try {
      let checkoutOverrides = {};
      if (onBeforeStart) {
        const validation = await onBeforeStart();
        if (validation === false || typeof validation === 'string') {
          setError(
            typeof validation === 'string'
              ? validation
              : 'Vérifiez les informations avant de continuer.'
          );
          setErrorHint('');
          setLoading(false);
          return;
        }
        if (validation && typeof validation === 'object' && !Array.isArray(validation)) {
          checkoutOverrides = validation;
        }
      }
      const { data } = await api.post(
        '/payments/pawapay/checkouts',
        {
          amount: normalizedAmount,
          purpose,
          ...(productId ? { productId } : {}),
          ...(promoCode ? { promoCode } : {}),
          ...(actionContext ? { actionContext } : {}),
          returnPath,
          ...checkoutOverrides
        },
        { headers: { 'Idempotency-Key': idempotencyKeyRef.current } }
      );
      if (data?.pending && data?.verificationUrl) {
        window.location.assign(data.verificationUrl);
        return;
      }
      if (!data?.redirectUrl) throw new Error('Adresse de paiement indisponible.');
      window.location.assign(data.redirectUrl);
    } catch (requestError) {
      const presentation = getPawaPayRequestError(
        requestError,
        'Impossible d’ouvrir PawaPay pour le moment.'
      );
      setError(presentation.message);
      setErrorHint(presentation.hint);
      // A provider response is definitive and a later retry needs a new checkout.
      // If the network response was lost, reuse the same key so the backend can
      // replay the original result instead of creating a second payment.
      if (requestError?.response && presentation.action !== 'CHECK_STATUS') {
        idempotencyKeyRef.current = createIdempotencyKey('pawapay-checkout');
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading || normalizedAmount < 10}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b6b4f] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#07563f] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
        <span>{loading ? 'Ouverture du paiement…' : `${label} · ${formatPriceWithStoredSettings(normalizedAmount)}`}</span>
        {!loading && <ArrowUpRight size={16} />}
      </button>
      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-bold text-red-700">{error}</p>
          {errorHint ? <p className="mt-1 text-xs font-semibold text-red-600">{errorHint}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
