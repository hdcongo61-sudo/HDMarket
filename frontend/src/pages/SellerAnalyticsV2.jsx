import { AiReportPanel } from '../components/commerce-ai/AiPanel';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon, ArrowTrendingUpIcon, ChartBarIcon, CubeIcon, CurrencyDollarIcon, EyeIcon, ShoppingCartIcon, UsersIcon } from '@heroicons/react/24/outline';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import api from '../services/api';

const TABS = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: ChartBarIcon },
  { key: 'products', label: 'Produits', icon: CubeIcon },
  { key: 'customers', label: 'Clients', icon: UsersIcon }
];

const formatChange = (value) => {
  if (value === 0) return <span className="text-neutral-400">0%</span>;
  const positive = value > 0;
  return (
    <span className={`text-[11px] font-black ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
};

const StatCard = ({ label, value, change, icon: Icon }) => (
  <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-bold text-[#8a8378]">{label}</span>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#fff0e4] text-[#e85d00]">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <p className="mt-2 text-xl font-black text-[#231f1b]">{value}</p>
    {change !== undefined && <div className="mt-0.5">{formatChange(change)}</div>}
  </div>
);

// Simple bar chart using CSS
const MiniBar = ({ value, max, color = '#F97316' }) => (
  <div className="h-2 w-full rounded-full bg-[#f5f2ee]">
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
      <div className="flex min-h-screen items-center justify-center bg-[#f5f2ee]">
        <p className="text-sm font-bold text-[#8a8378]">Réservé aux boutiques et assistants.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f2ee]">
        <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-3 py-6 sm:px-6">
          <div className="h-8 w-48 rounded-lg bg-[#e2dcd2]" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#e2dcd2]" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-[#e2dcd2]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f5f2ee]">
        <p className="text-sm font-bold text-red-500">{error}</p>
        <button onClick={loadData} className="rounded-full bg-[#e85d00] px-4 py-2 text-xs font-black text-white">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ee] pb-20 text-[#231f1b]">
      <header className="sticky top-0 z-30 border-b border-[#e2dcd2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6">
          <Link
            to="/seller/products"
            className="grid h-10 w-10 place-items-center rounded-full border border-[#e2dcd2] text-[#6b6459] transition active:bg-[#f5f2ee]"
          >
            <ArrowLeftIcon className="h-[18px] w-[18px]" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base font-black">{t('analytics.title', 'Statistiques')}</h1>
            <p className="truncate text-[11px] font-bold text-[#8a8378]">
              {isAssistant ? assistantShop?.shopName : user?.shopName || user?.name}
              {isAssistant ? ' · Assistant' : ''}
            </p>
          </div>
        </div>
      </header>

      {/* Tabs — flat underline style */}
      <div className="mx-auto flex max-w-6xl gap-2 px-3 pt-3 sm:px-6">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-black transition sm:flex-none sm:px-5 ${
                active
                  ? 'bg-[#231f1b] text-white shadow-sm'
                  : 'bg-white text-[#6b6459] ring-1 ring-[#e2dcd2] active:scale-95'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-6">
        {/* ── Assistant info banner ── */}
        {isAssistant && (
          <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">
            <span>Vue boutique :</span> vous consultez les statistiques de <span className="font-black">{assistantShop?.shopName}</span>.
            <Link to="/stats" className="ml-2 text-xs font-black text-sky-600 underline">
              Voir mes statistiques personnelles →
            </Link>
          </div>
        )}
        {!isAssistant && <AiReportPanel />}
        {/* ── OVERVIEW ── */}
        {tab === 'overview' && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Revenu (30j)" value={formatPrice(overview.revenue.current)} change={overview.revenue.change} icon={CurrencyDollarIcon} />
              <StatCard label="Commandes (30j)" value={overview.orders.current} change={overview.orders.change} icon={ShoppingCartIcon} />
              <StatCard label="Vues (30j)" value={overview.views.current} change={overview.views.change} icon={EyeIcon} />
              <StatCard label="Taux de conversion" value={`${overview.conversion.current}%`} icon={ArrowTrendingUpIcon} />
            </div>

            {/* Sales Chart */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black">
                <ArrowTrendingUpIcon className="h-4 w-4 text-[#e85d00]" /> Ventes — 14 derniers jours
              </h3>
              <div className="flex items-end gap-1" style={{ height: '120px' }}>
                {(overview.dailySales || []).map((day) => {
                  const maxRev = Math.max(...(overview.dailySales || []).map(d => d.revenue), 1);
                  const h = Math.max(4, (day.revenue / maxRev) * 100);
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                      <span className="mb-0.5 text-[9px] text-[#8a8378]">{day.orders > 0 ? day.orders : ''}</span>
                      <div
                        className="w-full rounded-t bg-[#e85d00] transition-all"
                        style={{ height: `${h}%` }}
                        title={`${day.date}: ${formatPrice(day.revenue)} (${day.orders} cmd)`}
                      />
                      <span className="mt-1 text-[8px] text-[#8a8378]">
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
            <p className="text-xs font-bold text-[#8a8378]">{products.total} produits analysés</p>
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#e2dcd2]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#e2dcd2] bg-[#faf7f2] text-left">
                      <th className="px-3 py-2 font-black text-[#8a8378]">Produit</th>
                      <th className="px-3 py-2 text-right font-black text-[#8a8378]">Prix</th>
                      <th className="px-3 py-2 text-right font-black text-[#8a8378]">Ventes</th>
                      <th className="px-3 py-2 text-right font-black text-[#8a8378]">Vues</th>
                      <th className="px-3 py-2 text-right font-black text-[#8a8378]">Conv.</th>
                      <th className="px-3 py-2 text-right font-black text-[#8a8378]">Revenu 30j</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.items.slice(0, 20).map((p) => (
                      <tr key={p._id} className="border-b border-[#f3ede6] last:border-0 hover:bg-[#faf7f2]">
                        <td className="max-w-[140px] truncate px-3 py-2 font-bold">{p.title}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(p.price)}</td>
                        <td className="px-3 py-2 text-right">{p.salesCount}</td>
                        <td className="px-3 py-2 text-right">{p.views}</td>
                        <td className="px-3 py-2 text-right">{p.conversionRate}%</td>
                        <td className="px-3 py-2 text-right font-black text-[#e85d00]">{formatPrice(p.revenue30)}</td>
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
              <StatCard label="Clients uniques" value={customers.totalCustomers} icon={UsersIcon} />
              <StatCard label="Clients fidèles" value={`${customers.repeatCustomers} (${customers.repeatRate}%)`} icon={ArrowTrendingUpIcon} />
              <StatCard label="Panier moyen" value={formatPrice(customers.aov)} icon={ShoppingCartIcon} />
              <StatCard label="Total commandes" value={customers.totalOrders} icon={CubeIcon} />
            </div>

            {/* Top Cities */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
              <h3 className="mb-3 text-sm font-black">Villes des acheteurs</h3>
              <div className="space-y-2">
                {customers.topCities.map((city) => {
                  const maxCount = customers.topCities[0]?.count || 1;
                  return (
                    <div key={city.name} className="flex items-center gap-2">
                      <span className="w-20 truncate text-xs font-bold text-[#6b6459]">{city.name}</span>
                      <div className="flex-1"><MiniBar value={city.count} max={maxCount} /></div>
                      <span className="text-xs font-bold text-[#8a8378]">{city.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak Hours */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
              <h3 className="mb-3 text-sm font-black">Heures d'achat</h3>
              <div className="flex items-end gap-1" style={{ height: '80px' }}>
                {(customers.peakHours || []).map((h) => {
                  const maxVal = Math.max(...(customers.peakHours || []).map(d => d.count), 1);
                  const height = Math.max(4, (h.count / maxVal) * 100);
                  return (
                    <div key={h.hour} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                      <div className="w-full rounded-t bg-[#e85d00]" style={{ height: `${height}%` }} title={`${h.count} commandes`} />
                      <span className="mt-1 text-[9px] text-[#8a8378]">{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Peak Days */}
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2dcd2]">
              <h3 className="mb-3 text-sm font-black">Jours d'achat</h3>
              <div className="space-y-2">
                {(customers.peakDays || []).map((d) => {
                  const maxDay = Math.max(...(customers.peakDays || []).map(dd => dd.count), 1);
                  return (
                    <div key={d.day} className="flex items-center gap-2">
                      <span className="w-10 text-xs font-black text-[#6b6459]">{d.day}</span>
                      <div className="flex-1"><MiniBar value={d.count} max={maxDay} color="#22C55E" /></div>
                      <span className="text-xs font-bold text-[#8a8378]">{d.count}</span>
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
