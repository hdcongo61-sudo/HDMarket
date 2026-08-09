import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  Headphones,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Truck
} from 'lucide-react';
import { useNetworks } from '../hooks/useNetworks';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import { useAppSettings } from '../context/AppSettingsContext';

const linkClassName =
  'group inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d00] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950';

const contactClassName =
  'group flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d00]';

const normalizePhoneHref = (value) => {
  const digits = String(value ?? '').replace(/[^+\d]/g, '');
  return digits ? `tel:${digits}` : '';
};
const normalizeExternalUrl = (value = '') => {
  try {
    const url = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export default function Footer() {
  const year = new Date().getFullYear();
  const { t, app, isFeatureEnabled } = useAppSettings();
  const productVideosEnabled = isFeatureEnabled('product_videos', { defaultValue: false });
  const appInformation = app?.information || {};
  const appName = String(appInformation.appName || 'HDMarket');
  const companyName = String(appInformation.companyName || 'ETS HD Tech Filial');
  const supportEmail = String(appInformation.supportEmail || 'support@hdmarket.cg');
  const supportPhone = String(appInformation.supportPhone || '').trim();
  const location = [appInformation.city, appInformation.country].filter(Boolean).join(', ') || 'Brazzaville, Congo';
  const brandDescription = String(
    appInformation.description || `Marketplace opérée par ${companyName}. Achetez et vendez en toute confiance, envoyez des colis et faites livrer vos courses, partout au Congo.`
  );
  const tagline = String(appInformation.tagline || 'Marketplace sécurisée pour les vendeurs et acheteurs congolais.');
  const website = normalizeExternalUrl(appInformation.website);
  const socialLinks = [
    ['Facebook', appInformation.facebook],
    ['Instagram', appInformation.instagram],
    ['TikTok', appInformation.tiktok],
    ['YouTube', appInformation.youtube],
    ['LinkedIn', appInformation.linkedin]
  ].map(([label, value]) => ({ label, href: normalizeExternalUrl(value) })).filter((item) => item.href);
  const { logoSrc } = useAppBrandLogo();
  const { networks, loading } = useNetworks();
  const supportNetworks = useMemo(
    () =>
      networks
        .filter((network) => network.isActive && normalizePhoneHref(network.phoneNumber))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(0, 2),
    [networks]
  );

  const navigationLinks = [
    { to: '/', label: t('nav.home', 'Accueil') },
    { to: '/products', label: t('nav.products', 'Produits') },
    { to: '/discover', label: t('nav.discover', 'Découvrir') },
    ...(productVideosEnabled ? [{ to: '/videos', label: t('nav.videos', 'Vidéos') }] : []),
    { to: '/shops/verified', label: t('nav.verifiedShops', 'Boutiques vérifiées') },
    { to: '/a-propos', label: t('nav.about', 'À propos') }
  ];

  const serviceLinks = [
    { to: '/avantages', label: t('nav.benefits', 'Pourquoi HDMarket') },
    { to: '/plans', label: t('nav.plans', 'Plans & tarifs') },
    ...(productVideosEnabled
      ? [
          { to: '/profile/saved-videos', label: t('footer.savedVideos', 'Vidéos enregistrées') },
          { to: '/seller/videos', label: t('footer.sellerVideos', 'Mes vidéos produit') }
        ]
      : []),
    { to: '/buy-for-me', label: t('footer.buyForMe', 'Acheter pour moi') },
    { to: '/buy-for-me/orders', label: t('footer.myBuyForMe', 'Mes achats délégués') },
    { to: '/parcels/new', label: t('footer.sendParcel', 'Envoyer un colis') },
    { to: '/parcels', label: t('footer.myParcels', 'Mes colis') },
    { to: '/delivery/apply', label: t('footer.courierApplication', 'Devenir livreur') },
    { to: '/shops/free-delivery', label: t('footer.freeDelivery', 'Livraison offerte') },
    { to: '/top-deals', label: t('footer.deals', 'Bons plans') }
  ];

  const legalLinks = [
    { to: '/conditions-utilisation', label: 'Conditions d’utilisation' },
    { to: '/conditions-vente', label: 'Conditions de vente' },
    { to: '/confidentialite', label: 'Confidentialité' },
    { to: '/retours-remboursements', label: 'Retours et remboursements' },
    { to: '/mentions-legales', label: 'Mentions légales' },
    { to: '/cookies', label: 'Cookies' }
  ];

  const trustItems = [
    { icon: ShieldCheck, label: t('footer.paymentsTracked', 'Paiements suivis') },
    { icon: BadgeCheck, label: t('footer.verifiedShops', 'Boutiques vérifiées') },
    { icon: Truck, label: t('footer.localDelivery', 'Livraison locale') }
  ];

  return (
    <footer className="border-t-4 border-[#e85d00] bg-neutral-950 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] pt-10 sm:px-6 md:pb-10 md:pt-12 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.35fr_0.7fr_0.8fr_1.25fr] lg:gap-8">
          <section aria-labelledby="footer-brand-title" className="max-w-md">
            <Link
              to="/"
              className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d00] focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-950"
              aria-label={t('nav.home', 'Accueil')}
            >
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
                <img src={logoSrc} alt="" className="h-full w-full object-contain" />
              </span>
              <span id="footer-brand-title" className="text-2xl font-black tracking-[-0.04em]">
                {appName}
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm font-medium leading-6 text-neutral-400">
              {brandDescription}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3" aria-label={t('footer.trust', 'Nos engagements')}>
              {trustItems.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-200">
                  <Icon className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
            {socialLinks.length ? (
              <div className="mt-5 flex flex-wrap gap-2" aria-label="Réseaux sociaux">
                {socialLinks.map((item) => (
                  <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-neutral-300 transition hover:border-white/30 hover:text-white">
                    {item.label}
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <FooterLinkGroup
            title={t('footer.navigation', 'Navigation')}
            links={navigationLinks}
          />

          <FooterLinkGroup
            title={t('footer.services', 'Services')}
            links={serviceLinks}
          >
            <AppInstallBadges title={t('footer.installApp', 'Installer l’application')} />
          </FooterLinkGroup>

          <section aria-labelledby="footer-support-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white" id="footer-support-title">
              {t('footer.support', 'Support')}
            </p>
            <div className="mt-4 grid gap-2">
              <a href={`mailto:${supportEmail}`} className={contactClassName}>
                <Mail className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                <span className="min-w-0 truncate">{supportEmail}</span>
              </a>

              {supportPhone && normalizePhoneHref(supportPhone) ? (
                <a href={normalizePhoneHref(supportPhone)} className={contactClassName}>
                  <Phone className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                  <span className="min-w-0 truncate">{supportPhone}</span>
                </a>
              ) : null}

              {website ? (
                <a href={website} target="_blank" rel="noreferrer" className={contactClassName}>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                  <span className="min-w-0 truncate">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                </a>
              ) : null}

              {supportNetworks.map((network) => (
                <a
                  key={network._id || `${network.name}-${network.phoneNumber}`}
                  href={normalizePhoneHref(network.phoneNumber)}
                  className={contactClassName}
                >
                  <Phone className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                  <span className="min-w-0 truncate">
                    {network.name ? `${network.name} · ` : ''}{network.phoneNumber}
                  </span>
                </a>
              ))}

              <div className={contactClassName}>
                <MapPin className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                <span>{location}</span>
              </div>
            </div>

            {loading ? (
              <p className="mt-2 text-xs font-medium text-neutral-500" aria-live="polite">
                {t('footer.loadingContacts', 'Chargement des contacts…')}
              </p>
            ) : null}

            <Link
              to="/help"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white transition hover:bg-[#ff6a00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 sm:w-auto lg:w-full"
            >
              <Headphones className="h-4 w-4" aria-hidden="true" />
              {t('footer.contactSupport', 'Contacter le support')}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 md:mt-12">
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-3">
            {legalLinks.map((item) => <Link key={item.to} to={item.to} className="text-xs font-bold text-neutral-400 hover:text-white">{item.label}</Link>)}
          </div>
          <div className="mb-5 flex">
            <div
              className="inline-flex min-h-12 w-full items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-2.5 sm:w-auto"
              aria-label="Paiements Mobile Money sécurisés via l’API pawaPay"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" aria-hidden="true" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                  Paiement Mobile Money
                </span>
                <span className="mt-0.5 block text-xs font-bold text-neutral-200">
                  Sécurisé via l’API <span className="text-emerald-400">pawaPay</span>
                </span>
              </span>
              <span className="ml-auto rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400 sm:ml-2">
                API
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-xs font-semibold text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {companyName} — Tous droits réservés.
            </p>
            <p className="inline-flex items-center gap-2 text-neutral-400">
              <ShoppingBag className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
              {appName}, {tagline}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ title, links, children = null }) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white">{title}</p>
      <ul className="mt-4 grid grid-cols-1 gap-1">
        {links.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className={linkClassName}>
              <span className="h-1.5 w-1.5 rounded-full bg-[#e85d00] opacity-70 transition group-hover:opacity-100" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

function AppInstallBadges({ title }) {
  return (
    <div className="mt-6 border-t border-white/10 pt-5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
        {title}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2" aria-label={title}>
        <Link
          to="/installer-application?platform=ios#ios-guide"
          className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/80 bg-white px-2 py-3 text-center text-neutral-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d00]"
          aria-label="Installer HDMarket sur iPhone ou iPad"
        >
          <AppleStoreLogo className="h-7 w-7 shrink-0" />
          <span className="min-w-0 leading-none">
            <span className="block text-[8px] font-bold uppercase tracking-[0.08em] text-neutral-500">
              Installer sur
            </span>
            <span className="mt-1 block text-xs font-black tracking-tight">iPhone / iPad</span>
          </span>
          <ArrowUpRight className="absolute right-2 top-2 h-3.5 w-3.5 text-neutral-400 transition group-hover:text-[#e85d00]" aria-hidden="true" />
        </Link>

        <Link
          to="/installer-application?platform=android#android-guide"
          className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-neutral-900 px-2 py-3 text-center text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e85d00]"
          aria-label="Installer HDMarket sur Android"
        >
          <GooglePlayLogo className="h-7 w-7 shrink-0" />
          <span className="min-w-0 leading-none">
            <span className="block text-[8px] font-bold uppercase tracking-[0.08em] text-neutral-400">
              Installer sur
            </span>
            <span className="mt-1 block text-xs font-black tracking-tight">Android</span>
          </span>
          <ArrowUpRight className="absolute right-2 top-2 h-3.5 w-3.5 text-neutral-500 transition group-hover:text-[#ff6a00]" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function AppleStoreLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M17.05 12.54c-.02-2.22 1.81-3.3 1.89-3.35a4.05 4.05 0 0 0-3.19-1.73c-1.34-.14-2.65.8-3.33.8-.7 0-1.76-.78-2.9-.76a4.24 4.24 0 0 0-3.57 2.18c-1.55 2.69-.39 6.65 1.09 8.82.74 1.06 1.6 2.24 2.74 2.2 1.12-.05 1.54-.71 2.89-.71 1.34 0 1.73.71 2.9.68 1.2-.02 1.96-1.06 2.67-2.13a8.8 8.8 0 0 0 1.22-2.48 3.85 3.85 0 0 1-2.41-3.52Z" />
      <path d="M14.87 6.04a3.87 3.87 0 0 0 .89-2.79 3.94 3.94 0 0 0-2.56 1.33 3.7 3.7 0 0 0-.91 2.68 3.26 3.26 0 0 0 2.58-1.22Z" />
    </svg>
  );
}

function GooglePlayLogo({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#00d7fe" d="M3.45 2.42A1.8 1.8 0 0 0 3 3.65v16.7c0 .47.16.9.45 1.23L13.3 12 3.45 2.42Z" />
      <path fill="#00f076" d="m13.3 12 3.27-3.18L5.1 2.2a1.72 1.72 0 0 0-1.65.22L13.3 12Z" />
      <path fill="#ffea00" d="m20.08 10.86-3.51-2.04L13.3 12l3.27 3.18 3.53-2.05c1.02-.6 1.02-1.68-.02-2.27Z" />
      <path fill="#ff3a44" d="m3.45 21.58 9.85-9.58 3.27 3.18-11.5 6.66a1.72 1.72 0 0 1-1.62-.26Z" />
    </svg>
  );
}
