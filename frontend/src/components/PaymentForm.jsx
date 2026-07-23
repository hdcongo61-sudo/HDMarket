import React, { useEffect, useMemo, useRef, useState } from 'react';
import api, { isApiPossiblyCommittedError, verifyTransactionCodeAvailability } from '../services/api';
import useCommissionRate from '../hooks/useCommissionRate';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Hash,
  DollarSign,
  Send,
  Shield,
  Ticket,
  Wallet
} from 'lucide-react';
import { useNetworks, getNetworkPhoneByName, getFirstNetworkPhone } from '../hooks/useNetworks';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { appAlert } from '../utils/appDialog';
import { createIdempotencyKey } from '../utils/idempotency';
import { getHighestProductPrice } from '../utils/productAttributes';
import PawaPayButton from './PawaPayButton';

const defaultOperatorPhones = {
  MTN: '069822930',
  Airtel: '050237023',
  Other: null
};
const ALLOWED_PAYMENT_OPERATORS = new Set(['MTN', 'Airtel', 'Orange', 'Moov', 'Other']);

const emptyCommission = (baseAmount) => ({
  baseAmount,
  discountAmount: 0,
  dueAmount: baseAmount,
  discountRate: 0,
  isWaived: false
});

const statusColor = (status) => {
  if (status === 'valid') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'invalid') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/70 border-gray-200 dark:border-slate-700';
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

export default function PaymentForm({ product, onSubmitted }) {
  const { commissionRatePercent, commissionRateLabel } = useCommissionRate();
  const submitIdempotencyKeyRef = useRef('');
  const listingReferencePrice = useMemo(
    () =>
      getHighestProductPrice({
        productAttributes: product?.attributes || [],
        basePrice: product?.price || 0
      }),
    [product?.attributes, product?.price]
  );
  const usesHighestOptionPrice = listingReferencePrice > Number(product?.price || 0);
  const expected = useMemo(
    () => Math.round(listingReferencePrice * (commissionRatePercent / 100) * 100) / 100,
    [commissionRatePercent, listingReferencePrice]
  );

  const [form, setForm] = useState({
    payerName: '',
    operator: 'MTN',
    transactionNumber: '',
    amount: expected,
    promoCode: ''
  });
  const [paymentMethod] = useState('wallet');
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoState, setPromoState] = useState({
    status: 'idle',
    code: '',
    message: '',
    commission: emptyCommission(expected)
  });

  const normalizedPromoCode = (form.promoCode || '').trim().toUpperCase();
  const isValidatedPromo = promoState.status === 'valid' && promoState.code === normalizedPromoCode;

  const commission = isValidatedPromo
    ? promoState.commission
    : emptyCommission(expected);

  const commissionDue = Number(commission.dueAmount || 0);
  const hasCommissionDue = commissionDue > 0;
  const isWalletPayment = hasCommissionDue && paymentMethod === 'wallet';
  const walletAvailableBalance = Number(wallet?.availableBalance ?? wallet?.balance ?? 0);
  const hasEnoughWalletBalance = walletAvailableBalance >= commissionDue;
  const walletFundingGap = Math.max(0, commissionDue - walletAvailableBalance);
  const walletFundingAmount = walletFundingGap > 0 ? Math.max(10, Math.ceil(walletFundingGap)) : 0;

  const { networks } = useNetworks();
  const sendMoneyNumber =
    getNetworkPhoneByName(networks, form.operator) ||
    (form.operator === 'Other' ? getFirstNetworkPhone(networks) : null) ||
    defaultOperatorPhones[form.operator];

  useEffect(() => {
    setForm((prev) => ({ ...prev, amount: commissionDue }));
  }, [commissionDue]);

  useEffect(() => {
    if (promoState.code && promoState.code !== normalizedPromoCode) {
      setPromoState({
        status: 'idle',
        code: '',
        message: '',
        commission: emptyCommission(expected)
      });
    }
  }, [normalizedPromoCode, promoState.code, expected]);

  useEffect(() => {
    if (!normalizedPromoCode && promoState.status !== 'idle') {
      setPromoState({
        status: 'idle',
        code: '',
        message: '',
        commission: emptyCommission(expected)
      });
    }
  }, [normalizedPromoCode, promoState.status, expected]);

  useEffect(() => {
    let cancelled = false;

    const loadWallet = async () => {
      if (!hasCommissionDue || paymentMethod !== 'wallet') return;
      setWalletLoading(true);
      setWalletError('');
      try {
        const { data } = await api.get('/wallet', {
          skipCache: true,
          skipDedupe: true
        });
        if (!cancelled) setWallet(data || null);
      } catch (error) {
        if (!cancelled) {
          setWalletError(error?.response?.data?.message || 'Impossible de charger votre portefeuille.');
        }
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    };

    loadWallet();
    return () => {
      cancelled = true;
    };
  }, [hasCommissionDue, paymentMethod]);

  const reconcilePaymentAfterTimeout = async ({ productId, transactionNumber }) => {
    const normalizedTransaction = String(transactionNumber || '').replace(/\D/g, '').trim();
    if (!productId) return false;
    try {
      const { data } = await api.get('/payments/me', {
        skipCache: true,
        skipDedupe: true,
        timeout: 15_000,
        headers: { 'x-skip-cache': '1', 'x-skip-dedupe': '1' }
      });
      const payments = Array.isArray(data) ? data : [];
      const now = Date.now();
      const cutoffMs = 20 * 60 * 1000;
      return payments.some((payment) => {
        const paymentProductId = String(payment?.product?._id || payment?.product || '').trim();
        if (paymentProductId !== String(productId)) return false;
        const createdAtMs = new Date(payment?.createdAt || 0).getTime();
        if (Number.isFinite(createdAtMs) && now - createdAtMs > cutoffMs) return false;
        if (!normalizedTransaction) return true;
        const paymentTx = String(payment?.transactionNumber || '').replace(/\D/g, '').trim();
        return paymentTx === normalizedTransaction;
      });
    } catch {
      return false;
    }
  };

  const paymentStatus = product.payment?.status || null;
  const hasPayment = Boolean(product.payment);

  const validatePromo = async () => {
    if (!normalizedPromoCode) {
      setPromoState({
        status: 'invalid',
        code: '',
        message: 'Veuillez saisir un code promo.',
        commission: emptyCommission(expected)
      });
      return;
    }

    setPromoLoading(true);
    try {
      const { data } = await api.post('/payments/promo-codes/validate', {
        productId: product._id,
        code: normalizedPromoCode
      });

      setPromoState({
        status: 'valid',
        code: normalizedPromoCode,
        message: data?.message || 'Code promo valide.',
        commission: data?.commission || emptyCommission(expected)
      });
    } catch (error) {
      const payload = error.response?.data || {};
      setPromoState({
        status: 'invalid',
        code: normalizedPromoCode,
        message: payload.message || 'Code invalide ou expiré.',
        commission: payload.commission || emptyCommission(expected)
      });
    } finally {
      setPromoLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (hasPayment || loading) return;

    if (normalizedPromoCode && !isValidatedPromo) {
      appAlert('Veuillez valider le code promo avant de soumettre le paiement.');
      return;
    }

    const payerName = String(form.payerName || '').trim();
    if (isWalletPayment) {
      if (walletLoading) {
        appAlert('Chargement du solde portefeuille. Veuillez patienter.');
        return;
      }
      if (walletError) {
        appAlert(walletError);
        return;
      }
      if (!hasEnoughWalletBalance) {
        appAlert('Solde portefeuille insuffisant pour valider cette annonce.');
        return;
      }
    }

    if (hasCommissionDue && !isWalletPayment && payerName.length < 2) {
      appAlert('Le nom du payeur doit contenir au moins 2 caractères.');
      return;
    }
    if (hasCommissionDue && !isWalletPayment && !ALLOWED_PAYMENT_OPERATORS.has(form.operator)) {
      appAlert('Veuillez sélectionner un opérateur valide.');
      return;
    }

    const digitsOnly = (form.transactionNumber || '').replace(/\D/g, '');
    if (hasCommissionDue && !isWalletPayment && digitsOnly.length !== 10) {
      appAlert('Le numéro de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    if (hasCommissionDue && !isWalletPayment) {
      try {
        const verification = await verifyTransactionCodeAvailability(digitsOnly);
        if (!verification.available) {
          const alreadyRecorded = await reconcilePaymentAfterTimeout({
            productId: product?._id,
            transactionNumber: digitsOnly
          });
          if (alreadyRecorded) {
            submitIdempotencyKeyRef.current = '';
            appAlert('Paiement déjà enregistré. Il est en attente de vérification.');
            if (onSubmitted) await onSubmitted();
            return;
          }
          appAlert(verification.message || 'Ce code de transaction est déjà utilisé.');
          return;
        }
      } catch (error) {
        if (error?.response?.status === 409) {
          const alreadyRecorded = await reconcilePaymentAfterTimeout({
            productId: product?._id,
            transactionNumber: digitsOnly
          });
          if (alreadyRecorded) {
            submitIdempotencyKeyRef.current = '';
            appAlert('Paiement déjà enregistré. Il est en attente de vérification.');
            if (onSubmitted) await onSubmitted();
            return;
          }
        }
        appAlert(error?.response?.data?.message || 'Impossible de vérifier le code de transaction.');
        return;
      }
    }

    setLoading(true);
    try {
      const safeCommissionDue = Number(Number(commissionDue || 0).toFixed(2));
      if (!Number.isFinite(safeCommissionDue) || safeCommissionDue < 0) {
        appAlert('Montant de commission invalide. Veuillez actualiser la page.');
        return;
      }

      const payload = {
        productId: product._id,
        amount: safeCommissionDue,
        paymentMethod: isWalletPayment ? 'wallet' : 'mobile_money'
      };

      if (isValidatedPromo) {
        payload.promoCode = normalizedPromoCode;
      }

      if (hasCommissionDue && !isWalletPayment) {
        payload.payerName = payerName;
        payload.operator = form.operator;
        payload.transactionNumber = digitsOnly;
      }

      if (!submitIdempotencyKeyRef.current) {
        submitIdempotencyKeyRef.current = createIdempotencyKey(`listing-payment-${product._id}`);
      }

      const { data } = await api.post('/payments', payload, {
        silentGlobalError: true,
        timeout: 45_000,
        headers: {
          'Idempotency-Key': submitIdempotencyKeyRef.current
        }
      });
      submitIdempotencyKeyRef.current = '';
      appAlert(
        data?.alreadySubmitted
          ? 'Paiement déjà enregistré. Il est en attente de vérification.'
          : isWalletPayment
          ? 'Paiement portefeuille réussi. Votre annonce est validée.'
          : 'Paiement soumis. En attente de vérification.'
      );
      if (onSubmitted) await onSubmitted();
    } catch (error) {
      if (
        error?.response?.status === 409 &&
        /paiement existe d.j.|paiement existe deja|attend une validation/i.test(
          String(error?.response?.data?.message || '')
        )
      ) {
        submitIdempotencyKeyRef.current = '';
        appAlert('Paiement déjà enregistré. Il est en attente de vérification.');
        if (onSubmitted) {
          try {
            await onSubmitted();
          } catch {
            // no-op
          }
        }
        return;
      }
      if (isApiPossiblyCommittedError(error)) {
        const alreadyRecorded = await reconcilePaymentAfterTimeout({
          productId: product?._id,
          transactionNumber: digitsOnly
        });
        if (alreadyRecorded) {
          submitIdempotencyKeyRef.current = '';
          appAlert(isWalletPayment ? 'Paiement portefeuille enregistré.' : 'Paiement enregistré. En attente de vérification par l’admin.');
        } else {
          appAlert(
            'Paiement en cours de confirmation. Le statut sera synchronisé automatiquement.'
          );
        }
        if (onSubmitted) {
          try {
            await onSubmitted();
          } catch {
            // no-op
          }
        }
        return;
      }
      submitIdempotencyKeyRef.current = '';
      appAlert(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading ||
    (hasCommissionDue &&
      isWalletPayment &&
      (walletLoading || walletError || !hasEnoughWalletBalance)) ||
    (hasCommissionDue &&
      !isWalletPayment &&
      (String(form.payerName || '').trim().length < 2 ||
        !ALLOWED_PAYMENT_OPERATORS.has(form.operator) ||
        String(form.transactionNumber || '').replace(/\D/g, '').length !== 10));

  const paymentStatusConfig = {
    waiting: {
      title: 'Paiement en attente de validation',
      description:
        'Votre paiement a été reçu et est en cours de vérification par notre équipe. Votre annonce sera publiée sous 24h après approbation.',
      icon: Clock,
      tone: 'bg-amber-50 border-amber-200 text-amber-800',
      iconColor: 'text-amber-500'
    },
    verified: {
      title: 'Paiement vérifié - Annonce active',
      description:
        'Votre paiement a été validé avec succès. Votre annonce est maintenant visible par tous les acheteurs sur la plateforme.',
      icon: CheckCircle,
      tone: 'bg-green-50 border-green-200 text-green-800',
      iconColor: 'text-green-500'
    },
    rejected: {
      title: 'Paiement rejeté',
      description:
        "Votre paiement n'a pas pu être validé. Veuillez contacter notre support ou soumettre un nouveau paiement.",
      icon: AlertCircle,
      tone: 'bg-red-50 border-red-200 text-red-800',
      iconColor: 'text-red-500'
    }
  };

  const statusConfig = paymentStatusConfig[paymentStatus] || {
    title: 'Paiement enregistré',
    description: 'Statut en cours de mise à jour.',
    icon: Clock,
    tone: 'bg-gray-50 dark:bg-slate-900/70 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200',
    iconColor: 'text-gray-500 dark:text-slate-400'
  };

  if (hasPayment) {
    const StatusIcon = statusConfig.icon;
    const paidCommissionBase = Number(product.payment?.commissionBaseAmount ?? expected);
    const paidCommissionDiscount = Number(product.payment?.commissionDiscountAmount ?? 0);
    const paidCommissionDue = Number(product.payment?.commissionDueAmount ?? product.payment?.amount ?? expected);

    return (
      <div className="hd-my-flow max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-neutral-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Statut de paiement</h2>
          <p className="text-gray-500 dark:text-slate-400">Suivi de votre transaction</p>
        </div>

        <div className={`rounded-2xl border-2 p-6 ${statusConfig.tone} mb-6`}>
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <StatusIcon className={`w-8 h-8 ${statusConfig.iconColor}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{statusConfig.title}</h3>
              <p className="text-sm leading-relaxed">{statusConfig.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Détails de la transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Produit:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">{product.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Prix du produit:</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">{formatCurrency(product.price)}</span>
              </div>
              {product.payment?.promoCodeValue && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Code promo:</span>
                  <span className="font-semibold text-emerald-700">{product.payment.promoCodeValue}</span>
                </div>
              )}
              {product.confirmationNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Code produit:</span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">{product.confirmationNumber}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Commission (base {commissionRateLabel}%):</span>
                <span className="font-medium text-gray-900 dark:text-slate-100">{formatCurrency(paidCommissionBase)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Réduction promo:</span>
                <span className="font-medium text-emerald-700">-{formatCurrency(paidCommissionDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Commission à payer:</span>
                <span className="font-semibold text-neutral-700">{formatCurrency(paidCommissionDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-slate-400">Statut actuel:</span>
                <span
                  className={`font-medium px-2 py-1 rounded-full text-xs ${
                    paymentStatus === 'verified'
                      ? 'bg-green-100 text-green-800'
                      : paymentStatus === 'rejected'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {paymentStatus || product.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-my-flow max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-neutral-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Validation de l'annonce</h1>
        <p className="text-gray-500 dark:text-slate-400">Finalisez votre publication en payant la commission</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-slate-100">Commission de publication</h3>
              <p className="text-xs text-neutral-700 dark:text-slate-300">
                Base {commissionRateLabel}% du {usesHighestOptionPrice ? 'prix d’option le plus élevé' : 'prix du produit'}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-neutral-600 dark:text-slate-200">{formatCurrency(commissionDue)}</div>
              <div className="text-xs text-neutral-500 dark:text-slate-400">sur {formatCurrency(listingReferencePrice)}</div>
            </div>
          </div>
          {usesHighestOptionPrice ? (
            <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs leading-5 text-orange-900">
              <span className="font-black">Prix de référence : {formatCurrency(listingReferencePrice)}.</span>{' '}
              L’annonce contient plusieurs prix ; le tarif d’option le plus élevé est retenu pour valider toute l’annonce.
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-neutral-500 dark:text-slate-400">Base</p>
              <p className="font-semibold text-neutral-800 dark:text-slate-100">{formatCurrency(commission.baseAmount || 0)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-emerald-600">Réduction</p>
              <p className="font-semibold text-emerald-700">-{formatCurrency(commission.discountAmount || 0)}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-neutral-500 dark:text-slate-400">À payer</p>
              <p className="font-semibold text-neutral-800 dark:text-slate-100">{formatCurrency(commissionDue)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-200">
            <Ticket className="w-4 h-4 text-neutral-600" />
            Code promo commission
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="ui-input flex-1 rounded-xl px-4 py-3 placeholder-slate-400 dark:placeholder-slate-500"
              placeholder="Ex: FIRST10"
              value={form.promoCode}
              onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
              disabled={loading || promoLoading}
            />
            <button
              type="button"
              onClick={validatePromo}
              disabled={loading || promoLoading}
              className="hd-soft-button px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {promoLoading ? 'Validation...' : 'Valider le code'}
            </button>
          </div>
          {(promoState.message || promoState.status !== 'idle') && (
            <div className={`rounded-xl border px-3 py-2 text-sm ${statusColor(promoState.status)}`}>
              {promoState.message || 'Code en attente de validation.'}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-800 text-sm">Instructions de paiement</h3>
              {hasCommissionDue ? (
                <p className="text-amber-700 text-sm">
                  Utilisez PawaPay avec MTN MoMo ou Airtel Money. La confirmation est automatique et aucun ID de transaction n’est demandé.
                </p>
              ) : (
                <p className="text-amber-700 text-sm">
                  Commission annulée grâce au code promo. Vous pouvez soumettre directement votre demande
                  de validation sans paiement mobile.
                </p>
              )}
            </div>
          </div>
        </div>

        {hasCommissionDue && walletFundingGap > 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <p className="text-sm font-black text-emerald-900">Payer plus simplement avec PawaPay</p>
            <p className="mb-3 mt-1 text-xs font-semibold leading-5 text-emerald-800">
              Paiement sécurisé par MTN MoMo ou Airtel Money. Revenez ensuite valider l’annonce avec le solde automatiquement crédité.
            </p>
            <PawaPayButton
              amount={walletFundingAmount}
              purpose="LISTING_FEE_FUNDING"
              returnPath={typeof window !== 'undefined' ? window.location.pathname : '/wallet'}
              label="Payer avec PawaPay"
            />
          </div>
        )}

        {product.confirmationNumber && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/70 px-4 py-3 text-xs text-gray-600 dark:text-slate-300">
            <p className="font-semibold text-gray-900 dark:text-slate-100 text-[12px] mb-1">
              Code produit : <span className="text-neutral-600">{product.confirmationNumber}</span>
            </p>
            <p>
              Communiquez ce code à l’administrateur ou au support lorsque vous confirmez votre commande afin qu’il
              identifie rapidement l’annonce.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {hasCommissionDue && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl border border-emerald-600 bg-emerald-600 p-4 text-left text-white shadow-sm">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Wallet className="h-4 w-4" />
                    PawaPay · solde HDMarket sécurisé
                  </span>
                  <span className="mt-1 block text-xs text-white/80">
                    Aucun ID transaction. Débit et validation automatiques.
                  </span>
                </div>
              </div>

              {isWalletPayment && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                  walletError
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : hasEnoughWalletBalance
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">Montant à débiter</p>
                      <p className="text-xs opacity-80">
                        {walletLoading
                          ? 'Chargement du portefeuille...'
                          : walletError || 'Ce montant sera débité de votre Portefeuille HDMarket.'}
                      </p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(commissionDue)}</p>
                  </div>
                </div>
              )}

              {!isWalletPayment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                  <User className="w-4 h-4 text-neutral-500" />
                  <span>Nom du payeur *</span>
                </label>
                <input
                  className="ui-input w-full rounded-xl px-4 py-3 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="Votre nom complet"
                  value={form.payerName}
                  onChange={(e) => setForm({ ...form, payerName: e.target.value })}
                  disabled={loading}
                  required={hasCommissionDue && !isWalletPayment}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                  <CreditCard className="w-4 h-4 text-neutral-500" />
                  <span>Opérateur mobile *</span>
                </label>
                <select
                  className="ui-input w-full rounded-xl px-4 py-3"
                  value={form.operator}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                  disabled={loading}
                  required={hasCommissionDue && !isWalletPayment}
                >
                  <option value="MTN">MTN</option>
                  <option value="Airtel">Airtel</option>
                  <option value="Other">Autre</option>
                </select>
                {sendMoneyNumber && (
                  <p className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    Envoyer l&apos;argent au numéro : <span className="font-bold">{sendMoneyNumber}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-200">
                  Exemple : où trouver l&apos;ID de la transaction dans le SMS
                </p>
                <div className="rounded-xl border-2 border-neutral-100 bg-neutral-50/50 p-3 overflow-hidden">
                  <img
                    src="/images/transaction-id-sms-example.png"
                    alt="Exemple de SMS Mobile Money montrant l'ID de la transaction (ex: 7232173826)"
                    className="w-full max-w-md mx-auto rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm object-contain"
                  />
                  <p className="text-xs text-gray-600 dark:text-slate-300 mt-2 text-center">
                    Saisissez le numéro indiqué à côté de « ID » ou « ID de la transaction » dans le SMS de confirmation.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                  <Hash className="w-4 h-4 text-neutral-500" />
                  <span>Numéro de transaction *</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="ui-input w-full rounded-xl px-4 py-3 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="10 chiffres (ex: 7232173826)"
                  value={form.transactionNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm({ ...form, transactionNumber: value });
                  }}
                  disabled={loading}
                  required={hasCommissionDue && !isWalletPayment}
                  title="ID de la transaction : 10 chiffres reçus par SMS"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-slate-200">
                  <DollarSign className="w-4 h-4 text-neutral-500" />
                  <span>Montant payé</span>
                </label>
                <input
                  type="number"
                  className="ui-input w-full rounded-xl px-4 py-3 text-gray-600 dark:text-slate-300"
                  value={commissionDue}
                  disabled
                />
              </div>
                </div>
              )}
            </div>
          )}

          {!hasCommissionDue && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Commission annulée grâce au code promo. Cliquez sur le bouton ci-dessous pour envoyer la demande de validation.
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="hd-primary-button flex w-full items-center justify-center gap-2 rounded-xl py-4 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Soumission en cours...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>
                  {hasCommissionDue
                    ? isWalletPayment
                      ? 'Payer avec le portefeuille'
                      : 'Soumettre le paiement'
                    : 'Soumettre la validation promo'}
                </span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500 dark:text-slate-400">
            {isWalletPayment
              ? 'Votre annonce est approuvée automatiquement après débit du portefeuille.'
              : 'Votre annonce sera approuvée sous 24h après vérification administrative'}
          </p>
        </form>
      </div>
    </div>
  );
}
