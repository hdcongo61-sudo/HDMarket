import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Package, Users, Eye, ShoppingCart, DollarSign, BarChart3 } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import api from '../services/api';

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
  { key: 'products', label: 'Produits', icon: Package },
  { key: 'customers', label: 'Clients', icon: Users }
];

const formatChange = (value) => {
  if (value === 0) return <span className="text-gray-400">0%</span>;
  const positive = value > 0;
  return (
    <span className={`text-xs font-bold ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
};

const StatCard = ({ label, value, change, icon: Icon, color = 'orange' }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <div className={`rounded-lg p-1.5 bg-${color}-50`}>
        <Icon size={14} className={`text-${color}-500`} />
      </div>
    </div>
    <p className="mt-2 text-xl font-black text-gray-900">{value}</p>
    {change !== undefined && <div className="mt-0.5">{formatChange(change)}</div>}
  </div>
);

// Simple bar chart using CSS
const MiniBar = ({ value, max, color = '#F97316' }) => (
  <div className="h-2 w-full rounded-full bg-gray-100">
    <div
      className="h-2 rounded-full transition-all"
      style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, backgroundColor: color }}
    />
  </div>
);

export default function SellerAnalyticsV2() {
  const { user } = useContext(AuthContext);
  const { formatPrice, t } = useAppSettings();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assistantShop, setAssistantShop] = useState(null);

  const isShop = user?.accountType === 'shop';
  const isAssistant = Boolean(assistantShop?._id);
  const canView = isShop || isAssistant;

  // Check if user is a shop assistant
  useEffect(() => {
    if (!user?._id || isShop) return;
    api.get('/shops/me/assistant-shop')
      .then(({ data }) => {
        if (data?.data?.shop) {
          setAssistantShop({ _id: data.data.shop._id, shopName: data.data.shop.shopName || data.data.shop.name });
        }
      })
      .catch(() => setAssistantShop(null));
  }, [user?._id, isShop]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ov, pr, cu] = await Promise.all([
        api.get('/seller-analytics-v2/overview'),
        api.get('/seller-analytics-v2/products'),
        api.get('/seller-analytics-v2/customers')
      ]);
      setOverview(ov.data);
      setProducts(pr.data);
      setCustomers(cu.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Réservé aux boutiques et assistants.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hd-profile-flow min-h-screen">
        <div className="mx-auto max-w-3xl px-4 pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-200" />)}
            </div>
            <div className="h-64 rounded-2xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={loadData} className="text-xs font-semibold text-orange-600 underline">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="hd-profile-flow min-h-screen">
      <header className="ui-glass-header">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/profile" className="ui-btn-ghost inline-flex h-10 w-10 items-center justify-center">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-base font-bold">📊 {t('analytics.title', 'Tableau de bord')}</h1>
            <p className="text-xs text-gray-500">
              {isAssistant ? assistantShop?.shopName : user?.shopName || user?.name}
              {isAssistant && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  Assistant
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto flex max-w-3xl gap-1 px-4 pt-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition ${
              tab === t.key
                ? 'bg-orange-500 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <t.icon size={14} className="mx-auto mb-0.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-20 pt-4">
        {/* ── Assistant info banner ── */}
        {isAssistant && (
          <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            <span className="font-bold">📊 Vue boutique :</span> Vous consultez les statistiques de <span className="font-bold">{assistantShop?.shopName}</span>.
            <Link to="/user-stats" className="ml-2 text-xs font-semibold text-blue-600 underline">
              Voir mes statistiques personnelles →
            </Link>
          </div>
        )}
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Revenu (30j)" value={formatPrice(overview.revenue.current)} change={overview.revenue.change} icon={DollarSign} color="green" />
              <StatCard label="Commandes (30j)" value={overview.orders.current} change={overview.orders.change} icon={ShoppingCart} color="orange" />
              <StatCard label="Vues (30j)" value={overview.views.current} change={overview.views.change} icon={Eye} color="blue" />
              <StatCard label="Taux de conversion" value={`${overview.conversion.current}%`} icon={TrendingUp} color="purple" />
            </div>

            {/* Sales Chart */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">📈 Ventes — 14 derniers jours</h3>
              <div className="flex items-end gap-1" style={{ height: '120px' }}>
                {(overview.dailySales || []).map((day) => {
                  const maxRev = Math.max(...(overview.dailySales || []).map(d => d.revenue), 1);
                  const h = Math.max(4, (day.revenue / maxRev) * 100);
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                      <span className="text-[9px] text-gray-400 mb-0.5">{day.orders > 0 ? day.orders : ''}</span>
                      <div
                        className="w-full rounded-t bg-orange-400 transition-all hover:bg-orange-500"
                        style={{ height: `${h}%` }}
                        title={`${day.date}: ${formatPrice(day.revenue)} (${day.orders} cmd)`}
                      />
                      <span className="mt-1 text-[8px] text-gray-400">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── PRODUCTS ── */}
        {tab === 'products' && products && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{products.total} produits analysés</p>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-3 py-2 font-semibold">Produit</th>
                      <th className="px-3 py-2 font-semibold text-right">Prix</th>
                      <th className="px-3 py-2 font-semibold text-right">Ventes</th>
                      <th className="px-3 py-2 font-semibold text-right">Vues</th>
                      <th className="px-3 py-2 font-semibold text-right">Conv.</th>
                      <th className="px-3 py-2 font-semibold text-right">Revenu 30j</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.items.slice(0, 20).map((p) => (
                      <tr key={p._id} className="border-b hover:bg-gray-50">
                        <td className="max-w-[140px] truncate px-3 py-2 font-medium">{p.title}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(p.price)}</td>
                        <td className="px-3 py-2 text-right">{p.salesCount}</td>
                        <td className="px-3 py-2 text-right">{p.views}</td>
                        <td className="px-3 py-2 text-right">{p.conversionRate}%</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatPrice(p.revenue30)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CUSTOMERS ── */}
        {tab === 'customers' && customers && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Clients uniques" value={customers.totalCustomers} icon={Users} color="blue" />
              <StatCard label="Clients fidèles" value={`${customers.repeatCustomers} (${customers.repeatRate}%)`} icon={TrendingUp} color="green" />
              <StatCard label="Panier moyen" value={formatPrice(customers.aov)} icon={ShoppingCart} color="orange" />
              <StatCard label="Total commandes" value={customers.totalOrders} icon={Package} color="purple" />
            </div>

            {/* Top Cities */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">📍 Villes des acheteurs</h3>
              <div className="space-y-2">
                {customers.topCities.map((city) => {
                  const maxCount = customers.topCities[0]?.count || 1;
                  return (
                    <div key={city.name} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-gray-600 truncate">{city.name}</span>
                      <div className="flex-1"><MiniBar value={city.count} max={maxCount} /></div>
                      <span className="text-xs text-gray-500">{city.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak Hours */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">⏰ Heures d'achat</h3>
              <div className="flex items-end gap-1" style={{ height: '80px' }}>
                {(customers.peakHours || []).map((h) => {
                  const maxVal = Math.max(...(customers.peakHours || []).map(d => d.count), 1);
                  const height = Math.max(4, (h.count / maxVal) * 100);
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                      <div className="w-full rounded-t bg-blue-400" style={{ height: `${height}%` }} title={`${h.count} commandes`} />
                      <span className="mt-1 text-[9px] text-gray-400">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak Days */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-gray-900">📅 Jours d'achat</h3>
              <div className="space-y-2">
                {(customers.peakDays || []).map((d) => {
                  const maxDay = Math.max(...(customers.peakDays || []).map(dd => dd.count), 1);
                  return (
                    <div key={d.day} className="flex items-center gap-2">
                      <span className="w-10 text-xs font-semibold text-gray-600">{d.day}</span>
                      <div className="flex-1"><MiniBar value={d.count} max={maxDay} color="#22C55E" /></div>
                      <span className="text-xs text-gray-500">{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
