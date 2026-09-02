import React, { useCallback, useEffect, useState } from 'react';
import { ArrowPathIcon, ChartBarIcon, CircleStackIcon, ServerIcon, SparklesIcon } from '@heroicons/react/24/outline';
import api from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { formatPriceWithStoredSettings as formatCurrency } from '../../../utils/priceFormatter';

const Metric = ({ label, value, detail }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    {detail ? <p className="mt-0.5 text-[11px] text-gray-500">{detail}</p> : null}
  </div>
);

export default function DeliverySystemPanel() {
  const { showToast } = useToast();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/delivery-pricing/admin/system');
      setOverview(data);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Impossible de charger l’état du moteur.', {
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setAction('refresh');
    try {
      const { data } = await api.post('/delivery-pricing/admin/system/refresh');
      showToast(`Moteur actualisé (${data.pricingVersion}).`, { variant: 'success' });
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Actualisation impossible.', { variant: 'error' });
    } finally {
      setAction('');
    }
  };

  const installDemoData = async () => {
    const confirmed = window.confirm(
      'Installer les zones, tarifs, communes, repères et règles générés pour Brazzaville ? Les entrées portant le même nom seront mises à jour.'
    );
    if (!confirmed) return;

    setAction('demo');
    try {
      const { data } = await api.post('/delivery-pricing/admin/system/demo-data');
      showToast(`Données générées installées (${data.pricingVersion}).`, { variant: 'success' });
      await load();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Installation des données impossible.', {
        variant: 'error'
      });
    } finally {
      setAction('');
    }
  };

  if (loading && !overview) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-gray-100 bg-white">
        <ArrowPathIcon className="h-5 w-5 animate-spin text-[#e85d00]" />
      </div>
    );
  }

  const system = overview?.system || {};
  const analytics = overview?.analytics || {};
  const configuration = system.configuration || {};

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-[#e85d00]" />
              <h2 className="text-base font-black text-slate-950">État du moteur</h2>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Cache mémoire + Redis, version de configuration et actualisation automatique toutes les 5 minutes.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={Boolean(action)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-xs font-black text-gray-700 disabled:opacity-50"
          >
            {action === 'refresh' ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowPathIcon className="h-4 w-4" />
            )}
            Actualiser le contexte
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Version active" value={system.pricingVersion || '—'} detail={system.cacheSource || '—'} />
          <Metric label="Versions archivées" value={system.versions || 0} detail="Reproductibilité des prix" />
          <Metric label="Cache" value={`${system.cache?.memoryHits || 0} hits`} detail={system.cache?.redisReady ? 'Redis connecté' : 'Mémoire locale'} />
          <Metric label="Dernier chargement" value={system.loadedAt ? new Date(system.loadedAt).toLocaleTimeString('fr-FR') : '—'} detail={system.loadedAt ? new Date(system.loadedAt).toLocaleDateString('fr-FR') : ''} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <CircleStackIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-black text-slate-950">Configuration chargée</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric label="Communes" value={configuration.communes || 0} />
            <Metric label="Zones" value={configuration.zones || 0} />
            <Metric label="Tarifs zone" value={configuration.zonePrices || 0} />
            <Metric label="Repères" value={configuration.landmarks || 0} />
            <Metric label="Types colis" value={configuration.packageTypes || 0} />
            <Metric label="Règles actives" value={(configuration.weightRules || 0) + (configuration.speedRules || 0) + (configuration.peakHourRules || 0)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-black text-slate-950">Calculs — {analytics.days || 30} jours</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Estimations" value={analytics.calculations || 0} />
            <Metric label="Taux cache" value={`${analytics.cacheHitRate || 0}%`} />
            <Metric label="Temps moyen" value={`${analytics.averageDurationMs || 0} ms`} />
            <Metric label="Prix moyen" value={formatCurrency(analytics.averagePrice || 0)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-amber-700" />
              <h2 className="text-sm font-black text-amber-950">Données générées Brazzaville</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-amber-800">
              Installe un jeu idempotent de communes, zones, matrice tarifaire, repères, types de colis,
              poids, vitesses, heures de pointe et code BIENVENUE10. Coordonnées et prix doivent être
              validés avant la production.
            </p>
          </div>
          <button
            type="button"
            onClick={installDemoData}
            disabled={Boolean(action)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 text-xs font-black text-white disabled:opacity-50"
          >
            {action === 'demo' ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
            Installer les données
          </button>
        </div>
      </div>
    </section>
  );
}
