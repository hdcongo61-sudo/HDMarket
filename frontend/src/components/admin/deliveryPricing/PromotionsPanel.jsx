import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Tag, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const emptyForm = { code: '', discountType: 'PERCENT', discountValue: 10, zoneRestrictionId: '', maxUses: '', expiresAt: '' };

export default function PromotionsPanel() {
  const { showToast } = useToast();
  const [promotions, setPromotions] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promotionsRes, zonesRes] = await Promise.all([
        api.get('/delivery-pricing/admin/promotions'),
        api.get('/delivery-pricing/admin/zones')
      ]);
      setPromotions(Array.isArray(promotionsRes.data) ? promotionsRes.data : []);
      setZones(Array.isArray(zonesRes.data) ? zonesRes.data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les promotions.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.code.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await api.post('/delivery-pricing/admin/promotions', {
        ...form,
        zoneRestrictionId: form.zoneRestrictionId || null,
        maxUses: form.maxUses || null,
        expiresAt: form.expiresAt || null
      });
      setPromotions((prev) => [data, ...prev]);
      setForm(emptyForm);
      showToast('Promotion créée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de créer cette promotion.', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/delivery-pricing/admin/promotions/${id}`);
      setPromotions((prev) => prev.filter((item) => item._id !== id));
      showToast('Promotion supprimée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette promotion.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  const describeDiscount = (promotion) => {
    if (promotion.discountType === 'FREE_DELIVERY') return 'Livraison gratuite';
    if (promotion.discountType === 'FIXED') return `-${promotion.discountValue} FCFA`;
    return `-${promotion.discountValue}%`;
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <Tag className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Codes promo colis</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">Indépendants des codes promo de commandes produits.</p>

      <form onSubmit={handleCreate} className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-3">
        <input
          value={form.code}
          onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
          placeholder="Code (ex: COLIS10)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <select
          value={form.discountType}
          onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value }))}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
        >
          <option value="PERCENT">Pourcentage</option>
          <option value="FIXED">Montant fixe</option>
          <option value="FREE_DELIVERY">Livraison gratuite</option>
        </select>
        {form.discountType !== 'FREE_DELIVERY' ? (
          <input
            type="number"
            min="0"
            value={form.discountValue}
            onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))}
            placeholder={form.discountType === 'PERCENT' ? '% remise' : 'FCFA'}
            className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
          />
        ) : <div />}
        <select
          value={form.zoneRestrictionId}
          onChange={(event) => setForm((prev) => ({ ...prev, zoneRestrictionId: event.target.value }))}
          className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
        >
          <option value="">Toutes zones</option>
          {zones.map((zone) => (
            <option key={zone._id} value={zone._id}>{zone.name} uniquement</option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          value={form.maxUses}
          onChange={(event) => setForm((prev) => ({ ...prev, maxUses: event.target.value }))}
          placeholder="Utilisations max (optionnel)"
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <input
          type="date"
          value={form.expiresAt}
          onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
          className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50 sm:col-span-3"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Créer la promotion
        </button>
      </form>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      ) : !promotions.length ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucune promotion configurée.</p>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {promotions.map((promotion) => (
            <div key={promotion._id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-black text-slate-950">{promotion.code}</p>
                <p className="text-xs text-gray-500">
                  {describeDiscount(promotion)} · {promotion.usedCount || 0}{promotion.maxUses ? `/${promotion.maxUses}` : ''} utilisé(s)
                  {promotion.expiresAt ? ` · expire ${new Date(promotion.expiresAt).toLocaleDateString('fr-FR')}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(promotion._id)}
                disabled={deletingId === promotion._id}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
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
