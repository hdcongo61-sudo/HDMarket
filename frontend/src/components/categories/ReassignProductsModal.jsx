import React, { useEffect, useMemo, useState } from 'react';

export default function ReassignProductsModal({
  open,
  source,
  nodes,
  loading,
  onClose,
  onConfirm
}) {
  const [targetId, setTargetId] = useState('');
  const [includeChildren, setIncludeChildren] = useState(true);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setTargetId('');
    setIncludeChildren(true);
    setReason('');
  }, [open, source?.id]);

  const options = useMemo(
    () =>
      nodes
        .filter((node) => node.id !== source?.id && !node.isDeleted)
        .map((node) => ({
          value: node.id,
          label: `${node.level === 1 ? '└ ' : ''}${node.name}`
        })),
    [nodes, source]
  );

  if (!open || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Réassigner les produits</h3>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Fermer
          </button>
        </div>

        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-300">
          Source: <span className="font-semibold">{source.name}</span>
        </p>
        <p className="mb-3 text-xs text-neutral-500">
          Produits impactés (estimé): <span className="font-semibold">{source.usedByProducts || 0}</span>
        </p>

        <label className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Catégorie cible</label>
        <select
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="mb-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        >
          <option value="">Sélectionner</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="mb-3 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={includeChildren}
            onChange={(event) => setIncludeChildren(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-indigo-600"
          />
          Inclure les sous-catégories
        </label>

        <textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Raison (audit)"
          className="mb-3 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />

        <button
          type="button"
          disabled={!targetId || loading}
          onClick={() => onConfirm({ sourceId: source.id, targetId, includeChildren, reason })}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          Confirmer la réassignation
        </button>
      </div>
    </div>
  );
}
