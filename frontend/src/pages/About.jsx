import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BuildingStorefrontIcon, ChevronRightIcon, CreditCardIcon, CubeIcon, EnvelopeIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, ShoppingBagIcon, SparklesIcon, TruckIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { useAppSettings } from '../context/AppSettingsContext';
import useAppBrandLogo from '../hooks/useAppBrandLogo';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import GlassHeader from '../components/orders/GlassHeader';

export default function About() {
  const { app } = useAppSettings();
  const { logoSrc } = useAppBrandLogo();
  const externalLinkProps = useDesktopExternalLink();
  const information = app?.information || {};

  const appName = String(information.appName || 'HDMarket');
  const companyName = String(information.companyName || 'ETS HD Tech Filial');
  const tagline = String(
    information.tagline || 'Marketplace sécurisée pour les vendeurs et acheteurs congolais.'
  );
  const description = String(
    information.description ||
      'Achetez et vendez en toute confiance, envoyez des colis et faites livrer vos courses, partout au Congo.'
  );
  const supportEmail = String(information.supportEmail || 'support@hdmarket.cg');
  const supportPhone = String(information.supportPhone || '').trim();
  const location = [information.city, information.country].filter(Boolean).join(', ') || 'Brazzaville, Congo';

  const [buyForMeEnabled, setBuyForMeEnabled] = useState(false);
  const [parcelDeliveryEnabled, setParcelDeliveryEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get('/buy-for-me/capabilities')
      .then(({ data }) => {
        if (active) setBuyForMeEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (active) setBuyForMeEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get('/parcels/capabilities')
      .then(({ data }) => {
        if (active) setParcelDeliveryEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        if (active) setParcelDeliveryEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const features = useMemo(() => {
    const list = [
      {
        key: 'marketplace',
        icon: ShoppingBagIcon,
        color: 'bg-[#e85d00]',
        title: 'Achetez et vendez',
        description: 'Des milliers de produits et boutiques vérifiées, partout au Congo.',
        to: '/products'
      }
    ];
    if (parcelDeliveryEnabled) {
      list.push({
        key: 'parcels',
        icon: TruckIcon,
        color: 'bg-sky-600',
        title: 'Envoyer un colis',
        description: 'Course à la demande : un livreur récupère et livre où vous voulez.',
        to: '/parcels/new'
      });
    }
    if (buyForMeEnabled) {
      list.push({
        key: 'buy-for-me',
        icon: ShoppingBagIcon,
        color: 'bg-violet-600',
        title: 'Acheter Pour Moi',
        description: 'Un livreur fait vos achats dans un magasin et vous les livre.',
        to: '/buy-for-me'
      });
    }
    list.push(
      {
        key: 'installments',
        icon: CreditCardIcon,
        color: 'bg-neutral-800',
        title: 'Paiement en plusieurs fois',
        description: 'Payez certains produits progressivement, plus de flexibilité.',
        to: '/products?installmentOnly=true'
      },
      {
        key: 'wholesale',
        icon: CubeIcon,
        color: 'bg-emerald-700',
        title: 'Vente en gros',
        description: 'Des tarifs dégressifs pour les achats en grande quantité.',
        to: '/products?wholesaleOnly=true'
      },
      {
        key: 'verified-shops',
        icon: ShieldCheckIcon,
        color: 'bg-neutral-900',
        title: 'Boutiques vérifiées',
        description: 'Achetez en confiance auprès de vendeurs identifiés par HDMarket.',
        to: '/shops/verified'
      }
    );
    return list;
  }, [buyForMeEnabled, parcelDeliveryEnabled]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24 dark:bg-neutral-950">
      <GlassHeader title="À propos" backTo="/" />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <section className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-100 dark:bg-neutral-800 dark:ring-neutral-700">
            <img src={logoSrc} alt="" className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{appName}</h1>
          <p className="mt-1 text-sm font-bold text-[#e85d00]">{tagline}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-neutral-300">
            {description}
          </p>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
          <h2 className="border-l-[3px] border-[#e85d00] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
            Ce que vous pouvez faire sur {appName}
          </h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {features.map((feature) => (
              <Link
                key={feature.key}
                to={feature.to}
                {...externalLinkProps}
                className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 transition hover:-translate-y-0.5 hover:border-gray-200 dark:border-neutral-800 dark:bg-neutral-800/60"
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white ${feature.color}`}>
                  <feature.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-gray-900 dark:text-white">{feature.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-gray-500 dark:text-neutral-400">
                    {feature.description}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-gray-500 dark:text-neutral-600" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-6">
          <h2 className="border-l-[3px] border-[#e85d00] pl-2.5 text-sm font-black text-gray-900 dark:text-white">
            Qui sommes-nous
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-neutral-300">
            {appName} est une marketplace opérée par {companyName}, pensée pour la découverte rapide de produits,
            la vente en toute sécurité et une livraison adaptée au Congo — paiement Mobile Money, boutiques
            vérifiées et service client réactif.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm font-semibold text-gray-700 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200">
              <MapPinIcon className="h-4 w-4 shrink-0 text-[#e85d00]" />
              <span className="truncate">{location}</span>
            </div>
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-200 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200"
            >
              <EnvelopeIcon className="h-4 w-4 shrink-0 text-[#e85d00]" />
              <span className="truncate">{supportEmail}</span>
            </a>
            {supportPhone ? (
              <a
                href={`tel:${supportPhone.replace(/[^+\d]/g, '')}`}
                className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-200 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200"
              >
                <PhoneIcon className="h-4 w-4 shrink-0 text-[#e85d00]" />
                <span className="truncate">{supportPhone}</span>
              </a>
            ) : null}
            <Link
              to="/shop-conversion-request"
              className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-200 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200"
            >
              <BuildingStorefrontIcon className="h-4 w-4 shrink-0 text-[#e85d00]" />
              Devenir vendeur
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-2.5 sm:flex-row">
          <Link
            to="/avantages"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#e85d00] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#c94f00]"
          >
            <SparklesIcon className="h-4 w-4" />
            Voir tous les avantages
          </Link>
          <Link
            to="/mentions-legales"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 text-sm font-black text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            Mentions légales
          </Link>
        </section>
      </div>
    </div>
  );
}
