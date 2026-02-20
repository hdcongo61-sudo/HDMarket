import React from 'react';
import { Bell, Lock, MapPin, ShieldCheck, User } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Button from '../components/V2Button';
import V2Badge from '../components/V2Badge';

export default function ProfileSettingsV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Profil & paramètres" subtitle="Identité, sécurité, préférences, expansion multi-pays">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[var(--v2-surface-soft)] p-3">
            <p className="text-xs v2-text-soft">Nom</p>
            <p className="mt-1 text-sm font-medium inline-flex items-center gap-1.5"><User className="h-4 w-4" />Merveille K.</p>
          </div>
          <div className="rounded-2xl bg-[var(--v2-surface-soft)] p-3">
            <p className="text-xs v2-text-soft">Ville</p>
            <p className="mt-1 text-sm font-medium inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />Brazzaville</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <V2Badge tone="success"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Compte vérifié</V2Badge>
          <V2Badge tone="accent"><Lock className="mr-1 h-3.5 w-3.5" />2FA activée</V2Badge>
        </div>
      </V2Card>

      <V2Card title="Préférences" subtitle="Notifications, devise, mode d'affichage">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between rounded-xl bg-[var(--v2-surface-soft)] px-3 py-2">
            <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4" />Alertes commandes</span>
            <span className="text-xs font-semibold">ON</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--v2-surface-soft)] px-3 py-2">
            <span>Devise d'affichage</span>
            <span className="text-xs font-semibold">XAF</span>
          </div>
        </div>
        <div className="mt-3"><V2Button variant="secondary">Enregistrer</V2Button></div>
      </V2Card>
    </div>
  );
}
