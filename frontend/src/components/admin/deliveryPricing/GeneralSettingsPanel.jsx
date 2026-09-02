import React, { useCallback, useEffect, useState } from 'react';
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';

const COMMISSION_FIELDS = [
  {
    key: 'parcel_delivery_platform_commission_percent',
    label: 'Commission plateforme (%)',
    hint: 'Prélevée sur le prix de chaque course colis — le reste revient au livreur.'
  }
];

const SURCHARGE_FIELDS = [
  { key: 'parcel_pricing_fuel_surcharge_percent', label: 'Majoration carburant (%)' },
  { key: 'parcel_pricing_night_surcharge_percent', label: 'Majoration nuit (%)', hint: '22h - 5h' },
  { key: 'parcel_pricing_weekend_surcharge_percent', label: 'Majoration week-end (%)' },
  { key: 'parcel_pricing_holiday_surcharge_percent', label: 'Majoration jour férié (%)' },
  { key: 'parcel_pricing_rain_surcharge_percent', label: 'Majoration intempéries (%)' },
  { key: 'parcel_pricing_waiting_fee_per_minute', label: 'Frais d’attente / minute (FCFA)' },
  { key: 'parcel_pricing_free_waiting_minutes', label: 'Minutes d’attente gratuites' },
  { key: 'parcel_pricing_max_driver_adjustment_percent', label: 'Ajustement livreur maximum (%)' }
];

const MANUAL_TOGGLES = [
  { key: 'parcel_pricing_holiday_active', label: 'Activer la majoration jour férié aujourd’hui' },
  { key: 'parcel_pricing_rain_active', label: 'Activer la majoration intempéries maintenant' }
];

const ENGINE_TOGGLES = [
  { key: 'parcel_pricing_enable_surge', label: 'Activer la tarification dynamique (heures de pointe)' },
  { key: 'parcel_pricing_enable_landmark', label: 'Activer la résolution par point de repère' },
  { key: 'parcel_pricing_enable_gps', label: 'Activer la tarification par distance GPS' },
  { key: 'parcel_pricing_enable_commune', label: 'Activer le repli sur le centre de la commune' },
  { key: 'parcel_pricing_enable_location_resolver', label: 'Activer la cascade de résolution de position' },
  { key: 'parcel_pricing_enable_zone_matrix', label: 'Utiliser la matrice de prix zone à zone' }
];

const ALL_KEYS = [...COMMISSION_FIELDS, ...SURCHARGE_FIELDS, ...MANUAL_TOGGLES, ...ENGINE_TOGGLES].map(
  (field) => field.key
);

export default function GeneralSettingsPanel() {
  const { showToast } = useToast();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/config/runtime', { params: { category: 'delivery_platform' } });
      const next = {};
      (data?.items || []).forEach((item) => {
        if (ALL_KEYS.includes(item.key)) next[item.key] = item.value;
      });
      setValues(next);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger les paramètres.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        ALL_KEYS.map((key) => {
          const isToggle = [...MANUAL_TOGGLES, ...ENGINE_TOGGLES].some((field) => field.key === key);
          const value = isToggle ? Boolean(values[key]) : Math.max(0, Number(values[key] || 0));
          return api.patch(`/admin/config/runtime/${key}`, { value });
        })
      );
      showToast('Paramètres enregistrés.', { variant: 'success' });
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible d’enregistrer les paramètres.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="py-6 text-center text-sm text-gray-400">Chargement…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <AdjustmentsHorizontalIcon className="h-5 w-5 text-[#e85d00]" />
        <h2 className="text-base font-black text-slate-950">Paramètres généraux du moteur de prix</h2>
      </div>

      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Revenu plateforme</p>
      <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
        {COMMISSION_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-xs font-black text-gray-700">{field.label}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={values[field.key] ?? 0}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className="min-h-11 w-full max-w-[160px] rounded-xl border border-gray-200 px-3 text-sm font-semibold"
            />
            <span className="mt-1 block text-[11px] text-gray-500">{field.hint}</span>
          </label>
        ))}
      </div>

      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Majorations</p>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SURCHARGE_FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-xs font-black text-gray-700">{field.label}</span>
            <input
              type="number"
              min="0"
              value={values[field.key] ?? 0}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
              className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold"
            />
            {field.hint ? <span className="mt-1 block text-[11px] text-gray-400">{field.hint}</span> : null}
          </label>
        ))}
      </div>

      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Activation manuelle</p>
      <div className="mb-5 space-y-2">
        {MANUAL_TOGGLES.map((field) => (
          <label key={field.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={Boolean(values[field.key])}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-semibold text-slate-800">{field.label}</span>
          </label>
        ))}
      </div>

      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-gray-400">Modules du moteur</p>
      <div className="mb-5 space-y-2">
        {ENGINE_TOGGLES.map((field) => (
          <label key={field.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={Boolean(values[field.key])}
              onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm font-semibold text-slate-800">{field.label}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white disabled:opacity-50"
      >
        {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
        {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </section>
  );
}
