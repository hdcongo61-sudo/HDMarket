import React from 'react';
import { Download, FileDown, Upload, EyeOff, Eye, Trash2, RotateCcw } from 'lucide-react';

export default function BulkActionsToolbar({
  selectedCount,
  onBulkAction,
  onExport,
  onOpenImport,
  loading
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">Outils bulk</p>
          <p className="text-xs text-neutral-500">{selectedCount} élément(s) sélectionné(s)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onBulkAction('activate')}
            disabled={loading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <Eye size={14} /> Activer
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('deactivate')}
            disabled={loading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <EyeOff size={14} /> Désactiver
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('softDelete')}
            disabled={loading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 size={14} /> Supprimer
          </button>
          <button
            type="button"
            onClick={() => onBulkAction('restore')}
            disabled={loading || selectedCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            <RotateCcw size={14} /> Restaurer
          </button>
          <button
            type="button"
            onClick={() => onExport('json')}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            type="button"
            onClick={() => onExport('csv')}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <FileDown size={14} /> Export CSV
          </button>
          <button
            type="button"
            onClick={onOpenImport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            <Upload size={14} /> Import
          </button>
        </div>
      </div>
    </section>
  );
}
