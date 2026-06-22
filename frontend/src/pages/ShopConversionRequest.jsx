import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api, { verifyTransactionCodeAvailability } from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  Store,
  Upload,
  X,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  CreditCard,
  Hash,
  DollarSign,
  FileImage,
  Image as ImageIcon,
  Wallet
} from 'lucide-react';
import { useNetworks } from '../hooks/useNetworks';

const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ShopConversionRequest() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { app, formatPrice, getRuntimeValue } = useAppSettings();
  const { networks, loading: networksLoading } = useNetworks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money');
  const [walletInfo, setWalletInfo] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Get active networks sorted by order
  const activeNetworks = useMemo(
    () => networks.filter((n) => n.isActive).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [networks]
  );
  
  const [form, setForm] = useState({
    shopName: '',
    shopAddress: '',
    shopDescription: '',
    transactionName: '',
    transactionNumber: '',
    paymentAmount: '50000',
    operator: ''
  });
  const requiredAmount = useMemo(() => {
    const value = Number(app?.shopConversionAmount);
    if (!Number.isFinite(value) || value <= 0) return 50000;
    return value;
  }, [app?.shopConversionAmount]);
  const requiredAmountLabel = formatPrice(requiredAmount);
  const shopConversionEnabled = useMemo(() => {
    const value = getRuntimeValue('enable_shop_conversion', true);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (['false', '0', 'no', 'non', 'off'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    return true;
  }, [getRuntimeValue]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, paymentAmount: String(requiredAmount) }));
  }, [requiredAmount]);

  // Update operator when networks load
  useEffect(() => {
    if (paymentMethod !== 'mobile_money') return;
    if (!networksLoading) {
      if (activeNetworks.length > 0 && !form.operator) {
        setForm((prev) => ({ ...prev, operator: activeNetworks[0].name }));
      } else if (activeNetworks.length === 0 && !form.operator) {
        setForm((prev) => ({ ...prev, operator: 'MTN' }));
      }
    }
  }, [networksLoading, activeNetworks, form.operator, paymentMethod]);

  useEffect(() => {
    let alive = true;
    const loadWallet = async () => {
      setWalletLoading(true);
      try {
        const { data } = await api.get('/wallet');
        if (alive) setWalletInfo(data || null);
      } catch {
        if (alive) setWalletInfo(null);
      } finally {
        if (alive) setWalletLoading(false);
      }
    };
    loadWallet();
    return () => {
      alive = false;
    };
  }, []);

  const [shopLogoFile, setShopLogoFile] = useState(null);
  const [shopLogoPreview, setShopLogoPreview] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState('');

  // Check if user is not a shop
  useEffect(() => {
    if (user && user.accountType === 'shop') {
      showToast('Cette page est réservée aux utilisateurs non-boutiques.', { variant: 'error' });
      navigate('/');
    }
  }, [user, navigate, showToast]);

  // Load user's existing requests
  useEffect(() => {
    if (user && user.accountType !== 'shop') {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const { data } = await api.get('/users/shop-conversion-requests');
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleShopLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Le logo doit être une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Le logo doit faire moins de 5 Mo.');
      return;
    }
    setShopLogoFile(file);
    const preview = await readFileAsDataURL(file);
    setShopLogoPreview(preview);
    setError('');
    e.target.value = '';
  };

  const handlePaymentProofChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('La preuve de boutique doit être une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La preuve de boutique doit faire moins de 5 Mo.');
      return;
    }
    setPaymentProofFile(file);
    const preview = await readFileAsDataURL(file);
    setPaymentProofPreview(preview);
    setError('');
    e.target.value = '';
  };

  const removeShopLogo = () => {
    setShopLogoFile(null);
    setShopLogoPreview('');
  };

  const removePaymentProof = () => {
    setPaymentProofFile(null);
    setPaymentProofPreview('');
  };

  const handleTransactionNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((prev) => ({ ...prev, transactionNumber: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!shopConversionEnabled) {
      setError('Les demandes Devenir Boutique sont temporairement désactivées.');
      return;
    }

    // Validation
    if (!form.shopName.trim()) {
      setError('Le nom de la boutique est requis.');
      return;
    }
    if (!form.shopAddress.trim()) {
      setError("L'adresse de la boutique est requise.");
      return;
    }
    if (paymentMethod === 'wallet') {
      const availableBalance = Number(walletInfo?.availableBalance || 0);
      if (!walletInfo) {
        setError('Portefeuille HDMarket indisponible. Rechargez ou réessayez plus tard.');
        return;
      }
      if (availableBalance < requiredAmount) {
        setError(`Solde portefeuille insuffisant. Disponible: ${formatPrice(availableBalance)}.`);
        return;
      }
    } else {
      if (!form.transactionName.trim()) {
        setError('Le nom de la transaction est requis.');
        return;
      }
      if (form.transactionNumber.length !== 10) {
        setError('Le numéro de transaction doit contenir exactement 10 chiffres.');
        return;
      }
      try {
        const verification = await verifyTransactionCodeAvailability(form.transactionNumber);
        if (!verification.available) {
          setError(verification.message || 'Ce code de transaction est déjà utilisé.');
          return;
        }
      } catch (verificationError) {
        setError(
          verificationError?.response?.data?.message ||
            'Impossible de vérifier le numéro de transaction.'
        );
        return;
      }
    }
    if (Number(form.paymentAmount) !== requiredAmount) {
      setError(`Le montant du paiement doit être de ${requiredAmountLabel}.`);
      return;
    }
    if (paymentMethod === 'mobile_money' && !paymentProofFile) {
      setError('La preuve de boutique est requise.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('shopName', form.shopName.trim());
      payload.append('shopAddress', form.shopAddress.trim());
      payload.append('shopDescription', form.shopDescription.trim());
      payload.append('paymentMethod', paymentMethod);
      if (paymentMethod === 'mobile_money') {
        payload.append('transactionName', form.transactionName.trim());
        payload.append('transactionNumber', form.transactionNumber);
        payload.append('operator', form.operator);
      }
      payload.append('paymentAmount', form.paymentAmount);
      if (shopLogoFile) {
        payload.append('shopLogo', shopLogoFile);
      }
      if (paymentMethod === 'mobile_money') {
        payload.append('paymentProof', paymentProofFile);
      }

      const { data } = await api.post('/users/shop-conversion-requests', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast(data.message || 'Demande soumise avec succès. Traitement sous 48h.', {
        variant: 'success'
      });

      // Reset form
      setForm({
        shopName: '',
        shopAddress: '',
        shopDescription: '',
        transactionName: '',
        transactionNumber: '',
        paymentAmount: String(requiredAmount),
        operator: activeNetworks.length > 0 ? activeNetworks[0].name : 'MTN'
      });
      setPaymentMethod('mobile_money');
      setShopLogoFile(null);
      setShopLogoPreview('');
      setPaymentProofFile(null);
      setPaymentProofPreview('');
      api.get('/wallet').then(({ data: walletData }) => setWalletInfo(walletData || null)).catch(() => {});
      await loadRequests();
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Une erreur est survenue.';
      setError(message);
      showToast(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
            <CheckCircle size={14} />
            Approuvée
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <XCircle size={14} />
            Rejetée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
            <Clock size={14} />
            En attente
          </span>
        );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return (
      <div className="hd-products-flow flex min-h-screen items-center justify-center bg-[#f6f2ec] px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-[#FF6A00]">
            <Store className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Veuillez vous connecter pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (user.accountType === 'shop') {
    return null;
  }

  const hasPendingRequest = requests.some((r) => r.status === 'pending');

  return (
    <div className="hd-products-flow min-h-screen bg-[#f6f2ec] px-3 py-4 pb-24 text-gray-900 sm:px-5 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="hd-products-hero rounded-2xl p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/16 px-3 py-1.5 ring-1 ring-white/20">
                <Store className="h-4 w-4" />
                <span className="text-xs font-black uppercase tracking-wide">Compte vendeur</span>
              </div>
              <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Devenir Boutique</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/86">
                Soumettez votre demande, ajoutez vos preuves et suivez la validation depuis un espace clair.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center sm:min-w-64">
              <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/18">
                <p className="text-lg font-black">{requiredAmountLabel}</p>
                <p className="text-[11px] font-bold text-white/72">montant</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-3 py-2 ring-1 ring-white/18">
                <p className="text-lg font-black">48h</p>
                <p className="text-[11px] font-bold text-white/72">traitement</p>
              </div>
            </div>
          </div>
        </section>

        {/* Existing Requests */}
        {requests.length > 0 && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#FF6A00]">Suivi</p>
                <h2 className="mt-1 text-xl font-black text-gray-900">Mes demandes</h2>
              </div>
              {loadingRequests ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-[#FF6A00]" />
              ) : null}
            </div>
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request._id}
                  className="rounded-2xl border border-gray-200 bg-gray-100/30 p-4 transition hover:bg-gray-100"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-gray-900">{request.shopName}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-gray-500">{request.shopAddress}</p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-gray-500">
                    Soumise le {formatDate(request.createdAt)}
                    {request.processedAt && ` · Traitée le ${formatDate(request.processedAt)}`}
                  </div>
                  {request.rejectionReason && (
                    <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-700">
                        <strong>Raison du rejet:</strong> {request.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Form */}
        {!shopConversionEnabled ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-bold text-amber-800 shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            Les demandes Devenir Boutique sont temporairement désactivées par l’administration.
          </div>
        ) : !hasPendingRequest ? (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_14px_34px_rgba(117,75,36,0.08)] sm:p-6">
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#FF6A00]">Informations boutique</p>
                <h2 className="mt-1 text-xl font-black text-gray-900">Profil public</h2>
              </div>
              {/* Shop Name */}
              <div>
                <label className="mb-2 block text-sm font-black text-gray-800">
                  Nom de la boutique <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.shopName}
                  onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
                  className="min-h-[52px] w-full rounded-xl border border-gray-200 bg-gray-100/35 px-4 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                  placeholder="Ex: Ma Super Boutique"
                  required
                />
              </div>

              {/* Shop Address */}
              <div>
                <label className="mb-2 block text-sm font-black text-gray-800">
                  Adresse de la boutique <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.shopAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, shopAddress: e.target.value }))}
                  className="min-h-[52px] w-full rounded-xl border border-gray-200 bg-gray-100/35 px-4 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                  placeholder="Ex: Avenue de la République, Brazzaville"
                  required
                />
              </div>

              {/* Shop Description */}
              <div>
                <label className="mb-2 block text-sm font-black text-gray-800">
                  Description de la boutique
                </label>
                <textarea
                  value={form.shopDescription}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, shopDescription: e.target.value }))
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-100/35 px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#FF6A00] focus:bg-white focus:ring-4 focus:ring-gray-200"
                  placeholder="Décrivez votre boutique..."
                />
              </div>

              {/* Shop Logo */}
              <div>
                <label className="mb-2 block text-sm font-black text-gray-800">
                  Logo de la boutique
                </label>
                {shopLogoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={shopLogoPreview}
                      alt="Logo preview"
                      className="h-32 w-32 rounded-2xl border border-gray-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeShopLogo}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 transition-colors hover:bg-gray-100">
                    <ImageIcon className="mb-2 text-[#FF6A00]" size={32} />
                    <span className="text-sm font-black text-gray-500">Cliquez pour ajouter un logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleShopLogoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Payment Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="mb-4 flex items-center gap-2 text-xl font-black text-gray-900">
                  <DollarSign size={20} className="text-[#FF6A00]" />
                  Informations de paiement
                </h3>
                <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-100/50 p-4">
                  <p className="mb-1 text-sm font-black text-gray-900">
                    Montant requis: <span className="text-lg text-[#FF6A00]">{requiredAmountLabel}</span>
                  </p>
                  <p className="text-xs font-semibold leading-5 text-gray-600">
                    Payez {requiredAmountLabel} par Mobile Money ou directement avec votre Portefeuille HDMarket.
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      paymentMethod === 'mobile_money'
                        ? 'border-[#FF6A00] bg-gray-100 text-gray-500 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard size={18} />
                      <p className="text-sm font-black">Mobile Money</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Paiement avec preuve et ID transaction.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      paymentMethod === 'wallet'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                        : 'border-emerald-100 bg-white text-gray-700 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wallet size={18} />
                      <p className="text-sm font-black">Portefeuille HDMarket</p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {walletLoading
                        ? 'Lecture du solde...'
                        : walletInfo
                          ? `Disponible: ${formatPrice(walletInfo.availableBalance || 0)}`
                          : 'Rechargez votre portefeuille pour payer instantanément.'}
                    </p>
                  </button>
                </div>

                {paymentMethod === 'wallet' && (
                  <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                    Le paiement est débité immédiatement. Si la demande est refusée, le montant est remboursé automatiquement dans votre portefeuille.
                  </div>
                )}

                {paymentMethod === 'mobile_money' && (
                  <>
                {/* Transaction image example */}
                <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-sm font-black text-gray-900">
                    Exemple de message de confirmation (où trouver l’ID de la transaction)
                  </p>
                  <p className="mb-3 text-xs font-semibold leading-5 text-gray-600">
                    Après votre paiement Mobile Money, vous recevrez un SMS. L’<strong>ID de la transaction</strong> (souvent noté « ID : ») est le numéro à 10 chiffres à indiquer ci-dessous.
                  </p>
                  <div className="flex justify-center">
                    <img
                      src="/images/transaction-sms-example-shop-conversion.png"
                      alt="Exemple de SMS de confirmation avec l’ID de la transaction"
                      className="max-h-64 max-w-full rounded-2xl border border-gray-200 object-contain shadow-sm"
                    />
                  </div>
                </div>

                {/* Transaction Name */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-black text-gray-800">
                    Nom de la transaction <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-100/35 px-4 py-3 transition-all focus-within:border-[#FF6A00] focus-within:bg-white focus-within:ring-4 focus-within:ring-gray-200">
                    <CreditCard size={18} className="flex-shrink-0 text-[#FF6A00]" />
                    <input
                      type="text"
                      value={form.transactionName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, transactionName: e.target.value }))
                      }
                      className="w-full border-none bg-transparent p-0 text-sm font-semibold focus:outline-none"
                      placeholder="Ex: Jean K."
                      required
                    />
                  </div>
                </div>

                {/* Operator Selection */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-black text-gray-800">
                    Opérateur Mobile Money <span className="text-red-500">*</span>
                  </label>
                  {networksLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-transparent" />
                    </div>
                  ) : activeNetworks.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {activeNetworks.map((network) => (
                          <button
                            key={network._id}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, operator: network.name }))}
                            className={`rounded-xl border px-4 py-3 text-left text-sm font-black transition-all ${
                              form.operator === network.name
                                ? 'border-[#FF6A00] bg-gray-100 text-gray-500 shadow-sm'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <div className="font-bold">{network.name}</div>
                            <div className="mt-1 text-xs text-gray-500">{network.phoneNumber}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, operator: 'MTN' }))}
                        className={`rounded-xl border px-4 py-3 text-sm font-black transition-all ${
                          form.operator === 'MTN'
                            ? 'border-[#FF6A00] bg-gray-100 text-gray-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        MTN
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, operator: 'Airtel' }))}
                        className={`rounded-xl border px-4 py-3 text-sm font-black transition-all ${
                          form.operator === 'Airtel'
                            ? 'border-[#FF6A00] bg-gray-100 text-gray-500'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Airtel
                      </button>
                    </div>
                  )}
                </div>

                {/* Transaction Number */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-black text-gray-800">
                    Numéro de transaction (10 chiffres) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-100/35 px-4 py-3 transition-all focus-within:border-[#FF6A00] focus-within:bg-white focus-within:ring-4 focus-within:ring-gray-200">
                    <Hash size={18} className="flex-shrink-0 text-[#FF6A00]" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.transactionNumber}
                      onChange={handleTransactionNumberChange}
                      className="w-full border-none bg-transparent p-0 font-mono text-sm font-semibold focus:outline-none"
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Le numéro de transaction se trouve dans le SMS de confirmation Mobile Money
                  </p>
                </div>

                {/* Payment Amount */}
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-black text-gray-800">
                    Montant payé <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.paymentAmount}
                    disabled
                    readOnly
                    className="min-h-[52px] w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-4 text-sm font-black text-gray-700"
                    placeholder="50000"
                    required
                  />
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Montant fixe requis pour la conversion en boutique
                  </p>
                </div>

                {/* Preuve de boutique */}
                <div>
                  <label className="mb-2 block text-sm font-black text-gray-800">
                    Preuve de boutique <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-3 text-xs font-semibold leading-5 text-gray-600">
                    Joignez une preuve d’existence de votre boutique : papier de la boutique, photo de la boutique, ou une facture portant le nom de la boutique.
                  </p>
                  {paymentProofPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={paymentProofPreview}
                        alt="Aperçu de la preuve de boutique"
                        className="h-auto max-w-md rounded-2xl border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={removePaymentProof}
                        className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex min-h-[150px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 transition-colors hover:bg-gray-100">
                      <FileImage className="mb-2 flex-shrink-0 text-[#FF6A00]" size={32} />
                      <span className="text-center text-sm font-black text-gray-500">
                        Cliquez pour ajouter une preuve
                      </span>
                      <span className="mt-1 text-center text-xs font-semibold text-gray-500">
                        Papier de la boutique, photo ou facture avec le nom de la boutique
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePaymentProofChange}
                        className="hidden"
                        required
                      />
                    </label>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="hd-primary-button flex min-h-[54px] w-full items-center justify-center rounded-full px-6 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Envoi en cours...' : 'Soumettre la demande'}
              </button>

              <p className="text-center text-xs font-semibold leading-5 text-gray-500">
                Votre demande sera traitée sous 48h. Vous recevrez une notification une fois la
                demande traitée.
              </p>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 shadow-[0_14px_34px_rgba(117,75,36,0.08)]">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 flex-shrink-0 text-amber-600" size={20} />
              <div>
                <h3 className="mb-1 font-black text-amber-900">Demande en attente</h3>
                <p className="text-sm font-semibold leading-6 text-amber-700">
                  Vous avez déjà une demande en attente de traitement. Veuillez attendre la réponse
                  avant de soumettre une nouvelle demande.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
