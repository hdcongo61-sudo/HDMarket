import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  HelpCircle,
  Landmark as LandmarkIcon,
  Loader2,
  MapPinned,
  Package,
  Package2,
  Plus,
  RefreshCw,
  Scale,
  Settings2,
  Tag,
  Trash2,
  Truck,
  Zap,
  Server
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { AdminSegmentedControl } from '../components/admin/AdminCommandSurface';
import HelpGuidePanel from '../components/admin/deliveryPricing/HelpGuidePanel';
import GeneralSettingsPanel from '../components/admin/deliveryPricing/GeneralSettingsPanel';
import ZonesPanel from '../components/admin/deliveryPricing/ZonesPanel';
import ZonePriceMatrixPanel from '../components/admin/deliveryPricing/ZonePriceMatrixPanel';
import LandmarksPanel from '../components/admin/deliveryPricing/LandmarksPanel';
import PackageTypesPanel from '../components/admin/deliveryPricing/PackageTypesPanel';
import WeightRulesPanel from '../components/admin/deliveryPricing/WeightRulesPanel';
import SpeedRulesPanel from '../components/admin/deliveryPricing/SpeedRulesPanel';
import PeakHoursPanel from '../components/admin/deliveryPricing/PeakHoursPanel';
import PromotionsPanel from '../components/admin/deliveryPricing/PromotionsPanel';
import DeliverySystemPanel from '../components/admin/deliveryPricing/DeliverySystemPanel';

const TABS = [
  { value: 'guide', label: 'Guide', icon: HelpCircle },
  { value: 'system', label: 'Système', icon: Server },
  { value: 'general', label: 'Général', icon: Settings2 },
  { value: 'communes', label: 'Villes & communes', icon: Truck },
  { value: 'zones', label: 'Zones', icon: MapPinned },
  { value: 'zone-matrix', label: 'Matrice de prix', icon: MapPinned },
  { value: 'landmarks', label: 'Points de repère', icon: LandmarkIcon },
  { value: 'package-types', label: 'Types de colis', icon: Package2 },
  { value: 'weight-rules', label: 'Poids', icon: Scale },
  { value: 'speed-rules', label: 'Vitesse', icon: Zap },
  { value: 'peak-hours', label: 'Heures de pointe', icon: Clock3 },
  { value: 'promotions', label: 'Promotions', icon: Tag }
];

const PARCEL_PRICE_FIELDS = [
  { key: 'parcel_delivery_base_price', label: 'Prix de base', hint: 'Quand la distance GPS retrait → dépôt est connue.' },
  { key: 'parcel_delivery_price_per_km', label: 'Prix par km', hint: 'Ajouté au prix de base, par kilomètre.' },
  { key: 'parcel_delivery_min_price', label: 'Prix minimum', hint: 'Plancher appliqué quelle que soit la distance.' },
  { key: 'parcel_delivery_same_commune_price', label: 'Forfait — même commune', hint: 'Utilisé si la distance GPS est inconnue.' },
  { key: 'parcel_delivery_cross_commune_price', label: 'Forfait — communes différentes', hint: 'Utilisé si la distance GPS est inconnue.' },
  { key: 'parcel_delivery_max_distance_km', label: 'Distance max (km)', hint: 'Course refusée au-delà de cette distance.' }
];

const POLICY_OPTIONS = [
  { value: 'DEFAULT_RULE', label: 'Frais du produit', hint: 'Le vendeur/produit fixe le frais de livraison.' },
  { value: 'FIXED_FEE', label: 'Forfait commune', hint: 'Un montant fixe remplace le frais du produit.' },
  { value: 'FREE', label: 'Livraison gratuite', hint: 'Aucun frais, quel que soit le produit.' }
];

const emptyCommuneForm = {
  name: '',
  cityId: '',
  deliveryPolicy: 'DEFAULT_RULE',
  fixedFee: 0,
  latitude: '',
  longitude: '',
  zoneId: ''
};

export default function AdminDeliveryPricing() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('guide');
  const [loading, setLoading] = useState(true);
  const [parcelPrices, setParcelPrices] = useState({});
  const [savingParcelPrices, setSavingParcelPrices] = useState(false);
  const [cities, setCities] = useState([]);
  const [communes, setCommunes] = useState([]);
  const [zones, setZones] = useState([]);
  const [communeForm, setCommuneForm] = useState(emptyCommuneForm);
  const [creatingCommune, setCreatingCommune] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingDraft, setEditingDraft] = useState(emptyCommuneForm);
  const [savingEditId, setSavingEditId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, communesRes, citiesRes, zonesRes] = await Promise.all([
        api.get('/admin/config/runtime', { params: { category: 'delivery_platform' } }),
        api.get('/admin/communes'),
        api.get('/admin/cities'),
        api.get('/delivery-pricing/admin/zones')
      ]);
      const parcelKeys = new Set(PARCEL_PRICE_FIELDS.map((field) => field.key));
      const nextPrices = {};
      (settingsRes.data?.items || []).forEach((item) => {
        if (parcelKeys.has(item.key)) nextPrices[item.key] = Number(item.value || 0);
      });
      setParcelPrices(nextPrices);
      setCommunes(Array.isArray(communesRes.data) ? communesRes.data : []);
      setCities(Array.isArray(citiesRes.data) ? citiesRes.data : []);
      setZones(Array.isArray(zonesRes.data) ? zonesRes.data : []);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les tarifs de livraison.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const communesByCity = useMemo(() => {
    const groups = new Map();
    communes.forEach((commune) => {
      const cityId = String(commune.cityId || '');
      if (!groups.has(cityId)) groups.set(cityId, []);
      groups.get(cityId).push(commune);
    });
    return groups;
  }, [communes]);

  const handleSaveParcelPrices = async () => {
    setSavingParcelPrices(true);
    try {
      await Promise.all(
        PARCEL_PRICE_FIELDS.map((field) =>
          api.patch(`/admin/config/runtime/${field.key}`, { value: Math.max(0, Number(parcelPrices[field.key] || 0)) })
        )
      );
      showToast('Tarifs colis enregistrés.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’enregistrer les tarifs colis.', { variant: 'error' });
    } finally {
      setSavingParcelPrices(false);
    }
  };

  const handleCreateCommune = async (event) => {
    event.preventDefault();
    if (!communeForm.name.trim() || !communeForm.cityId || creatingCommune) return;
    setCreatingCommune(true);
    try {
      const { data } = await api.post('/admin/communes', {
        ...communeForm,
        name: communeForm.name.trim(),
        fixedFee: communeForm.deliveryPolicy === 'FIXED_FEE' ? Math.max(0, Number(communeForm.fixedFee || 0)) : 0
      });
      setCommunes((prev) => [...prev, data].sort((a, b) => String(a.name).localeCompare(String(b.name))));
      setCommuneForm(emptyCommuneForm);
      showToast('Commune ajoutée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’ajouter cette commune.', { variant: 'error' });
    } finally {
      setCreatingCommune(false);
    }
  };

  const startEdit = (commune) => {
    setEditingId(commune._id);
    setEditingDraft({
      name: commune.name,
      cityId: String(commune.cityId || ''),
      deliveryPolicy: commune.deliveryPolicy || 'DEFAULT_RULE',
      fixedFee: Number(commune.fixedFee || 0),
      latitude: commune.latitude ?? '',
      longitude: commune.longitude ?? '',
      zoneId: String(commune.zoneId || '')
    });
  };

  const handleSaveEdit = async (id) => {
    setSavingEditId(id);
    try {
      const { data } = await api.patch(`/admin/communes/${id}`, {
        ...editingDraft,
        name: editingDraft.name.trim(),
        fixedFee: editingDraft.deliveryPolicy === 'FIXED_FEE' ? Math.max(0, Number(editingDraft.fixedFee || 0)) : 0
      });
      setCommunes((prev) => prev.map((commune) => (commune._id === id ? data : commune)));
      setEditingId('');
      showToast('Commune mise à jour.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de mettre à jour cette commune.', { variant: 'error' });
    } finally {
      setSavingEditId('');
    }
  };

  const handleDeleteCommune = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/admin/communes/${id}`);
      setCommunes((prev) => prev.filter((commune) => commune._id !== id));
      showToast('Commune supprimée.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de supprimer cette commune.', { variant: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              Administration
            </Link>
            <h1 className="text-2xl font-black text-slate-950">Prix de livraison</h1>
            <p className="mt-1 text-sm text-gray-500">Moteur de tarification des courses colis et frais de livraison par commune.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setActiveTab('landmarks')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white"
            >
              <LandmarkIcon className="h-4 w-4" />
              Ajouter un repère
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </header>

        <AdminSegmentedControl options={TABS} value={activeTab} onChange={setActiveTab} />

        {activeTab === 'guide' && <HelpGuidePanel />}
        {activeTab === 'system' && <DeliverySystemPanel />}
        {activeTab === 'zones' && <ZonesPanel />}
        {activeTab === 'zone-matrix' && <ZonePriceMatrixPanel />}
        {activeTab === 'landmarks' && <LandmarksPanel />}
        {activeTab === 'package-types' && <PackageTypesPanel />}
        {activeTab === 'weight-rules' && <WeightRulesPanel />}
        {activeTab === 'speed-rules' && <SpeedRulesPanel />}
        {activeTab === 'peak-hours' && <PeakHoursPanel />}
        {activeTab === 'promotions' && <PromotionsPanel />}

        {activeTab === 'general' && loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Chargement…</p>
        ) : activeTab === 'general' ? (
          <>
            <section className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <Package className="h-5 w-5 text-[#e85d00]" />
                <h2 className="text-base font-black text-slate-950">Tarifs colis (course à la demande)</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PARCEL_PRICE_FIELDS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-xs font-black text-gray-700">{field.label}</span>
                    <input
                      type="number"
                      min="0"
                      value={parcelPrices[field.key] ?? 0}
                      onChange={(event) =>
                        setParcelPrices((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold"
                    />
                    <span className="mt-1 block text-[11px] text-gray-400">{field.hint}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveParcelPrices}
                disabled={savingParcelPrices}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
              >
                {savingParcelPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {savingParcelPrices ? 'Enregistrement…' : 'Enregistrer les tarifs colis'}
              </button>
            </section>

            <GeneralSettingsPanel />
          </>
        ) : null}

        {activeTab === 'communes' && (loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Chargement…</p>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <Truck className="h-5 w-5 text-[#e85d00]" />
                <h2 className="text-base font-black text-slate-950">Villes & communes (centres GPS + zones)</h2>
              </div>
              <p className="mb-4 text-xs text-gray-500">
                Par défaut, le frais de livraison d’une commande vient du produit. Une commune peut le remplacer par un
                forfait fixe ou la livraison gratuite.
              </p>

              <form onSubmit={handleCreateCommune} className="mb-5 grid grid-cols-1 gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-5">
                <input
                  value={communeForm.name}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Nom de la commune"
                  className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm sm:col-span-2"
                />
                <select
                  value={communeForm.cityId}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, cityId: event.target.value }))}
                  className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Ville</option>
                  {cities.map((city) => (
                    <option key={city._id} value={city._id}>{city.name}</option>
                  ))}
                </select>
                <select
                  value={communeForm.deliveryPolicy}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, deliveryPolicy: event.target.value }))}
                  className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
                >
                  {POLICY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {communeForm.deliveryPolicy === 'FIXED_FEE' ? (
                  <input
                    type="number"
                    min="0"
                    value={communeForm.fixedFee}
                    onChange={(event) => setCommuneForm((prev) => ({ ...prev, fixedFee: event.target.value }))}
                    placeholder="Forfait (FCFA)"
                    className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                  />
                ) : null}
                <input
                  type="number"
                  step="0.000001"
                  value={communeForm.latitude}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, latitude: event.target.value }))}
                  placeholder="Latitude (centre commune)"
                  className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                />
                <input
                  type="number"
                  step="0.000001"
                  value={communeForm.longitude}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, longitude: event.target.value }))}
                  placeholder="Longitude (centre commune)"
                  className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                />
                <select
                  value={communeForm.zoneId}
                  onChange={(event) => setCommuneForm((prev) => ({ ...prev, zoneId: event.target.value }))}
                  className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
                >
                  <option value="">Zone (optionnel)</option>
                  {zones.map((zone) => (
                    <option key={zone._id} value={zone._id}>{zone.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={creatingCommune}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#231f1b] text-xs font-black text-white disabled:opacity-50 sm:col-span-5"
                >
                  <Plus className="h-4 w-4" /> Ajouter la commune
                </button>
              </form>

              {communes.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Aucune commune configurée.</p>
              ) : (
                <div className="space-y-4">
                  {cities.map((city) => {
                    const cityCommunes = communesByCity.get(String(city._id)) || [];
                    if (!cityCommunes.length) return null;
                    return (
                      <div key={city._id}>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">{city.name}</p>
                        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                          {cityCommunes.map((commune) => {
                            const isEditing = editingId === commune._id;
                            return (
                              <div key={commune._id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                {isEditing ? (
                                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                                    <input
                                      value={editingDraft.name}
                                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, name: event.target.value }))}
                                      className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                                    />
                                    <select
                                      value={editingDraft.deliveryPolicy}
                                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, deliveryPolicy: event.target.value }))}
                                      className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
                                    >
                                      {POLICY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                      ))}
                                    </select>
                                    {editingDraft.deliveryPolicy === 'FIXED_FEE' ? (
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingDraft.fixedFee}
                                        onChange={(event) => setEditingDraft((prev) => ({ ...prev, fixedFee: event.target.value }))}
                                        className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                                      />
                                    ) : <span />}
                                    <input
                                      type="number"
                                      step="0.000001"
                                      value={editingDraft.latitude}
                                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, latitude: event.target.value }))}
                                      placeholder="Latitude"
                                      className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                                    />
                                    <input
                                      type="number"
                                      step="0.000001"
                                      value={editingDraft.longitude}
                                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, longitude: event.target.value }))}
                                      placeholder="Longitude"
                                      className="min-h-10 rounded-lg border border-gray-200 px-2.5 text-sm"
                                    />
                                    <select
                                      value={editingDraft.zoneId}
                                      onChange={(event) => setEditingDraft((prev) => ({ ...prev, zoneId: event.target.value }))}
                                      className="min-h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-sm"
                                    >
                                      <option value="">Zone (optionnel)</option>
                                      {zones.map((zone) => (
                                        <option key={zone._id} value={zone._id}>{zone.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-sm font-bold text-slate-950">{commune.name}</p>
                                    <p className="text-xs text-gray-500">
                                      {POLICY_OPTIONS.find((option) => option.value === commune.deliveryPolicy)?.label || commune.deliveryPolicy}
                                      {commune.deliveryPolicy === 'FIXED_FEE' ? ` — ${formatCurrency(commune.fixedFee)}` : ''}
                                      {Number.isFinite(commune.latitude) ? ' · GPS ✓' : ''}
                                      {commune.zoneId ? ` · ${zones.find((zone) => zone._id === String(commune.zoneId))?.name || 'Zone'}` : ''}
                                    </p>
                                  </div>
                                )}
                                <div className="flex shrink-0 gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEdit(commune._id)}
                                        disabled={savingEditId === commune._id}
                                        className="min-h-9 rounded-lg bg-[#e85d00] px-3 text-xs font-black text-white disabled:opacity-50"
                                      >
                                        {savingEditId === commune._id ? 'Enregistrement…' : 'Enregistrer'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingId('')}
                                        className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600"
                                      >
                                        Annuler
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEdit(commune)}
                                        className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700"
                                      >
                                        Modifier
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCommune(commune._id)}
                                        disabled={deletingId === commune._id}
                                        className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 disabled:opacity-50"
                                        aria-label="Supprimer"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ))}
      </div>
    </main>
  );
}
