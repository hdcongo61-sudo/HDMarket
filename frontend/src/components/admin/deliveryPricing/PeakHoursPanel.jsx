import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ClockIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' }
];

const emptyForm = {
  name: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '07:00',
  endTime: '09:00',
  surchargeType: 'PERCENT',
  surchargeValue: 10
};

export default function PeakHoursPanel() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/peak-hours');
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les heures de pointe.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/peak-hours', form);
      setItems((prev) => [...prev, data]);
      setForm(emptyForm);
      showToast('Règle ajoutée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter cette règle.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/peak-hours/${id}`);
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
        <ClockIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Heures de pointe</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Morning Rush, Evening Rush... chacune avec sa majoration. N’a d’effet que si « Activer la tarification dynamique » est activé (Paramètres généraux).
      </p>

      <form onSubmit={handleCreate} className="mb-4 space-y-2 rounded-xl border border-dashed border-gray-200 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nom (ex: Morning Rush)"
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-2"
          />
          <input
            type="time"
            value={form.startTime}
            onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
          <input
            type="time"
            value={form.endTime}
            onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`min-h-9 rounded-lg border px-2.5 text-xs font-bold ${
                form.daysOfWeek.includes(day.value)
                  ? 'border-[#e85d00] bg-[#e85d00] text-white'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            value={form.surchargeType}
            onChange={(event) => setForm((prev) => ({ ...prev, surchargeType: event.target.value }))}
            className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
          >
            <option value="PERCENT">Pourcentage</option>
            <option value="FIXED">Montant fixe</option>
          </select>
          <input
            type="number"
            min="0"
            value={form.surchargeValue}
            onChange={(event) => setForm((prev) => ({ ...prev, surchargeValue: event.target.value }))}
            placeholder={form.surchargeType === 'PERCENT' ? '% majoration' : 'FCFA'}
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50 sm:col-span-2"
          >
            {creating ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <PlusIcon className="h-4 w-4" />}
            Ajouter
          </button>
        </div>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !items.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucune règle configurée.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.daysOfWeek.map((d) => DAYS.find((day) => day.value === d)?.label).join(', ')}
                  {item.startTime ? ` · ${item.startTime}-${item.endTime}` : ''}
                  {' · '}
                  {item.surchargeType === 'PERCENT' ? `+${item.surchargeValue}%` : `+${item.surchargeValue} FCFA`}
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
