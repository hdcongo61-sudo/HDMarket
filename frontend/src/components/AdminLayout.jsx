import React, { useContext, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import {
  LayoutDashboard,
  Users,
  Package,
  DollarSign,
  ClipboardList,
  Truck,
  MessageSquare,
  SlidersHorizontal,
  FileText,
  CheckCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Ticket,
  FolderTree,
  Crown,
  UserX,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { hasAnyPermission } from '../utils/permissions';
import useAdminCounts from '../hooks/useAdminCounts';

const ADMIN_UI_STATE_KEY = 'hdmarket:admin-ui-state';
const ADMIN_GROUP_ORDER = ['overview', 'commerce', 'operations', 'system', 'founder'];
const DEFAULT_COLLAPSED_SECTIONS = {
  overview: false,
  commerce: false,
  operations: false,
  system: false,
  founder: false
};

const buildAdminUiStateStorageKey = (user) => {
  const userScope = user?._id || user?.id || user?.email || 'anonymous';
  return `${ADMIN_UI_STATE_KEY}:${String(userScope)}`;
};

const parseCollapsedSections = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_COLLAPSED_SECTIONS };
  }
  return ADMIN_GROUP_ORDER.reduce((acc, key) => {
    acc[key] = Boolean(value[key]);
    return acc;
  }, {});
};

const readAdminUiState = (storageKey) => {
  if (typeof window === 'undefined') {
    return {
      sidebarCollapsed: false,
      collapsedSections: { ...DEFAULT_COLLAPSED_SECTIONS }
    };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        sidebarCollapsed: false,
        collapsedSections: { ...DEFAULT_COLLAPSED_SECTIONS }
      };
    }
    const parsed = JSON.parse(raw);
    return {
      sidebarCollapsed: Boolean(parsed?.sidebarCollapsed),
      collapsedSections: parseCollapsedSections(parsed?.collapsedSections)
    };
  } catch (_error) {
    return {
      sidebarCollapsed: false,
      collapsedSections: { ...DEFAULT_COLLAPSED_SECTIONS }
    };
  }
};

const buildNavItems = (t, platformDeliveryEnabled, counters = {}) => [
  {
    to: '/admin/dashboard',
    end: true,
    label: t('nav.adminDashboard', 'Tableau de bord'),
    icon: LayoutDashboard,
    group: 'overview',
    show: (u) =>
      u?.role === 'admin' ||
      u?.role === 'manager' ||
      u?.role === 'founder' ||
      hasAnyPermission(u, ['view_admin_dashboard'])
  },
  {
    to: '/admin/task-center',
    label: t('nav.taskCenter', 'Centre de tâches'),
    icon: AlertCircle,
    group: 'overview',
    badge: Number(counters?.pendingTasks || 0),
    show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder'
  },
  { to: '/admin/orders', label: t('nav.orders', 'Commandes'), icon: ClipboardList, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['manage_orders']) },
  { to: '/admin/payments', label: t('nav.payments', 'Paiements'), icon: DollarSign, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['verify_payments']) },
  { to: '/admin/users', label: t('nav.users', 'Utilisateurs'), icon: Users, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_users']) },
  { to: '/admin/products', label: t('nav.products', 'Produits'), icon: Package, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageProducts || hasAnyPermission(u, ['manage_products']) },
  { to: '/admin/delivery-guys', label: t('nav.deliveryGuys', 'Livreurs'), icon: Truck, group: 'operations', show: (u) => platformDeliveryEnabled && (u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageDelivery || hasAnyPermission(u, ['manage_delivery'])) },
  {
    to: '/admin/delivery-requests',
    label: t('nav.deliveryRequests', 'Demandes livraison'),
    icon: Truck,
    group: 'operations',
    show: (u) =>
      platformDeliveryEnabled &&
      (u?.role === 'admin' ||
        u?.role === 'manager' ||
        u?.role === 'founder' ||
        u?.canManageDelivery ||
        hasAnyPermission(u, ['manage_delivery']))
  },
  { to: '/delivery/dashboard', label: t('nav.courierMode', 'Mode livreur'), icon: Truck, show: (u) => {
      const role = String(u?.role || '').toLowerCase();
      return (
        platformDeliveryEnabled &&
        (role === 'delivery_agent' ||
          (!['admin', 'manager', 'founder'].includes(role) && hasAnyPermission(u, ['courier_view_assignments'])))
      );
    }, group: 'operations' },
  {
    to: '/admin/complaints',
    label: t('nav.complaints', 'Réclamations'),
    icon: AlertCircle,
    group: 'operations',
    show: (u) =>
      u?.role === 'admin' ||
      u?.role === 'manager' ||
      u?.role === 'founder' ||
      u?.canManageComplaints ||
      hasAnyPermission(u, ['manage_complaints'])
  },
  { to: '/admin/chat-templates', label: t('nav.chatTemplates', 'Modèles de chat'), icon: MessageSquare, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageChatTemplates || hasAnyPermission(u, ['manage_chat_templates']) },
  { to: '/admin/promo-codes', label: t('nav.promoCodes', 'Codes promo'), icon: Ticket, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings', label: t('nav.appSettings', 'Paramètres'), icon: SlidersHorizontal, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings/categories', label: t('nav.categories', 'Catégories'), icon: FolderTree, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  {
    to: '/admin/product-boosts',
    label: t('nav.productBoosts', 'Boosts'),
    icon: Sparkles,
    group: 'commerce',
    show: (u) =>
      u?.role === 'admin' ||
      u?.role === 'founder' ||
      u?.canManageBoosts ||
      hasAnyPermission(u, ['manage_boosts'])
  },
  { to: '/admin/reports', label: t('nav.reports', 'Rapports'), icon: FileText, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['view_logs']) },
  { to: '/admin/founder-intelligence', label: t('nav.founderIntelligence', 'Founder Intelligence'), icon: Crown, group: 'founder', show: (u) => u?.role === 'founder' },
  { to: '/admin/founder-notifications-intelligence', label: t('nav.founderNotificationsIntelligence', 'Notif Intelligence'), icon: Crown, group: 'founder', badge: Number(counters?.pendingTasks || 0), show: (u) => u?.role === 'founder' },
  { to: '/admin/founder-account-control', label: t('nav.founderAccountControl', 'Suppression définitive'), icon: UserX, group: 'founder', show: (u) => u?.role === 'founder' }
];

export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const { t, getRuntimeValue } = useAppSettings();
  const { counts: adminCounts } = useAdminCounts(Boolean(user));
  const storageKey = useMemo(() => buildAdminUiStateStorageKey(user), [user]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({ ...DEFAULT_COLLAPSED_SECTIONS });
  const isManager = user?.role === 'manager';
  const isFounder = user?.role === 'founder';
  const platformDeliveryEnabled =
    ['true', '1', 'yes', 'on'].includes(
      String(getRuntimeValue('enable_platform_delivery', false)).trim().toLowerCase()
    ) &&
    !['false', '0', 'no', 'off'].includes(
      String(getRuntimeValue('enable_delivery_requests', true)).trim().toLowerCase()
    );

  const navItems = buildNavItems(t, platformDeliveryEnabled, adminCounts);
  const mergedNavItems = navItems
    .filter((item) => ![
      '/admin/delivery-guys',
      '/delivery/dashboard',
      '/admin/settings/categories',
      '/admin/founder-notifications-intelligence',
      '/admin/founder-account-control'
    ].includes(item.to))
    .map((item) => {
      if (item.to === '/admin/payments') return { ...item, label: 'Paiements & vérification' };
      if (item.to === '/admin/product-boosts') return { ...item, label: 'Boosts & tarification' };
      if (item.to === '/admin/settings') return { ...item, label: 'Paramètres système' };
      if (item.to === '/admin/chat-templates') return { ...item, label: 'Messages & avis' };
      return item;
    });
  const visibleItems = mergedNavItems.filter((item) => item.show(user));
  const filteredItems = visibleItems;
  const groupedItems = useMemo(() => {
    const buckets = {
      overview: [],
      commerce: [],
      operations: [],
      system: [],
      founder: []
    };
    filteredItems.forEach((item) => {
      const groupKey = item.group && buckets[item.group] ? item.group : 'operations';
      buckets[groupKey].push(item);
    });
    return buckets;
  }, [filteredItems]);
  const groupOrder = ADMIN_GROUP_ORDER;
  const groupLabels = {
    overview: t('nav.sectionOverview', 'Vue globale'),
    commerce: t('nav.sectionCommerce', 'Commerce'),
    operations: t('nav.sectionOperations', 'Opérations'),
    system: t('nav.sectionSystem', 'Système'),
    founder: t('nav.sectionFounder', 'Founder')
  };
  const roleLabel = isFounder
    ? t('nav.founder', 'Founder')
    : isManager
    ? t('nav.management', 'Gestion')
    : t('nav.admin', 'Admin');

  useEffect(() => {
    const persisted = readAdminUiState(storageKey);
    setSidebarCollapsed(Boolean(persisted.sidebarCollapsed));
    setCollapsedSections(parseCollapsedSections(persisted.collapsedSections));
  }, [storageKey]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.add('hd-admin-modal-scope');
    return () => {
      document.body.classList.remove('hd-admin-modal-scope');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      sidebarCollapsed: Boolean(sidebarCollapsed),
      collapsedSections: parseCollapsedSections(collapsedSections)
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [storageKey, sidebarCollapsed, collapsedSections]);

  const toggleSectionCollapsed = (groupKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [groupKey]: !current[groupKey]
    }));
  };

  const renderNavLink = (item, { collapsed = false, onSelect = null } = {}) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end ?? false}
        onClick={onSelect || undefined}
        className={({ isActive }) =>
          `group relative flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
            isActive
              ? 'hd-admin-nav-active text-white shadow-sm'
              : 'text-neutral-600 hover:bg-white hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white'
          } ${collapsed ? 'justify-center px-2' : ''}`
        }
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
        {Number(item?.badge || 0) > 0 ? (
          collapsed ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
          ) : (
            <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {Number(item.badge) > 99 ? '99+' : Number(item.badge)}
            </span>
          )
        ) : null}
      </NavLink>
    );
  };

  const renderSectionList = (collapsed = false, onSelect = null) =>
    groupOrder.map((groupKey) => {
      const items = groupedItems[groupKey] || [];
      if (!items.length) return null;
      const sectionCollapsed =
        !collapsed && Boolean(collapsedSections[groupKey]);
      return (
        <section key={groupKey} className={collapsed ? 'space-y-1' : 'space-y-1.5'}>
          {!collapsed ? (
            <button
              type="button"
              onClick={() => toggleSectionCollapsed(groupKey)}
              className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600 transition-colors"
              aria-expanded={!sectionCollapsed}
            >
              <span>{groupLabels[groupKey]}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${sectionCollapsed ? '-rotate-90' : 'rotate-0'}`}
              />
            </button>
          ) : null}
          {sectionCollapsed ? null : (
            <div className="space-y-1">
              {items.map((item) => renderNavLink(item, { collapsed, onSelect }))}
            </div>
          )}
        </section>
      );
    });

  return (
    <div className="hd-admin-flow hd-commerce-shell min-h-screen flex flex-col bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-white lg:h-[calc(100vh-5rem)] lg:min-h-0 lg:flex-row lg:overflow-hidden">
      <header className="lg:hidden flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white/90 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/90">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e2dcd2] bg-white text-[#231f1b] hover:text-[#e85d00] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          aria-label={mobileMenuOpen ? t('nav.closeMenu', 'Fermer le menu') : t('nav.openMenu', 'Ouvrir le menu')}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="text-sm font-black text-[#231f1b] dark:text-white">HDMarket Admin</span>
        <div className="w-10" />
      </header>

      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`lg:hidden fixed left-0 top-20 z-40 flex h-[calc(100vh-5rem)] w-72 max-w-[88vw] flex-col border-r border-neutral-200 bg-white/95 shadow-sm transition-transform duration-200 ease-out dark:border-neutral-800 dark:bg-neutral-950/95 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
          <div className="border-b border-white/35 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-[#231f1b] dark:text-white">HDMarket Admin</p>
                <p className="text-xs text-[#8a8378]">Rôle : {roleLabel}</p>
              </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="glass-card rounded-lg p-2 text-slate-500 hover:text-slate-800"
              aria-label={t('nav.closeMenu', 'Fermer le menu')}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {renderSectionList(false, () => setMobileMenuOpen(false))}
        </nav>
      </aside>

      <aside
        className={`hidden shrink-0 flex-col border-r border-neutral-200 bg-white/92 transition-[width] duration-200 dark:border-neutral-800 dark:bg-neutral-950/92 lg:flex lg:h-full ${
          sidebarCollapsed ? 'w-[78px]' : 'w-[236px]'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/35 px-3 py-4">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              {!sidebarCollapsed ? (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black">
                    <span className="text-sm font-black tracking-tight text-white">HD</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#231f1b] dark:text-white">HDMarket Admin</p>
                    <p className="text-xs text-[#8a8378]">Rôle : {roleLabel}</p>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="glass-card rounded-lg p-1.5 text-slate-500 hover:text-slate-800"
                aria-label={sidebarCollapsed ? t('nav.openMenu', 'Ouvrir le menu') : t('nav.closeMenu', 'Réduire le menu')}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
          </div>
          <nav className={`flex-1 overflow-y-auto overscroll-contain ${sidebarCollapsed ? 'px-2 py-3 space-y-2' : 'px-2.5 py-3 space-y-4'}`}>
            {renderSectionList(sidebarCollapsed)}
          </nav>
        </div>
      </aside>

      <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
