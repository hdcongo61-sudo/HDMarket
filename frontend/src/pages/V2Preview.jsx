import React, { useMemo, useState } from 'react';
import {
  Bell,
  Gavel,
  Home,
  Megaphone,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UserCircle2,
  LayoutDashboard
} from 'lucide-react';
import V2TopNav from '../v2/components/V2TopNav';
import V2AppShell from '../v2/layout/V2AppShell';
import HomeFeedV2 from '../v2/pages/HomeFeedV2';
import ProductPageV2 from '../v2/pages/ProductPageV2';
import ShopPageV2 from '../v2/pages/ShopPageV2';
import CartPageV2 from '../v2/pages/CartPageV2';
import OrdersPageV2 from '../v2/pages/OrdersPageV2';
import InstallmentTrackingV2 from '../v2/pages/InstallmentTrackingV2';
import AdsManagerV2 from '../v2/pages/AdsManagerV2';
import NotificationsV2 from '../v2/pages/NotificationsV2';
import DisputeCenterV2 from '../v2/pages/DisputeCenterV2';
import SellerDashboardV2 from '../v2/pages/SellerDashboardV2';
import AdminDashboardV2 from '../v2/pages/AdminDashboardV2';
import ProfileSettingsV2 from '../v2/pages/ProfileSettingsV2';

const SECTIONS = [
  { key: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
  { key: 'product', label: 'Product', icon: <Package className="h-4 w-4" /> },
  { key: 'shop', label: 'Shop', icon: <Store className="h-4 w-4" /> },
  { key: 'cart', label: 'Cart', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'orders', label: 'Orders', icon: <Truck className="h-4 w-4" /> },
  { key: 'installments', label: 'Installments', icon: <Receipt className="h-4 w-4" /> },
  { key: 'ads', label: 'Ads', icon: <Megaphone className="h-4 w-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { key: 'disputes', label: 'Disputes', icon: <Gavel className="h-4 w-4" /> },
  { key: 'seller', label: 'Seller', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'admin', label: 'Admin', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'profile', label: 'Profile', icon: <UserCircle2 className="h-4 w-4" /> }
];

export default function V2Preview() {
  const [activeKey, setActiveKey] = useState('home');
  const [darkMode, setDarkMode] = useState(false);

  const ActiveComponent = useMemo(() => {
    const map = {
      home: HomeFeedV2,
      product: ProductPageV2,
      shop: ShopPageV2,
      cart: CartPageV2,
      orders: OrdersPageV2,
      installments: InstallmentTrackingV2,
      ads: AdsManagerV2,
      notifications: NotificationsV2,
      disputes: DisputeCenterV2,
      seller: SellerDashboardV2,
      admin: AdminDashboardV2,
      profile: ProfileSettingsV2
    };
    return map[activeKey] || HomeFeedV2;
  }, [activeKey]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <V2TopNav darkMode={darkMode} onToggleDarkMode={() => setDarkMode((prev) => !prev)} />
      <V2AppShell sections={SECTIONS} activeKey={activeKey} onChange={setActiveKey}>
        <ActiveComponent />
      </V2AppShell>
      <footer className="border-t v2-divider bg-[var(--v2-bg)] py-4 text-center text-xs v2-text-soft">
        HDMarket V2 Preview · Apple × Threads × Premium Marketplace
      </footer>
    </div>
  );
}
