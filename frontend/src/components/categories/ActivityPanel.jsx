import React from 'react';

const actionOptions = ['', 'CREATE', 'UPDATE', 'REORDER', 'SOFT_DELETE', 'RESTORE', 'IMPORT', 'REASSIGN'];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR');
};

export default function ActivityPanel({
  activity,
  filters,
  loading,
  onChangeFilters,
  onRefresh
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Activity</h2>
          <p className="text-xs text-neutral-500">Historique des changements catégories</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Rafraîchir
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <select
          value={filters.action}
          onChange={(event) => onChangeFilters({ ...filters, action: event.target.value })}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        >
          {actionOptions.map((action) => (
            <option key={action || 'all'} value={action}>
              {action || 'Toutes actions'}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => onChangeFilters({ ...filters, from: event.target.value })}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(event) => onChangeFilters({ ...filters, to: event.target.value })}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-950"
        />
        <span className="inline-flex items-center rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300">
          {activity.pagination?.total || 0} logs
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Chargement...</p>
        ) : (
          <table className="min-w-full text-left text-xs">
            <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Admin</th>
                <th className="px-3 py-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {(activity.items || []).map((item) => (
                <tr key={item._id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{formatDateTime(item.createdAt)}</td>
                  <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">{item.action}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{item.actorId?.name || item.actorId?.email || '—'}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-300">{item.meta?.reason || item.meta?.ip || '—'}</td>
                </tr>
              ))}
              {!activity.items?.length ? (
                <tr>
                  <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                    Aucun log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
