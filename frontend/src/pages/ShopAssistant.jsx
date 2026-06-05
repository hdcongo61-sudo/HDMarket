import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, UserPlus, Mail, Phone, Hash, Search, ShieldCheck,
  Trash2, LogOut, Settings, CheckCircle, XCircle, Clock,
  Activity, Zap, Store, MessageSquare, ShoppingBag, Truck,
  Bell, BarChart3, Package, AlertCircle, Loader2, UserX, UserCheck
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// ─── Permission labels & icons ────────────────────────────
const PERMISSIONS_MAP = [
  { key: 'respond_to_comments', label: 'Répondre aux commentaires', icon: MessageSquare },
  { key: 'manage_product_questions', label: 'Gérer les questions produits', icon: MessageSquare },
  { key: 'confirm_orders', label: 'Confirmer les commandes', icon: ShoppingBag },
  { key: 'reject_orders', label: 'Rejeter les commandes', icon: XCircle },
  { key: 'update_order_status', label: 'Mettre à jour les statuts de commande', icon: Package },
  { key: 'manage_delivery_requests', label: 'Gérer les demandes de livraison', icon: Truck },
  { key: 'respond_to_buyer_messages', label: 'Répondre aux messages acheteurs', icon: MessageSquare },
  { key: 'manage_product_availability', label: 'Gérer la disponibilité des produits', icon: Package },
  { key: 'view_shop_dashboard', label: 'Voir le tableau de bord', icon: BarChart3 },
  { key: 'view_shop_orders', label: 'Voir les commandes', icon: ShoppingBag },
  { key: 'view_shop_products', label: 'Voir les produits', icon: Package },
  { key: 'view_shop_notifications', label: 'Voir les notifications', icon: Bell }
];

// ─── Owner View ───────────────────────────────────────────

function OwnerView({ shopId }) {
  const { showToast } = useToast();
  const [assistant, setAssistant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Invite form
  const [lookupType, setLookupType] = useState('email');
  const [lookupValue, setLookupValue] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Permissions edit
  const [editPerms, setEditPerms] = useState(false);
  const [selectedPerms, setSelectedPerms] = useState([]);

  const fetchAssistant = useCallback(async () => {
    try {
      const { data } = await api.get(`/shops/${shopId}/assistant`);
      setAssistant(data.data);
      if (data.data) setSelectedPerms(data.data.permissions || []);
    } catch {
      // No assistant yet — that's fine
      setAssistant(null);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => { fetchAssistant(); }, [fetchAssistant]);

  const invite = async () => {
    if (!lookupValue.trim()) return showToast('Veuillez saisir une valeur.', 'error');
    setInviteLoading(true);
    try {
      const body = {};
      if (lookupType === 'email') body.email = lookupValue.trim();
      else if (lookupType === 'phone') body.phone = lookupValue.trim();
      else body.userId = lookupValue.trim();
      await api.post(`/shops/${shopId}/assistant/invite`, body);
      showToast('Invitation envoyée !', 'success');
      setLookupValue('');
      fetchAssistant();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur lors de l\'invitation.', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm('Retirer cet assistant ?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/shops/${shopId}/assistant`);
      showToast('Assistant retiré.', 'success');
      fetchAssistant();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const savePermissions = async () => {
    setActionLoading(true);
    try {
      await api.put(`/shops/${shopId}/assistant/permissions`, { permissions: selectedPerms });
      showToast('Permissions mises à jour.', 'success');
      setEditPerms(false);
      fetchAssistant();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePerm = (key) => {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6A00]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <UserPlus size={18} className="text-[#FF6A00]" />
          Inviter un assistant
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Un assistant peut vous aider à gérer les commandes, répondre aux clients, et plus encore.
          Une seule personne à la fois.
        </p>

        <div className="mt-4 flex gap-2">
          <select
            value={lookupType}
            onChange={e => setLookupType(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium"
          >
            <option value="email">Email</option>
            <option value="phone">Téléphone</option>
            <option value="userId">ID Utilisateur</option>
          </select>
          <div className="relative flex-1">
            {lookupType === 'email' && <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
            {lookupType === 'phone' && <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
            {lookupType === 'userId' && <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
            <input
              type="text"
              value={lookupValue}
              onChange={e => setLookupValue(e.target.value)}
              placeholder={lookupType === 'email' ? 'email@exemple.com' : lookupType === 'phone' ? '+243...' : 'ID utilisateur'}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6A00]/30"
              onKeyDown={e => e.key === 'Enter' && invite()}
            />
          </div>
          <button
            onClick={invite}
            disabled={inviteLoading || !!assistant}
            className="flex items-center gap-1.5 rounded-xl bg-[#FF6A00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e05e00] disabled:opacity-50"
          >
            {inviteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Inviter
          </button>
        </div>
      </div>

      {/* Current Assistant */}
      {assistant ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6A00]/10 text-[#FF6A00] font-black">
                {(assistant.assistant?.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-900">{assistant.assistant?.name || '—'}</p>
                <p className="text-sm text-gray-500">{assistant.assistant?.email || assistant.assistant?.phone || ''}</p>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  assistant.status === 'active' ? 'bg-green-100 text-green-700' :
                  assistant.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {assistant.status === 'active' ? <CheckCircle size={12} /> : <Clock size={12} />}
                  {assistant.status === 'active' ? 'Actif' : 'En attente'}
                </span>
              </div>
            </div>
            <button
              onClick={remove}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
              Retirer
            </button>
          </div>

          {/* Permissions */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-700">Permissions</h4>
              <button
                onClick={() => setEditPerms(!editPerms)}
                className="flex items-center gap-1 text-xs font-semibold text-[#FF6A00]"
              >
                <Settings size={12} />
                {editPerms ? 'Annuler' : 'Modifier'}
              </button>
            </div>

            {editPerms ? (
              <div className="mt-3 space-y-2">
                {PERMISSIONS_MAP.map(({ key, label, icon: Icon }) => (
                  <label key={key} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPerms.includes(key)}
                      onChange={() => togglePerm(key)}
                      className="accent-[#FF6A00]"
                    />
                    <Icon size={14} className="text-gray-400" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
                <button
                  onClick={savePermissions}
                  disabled={actionLoading}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF6A00] py-2.5 text-sm font-bold text-white hover:bg-[#e05e00] disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Enregistrer les permissions
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(assistant.permissions || []).length === 0 ? (
                  <span className="text-sm text-gray-400">Aucune permission définie.</span>
                ) : (
                  (assistant.permissions || []).map(perm => {
                    const def = PERMISSIONS_MAP.find(p => p.key === perm);
                    return def ? (
                      <span key={perm} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <def.icon size={12} />{def.label}
                      </span>
                    ) : null;
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
          <UserPlus size={32} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-400">Aucun assistant pour le moment.</p>
          <p className="text-xs text-gray-300">Invitez quelqu'un pour vous aider à gérer votre boutique.</p>
        </div>
      )}

      {/* Activity Log placeholder */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Activity size={16} className="text-[#FF6A00]" />
          Journal d'activité
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          Les actions de l'assistant sont enregistrées ici (commentaires, commandes, etc.).
        </p>
      </div>
    </div>
  );
}

// ─── Assistant View ────────────────────────────────────────

function AssistantView({ userId }) {
  const { showToast } = useToast();
  const [assignment, setAssignment] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [shopRes, invitesRes] = await Promise.all([
        api.get('/shops/me/assistant-shop'),
        api.get('/shops') // We'll filter pending invites client-side
      ]);
      setAssignment(shopRes.data.data);
      // For pending invites, we need to check each shop's assistant status
      // This is a simplification — ideally a dedicated endpoint
      setPendingInvites([]);
    } catch {
      // OK
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // For pending invites, we'd need a dedicated endpoint. Simplified for now.
  // The user would see invites via notifications.

  const accept = async (shopId) => {
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/accept`);
      showToast('Invitation acceptée !', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (shopId) => {
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/reject`);
      showToast('Invitation refusée.', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const leave = async (shopId) => {
    if (!confirm('Quitter votre rôle d\'assistant dans cette boutique ?')) return;
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/leave`);
      showToast('Vous avez quitté la boutique.', 'success');
      setAssignment(null);
    } catch (e) {
      showToast(e.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6A00]" size={32} />
      </div>
    );
  }

  // If user is an active assistant
  if (assignment) {
    const { shop, permissions } = assignment;
    return (
      <div className="space-y-6">
        {/* Active Assignment Card */}
        <div className="rounded-2xl border border-l-4 border-l-[#FF6A00] bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6A00]/10 text-2xl">
              🏪
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Vous êtes assistant de</p>
              <p className="text-lg font-black text-gray-900">{shop?.shopName || shop?.name || 'Boutique'}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              <ShieldCheck size={12} />Actif
            </span>
          </div>

          {/* Permissions display */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vos permissions</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(permissions || []).map(perm => {
                const def = PERMISSIONS_MAP.find(p => p.key === perm);
                return def ? (
                  <span key={perm} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    <def.icon size={12} />{def.label}
                  </span>
                ) : null;
              })}
              {(permissions || []).length === 0 && (
                <span className="text-xs text-gray-400">Aucune permission spécifique.</span>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {permissions?.includes('view_shop_dashboard') && (
              <Link to={`/shop/${shop?._id}`} className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <BarChart3 size={16} className="text-[#FF6A00]" /> Tableau de bord
              </Link>
            )}
            {permissions?.includes('view_shop_orders') && (
              <Link to="/seller/orders" className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <ShoppingBag size={16} className="text-[#FF6A00]" /> Commandes
              </Link>
            )}
            {permissions?.includes('view_shop_products') && (
              <Link to="/seller/products" className="flex items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Package size={16} className="text-[#FF6A00]" /> Produits
              </Link>
            )}
          </div>

          {/* Leave */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={() => leave(shop?._id)}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
              Quitter ce rôle
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No assignment
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">
      <Store size={40} className="mx-auto text-gray-300" />
      <p className="mt-3 text-base font-semibold text-gray-500">Vous n'êtes assistant d'aucune boutique.</p>
      <p className="mt-1 text-sm text-gray-400">
        Lorsqu'un vendeur vous invitera, vous recevrez une notification.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function ShopAssistant() {
  const { user } = useContext(AuthContext);

  const isShop = user?.accountType === 'shop';
  const shopId = user?._id || user?.id;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link to="/my" className="rounded-xl p-1.5 hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-gray-900">Assistant boutique</h1>
            <p className="text-xs text-gray-500">
              {isShop ? 'Gérez votre assistant' : 'Gérez votre rôle d\'assistant'}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {!user ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
            <AlertCircle size={32} className="mx-auto text-gray-300" />
            <p className="mt-2 font-medium text-gray-500">Connectez-vous pour accéder à cette page.</p>
          </div>
        ) : isShop ? (
          <OwnerView shopId={shopId} />
        ) : (
          <AssistantView userId={user?._id || user?.id} />
        )}
      </div>
    </div>
  );
}
