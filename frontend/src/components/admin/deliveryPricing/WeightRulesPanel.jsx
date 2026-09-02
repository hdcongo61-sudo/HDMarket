import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, PlusIcon, ScaleIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../../utils/priceFormatter';

const emptyForm = { minKg: 0, maxKg: 1, mode: 'FIXED_EXTRA', multiplier: 1, fixedExtra: 0 };

export default function WeightRulesPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/weight-rules');
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les règles de poids.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/weight-rules', form);
      setItems((prev) => [...prev, data].sort((a, b) => a.minKg - b.minKg));
      setForm(emptyForm);
      showToast('Règle de poids ajoutée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter cette règle.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/weight-rules/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      showToast('Règle supprimée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette règle.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <ScaleIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Tranches de poids</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">0-1kg, 1-3kg... chacune avec un multiplicateur ou un supplément fixe.</p>

      <form onSubmit={handleCreate} className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-6">
        <input
          type="number"
          min="0"
          value={form.minKg}
          onChange={(event) => setForm((prev) => ({ ...prev, minKg: event.target.value }))}
          placeholder="Min (kg)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="number"
          min="0"
          value={form.maxKg}
          onChange={(event) => setForm((prev) => ({ ...prev, maxKg: event.target.value }))}
          placeholder="Max (kg)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <select
          value={form.mode}
          onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value }))}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm sm:col-span-2"
        >
          <option value="FIXED_EXTRA">Supplément fixe</option>
          <option value="MULTIPLIER">Multiplicateur</option>
        </select>
        {form.mode === 'MULTIPLIER' ? (
          <input
            type="number"
            min="0"
            step="0.1"
            value={form.multiplier}
            onChange={(event) => setForm((prev) => ({ ...prev, multiplier: event.target.value }))}
            placeholder="x1.5"
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
        ) : (
          <input
            type="number"
            min="0"
            value={form.fixedExtra}
            onChange={(event) => setForm((prev) => ({ ...prev, fixedExtra: event.target.value }))}
            placeholder="Supplément (FCFA)"
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
        )}
        <button
          type="submit"
          disabled={creating}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50"
        >
          {creating ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !items.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucune règle de poids configurée.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{item.minKg} - {item.maxKg} kg</p>
                <p className="text-xs text-gray-500">
                  {item.mode === 'MULTIPLIER' ? `x${item.multiplier}` : `+${formatCurrency(item.fixedExtra)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item._id)}
                disabled={deletingId === item._id}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
                aria-label="Supprimer"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
