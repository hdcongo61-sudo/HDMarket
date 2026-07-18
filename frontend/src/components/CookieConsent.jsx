import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie } from 'lucide-react';
import { getPrivacyPreference, setPrivacyPreference } from '../services/privacyPreferences';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(!getPrivacyPreference()), []);
  if (!visible) return null;
  const choose = (value) => { setPrivacyPreference(value); setVisible(false); };
  return <aside className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[80] mx-auto max-w-3xl rounded-2xl border border-neutral-300 bg-white p-4 shadow-sm md:bottom-4" role="dialog" aria-label="Préférences de confidentialité"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#e85d00]"><Cookie className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-black">Votre confidentialité</h2><p className="mt-1 text-xs leading-5 text-neutral-600">Les fonctions essentielles utilisent le stockage local. Avec votre accord, nous utilisons aussi une mesure d’audience pour améliorer HDMarket.</p><Link to="/cookies" className="mt-1 inline-block text-xs font-bold text-[#c2410c] underline">Voir les détails</Link></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => choose('essential')} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-black">Essentiels uniquement</button><button type="button" onClick={() => choose('analytics')} className="min-h-11 rounded-xl bg-[#e85d00] px-4 text-sm font-black text-white">Tout autoriser</button></div></aside>;
}
