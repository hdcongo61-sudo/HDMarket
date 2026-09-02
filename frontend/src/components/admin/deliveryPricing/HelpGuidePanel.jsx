import React from 'react';
import { AdjustmentsHorizontalIcon, BoltIcon, BuildingLibraryIcon, ClockIcon, CubeIcon, MapPinIcon, NumberedListIcon, ReceiptPercentIcon, ScaleIcon, TagIcon, TruckIcon } from '@heroicons/react/24/outline';

const STEPS = [
  {
    icon: MapPinIcon,
    title: '1. Renseignez les centres GPS',
    body: 'Dans « Villes & communes », ajoutez la latitude/longitude de chaque ville et, idéalement, de chaque commune. Ce sont les positions de secours utilisées quand un client ne partage pas sa position GPS.'
  },
  {
    icon: BuildingLibraryIcon,
    title: '2. Ajoutez des points de repère (optionnel mais recommandé)',
    body: 'Dans « Points de repère », créez des lieux connus (stations-service, marchés, hôpitaux...) avec leurs coordonnées et des alias. Quand un client écrit « Près de Total Station », le moteur reconnaît « Total » et utilise ces coordonnées — bien plus précis qu’un simple centre de commune.'
  },
  {
    icon: NumberedListIcon,
    title: '3. (Optionnel) Créez des zones et une matrice de prix',
    body: 'Si vous préférez un prix de base par « Zone A → Zone B » plutôt que le calcul à la distance, créez des zones dans « Zones », assignez chaque commune à une zone (dans « Villes & communes »), puis remplissez les tarifs dans « Matrice de prix ». Activez ensuite « Utiliser la matrice de prix zone à zone » dans « Général ». Sans ça, le moteur utilise le calcul par distance ou le forfait même-commune/commune-différente.'
  },
  {
    icon: CubeIcon,
    title: '4. Configurez les types de colis, poids et vitesse',
    body: 'Dans « Types de colis », « Poids » et « Vitesse », définissez les suppléments optionnels que le client peut choisir en passant sa commande (Documents, Nourriture... / tranches de poids / Standard-Express-Immédiat).'
  },
  {
    icon: ClockIcon,
    title: '5. Réglez les majorations et heures de pointe',
    body: 'Dans « Général », définissez les majorations globales (carburant, nuit, week-end...) et activez celles qui doivent s’appliquer automatiquement (jour férié, intempéries). Pour des créneaux précis (ex: 7h-9h en semaine), utilisez « Heures de pointe » et activez « Tarification dynamique ».'
  },
  {
    icon: ReceiptPercentIcon,
    title: '6. Fixez votre commission',
    body: 'Toujours dans « Général », section « Revenu plateforme » : le pourcentage prélevé sur chaque course. Le reste revient automatiquement au livreur — visible dans ses courses et dans vos statistiques (page Courses colis).'
  },
  {
    icon: TagIcon,
    title: '7. (Optionnel) Créez des codes promo',
    body: 'Dans « Promotions », créez des codes remise (%, montant fixe, ou livraison gratuite), avec une limite d’utilisation et une date d’expiration si besoin.'
  }
];

const PRIORITY_ORDER = [
  { label: 'Position GPS', detail: 'si le client a partagé sa position (retrait et dépôt)' },
  { label: 'Point de repère', detail: 'si l’adresse tapée correspond à un repère connu' },
  { label: 'Centre de la commune', detail: 'si la commune a des coordonnées enregistrées' },
  { label: 'Centre de la ville', detail: 'dernier recours — garantit qu’un prix est toujours calculé' }
];

export default function HelpGuidePanel() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-[#e85d00]" />
          <h2 className="text-base font-black text-slate-950">Comment utiliser ce module</h2>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Ce module calcule automatiquement le prix de chaque course colis, même sans GPS. Ordre de mise en place recommandé :
        </p>
        <div className="space-y-3">
          {STEPS.map((step) => (
            <div key={step.title} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#e85d00] shadow-sm">
                <step.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900">{step.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-gray-600">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <BoltIcon className="h-5 w-5 text-[#e85d00]" />
          <h2 className="text-base font-black text-slate-950">Comment le prix est calculé</h2>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Le moteur résout d’abord la position GPS du retrait et du dépôt, dans cet ordre de priorité :
        </p>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRIORITY_ORDER.map((item, index) => (
            <div key={item.label} className="flex items-start gap-2 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e85d00] text-[10px] font-black text-white">
                {index + 1}
              </span>
              <div>
                <p className="text-xs font-black text-slate-900">{item.label}</p>
                <p className="text-[11px] text-gray-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mb-2 text-xs text-gray-500">Puis, dans l’ordre, il additionne :</p>
        <ol className="list-inside list-decimal space-y-1 text-xs text-gray-700">
          <li>Prix de base (zone à zone, ou distance, ou forfait même/différente commune)</li>
          <li>Ajustement distance (si les deux positions sont connues)</li>
          <li>Supplément type de colis</li>
          <li>Supplément ou multiplicateur de poids</li>
          <li>Supplément vitesse de livraison</li>
          <li>Majorations (carburant, nuit, week-end, jour férié, intempéries, heures de pointe)</li>
          <li>Frais d’attente (le cas échéant)</li>
          <li>Remise du code promo (si appliqué)</li>
        </ol>
        <p className="mt-3 rounded-xl bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800">
          Le client voit toujours ce détail ligne par ligne — jamais un seul total — dans l’écran « Envoyer un colis ».
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <TruckIcon className="h-5 w-5 text-[#e85d00]" />
          <h2 className="text-base font-black text-slate-950">À savoir</h2>
        </div>
        <ul className="space-y-2 text-xs text-gray-600">
          <li className="flex gap-2">
            <ScaleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            Les onglets « Zones » et « Matrice de prix » ne servent que si « Utiliser la matrice de prix zone à zone » est activé — sinon ils sont ignorés sans risque.
          </li>
          <li className="flex gap-2">
            <ReceiptPercentIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            Un livreur peut demander un ajustement de prix sur une course (ex: route en mauvais état) — le client doit l’approuver, dans la limite du pourcentage maximum défini dans « Général ».
          </li>
          <li className="flex gap-2">
            <CubeIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
            Toutes les valeurs ont des valeurs par défaut sûres — vous pouvez laisser un onglet vide sans casser le calcul du prix.
          </li>
        </ul>
      </div>
    </section>
  );
}
