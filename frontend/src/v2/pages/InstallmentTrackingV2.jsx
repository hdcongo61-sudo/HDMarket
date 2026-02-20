import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ReceiptText } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Badge from '../components/V2Badge';
import V2Button from '../components/V2Button';

export default function InstallmentTrackingV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Suivi tranche" subtitle="Transparence complète des paiements et validations">
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--v2-surface-soft)]">
            <div className="h-full w-2/3 rounded-full bg-[var(--v2-accent)]" />
          </div>
          <p className="text-xs v2-text-soft">Progression: 66%</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <V2Badge tone="accent"><Clock3 className="mr-1 h-3.5 w-3.5" />Prochaine échéance: 24 Feb</V2Badge>
          <V2Badge tone="warning"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Pénalité possible après 48h</V2Badge>
        </div>
      </V2Card>

      <V2Card title="Échéancier" subtitle="Preuves transactionnelles par tranche">
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border v2-divider p-3">
            <p className="font-medium">Tranche 1 · 216 700 FCFA</p>
            <p className="mt-1 text-xs v2-text-soft">ID transaction: 7232173826</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Validée</p>
          </div>
          <div className="rounded-xl border v2-divider p-3">
            <p className="font-medium">Tranche 2 · 216 700 FCFA</p>
            <p className="mt-1 text-xs v2-text-soft">En attente de preuve</p>
            <V2Button variant="secondary" className="mt-2 h-9 min-h-9 px-3"><ReceiptText className="h-4 w-4" />Soumettre preuve</V2Button>
          </div>
        </div>
      </V2Card>
    </div>
  );
}
