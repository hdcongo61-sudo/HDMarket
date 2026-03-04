import React, { useContext, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock3, Filter, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const VALIDATION_TYPE_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'boostApproval', label: 'Boost' },
  { value: 'productValidation', label: 'Produits/Paiements' },
  { value: 'deliveryOps', label: 'Livraison' },
  { value: 'disputes', label: 'Litiges' },
  { value: 'shopConversion', label: 'Conversion boutique' }
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

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Pending Actions</h1>
              <p className="mt-1 text-xs text-gray-500">
                {summaryQuery.data
                  ? `${Number(summaryQuery.data.pendingTotal || 0)} tâches en attente`
                  : 'Chargement des compteurs...'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                summaryQuery.refetch();
                listQuery.refetch();
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-black"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select
              value={validationType}
              onChange={(event) => setValidationType(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {VALIDATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3">
          {listQuery.isLoading ? (
            <div className="rounded-2xl bg-white p-4 text-sm text-gray-600 shadow-sm ring-1 ring-gray-200">
              Chargement des tâches...
            </div>
          ) : null}

          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {task.title || 'Action de validation requise'}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{task.message || 'Aucune description.'}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Type: {task.validationType || 'other'} · Priorité: {task.priority || 'NORMAL'}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Créée: {formatDateTime(task.createdAt)}
                    {task.actionDueAt ? ` · Due: ${formatDateTime(task.actionDueAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {task.deepLink ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate(task.deepLink);
                      }}
                      className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Ouvrir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => completeTaskMutation.mutate(task.id)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-60"
                    disabled={completeTaskMutation.isPending}
                  >
                    Marquer fait
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!listQuery.isLoading && tasks.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                <ShieldAlert size={20} />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-800">Aucune tâche en attente</p>
              <p className="mt-1 text-xs text-gray-500">La file opérationnelle est à jour.</p>
            </div>
          ) : null}
        </section>

        <footer className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-200">
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Clock3 size={14} />
            Les compteurs et la liste se synchronisent automatiquement avec la file de validation.
          </p>
        </footer>
      </div>
    </div>
  );
}
