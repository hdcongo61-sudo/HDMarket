import React from 'react';
import { CheckCircle2, Clock3, Package, Truck } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Badge from '../components/V2Badge';
import V2Button from '../components/V2Button';

export default function OrdersPageV2() {
  return (
    <div className="space-y-4">
      <V2Card title="Mes commandes" subtitle="Timeline claire et action suivante visible">
        <div className="flex flex-wrap gap-2">
          <V2Badge tone="warning"><Clock3 className="mr-1 h-3.5 w-3.5" />En attente</V2Badge>
          <V2Badge tone="accent"><Truck className="mr-1 h-3.5 w-3.5" />En livraison</V2Badge>
          <V2Badge tone="success"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Livrées</V2Badge>
        </div>
      </V2Card>

      <V2Card title="Commande #A1C932" subtitle="Dernière mise à jour il y a 18 min" right={<V2Badge tone="accent">En livraison</V2Badge>}>
        <div className="space-y-2 text-sm">
          <p className="inline-flex items-center gap-2"><Package className="h-4 w-4" />Prête à livrer</p>
          <p className="inline-flex items-center gap-2"><Truck className="h-4 w-4" />En cours de livraison</p>
          <p className="inline-flex items-center gap-2 opacity-45"><CheckCircle2 className="h-4 w-4" />Confirmée client</p>
        </div>
        <div className="mt-4 flex gap-2">
          <V2Button variant="secondary">Voir détails</V2Button>
          <V2Button>Contacter vendeur</V2Button>
        </div>
      </V2Card>
    </div>
  );
}
