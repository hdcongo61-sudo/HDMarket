import React from 'react';
import { Bell, CheckCircle2, MessageSquare, Truck } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Badge from '../components/V2Badge';
import V2Button from '../components/V2Button';

export default function NotificationsV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Notifications" subtitle="Feed minimal avec swipe actions">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm v2-text-soft">3 non lues · regroupées Today / Yesterday / Earlier</p>
          <V2Button variant="secondary" className="h-9 min-h-9 px-3">Tout marquer lu</V2Button>
        </div>
      </V2Card>

      <div className="v2-surface divide-y v2-divider px-3 sm:px-4">
        <article className="py-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--v2-surface-soft)] grid place-items-center"><Truck className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Commande en livraison</p>
              <p className="mt-1 text-sm v2-text-soft">Votre commande #A1C932 est en cours de livraison.</p>
              <div className="mt-2 flex gap-2">
                <V2Badge tone="accent">New</V2Badge>
                <V2Button variant="ghost" className="h-8 min-h-8 px-2">Voir commande</V2Button>
              </div>
            </div>
          </div>
        </article>
        <article className="py-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--v2-surface-soft)] grid place-items-center"><MessageSquare className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Réponse vendeur</p>
              <p className="mt-1 text-sm v2-text-soft">Un vendeur a répondu à votre litige.</p>
              <p className="mt-2 text-xs v2-text-soft">Hier · 19:24</p>
            </div>
          </div>
        </article>
        <article className="py-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--v2-surface-soft)] grid place-items-center"><CheckCircle2 className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Boost approuvé</p>
              <p className="mt-1 text-sm v2-text-soft">Votre campagne LOCAL_PRODUCT_BOOST est active.</p>
              <p className="mt-2 text-xs v2-text-soft">Plus tôt</p>
            </div>
          </div>
        </article>
      </div>

      <p className="inline-flex items-center gap-1 text-xs v2-text-soft"><Bell className="h-3.5 w-3.5" />Pull-to-refresh + swipe to read/delete + long press actions</p>
    </div>
  );
}
