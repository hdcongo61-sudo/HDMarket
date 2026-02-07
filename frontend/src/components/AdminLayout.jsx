import React, { useContext, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
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
  AlertCircle
} from 'lucide-react';

const navItems = [
  { to: '/admin', end: true, label: 'Tableau de bord', icon: LayoutDashboard, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/orders', label: 'Commandes', icon: ClipboardList, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/payments', label: 'Paiements', icon: DollarSign, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/users', label: 'Utilisateurs', icon: Users, show: (u) => u?.role === 'admin' },
  { to: '/admin/products', label: 'Produits', icon: Package, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/delivery-guys', label: 'Livreurs', icon: Truck, show: (u) => u?.role === 'admin' || u?.role === 'manager' },
  { to: '/admin/complaints', label: 'Réclamations', icon: AlertCircle, show: (u) => u?.role === 'admin' || u?.role === 'manager' || u?.canManageComplaints },
  { to: '/admin/chat-templates', label: 'Chat templates', icon: MessageSquare, show: (u) => u?.role === 'admin' },
  { to: '/admin/settings', label: 'Paramètres app', icon: SlidersHorizontal, show: (u) => u?.role === 'admin' },
  { to: '/admin/feedback', label: 'Avis amélioration', icon: MessageSquare, show: (u) => u?.role === 'admin' || u?.canReadFeedback },
  { to: '/admin/payment-verification', label: 'Vérifier paiements', icon: CheckCircle, show: (u) => u?.role === 'admin' || u?.canVerifyPayments },
  { to: '/admin/product-boosts', label: 'Boost produits', icon: Sparkles, show: (u) => u?.role === 'admin' || u?.canManageBoosts },
  { to: '/admin/payment-verifiers', label: 'Vérificateurs', icon: Shield, show: (u) => u?.role === 'admin' },
  { to: '/admin/reports', label: 'Rapports', icon: FileText, show: (u) => u?.role === 'admin' }
];

export default function AdminLayout() {
  const { user } = useContext(AuthContext);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isManager = user?.role === 'manager';

  const visibleItems = navItems.filter((item) => item.show(user));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/20 flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-gray-200/80 bg-white/90 backdrop-blur-sm shrink-0 transition-[width] duration-200 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className="sticky top-0 flex flex-col h-[calc(100vh-5rem)] pt-6 pb-4">
          <div className={`flex items-center px-3 ${sidebarCollapsed ? 'justify-center' : 'justify-between'} mb-4`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
                  <BarChart3 size={18} className="text-white" />
                </div>
                <span className="font-bold text-gray-900 truncate text-sm">
                  {isManager ? 'Gestion' : 'Admin'}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label={sidebarCollapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
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
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
