import { PLACEHOLDER_IMAGE } from '../utils/placeholderImage';
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
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { appAlert, appConfirm } from '../utils/appDialog';
import SelectedAttributesList from '../components/orders/SelectedAttributesList';
import GlassHeader from '../components/orders/GlassHeader';

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

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
    if (!(await appConfirm('Êtes-vous sûr de vouloir supprimer ce brouillon ?'))) return;
    
    setDeleting((prev) => ({ ...prev, [draftId]: true }));
    try {
      await api.delete(`/orders/draft/${draftId}`);
      setDrafts((prev) => prev.filter((draft) => draft._id !== draftId));
    } catch (err) {
      appAlert(err.response?.data?.message || 'Impossible de supprimer le brouillon.');
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
      appAlert('Impossible de restaurer le brouillon.');
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="hd-order-flow min-h-screen bg-[#f6f3ee]">
        <GlassHeader title="Commandes en brouillon" subtitle="Chargement..." backTo="/orders" />
        <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6">
          <div className="animate-pulse rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-[#e7dfd5]">
            <div className="h-5 w-36 rounded bg-gray-200" />
            <div className="mt-4 h-24 rounded-2xl bg-gray-100" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hd-order-flow min-h-screen bg-[#f6f3ee]">
      <GlassHeader title="Commandes en brouillon" subtitle={`${drafts.length} commande${drafts.length > 1 ? 's' : ''} à finaliser`} backTo="/orders" />
      <div className="mx-auto max-w-5xl space-y-4 px-3 py-4 pb-28 sm:px-6 sm:py-6">
        <header className="relative overflow-hidden rounded-[28px] bg-[#171411] p-5 text-white shadow-[0_16px_45px_rgba(35,31,27,0.16)] sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#e85d00]/40 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#e85d00]">
              <ClipboardList size={23} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-300">Reprendre plus tard</p>
              <h1 className="mt-1 text-xl font-black sm:text-2xl">Finalisez votre commande</h1>
              <p className="mt-1 text-xs font-semibold leading-5 text-white/60 sm:text-sm">Vos articles et informations déjà saisis restent disponibles ici.</p>
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
          <div className="rounded-[28px] border border-[#e7dfd5] bg-white p-8 text-center shadow-sm sm:p-12">
            <div className="mx-auto w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <ClipboardList size={32} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-3">Aucun brouillon</h2>
            <p className="text-gray-600 font-medium mb-8">
              Vous n'avez pas de commandes en brouillon pour le moment.
            </p>
            <Link
              to="/cart"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-6 text-sm font-black text-white transition active:scale-95"
            >
              <ShoppingCart size={18} />
              Voir mon panier
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {drafts.map((draft) => {
              const depositAmount = Number(draft.paidAmount || 0);
              const remainingAmount =
                draft.remainingAmount != null
                  ? Math.max(0, Number(draft.remainingAmount || 0))
                  : Math.max(0, Number(draft.totalAmount || 0) - depositAmount);
              const draftPayment = draft.draftPayments?.[0] || {};

              return (
                <div
                  key={draft._id}
                  className="overflow-hidden rounded-[24px] border border-[#e7dfd5] bg-white shadow-[0_8px_28px_rgba(35,31,27,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(35,31,27,0.1)]"
                >
                  {/* Draft Header */}
                  <div className="flex items-center justify-between border-b border-orange-100 bg-[#fff4e8] px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e85d00] shadow-sm">
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
                                src={item.snapshot?.image || item.product?.images?.[0] || PLACEHOLDER_IMAGE}
                                alt={item.snapshot?.title || item.product?.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                to={buildProductPath(item.product)}
                                className="font-black text-gray-900 text-sm sm:text-base line-clamp-2 mb-1 hover:text-neutral-600 transition-colors"
                              >
                                {item.snapshot?.title || item.product?.title}
                              </Link>
                              <p className="text-xs text-gray-600 font-medium mb-1">Quantité: x{item.quantity}</p>
                              <SelectedAttributesList
                                selectedAttributes={item.selectedAttributes}
                                compact
                                className="mb-1"
                              />
                              <p className="text-xs font-semibold text-gray-500">
                                {formatCurrency(item.unitPrice ?? item.snapshot?.price ?? item.product?.price ?? 0)} / unité
                              </p>
                              <p className="text-sm font-black text-neutral-600">
                                {formatCurrency(item.lineTotal ?? (item.unitPrice ?? item.snapshot?.price ?? item.product?.price ?? 0) * (item.quantity || 1))}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Info */}
                    {draftPayment.payerName || draftPayment.transactionCode ? (
                      <div className="rounded-2xl border-2 border-neutral-200 bg-neutral-50 p-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase text-neutral-700 tracking-wide">Informations de paiement</h4>
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
                      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800 font-medium">
                          Les informations de paiement n'ont pas encore été renseignées.
                        </p>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="space-y-2 border-t border-gray-100 pt-4">
                      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-700 font-semibold">Total commande</span>
                        <span className="font-black text-gray-900 text-lg">
                          {formatCurrency(draft.totalAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-neutral-50 rounded-xl border border-neutral-200">
                        <span className="text-neutral-700 font-semibold">Acompte (25%)</span>
                        <span className="font-black text-neutral-600 text-lg">
                          {formatCurrency(depositAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-700 font-semibold">Reste à payer</span>
                        <span className="font-black text-gray-900 text-lg">
                          {formatCurrency(remainingAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                      <Link
                        to="/orders/checkout"
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-5 text-sm font-black text-white transition active:scale-95"
                      >
                        <CreditCard size={18} />
                        Continuer la commande
                      </Link>
                      <button
                        onClick={() => handleDeleteDraft(draft._id)}
                        disabled={deleting[draft._id]}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-300 bg-white text-red-600 px-6 py-3.5 text-sm font-semibold hover:bg-red-50 transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-60"
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
