import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
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
  Ticket
} from 'lucide-react';
import { useNetworks, getNetworkPhoneByName, getFirstNetworkPhone } from '../hooks/useNetworks';

const defaultOperatorPhones = {
  MTN: '069822930',
  Airtel: '050237023',
  Other: null
};

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
  return 'text-gray-600 bg-gray-50 border-gray-200';
};

export default function PaymentForm({ product, onSubmitted }) {
  const expected = useMemo(() => Math.round(product.price * 0.03 * 100) / 100, [product.price]);

  const [form, setForm] = useState({
    payerName: '',
    operator: 'MTN',
    transactionNumber: '',
    amount: expected,
    promoCode: ''
  });
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
    if (hasPayment) return;

    if (normalizedPromoCode && !isValidatedPromo) {
      alert('Veuillez valider le code promo avant de soumettre le paiement.');
      return;
    }

    const digitsOnly = (form.transactionNumber || '').replace(/\D/g, '');
    if (hasCommissionDue && digitsOnly.length !== 10) {
      alert('Le numéro de transaction doit contenir exactement 10 chiffres.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        productId: product._id,
        amount: commissionDue
      };

      if (isValidatedPromo) {
        payload.promoCode = normalizedPromoCode;
      }

      if (hasCommissionDue) {
        payload.payerName = form.payerName;
        payload.operator = form.operator;
        payload.transactionNumber = digitsOnly;
      }

      await api.post('/payments', payload);
      alert('Paiement soumis. En attente de vérification.');
      if (onSubmitted) await onSubmitted();
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

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
    tone: 'bg-gray-50 border-gray-200 text-gray-700',
    iconColor: 'text-gray-500'
  };

  if (hasPayment) {
    const StatusIcon = statusConfig.icon;
    const paidCommissionBase = Number(product.payment?.commissionBaseAmount ?? expected);
    const paidCommissionDiscount = Number(product.payment?.commissionDiscountAmount ?? 0);
    const paidCommissionDue = Number(product.payment?.commissionDueAmount ?? product.payment?.amount ?? expected);

    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Statut de paiement</h2>
          <p className="text-gray-500">Suivi de votre transaction</p>
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

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Détails de la transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Produit:</span>
                <span className="font-medium text-gray-900">{product.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prix du produit:</span>
                <span className="font-medium text-gray-900">{Number(product.price).toLocaleString()} FCFA</span>
              </div>
              {product.payment?.promoCodeValue && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Code promo:</span>
                  <span className="font-semibold text-emerald-700">{product.payment.promoCodeValue}</span>
                </div>
              )}
              {product.confirmationNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Code produit:</span>
                  <span className="font-semibold text-gray-900">{product.confirmationNumber}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Commission (base 3%):</span>
                <span className="font-medium text-gray-900">{paidCommissionBase.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Réduction promo:</span>
                <span className="font-medium text-emerald-700">-{paidCommissionDiscount.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Commission à payer:</span>
                <span className="font-semibold text-indigo-700">{paidCommissionDue.toLocaleString()} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statut actuel:</span>
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
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Validation de l'annonce</h1>
        <p className="text-gray-500">Finalisez votre publication en payant la commission</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900 text-sm">Commission de publication</h3>
              <p className="text-indigo-700 text-xs">Base 3% du prix du produit</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">{commissionDue.toLocaleString()} FCFA</div>
              <div className="text-indigo-500 text-xs">sur {Number(product.price).toLocaleString()} FCFA</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-xl border border-indigo-200 bg-white/70 px-3 py-2">
              <p className="text-indigo-500">Base</p>
              <p className="font-semibold text-indigo-800">{Number(commission.baseAmount || 0).toLocaleString()} FCFA</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-emerald-600">Réduction</p>
              <p className="font-semibold text-emerald-700">-{Number(commission.discountAmount || 0).toLocaleString()} FCFA</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-white/70 px-3 py-2">
              <p className="text-indigo-500">À payer</p>
              <p className="font-semibold text-indigo-800">{commissionDue.toLocaleString()} FCFA</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Ticket className="w-4 h-4 text-indigo-600" />
            Code promo commission
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
              placeholder="Ex: FIRST10"
              value={form.promoCode}
              onChange={(e) => setForm((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
              disabled={loading || promoLoading}
            />
            <button
              type="button"
              onClick={validatePromo}
              disabled={loading || promoLoading}
              className="px-4 py-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50"
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
                  Effectuez un transfert mobile de{' '}
                  <span className="font-bold">{commissionDue.toLocaleString()} FCFA</span> et renseignez les
                  détails de la transaction ci-dessous.
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

        {product.confirmationNumber && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-900 text-[12px] mb-1">
              Code produit : <span className="text-indigo-600">{product.confirmationNumber}</span>
            </p>
            <p>
              Communiquez ce code à l’administrateur ou au support lorsque vous confirmez votre commande afin qu’il
              identifie rapidement l’annonce.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {hasCommissionDue && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <User className="w-4 h-4 text-indigo-500" />
                  <span>Nom du payeur *</span>
                </label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                  placeholder="Votre nom complet"
                  value={form.payerName}
                  onChange={(e) => setForm({ ...form, payerName: e.target.value })}
                  disabled={loading}
                  required={hasCommissionDue}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                  <span>Opérateur mobile *</span>
                </label>
                <select
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={form.operator}
                  onChange={(e) => setForm({ ...form, operator: e.target.value })}
                  disabled={loading}
                  required={hasCommissionDue}
                >
                  <option value="MTN">MTN</option>
                  <option value="Airtel">Airtel</option>
                  <option value="Other">Autre</option>
                </select>
                {sendMoneyNumber && (
                  <p className="text-sm text-indigo-700 bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                    Envoyer l&apos;argent au numéro : <span className="font-bold">{sendMoneyNumber}</span>
                  </p>
                )}
              </div>

              <div className="md:col-span-2 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Exemple : où trouver l&apos;ID de la transaction dans le SMS
                </p>
                <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-3 overflow-hidden">
                  <img
                    src="/images/transaction-id-sms-example.png"
                    alt="Exemple de SMS Mobile Money montrant l'ID de la transaction (ex: 7232173826)"
                    className="w-full max-w-md mx-auto rounded-lg border border-gray-200 bg-white shadow-sm object-contain"
                  />
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    Saisissez le numéro indiqué à côté de « ID » ou « ID de la transaction » dans le SMS de confirmation.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <Hash className="w-4 h-4 text-indigo-500" />
                  <span>Numéro de transaction *</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder-gray-400"
                  placeholder="10 chiffres (ex: 7232173826)"
                  value={form.transactionNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm({ ...form, transactionNumber: value });
                  }}
                  disabled={loading}
                  required={hasCommissionDue}
                  title="ID de la transaction : 10 chiffres reçus par SMS"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700">
                  <DollarSign className="w-4 h-4 text-indigo-500" />
                  <span>Montant payé (FCFA)</span>
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-600"
                  value={commissionDue}
                  disabled
                />
              </div>
            </div>
          )}

          {!hasCommissionDue && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Commission annulée grâce au code promo. Cliquez sur le bouton ci-dessous pour envoyer la demande de validation.
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 shadow-lg"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Soumission en cours...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>{hasCommissionDue ? 'Soumettre le paiement' : 'Soumettre la validation promo'}</span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-500">
            Votre annonce sera approuvée sous 24h après vérification administrative
          </p>
        </form>
      </div>
    </div>
  );
}
