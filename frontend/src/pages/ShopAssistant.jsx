import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  Hash,
  Loader2,
  LogOut,
  Mail,
  MessageSquare,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Store,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  UserX,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PERMISSION_GROUPS = [
  {
    title: 'Clients',
    description: 'Commentaires, questions produits et messages acheteurs.',
    permissions: [
      { key: 'respond_to_comments', label: 'Commentaires', description: 'Repondre aux commentaires publics.', icon: MessageSquare },
      { key: 'manage_product_questions', label: 'Questions produits', description: 'Traiter les questions avant achat.', icon: MessageSquare },
      { key: 'respond_to_buyer_messages', label: 'Messages acheteurs', description: 'Repondre aux conversations client.', icon: Mail }
    ]
  },
  {
    title: 'Commandes',
    description: 'Validation, refus, statuts et demandes de livraison.',
    permissions: [
      { key: 'confirm_orders', label: 'Confirmer', description: 'Accepter les commandes recues.', icon: ShoppingBag },
      { key: 'reject_orders', label: 'Rejeter', description: 'Refuser une commande non traitable.', icon: XCircle },
      { key: 'update_order_status', label: 'Statuts', description: 'Mettre a jour le suivi des commandes.', icon: Package },
      { key: 'manage_delivery_requests', label: 'Livraisons', description: 'Gerer les demandes de livraison.', icon: Truck }
    ]
  },
  {
    title: 'Boutique',
    description: 'Consultation du tableau de bord, produits et notifications.',
    permissions: [
      { key: 'manage_product_availability', label: 'Disponibilite', description: 'Activer ou desactiver la disponibilite.', icon: Package },
      { key: 'view_shop_dashboard', label: 'Tableau de bord', description: 'Consulter les indicateurs boutique.', icon: BarChart3 },
      { key: 'view_shop_orders', label: 'Voir commandes', description: 'Acceder a la liste des commandes.', icon: ShoppingBag },
      { key: 'view_shop_products', label: 'Voir produits', description: 'Consulter le catalogue boutique.', icon: Package },
      { key: 'view_shop_notifications', label: 'Notifications', description: 'Voir les alertes boutique.', icon: Bell }
    ]
  }
];

const PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);
const PERMISSION_BY_KEY = Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, permission]));

const PRESETS = [
  {
    key: 'operations',
    label: 'Operations',
    description: 'Commandes, livraisons et lecture du catalogue.',
    permissions: [
      'confirm_orders',
      'reject_orders',
      'update_order_status',
      'manage_delivery_requests',
      'view_shop_orders',
      'view_shop_products',
      'view_shop_notifications'
    ]
  },
  {
    key: 'support',
    label: 'Support client',
    description: 'Questions, commentaires et messages acheteurs.',
    permissions: [
      'respond_to_comments',
      'manage_product_questions',
      'respond_to_buyer_messages',
      'view_shop_products',
      'view_shop_notifications'
    ]
  },
  {
    key: 'manager',
    label: 'Gestion complete',
    description: 'Toutes les permissions assistant disponibles.',
    permissions: PERMISSIONS.map((permission) => permission.key)
  }
];

const ACTION_LABELS = {
  assistant_invited: 'Invitation envoyee',
  assistant_accepted: 'Invitation acceptee',
  assistant_rejected: 'Invitation refusee',
  assistant_removed: 'Assistant retire',
  assistant_left: 'Assistant parti',
  assistant_permissions_updated: 'Permissions modifiees',
  assistant_order_confirmed: 'Commande confirmee',
  assistant_order_rejected: 'Commande rejetee',
  assistant_order_status_updated: 'Statut commande modifie',
  assistant_comment_replied: 'Commentaire traite',
  assistant_message_replied: 'Message acheteur traite',
  assistant_products_viewed: 'Catalogue consulte',
  assistant_product_update_requested: 'Modification produit demandee',
  assistant_product_delete_requested: 'Suppression produit demandee'
};

const getProductImage = (product) => {
  const images = Array.isArray(product?.images) ? product.images : [];
  return images[0] || product?.image || product?.thumbnail || '';
};

const STATUS_COPY = {
  active: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100', Icon: CheckCircle },
  pending: { label: 'Invitation en attente', className: 'bg-amber-50 text-amber-700 ring-amber-100', Icon: Clock },
  removed: { label: 'Retire', className: 'bg-gray-100 text-gray-600 ring-gray-200', Icon: UserX },
  left: { label: 'Parti', className: 'bg-gray-100 text-gray-600 ring-gray-200', Icon: LogOut }
};

const ORDER_STATUS_LABELS = {
  pending_payment: 'Paiement en attente',
  paid: 'Payee',
  pending: 'Nouvelle commande',
  confirmed: 'Confirmee',
  ready_for_delivery: 'Prete a livrer',
  ready_for_pickup: 'Prete au retrait',
  delivering: 'En livraison',
  out_for_delivery: 'En livraison',
  delivery_proof_submitted: 'Preuve soumise',
  picked_up_confirmed: 'Retrait confirme',
  delivered: 'Livree',
  confirmed_by_client: 'Confirmee client',
  completed: 'Terminee',
  cancelled: 'Annulee',
  pending_installment: 'Vente par tranche',
  installment_active: 'Tranche active',
  overdue_installment: 'Tranche en retard',
  dispute_opened: 'Litige'
};

const formatMoney = (value = 0) =>
  `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;

const formatDate = (value) => {
  if (!value) return 'Non defini';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch {
    return 'Date invalide';
  }
};

const getDisplayName = (user, fallback = 'Utilisateur') =>
  user?.shopName || user?.name || user?.email || user?.phone || fallback;

function StatusBadge({ status }) {
  const statusData = STATUS_COPY[status] || STATUS_COPY.pending;
  const Icon = statusData.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${statusData.className}`}>
      <Icon size={13} />
      {statusData.label}
    </span>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
        <Icon size={16} className="text-[#FF6A00]" />
      </div>
      <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
    </div>
  );
}

function PermissionPill({ permissionKey }) {
  const permission = PERMISSION_BY_KEY[permissionKey];
  if (!permission) return null;
  const Icon = permission.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
      <Icon size={12} />
      {permission.label}
    </span>
  );
}

function PermissionSwitch({ permission, checked, onToggle, disabled }) {
  const Icon = permission.icon;
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${checked ? 'border-[#FF6A00]/30 bg-gray-100/50' : 'border-gray-100 bg-white hover:bg-gray-50'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(permission.key)}
        className="mt-1 h-4 w-4 accent-[#FF6A00]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={15} className={checked ? 'text-[#FF6A00]' : 'text-gray-400'} />
          <p className="text-sm font-bold text-gray-900">{permission.label}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{permission.description}</p>
      </div>
    </label>
  );
}

function ActivityLog({ logs, loading }) {
  return (
    <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-gray-900">Journal d'activite</h2>
          <p className="text-sm text-gray-500">Historique des invitations, permissions et actions assistant.</p>
        </div>
        <Activity size={18} className="text-[#FF6A00]" />
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <Loader2 size={18} className="mr-2 animate-spin text-[#FF6A00]" />
            Chargement du journal...
          </div>
        ) : logs.length ? (
          logs.map((log) => (
            <div key={log._id} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#FF6A00] ring-1 ring-gray-100">
                <Activity size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{ACTION_LABELS[log.action] || log.action}</p>
                <p className="text-xs text-gray-500">
                  {getDisplayName(log.actor, log.actorRole === 'owner' ? 'Vendeur' : 'Assistant')} · {formatDate(log.createdAt)}
                </p>
                {Array.isArray(log.metadata?.permissions) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {log.metadata.permissions.slice(0, 6).map((permission) => (
                      <PermissionPill key={permission} permissionKey={permission} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-gray-600">Aucune activite pour le moment.</p>
            <p className="mt-1 text-xs text-gray-400">Les invitations et modifications apparaitront ici.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkspaceOrderRow({ order }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const firstItem = items[0] || {};
  const title = firstItem?.snapshot?.title || firstItem?.name || 'Commande boutique';
  const itemCount = items.reduce((sum, item) => sum + Math.max(1, Number(item?.quantity || 1)), 0);
  const status = String(order?.status || '').trim();
  return (
    <Link
      to={`/seller/orders/detail/${order?._id}`}
      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-3 transition hover:border-[#FF6A00]/30 hover:bg-gray-100"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#FF6A00]">
        <Package size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {ORDER_STATUS_LABELS[status] || status || 'Statut inconnu'} · {itemCount} article{itemCount > 1 ? 's' : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-gray-900">{formatMoney(order?.totalAmount)}</p>
        <ChevronRight size={15} className="ml-auto mt-1 text-gray-300" />
      </div>
    </Link>
  );
}

function WorkspaceTaskCard({ title, description, count, icon: Icon, to, tone = 'orange' }) {
  const toneClass =
    tone === 'red'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-gray-100 text-[#FF6A00] ring-gray-200';
  return (
    <Link to={to} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:border-[#FF6A00]/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 text-2xl font-black text-gray-900">{count}</p>
    </Link>
  );
}

function AssistantWorkspace({ assignment, auditLogs }) {
  const permissions = assignment?.permissions || [];
  const canViewOrders = permissions.includes('view_shop_orders');
  const canManageOrders = permissions.includes('update_order_status');
  const canManageDelivery = permissions.includes('manage_delivery_requests');
  const [summary, setSummary] = useState(null);
  const [urgentOrders, setUrgentOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!canViewOrders && !canManageDelivery) {
      setSummary(null);
      setUrgentOrders([]);
      setDeliveryOrders([]);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError('');
    try {
      const requests = [];
      if (canViewOrders) {
        requests.push(api.get('/orders/seller/summary', { headers: { 'x-skip-cache': '1' } }));
        requests.push(api.get('/orders/seller', { params: { statusGroup: 'new', limit: 5 }, headers: { 'x-skip-cache': '1' } }));
      } else {
        requests.push(Promise.resolve({ data: null }));
        requests.push(Promise.resolve({ data: { items: [] } }));
      }
      if (canManageDelivery) {
        requests.push(api.get('/orders/seller', { params: { statusGroup: 'handoff', limit: 5 }, headers: { 'x-skip-cache': '1' } }));
      } else {
        requests.push(Promise.resolve({ data: { items: [] } }));
      }

      const [summaryRes, urgentRes, deliveryRes] = await Promise.all(requests);
      setSummary(summaryRes.data || null);
      setUrgentOrders(Array.isArray(urgentRes.data?.items) ? urgentRes.data.items : []);
      setDeliveryOrders(Array.isArray(deliveryRes.data?.items) ? deliveryRes.data.items : []);
    } catch (error) {
      setWorkspaceError(error.response?.data?.message || 'Impossible de charger le tableau de travail.');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [canManageDelivery, canViewOrders]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const statusCounts = summary?.statusCounts || {};
  const groupCounts = summary?.groupCounts || {};
  const totalOrders = Number(summary?.totalOrders || summary?.total || 0);
  const totalAmount = Number(summary?.totalAmount || 0);
  const newCount = Number(groupCounts.new || statusCounts.pending || statusCounts.paid || urgentOrders.length || 0);
  const handoffCount = Number(groupCounts.handoff || deliveryOrders.length || 0);
  const problemCount = Number(groupCounts.problems || statusCounts.cancelled || statusCounts.dispute_opened || 0);
  const recentAssistantActions = (auditLogs || []).filter((log) => String(log.actorRole || '') === 'assistant').slice(0, 3);

  return (
    <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-black text-gray-900">Espace de travail</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Commandes, livraisons et actions a traiter pour {getDisplayName(assignment?.shop, 'la boutique')}.
          </p>
        </div>
        <button
          onClick={loadWorkspace}
          disabled={workspaceLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={15} className={workspaceLoading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {workspaceError && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {workspaceError}
        </div>
      )}

      {!canViewOrders && !canManageDelivery ? (
        <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <ShieldCheck size={24} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm font-bold text-gray-600">Aucune permission operationnelle active.</p>
          <p className="mt-1 text-xs text-gray-400">Le proprietaire doit ajouter les permissions commandes ou livraisons.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Commandes" value={workspaceLoading ? '...' : totalOrders} icon={ShoppingBag} />
            <Metric label="Montant" value={workspaceLoading ? '...' : formatMoney(totalAmount)} icon={BarChart3} />
            <Metric label="A traiter" value={workspaceLoading ? '...' : newCount} icon={Clock} />
            <Metric label="Livraisons" value={workspaceLoading ? '...' : handoffCount} icon={Truck} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {canViewOrders && (
              <WorkspaceTaskCard
                title="Nouvelles commandes"
                description="Verifier, confirmer ou preparer les commandes recentes."
                count={newCount}
                icon={ShoppingBag}
                to="/seller/orders?status=new"
              />
            )}
            {canManageDelivery && (
              <WorkspaceTaskCard
                title="File livraison"
                description="Preuves, demandes plateforme et handoff livraison."
                count={handoffCount}
                icon={Truck}
                to="/seller/orders?status=handoff"
                tone="amber"
              />
            )}
            {canManageOrders && (
              <WorkspaceTaskCard
                title="Problemes"
                description="Commandes annulees, en retard ou a surveiller."
                count={problemCount}
                icon={AlertCircle}
                to="/seller/orders?status=problems"
                tone="red"
              />
            )}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {canViewOrders && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-gray-900">Commandes prioritaires</p>
                  <Link to="/seller/orders?status=new" className="text-xs font-bold text-[#FF6A00]">Voir tout</Link>
                </div>
                <div className="space-y-2">
                  {workspaceLoading ? (
                    <div className="h-24 animate-pulse rounded-lg bg-white" />
                  ) : urgentOrders.length ? (
                    urgentOrders.map((order) => <WorkspaceOrderRow key={order._id} order={order} />)
                  ) : (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                      Aucune nouvelle commande.
                    </p>
                  )}
                </div>
              </div>
            )}

            {canManageDelivery && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-gray-900">Livraisons actives</p>
                  <Link to="/seller/orders?status=handoff" className="text-xs font-bold text-[#FF6A00]">Voir tout</Link>
                </div>
                <div className="space-y-2">
                  {workspaceLoading ? (
                    <div className="h-24 animate-pulse rounded-lg bg-white" />
                  ) : deliveryOrders.length ? (
                    deliveryOrders.map((order) => <WorkspaceOrderRow key={order._id} order={order} />)
                  ) : (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-400">
                      Aucune livraison active.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm font-black text-gray-900">Dernieres actions assistant</p>
            <div className="mt-3 space-y-2">
              {recentAssistantActions.length ? (
                recentAssistantActions.map((log) => (
                  <div key={log._id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-800">{ACTION_LABELS[log.action] || log.action}</p>
                      <p className="text-xs text-gray-400">{formatDate(log.createdAt)}</p>
                    </div>
                    <Activity size={15} className="shrink-0 text-[#FF6A00]" />
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-5 text-center text-sm text-gray-400">
                  Les actions de travail apparaitront ici.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function AssistantProductsView() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [requestingId, setRequestingId] = useState('');

  const canViewProducts = permissions.includes('view_shop_products');

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/products/assistant/shop-products', {
        params: { search, status },
        headers: { 'x-skip-cache': '1' }
      });
      setProducts(Array.isArray(data?.items) ? data.items : []);
      setPermissions(Array.isArray(data?.permissions) ? data.permissions : []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Impossible de charger les produits de la boutique.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const sendRequest = async (product, action) => {
    const productId = product?._id || product?.id;
    if (!productId) return;
    const actionLabel = action === 'delete' ? 'suppression' : 'modification';
    const note = window.prompt(`Message pour le proprietaire concernant la ${actionLabel} de "${product?.title || 'ce produit'}"`, '');
    if (note === null) return;
    setRequestingId(`${productId}:${action}`);
    try {
      await api.post(`/products/assistant/products/${productId}/action-request`, {
        action,
        note
      });
      showToast(`Demande de ${actionLabel} envoyee au proprietaire.`, 'success');
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Impossible d envoyer la demande.', 'error');
    } finally {
      setRequestingId('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">Produits boutique</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Consultation du catalogue. Les modifications et suppressions doivent etre validees par le proprietaire.
            </p>
          </div>
          <Link
            to="/seller/assistant/workspace"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft size={15} />
            Workspace
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un produit"
              className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#FF6A00] focus:bg-white"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-[#FF6A00] focus:bg-white"
          >
            <option value="all">Tous statuts</option>
            <option value="approved">Approuves</option>
            <option value="pending">En attente</option>
            <option value="disabled">Desactives</option>
            <option value="rejected">Rejetes</option>
          </select>
          <button
            type="button"
            onClick={loadProducts}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#FF6A00] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </section>

      {error ? (
        <section className="rounded-lg border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">
          {error}
        </section>
      ) : null}

      {!loading && !canViewProducts ? (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <ShieldCheck size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 font-bold text-gray-700">Permission produits non active.</p>
          <p className="mt-1 text-sm text-gray-500">Le proprietaire doit activer "Voir produits".</p>
        </section>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-lg border border-gray-100 bg-white" />
          ))}
        </div>
      ) : products.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((product) => {
            const productId = product?._id || product?.id;
            const image = getProductImage(product);
            const updatePending = requestingId === `${productId}:update`;
            const deletePending = requestingId === `${productId}:delete`;
            return (
              <article key={productId} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {image ? (
                      <img src={image} alt={product?.title || 'Produit'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Package size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-black text-gray-900">{product?.title || 'Produit'}</h3>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-500">
                        {product?.status || 'draft'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-black text-[#FF6A00]">{formatMoney(product?.price)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product?.description || 'Aucune description.'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <Link
                    to={`/product/${product?.slug || productId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <Eye size={14} />
                    Voir
                  </Link>
                  <button
                    type="button"
                    onClick={() => sendRequest(product, 'update')}
                    disabled={Boolean(requestingId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-bold text-[#B45309] disabled:opacity-60"
                  >
                    {updatePending ? <Loader2 size={14} className="animate-spin" /> : <Edit3 size={14} />}
                    Demander modification
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRequest(product, 'delete')}
                    disabled={Boolean(requestingId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"
                  >
                    {deletePending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Demander suppression
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <Package size={28} className="mx-auto text-gray-300" />
          <p className="mt-3 font-bold text-gray-700">Aucun produit trouve.</p>
          <p className="mt-1 text-sm text-gray-500">Essayez un autre filtre ou une autre recherche.</p>
        </section>
      )}
    </div>
  );
}

function OwnerView({ shopId }) {
  const { showToast } = useToast();
  const [assistant, setAssistant] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lookupType, setLookupType] = useState('email');
  const [lookupValue, setLookupValue] = useState('');
  const [selectedPerms, setSelectedPerms] = useState(PRESETS[0].permissions);
  const [editPerms, setEditPerms] = useState(false);

  const activePermissions = assistant?.permissions || selectedPerms;
  const permissionCount = activePermissions.length;

  const fetchAudit = useCallback(async () => {
    if (!shopId) return;
    setAuditLoading(true);
    try {
      const { data } = await api.get(`/shops/${shopId}/assistant/audit?limit=12`);
      setAuditLogs(Array.isArray(data.data) ? data.data : []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [shopId]);

  const fetchAssistant = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/shops/${shopId}/assistant`);
      const nextAssistant = data.data || null;
      setAssistant(nextAssistant);
      if (nextAssistant?.permissions) setSelectedPerms(nextAssistant.permissions);
    } catch {
      setAssistant(null);
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchAssistant();
    fetchAudit();
  }, [fetchAssistant, fetchAudit]);

  const togglePerm = (key) => {
    setSelectedPerms((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const applyPreset = (preset) => {
    setSelectedPerms(preset.permissions);
    setEditPerms(true);
  };

  const invite = async () => {
    const value = lookupValue.trim();
    if (!value) return showToast('Veuillez saisir une valeur.', 'error');
    if (!selectedPerms.length) return showToast('Selectionnez au moins une permission.', 'error');

    setActionLoading(true);
    try {
      const body = { permissions: selectedPerms };
      if (lookupType === 'email') body.email = value;
      else if (lookupType === 'phone') body.phone = value;
      else body.userId = value;

      await api.post(`/shops/${shopId}/assistant/invite`, body);
      showToast('Invitation envoyee.', 'success');
      setLookupValue('');
      await fetchAssistant();
      await fetchAudit();
    } catch (error) {
      showToast(error.response?.data?.message || "Erreur lors de l'invitation.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const remove = async () => {
    if (!confirm('Retirer cet assistant ?')) return;
    setActionLoading(true);
    try {
      await api.delete(`/shops/${shopId}/assistant`);
      showToast('Assistant retire.', 'success');
      setAssistant(null);
      setEditPerms(false);
      setSelectedPerms(PRESETS[0].permissions);
      await fetchAudit();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedPerms.length) return showToast('Selectionnez au moins une permission.', 'error');
    setActionLoading(true);
    try {
      await api.put(`/shops/${shopId}/assistant/permissions`, { permissions: selectedPerms });
      showToast('Permissions mises a jour.', 'success');
      setEditPerms(false);
      await fetchAssistant();
      await fetchAudit();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur.', 'error');
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

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Assistant" value={assistant ? '1' : '0'} icon={UserCheck} />
        <Metric label="Statut" value={assistant?.status === 'active' ? 'Actif' : assistant?.status === 'pending' ? 'Attente' : 'Libre'} icon={ShieldCheck} />
        <Metric label="Permissions" value={permissionCount} icon={SlidersHorizontal} />
      </div>

      <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Assistant de boutique</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Confiez les operations quotidiennes a une personne de confiance avec des droits limites et visibles.
              Un seul assistant peut etre actif ou en attente pour cette boutique.
            </p>
          </div>
          {assistant && <StatusBadge status={assistant.status} />}
        </div>

        {assistant ? (
          <div className="mt-5 flex flex-col gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6A00] text-lg font-black text-white">
                {getDisplayName(assistant.assistant, 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-gray-900">{getDisplayName(assistant.assistant)}</p>
                <p className="truncate text-sm text-gray-500">{assistant.assistant?.email || assistant.assistant?.phone || 'Contact non renseigne'}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Invite le {formatDate(assistant.invitedAt)}
                  {assistant.acceptedAt ? ` · Accepte le ${formatDate(assistant.acceptedAt)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={remove}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Retirer
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#FF6A00] ring-1 ring-gray-100">
                <UserPlus size={18} />
              </div>
              <div>
                <p className="font-bold text-gray-900">Aucun assistant configure</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Choisissez un utilisateur existant avec son email, telephone ou ID, puis envoyez une invitation.
                </p>
              </div>
            </div>
          </div>
        )}

        {!assistant && (
          <div className="mt-5 grid gap-3 lg:grid-cols-[180px_1fr_auto]">
            <select
              value={lookupType}
              onChange={(event) => setLookupType(event.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#FF6A00]/25"
            >
              <option value="email">Email</option>
              <option value="phone">Telephone</option>
              <option value="userId">ID utilisateur</option>
            </select>
            <div className="relative">
              {lookupType === 'email' && <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              {lookupType === 'phone' && <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              {lookupType === 'userId' && <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
              <input
                type="text"
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && invite()}
                placeholder={lookupType === 'email' ? 'email@exemple.com' : lookupType === 'phone' ? '+243...' : 'ID utilisateur'}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6A00]/25"
              />
            </div>
            <button
              onClick={invite}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FF6A00] px-4 py-2.5 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Inviter
            </button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900">Permissions assistant</h2>
            <p className="mt-1 text-sm text-gray-500">Selectionnez exactement ce que l'assistant peut faire.</p>
          </div>
          {assistant && (
            <button
              onClick={() => {
                setSelectedPerms(assistant.permissions || []);
                setEditPerms((prev) => !prev);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <SlidersHorizontal size={15} />
              {editPerms ? 'Annuler' : 'Modifier'}
            </button>
          )}
        </div>

        {(!assistant || editPerms) && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-[#FF6A00]/30 hover:bg-gray-100"
              >
                <p className="text-sm font-black text-gray-900">{preset.label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{preset.description}</p>
              </button>
            ))}
          </div>
        )}

        {assistant && !editPerms ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {(assistant.permissions || []).length ? (
              assistant.permissions.map((permission) => <PermissionPill key={permission} permissionKey={permission} />)
            ) : (
              <p className="text-sm text-gray-400">Aucune permission definie.</p>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-3">
                  <p className="text-sm font-black text-gray-900">{group.title}</p>
                  <p className="text-xs text-gray-500">{group.description}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {group.permissions.map((permission) => (
                    <PermissionSwitch
                      key={permission.key}
                      permission={permission}
                      checked={selectedPerms.includes(permission.key)}
                      onToggle={togglePerm}
                      disabled={actionLoading}
                    />
                  ))}
                </div>
              </div>
            ))}
            {assistant && (
              <button
                onClick={savePermissions}
                disabled={actionLoading}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FF6A00] px-4 py-3 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50 sm:w-auto"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Enregistrer les permissions
              </button>
            )}
          </div>
        )}
      </section>

      <ActivityLog logs={auditLogs} loading={auditLoading} />
    </div>
  );
}

function AssistantView() {
  const { showToast } = useToast();
  const [assignment, setAssignment] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchAudit = useCallback(async (shopId) => {
    if (!shopId) return setAuditLogs([]);
    setAuditLoading(true);
    try {
      const { data } = await api.get(`/shops/${shopId}/assistant/audit?limit=10`);
      setAuditLogs(Array.isArray(data.data) ? data.data : []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentRes, invitesRes] = await Promise.all([
        api.get('/shops/me/assistant-shop'),
        api.get('/shops/me/assistant-invitations')
      ]);
      const nextAssignment = assignmentRes.data.data || null;
      setAssignment(nextAssignment);
      setPendingInvites(Array.isArray(invitesRes.data.data) ? invitesRes.data.data : []);
      await fetchAudit(nextAssignment?.shop?._id);
    } catch {
      setAssignment(null);
      setPendingInvites([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [fetchAudit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const accept = async (shopId) => {
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/accept`);
      showToast('Invitation acceptee.', 'success');
      await fetchData();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async (shopId) => {
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/reject`);
      showToast('Invitation refusee.', 'success');
      await fetchData();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const leave = async (shopId) => {
    if (!confirm("Quitter votre role d'assistant dans cette boutique ?")) return;
    setActionLoading(true);
    try {
      await api.post(`/shops/${shopId}/assistant/leave`);
      showToast('Vous avez quitte la boutique.', 'success');
      setAssignment(null);
      setAuditLogs([]);
      await fetchData();
    } catch (error) {
      showToast(error.response?.data?.message || 'Erreur.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const quickLinks = useMemo(() => {
    const permissions = assignment?.permissions || [];
    const shop = assignment?.shop || {};
    return [
      permissions.includes('view_shop_dashboard') && { to: `/shop/${shop.slug || shop._id}`, label: 'Boutique', icon: Store },
      permissions.includes('view_shop_orders') && { to: '/seller/orders', label: 'Commandes', icon: ShoppingBag },
      permissions.includes('view_shop_products') && { to: '/seller/products', label: 'Produits', icon: Package },
      permissions.includes('view_shop_notifications') && { to: '/notifications', label: 'Notifications', icon: Bell }
    ].filter(Boolean);
  }, [assignment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#FF6A00]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingInvites.length > 0 && (
        <section className="rounded-lg border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-amber-100">
              <Clock size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-black text-gray-900">Invitation en attente</h2>
              <p className="mt-1 text-sm text-gray-600">Acceptez seulement si vous connaissez la boutique et le vendeur.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pendingInvites.map((invite) => (
              <div key={invite._id} className="rounded-lg border border-amber-100 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-gray-900">{getDisplayName(invite.shop, 'Boutique')}</p>
                    <p className="text-sm text-gray-500">Invite par {getDisplayName(invite.owner, 'Vendeur')} · {formatDate(invite.invitedAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(invite.permissions || []).map((permission) => <PermissionPill key={permission} permissionKey={permission} />)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => reject(invite.shop?._id)}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <XCircle size={15} />
                      Refuser
                    </button>
                    <button
                      onClick={() => accept(invite.shop?._id)}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#FF6A00] px-3 py-2 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Accepter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {assignment ? (
        <>
          <AssistantWorkspace assignment={assignment} auditLogs={auditLogs} />

          <section className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6A00] text-white">
                  <Store size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-500">Vous assistez</p>
                  <h2 className="truncate text-xl font-black text-gray-900">{getDisplayName(assignment.shop, 'Boutique')}</h2>
                  <p className="mt-1 text-xs text-gray-400">Actif depuis {formatDate(assignment.acceptedAt)}</p>
                </div>
              </div>
              <StatusBadge status="active" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Permissions" value={(assignment.permissions || []).length} icon={ShieldCheck} />
              <Metric label="Invitations" value={pendingInvites.length} icon={Clock} />
              <Metric label="Acces" value={quickLinks.length} icon={ChevronRight} />
            </div>

            <div className="mt-5">
              <p className="text-sm font-black text-gray-900">Vos permissions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(assignment.permissions || []).length ? (
                  assignment.permissions.map((permission) => <PermissionPill key={permission} permissionKey={permission} />)
                ) : (
                  <p className="text-sm text-gray-400">Aucune permission definie.</p>
                )}
              </div>
            </div>

            {quickLinks.length > 0 && (
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 hover:text-[#FF6A00]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon size={16} />
                        {link.label}
                      </span>
                      <ChevronRight size={15} />
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="mt-5 border-t border-gray-100 pt-4">
              <button
                onClick={() => leave(assignment.shop?._id)}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                Quitter ce role
              </button>
            </div>
          </section>

          <ActivityLog logs={auditLogs} loading={auditLoading} />
        </>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <Store size={40} className="mx-auto text-gray-300" />
          <p className="mt-3 text-base font-black text-gray-600">Vous n'etes assistant d'aucune boutique.</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-400">
            Lorsqu'un vendeur vous invite, l'invitation apparait ici avec les permissions demandees.
          </p>
        </section>
      )}
    </div>
  );
}

export default function ShopAssistant() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isShop = user?.accountType === 'shop';
  const shopId = user?._id || user?.id;
  const isAssistantProductsRoute = String(location.pathname || '') === '/seller/products';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/my" className="rounded-lg p-2 hover:bg-gray-100" aria-label="Retour">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-gray-900">Assistant boutique</h1>
              <p className="truncate text-xs text-gray-500">
                {isShop ? 'Delegation professionnelle de votre boutique' : "Votre role d'assistant HDMarket"}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 sm:inline-flex">
            <ShieldCheck size={14} className="text-[#FF6A00]" />
            Acces controle
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!user ? (
          <section className="rounded-lg border border-gray-100 bg-white p-10 text-center shadow-sm">
            <AlertCircle size={32} className="mx-auto text-gray-300" />
            <p className="mt-2 font-bold text-gray-600">Connectez-vous pour acceder a cette page.</p>
          </section>
        ) : isShop ? (
          <OwnerView shopId={shopId} />
        ) : isAssistantProductsRoute ? (
          <AssistantProductsView />
        ) : (
          <AssistantView />
        )}
      </main>
    </div>
  );
}
