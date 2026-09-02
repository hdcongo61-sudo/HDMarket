import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CubeIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../../utils/priceFormatter';

const emptyForm = { name: '', extraPrice: 0, priority: 0, specialNotes: '' };

export default function PackageTypesPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/package-types');
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les types de colis.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/package-types', form);
      setItems((prev) => [...prev, data]);
      setForm(emptyForm);
      showToast('Type de colis ajouté.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter ce type.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/package-types/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      showToast('Type de colis supprimé.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer ce type.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <CubeIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Types de colis</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">Documents, Nourriture, Médicaments... chacun avec un supplément de prix.</p>

      <form onSubmit={handleCreate} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-4">
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Nom (ex: Documents)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-2"
        />
        <input
          type="number"
          min="0"
          value={form.extraPrice}
          onChange={(event) => setForm((prev) => ({ ...prev, extraPrice: event.target.value }))}
          placeholder="Supplément (FCFA)"
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
        <input
          value={form.specialNotes}
          onChange={(event) => setForm((prev) => ({ ...prev, specialNotes: event.target.value }))}
          placeholder="Notes spéciales (optionnel)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-4"
        />
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !items.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun type de colis configuré.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{item.name}</p>
                <p className="text-xs text-gray-500">
                  +{formatCurrency(item.extraPrice)}{item.specialNotes ? ` · ${item.specialNotes}` : ''}
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
