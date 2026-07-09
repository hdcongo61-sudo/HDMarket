import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, HelpCircle, Mail, MapPin, Phone, ShieldCheck, Store, Truck } from 'lucide-react';
import { useNetworks } from '../hooks/useNetworks';
import { useAppSettings } from '../context/AppSettingsContext';

export default function Footer() {
  const year = new Date().getFullYear();
  const { t } = useAppSettings();
  const { networks, loading } = useNetworks();
  const activeNetworks = useMemo(
    () => networks.filter((n) => n.isActive).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [networks]
  );
  const supportNetworks = activeNetworks.slice(0, 2);

  const footerLinks = [
    { to: '/', label: t('nav.home', 'Accueil') },
    { to: '/products', label: t('nav.products', 'Produits') },
    { to: '/shops/verified', label: t('nav.verifiedShops', 'Boutiques vérifiées') },
    { to: '/discover', label: t('nav.discover', 'Découvrir') }
  ];

  const serviceLinks = [
    { to: '/avantages', label: t('nav.benefits', 'Pourquoi HDMarket') },
    { to: '/plans', label: t('nav.plans', 'Plans & tarifs') },
    { to: '/help', label: t('footer.help', 'Aide et service client') },
    { to: '/shops/free-delivery', label: t('footer.freeDelivery', 'Livraison offerte') },
    { to: '/top-deals', label: t('footer.deals', 'Bons plans') }
  ];

  return (
    <footer className="hidden md:block border-t border-gray-200 bg-gray-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.85fr_0.85fr_1.1fr]">
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_18px_50px_rgba(17,24,39,0.07)] dark:border-neutral-800 dark:bg-neutral-900">
            <div className="bg-gradient-to-br from-[#ff6a00] via-[#ff7a1a] to-[#f04423] px-6 py-6 text-white">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/75">
                ETS HD Tech Filial
              </p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">HDMarket</h3>
              <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-white/82">
                {t(
                  'footer.brandDescription',
                  'Marketplace premium opérée par ETS HD Tech Filial. Achetez et vendez en toute confiance, partout au Congo.'
                )}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 px-5 py-4">
              {[
                { icon: ShieldCheck, label: 'Paiements suivis' },
                { icon: BadgeCheck, label: 'Boutiques vérifiées' },
                { icon: Truck, label: 'Livraison locale' }
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl bg-gray-100 px-3 py-3 text-center text-[11px] font-bold text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
                  <Icon className="mx-auto mb-1 h-4 w-4 text-[#ff6a00]" />
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_12px_34px_rgba(17,24,39,0.05)] dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="text-sm font-black uppercase tracking-[0.12em] text-neutral-950 dark:text-white">
              {t('footer.navigation', 'Navigation')}
            </h4>
            <ul className="mt-4 space-y-2 text-sm font-semibold">
              {footerLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="group inline-flex items-center gap-2 text-neutral-600 transition hover:text-[#ff6a00] dark:text-neutral-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-200 transition group-hover:bg-[#ff6a00]" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_12px_34px_rgba(17,24,39,0.05)] dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="text-sm font-black uppercase tracking-[0.12em] text-neutral-950 dark:text-white">
              Services
            </h4>
            <ul className="mt-4 space-y-2 text-sm font-semibold">
              {serviceLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="group inline-flex items-center gap-2 text-neutral-600 transition hover:text-[#ff6a00] dark:text-neutral-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-200 transition group-hover:bg-[#ff6a00]" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/help"
              className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ff6a00] px-4 text-sm font-black text-white shadow-[0_12px_26px_rgba(255,106,0,0.24)] transition hover:-translate-y-0.5 hover:bg-[#f05f00]"
            >
              <HelpCircle className="h-4 w-4" />
              {t('footer.contactSupport', 'Contacter le support')}
            </Link>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_12px_34px_rgba(17,24,39,0.05)] dark:border-neutral-800 dark:bg-neutral-900">
            <h4 className="text-sm font-black uppercase tracking-[0.12em] text-neutral-950 dark:text-white">
              {t('footer.support', 'Support')}
            </h4>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 font-semibold dark:bg-neutral-950">
                <Mail size={16} className="text-[#ff6a00]" />
                support@hdmarket.cg
              </p>
              {(supportNetworks.length > 0 ? supportNetworks : [{ _id: 'default', name: 'HDMarket', phoneNumber: '+242 06 000 00 00' }]).map((network) => (
                <p key={network._id || network.phoneNumber} className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 font-semibold dark:bg-neutral-950">
                  <Phone size={16} className="text-[#ff6a00]" />
                  <span>{network.name}: {network.phoneNumber}</span>
                </p>
              ))}
              <p className="flex items-center gap-3 rounded-2xl bg-gray-50 px-3 py-2 font-semibold dark:bg-neutral-950">
                <MapPin size={16} className="text-[#ff6a00]" />
                {t('footer.location', 'Brazzaville, Congo')}
              </p>
            </div>
            {loading ? (
              <p className="mt-3 text-xs font-medium text-neutral-400">Chargement contacts...</p>
            ) : null}
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-xs font-semibold text-neutral-500 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <p>{t('footer.rights', `© ${year} ETS HD Tech Filial — Tous droits réservés.`).replace('{year}', String(year))}</p>
          <p className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[#ff6a00]" />
            {t(
              'footer.tagline',
              'HDMarket, marketplace sécurisée pour les vendeurs et acheteurs congolais.'
            )}
          </p>
          <Link to="/help" className="inline-flex items-center gap-1 font-black text-[#ff6a00] transition hover:text-[#f05f00]">
            Support
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
