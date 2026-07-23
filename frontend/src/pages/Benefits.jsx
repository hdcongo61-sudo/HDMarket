import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Layers,
  Percent,
  Heart,
  Zap,
  CalendarClock,
  Users,
  Ticket,
  BadgeCheck,
  Truck,
  Store,
  MapPin,
  MessageCircle,
  Star,
  ShieldCheck,
  WifiOff,
  Bell,
  Rocket,
  BarChart3,
  ChevronRight,
  Check
} from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

const SECTION_IDS = {
  shopping: 'achat-malin',
  payments: 'paiements',
  delivery: 'livraison',
  trust: 'confiance',
  sellers: 'vendeurs'
};

function FeatureCard({ icon: Icon, title, benefit, steps, to, cta }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF0E4] text-[#e85d00]">
          <Icon size={19} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">{benefit}</p>
        </div>
      </div>
      {Array.isArray(steps) && steps.length > 0 && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-neutral-950">
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400 dark:text-neutral-500">
            Comment faire
          </p>
          <ol className="mt-1.5 space-y-1.5">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-xs font-medium text-gray-600 dark:text-neutral-300">
                <span className="mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF0E4] text-[10px] font-black text-[#e85d00]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
      {to && (
        <Link
          to={to}
          className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#e85d00] transition hover:gap-1.5"
        >
          {cta || 'Essayer maintenant'}
          <ChevronRight size={14} />
        </Link>
      )}
    </article>
  );
}

function SectionHeader({ id, eyebrow, title, subtitle }) {
  return (
    <div id={id} className="scroll-mt-20 pt-8">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#e85d00]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">{subtitle}</p>}
    </div>
  );
}

export default function Benefits() {
  const { getRuntimeValue } = useAppSettings();

  const isFlagOn = (key, fallback = false) =>
    ['true', '1', 'yes', 'on'].includes(String(getRuntimeValue(key, fallback)).trim().toLowerCase());

  const payForOtherEnabled = isFlagOn('enable_pay_for_other');
  const wholesaleEnabled = isFlagOn('enable_wholesale');
  const platformDeliveryEnabled = isFlagOn('enable_platform_delivery');
  const fullPaymentFreeDelivery = isFlagOn('enable_full_payment_free_delivery', true);

  const navChips = useMemo(
    () => [
      { id: SECTION_IDS.shopping, label: 'Achat malin' },
      { id: SECTION_IDS.payments, label: 'Paiements' },
      { id: SECTION_IDS.delivery, label: 'Livraison' },
      { id: SECTION_IDS.trust, label: 'Confiance' },
      { id: SECTION_IDS.sellers, label: 'Vendeurs' }
    ],
    []
  );

  return (
    <main className="hd-commerce-shell min-h-screen bg-[#f5f5f5] pb-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* ── HERO ── */}
      <section className="bg-white px-4 pb-6 pt-8 text-center dark:bg-neutral-900">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E4] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#e85d00]">
          <ShoppingBag size={12} />
          Guide des avantages
        </p>
        <h1 className="mx-auto mt-3 max-w-md text-2xl font-black leading-tight tracking-tight text-gray-900 dark:text-white sm:text-3xl">
          Pourquoi choisir HDMarket ?
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-neutral-400">
          Le marketplace pensé pour le Congo : paiements flexibles, achats protégés et une
          application qui fonctionne même quand la connexion faiblit. Voici tout ce que vous
          pouvez faire, et comment le faire.
        </p>
        <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
          {['Mobile Money', 'Paiements vérifiés', 'Pensé pour le Congo'].map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 dark:bg-neutral-950 dark:text-neutral-300"
            >
              <Check size={12} className="text-emerald-600" />
              {chip}
            </span>
          ))}
        </div>
      </section>

      {/* ── ANCHOR NAV (sticky) ── */}
      <nav className="border-b border-gray-100 bg-white/90 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/90">
        <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navChips.map((chip) => (
            <a
              key={chip.id}
              href={`#${chip.id}`}
              className="flex-shrink-0 rounded-full bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-[#FFF0E4] hover:text-[#e85d00] dark:bg-neutral-800 dark:text-neutral-300"
            >
              {chip.label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-3xl px-4">
        {/* ── ACHAT MALIN ── */}
        <SectionHeader
          id={SECTION_IDS.shopping}
          eyebrow="Acheter"
          title="Achetez malin"
          subtitle="Des outils de découverte inspirés des plus grands marketplaces."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={Layers}
            title="Variantes en photo"
            benefit="Chaque couleur ou taille a sa propre photo et son propre prix : vous voyez exactement ce que vous commandez."
            steps={[
              'Ouvrez un produit',
              'Touchez une vignette sous la photo — l’image et le prix suivent',
              'Touchez « Tout » pour comparer toutes les options d’un coup'
            ]}
            to="/products"
            cta="Voir les produits"
          />
          {wholesaleEnabled && (
            <FeatureCard
              icon={Percent}
              title="Prix de gros dégressifs"
              benefit="Plus vous commandez, moins l’unité coûte. Le tarif de gros s’applique tout seul."
              steps={[
                'Repérez les paliers de prix sur la fiche produit',
                'Augmentez la quantité : la remise s’applique automatiquement'
              ]}
            />
          )}
          <FeatureCard
            icon={Zap}
            title="Ventes flash & bons plans"
            benefit="Des promotions limitées dans le temps et un classement des meilleures remises, mis à jour en continu."
            steps={['Consultez « Ventes flash » depuis l’accueil', 'Ajoutez au panier avant la fin du compte à rebours']}
            to="/flash-sales"
            cta="Voir les ventes flash"
          />
          <FeatureCard
            icon={Heart}
            title="Favoris & historique"
            benefit="Gardez un œil sur les articles qui vous plaisent et retrouvez ce que vous avez consulté."
            steps={['Touchez le cœur sur un produit', 'Retrouvez tout dans l’onglet Favoris']}
            to="/favorites"
            cta="Mes favoris"
          />
        </div>

        {/* ── PAIEMENTS ── */}
        <SectionHeader
          id={SECTION_IDS.payments}
          eyebrow="Payer"
          title="Payez à votre façon"
          subtitle="Des modes de paiement qu’aucune autre application locale ne réunit."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={ShieldCheck}
            title="Mobile Money vérifié"
            benefit="Payez avec MTN MoMo ou Airtel Money via PawaPay : la confirmation est automatique, sans preuve ni code transaction à recopier."
            steps={[
              'Choisissez votre réseau au moment de payer',
              'Envoyez le paiement et soumettez la référence',
              'Notre équipe vérifie et votre commande démarre'
            ]}
          />
          <FeatureCard
            icon={CalendarClock}
            title="Paiement par tranches"
            benefit="Étalez vos achats importants en plusieurs versements, avec un suivi clair de chaque échéance."
            steps={[
              'Au paiement, choisissez « Paiement par tranche »',
              'Versez la première tranche',
              'Suivez vos échéances dans le détail de la commande'
            ]}
          />
          {payForOtherEnabled && (
            <FeatureCard
              icon={Users}
              title="Faire payer par un proche"
              benefit="Vous choisissez, un proche paie — même s’il est à l’autre bout du pays. Unique au Congo."
              steps={[
                'Au paiement, choisissez « Paiement par un proche »',
                'Partagez le lien généré (WhatsApp, SMS…)',
                'Votre proche paie, la commande se lance'
              ]}
            />
          )}
          <FeatureCard
            icon={Ticket}
            title="Codes promo"
            benefit="Les vendeurs et HDMarket publient des codes de réduction à saisir au moment de payer."
            steps={['Copiez le code promo', 'Collez-le dans le champ dédié au paiement']}
          />
          {fullPaymentFreeDelivery && (
            <FeatureCard
              icon={BadgeCheck}
              title="Comptant récompensé"
              benefit="Payez la totalité d’un coup et profitez d’avantages comme la livraison offerte sur les commandes éligibles."
            />
          )}
        </div>

        {/* ── LIVRAISON ── */}
        <SectionHeader
          id={SECTION_IDS.delivery}
          eyebrow="Recevoir"
          title="Livraison suivie, ou retrait en boutique"
          subtitle="Vous décidez comment récupérer vos achats — et vous voyez tout."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={Truck}
            title="Livraison ou retrait"
            benefit="Faites-vous livrer, ou passez récupérer en boutique quand ça vous arrange : le choix se fait à la commande."
            steps={['Au paiement, choisissez « Livraison » ou « Retrait en boutique »']}
          />
          {platformDeliveryEnabled && (
            <FeatureCard
              icon={MapPin}
              title="Suivi en temps réel"
              benefit="Suivez votre livreur sur la carte et recevez une preuve de livraison à l’arrivée."
              steps={['Ouvrez le détail de votre commande', 'Touchez le suivi pour voir la position du livreur']}
            />
          )}
          <FeatureCard
            icon={MessageCircle}
            title="Chat de commande & WhatsApp"
            benefit="Discutez avec le vendeur directement depuis la commande, ou en un tap sur WhatsApp."
            steps={['Dans une commande, ouvrez la conversation', 'Posez vos questions, photos à l’appui']}
          />
          <FeatureCard
            icon={Store}
            title="Boutiques « livraison offerte »"
            benefit="Une sélection de boutiques qui prennent la livraison en charge, réunies au même endroit."
            to="/shops/free-delivery"
            cta="Voir ces boutiques"
          />
        </div>

        {/* ── CONFIANCE ── */}
        <SectionHeader
          id={SECTION_IDS.trust}
          eyebrow="Acheter serein"
          title="Confiance & sécurité"
          subtitle="Des garde-fous à chaque étape, même hors connexion."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={BadgeCheck}
            title="Boutiques vérifiées"
            benefit="Le badge « vérifié » signale les vendeurs contrôlés par HDMarket. Repérez-le avant d’acheter."
            to="/shops/verified"
            cta="Voir les boutiques vérifiées"
          />
          <FeatureCard
            icon={Star}
            title="Avis d’acheteurs réels"
            benefit="Notes et commentaires laissés après commande : vous savez à qui vous avez affaire."
            steps={['Consultez les avis en bas de chaque fiche produit', 'Après réception, laissez le vôtre pour aider les autres']}
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Réclamations traitées"
            benefit="Un souci avec une commande ? Ouvrez un litige : notre équipe suit le dossier jusqu’à sa résolution."
            steps={['Depuis la commande concernée, ouvrez une réclamation', 'Ajoutez photos et description', 'Suivez la réponse de l’équipe dans vos notifications']}
          />
          <FeatureCard
            icon={WifiOff}
            title="Conçu pour les connexions lentes"
            benefit="Connexion 3G capricieuse ? L’application garde vos dernières données et met en file vos actions pour les envoyer dès le retour du réseau."
          />
          <FeatureCard
            icon={Bell}
            title="Notifications à chaque étape"
            benefit="Paiement validé, commande expédiée, livreur en route : vous êtes prévenu en temps réel."
            to="/notifications"
            cta="Mes notifications"
          />
        </div>

        {/* ── VENDEURS ── */}
        <SectionHeader
          id={SECTION_IDS.sellers}
          eyebrow="Vendre"
          title="Et pour les vendeurs"
          subtitle="Ouvrez votre boutique et développez vos ventes avec de vrais outils."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={Store}
            title="Votre boutique en ligne"
            benefit="Créez votre boutique, publiez vos produits avec variantes, photos et vidéos, et vendez dans tout le Congo."
            to="/plans"
            cta="Voir les plans"
          />
          <FeatureCard
            icon={Rocket}
            title="Boost de visibilité"
            benefit="Mettez vos produits en avant sur l’accueil et dans les recherches pour toucher plus d’acheteurs."
            steps={['Depuis votre produit, demandez un boost', 'Choisissez la durée, payez, c’est en ligne']}
          />
          <FeatureCard
            icon={BarChart3}
            title="Statistiques de vente"
            benefit="Vues, ventes, meilleurs produits : pilotez votre activité avec des chiffres clairs."
          />
          <FeatureCard
            icon={Ticket}
            title="Vos propres promos"
            benefit="Créez vos codes promo et vos prix de gros pour fidéliser et vendre en volume."
          />
        </div>

        {/* ── CTA FINAL ── */}
        <section className="mt-10 rounded-2xl bg-[#e85d00] p-6 text-center text-white shadow-sm">
          <h2 className="text-xl font-black tracking-tight">Prêt à essayer ?</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm font-medium text-white/85">
            Créez votre compte gratuitement et découvrez tout ça par vous-même.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/register"
              className="inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-black text-[#e85d00] transition active:scale-95"
            >
              Créer un compte
            </Link>
            <Link
              to="/products"
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/40 px-5 text-sm font-black text-white transition active:scale-95"
            >
              Explorer les produits
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
