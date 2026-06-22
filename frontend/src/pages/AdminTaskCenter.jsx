import React, { useContext, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock3, Filter, PackageCheck, RefreshCw, ShieldAlert, Truck } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { AdminCommandHero, AdminSegmentedControl } from '../components/admin/AdminCommandSurface';

const VALIDATION_TYPE_OPTIONS = [
  { value: '', label: 'Toutes', icon: Filter },
  { value: 'boostApproval', label: 'Boost', icon: CheckCircle2 },
  { value: 'productValidation', label: 'Produits/Paiements', icon: PackageCheck },
  { value: 'deliveryOps', label: 'Livraison', icon: Truck },
  { value: 'disputes', label: 'Litiges', icon: ShieldAlert },
  { value: 'shopConversion', label: 'Conversion boutique', icon: AlertCircle }
];

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('fr-FR') : '—';

export default function AdminTaskCenter() {
  const [validationType, setValidationType] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isFounder = String(user?.role || '').toLowerCase() === 'founder';

  const summaryQuery = useQuery({
    queryKey: ['admin', 'tasks', 'summary', isFounder ? 'founder' : 'admin'],
    queryFn: async () => {
      const res = await api.get(isFounder ? '/founder/tasks/summary' : '/admin/tasks/summary');
      return res.data || {};
    },
    staleTime: 30 * 1000
  });

  const listQuery = useQuery({
    queryKey: ['admin', 'tasks', 'list', isFounder ? 'founder' : 'admin', validationType],
    queryFn: async () => {
      const res = await api.get(isFounder ? '/founder/tasks/validation' : '/admin/tasks/validation', {
        params: { status: 'PENDING', validationType, limit: 100 }
      });
      return res.data || { items: [], pagination: {} };
    },
    staleTime: 20 * 1000
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId) => {
      await api.patch(`/admin/tasks/validation/${taskId}/done`);
      return taskId;
    },
    onMutate: async (taskId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['admin', 'tasks', 'list'] }),
        queryClient.cancelQueries({ queryKey: ['admin', 'tasks', 'summary'] })
      ]);

      const listKey = ['admin', 'tasks', 'list', isFounder ? 'founder' : 'admin', validationType];
      const summaryKey = ['admin', 'tasks', 'summary', isFounder ? 'founder' : 'admin'];
      const previousList = queryClient.getQueryData(listKey);
      const previousSummary = queryClient.getQueryData(summaryKey);

      queryClient.setQueryData(listKey, (current) => {
        const currentItems = Array.isArray(current?.items) ? current.items : [];
        return {
          ...(current || {}),
          items: currentItems.filter((item) => String(item.id) !== String(taskId))
        };
      });

      queryClient.setQueryData(summaryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pendingTotal: Math.max(0, Number(current.pendingTotal || 0) - 1)
        };
      });

      return { previousList, previousSummary };
    },
    onError: (_error, _taskId, context) => {
      const listKey = ['admin', 'tasks', 'list', isFounder ? 'founder' : 'admin', validationType];
      const summaryKey = ['admin', 'tasks', 'summary', isFounder ? 'founder' : 'admin'];
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList);
      }
      if (context?.previousSummary) {
        queryClient.setQueryData(summaryKey, context.previousSummary);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
    }
  });

  const tasks = useMemo(() => (Array.isArray(listQuery.data?.items) ? listQuery.data.items : []), [listQuery.data]);
  const pendingTotal = Number(summaryQuery.data?.pendingTotal || 0);
  const taskTypeCounts = summaryQuery.data?.pendingByType || summaryQuery.data?.byType || {};
  const filterOptions = VALIDATION_TYPE_OPTIONS.map((option) => ({
    ...option,
    count: option.value ? Number(taskTypeCounts?.[option.value] || 0) : pendingTotal
  }));

  return (
    <div className="min-h-screen bg-neutral-50 px-3 py-4 text-neutral-950 dark:bg-neutral-950 dark:text-white md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <AdminCommandHero
          eyebrow={isFounder ? 'Founder operations' : 'Admin operations'}
          title="Centre de commande"
          subtitle="Une file unique pour les validations qui demandent une action humaine: produits, paiements, livraisons, litiges et conversions boutique."
          meta={summaryQuery.data ? `${pendingTotal} tâche${pendingTotal > 1 ? 's' : ''} en attente` : 'Chargement des compteurs...'}
          metrics={[
            { label: 'En attente', value: pendingTotal, help: 'Toutes validations', icon: Clock3 },
            { label: 'Produits', value: Number(taskTypeCounts?.productValidation || 0), help: 'Paiements inclus', icon: PackageCheck },
            { label: 'Livraison', value: Number(taskTypeCounts?.deliveryOps || 0), help: 'À surveiller', icon: Truck },
            { label: 'Litiges', value: Number(taskTypeCounts?.disputes || 0), help: 'Priorité élevée', icon: ShieldAlert }
          ]}
          actions={[
            {
              label: 'Actualiser',
              description: 'Synchroniser les compteurs',
              icon: RefreshCw,
              tone: 'dark',
              loading: summaryQuery.isFetching || listQuery.isFetching,
              onClick: () => {
                summaryQuery.refetch();
                listQuery.refetch();
              }
            }
          ]}
        />

        <AdminSegmentedControl
          options={filterOptions}
          value={validationType}
          onChange={(value) => setValidationType(value)}
        />

        <section className="space-y-3">
          {listQuery.isLoading ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              Chargement des tâches...
            </div>
          ) : null}

          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {task.validationType || 'other'}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      String(task.priority || '').toUpperCase() === 'HIGH' || String(task.priority || '').toUpperCase() === 'CRITICAL'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}>
                      {task.priority || 'NORMAL'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">
                    {task.title || 'Action de validation requise'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{task.message || 'Aucune description.'}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    Créée: {formatDateTime(task.createdAt)}
                    {task.actionDueAt ? ` · Échéance: ${formatDateTime(task.actionDueAt)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  {task.deepLink ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate(task.deepLink);
                      }}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900 sm:flex-none"
                    >
                      Ouvrir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => completeTaskMutation.mutate(task.id)}
                    className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-xl bg-neutral-950 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-neutral-950 sm:flex-none"
                    disabled={completeTaskMutation.isPending}
                  >
                    Marquer fait
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!listQuery.isLoading && tasks.length === 0 ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                <ShieldAlert size={20} />
              </div>
              <p className="mt-3 text-sm font-bold text-neutral-900 dark:text-white">Aucune tâche en attente</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">La file opérationnelle est à jour.</p>
            </div>
          ) : null}
        </section>

        <footer className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <p className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Clock3 size={14} />
            Le centre de commande lit les mêmes files que les compteurs du panneau admin/founder.
          </p>
        </footer>
      </div>
    </div>
  );
}
