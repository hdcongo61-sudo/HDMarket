import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock4,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import api from '../services/api';

const asNumber = (value) => Number(value || 0);

const formatPercent = (value) =>
  `${asNumber(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}%`;

const formatNumber = (value) => asNumber(value).toLocaleString('fr-FR');

function MiniCard({ label, value, helper, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className="rounded-xl bg-gray-100 p-2 text-gray-700">
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FounderNotificationsIntelligence() {
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['founder', 'notifications', 'analytics'],
    queryFn: async () => {
      const res = await api.get('/founder/notifications/analytics');
      return res.data || {};
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1
  });

  const unreadTrend = useMemo(
    () =>
      Array.isArray(data?.metrics?.unreadBacklogTrend)
        ? data.metrics.unreadBacklogTrend
        : [],
    [data]
  );
  const pendingTrend = useMemo(
    () =>
      Array.isArray(data?.ops?.pendingValidationsOverTime)
        ? data.ops.pendingValidationsOverTime
        : [],
    [data]
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                <Bell size={14} />
                Founder Notifications Intelligence
              </p>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">Ops & Delivery de notifications</h1>
              <p className="mt-1 text-xs text-gray-500">
                Cache {formatNumber(data?.cache?.ttlSeconds)}s · Généré {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
                Rafraîchir
              </button>
              <Link
                to="/admin/founder-intelligence"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Founder KPI
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error?.response?.data?.message || error?.message || 'Impossible de charger les analytics notifications.'}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
            Chargement analytics notifications...
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniCard
                label="Taux de delivery push"
                value={formatPercent(data?.metrics?.deliverySuccessRate)}
                helper={`Open rate ${formatPercent(data?.metrics?.openRate)}`}
                icon={TrendingUp}
              />
              <MiniCard
                label="CTR deep link"
                value={formatPercent(data?.metrics?.clickThroughRate)}
                helper={`Invalid token ${formatPercent(data?.metrics?.invalidTokenRate)}`}
                icon={CheckCircle2}
              />
              <MiniCard
                label="Queue latency"
                value={`${formatNumber(data?.metrics?.queueLatencySeconds)} s`}
                helper={`TTR ${formatNumber(data?.metrics?.averageTimeToReadMinutes)} min`}
                icon={Clock4}
              />
              <MiniCard
                label="Pending validations"
                value={formatNumber(data?.ops?.pendingValidationsNow)}
                helper={`Approve avg ${formatNumber(data?.ops?.averageTimeToApproveMinutes)} min`}
                icon={AlertTriangle}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Unread backlog trend (14j)
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={unreadTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="unread"
                        stroke="#111827"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Validations created vs completed
                </h2>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pendingTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="created" fill="#111827" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="completed" fill="#6B7280" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Top ignored categories
                </h2>
                <div className="space-y-2">
                  {(data?.metrics?.topIgnoredCategories || []).map((row) => (
                    <div key={row.type} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">{row.type}</span>
                      <span className="text-sm font-semibold text-gray-900">{formatNumber(row.unreadCount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                  Founder alerts
                </h2>
                <div className="space-y-2">
                  {(data?.alerts || []).length ? (
                    (data?.alerts || []).map((alert) => (
                      <div
                        key={alert.code}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          alert.level === 'critical'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {alert.message}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Aucune alerte critique.</p>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

