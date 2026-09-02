import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, BoltIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../../utils/priceFormatter';

const emptyForm = { key: '', label: '', extraPrice: 0, etaMinutes: 60 };

export default function SpeedRulesPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/speed-rules');
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les vitesses de livraison.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.key.trim() || !form.label.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/speed-rules', form);
      setItems((prev) => [...prev, data]);
      setForm(emptyForm);
      showToast('Vitesse de livraison ajoutée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter cette vitesse.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/speed-rules/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      showToast('Vitesse supprimée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette vitesse.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <BoltIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Vitesse de livraison</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">Standard, Express, Immédiate — chacune avec un supplément et un délai indicatif.</p>

      <form onSubmit={handleCreate} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-5">
        <input
          value={form.key}
          onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value.toUpperCase() }))}
          placeholder="Clé (ex: EXPRESS)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          value={form.label}
          onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          placeholder="Libellé (ex: Express)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="number"
          min="0"
          value={form.extraPrice}
          onChange={(event) => setForm((prev) => ({ ...prev, extraPrice: event.target.value }))}
          placeholder="Supplément (FCFA)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="number"
          min="0"
          value={form.etaMinutes}
          onChange={(event) => setForm((prev) => ({ ...prev, etaMinutes: event.target.value }))}
          placeholder="Délai (min)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
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
        <p className="py-6 text-center text-sm text-gray-400">Aucune règle de vitesse configurée.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{item.label} <span className="text-xs font-normal text-gray-400">({item.key})</span></p>
                <p className="text-xs text-gray-500">+{formatCurrency(item.extraPrice)} · ~{item.etaMinutes} min</p>
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
