import React, { useEffect, useMemo, useState } from 'react';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from '../modals/BaseModal';

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
    <BaseModal
      isOpen={open}
      onClose={onClose}
      size="md"
      mobileSheet={true}
    >
      <ModalHeader
        title="Réassigner les produits"
        subtitle="Déplace les produits d'une catégorie vers une autre"
        onClose={onClose}
      />
      <ModalBody>
        <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-300">
          Source: <span className="font-semibold">{source.name}</span>
        </p>
        <p className="mb-3 text-xs text-neutral-500">
          Produits impactés (estimé): <span className="font-semibold">{source.usedByProducts || 0}</span>
        </p>

        <label className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-300">Catégorie cible</label>
        <select
          data-autofocus
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="ui-input mb-3 w-full rounded-xl px-3 py-2 text-sm"
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
            className="h-4 w-4 rounded border-neutral-300 text-neutral-600"
          />
          Inclure les sous-catégories
        </label>

        <textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Raison (audit)"
          className="ui-input w-full rounded-xl px-3 py-2 text-sm"
        />
      </ModalBody>
      <ModalFooter>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!targetId || loading}
            onClick={() => onConfirm({ sourceId: source.id, targetId, includeChildren, reason })}
            className="rounded-xl bg-neutral-600 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-500 disabled:opacity-50"
          >
            Confirmer la réassignation
          </button>
        </div>
      </ModalFooter>
    </BaseModal>
  );
}
