import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../../utils/priceFormatter';

export default function ZonePriceMatrixPanel() {
  const { showToast } = useToast();
  const [zones, setZones] = useState([]);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromZoneId, setFromZoneId] = useState('');
  const [toZoneId, setToZoneId] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [zonesRes, pricesRes] = await Promise.all([
        api.get('/delivery-pricing/admin/zones'),
        api.get('/delivery-pricing/admin/zone-prices')
      ]);
      setZones(Array.isArray(zonesRes.data) ? zonesRes.data : []);
      setPrices(Array.isArray(pricesRes.data) ? pricesRes.data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger la matrice de prix.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!fromZoneId || !toZoneId || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/zone-prices', {
        fromZoneId,
        toZoneId,
        price: Number(price)
      });
      setPrices((prev) => {
        const withoutExisting = prev.filter((entry) => entry._id !== data._id);
        return [
          ...withoutExisting,
          { ...data, fromZoneId: zones.find((z) => z._id === fromZoneId), toZoneId: zones.find((z) => z._id === toZoneId) }
        ];
      });
      setPrice('');
      showToast('Tarif enregistré.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’enregistrer ce tarif.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/zone-prices/${id}`);
      setPrices((prev) => prev.filter((entry) => entry._id !== id));
      showToast('Tarif supprimé.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer ce tarif.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  if (!loading && zones.length < 1) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <h2 className="mb-2 text-base font-black text-slate-950">Matrice de prix zone à zone</h2>
        <p className="text-sm text-gray-400">Créez d’abord des zones dans l’onglet « Zones ».</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h2 className="mb-1 text-base font-black text-slate-950">Matrice de prix zone à zone</h2>
      <p className="mb-4 text-xs text-gray-500">
        Prix de base utilisé quand « Utiliser la matrice de prix zone à zone » est activé (Paramètres généraux). Zone A → Zone B
        peut différer de Zone B → Zone A si nécessaire.
      </p>

      <form onSubmit={handleSave} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-4">
        <select
          value={fromZoneId}
          onChange={(event) => setFromZoneId(event.target.value)}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
        >
          <option value="">Zone de départ</option>
          {zones.map((zone) => (
            <option key={zone._id} value={zone._id}>{zone.name}</option>
          ))}
        </select>
        <select
          value={toZoneId}
          onChange={(event) => setToZoneId(event.target.value)}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
        >
          <option value="">Zone d’arrivée</option>
          {zones.map((zone) => (
            <option key={zone._id} value={zone._id}>{zone.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="Prix (FCFA)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50"
        >
          {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
          Enregistrer
        </button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !prices.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun tarif zone à zone configuré.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {prices.map((entry) => (
            <div key={entry._id} className="flex items-center justify-between gap-2 p-3">
              <p className="text-sm font-bold text-slate-950">
                {entry.fromZoneId?.name || '—'} → {entry.toZoneId?.name || '—'}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-[#e85d00]">{formatCurrency(entry.price)}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(entry._id)}
                  disabled={deletingId === entry._id}
                  className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
                  aria-label="Supprimer"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
