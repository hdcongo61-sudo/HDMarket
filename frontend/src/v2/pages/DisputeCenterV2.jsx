import React from 'react';
import { AlertTriangle, CheckCircle2, FileImage, Gavel, Upload } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Badge from '../components/V2Badge';
import V2Button from '../components/V2Button';

export default function DisputeCenterV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Dispute Center" subtitle="Timeline + preuves + décision claire" right={<V2Badge tone="warning">UNDER_REVIEW</V2Badge>}>
        <div className="space-y-2 text-sm">
          <p>1. Réclamation soumise</p>
          <p>2. Réponse vendeur reçue</p>
          <p className="font-semibold">3. Arbitrage admin en cours</p>
          <p className="opacity-50">4. Résolution finale</p>
        </div>
      </V2Card>

      <V2Card title="Preuves" subtitle="Upload sécurisé image / PDF">
        <div className="rounded-2xl border border-dashed v2-divider bg-[var(--v2-surface-soft)] p-4 text-center">
          <Upload className="mx-auto h-5 w-5 v2-text-soft" />
          <p className="mt-2 text-sm">Déposez vos preuves de transaction, livraison, signature.</p>
          <p className="text-xs v2-text-soft">Max 5 fichiers · audit trail actif</p>
          <V2Button variant="secondary" className="mt-3"><FileImage className="h-4 w-4" />Ajouter preuves</V2Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <V2Badge tone="accent"><Gavel className="mr-1 h-3.5 w-3.5" />Arbitrage protégé</V2Badge>
          <V2Badge tone="danger"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Deadline réponse: 24h</V2Badge>
          <V2Badge tone="success"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Historique complet</V2Badge>
        </div>
      </V2Card>
    </div>
  );
}
