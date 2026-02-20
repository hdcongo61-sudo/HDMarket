import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import V2Card from '../components/V2Card';
import V2Badge from '../components/V2Badge';
import V2Button from '../components/V2Button';
import { fadeUp } from '../motion';

export default function ProductPageV2() {
  return (
    <div className="space-y-4">
      <motion.div {...fadeUp} className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="v2-surface overflow-hidden p-0">
          <div className="h-72 bg-[var(--v2-surface-soft)] sm:h-96" />
        </div>
        <V2Card
          title="iPhone 14 Pro Max"
          subtitle="256Go · État neuf · Brazzaville"
          right={<V2Badge tone="warning">Sponsorisé</V2Badge>}
        >
          <p className="text-3xl font-semibold tracking-tight">650 000 FCFA</p>
          <p className="mt-1 text-sm v2-text-soft">ou 3 tranches de 216 700 FCFA</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <V2Badge tone="accent">Paiement en tranche</V2Badge>
            <V2Badge tone="success">Vendeur vérifié</V2Badge>
          </div>
          <div className="mt-4 grid gap-2 text-xs v2-text-soft">
            <p className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Paiement sécurisé avec preuve</p>
            <p className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Preuve de livraison obligatoire</p>
            <p className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Protection litige intégrée</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <V2Button>Ajouter au panier</V2Button>
            <V2Button variant="secondary">Acheter en tranche</V2Button>
          </div>
        </V2Card>
      </motion.div>

      <V2Card title="Produits similaires" subtitle="Sélection locale intelligente">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`similar-${idx}`} className="rounded-2xl border v2-divider bg-[var(--v2-surface-soft)] p-2">
              <div className="h-20 rounded-xl bg-[var(--v2-surface)]" />
              <p className="mt-2 text-xs font-medium">Produit lié {idx + 1}</p>
            </div>
          ))}
        </div>
      </V2Card>
    </div>
  );
}
