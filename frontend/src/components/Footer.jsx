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

const normalizePhoneHref = (value = '') => `tel:${String(value).replace(/[^+\d]/g, '')}`;

export default function Footer() {
  const year = new Date().getFullYear();
  const { t } = useAppSettings();
  const { logoSrc } = useAppBrandLogo();
  const { networks, loading } = useNetworks();
  const supportNetworks = useMemo(
    () =>
      networks
        .filter((network) => network.isActive && network.phoneNumber)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .slice(0, 2),
    [networks]
  );

  const navigationLinks = [
    { to: '/', label: t('nav.home', 'Accueil') },
    { to: '/products', label: t('nav.products', 'Produits') },
    { to: '/discover', label: t('nav.discover', 'Découvrir') },
    { to: '/shops/verified', label: t('nav.verifiedShops', 'Boutiques vérifiées') }
  ];

  const serviceLinks = [
    { to: '/avantages', label: t('nav.benefits', 'Pourquoi HDMarket') },
    { to: '/plans', label: t('nav.plans', 'Plans & tarifs') },
    { to: '/shops/free-delivery', label: t('footer.freeDelivery', 'Livraison offerte') },
    { to: '/top-deals', label: t('footer.deals', 'Bons plans') }
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
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                <img src={logoSrc} alt="" className="h-full w-full object-contain" />
              </span>
              <span id="footer-brand-title" className="text-2xl font-black tracking-[-0.04em]">
                HDMarket
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm font-medium leading-6 text-neutral-400">
              {t(
                'footer.brandDescription',
                'Marketplace premium opérée par ETS HD Tech Filial. Achetez et vendez en toute confiance, partout au Congo.'
              )}
            </p>

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3" aria-label={t('footer.trust', 'Nos engagements')}>
              {trustItems.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-xs font-bold text-neutral-200">
                  <Icon className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </section>

          <FooterLinkGroup
            title={t('footer.navigation', 'Navigation')}
            links={navigationLinks}
          />

          <FooterLinkGroup
            title={t('footer.services', 'Services')}
            links={serviceLinks}
          />

          <section aria-labelledby="footer-support-title">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-white" id="footer-support-title">
              {t('footer.support', 'Support')}
            </p>
            <div className="mt-4 grid gap-2">
              <a href="mailto:support@hdmarket.cg" className={contactClassName}>
                <Mail className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
                <span className="min-w-0 truncate">support@hdmarket.cg</span>
              </a>

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
                <span>{t('footer.location', 'Brazzaville, Congo')}</span>
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
          <div className="flex flex-col gap-3 text-xs font-semibold text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {t('footer.rights', `© ${year} ETS HD Tech Filial — Tous droits réservés.`).replace(
                '{year}',
                String(year)
              )}
            </p>
            <p className="inline-flex items-center gap-2 text-neutral-400">
              <ShoppingBag className="h-4 w-4 shrink-0 text-[#ff6a00]" aria-hidden="true" />
              {t('footer.tagline', 'HDMarket, marketplace sécurisée pour les vendeurs et acheteurs congolais.')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ title, links }) {
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
    </section>
  );
}
