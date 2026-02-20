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
  FolderTree
} from 'lucide-react';

const buildNavItems = (t) => [
  { to: '/admin', end: true, label: t('nav.adminDashboard', 'Tableau de bord'), icon: LayoutDashboard, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/orders', label: t('nav.orders', 'Commandes'), icon: ClipboardList, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/payments', label: t('nav.payments', 'Paiements'), icon: DollarSign, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/users', label: t('nav.users', 'Utilisateurs'), icon: Users, show: (u) => u?.role === 'admin' },
  { to: '/admin/products', label: t('nav.products', 'Produits'), icon: Package, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.canManageProducts },
  { to: '/admin/delivery-guys', label: t('nav.deliveryGuys', 'Livreurs'), icon: Truck, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.canManageDelivery },
  { to: '/admin/complaints', label: t('nav.complaints', 'Réclamations'), icon: AlertCircle, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.canManageComplaints },
  { to: '/admin/chat-templates', label: t('nav.chatTemplates', 'Modèles de chat'), icon: MessageSquare, show: (u) => u?.role === 'admin' },
  { to: '/admin/promo-codes', label: t('nav.promoCodes', 'Codes promo'), icon: Ticket, show: (u) => u?.role === 'admin' },
  { to: '/admin/settings', label: t('nav.appSettings', 'Paramètres app'), icon: SlidersHorizontal, show: (u) => u?.role === 'admin' },
  { to: '/admin/system-settings', label: t('nav.systemSettings', 'Paramètres système'), icon: SlidersHorizontal, show: (u) => u?.role === 'admin' },
  { to: '/admin/settings/categories', label: t('nav.categories', 'Catégories'), icon: FolderTree, show: (u) => u?.role === 'admin' },
  { to: '/admin/feedback', label: t('nav.feedback', 'Avis amélioration'), icon: MessageSquare, show: (u) => u?.role === 'admin' || u?.canReadFeedback },
  { to: '/admin/payment-verification', label: t('nav.verifyPayments', 'Vérifier paiements'), icon: CheckCircle, show: (u) => u?.role === 'admin' || u?.canVerifyPayments },
  { to: '/admin/product-boosts', label: t('nav.productBoosts', 'Boost produits'), icon: Sparkles, show: (u) => u?.role === 'admin' || u?.canManageBoosts },
  { to: '/admin/boost-management', label: t('nav.boostPricing', 'Tarification boost'), icon: Sparkles, show: (u) => u?.role === 'admin' || u?.canManageBoosts },
  { to: '/admin/payment-verifiers', label: t('nav.paymentVerifiers', 'Vérificateurs'), icon: Shield, show: (u) => u?.role === 'admin' },
  { to: '/admin/reports', label: t('nav.reports', 'Rapports'), icon: FileText, show: (u) => u?.role === 'admin' }
];

export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const { t } = useAppSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isManager = user?.role === 'manager';

  const navItems = buildNavItems(t);
  const visibleItems = navItems.filter((item) => item.show(user));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 flex lg:h-[calc(100vh-5rem)] lg:min-h-0 lg:overflow-hidden">
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
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} className="text-white" />
                </div>
                <span className="font-bold text-gray-900 truncate text-sm">
                  {isManager ? t('nav.management', 'Gestion') : t('nav.admin', 'Admin')}
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
                        ? 'bg-indigo-600 text-white shadow-md'
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
