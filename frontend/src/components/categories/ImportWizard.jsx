import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, UploadCloud } from 'lucide-react';

export default function ImportWizard({
  open,
  loading,
  onClose,
  onDryRun,
  onApply,
  result,
  initialJson = ''
}) {
  const [jsonInput, setJsonInput] = useState('');
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    if (!open) return;
    setJsonInput(initialJson || '');
    setParseError('');
  }, [open, initialJson]);

  if (!open) return null;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonInput(text);
  };

  const parsePayload = () => {
    if (!jsonInput.trim()) {
      setParseError('Aucun JSON fourni.');
      return null;
    }
    try {
      const payload = JSON.parse(jsonInput);
      setParseError('');
      return payload;
    } catch (error) {
      setParseError('JSON invalide.');
      return null;
    }
  };

  const summary = result?.summary || null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-3xl rounded-3xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Import catégories</h3>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
            Fermer
          </button>
        </div>

        <p className="mb-2 text-xs text-neutral-500">Collez un arbre JSON ({`{ tree: [...] }`} ou tableau direct) puis lancez un dry-run.</p>

        <div className="mb-3 flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800">
            <UploadCloud size={14} /> Charger un fichier
            <input type="file" accept="application/json" className="hidden" onChange={handleFile} />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              const payload = parsePayload();
              if (!payload) return;
              onDryRun(payload);
            }}
            className="rounded-xl border border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Dry run
          </button>
          <button
            type="button"
            disabled={loading || !summary}
            onClick={() => {
              const payload = parsePayload();
              if (!payload) return;
              onApply(payload);
            }}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Appliquer
          </button>
        </div>

        <textarea
          rows={10}
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
          placeholder='{"tree":[{"name":"Electronique","children":[{"name":"Téléphones"}]}]}'
          className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-mono text-neutral-800 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
        {parseError ? <p className="mt-2 text-xs text-rose-600">{parseError}</p> : null}

        {summary ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 p-2 text-center dark:border-neutral-800">
              <p className="text-xs text-neutral-500">Ajoutées</p>
              <p className="text-sm font-semibold text-emerald-600">{summary.added}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-2 text-center dark:border-neutral-800">
              <p className="text-xs text-neutral-500">Mises à jour</p>
              <p className="text-sm font-semibold text-indigo-600">{summary.updated}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-2 text-center dark:border-neutral-800">
              <p className="text-xs text-neutral-500">Ignorées</p>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{summary.skipped}</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-2 text-center dark:border-neutral-800">
              <p className="text-xs text-neutral-500">Conflits</p>
              <p className="text-sm font-semibold text-rose-600">{summary.conflicts}</p>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
            {summary.conflicts > 0 ? <AlertTriangle size={14} className="mt-0.5 text-rose-500" /> : <CheckCircle2 size={14} className="mt-0.5 text-emerald-500" />}
            <p>
              {summary.conflicts > 0
                ? 'Des conflits existent. Vérifiez le diff avant application.'
                : 'Dry-run valide. Vous pouvez appliquer en production.'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
