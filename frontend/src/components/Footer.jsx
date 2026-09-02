import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon, EnvelopeIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';
import { useNetworks } from '../hooks/useNetworks';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import { useAppSettings } from '../context/AppSettingsContext';

const linkClassName =
  'group inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950';

const contactClassName =
  'group flex min-h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)]';

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

  const exploreLinks = [
    { to: '/', label: t('nav.home', 'Accueil') },
    { to: '/products', label: t('nav.products', 'Produits') },
    { to: '/discover', label: t('nav.discover', 'Découvrir') },
    ...(productVideosEnabled ? [{ to: '/videos', label: t('nav.videos', 'Vidéos') }] : []),
    { to: '/shops/verified', label: t('nav.verifiedShops', 'Boutiques vérifiées') },
    { to: '/buy-for-me', label: t('footer.buyForMe', 'Acheter pour moi') },
    { to: '/parcels/new', label: t('footer.sendParcel', 'Envoyer un colis') },
    { to: '/delivery/apply', label: t('footer.courierApplication', 'Devenir livreur') },
    { to: '/a-propos', label: t('nav.about', 'À propos') }
  ];

  const legalLinks = [
    { to: '/conditions-utilisation', label: 'Conditions d’utilisation' },
    { to: '/confidentialite', label: 'Confidentialité' },
    { to: '/retours-remboursements', label: 'Retours et remboursements' },
    { to: '/mentions-legales', label: 'Mentions légales' }
  ];

  return (
    <footer className="border-t-4 border-[var(--hd-accent)] bg-neutral-950 text-white">
      <div className="mx-auto w-full max-w-5xl px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] pt-6 md:px-6 md:pb-10 md:pt-10 lg:px-8">
        <div className="md:hidden">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-950"
            aria-label={t('nav.home', 'Accueil')}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white p-1.5 shadow-sm">
              <img src={logoSrc} alt="" className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black tracking-[-0.04em]">{appName}</span>
              <span className="mt-px block truncate text-[12.5px] font-medium text-neutral-400">
                Opéré par {companyName}
              </span>
            </span>
          </Link>

          <Link
            to="/help"
            className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--hd-accent)] px-4 text-[15px] font-extrabold text-white transition hover:bg-[var(--hd-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            <SpeakerWaveIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            {t('footer.contactSupport', 'Contacter le support')}
          </Link>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white">{t('footer.explore', 'Explorer')}</p>
            <MobileFooterLinks links={exploreLinks} />
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white">{t('footer.contactAndAddress', 'Contact et adresse')}</p>
            <div className="mt-3 grid gap-2">
              <a href={`mailto:${supportEmail}`} className={contactClassName}>
                <EnvelopeIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                <span className="min-w-0 truncate">{supportEmail}</span>
              </a>

              {supportPhone && normalizePhoneHref(supportPhone) ? (
                <a href={normalizePhoneHref(supportPhone)} className={contactClassName}>
                  <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                  <span className="min-w-0 truncate">{supportPhone}</span>
                </a>
              ) : null}

              {supportNetworks.map((network) => (
                <a key={network._id || `${network.name}-${network.phoneNumber}`} href={normalizePhoneHref(network.phoneNumber)} className={contactClassName}>
                  <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                  <span className="min-w-0 truncate">{network.name ? `${network.name} · ` : ''}{network.phoneNumber}</span>
                </a>
              ))}

              <div className={contactClassName}>
                <MapPinIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                <span>{location}</span>
              </div>

              {loading ? (
                <p className="py-1 text-xs font-medium text-neutral-500" aria-live="polite">
                  {t('footer.loadingContacts', 'Chargement des contacts…')}
                </p>
              ) : null}

              {socialLinks.length ? (
                <div className="flex flex-wrap gap-2 pt-1" aria-label="Réseaux sociaux">
                  {socialLinks.map((item) => (
                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-neutral-300 transition hover:border-white/30 hover:text-white">
                      {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <AppInstallBadges title={t('footer.installApp', 'Installer l’application')} />

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-[18px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-[11.5px] font-bold text-neutral-200" aria-label="Paiements Mobile Money sécurisés via l’API pawaPay">
              <ShieldCheckIcon className="h-[13px] w-[13px] shrink-0 text-emerald-400" aria-hidden="true" />
              Mobile Money sécurisé
            </span>
          </div>

          <nav className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] font-medium text-neutral-400" aria-label={t('footer.legal', 'Légal')}>
            {legalLinks.map((item, index) => (
              <React.Fragment key={item.to}>
                {index > 0 ? <span aria-hidden="true">·</span> : null}
                <Link to={item.to} className="hover:text-white">{item.label}</Link>
              </React.Fragment>
            ))}
          </nav>
          <p className="mt-2 text-[11.5px] font-medium text-neutral-500">© {year} {companyName}</p>
        </div>

        <div className="hidden md:block">
          <div className="grid gap-10 md:grid-cols-3">
            <section aria-labelledby="footer-brand-title">
              <Link
                to="/"
                className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-neutral-950"
                aria-label={t('nav.home', 'Accueil')}
              >
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
                  <img src={logoSrc} alt="" className="h-full w-full object-contain" />
                </span>
                <span id="footer-brand-title" className="text-2xl font-black tracking-[-0.04em]">
                  {appName}
                </span>
              </Link>

              <p className="mt-4 max-w-xs text-sm font-medium leading-6 text-neutral-400">
                Opéré par {companyName}. {location}.
              </p>

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

            <FooterLinkGroup title={t('footer.explore', 'Explorer')} links={exploreLinks}>
              <AppInstallBadges title={t('footer.installApp', 'Installer l’application')} />
            </FooterLinkGroup>

            <section aria-labelledby="footer-support-title">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white" id="footer-support-title">
                {t('footer.support', 'Support')}
              </p>
              <div className="mt-4 grid gap-2">
                <a href={`mailto:${supportEmail}`} className={contactClassName}>
                  <EnvelopeIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                  <span className="min-w-0 truncate">{supportEmail}</span>
                </a>

                {supportPhone && normalizePhoneHref(supportPhone) ? (
                  <a href={normalizePhoneHref(supportPhone)} className={contactClassName}>
                    <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                    <span className="min-w-0 truncate">{supportPhone}</span>
                  </a>
                ) : null}

                {supportNetworks.map((network) => (
                  <a
                    key={network._id || `${network.name}-${network.phoneNumber}`}
                    href={normalizePhoneHref(network.phoneNumber)}
                    className={contactClassName}
                  >
                    <PhoneIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
                    <span className="min-w-0 truncate">
                      {network.name ? `${network.name} · ` : ''}{network.phoneNumber}
                    </span>
                  </a>
                ))}

                <div className={contactClassName}>
                  <MapPinIcon className="h-4 w-4 shrink-0 text-[var(--hd-accent)]" aria-hidden="true" />
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
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--hd-accent)] px-4 text-sm font-black text-white transition hover:bg-[var(--hd-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                <SpeakerWaveIcon className="h-4 w-4" aria-hidden="true" />
                {t('footer.contactSupport', 'Contacter le support')}
                <ArrowUpRightIcon className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {legalLinks.map((item) => <Link key={item.to} to={item.to} className="text-xs font-bold text-neutral-400 hover:text-white">{item.label}</Link>)}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400" aria-label="Paiements Mobile Money sécurisés via l’API pawaPay">
              <ShieldCheckIcon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              Mobile Money sécurisé via pawaPay
            </span>
          </div>
          <p className="mt-4 text-xs font-semibold text-neutral-500">© {year} {companyName} — Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}

function MobileFooterLinks({ links }) {
  return (
    <ul className="mt-3 grid grid-cols-1 gap-0.5">
      {links.map((item) => (
        <li key={item.to}>
          <Link to={item.to} className="group inline-flex min-h-10 w-full items-center gap-2.5 text-sm font-semibold text-neutral-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)]">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--hd-accent)]" />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
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
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--hd-accent)] opacity-70 transition group-hover:opacity-100" />
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
          className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/80 bg-white px-2 py-3 text-center text-neutral-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)]"
          aria-label="Installer HDMarket sur iPhone ou iPad"
        >
          <AppleStoreLogo className="h-7 w-7 shrink-0" />
          <span className="min-w-0 leading-none">
            <span className="block text-[8px] font-bold uppercase tracking-[0.08em] text-neutral-500">
              Installer sur
            </span>
            <span className="mt-1 block text-xs font-black tracking-tight">iPhone / iPad</span>
          </span>
          <ArrowUpRightIcon className="absolute right-2 top-2 h-3.5 w-3.5 text-neutral-400 transition group-hover:text-[var(--hd-accent)]" aria-hidden="true" />
        </Link>

        <Link
          to="/installer-application?platform=android#android-guide"
          className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-neutral-900 px-2 py-3 text-center text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--hd-accent)]"
          aria-label="Installer HDMarket sur Android"
        >
          <GooglePlayLogo className="h-7 w-7 shrink-0" />
          <span className="min-w-0 leading-none">
            <span className="block text-[8px] font-bold uppercase tracking-[0.08em] text-neutral-400">
              Installer sur
            </span>
            <span className="mt-1 block text-xs font-black tracking-tight">Android</span>
          </span>
          <ArrowUpRightIcon className="absolute right-2 top-2 h-3.5 w-3.5 text-neutral-500 transition group-hover:text-[var(--hd-accent)]" aria-hidden="true" />
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
