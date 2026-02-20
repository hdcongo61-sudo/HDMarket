import React from 'react';
import { BarChart3, CreditCard, MousePointerClick, Sparkles } from 'lucide-react';
import V2Metric from '../components/V2Metric';
import V2Card from '../components/V2Card';
import V2Button from '../components/V2Button';

export default function SellerDashboardV2() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <V2Metric label="Revenus" value="4 850 000 FCFA" hint="+14% mensuel" icon={<BarChart3 className="h-4 w-4" />} />
        <V2Metric label="Revenus tranche" value="1 390 000 FCFA" hint="En progression" icon={<CreditCard className="h-4 w-4" />} />
        <V2Metric label="Impressions boost" value="83 420" hint="CTR 2.4%" icon={<MousePointerClick className="h-4 w-4" />} />
        <V2Metric label="Campagnes actives" value="3" hint="1 expire demain" icon={<Sparkles className="h-4 w-4" />} />
      </div>

      <V2Card title="Performance campagnes" subtitle="Visualisation légère, sans surcharge">
        <div className="h-52 rounded-2xl bg-[var(--v2-surface-soft)] p-4">
          <div className="flex h-full items-end gap-2">
            {[36, 54, 43, 72, 61, 84, 69].map((height, idx) => (
              <div key={`bar-${idx}`} className="flex-1 rounded-t-lg bg-[var(--v2-accent)]/70" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <V2Button>Nouvelle campagne</V2Button>
          <V2Button variant="secondary">Voir analytics</V2Button>
        </div>
      </V2Card>
    </div>
  );
}
