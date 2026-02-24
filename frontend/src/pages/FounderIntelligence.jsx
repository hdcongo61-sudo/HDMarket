import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, Crown, RefreshCcw, ShieldAlert, TrendingUp, Users } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatPercent = (value) => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`;
const formatCurrency = (value) => formatPriceWithStoredSettings(Number(value || 0));

function KpiCard({ label, value, helper, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          {helper ? <p className="mt-1 text-xs text-slate-400">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-emerald-300">
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FounderIntelligence() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async ({ force = false } = {}) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: payload } = await api.get('/founder/intelligence', {
        params: force ? { refresh: 'true' } : undefined
      });
      setData(payload || null);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Impossible de charger les données intelligence.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'founder') return;
    loadData();
    const timer = setInterval(() => {
      loadData();
    }, 5000);
    return () => clearInterval(timer);
  }, [user?.role, loadData]);

  const topSellers = useMemo(
    () => (Array.isArray(data?.sellerIntelligence?.leaderboard) ? data.sellerIntelligence.leaderboard : []),
    [data]
  );
  const conversionCities = useMemo(
    () => (Array.isArray(data?.kpis?.conversionRateByCity) ? data.kpis.conversionRateByCity : []),
    [data]
  );
  const riskLines = useMemo(
    () => (Array.isArray(data?.executiveSummary?.keyRisks) ? data.executiveSummary.keyRisks : []),
    [data]
  );
  const heatmap = useMemo(
    () => (Array.isArray(data?.trafficIntelligence?.recentHeatmap) ? data.trafficIntelligence.recentHeatmap : []),
    [data]
  );

  if (user?.role !== 'founder') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-500/30 bg-red-950/30 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-300">Accès restreint</p>
          <h1 className="mt-2 text-2xl font-semibold">Founder Intelligence</h1>
          <p className="mt-2 text-sm text-red-100/90">
            Cet espace est réservé au rôle <code>founder</code>.
          </p>
          <Link to="/admin" className="mt-4 inline-flex text-sm font-semibold text-emerald-300 hover:text-emerald-200">
            Retour administration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-5 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <Crown size={14} />
                Founder Confidential
              </p>
              <h1 className="mt-3 text-2xl font-semibold">Executive Intelligence Layer</h1>
              <p className="mt-1 text-sm text-slate-300">
                Mise à jour continue (5s) · Cache serveur {formatNumber(data?.cache?.ttlSeconds)}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData({ force: true })}
                disabled={refreshing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-60"
              >
                <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
                Rafraîchir
              </button>
              <Link
                to="/admin"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-600 bg-slate-900 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Admin
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-900/20 p-4 text-sm text-red-100">{error}</div>
        ) : null}
        {loading && !data ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-sm text-slate-300">Chargement intelligence...</div>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Revenue / Active User"
                value={formatCurrency(data?.kpis?.revenuePerActiveUser)}
                helper={`AOV ${formatCurrency(data?.kpis?.averageOrderValue)}`}
                icon={TrendingUp}
              />
              <KpiCard
                label="Retention 30 jours"
                value={formatPercent(data?.kpis?.retention30Day)}
                helper={`7 jours ${formatPercent(data?.kpis?.retention7Day)}`}
                icon={Users}
              />
              <KpiCard
                label="Churn détecté"
                value={formatPercent(data?.kpis?.churnDetectionRate)}
                helper={`Utilisateurs à forte valeur: ${formatNumber(data?.kpis?.highValueUsers)}`}
                icon={ShieldAlert}
              />
              <KpiCard
                label="Croissance hebdo"
                value={formatPercent(data?.kpis?.growthVelocity?.weekly)}
                helper={`Jour: ${formatPercent(data?.kpis?.growthVelocity?.daily)}`}
                icon={ArrowUpRight}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 xl:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Seller Leaderboard</h2>
                </div>
                <div className="space-y-2">
                  {topSellers.slice(0, 10).map((seller, index) => (
                    <div key={`${seller.sellerId}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-800/70 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{seller.sellerName}</p>
                        <p className="text-xs text-slate-400">
                          Risque {formatPercent(seller.riskScore)} · Annulation {formatPercent(seller.cancellationRate)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-300">{formatCurrency(seller.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Risk Alerts</h2>
                </div>
                <div className="space-y-2">
                  {riskLines.map((line, index) => (
                    <p key={`risk-${index}`} className="rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Conversion par ville</h2>
                <div className="space-y-2">
                  {conversionCities.slice(0, 8).map((row) => (
                    <div key={row.city} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm">
                      <span className="text-slate-200">{row.city}</span>
                      <span className="font-semibold text-emerald-300">{formatPercent(row.conversionRate)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Heatmap activité (7+ jours)</h2>
                <div className="space-y-2">
                  {heatmap.slice(-7).map((entry) => {
                    const maxCount = Math.max(...(entry.hourlyActivity || []).map((h) => Number(h.count || 0)), 1);
                    return (
                      <div key={entry.day} className="space-y-1">
                        <p className="text-xs text-slate-400">{entry.day}</p>
                        <div className="grid grid-cols-12 gap-1">
                          {(entry.hourlyActivity || []).slice(0, 24).map((hour) => (
                            <div
                              key={`${entry.day}-${hour.hour}`}
                              className="h-2 rounded bg-emerald-500/20"
                              style={{ opacity: 0.25 + Math.min(0.75, Number(hour.count || 0) / maxCount) }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

