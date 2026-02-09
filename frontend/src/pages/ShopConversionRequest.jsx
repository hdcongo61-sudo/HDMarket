import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
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
  Image as ImageIcon
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
  const { networks, loading: networksLoading } = useNetworks();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Get active networks sorted by order
  const activeNetworks = useMemo(
    () => networks.filter((n) => n.isActive).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [networks]
  );
  
  // Get first active network as default operator
  const defaultOperator = activeNetworks.length > 0 ? activeNetworks[0].name : 'MTN';

  const [form, setForm] = useState({
    shopName: '',
    shopAddress: '',
    shopDescription: '',
    transactionName: '',
    transactionNumber: '',
    paymentAmount: '50000',
    operator: ''
  });

  // Update operator when networks load
  useEffect(() => {
    if (!networksLoading) {
      if (activeNetworks.length > 0 && !form.operator) {
        setForm((prev) => ({ ...prev, operator: activeNetworks[0].name }));
      } else if (activeNetworks.length === 0 && !form.operator) {
        setForm((prev) => ({ ...prev, operator: 'MTN' }));
      }
    }
  }, [networksLoading, activeNetworks, form.operator]);

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
      setError('La preuve de paiement doit être une image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La preuve de paiement doit faire moins de 5 Mo.');
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

    // Validation
    if (!form.shopName.trim()) {
      setError('Le nom de la boutique est requis.');
      return;
    }
    if (!form.shopAddress.trim()) {
      setError("L'adresse de la boutique est requise.");
      return;
    }
    if (!form.transactionName.trim()) {
      setError('Le nom de la transaction est requis.');
      return;
    }
    if (form.transactionNumber.length !== 10) {
      setError('Le numéro de transaction doit contenir exactement 10 chiffres.');
      return;
    }
    if (Number(form.paymentAmount) !== 50000) {
      setError('Le montant du paiement doit être de 50.000 FCFA.');
      return;
    }
    if (!paymentProofFile) {
      setError('La preuve de paiement est requise.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('shopName', form.shopName.trim());
      payload.append('shopAddress', form.shopAddress.trim());
      payload.append('shopDescription', form.shopDescription.trim());
      payload.append('transactionName', form.transactionName.trim());
      payload.append('transactionNumber', form.transactionNumber);
      payload.append('paymentAmount', form.paymentAmount);
      payload.append('operator', form.operator);
      if (shopLogoFile) {
        payload.append('shopLogo', shopLogoFile);
      }
      payload.append('paymentProof', paymentProofFile);

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
        paymentAmount: '50000',
        operator: activeNetworks.length > 0 ? activeNetworks[0].name : 'MTN'
      });
      setShopLogoFile(null);
      setShopLogoPreview('');
      setPaymentProofFile(null);
      setPaymentProofPreview('');
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Veuillez vous connecter pour accéder à cette page.</p>
        </div>
      </div>
    );
  }

  if (user.accountType === 'shop') {
    return null;
  }

  const hasPendingRequest = requests.some((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Store size={24} />
            </div>
            <h1 className="text-3xl font-black text-gray-900">Devenir Boutique</h1>
          </div>
          <p className="text-gray-600">
            Soumettez une demande pour convertir votre compte particulier en boutique. Traitement
            sous 48h.
          </p>
        </div>

        {/* Existing Requests */}
        {requests.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Mes demandes</h2>
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request._id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{request.shopName}</h3>
                      <p className="text-sm text-gray-600">{request.shopAddress}</p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Soumise le {formatDate(request.createdAt)}
                    {request.processedAt && ` · Traitée le ${formatDate(request.processedAt)}`}
                  </div>
                  {request.rejectionReason && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        <strong>Raison du rejet:</strong> {request.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        {!hasPendingRequest ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              {/* Shop Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Nom de la boutique <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.shopName}
                  onChange={(e) => setForm((prev) => ({ ...prev, shopName: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder="Ex: Ma Super Boutique"
                  required
                />
              </div>

              {/* Shop Address */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Adresse de la boutique <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.shopAddress}
                  onChange={(e) => setForm((prev) => ({ ...prev, shopAddress: e.target.value }))}
                  className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  placeholder="Ex: Avenue de la République, Brazzaville"
                  required
                />
              </div>

              {/* Shop Description */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description de la boutique
                </label>
                <textarea
                  value={form.shopDescription}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, shopDescription: e.target.value }))
                  }
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Décrivez votre boutique..."
                />
              </div>

              {/* Shop Logo */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Logo de la boutique
                </label>
                {shopLogoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={shopLogoPreview}
                      alt="Logo preview"
                      className="w-32 h-32 object-cover rounded-xl border-2 border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={removeShopLogo}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <ImageIcon className="text-gray-400 mb-2" size={32} />
                    <span className="text-sm text-gray-600">Cliquez pour ajouter un logo</span>
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
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign size={20} className="text-indigo-600" />
                  Informations de paiement
                </h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Montant requis: <span className="text-lg">50.000 FCFA</span>
                  </p>
                  <p className="text-xs text-blue-700">
                    Veuillez effectuer un paiement de 50.000 FCFA et fournir les informations de
                    transaction ci-dessous.
                  </p>
                </div>

                {/* Transaction Name */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nom de la transaction <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border-2 border-gray-300 px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                    <CreditCard size={18} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      value={form.transactionName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, transactionName: e.target.value }))
                      }
                      className="w-full border-none p-0 text-sm focus:outline-none"
                      placeholder="Ex: Jean K."
                      required
                    />
                  </div>
                </div>

                {/* Operator Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Opérateur Mobile Money <span className="text-red-500">*</span>
                  </label>
                  {networksLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    </div>
                  ) : activeNetworks.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeNetworks.map((network) => (
                          <button
                            key={network._id}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, operator: network.name }))}
                            className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all text-left ${
                              form.operator === network.name
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            }`}
                          >
                            <div className="font-bold">{network.name}</div>
                            <div className="text-xs text-gray-600 mt-1">{network.phoneNumber}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, operator: 'MTN' }))}
                        className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                          form.operator === 'MTN'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        MTN
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, operator: 'Airtel' }))}
                        className={`px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                          form.operator === 'Airtel'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        Airtel
                      </button>
                    </div>
                  )}
                </div>

                {/* Transaction Number */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Numéro de transaction (10 chiffres) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border-2 border-gray-300 px-4 py-3 bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                    <Hash size={18} className="text-gray-400 flex-shrink-0" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.transactionNumber}
                      onChange={handleTransactionNumberChange}
                      className="w-full border-none p-0 text-sm font-mono focus:outline-none"
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Le numéro de transaction se trouve dans le SMS de confirmation Mobile Money
                  </p>
                </div>

                {/* Payment Amount */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Montant payé <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.paymentAmount}
                    disabled
                    readOnly
                    className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-sm bg-gray-100 text-gray-700 cursor-not-allowed"
                    placeholder="50000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Montant fixe requis pour la conversion en boutique
                  </p>
                </div>

                {/* Payment Proof */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Preuve de paiement <span className="text-red-500">*</span>
                  </label>
                  {paymentProofPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={paymentProofPreview}
                        alt="Payment proof preview"
                        className="max-w-md h-auto rounded-xl border-2 border-gray-300"
                      />
                      <button
                        type="button"
                        onClick={removePaymentProof}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                      <FileImage className="text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-600">
                        Cliquez pour ajouter la preuve de paiement
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
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? 'Envoi en cours...' : 'Soumettre la demande'}
              </button>

              <p className="text-xs text-center text-gray-500">
                Votre demande sera traitée sous 48h. Vous recevrez une notification une fois la
                demande traitée.
              </p>
            </div>
          </form>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <Clock className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">Demande en attente</h3>
                <p className="text-sm text-yellow-700">
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
