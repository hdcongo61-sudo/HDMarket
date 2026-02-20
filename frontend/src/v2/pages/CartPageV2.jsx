import React from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Button from '../components/V2Button';
import V2Badge from '../components/V2Badge';

export default function CartPageV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Panier" subtitle="2 articles · livraison locale priorisée">
        <div className="space-y-3">
          <div className="rounded-2xl border v2-divider p-3">
            <p className="font-medium">iPhone 14 Pro Max</p>
            <p className="text-xs v2-text-soft">650 000 FCFA · Brazzaville</p>
            <div className="mt-2"><V2Badge tone="accent">Éligible tranche</V2Badge></div>
          </div>
          <div className="rounded-2xl border v2-divider p-3">
            <p className="font-medium">Chaise ergonomique</p>
            <p className="text-xs v2-text-soft">75 000 FCFA · Brazzaville</p>
          </div>
        </div>
      </V2Card>

      <V2Card title="Résumé" subtitle="Paiement sécurisé et protection litige">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="v2-text-soft">Sous-total</span><span>725 000 FCFA</span></div>
          <div className="flex justify-between"><span className="v2-text-soft">Livraison</span><span>5 000 FCFA</span></div>
          <div className="flex justify-between border-t v2-divider pt-2 font-semibold"><span>Total</span><span>730 000 FCFA</span></div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <V2Button><CreditCard className="h-4 w-4" />Payer maintenant</V2Button>
          <V2Button variant="secondary">Payer en tranches</V2Button>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs v2-text-soft"><ShieldCheck className="h-3.5 w-3.5" />Transactions sécurisées et preuve obligatoire</p>
      </V2Card>
    </div>
  );
}
