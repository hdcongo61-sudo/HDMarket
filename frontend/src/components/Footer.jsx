import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
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

  return (
    <footer className="hidden md:block bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-indigo-400 uppercase tracking-widest">
            ETS HD Tech Filial
          </p>
          <h3 className="mt-2 text-xl font-bold text-white">HDMarket</h3>
          <p className="mt-3 text-sm text-gray-400">
            {t(
              'footer.brandDescription',
              'Marketplace premium opérée par ETS HD Tech Filial. Achetez et vendez en toute confiance, partout au Congo.'
            )}
          </p>
        </div>

        <div>
          <h4 className="text-base font-semibold text-white">{t('footer.navigation', 'Navigation')}</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-white">
                {t('nav.home', 'Accueil')}
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-white">
                {t('nav.products', 'Produits')}
              </Link>
            </li>
            <li>
              <Link to="/top-deals" className="hover:text-white">
                {t('footer.deals', 'Bons plans')}
              </Link>
            </li>
            <li>
              <Link to="/help" className="hover:text-white">
                {t('footer.help', 'Aide et service client')}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-base font-semibold text-white">{t('footer.support', 'Support')}</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail size={16} className="text-indigo-400" />
              support@hdmarket.cg
            </li>
            {activeNetworks.length > 0 ? (
              activeNetworks.map((network) => (
                <li key={network._id} className="flex items-center gap-2">
                  <Phone size={16} className="text-indigo-400" />
                  <span>{network.name}: {network.phoneNumber}</span>
                </li>
              ))
            ) : (
              <li className="flex items-center gap-2">
                <Phone size={16} className="text-indigo-400" />
                +242 06 000 00 00
              </li>
            )}
            <li className="flex items-center gap-2">
              <MapPin size={16} className="text-indigo-400" />
              {t('footer.location', 'Brazzaville, Congo')}
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-base font-semibold text-white">{t('footer.community', 'Communauté')}</h4>
          <p className="mt-3 text-sm text-gray-400">
            {t(
              'footer.communityDescription',
              'Rejoignez les vendeurs et acheteurs professionnels accompagnés par ETS HD Tech Filial.'
            )}
          </p>
          <Link
            to="/help"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {t('footer.contactSupport', 'Contacter le support')}
          </Link>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.rights', `© ${year} ETS HD Tech Filial — Tous droits réservés.`).replace('{year}', String(year))}</p>
          <p>
            {t(
              'footer.tagline',
              'HDMarket, marketplace sécurisée pour les vendeurs et acheteurs congolais.'
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
