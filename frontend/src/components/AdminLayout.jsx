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
  BarChart3,
  Shield,
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
  Search,
  ChevronDown
} from 'lucide-react';
import { hasAnyPermission } from '../utils/permissions';

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

const buildNavItems = (t, platformDeliveryEnabled) => [
  { to: '/admin', end: true, label: t('nav.adminDashboard', 'Tableau de bord'), icon: LayoutDashboard, group: 'overview', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['view_admin_dashboard']) },
  { to: '/admin/orders', label: t('nav.orders', 'Commandes'), icon: ClipboardList, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['manage_orders']) },
  { to: '/admin/payments', label: t('nav.payments', 'Paiements'), icon: DollarSign, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['verify_payments']) },
  { to: '/admin/users', label: t('nav.users', 'Utilisateurs'), icon: Users, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_users']) },
  { to: '/admin/products', label: t('nav.products', 'Produits'), icon: Package, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageProducts || hasAnyPermission(u, ['manage_products']) },
  { to: '/admin/delivery-guys', label: t('nav.deliveryGuys', 'Livreurs'), icon: Truck, group: 'operations', show: (u) => platformDeliveryEnabled && (u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageDelivery || hasAnyPermission(u, ['manage_delivery'])) },
  { to: '/admin/delivery-requests', label: t('nav.deliveryRequests', 'Demandes livraison'), icon: Truck, group: 'operations', show: (u) => platformDeliveryEnabled && (u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageDelivery || hasAnyPermission(u, ['manage_delivery'])) },
  { to: '/delivery/dashboard', label: t('nav.courierMode', 'Mode livreur'), icon: Truck, show: (u) => {
      const role = String(u?.role || '').toLowerCase();
      return (
        platformDeliveryEnabled &&
        (role === 'delivery_agent' ||
          (!['admin', 'manager', 'founder'].includes(role) && hasAnyPermission(u, ['courier_view_assignments'])))
      );
    }, group: 'operations' },
  { to: '/admin/complaints', label: t('nav.complaints', 'Réclamations'), icon: AlertCircle, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageComplaints || hasAnyPermission(u, ['manage_complaints']) },
  { to: '/admin/chat-templates', label: t('nav.chatTemplates', 'Modèles de chat'), icon: MessageSquare, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageChatTemplates || hasAnyPermission(u, ['manage_chat_templates']) },
  { to: '/admin/promo-codes', label: t('nav.promoCodes', 'Codes promo'), icon: Ticket, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings', label: t('nav.appSettings', 'Paramètres app'), icon: SlidersHorizontal, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/system-settings', label: t('nav.systemSettings', 'Paramètres système'), icon: SlidersHorizontal, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings/categories', label: t('nav.categories', 'Catégories'), icon: FolderTree, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/feedback', label: t('nav.feedback', 'Avis amélioration'), icon: MessageSquare, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canReadFeedback || hasAnyPermission(u, ['read_feedback']) },
  { to: '/admin/payment-verification', label: t('nav.verifyPayments', 'Vérifier paiements'), icon: CheckCircle, group: 'operations', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canVerifyPayments || hasAnyPermission(u, ['verify_payments']) },
  { to: '/admin/product-boosts', label: t('nav.productBoosts', 'Boost produits'), icon: Sparkles, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageBoosts || hasAnyPermission(u, ['manage_boosts']) },
  { to: '/admin/boost-management', label: t('nav.boostPricing', 'Tarification boost'), icon: Sparkles, group: 'commerce', show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageBoosts || hasAnyPermission(u, ['manage_boosts']) },
  { to: '/admin/payment-verifiers', label: t('nav.paymentVerifiers', 'Vérificateurs'), icon: Shield, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_permissions']) },
  { to: '/admin/reports', label: t('nav.reports', 'Rapports'), icon: FileText, group: 'system', show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['view_logs']) },
  { to: '/admin/founder-intelligence', label: t('nav.founderIntelligence', 'Founder Intelligence'), icon: Crown, group: 'founder', show: (u) => u?.role === 'founder' },
  { to: '/admin/founder-account-control', label: t('nav.founderAccountControl', 'Suppression définitive'), icon: UserX, group: 'founder', show: (u) => u?.role === 'founder' }
];

export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const { t, getRuntimeValue } = useAppSettings();
  const storageKey = useMemo(() => buildAdminUiStateStorageKey(user), [user]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
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

  const navItems = buildNavItems(t, platformDeliveryEnabled);
  const visibleItems = navItems.filter((item) => item.show(user));
  const normalizedSidebarQuery = String(sidebarQuery || '').trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedSidebarQuery) return visibleItems;
    return visibleItems.filter((item) =>
      String(item.label || '').toLowerCase().includes(normalizedSidebarQuery)
    );
  }, [visibleItems, normalizedSidebarQuery]);
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
          `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            isActive
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          } ${collapsed ? 'justify-center px-2' : ''}`
        }
      >
        <Icon size={18} className="shrink-0" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </NavLink>
    );
  };

  const renderSectionList = (collapsed = false, onSelect = null) =>
    groupOrder.map((groupKey) => {
      const items = groupedItems[groupKey] || [];
      if (!items.length) return null;
      const sectionCollapsed =
        !collapsed && !normalizedSidebarQuery && Boolean(collapsedSections[groupKey]);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-neutral-50/30 flex flex-col lg:flex-row lg:h-[calc(100vh-5rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          aria-label={mobileMenuOpen ? t('nav.closeMenu', 'Fermer le menu') : t('nav.openMenu', 'Ouvrir le menu')}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="font-bold text-gray-900 text-sm">{roleLabel}</span>
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
        className={`lg:hidden fixed top-20 left-0 z-40 h-[calc(100vh-5rem)] w-72 max-w-[88vw] flex flex-col border-r border-gray-200 bg-white shadow-xl transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 text-sm">{roleLabel}</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              aria-label={t('nav.closeMenu', 'Fermer le menu')}
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-3 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={sidebarQuery}
              onChange={(event) => setSidebarQuery(event.target.value)}
              placeholder={t('nav.searchMenu', 'Rechercher un menu')}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none focus:border-gray-400"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {renderSectionList(false, () => setMobileMenuOpen(false))}
        </nav>
      </aside>

      <aside
        className={`hidden lg:flex lg:h-full flex-col border-r border-gray-200/80 bg-white/90 backdrop-blur-sm shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[78px]' : 'w-[292px]'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-100 px-3 py-4">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              {!sidebarCollapsed ? (
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-neutral-900 flex items-center justify-center shrink-0">
                    <BarChart3 size={18} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900">{roleLabel}</p>
                    <p className="text-xs text-gray-500">{visibleItems.length} menus</p>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label={sidebarCollapsed ? t('nav.openMenu', 'Ouvrir le menu') : t('nav.closeMenu', 'Réduire le menu')}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
            {!sidebarCollapsed ? (
              <div className="mt-3 relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={sidebarQuery}
                  onChange={(event) => setSidebarQuery(event.target.value)}
                  placeholder={t('nav.searchMenu', 'Rechercher un menu')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 outline-none focus:border-gray-400"
                />
              </div>
            ) : null}
          </div>
          <nav className={`flex-1 overflow-y-auto overscroll-contain ${sidebarCollapsed ? 'px-2 py-3 space-y-2' : 'px-2.5 py-3 space-y-4'}`}>
            {renderSectionList(sidebarCollapsed)}
          </nav>
          {!sidebarCollapsed ? (
            <div className="border-t border-gray-100 px-3 py-3">
              <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Navigation
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  Les sections sont filtrables via la barre de recherche.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
