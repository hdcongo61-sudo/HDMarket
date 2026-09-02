import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUturnLeftIcon, BellIcon, BoltIcon, BuildingStorefrontIcon, CalendarDaysIcon, ChartBarIcon, ChatBubbleLeftIcon, CheckBadgeIcon, CheckCircleIcon, CheckIcon, ChevronRightIcon, ClockIcon, DevicePhoneMobileIcon, DocumentTextIcon, FilmIcon, GiftIcon, HashtagIcon, HeartIcon, LockClosedIcon, MapPinIcon, ReceiptPercentIcon, RocketLaunchIcon, ShieldCheckIcon, ShieldExclamationIcon, ShoppingBagIcon, ShoppingCartIcon, SparklesIcon, Square3Stack3DIcon, StarIcon, TicketIcon, TruckIcon, UsersIcon, WifiIcon } from '@heroicons/react/24/outline';
import { useAppSettings } from '../context/AppSettingsContext';

const SECTION_IDS = {
  shopping: 'achat-malin',
  videos: 'videos',
  payments: 'paiements',
  protection: 'protection',
  refunds: 'remboursements',
  delivery: 'livraison',
  trust: 'confiance',
  services: 'services',
  sellers: 'vendeurs'
};

const REFUND_STEPS = [
  {
    icon: DocumentTextIcon,
    title: 'Signalez le problème',
    description:
      'Ouvrez la commande concernée, demandez son annulation quand le bouton est disponible ou créez une réclamation avec vos justificatifs.'
  },
  {
    icon: ShieldCheckIcon,
    title: 'Le dossier est examiné',
    description:
      'Le vendeur et, si nécessaire, l’équipe HDMarket vérifient la commande, les échanges, les photos et la preuve de remise.'
  },
  {
    icon: ArrowUturnLeftIcon,
    title: 'PawaPay renvoie les fonds',
    description:
      'Après validation, le remboursement total ou partiel est envoyé vers le compte Mobile Money utilisé pour le paiement initial.'
  },
  {
    icon: CheckCircleIcon,
    title: 'Vous suivez la confirmation',
    description:
      'Le montant, la référence et le statut restent visibles dans le détail de la commande. Une notification vous informe du résultat.'
  }
];

function FeatureCard({ icon: Icon, title, benefit, steps, to, cta }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF0E4] text-[#e85d00]">
          <Icon strokeWidth={2.2} className="h-[19px] w-[19px]" />
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
          <ChevronRightIcon className="h-3.5 w-3.5" />
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
  const { getRuntimeValue, isFeatureEnabled } = useAppSettings();

  const isFlagOn = (key, fallback = false) =>
    ['true', '1', 'yes', 'on'].includes(String(getRuntimeValue(key, fallback)).trim().toLowerCase());

  const payForOtherEnabled = isFlagOn('enable_pay_for_other');
  const wholesaleEnabled = isFlagOn('enable_wholesale');
  const groupBuyingEnabled = isFlagOn('enable_group_buying');
  const platformDeliveryEnabled = isFlagOn('enable_platform_delivery');
  const fullPaymentFreeDelivery = isFlagOn('enable_full_payment_free_delivery', true);
  const productVideosEnabled = isFeatureEnabled('product_videos', { defaultValue: false });
  const referralProgramEnabled = isFlagOn('enable_referral_program');
  const parcelDeliveryEnabled = isFlagOn('enable_parcel_delivery', true);
  const aiRecommendationsEnabled = isFeatureEnabled('enable_ai_recommendations', { defaultValue: false });
  // "Acheter pour moi" and the fast-registration card always render in this
  // section, so it's never empty regardless of the other three flags.
  const hasServicesSection = true;

  const navChips = useMemo(
    () =>
      [
        { id: SECTION_IDS.shopping, label: 'Achat malin' },
        productVideosEnabled ? { id: SECTION_IDS.videos, label: 'Vidéos' } : null,
        { id: SECTION_IDS.payments, label: 'Paiements' },
        { id: SECTION_IDS.protection, label: 'Protection' },
        { id: SECTION_IDS.refunds, label: 'Remboursements' },
        { id: SECTION_IDS.delivery, label: 'Livraison' },
        { id: SECTION_IDS.trust, label: 'Confiance' },
        hasServicesSection ? { id: SECTION_IDS.services, label: 'Autres services' } : null,
        { id: SECTION_IDS.sellers, label: 'Vendeurs' }
      ].filter(Boolean),
    [productVideosEnabled, hasServicesSection]
  );

  return (
    <div className="hd-commerce-shell min-h-screen bg-[#f5f5f5] pb-16 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      {/* ── HERO ── */}
      <section className="bg-white px-4 pb-6 pt-8 text-center dark:bg-neutral-900">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E4] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#e85d00]">
          <ShoppingBagIcon className="h-3 w-3" />
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
          {['Inscription en 1 minute', 'Mobile Money', 'Paiements protégés', 'Pensé pour le Congo'].map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 dark:bg-neutral-950 dark:text-neutral-300"
            >
              <CheckIcon className="text-emerald-600 h-3 w-3" />
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
            icon={Square3Stack3DIcon}
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
              icon={ReceiptPercentIcon}
              title="Prix de gros dégressifs"
              benefit="Plus vous commandez, moins l’unité coûte. Le tarif de gros s’applique tout seul."
              steps={[
                'Repérez les paliers de prix sur la fiche produit',
                'Augmentez la quantité : la remise s’applique automatiquement'
              ]}
            />
          )}
          {groupBuyingEnabled && (
            <FeatureCard
              icon={UsersIcon}
              title="Achat groupé"
              benefit="Formez une équipe avec d’autres acheteurs pour débloquer un prix réduit pour tout le monde. Rejoindre est gratuit : rien n’est payé tant que l’équipe n’est pas complète."
              steps={[
                'Sur une fiche produit, touchez « Démarrer une équipe » — ou rejoignez une équipe en cours',
                'Partagez le lien (WhatsApp…) pour remplir l’équipe avant l’échéance',
                'Équipe complète : le prix groupé se débloque, chacun paie sa commande au tarif réduit',
                'Temps écoulé sans équipe complète ? Rien ne se passe — aucun paiement n’était engagé'
              ]}
              to="/products"
              cta="Explorer les produits"
            />
          )}
          <FeatureCard
            icon={BoltIcon}
            title="Ventes flash & bons plans"
            benefit="Des promotions limitées dans le temps et un classement des meilleures remises, mis à jour en continu."
            steps={['Consultez « Ventes flash » depuis l’accueil', 'Ajoutez au panier avant la fin du compte à rebours']}
            to="/flash-sales"
            cta="Voir les ventes flash"
          />
          <FeatureCard
            icon={HeartIcon}
            title="Favoris & historique"
            benefit="Gardez un œil sur les articles qui vous plaisent et retrouvez ce que vous avez consulté."
            steps={['Touchez le cœur sur un produit', 'Retrouvez tout dans l’onglet Favoris']}
            to="/favorites"
            cta="Mes favoris"
          />
        </div>

        {/* ── VIDÉOS ── */}
        {productVideosEnabled && (
          <>
            <SectionHeader
              id={SECTION_IDS.videos}
              eyebrow="Découvrir"
              title="HDMarket Videos"
              subtitle="Des vidéos courtes pour voir les produits en situation, comme sur vos réseaux préférés."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FeatureCard
                icon={FilmIcon}
                title="Un fil de vidéos produits"
                benefit="Faites défiler des vidéos courtes publiées par les boutiques : le produit en vrai, ses détails et son prix, sans quitter le fil."
                steps={['Ouvrez « Vidéos » depuis le menu ou le pied de page', 'Faites défiler : la lecture est automatique et adaptée à votre connexion']}
                to="/videos"
                cta="Regarder les vidéos"
              />
              <FeatureCard
                icon={ShoppingCartIcon}
                title="Achetez sans quitter la vidéo"
                benefit="Un produit vous plaît ? Ajoutez-le au panier directement depuis la vidéo : si des options sont à choisir, elles s’ouvrent sur place et vous continuez à défiler."
                steps={['Touchez le panier sur la vidéo', 'Choisissez la taille ou la couleur si demandé', 'Le produit est ajouté, la lecture continue']}
              />
              <FeatureCard
                icon={HashtagIcon}
                title="Hashtags, likes et commentaires"
                benefit="Touchez un hashtag pour voir toutes les vidéos du même thème. Likez, commentez et enregistrez celles que vous voulez retrouver."
                steps={['Touchez un #hashtag sous une vidéo', 'Retrouvez vos vidéos enregistrées dans votre profil — elles se relisent à tout moment']}
                to="/profile/saved-videos"
                cta="Mes vidéos enregistrées"
              />
              <FeatureCard
                icon={BellIcon}
                title="Restez informé"
                benefit="Quand vous commandez ou enregistrez depuis une vidéo, une notification confirme l’action et vous tient au courant de la suite."
              />
            </div>
          </>
        )}

        {/* ── PAIEMENTS ── */}
        <SectionHeader
          id={SECTION_IDS.payments}
          eyebrow="Payer"
          title="Payez à votre façon"
          subtitle="Des modes de paiement qu’aucune autre application locale ne réunit."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={ShieldCheckIcon}
            title="Mobile Money vérifié"
            benefit="Payez avec MTN MoMo ou Airtel Money via PawaPay : la confirmation est automatique, sans preuve ni code transaction à recopier."
            steps={[
              'Choisissez votre réseau au moment de payer',
              'Envoyez le paiement et soumettez la référence',
              'Notre équipe vérifie et votre commande démarre'
            ]}
          />
          <FeatureCard
            icon={CalendarDaysIcon}
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
              icon={UsersIcon}
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
            icon={TicketIcon}
            title="Codes promo"
            benefit="Les vendeurs et HDMarket publient des codes de réduction à saisir au moment de payer."
            steps={['Copiez le code promo', 'Collez-le dans le champ dédié au paiement']}
          />
          {fullPaymentFreeDelivery && (
            <FeatureCard
              icon={CheckBadgeIcon}
              title="Comptant récompensé"
              benefit="Payez la totalité d’un coup et profitez d’avantages comme la livraison offerte sur les commandes éligibles."
            />
          )}
        </div>

        {/* ── PROTECTION (ESCROW) ── */}
        <SectionHeader
          id={SECTION_IDS.protection}
          eyebrow="Être protégé"
          title="Votre argent, protégé jusqu’à la réception"
          subtitle="HDMarket conserve le paiement — le vendeur n’est réglé qu’après votre confirmation."
        />
        <section className="mt-4 overflow-hidden rounded-2xl border border-sky-100 bg-white dark:border-sky-950/60 dark:bg-neutral-900">
          <div className="border-b border-sky-100 bg-sky-50 p-4 dark:border-sky-950/60 dark:bg-sky-950/20">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
                <LockClosedIcon strokeWidth={2.3} className="h-[21px] w-[21px]" />
              </span>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Protection HDMarket
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">
                  Dès que vous payez (en une fois, à 70 % ou à 50 %), le montant reste conservé par
                  HDMarket — livraison ou retrait en boutique, peu importe. Le vendeur n’est payé
                  qu’une fois la commande arrivée jusqu’à vous.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            {[
              {
                icon: TruckIcon,
                title: 'Le vendeur livre ou prépare le retrait',
                description:
                  'Une fois la commande remise ou prête en boutique, le vendeur la marque comme « Livrée » ou « Récupérée ». Vous êtes averti aussitôt.'
              },
              {
                icon: CheckCircleIcon,
                title: 'Vous confirmez, ou vous signalez',
                description:
                  'Touchez « Confirmer la réception » si tout va bien — les fonds sont libérés au vendeur immédiatement. Un problème ? Signalez-le avant la libération.'
              },
              {
                icon: ClockIcon,
                title: 'Libération automatique',
                description:
                  'Si vous ne réagissez pas, un compte à rebours (visible dans la commande) libère les fonds tout seul après un court délai — pas besoin d’agir si tout va bien.'
              },
              {
                icon: ShieldExclamationIcon,
                title: 'Litige = fonds bloqués',
                description:
                  'Un problème signalé bloque immédiatement le versement au vendeur. Rien ne bouge tant que le dossier n’est pas résolu.'
              }
            ].map(({ icon: Icon, title, description }, index) => (
              <div
                key={title}
                className="relative border-b border-gray-100 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 dark:border-neutral-800"
              >
                <div className="flex items-start gap-3">
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                    <Icon strokeWidth={2.2} className="h-[17px] w-[17px]" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[9px] font-black text-white">
                      {index + 1}
                    </span>
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">{title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="m-4 rounded-xl bg-gray-50 p-3 dark:bg-neutral-950">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="mt-0.5 flex-shrink-0 text-sky-600 h-[17px] w-[17px]" />
              <p className="text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                <strong className="text-gray-900 dark:text-white">Le délai est réglé par HDMarket</strong>, pas
                par le vendeur — il ne peut ni le raccourcir ni forcer une libération anticipée. Si vous
                payez en partie (70 % ou 50 %), seule la part payée en ligne est protégée de cette façon ;
                le reste réglé en espèces à la livraison reste, comme d’habitude, entre vous et le vendeur.
              </p>
            </div>
          </div>
        </section>

        {/* ── REMBOURSEMENTS ── */}
        <SectionHeader
          id={SECTION_IDS.refunds}
          eyebrow="Être remboursé"
          title="Comment fonctionne un remboursement ?"
          subtitle="Une procédure suivie, du signalement jusqu’au retour des fonds."
        />
        <section className="mt-4 overflow-hidden rounded-2xl border border-orange-100 bg-white dark:border-orange-950/60 dark:bg-neutral-900">
          <div className="border-b border-orange-100 bg-[#FFF8F2] p-4 dark:border-orange-950/60 dark:bg-orange-950/20">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#e85d00] text-white">
                <ArrowUturnLeftIcon strokeWidth={2.3} className="h-[21px] w-[21px]" />
              </span>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Votre remboursement reste traçable
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">
                  Pour une commande payée avec PawaPay, aucun numéro de compte différent n’est
                  demandé : les fonds repartent vers le moyen de paiement Mobile Money d’origine.
                </p>
              </div>
            </div>
          </div>

          <ol className="grid gap-0 sm:grid-cols-2">
            {REFUND_STEPS.map(({ icon: Icon, title, description }, index) => (
              <li
                key={title}
                className="relative border-b border-gray-100 p-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 dark:border-neutral-800"
              >
                <div className="flex items-start gap-3">
                  <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF0E4] text-[#e85d00]">
                    <Icon strokeWidth={2.2} className="h-[17px] w-[17px]" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#e85d00] text-[9px] font-black text-white">
                      {index + 1}
                    </span>
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-gray-900 dark:text-white">{title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                      {description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="m-4 rounded-xl bg-gray-50 p-3 dark:bg-neutral-950">
            <div className="flex items-start gap-2">
              <ClockIcon className="mt-0.5 flex-shrink-0 text-[#e85d00] h-[17px] w-[17px]" />
              <div>
                <p className="text-xs font-black text-gray-900 dark:text-white">
                  Les statuts à connaître
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                  <strong>En cours</strong> : PawaPay traite le retour.{' '}
                  <strong>Confirmé</strong> : le remboursement est terminé.{' '}
                  <strong>Échec</strong> : l’assistance a été alertée et une intervention est
                  nécessaire. Le délai dépend de l’opérateur Mobile Money.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-100 p-4 sm:flex-row dark:border-neutral-800">
            <Link
              to="/reclamations"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white transition active:scale-[0.98]"
            >
              Ouvrir une réclamation
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <Link
              to="/retours-remboursements"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 text-sm font-black text-gray-700 transition hover:border-orange-200 hover:text-[#e85d00] active:scale-[0.98] dark:border-neutral-700 dark:text-neutral-200"
            >
              Lire les conditions
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── LIVRAISON ── */}
        <SectionHeader
          id={SECTION_IDS.delivery}
          eyebrow="Recevoir"
          title="Livraison suivie, ou retrait en boutique"
          subtitle="Vous décidez comment récupérer vos achats — et vous voyez tout."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={TruckIcon}
            title="Livraison ou retrait"
            benefit="Faites-vous livrer, ou passez récupérer en boutique quand ça vous arrange : le choix se fait à la commande."
            steps={['Au paiement, choisissez « Livraison » ou « Retrait en boutique »']}
          />
          {platformDeliveryEnabled && (
            <FeatureCard
              icon={MapPinIcon}
              title="Suivi en temps réel"
              benefit="Suivez votre livreur sur la carte et recevez une preuve de livraison à l’arrivée."
              steps={['Ouvrez le détail de votre commande', 'Touchez le suivi pour voir la position du livreur']}
            />
          )}
          <FeatureCard
            icon={ChatBubbleLeftIcon}
            title="Chat de commande & WhatsApp"
            benefit="Discutez avec le vendeur directement depuis la commande, ou en un tap sur WhatsApp."
            steps={['Dans une commande, ouvrez la conversation', 'Posez vos questions, photos à l’appui']}
          />
          <FeatureCard
            icon={BuildingStorefrontIcon}
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
            icon={CheckBadgeIcon}
            title="Boutiques vérifiées"
            benefit="Le badge « vérifié » signale les vendeurs contrôlés par HDMarket. Repérez-le avant d’acheter."
            to="/shops/verified"
            cta="Voir les boutiques vérifiées"
          />
          <FeatureCard
            icon={StarIcon}
            title="Avis 100 % achats vérifiés"
            benefit="Seuls les acheteurs ayant réellement reçu le produit peuvent le noter ou le commenter : impossible de gonfler — ou de saboter — la réputation d’une boutique avec de faux avis."
            steps={['Consultez les avis en bas de chaque fiche produit', 'Après réception, laissez le vôtre pour aider les autres']}
          />
          <FeatureCard
            icon={ShieldExclamationIcon}
            title="Alertes anti-arnaque dans le chat"
            benefit="Si un message vous demande de payer en dehors de HDMarket, une alerte apparaît directement dans la conversation pour vous rappeler de rester sur le paiement protégé de l’application."
          />
          <FeatureCard
            icon={ShieldCheckIcon}
            title="Réclamations traitées"
            benefit="Un souci avec une commande ? Ouvrez un litige : notre équipe suit le dossier jusqu’à sa résolution."
            steps={['Depuis la commande concernée, ouvrez une réclamation', 'Ajoutez photos et description', 'Suivez la réponse de l’équipe dans vos notifications']}
          />
          <FeatureCard
            icon={WifiIcon}
            title="Conçu pour les connexions lentes"
            benefit="Connexion 3G capricieuse ? L’application garde vos dernières données et met en file vos actions pour les envoyer dès le retour du réseau."
          />
          <FeatureCard
            icon={BellIcon}
            title="Notifications à chaque étape"
            benefit="Paiement validé, commande expédiée, livreur en route : vous êtes prévenu en temps réel."
            to="/notifications"
            cta="Mes notifications"
          />
        </div>

        {/* ── AUTRES SERVICES ── */}
        {hasServicesSection && (
          <>
            <SectionHeader
              id={SECTION_IDS.services}
              eyebrow="Aller plus loin"
              title="Bien plus qu’un marketplace"
              subtitle="Des services pensés pour votre quotidien, au-delà de l’achat classique."
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {referralProgramEnabled && (
                <FeatureCard
                  icon={GiftIcon}
                  title="Parrainage récompensé"
                  benefit="Invitez un proche avec votre code personnel : vous recevez chacun une récompense dès sa première commande livrée."
                  steps={[
                    'Partagez votre code ou votre lien depuis « Parrainage »',
                    'Votre filleul s’inscrit et commande',
                    'Récompense créditée dès la livraison confirmée'
                  ]}
                  to="/referrals"
                  cta="Mon programme de parrainage"
                />
              )}
              {parcelDeliveryEnabled && (
                <FeatureCard
                  icon={BoltIcon}
                  title="Envoyer un colis"
                  benefit="Besoin d’envoyer un document ou un paquet en ville ? Un livreur HDMarket récupère et livre, sans passer par un produit du catalogue."
                  steps={['Indiquez l’adresse de départ et d’arrivée', 'Un livreur est assigné et vous suivez la course', 'Suivez vos courses dans « Mes colis »']}
                  to="/parcels/new"
                  cta="Envoyer un colis"
                />
              )}
              <FeatureCard
                icon={ShoppingBagIcon}
                title="Acheter pour moi"
                benefit="Pas le temps d’aller en boutique ? Décrivez ce qu’il vous faut : un livreur fait les achats à votre place et vous les apporte."
                steps={['Décrivez les articles et le magasin si vous en avez un', 'Un livreur achète et vous livre', 'Suivez la demande dans « Mes demandes »']}
                to="/buy-for-me"
                cta="Faire mes courses"
              />
              {aiRecommendationsEnabled && (
                <FeatureCard
                  icon={SparklesIcon}
                  title="Suggestions personnalisées"
                  benefit="Une sélection « Pour vous », construite à partir de ce que vous consultez et achetez — pour découvrir sans chercher."
                  to="/suggestions"
                  cta="Voir mes suggestions"
                />
              )}
              <FeatureCard
                icon={DevicePhoneMobileIcon}
                title="Inscription en un instant"
                benefit="Créez votre compte avec juste votre numéro de téléphone et un code reçu par SMS — aucune adresse email n’est nécessaire pour acheter, vendre ou payer."
                to="/register"
                cta="Créer mon compte"
              />
            </div>
          </>
        )}

        {/* ── VENDEURS ── */}
        <SectionHeader
          id={SECTION_IDS.sellers}
          eyebrow="Vendre"
          title="Et pour les vendeurs"
          subtitle="Ouvrez votre boutique et développez vos ventes avec de vrais outils."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={BuildingStorefrontIcon}
            title="Votre boutique en ligne"
            benefit="Créez votre boutique, publiez vos produits avec variantes, photos et vidéos, et vendez dans tout le Congo."
            to="/plans"
            cta="Voir les plans"
          />
          {productVideosEnabled && (
            <FeatureCard
              icon={FilmIcon}
              title="Vidéos produit pour les boutiques"
              benefit="Réservé aux comptes Boutique : publiez une vidéo par produit, mise en ligne immédiatement, et suivez vues, complétion et ajouts au panier depuis votre studio."
              steps={[
                'Ouvrez « Mes vidéos produit » dans le menu',
                'Choisissez un produit, envoyez votre vidéo — elle est publiée aussitôt',
                'Suivez ses performances dans le tableau de bord'
              ]}
              to="/seller/videos"
              cta="Mon studio vidéo"
            />
          )}
          <FeatureCard
            icon={RocketLaunchIcon}
            title="Boost de visibilité"
            benefit="Mettez vos produits en avant sur l’accueil et dans les recherches pour toucher plus d’acheteurs."
            steps={['Depuis votre produit, demandez un boost', 'Choisissez la durée, payez, c’est en ligne']}
          />
          <FeatureCard
            icon={ChartBarIcon}
            title="Statistiques de vente"
            benefit="Vues, ventes, meilleurs produits : pilotez votre activité avec des chiffres clairs."
          />
          <FeatureCard
            icon={TicketIcon}
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
    </div>
  );
}
