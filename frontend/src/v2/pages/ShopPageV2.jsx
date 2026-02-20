import React from 'react';
import { Star, Store, Verified } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2FeedItem from '../components/V2FeedItem';
import V2Button from '../components/V2Button';

export default function ShopPageV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Boutique Mbolo" subtitle="Brazzaville · Électronique" right={<Verified className="h-5 w-5 text-[var(--v2-accent)]" />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[var(--v2-surface-soft)] p-3">
            <p className="text-xs v2-text-soft">Réputation</p>
            <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold"><Star className="h-4 w-4 text-amber-500" />4.8/5</p>
          </div>
          <div className="rounded-2xl bg-[var(--v2-surface-soft)] p-3">
            <p className="text-xs v2-text-soft">Livraisons vérifiées</p>
            <p className="mt-1 text-lg font-semibold">1 284</p>
          </div>
          <div className="rounded-2xl bg-[var(--v2-surface-soft)] p-3">
            <p className="text-xs v2-text-soft">Abonnés</p>
            <p className="mt-1 text-lg font-semibold">9 210</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <V2Button variant="primary"><Store className="h-4 w-4" />Suivre</V2Button>
          <V2Button variant="secondary">Contacter</V2Button>
        </div>
      </V2Card>

      <div className="v2-surface px-3 sm:px-4">
        <V2FeedItem title="iPhone 14 Pro Max" price="650 000 FCFA" city="Brazzaville" seller="Boutique Mbolo" installment boosted />
        <V2FeedItem title="MacBook Air M2" price="790 000 FCFA" city="Brazzaville" seller="Boutique Mbolo" installment />
      </div>
    </div>
  );
}
