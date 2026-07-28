import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPinned, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const emptyForm = { name: '', color: '#e85d00' };

export default function ZonesPanel() {
  const { showToast } = useToast();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/zones');
      setZones(Array.isArray(data) ? data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les zones.', { variant: 'error' });
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
      const { data } = await api.post('/delivery-pricing/admin/zones', form);
      setZones((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(emptyForm);
      showToast('Zone créée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de créer cette zone.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/zones/${id}`);
      setZones((prev) => prev.filter((zone) => zone._id !== id));
      showToast('Zone supprimée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette zone.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <MapPinned className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Zones de livraison</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Groupez les communes en zones (Zone A, Zone B...) pour configurer une matrice de prix entre zones.
      </p>

      <form onSubmit={handleCreate} className="mb-4 flex flex-wrap gap-2 rounded-xl border border-dashed border-gray-200 p-3">
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Nom (ex: Zone A)"
          className="min-h-10 flex-1 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="color"
          value={form.color}
          onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
          className="h-10 w-14 rounded-lg border border-gray-200"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] px-3 text-xs font-black text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !zones.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucune zone configurée.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {zones.map((zone) => (
            <span
              key={zone._id}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: zone.color }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.color }} />
              {zone.name}
              <button
                type="button"
                onClick={() => handleDelete(zone._id)}
                disabled={deletingId === zone._id}
                className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                aria-label={`Supprimer ${zone.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
