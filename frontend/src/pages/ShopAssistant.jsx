import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, ArrowLeftOnRectangleIcon, ArrowPathIcon, BellIcon, BuildingStorefrontIcon, ChartBarIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, ChevronRightIcon, ClockIcon, CubeIcon, EnvelopeIcon, ExclamationCircleIcon, EyeIcon, HashtagIcon, MagnifyingGlassIcon, PencilSquareIcon, PhoneIcon, ShieldCheckIcon, ShoppingBagIcon, TrashIcon, TruckIcon, UserGroupIcon, UserIcon, UserMinusIcon, UserPlusIcon, XCircleIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PERMISSION_GROUPS = [
  {
    title: 'Clients',
    description: 'Commentaires, questions produits et messages acheteurs.',
    permissions: [
      { key: 'respond_to_comments', label: 'Commentaires', description: 'Repondre aux commentaires publics.', icon: ChatBubbleLeftRightIcon },
      { key: 'manage_product_questions', label: 'Questions produits', description: 'Traiter les questions avant achat.', icon: ChatBubbleLeftRightIcon },
      { key: 'respond_to_buyer_messages', label: 'Messages acheteurs', description: 'Repondre aux conversations client.', icon: EnvelopeIcon }
    ]
  },
  {
    title: 'Commandes',
    description: 'Validation, refus, statuts et demandes de livraison.',
    permissions: [
      { key: 'confirm_orders', label: 'Confirmer', description: 'Accepter les commandes recues.', icon: ShoppingBagIcon },
      { key: 'reject_orders', label: 'Rejeter', description: 'Refuser une commande non traitable.', icon: XCircleIcon },
      { key: 'update_order_status', label: 'Statuts', description: 'Mettre a jour le suivi des commandes.', icon: CubeIcon },
      { key: 'manage_delivery_requests', label: 'Livraisons', description: 'Gerer les demandes de livraison.', icon: TruckIcon }
    ]
  },
  {
    title: 'Boutique',
    description: 'Consultation du tableau de bord, produits et notifications.',
    permissions: [
      { key: 'manage_product_availability', label: 'Disponibilite', description: 'Activer ou desactiver la disponibilite.', icon: CubeIcon },
      { key: 'view_shop_dashboard', label: 'Tableau de bord', description: 'Consulter les indicateurs boutique.', icon: ChartBarIcon },
      { key: 'view_shop_orders', label: 'Voir commandes', description: 'Acceder a la liste des commandes.', icon: ShoppingBagIcon },
      { key: 'view_shop_products', label: 'Voir produits', description: 'Consulter le catalogue boutique.', icon: CubeIcon },
      { key: 'view_shop_notifications', label: 'Notifications', description: 'Voir les alertes boutique.', icon: BellIcon }
    ]
  }
];

const PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);
const PERMISSION_BY_KEY = Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, permission]));
const ASSISTANT_PHONE_PREFIX = '+243';

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
  assistant_invited: 'Invitation envoyée',
  assistant_accepted: 'Invitation acceptée',
  assistant_rejected: 'Invitation refusée',
  assistant_removed: 'Assistant retiré',
  assistant_left: 'Assistant parti',
  assistant_permissions_updated: 'Permissions modifiées',
  assistant_order_confirmed: 'Commande confirmée',
  assistant_order_rejected: 'Commande rejetée',
  assistant_order_status_updated: 'Statut commande modifié',
  assistant_order_viewed: 'Commande consultée',
  assistant_comment_replied: 'Commentaire traité',
  assistant_message_replied: 'Message acheteur traité',
  assistant_conversation_viewed: 'Conversation consultée',
  assistant_conversation_archived: 'Conversation archivée',
  assistant_conversation_unarchived: 'Conversation désarchivée',
  assistant_conversation_deleted: 'Conversation supprimée',
  assistant_conversation_delegated: 'Conversation déléguée',
  assistant_conversation_delegation_cleared: 'Délégation retirée',
  assistant_message_reaction_added: 'Réaction ajoutée',
  assistant_message_reaction_removed: 'Réaction retirée',
  assistant_message_deleted: 'Message supprimé',
  assistant_products_viewed: 'Catalogue consulté',
  assistant_product_update_requested: 'Modification produit demandée',
  assistant_product_delete_requested: 'Suppression produit demandée'
};

const getProductImage = (product) => {
  const images = Array.isArray(product?.images) ? product.images : [];
  return images[0] || product?.image || product?.thumbnail || '';
};

const STATUS_COPY = {
  active: { label: 'Actif', className: 'bg-emerald-50 text-emerald-700 ring-emerald-100', Icon: CheckCircleIcon },
  pending: { label: 'Invitation en attente', className: 'bg-amber-50 text-amber-700 ring-amber-100', Icon: ClockIcon },
  removed: { label: 'Retire', className: 'bg-gray-100 text-gray-600 ring-gray-200', Icon: UserMinusIcon },
  left: { label: 'Parti', className: 'bg-gray-100 text-gray-600 ring-gray-200', Icon: ArrowLeftOnRectangleIcon }
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
      <Icon className="h-[13px] w-[13px]" />
      {statusData.label}
    </span>
  );
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#8a8378]">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff0e4] text-[#e85d00]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-black text-[#231f1b]">{value}</p>
    </div>
  );
}

function PermissionPill({ permissionKey }) {
  const permission = PERMISSION_BY_KEY[permissionKey];
  if (!permission) return null;
  const Icon = permission.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f2ee] px-2.5 py-1 text-[11px] font-bold text-[#6b6459]">
      <Icon className="h-3 w-3" />
      {permission.label}
    </span>
  );
}

function PermissionSwitch({ permission, checked, onToggle, disabled }) {
  const Icon = permission.icon;
  return (
    <label className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${checked ? 'border-[#e85d00]/30 bg-gray-100/50' : 'border-gray-100 bg-white hover:bg-gray-50'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(permission.key)}
        className="mt-1 h-4 w-4 accent-[#e85d00]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-[15px] w-[15px] ${checked ? 'text-[#e85d00]' : 'text-gray-400'}`} />
          <p className="text-sm font-bold text-gray-900">{permission.label}</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{permission.description}</p>
      </div>
    </label>
  );
}

const HISTORY_FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'invitations', label: 'Invitations', match: ['assistant_invited', 'assistant_accepted', 'assistant_rejected', 'assistant_removed', 'assistant_left', 'assistant_permissions_updated'] },
  { key: 'messages', label: 'Messages', match: ['assistant_message_replied', 'assistant_conversation_viewed', 'assistant_conversation_archived', 'assistant_conversation_unarchived', 'assistant_conversation_deleted', 'assistant_conversation_delegated', 'assistant_conversation_delegation_cleared', 'assistant_message_reaction_added', 'assistant_message_reaction_removed', 'assistant_message_deleted'] },
  { key: 'orders', label: 'Commandes', match: ['assistant_order_confirmed', 'assistant_order_rejected', 'assistant_order_status_updated', 'assistant_order_viewed'] },
  { key: 'products', label: 'Produits', match: ['assistant_products_viewed', 'assistant_product_update_requested', 'assistant_product_delete_requested', 'assistant_comment_replied'] }
];

function ActivityLog({ logs, loading }) {
  const [filter, setFilter] = React.useState('all');
  const filteredLogs = useMemo(() => {
    const activeFilter = HISTORY_FILTERS.find((entry) => entry.key === filter);
    if (!activeFilter?.match) return logs;
    return (logs || []).filter((log) => activeFilter.match.includes(log.action));
  }, [filter, logs]);

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-[#231f1b]">Journal d'activité</h2>
          <p className="text-xs font-semibold text-[#8a8378]">Historique complet des invitations, permissions et actions de l'assistant.</p>
        </div>
        <ChartBarIcon className="h-[18px] w-[18px] shrink-0 text-[#e85d00]" />
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HISTORY_FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={`inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-[11px] font-black transition ${
              filter === entry.key
                ? 'bg-[#231f1b] text-white'
                : 'bg-[#f5f2ee] text-[#6b6459] ring-1 ring-[#e2dcd2] active:scale-95'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm font-bold text-[#8a8378]">
            <ArrowPathIcon className="mr-2 h-[18px] w-[18px] animate-spin text-[#e85d00]" />
            Chargement du journal...
          </div>
        ) : filteredLogs.length ? (
          filteredLogs.map((log) => (
            <div key={log._id} className="flex gap-3 rounded-xl bg-[#faf7f2] px-3 py-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${
                log.actorRole === 'assistant'
                  ? 'bg-[#fff0e4] text-[#e85d00] ring-[#f0c7aa]'
                  : 'bg-white text-[#6b6459] ring-[#e2dcd2]'
              }`}>
                {log.actorRole === 'assistant' ? <UserGroupIcon className="h-4 w-4" /> : <ChartBarIcon className="h-[15px] w-[15px]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm font-black text-[#231f1b]">{ACTION_LABELS[log.action] || log.action}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                    log.actorRole === 'assistant' ? 'bg-[#fff0e4] text-[#e85d00]' : 'bg-[#f5f2ee] text-[#6b6459]'
                  }`}>
                    {log.actorRole === 'assistant' ? 'Assistant' : 'Propriétaire'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs font-semibold text-[#8a8378]">
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
          <div className="rounded-xl border border-dashed border-[#e2dcd2] bg-[#faf7f2] px-4 py-6 text-center">
            <p className="text-sm font-black text-[#6b6459]">Aucune activité pour le moment.</p>
            <p className="mt-1 text-xs font-semibold text-[#8a8378]">Les invitations et modifications apparaîtront ici.</p>
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
      className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-3 transition hover:border-[#e85d00]/30 hover:bg-gray-100"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[#e85d00]">
        <CubeIcon className="h-[17px] w-[17px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {ORDER_STATUS_LABELS[status] || status || 'Statut inconnu'} · {itemCount} article{itemCount > 1 ? 's' : ''}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-black text-gray-900">{formatMoney(order?.totalAmount)}</p>
        <ChevronRightIcon className="ml-auto mt-1 text-gray-300 h-[15px] w-[15px]" />
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
        : 'bg-gray-100 text-[#e85d00] ring-gray-200';
  return (
    <Link to={to} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm transition hover:border-[#e85d00]/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-gray-900">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
          <Icon className="h-[18px] w-[18px]" />
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
          <ArrowPathIcon className={`h-[15px] w-[15px] ${workspaceLoading ? 'animate-spin' : ''}`} />
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
          <ShieldCheckIcon className="mx-auto text-gray-300 h-6 w-6" />
          <p className="mt-2 text-sm font-bold text-gray-600">Aucune permission operationnelle active.</p>
          <p className="mt-1 text-xs text-gray-400">Le proprietaire doit ajouter les permissions commandes ou livraisons.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Commandes" value={workspaceLoading ? '...' : totalOrders} icon={ShoppingBagIcon} />
            <Metric label="Montant" value={workspaceLoading ? '...' : formatMoney(totalAmount)} icon={ChartBarIcon} />
            <Metric label="A traiter" value={workspaceLoading ? '...' : newCount} icon={ClockIcon} />
            <Metric label="Livraisons" value={workspaceLoading ? '...' : handoffCount} icon={TruckIcon} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {canViewOrders && (
              <WorkspaceTaskCard
                title="Nouvelles commandes"
                description="Verifier, confirmer ou preparer les commandes recentes."
                count={newCount}
                icon={ShoppingBagIcon}
                to="/seller/orders?status=new"
              />
            )}
            {canManageDelivery && (
              <WorkspaceTaskCard
                title="File livraison"
                description="Preuves, demandes plateforme et handoff livraison."
                count={handoffCount}
                icon={TruckIcon}
                to="/seller/orders?status=handoff"
                tone="amber"
              />
            )}
            {canManageOrders && (
              <WorkspaceTaskCard
                title="Problemes"
                description="Commandes annulees, en retard ou a surveiller."
                count={problemCount}
                icon={ExclamationCircleIcon}
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
                  <Link to="/seller/orders?status=new" className="text-xs font-bold text-[#e85d00]">Voir tout</Link>
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
                  <Link to="/seller/orders?status=handoff" className="text-xs font-bold text-[#e85d00]">Voir tout</Link>
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
                    <ChartBarIcon className="shrink-0 text-[#e85d00] h-[15px] w-[15px]" />
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
            <ArrowLeftIcon className="h-[15px] w-[15px]" />
            Workspace
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <label className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un produit"
              className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#e85d00] focus:bg-white"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold outline-none focus:border-[#e85d00] focus:bg-white"
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
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <ArrowPathIcon className={`h-[15px] w-[15px] ${loading ? 'animate-spin' : ''}`} />
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
          <ShieldCheckIcon className="mx-auto text-gray-300 h-7 w-7" />
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
                        <CubeIcon className="h-6 w-6" />
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
                    <p className="mt-1 text-sm font-black text-[#e85d00]">{formatMoney(product?.price)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">{product?.description || 'Aucune description.'}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <Link
                    to={`/product/${product?.slug || productId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <EyeIcon className="h-3.5 w-3.5" />
                    Voir
                  </Link>
                  <button
                    type="button"
                    onClick={() => sendRequest(product, 'update')}
                    disabled={Boolean(requestingId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-xs font-bold text-[#B45309] disabled:opacity-60"
                  >
                    {updatePending ? <ArrowPathIcon className="animate-spin h-3.5 w-3.5" /> : <PencilSquareIcon className="h-3.5 w-3.5" />}
                    Demander modification
                  </button>
                  <button
                    type="button"
                    onClick={() => sendRequest(product, 'delete')}
                    disabled={Boolean(requestingId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-60"
                  >
                    {deletePending ? <ArrowPathIcon className="animate-spin h-3.5 w-3.5" /> : <TrashIcon className="h-3.5 w-3.5" />}
                    Demander suppression
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center">
          <CubeIcon className="mx-auto text-gray-300 h-7 w-7" />
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
      const { data } = await api.get(`/shops/${shopId}/assistant/audit?limit=50`);
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
    if (lookupType === 'phone' && value.replace(/\D/g, '').length <= 3) {
      return showToast('Veuillez saisir le numéro après +243.', 'error');
    }
    if (!selectedPerms.length) return showToast('Selectionnez au moins une permission.', 'error');

    setActionLoading(true);
    try {
      const body = { permissions: selectedPerms };
      if (lookupType === 'email') body.email = value;
      else if (lookupType === 'phone') body.phone = `+${value.replace(/\D/g, '')}`;
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

  const handleLookupTypeChange = (event) => {
    const nextType = event.target.value;
    setLookupType(nextType);
    setLookupValue(nextType === 'phone' ? ASSISTANT_PHONE_PREFIX : '');
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
      setLookupValue(lookupType === 'phone' ? ASSISTANT_PHONE_PREFIX : '');
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
        <ArrowPathIcon className="animate-spin text-[#e85d00] h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Assistant" value={assistant ? '1' : '0'} icon={UserIcon} />
        <Metric label="Statut" value={assistant?.status === 'active' ? 'Actif' : assistant?.status === 'pending' ? 'Attente' : 'Libre'} icon={ShieldCheckIcon} />
        <Metric label="Permissions" value={permissionCount} icon={AdjustmentsHorizontalIcon} />
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e85d00] text-lg font-black text-white">
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
              {actionLoading ? <ArrowPathIcon className="animate-spin h-[15px] w-[15px]" /> : <TrashIcon className="h-[15px] w-[15px]" />}
              Retirer
            </button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#e85d00] ring-1 ring-gray-100">
                <UserPlusIcon className="h-[18px] w-[18px]" />
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
              onChange={handleLookupTypeChange}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[#e85d00]/25"
            >
              <option value="email">Email</option>
              <option value="phone">Telephone</option>
              <option value="userId">ID utilisateur</option>
            </select>
            <div className="relative">
              {lookupType === 'email' && <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />}
              {lookupType === 'phone' && <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />}
              {lookupType === 'userId' && <HashtagIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />}
              <input
                type={lookupType === 'phone' ? 'tel' : 'text'}
                inputMode={lookupType === 'phone' ? 'tel' : undefined}
                value={lookupValue}
                onChange={(event) => setLookupValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && invite()}
                placeholder={lookupType === 'email' ? 'email@exemple.com' : lookupType === 'phone' ? '+243 00 000 0000' : 'ID utilisateur'}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#e85d00]/25"
              />
            </div>
            <button
              onClick={invite}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#e85d00] px-4 py-2.5 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50"
            >
              {actionLoading ? <ArrowPathIcon className="animate-spin h-4 w-4" /> : <UserPlusIcon className="h-4 w-4" />}
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
              <AdjustmentsHorizontalIcon className="h-[15px] w-[15px]" />
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
                className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-left transition hover:border-[#e85d00]/30 hover:bg-gray-100"
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
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e85d00] px-4 py-3 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50 sm:w-auto"
              >
                {actionLoading ? <ArrowPathIcon className="animate-spin h-4 w-4" /> : <ShieldCheckIcon className="h-4 w-4" />}
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
      permissions.includes('view_shop_dashboard') && { to: `/shop/${shop.slug || shop._id}`, label: 'Boutique', icon: BuildingStorefrontIcon },
      permissions.includes('view_shop_orders') && { to: '/seller/orders', label: 'Commandes', icon: ShoppingBagIcon },
      permissions.includes('view_shop_products') && { to: '/seller/products', label: 'Produits', icon: CubeIcon },
      permissions.includes('view_shop_notifications') && { to: '/notifications', label: 'Notifications', icon: BellIcon }
    ].filter(Boolean);
  }, [assignment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ArrowPathIcon className="animate-spin text-[#e85d00] h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingInvites.length > 0 && (
        <section className="rounded-lg border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 ring-1 ring-amber-100">
              <ClockIcon className="h-[18px] w-[18px]" />
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
                      <XCircleIcon className="h-[15px] w-[15px]" />
                      Refuser
                    </button>
                    <button
                      onClick={() => accept(invite.shop?._id)}
                      disabled={actionLoading}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#e85d00] px-3 py-2 text-sm font-black text-white hover:bg-[#e05e00] disabled:opacity-50"
                    >
                      {actionLoading ? <ArrowPathIcon className="animate-spin h-[15px] w-[15px]" /> : <CheckCircleIcon className="h-[15px] w-[15px]" />}
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e85d00] text-white">
                  <BuildingStorefrontIcon className="h-[22px] w-[22px]" />
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
              <Metric label="Permissions" value={(assignment.permissions || []).length} icon={ShieldCheckIcon} />
              <Metric label="Invitations" value={pendingInvites.length} icon={ClockIcon} />
              <Metric label="Acces" value={quickLinks.length} icon={ChevronRightIcon} />
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
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 hover:text-[#e85d00]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {link.label}
                      </span>
                      <ChevronRightIcon className="h-[15px] w-[15px]" />
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
                {actionLoading ? <ArrowPathIcon className="animate-spin h-[15px] w-[15px]" /> : <ArrowLeftOnRectangleIcon className="h-[15px] w-[15px]" />}
                Quitter ce role
              </button>
            </div>
          </section>

          <ActivityLog logs={auditLogs} loading={auditLoading} />
        </>
      ) : (
        <section className="rounded-lg border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
          <BuildingStorefrontIcon className="mx-auto text-gray-300 h-10 w-10" />
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
    <div className="min-h-screen bg-[#f5f2ee] pb-16 dark:bg-neutral-950">
      <div className="sticky top-0 z-30 border-b border-[#e2dcd2] bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/seller/products" className="grid h-10 w-10 place-items-center rounded-full border border-[#e2dcd2] text-[#6b6459] transition active:bg-[#f5f2ee] dark:border-neutral-800" aria-label="Retour">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-[#231f1b] dark:text-white">Assistant boutique</h1>
              <p className="truncate text-xs font-semibold text-[#8a8378]">
                {isShop ? 'Délégation professionnelle de votre boutique' : "Votre rôle d'assistant HDMarket"}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-[#fff0e4] px-3 py-1.5 text-xs font-black text-[#e85d00] sm:inline-flex">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Accès contrôlé
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {!user ? (
          <section className="rounded-lg border border-gray-100 bg-white p-10 text-center shadow-sm">
            <ExclamationCircleIcon className="mx-auto text-gray-300 h-8 w-8" />
            <p className="mt-2 font-bold text-gray-600">Connectez-vous pour acceder a cette page.</p>
          </section>
        ) : isShop ? (
          <OwnerView shopId={shopId} />
        ) : isAssistantProductsRoute ? (
          <AssistantProductsView />
        ) : (
          <AssistantView />
        )}
      </div>
    </div>
  );
}
