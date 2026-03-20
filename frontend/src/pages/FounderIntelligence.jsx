import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowUpRight, Crown, RefreshCcw, ShieldAlert, Sparkles, TrendingUp, Users } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import GlassCard from '../components/ui/GlassCard';
import AppOfflineDiagnosticsCard from '../components/admin/AppOfflineDiagnosticsCard';

const formatNumber = (value) => Number(value || 0).toLocaleString('fr-FR');
const formatPercent = (value) => `${Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`;
const formatCurrency = (value) => formatPriceWithStoredSettings(Number(value || 0));
const REALTIME_WINDOW_OPTIONS = [
  { value: 15, label: '15m' },
  { value: 60, label: '60m' },
  { value: 180, label: '180m' }
];

function KpiCard({ label, value, helper, icon: Icon, variant = 'glass' }) {
  return (
    <GlassCard variant={variant} className="min-w-0 overflow-hidden p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">{label}</p>
          <p className="mt-2 break-words text-xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-2xl">{value}</p>
          {helper ? <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className="soft-card soft-card-green shrink-0 rounded-xl p-2 text-emerald-700 dark:text-emerald-100">
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}

export default function FounderIntelligence() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [realtime, setRealtime] = useState(null);
  const [realtimeLoading, setRealtimeLoading] = useState(false);
  const [realtimeError, setRealtimeError] = useState('');
  const [realtimeWindowMinutes, setRealtimeWindowMinutes] = useState(60);

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

  const loadRealtime = useCallback(async () => {
    setRealtimeLoading(true);
    try {
      const { data: payload } = await api.get('/founder/realtime-monitoring', {
        params: {
          windowMinutes: realtimeWindowMinutes,
          topLimit: 8,
          recentLimit: 14
        }
      });
      setRealtime(payload || null);
      setRealtimeError('');
    } catch (e) {
      setRealtimeError(
        e.response?.data?.message || e.message || 'Impossible de charger le monitoring temps réel.'
      );
    } finally {
      setRealtimeLoading(false);
    }
  }, [realtimeWindowMinutes]);

  useEffect(() => {
    if (user?.role !== 'founder') return;
    loadData();
    loadRealtime();
    const timer = setInterval(() => {
      loadData();
      loadRealtime();
    }, 5000);
    return () => clearInterval(timer);
  }, [user?.role, loadData, loadRealtime]);

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
  const realtimeTopPages = useMemo(
    () => (Array.isArray(realtime?.topPages) ? realtime.topPages : []),
    [realtime]
  );
  const realtimeEvents = useMemo(
    () => (Array.isArray(realtime?.recentEvents) ? realtime.recentEvents : []),
    [realtime]
  );

  if (user?.role !== 'founder') {
    return (
      <div className="glass-page-shell min-h-screen px-4 py-10">
        <div className="soft-card soft-card-red mx-auto max-w-3xl rounded-2xl p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-100">Accès restreint</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Founder Intelligence</h1>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-100">
            Cet espace est réservé au rôle <code>founder</code>.
          </p>
          <Link to="/admin" className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:text-black dark:text-slate-100 dark:hover:text-white">
            Retour administration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-page-shell min-h-screen overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 md:px-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <section className="glass-card glass-fade-in relative overflow-hidden rounded-[28px] p-4 shadow-sm sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-sky-200/35 via-white/10 to-violet-200/35 blur-2xl dark:from-sky-500/10 dark:via-transparent dark:to-violet-500/10" />
          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="soft-card soft-card-purple inline-flex min-h-[34px] items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-purple-900 dark:text-purple-100">
                    <Crown size={14} />
                    Founder Confidential
                  </span>
                  <span className="inline-flex min-h-[34px] items-center rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-300">
                    Live refresh 5s
                  </span>
                </div>
                <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">
                  Executive Intelligence Layer
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
                  Pilotage founder en direct pour la croissance, les risques et les signaux d&apos;usage critiques de la plateforme.
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    loadData({ force: true });
                    loadRealtime();
                  }}
                  disabled={refreshing}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  <RefreshCcw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Rafraichir
                </button>
                <Link
                  to="/admin/founder-notifications-intelligence"
                  className="glass-card inline-flex min-h-[48px] items-center justify-center rounded-2xl px-4 text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-100 dark:hover:text-white"
                >
                  Notifications
                </Link>
                <Link
                  to="/admin"
                  className="glass-card col-span-2 inline-flex min-h-[48px] items-center justify-center rounded-2xl px-4 text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-100 dark:hover:text-white sm:col-span-1"
                >
                  Admin
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Cache</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatNumber(data?.cache?.ttlSeconds)}s</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Live pages</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatNumber(realtime?.totals?.pageViews)}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Risque</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatNumber(riskLines.length)} alertes</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 px-3 py-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/40">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-300">Top sellers</p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatNumber(topSellers.length)}</p>
              </div>
            </div>
          </div>
        </section>

        <AppOfflineDiagnosticsCard title="Diagnostic local founder" className="overflow-hidden" />

        {error ? (
          <div className="soft-card soft-card-red rounded-2xl p-4 text-sm text-red-700 dark:text-red-100">{error}</div>
        ) : null}
        {loading && !data ? (
          <div className="glass-skeleton rounded-2xl p-6 text-sm text-slate-500 dark:text-slate-300">Chargement intelligence...</div>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

            <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <KpiCard
                label="Full Payment Conversion"
                value={formatPercent(data?.kpis?.fullPaymentConversion?.adoptionRate)}
                helper={`${formatNumber(data?.kpis?.fullPaymentConversion?.ordersPaidInFull)} commandes payées en full`}
                icon={Crown}
              />
              <KpiCard
                label="Livraisons offertes"
                value={formatNumber(data?.kpis?.fullPaymentConversion?.deliveryFeesWaivedCount)}
                helper={`Montant offert ${formatCurrency(data?.kpis?.fullPaymentConversion?.waivedDeliveryAmount)}`}
                icon={Sparkles}
              />
              <KpiCard
                label="Impact revenu"
                value={formatCurrency(data?.kpis?.fullPaymentConversion?.revenueImpact)}
                helper="GMV associé aux commandes full payment"
                icon={TrendingUp}
              />
            </section>

            <section className="glass-card overflow-hidden rounded-[28px] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">
                    Realtime Monitoring ({realtimeWindowMinutes} min)
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Top pages, likes, commentaires et activité récente.
                  </p>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {realtimeLoading ? 'Mise à jour…' : `MAJ ${realtime?.updatedAt ? new Date(realtime.updatedAt).toLocaleTimeString('fr-FR') : '—'}`}
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/70 bg-white/50 p-1 dark:border-slate-700/70 dark:bg-slate-900/30 sm:inline-grid sm:w-auto">
                {REALTIME_WINDOW_OPTIONS.map((option) => {
                  const active = realtimeWindowMinutes === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRealtimeWindowMinutes(option.value)}
                      className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition ${
                        active
                          ? 'soft-card soft-card-purple text-purple-900 dark:text-purple-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {realtimeError ? (
                <div className="soft-card soft-card-red mt-3 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-100">
                  {realtimeError}
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard label="Visites pages" value={formatNumber(realtime?.totals?.pageViews)} />
                <KpiCard label="Likes" value={formatNumber(realtime?.totals?.likes)} />
                <KpiCard label="Commentaires" value={formatNumber(realtime?.totals?.comments)} />
                <KpiCard label="Visiteurs uniques" value={formatNumber(realtime?.totals?.uniqueVisitors)} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="glass-card min-w-0 overflow-hidden rounded-2xl p-3 sm:p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Top pages</p>
                  <div className="mt-2 space-y-2">
                    {realtimeTopPages.length ? (
                      realtimeTopPages.slice(0, 8).map((item, index) => (
                        <div
                          key={`${item.path}-${index}`}
                          className="glass-card flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-100"
                        >
                          <span className="min-w-0 flex-1 truncate pr-2">{item.path || '/'}</span>
                          <span className="soft-card soft-card-green rounded-full px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-100">
                            {formatNumber(item.views)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300">Aucune visite récente.</p>
                    )}
                  </div>
                </div>
                <div className="glass-card min-w-0 overflow-hidden rounded-2xl p-3 sm:p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Flux live</p>
                  <div className="mt-2 space-y-2">
                    {realtimeEvents.length ? (
                      realtimeEvents.slice(0, 8).map((event) => (
                        <div
                          key={event.id}
                          className="glass-card min-w-0 rounded-xl px-2.5 py-2 text-xs text-slate-700 dark:text-slate-100"
                        >
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {String(event.eventType || '').toUpperCase()}
                            {event.path ? ` · ${event.path}` : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                            {event.createdAt ? new Date(event.createdAt).toLocaleTimeString('fr-FR') : '—'} · {event.role || 'guest'}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-300">Aucun événement live.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="glass-card overflow-hidden rounded-[28px] p-4 sm:p-5 xl:col-span-2">
                <div className="mb-3 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-600 dark:text-emerald-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Seller Leaderboard</h2>
                </div>
                <div className="space-y-2">
                  {topSellers.slice(0, 10).map((seller, index) => (
                    <div key={`${seller.sellerId}-${index}`} className="glass-card flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{seller.sellerName}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Risque {formatPercent(seller.riskScore)} · Annulation {formatPercent(seller.cancellationRate)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-100">{formatCurrency(seller.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card overflow-hidden rounded-[28px] p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-300" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Risk Alerts</h2>
                </div>
                <div className="space-y-2">
                  {riskLines.length ? (
                    riskLines.map((line, index) => (
                      <p key={`risk-${index}`} className="soft-card soft-card-orange rounded-2xl px-3 py-2.5 text-xs leading-relaxed text-orange-900 dark:text-orange-100">
                        {line}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Aucun risque prioritaire remonté.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="glass-card overflow-hidden rounded-[28px] p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Conversion par ville</h2>
                <div className="space-y-2">
                  {conversionCities.slice(0, 8).map((row) => (
                    <div key={row.city} className="glass-card flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-100">{row.city}</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-100">{formatPercent(row.conversionRate)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card overflow-hidden rounded-[28px] p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">Heatmap activité (7+ jours)</h2>
                <div className="space-y-2">
                  {heatmap.slice(-7).map((entry) => {
                    const maxCount = Math.max(...(entry.hourlyActivity || []).map((h) => Number(h.count || 0)), 1);
                    return (
                      <div key={entry.day} className="space-y-1">
                        <p className="text-xs text-slate-600 dark:text-slate-300">{entry.day}</p>
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
