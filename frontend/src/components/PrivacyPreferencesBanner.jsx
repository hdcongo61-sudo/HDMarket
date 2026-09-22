import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getPrivacyPreference, setPrivacyPreference, subscribePrivacyPreference } from '../services/privacyPreferences';

export default function PrivacyPreferencesBanner() {
  const [visible, setVisible] = useState(() => !getPrivacyPreference());
  const { pathname } = useLocation();
  useEffect(() => subscribePrivacyPreference(() => setVisible(!getPrivacyPreference())), []);
  if (!visible || pathname === '/cookies') return null;
  const buttonClass = 'min-h-11 rounded-xl border border-neutral-500 bg-white px-4 py-2 text-sm font-bold text-neutral-900 hover:bg-orange-50';
  return <aside className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[80] mx-auto max-h-[60dvh] max-w-3xl overflow-y-auto rounded-2xl border border-neutral-300 bg-white p-4 text-neutral-900 shadow-lg md:bottom-4" aria-labelledby="privacy-banner-title">
    <h2 id="privacy-banner-title" className="font-black">Votre confidentialité</h2>
    <p className="mt-1 text-sm leading-6 text-neutral-700">Le stockage essentiel permet la connexion et le panier. Avec votre accord, nous activons les statistiques d’utilisation et le diagnostic des erreurs. Refuser n’empêche pas d’utiliser HDMarket.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      <button type="button" onClick={() => setPrivacyPreference('essential')} className={buttonClass}>Tout refuser</button>
      <button type="button" onClick={() => setPrivacyPreference({ analytics: true, diagnostics: true })} className={buttonClass}>Tout autoriser</button>
      <Link to="/cookies" className={`${buttonClass} inline-flex items-center justify-center underline`}>Personnaliser</Link>
    </div>
    <p className="mt-2 text-xs leading-5 text-neutral-600">Modifiable à tout moment depuis « Cookies et confidentialité » en bas de page. <Link to="/confidentialite" className="font-bold text-[#9a3412] underline">Politique de confidentialité</Link></p>
  </aside>;
}
