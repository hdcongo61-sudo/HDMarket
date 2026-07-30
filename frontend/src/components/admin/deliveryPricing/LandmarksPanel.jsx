import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crosshair, Landmark as LandmarkIcon, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
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
  const [locating, setLocating] = useState(false);

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

  const useCurrentPosition = () => {
    if (!navigator.geolocation || locating) {
      showToast('La géolocalisation n’est pas disponible sur cet appareil.', { variant: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((previous) => ({
          ...previous,
          latitude: Number(coords.latitude).toFixed(6),
          longitude: Number(coords.longitude).toFixed(6)
        }));
        setLocating(false);
        showToast('Coordonnées GPS ajoutées.', { variant: 'success' });
      },
      () => {
        setLocating(false);
        showToast('Impossible d’obtenir votre position. Vérifiez l’autorisation GPS.', {
          variant: 'error'
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
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

      <form onSubmit={handleCreate} className="mb-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[#e85d00]" />
          <h3 className="text-sm font-black text-slate-950">Nouveau point de repère</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-gray-700 sm:col-span-2">
            Nom du lieu *
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Ex. Marché Total, CHU de Brazzaville"
              className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              required
            />
          </label>
          <label className="text-xs font-bold text-gray-700">
            Ville *
            <select
              value={form.cityId}
              onChange={(event) => setForm((prev) => ({ ...prev, cityId: event.target.value, communeId: '' }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              required
            >
              <option value="">Sélectionner une ville</option>
              {cities.map((city) => (
                <option key={city._id} value={city._id}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-gray-700">
            Commune
            <select
              value={form.communeId}
              onChange={(event) => setForm((prev) => ({ ...prev, communeId: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:bg-gray-100"
              disabled={!form.cityId}
            >
              <option value="">Commune (optionnelle)</option>
              {communesForCity.map((commune) => (
                <option key={commune._id} value={commune._id}>{commune.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:col-span-2">
            <label className="text-xs font-bold text-gray-700">
              Latitude *
              <input
                type="number"
                min="-90"
                max="90"
                step="0.000001"
                value={form.latitude}
                onChange={(event) => setForm((prev) => ({ ...prev, latitude: event.target.value }))}
                placeholder="-4.2634"
                className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                required
              />
            </label>
            <label className="text-xs font-bold text-gray-700">
              Longitude *
              <input
                type="number"
                min="-180"
                max="180"
                step="0.000001"
                value={form.longitude}
                onChange={(event) => setForm((prev) => ({ ...prev, longitude: event.target.value }))}
                placeholder="15.2429"
                className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                required
              />
            </label>
          </div>
          <button
            type="button"
            onClick={useCurrentPosition}
            disabled={locating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-3 text-xs font-black text-[#e85d00] disabled:opacity-50 sm:col-span-2"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            {locating ? 'Localisation…' : 'Utiliser ma position actuelle'}
          </button>
          <label className="text-xs font-bold text-gray-700 sm:col-span-2">
            Autres noms utilisés
            <input
              value={form.aliases}
              onChange={(event) => setForm((prev) => ({ ...prev, aliases: event.target.value }))}
              placeholder="Ex. Total, Station Total (séparés par une virgule)"
              className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-gray-700 sm:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Indications utiles pour reconnaître le lieu"
              rows={2}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !form.name.trim() || !form.cityId || form.latitude === '' || form.longitude === ''}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#231f1b] px-4 text-sm font-black text-white disabled:opacity-50 sm:col-span-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {creating ? 'Ajout en cours…' : 'Ajouter le point de repère'}
          </button>
        </div>
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
