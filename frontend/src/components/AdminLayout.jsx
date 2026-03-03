import React, { useContext, useState } from 'react';
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
  X
} from 'lucide-react';
import { hasAnyPermission } from '../utils/permissions';

const buildNavItems = (t, platformDeliveryEnabled) => [
  { to: '/admin', end: true, label: t('nav.adminDashboard', 'Tableau de bord'), icon: LayoutDashboard, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['view_admin_dashboard']) },
  { to: '/admin/orders', label: t('nav.orders', 'Commandes'), icon: ClipboardList, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['manage_orders']) },
  { to: '/admin/payments', label: t('nav.payments', 'Paiements'), icon: DollarSign, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || hasAnyPermission(u, ['verify_payments']) },
  { to: '/admin/users', label: t('nav.users', 'Utilisateurs'), icon: Users, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_users']) },
  { to: '/admin/products', label: t('nav.products', 'Produits'), icon: Package, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageProducts || hasAnyPermission(u, ['manage_products']) },
  { to: '/admin/delivery-guys', label: t('nav.deliveryGuys', 'Livreurs'), icon: Truck, show: (u) => platformDeliveryEnabled && (u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageDelivery || hasAnyPermission(u, ['manage_delivery'])) },
  { to: '/admin/delivery-requests', label: t('nav.deliveryRequests', 'Demandes livraison'), icon: Truck, show: (u) => platformDeliveryEnabled && (u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageDelivery || hasAnyPermission(u, ['manage_delivery'])) },
  { to: '/delivery/dashboard', label: t('nav.courierMode', 'Mode livreur'), icon: Truck, show: (u) => {
      const role = String(u?.role || '').toLowerCase();
      return (
        platformDeliveryEnabled &&
        (role === 'delivery_agent' ||
          (!['admin', 'manager', 'founder'].includes(role) && hasAnyPermission(u, ['courier_view_assignments'])))
      );
    } },
  { to: '/admin/complaints', label: t('nav.complaints', 'Réclamations'), icon: AlertCircle, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.role === 'founder' || u?.canManageComplaints || hasAnyPermission(u, ['manage_complaints']) },
  { to: '/admin/chat-templates', label: t('nav.chatTemplates', 'Modèles de chat'), icon: MessageSquare, show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageChatTemplates || hasAnyPermission(u, ['manage_chat_templates']) },
  { to: '/admin/promo-codes', label: t('nav.promoCodes', 'Codes promo'), icon: Ticket, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings', label: t('nav.appSettings', 'Paramètres app'), icon: SlidersHorizontal, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/system-settings', label: t('nav.systemSettings', 'Paramètres système'), icon: SlidersHorizontal, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/settings/categories', label: t('nav.categories', 'Catégories'), icon: FolderTree, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_settings']) },
  { to: '/admin/feedback', label: t('nav.feedback', 'Avis amélioration'), icon: MessageSquare, show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canReadFeedback || hasAnyPermission(u, ['read_feedback']) },
  { to: '/admin/payment-verification', label: t('nav.verifyPayments', 'Vérifier paiements'), icon: CheckCircle, show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canVerifyPayments || hasAnyPermission(u, ['verify_payments']) },
  { to: '/admin/product-boosts', label: t('nav.productBoosts', 'Boost produits'), icon: Sparkles, show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageBoosts || hasAnyPermission(u, ['manage_boosts']) },
  { to: '/admin/boost-management', label: t('nav.boostPricing', 'Tarification boost'), icon: Sparkles, show: (u) => u?.role === 'admin' || u?.role === 'founder' || u?.canManageBoosts || hasAnyPermission(u, ['manage_boosts']) },
  { to: '/admin/payment-verifiers', label: t('nav.paymentVerifiers', 'Vérificateurs'), icon: Shield, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['manage_permissions']) },
  { to: '/admin/reports', label: t('nav.reports', 'Rapports'), icon: FileText, show: (u) => u?.role === 'admin' || u?.role === 'founder' || hasAnyPermission(u, ['view_logs']) },
  { to: '/admin/founder-intelligence', label: t('nav.founderIntelligence', 'Founder Intelligence'), icon: Crown, show: (u) => u?.role === 'founder' },
  { to: '/admin/founder-account-control', label: t('nav.founderAccountControl', 'Suppression définitive'), icon: UserX, show: (u) => u?.role === 'founder' }
];

export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const { t, getRuntimeValue } = useAppSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const navContent = (
    <>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? false}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-neutral-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <Icon size={20} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-neutral-50/20 flex flex-col lg:flex-row lg:h-[calc(100vh-5rem)] lg:min-h-0 lg:overflow-hidden">
      {/* Mobile header with menu button */}
      <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200/80 bg-white/95 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          aria-label={mobileMenuOpen ? t('nav.closeMenu', 'Fermer le menu') : t('nav.openMenu', 'Ouvrir le menu')}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <span className="font-bold text-gray-900 text-sm">
          {isFounder ? t('nav.founder', 'Founder') : isManager ? t('nav.management', 'Gestion') : t('nav.admin', 'Admin')}
        </span>
        <div className="w-10" />
      </header>

      {/* Mobile sidebar drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`lg:hidden fixed top-20 left-0 z-40 h-[calc(100vh-5rem)] w-64 max-w-[85vw] flex flex-col border-r border-gray-200 bg-white shadow-xl transform transition-transform duration-200 ease-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <span className="font-bold text-gray-900 text-sm">
            {isFounder ? t('nav.founder', 'Founder') : isManager ? t('nav.management', 'Gestion') : t('nav.admin', 'Admin')}
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label={t('nav.closeMenu', 'Fermer le menu')}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">{navContent}</nav>
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex lg:h-full flex-col border-r border-gray-200/80 bg-white/90 backdrop-blur-sm shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="flex flex-col h-full pt-6 pb-4">
          <div className={`flex items-center px-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-neutral-600 to-neutral-600 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} className="text-white" />
                </div>
                <span className="font-bold text-gray-900 truncate text-sm">
                  {isFounder
                    ? t('nav.founder', 'Founder')
                    : isManager
                    ? t('nav.management', 'Gestion')
                    : t('nav.admin', 'Admin')}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={sidebarCollapsed ? t('nav.openMenu', 'Ouvrir le menu') : t('nav.closeMenu', 'Réduire le menu')}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain px-2 space-y-0.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-neutral-600 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } ${sidebarCollapsed ? 'justify-center' : ''}`
                  }
                >
                  <Icon size={20} className="shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
