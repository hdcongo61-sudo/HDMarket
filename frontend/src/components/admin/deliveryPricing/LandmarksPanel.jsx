import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark as LandmarkIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const emptyForm = { name: '', cityId: '', communeId: '', latitude: '', longitude: '', aliases: '', description: '' };

export default function LandmarksPanel() {
  const { showToast } = useToast();
  const [landmarks, setLandmarks] = useState([]);
  const [cities, setCities] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [landmarksRes, citiesRes, communesRes] = await Promise.all([
        api.get('/delivery-pricing/admin/landmarks'),
        api.get('/admin/cities'),
        api.get('/admin/communes')
      ]);
      setLandmarks(Array.isArray(landmarksRes.data) ? landmarksRes.data : []);
      setCities(Array.isArray(citiesRes.data) ? citiesRes.data : []);
      setCommunes(Array.isArray(communesRes.data) ? communesRes.data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les points de repère.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const communesForCity = useMemo(
    () => communes.filter((commune) => String(commune.cityId) === String(form.cityId)),
    [communes, form.cityId]
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.cityId || !form.latitude || !form.longitude || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/landmarks', form);
      setLandmarks((prev) => [...prev, data]);
      setForm(emptyForm);
      showToast('Point de repère ajouté.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter ce point de repère.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/landmarks/${id}`);
      setLandmarks((prev) => prev.filter((item) => item._id !== id));
      showToast('Point de repère supprimé.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer ce point de repère.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <LandmarkIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Points de repère</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Utilisés pour deviner les coordonnées GPS depuis une adresse texte (ex: « Près de Total Station »).
      </p>

      <form onSubmit={handleCreate} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-3">
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Nom (ex: Total Station)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-3"
        />
        <select
          value={form.cityId}
          onChange={(event) => setForm((prev) => ({ ...prev, cityId: event.target.value, communeId: '' }))}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
        >
          <option value="">Ville</option>
          {cities.map((city) => (
            <option key={city._id} value={city._id}>{city.name}</option>
          ))}
        </select>
        <select
          value={form.communeId}
          onChange={(event) => setForm((prev) => ({ ...prev, communeId: event.target.value }))}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
          disabled={!form.cityId}
        >
          <option value="">Commune (optionnel)</option>
          {communesForCity.map((commune) => (
            <option key={commune._id} value={commune._id}>{commune.name}</option>
          ))}
        </select>
        <div />
        <input
          type="number"
          step="0.000001"
          value={form.latitude}
          onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
          placeholder="Latitude"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="number"
          step="0.000001"
          value={form.longitude}
          onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
          placeholder="Longitude"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          value={form.aliases}
          onChange={(event) => setForm((prev) => ({ ...prev, aliases: event.target.value }))}
          placeholder="Alias (séparés par virgule: Total, Station Total)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !landmarks.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun point de repère configuré.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {landmarks.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950">{item.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {item.cityId?.name || ''}{item.communeId?.name ? ` · ${item.communeId.name}` : ''}
                  {item.aliases?.length ? ` · ${item.aliases.join(', ')}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item._id)}
                disabled={deletingId === item._id}
                className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
