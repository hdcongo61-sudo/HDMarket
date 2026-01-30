import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import {
  ClipboardList,
  ArrowLeft,
  ShoppingCart,
  CreditCard,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle,
  Package
} from 'lucide-react';
import { buildProductPath } from '../utils/links';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

export default function DraftOrders() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState({});

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadDrafts();
  }, [user, navigate]);

  const loadDrafts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/orders/draft');
      setDrafts(data.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les brouillons.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?')) return;
    
    setDeleting((prev) => ({ ...prev, [draftId]: true }));
    try {
      await api.delete(`/orders/draft/${draftId}`);
      setDrafts((prev) => prev.filter((draft) => draft._id !== draftId));
    } catch (err) {
      alert(err.response?.data?.message || 'Impossible de supprimer le brouillon.');
    } finally {
      setDeleting((prev) => ({ ...prev, [draftId]: false }));
    }
  };

  const handleContinueCheckout = async (draft) => {
    // Restore cart items from draft and navigate to checkout
    try {
      // The checkout page will load the cart automatically
      // Draft payments will be restored when user visits checkout
      navigate('/orders/checkout');
    } catch (error) {
      alert('Impossible de restaurer le brouillon.');
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Header */}
        <header className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl p-6 sm:p-8 border-2 border-blue-100 shadow-lg">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="font-medium text-sm">Retour au profil</span>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <ClipboardList size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900">Mes commandes en brouillon</h1>
              <p className="text-gray-600 font-medium mt-1">
                Commandes non finalisées que vous pouvez compléter
              </p>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-semibold">{error}</p>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl p-8 sm:p-12 text-center">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <ClipboardList size={32} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Aucun brouillon</h2>
            <p className="text-gray-600 font-medium mb-8">
              Vous n'avez pas de commandes en brouillon pour le moment.
            </p>
            <Link
              to="/cart"
              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm"
            >
              <ShoppingCart size={18} />
              Voir mon panier
            </Link>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {drafts.map((draft) => {
              const depositAmount = Math.round((draft.totalAmount || 0) * 0.25);
              const remainingAmount = Math.max(0, (draft.totalAmount || 0) - depositAmount);
              const draftPayment = draft.draftPayments?.[0] || {};

              return (
                <div
                  key={draft._id}
                  className="bg-white rounded-3xl border-2 border-gray-200 shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300"
                >
                  {/* Draft Header */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-b-2 border-amber-200 px-5 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Clock size={20} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900">Brouillon</h3>
                        <p className="text-xs text-gray-600 font-medium">
                          Créé le {new Date(draft.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDraft(draft._id)}
                      disabled={deleting[draft._id]}
                      className="p-2 rounded-full bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-all duration-200 active:scale-95"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="p-5 sm:p-6 space-y-5">
                    {/* Items */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold uppercase text-gray-500 tracking-wide">Articles</h4>
                      <div className="space-y-2">
                        {draft.items?.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-200">
                              <img
                                src={item.snapshot?.image || item.product?.images?.[0] || 'https://via.placeholder.com/80'}
                                alt={item.snapshot?.title || item.product?.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                to={buildProductPath(item.product)}
                                className="font-black text-gray-900 text-sm sm:text-base line-clamp-2 mb-1 hover:text-blue-600 transition-colors"
                              >
                                {item.snapshot?.title || item.product?.title}
                              </Link>
                              <p className="text-xs text-gray-600 font-medium mb-1">Quantité: x{item.quantity}</p>
                              <p className="text-sm font-black text-blue-600">
                                {formatCurrency((item.snapshot?.price || item.product?.price || 0) * (item.quantity || 1))} FCFA
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Info */}
                    {draftPayment.payerName || draftPayment.transactionCode ? (
                      <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase text-blue-700 tracking-wide">Informations de paiement</h4>
                        {draftPayment.payerName && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Payeur:</span> {draftPayment.payerName}
                          </p>
                        )}
                        {draftPayment.transactionCode && (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold">Code transaction:</span> {draftPayment.transactionCode}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 font-medium">
                          Les informations de paiement n'ont pas encore été renseignées.
                        </p>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="border-t-2 border-gray-200 pt-4 space-y-3">
                      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-700 font-semibold">Total commande</span>
                        <span className="font-black text-gray-900 text-lg">
                          {formatCurrency(draft.totalAmount)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-xl border border-blue-200">
                        <span className="text-blue-700 font-semibold">Acompte (25%)</span>
                        <span className="font-black text-blue-600 text-lg">
                          {formatCurrency(depositAmount)} FCFA
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-700 font-semibold">Reste à payer</span>
                        <span className="font-black text-gray-900 text-lg">
                          {formatCurrency(remainingAmount)} FCFA
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t-2 border-gray-200">
                      <Link
                        to="/orders/checkout"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-3xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm"
                      >
                        <CreditCard size={18} />
                        Continuer la commande
                      </Link>
                      <button
                        onClick={() => handleDeleteDraft(draft._id)}
                        disabled={deleting[draft._id]}
                        className="inline-flex items-center justify-center gap-2 rounded-3xl border border-red-300 bg-white text-red-600 px-6 py-3.5 text-sm font-semibold hover:bg-red-50 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
                      >
                        <Trash2 size={18} />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
