import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgePercent,
  Check,
  Clock3,
  Crown,
  FilePlus2,
  Globe2,
  Info,
  MapPin,
  Package,
  Rocket,
  ShieldCheck,
  Sparkles,
  Store,
  Truck
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';

const BOOST_META = {
  PRODUCT_BOOST: {
    title: 'Boost produit',
    description: 'Placez une annonce plus haut dans les résultats et augmentez sa visibilité.',
    icon: Rocket
  },
  LOCAL_PRODUCT_BOOST: {
    title: 'Boost produit local',
    description: 'Mettez votre annonce en avant auprès des acheteurs d’une ville précise.',
    icon: MapPin
  },
  SHOP_BOOST: {
    title: 'Boost boutique',
    description: 'Donnez plus de visibilité à toute votre boutique et à votre catalogue.',
    icon: Store
  },
  HOMEPAGE_FEATURED: {
    title: 'À la une',
    description: 'Présentez un produit dans les emplacements premium de la page d’accueil.',
    icon: Crown
  }
};

const PERIOD_LABELS = {
  per_day: '/ jour',
  per_week: '/ semaine',
  fixed: 'paiement unique'
};

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

function PlanCard({ icon: Icon, eyebrow, title, price, suffix, description, features, action, featured }) {
  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-neutral-900 ${
        featured
          ? 'border-orange-300 ring-1 ring-orange-100 dark:border-orange-700 dark:ring-orange-900/40'
          : 'border-gray-200 dark:border-neutral-800'
      }`}
    >
      {featured && (
        <span className="absolute right-4 top-4 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-700 dark:bg-orange-950 dark:text-orange-300">
          Essentiel
        </span>
      )}
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6A00] dark:bg-orange-950/50">
        <Icon size={21} />
      </div>
      <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#FF6A00]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">{title}</h2>
      <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-3xl font-black tracking-tight text-gray-950 dark:text-white">{price}</span>
        {suffix && <span className="pb-1 text-xs font-bold text-gray-500 dark:text-neutral-400">{suffix}</span>}
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-neutral-300">{description}</p>
      <ul className="mt-4 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-neutral-300">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check size={11} strokeWidth={3} />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        to={action.to}
        state={action.state}
        className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black transition active:scale-[0.98] ${
          featured
            ? 'bg-[#FF6A00] text-white hover:bg-[#ef6200]'
            : 'bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200'
        }`}
      >
        {action.label}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export default function Plans() {
  const { user } = useContext(AuthContext);
  const { app, communes, formatPrice, isFeatureEnabled } = useAppSettings();
  const [boostPricing, setBoostPricing] = useState([]);
  const [boostLoading, setBoostLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/boosts/pricing', { skipCache: true })
      .then(({ data }) => {
        if (active) setBoostPricing(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (active) setBoostPricing([]);
      })
      .finally(() => {
        if (active) setBoostLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const commissionRate = toPositiveNumber(app?.commissionRate, 3);
  const configuredConversionAmount = Number(app?.shopConversionAmount);
  const conversionAmount =
    Number.isFinite(configuredConversionAmount) && configuredConversionAmount > 0
      ? configuredConversionAmount
      : 50000;
  const installmentMinPercent = toPositiveNumber(app?.installmentMinPercent, 25);
  const installmentMaxDuration = toPositiveNumber(app?.installmentMaxDuration, 90);
  const boostEnabled = isFeatureEnabled('enable_boost', { defaultValue: true });

  const pricingByType = useMemo(() => {
    return boostPricing.reduce((map, item) => {
      if (!BOOST_META[item?.type]) return map;
      if (!map[item.type]) map[item.type] = [];
      map[item.type].push(item);
      return map;
    }, {});
  }, [boostPricing]);

  const fixedDeliveryFees = useMemo(
    () =>
      (communes || [])
        .filter((item) => item?.deliveryPolicy === 'FIXED_FEE' && Number(item?.fixedFee) >= 0)
        .map((item) => Number(item.fixedFee)),
    [communes]
  );
  const lowestDeliveryFee = fixedDeliveryFees.length ? Math.min(...fixedDeliveryFees) : null;

  const protectedAction = (path, label) =>
    user
      ? { to: path, label }
      : { to: '/login', state: { from: path }, label: 'Se connecter pour continuer' };

  const conversionAction = user?.accountType === 'shop'
    ? { to: '/profile', label: 'Gérer ma boutique' }
    : user
      ? { to: '/shop-conversion-request', label: 'Devenir une boutique' }
      : { to: '/register', label: 'Créer un compte' };

  return (
    <main className="min-h-screen bg-[#f6f7f9] pb-20 text-gray-950 dark:bg-neutral-950 dark:text-white">
      <section className="relative overflow-hidden bg-gray-950 text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-orange-200 backdrop-blur">
            <Sparkles size={14} />
            Plans et tarifs HDMarket
          </span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Tous les services payants, expliqués clairement.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
            Consultez le prix d’une annonce, d’une conversion en boutique, des boosts et des autres frais avant de payer.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-xs font-bold text-gray-200">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><ShieldCheck size={14} /> Prix issus des paramètres de l’application</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Globe2 size={14} /> Tarifs affichés dans votre devise</span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FF6A00]">Commencer à vendre</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Plans principaux</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PlanCard
            icon={FilePlus2}
            eyebrow="Annonce"
            title="Publier un produit"
            price={`${commissionRate.toLocaleString('fr-FR')} %`}
            suffix="du prix de l’annonce"
            description="Les frais de validation sont calculés à partir du prix du produit que vous publiez."
            features={[
              'Calcul automatique avant le paiement',
              'Validation de l’annonce après confirmation',
              'Le montant exact est visible dans le formulaire'
            ]}
            action={protectedAction('/my', 'Créer une annonce')}
            featured
          />
          <PlanCard
            icon={Store}
            eyebrow="Compte professionnel"
            title="Devenir une boutique"
            price={formatPrice(conversionAmount)}
            suffix="paiement unique"
            description="Transformez votre compte en boutique avec une page publique, un logo et des outils professionnels."
            features={[
              'Page boutique personnalisable',
              'Catalogue et statistiques vendeur',
              'Accès aux boosts boutique'
            ]}
            action={conversionAction}
          />
          <PlanCard
            icon={BadgePercent}
            eyebrow="Paiement flexible"
            title="Vente par tranches"
            price={`${installmentMinPercent.toLocaleString('fr-FR')} %`}
            suffix="minimum au départ"
            description="Proposez ou achetez un produit éligible avec un échéancier clair."
            features={[
              `Durée maximale configurée : ${installmentMaxDuration} jours`,
              'Échéances suivies dans l’application',
              'Disponible uniquement sur les produits éligibles'
            ]}
            action={{ to: '/products', label: 'Voir les produits' }}
          />
        </div>

        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FF6A00]">Gagner en visibilité</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Plans Boost</h2>
            </div>
            <p className="max-w-xl text-sm text-gray-500 dark:text-neutral-400">
              Le prix final dépend de la durée, du nombre de produits, de la ville et des campagnes saisonnières actives.
            </p>
          </div>

          {!boostEnabled ? (
            <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Les boosts sont temporairement indisponibles.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(BOOST_META).map(([type, meta]) => {
                const rows = pricingByType[type] || [];
                const prices = rows
                  .map((item) => Number(item.effectiveUnitPrice))
                  .filter((price) => Number.isFinite(price) && price > 0);
                const lowestPrice = prices.length ? Math.min(...prices) : null;
                const primaryPricing = rows.find((item) => !item.city) || rows[0] || null;
                const cityNames = rows.map((item) => item.city).filter(Boolean);
                const Icon = meta.icon;
                const boostAction =
                  type === 'SHOP_BOOST' && user?.accountType !== 'shop'
                    ? conversionAction
                    : user
                      ? { to: '/seller/boosts', label: 'Choisir ce boost' }
                      : {
                          to: '/login',
                          state: { from: '/seller/boosts' },
                          label: 'Se connecter pour continuer'
                        };
                return (
                  <article key={type} className="flex flex-col rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-white dark:bg-white dark:text-neutral-950">
                        <Icon size={20} />
                      </div>
                      {primaryPricing?.campaign && (
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          Tarif saisonnier
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 text-lg font-black">{meta.title}</h3>
                    <p className="mt-2 min-h-16 text-sm leading-6 text-gray-600 dark:text-neutral-300">{meta.description}</p>
                    <div className="mt-4">
                      {boostLoading ? (
                        <div className="h-9 w-32 animate-pulse rounded-xl bg-gray-100 dark:bg-neutral-800" />
                      ) : lowestPrice !== null ? (
                        <>
                          <span className="text-xs font-bold text-gray-500">À partir de </span>
                          <span className="text-2xl font-black">{formatPrice(lowestPrice)}</span>
                          <span className="ml-1 text-xs font-bold text-gray-500">{PERIOD_LABELS[primaryPricing?.priceType] || ''}</span>
                        </>
                      ) : (
                        <span className="text-lg font-black text-gray-700 dark:text-neutral-200">Tarif sur demande</span>
                      )}
                    </div>
                    {cityNames.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500">Tarifs locaux : {cityNames.join(', ')}</p>
                    )}
                    <Link
                      to={boostAction.to}
                      state={boostAction.state}
                      className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-50 px-3 text-xs font-black text-[#FF6A00] transition hover:bg-orange-100 dark:bg-orange-950/40"
                    >
                      {boostAction.label} <ArrowRight size={14} />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-14 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              <Info size={20} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">Autres paiements</p>
              <h2 className="text-xl font-black">Frais variables à connaître</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="flex gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-neutral-950">
              <Truck className="mt-0.5 shrink-0 text-[#FF6A00]" size={20} />
              <div>
                <p className="font-black">Livraison</p>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-neutral-300">
                  {lowestDeliveryFee !== null
                    ? `À partir de ${formatPrice(lowestDeliveryFee)} selon la commune, la distance et le mode de livraison.`
                    : 'Le prix dépend de la commune, de la distance et du mode de livraison. Certaines zones peuvent être gratuites.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl bg-gray-50 p-4 dark:bg-neutral-950">
              <Package className="mt-0.5 shrink-0 text-[#FF6A00]" size={20} />
              <div>
                <p className="font-black">Achat d’un produit</p>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-neutral-300">
                  Le prix est fixé par le vendeur. Les frais de livraison et les réductions sont affichés avant la confirmation de commande.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-xs leading-5 text-gray-500 dark:border-neutral-800 dark:text-neutral-400">
            <Clock3 size={15} className="mt-0.5 shrink-0" />
            Les montants peuvent évoluer lorsque l’administration met à jour les tarifs. Le montant affiché sur l’écran de confirmation au moment du paiement fait foi.
          </div>
        </section>
      </div>
    </main>
  );
}
