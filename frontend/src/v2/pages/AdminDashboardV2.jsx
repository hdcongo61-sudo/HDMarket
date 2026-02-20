import React from 'react';
import { AlertCircle, CircleDollarSign, ShieldCheck, Users } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Metric from '../components/V2Metric';
import V2Button from '../components/V2Button';

export default function AdminDashboardV2() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <V2Metric label="GMV" value="93 200 000 FCFA" hint="30 derniers jours" icon={<CircleDollarSign className="h-4 w-4" />} />
        <V2Metric label="Utilisateurs actifs" value="18 490" hint="7 pays à venir" icon={<Users className="h-4 w-4" />} />
        <V2Metric label="Litiges ouverts" value="126" hint="8 urgents" icon={<AlertCircle className="h-4 w-4" />} />
        <V2Metric label="Confiance" value="97.2%" hint="livraisons vérifiées" icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <V2Card title="Ops center" subtitle="Files critiques et actions rapides">
        <div className="space-y-2 text-sm">
          <div className="rounded-xl bg-[var(--v2-surface-soft)] p-3">42 paiements en attente de vérification</div>
          <div className="rounded-xl bg-[var(--v2-surface-soft)] p-3">18 demandes boost en attente d’activation</div>
          <div className="rounded-xl bg-[var(--v2-surface-soft)] p-3">8 litiges deadline &lt; 24h</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <V2Button>Traitement prioritaire</V2Button>
          <V2Button variant="secondary">Voir rapports</V2Button>
        </div>
      </V2Card>
    </div>
  );
}
