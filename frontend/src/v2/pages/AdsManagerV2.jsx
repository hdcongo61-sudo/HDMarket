import React from 'react';
import { BarChart3, MousePointerClick, Sparkles } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Button from '../components/V2Button';
import V2Metric from '../components/V2Metric';

export default function AdsManagerV2() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <V2Metric label="Impressions" value="124 300" hint="+12% cette semaine" icon={<BarChart3 className="h-4 w-4" />} />
        <V2Metric label="Clics" value="3 294" hint="CTR 2.65%" icon={<MousePointerClick className="h-4 w-4" />} />
        <V2Metric label="Budget actif" value="85 000 FCFA" hint="2 campagnes" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      <V2Card title="Créer une campagne" subtitle="Ciblage ville + multi-produits + prix dynamique">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block v2-text-soft">Type de boost</span>
            <select className="w-full rounded-xl border v2-divider bg-[var(--v2-surface)] px-3 py-2 text-sm">
              <option>LOCAL_PRODUCT_BOOST</option>
              <option>PRODUCT_BOOST</option>
              <option>SHOP_BOOST</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block v2-text-soft">Ville ciblée</span>
            <select className="w-full rounded-xl border v2-divider bg-[var(--v2-surface)] px-3 py-2 text-sm">
              <option>Brazzaville</option>
              <option>Pointe-Noire</option>
              <option>Oyo</option>
            </select>
          </label>
        </div>
        <div className="mt-3 rounded-xl bg-[var(--v2-surface-soft)] p-3 text-sm">
          <p className="v2-text-soft">Prévisualisation prix</p>
          <p className="mt-1 font-semibold">Base 2 000 × 7 jours × 3 produits = 42 000 FCFA</p>
          <p className="text-xs v2-text-soft">Multiplicateur saisonnier x1.2 → Total: 50 400 FCFA</p>
        </div>
        <div className="mt-3 flex gap-2">
          <V2Button>Lancer campagne</V2Button>
          <V2Button variant="secondary">Sauvegarder brouillon</V2Button>
        </div>
      </V2Card>
    </div>
  );
}
