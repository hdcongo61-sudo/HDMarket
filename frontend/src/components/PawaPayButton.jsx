import React, { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowPathIcon, ArrowUpRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { getPawaPayRequestError } from '../utils/pawapayErrors';
import { getPawaPayAttempt, updatePawaPayAttempt, clearPawaPayAttempt } from '../utils/pawapayAttempt';
import AuthContext from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { emitSettingsRefresh } from '../utils/settingsRefresh';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import {
  createPawaPayRouteState,
  openPawaPayCheckoutWindow,
  subscribeToPawaPayResults
} from '../utils/pawapayCheckoutWindow';

export default function PawaPayButton({
  amount,
  purpose = 'CHECKOUT_FUNDING',
  productId = '',
  promoCode = '',
  actionContext = null,
  returnPath = '/orders',
  label = 'Payer avec PawaPay',
  onBeforeStart = null,
  onResult = null,
  disabled = false,
  className = ''
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const { user } = useContext(AuthContext);
  const { country } = useCountry();
  const attemptRef = useRef(null);
  const paymentWindowRef = useRef(null);
  const expectedCheckoutIdRef = useRef('');
  const normalizedAmount = Math.round(Number(amount || 0));

  useEffect(() => subscribeToPawaPayResults((result) => {
    const expectedCheckoutId = expectedCheckoutIdRef.current;
    if (!expectedCheckoutId || result.checkoutId !== expectedCheckoutId) return;

    try {
      if (paymentWindowRef.current && !paymentWindowRef.current.closed) {
        paymentWindowRef.current.close();
      }
    } catch {
      // The payment window may already have closed itself.
    }
    paymentWindowRef.current = null;
    expectedCheckoutIdRef.current = '';
    if (result.status === 'completed' || result.retryAllowed) clearPawaPayAttempt(attemptRef.current);
    setLoading(false);

    if (onResult) { onResult(result); return; }
    navigate(result.path, {
      state: createPawaPayRouteState(result)
    });
  }), [navigate, onResult]);

  useEffect(() => {
    if (!loading || !paymentWindowRef.current) return undefined;
    const closeMonitor = setInterval(() => {
      try {
        if (!paymentWindowRef.current?.closed) return;
        paymentWindowRef.current = null;
        if (expectedCheckoutIdRef.current) setLoading(false);
      } catch {
        // Cross-origin windows can still be monitored through the result message.
      }
    }, 500);
    return () => clearInterval(closeMonitor);
  }, [loading]);

  const startCheckout = async () => {
    if (disabled) return;
    if (loading || normalizedAmount < 10) {
      setError('Le montant minimum est de 10 FCFA.');
      setErrorHint('Modifiez le montant puis réessayez.');
      return;
    }

    setLoading(true);
    setError('');
    setErrorHint('');
    const paymentWindow = openPawaPayCheckoutWindow();
    paymentWindowRef.current = paymentWindow;
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
          paymentWindow?.close();
          paymentWindowRef.current = null;
          return;
        }
        if (validation && typeof validation === 'object' && !Array.isArray(validation)) {
          checkoutOverrides = validation;
        }
      }
      const payload = {
          amount: normalizedAmount,
          purpose,
          ...(productId ? { productId } : {}),
          ...(promoCode ? { promoCode } : {}),
          ...(actionContext ? { actionContext } : {}),
          returnPath,
          ...checkoutOverrides
        };
      attemptRef.current = await getPawaPayAttempt(`${user?._id || user?.id}:${country?.id || country?._id}`, payload);
      const { data } = await api.post(
        '/payments/pawapay/checkouts', payload,
        { headers: { 'Idempotency-Key': attemptRef.current.idempotencyKey } }
      );
      expectedCheckoutIdRef.current = String(data?.checkoutId || '').trim();
      updatePawaPayAttempt(attemptRef.current, expectedCheckoutIdRef.current);
      const paymentUrl = data?.pending ? data?.verificationUrl : data?.redirectUrl;
      if (!paymentUrl) throw new Error('Adresse de paiement indisponible.');
      if (!paymentWindow) {
        // Mobile browsers can block popups. Use the same checkout in this tab.
        window.location.assign(paymentUrl);
        return;
      }
      if (paymentWindow.closed) {
        expectedCheckoutIdRef.current = '';
        setError('La fenêtre de paiement PawaPay a été fermée.');
        setErrorHint('Réessayez lorsque vous êtes prêt à terminer le paiement.');
        setLoading(false);
        return;
      }
      paymentWindow.opener = null;
      paymentWindow.location.assign(paymentUrl);
    } catch (requestError) {
      if (requestError?.response?.data?.code === 'PAWAPAY_LISTING_AMOUNT_CHANGED') {
        emitSettingsRefresh();
      }
      try {
        paymentWindow?.close();
      } catch {
        // Ignore a payment window that was already closed.
      }
      paymentWindowRef.current = null;
      expectedCheckoutIdRef.current = '';
      const presentation = getPawaPayRequestError(
        requestError,
        'Impossible d’ouvrir PawaPay pour le moment.'
      );
      setError(presentation.message);
      setErrorHint(presentation.hint);
      // Validation failures can start over. A transport/server failure may hide
      // a committed checkout, so retries must retain the original key.
      const status = Number(requestError?.response?.status || 0);
      if (status >= 400 && status < 500 && ![408, 409, 429].includes(status) && presentation.action !== 'CHECK_STATUS') {
        clearPawaPayAttempt(attemptRef.current);
      }
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={disabled || loading || normalizedAmount < 10}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b6b4f] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#07563f] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {loading ? <ArrowPathIcon className="animate-spin h-[18px] w-[18px]" /> : <ShieldCheckIcon className="h-[18px] w-[18px]" />}
        <span>{loading ? 'Ouverture du paiement…' : disabled ? label : `${label} · ${formatPriceWithStoredSettings(normalizedAmount)}`}</span>
        {!loading && <ArrowUpRightIcon className="h-4 w-4" />}
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
