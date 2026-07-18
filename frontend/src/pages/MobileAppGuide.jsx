import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, CheckCircle2, ChevronRight, Download, ExternalLink, Home,
  MoreVertical, RefreshCw, Share, ShieldCheck, ShoppingBag, Smartphone
} from 'lucide-react';
import pwaInstallService from '../services/pwaInstallService';

export const detectMobilePlatform = (userAgent = '') => {
  const value = String(userAgent).toLowerCase();
  if (/iphone|ipad|ipod/.test(value)) return 'ios';
  if (/android/.test(value)) return 'android';
  return 'other';
};

const IOS_STEPS = [
  { title: 'Ouvrez HDMarket dans Safari', text: 'Saisissez www.hdmarket.store dans Safari. Cette option n’est pas disponible depuis certains navigateurs intégrés.' },
  { title: 'Touchez le bouton Partager', text: 'Le bouton est représenté par un carré avec une flèche orientée vers le haut.' },
  { title: 'Choisissez « Sur l’écran d’accueil »', text: 'Faites défiler la feuille de partage si cette option n’apparaît pas immédiatement.' },
  { title: 'Activez « Ouvrir comme app »', text: 'Cette option permet à HDMarket de s’ouvrir en plein écran, comme une application.' },
  { title: 'Touchez « Ajouter »', text: 'L’icône HDMarket apparaît sur votre écran d’accueil comme une application.' }
];

const ANDROID_STEPS = [
  { title: 'Ouvrez HDMarket dans Chrome', text: 'Accédez à www.hdmarket.store avec Google Chrome sur votre téléphone Android.' },
  { title: 'Ouvrez le menu Chrome', text: 'Touchez les trois points situés en haut à droite du navigateur.' },
  { title: 'Choisissez « Ajouter à l’écran d’accueil »', text: 'Chrome affiche ensuite l’option permettant d’installer l’application web.' },
  { title: 'Confirmez avec « Installer »', text: 'HDMarket est ensuite disponible depuis votre écran d’accueil et votre liste d’applications.' }
];

export default function MobileAppGuide() {
  const platform = useMemo(() => detectMobilePlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent), []);
  const [activePlatform, setActivePlatform] = useState(platform === 'ios' ? 'ios' : 'android');
  const [canInstall, setCanInstall] = useState(pwaInstallService.canInstall());
  const [installed, setInstalled] = useState(pwaInstallService.isInstalled());
  const [installMessage, setInstallMessage] = useState('');

  useEffect(() => pwaInstallService.subscribe(setCanInstall), []);

  const installAndroid = async () => {
    const result = await pwaInstallService.requestInstall();
    if (result.outcome === 'accepted') {
      setInstalled(true);
      setInstallMessage('HDMarket a été ajouté à votre téléphone.');
    } else if (result.outcome === 'unavailable') {
      setInstallMessage('Suivez les étapes Chrome ci-dessous pour ajouter HDMarket.');
    }
  };

  const scrollToGuide = (target) => {
    setActivePlatform(target);
    window.setTimeout(() => document.getElementById(`${target}-guide`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="min-h-screen bg-[#fffaf5] text-[#221f1b]">
      <section className="border-b border-black/10 bg-[#201f1d] px-4 py-12 text-white sm:px-6 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[.12em]"><Smartphone className="h-4 w-4 text-[#ff7a22]" />HDMarket sur votre téléphone</span>
            <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight tracking-[-.035em] sm:text-5xl">Ajouter HDMarket à l’écran d’accueil</h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 text-white/70 sm:text-lg">Suivez les instructions Safari pour iPhone ou Chrome pour Android. Aucun téléchargement externe n’est nécessaire.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {installed ? <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 text-sm font-black"><CheckCircle2 className="h-5 w-5" />Application déjà installée</span> : canInstall ? <button type="button" onClick={installAndroid} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-sm font-black text-white shadow-sm"><Download className="h-5 w-5" />Installer HDMarket</button> : <button type="button" onClick={() => scrollToGuide(platform === 'ios' ? 'ios' : 'android')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#e85d00] px-5 text-sm font-black text-white shadow-sm"><ChevronRight className="h-5 w-5" />Voir les étapes</button>}
              <button type="button" onClick={() => scrollToGuide('ios')} className="min-h-12 rounded-2xl border border-white/20 px-5 text-sm font-black text-white">Instructions iPhone</button>
            </div>
            {installMessage ? <p className="mt-4 text-sm font-bold text-[#ffb17d]" aria-live="polite">{installMessage}</p> : null}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
        <section aria-labelledby="platform-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#c34d00]">Guide pas à pas</p><h2 id="platform-title" className="mt-2 text-3xl font-black tracking-[-.035em]">Choisissez votre téléphone</h2></div><div className="inline-flex rounded-2xl bg-[#eee7de] p-1"><PlatformButton active={activePlatform === 'ios'} onClick={() => setActivePlatform('ios')}>iPhone / iPad</PlatformButton><PlatformButton active={activePlatform === 'android'} onClick={() => setActivePlatform('android')}>Android</PlatformButton></div></div>
          <div id={`${activePlatform}-guide`} className="scroll-mt-24">
            <InstallationGuide platform={activePlatform} steps={activePlatform === 'ios' ? IOS_STEPS : ANDROID_STEPS} />
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><RefreshCw className="h-7 w-7 text-amber-700" /><h2 className="mt-4 text-xl font-black">L’option d’installation n’apparaît pas ?</h2><ul className="mt-4 space-y-3 text-sm leading-6 text-amber-950"><li>• Vérifiez que vous utilisez Safari sur iPhone ou Chrome sur Android.</li><li>• Actualisez www.hdmarket.store, puis ouvrez de nouveau le menu.</li><li>• Si HDMarket est déjà installé, recherchez son icône sur l’écran d’accueil.</li><li>• Désactivez temporairement le mode navigation privée.</li></ul><div className="mt-5 flex flex-wrap gap-2"><a href="https://support.apple.com/guide/iphone/iphea86e5236/ios" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-amber-950">Guide officiel Apple<ExternalLink className="h-3.5 w-3.5" /></a><a href="https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid" target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-black text-amber-950">Guide officiel Google<ExternalLink className="h-3.5 w-3.5" /></a></div></article>
          <article className="rounded-2xl bg-[#201f1d] p-6 text-white"><ShieldCheck className="h-7 w-7 text-[#ff7a22]" /><h2 className="mt-4 text-xl font-black">Installation sûre et légère</h2><p className="mt-3 text-sm leading-6 text-white/65">L’application installée utilise directement www.hdmarket.store. Elle ne demande aucun téléchargement provenant d’un site tiers.</p><a href="https://www.hdmarket.store" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-[#201f1d]">Ouvrir HDMarket<ExternalLink className="h-4 w-4" /></a></article>
        </section>
      </main>
    </div>
  );
}

const PlatformButton = ({ active, children, onClick }) => <button type="button" onClick={onClick} className={`min-h-11 rounded-xl px-4 text-sm font-black transition ${active ? 'bg-white text-[#b94700] shadow-sm' : 'text-stone-600'}`}>{children}</button>;

function InstallationGuide({ platform, steps }) {
  return <div className={`mt-8 grid gap-5 sm:grid-cols-2 ${platform === 'ios' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>{steps.map((step, index) => <figure key={step.title} className="overflow-hidden rounded-2xl border border-[#dcd4cb] bg-white"><StepVisual platform={platform} step={index} /><figcaption className="p-5"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#201f1d] text-sm font-black text-white">{index + 1}</span><h3 className="mt-4 text-base font-black leading-5">{step.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{step.text}</p></figcaption></figure>)}</div>;
}

function StepVisual({ platform, step }) {
  const isIos = platform === 'ios';
  return <div className="relative flex h-52 items-end justify-center overflow-hidden border-b border-[#ddd5cc] bg-[#f1ece6] px-8 pt-6"><div className="absolute left-4 top-4 rounded-lg bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-stone-500">{isIos ? 'Safari' : 'Chrome'}</div><div className="relative h-48 w-32 rounded-2xl border-[5px] border-[#282522] bg-white"><div className="mx-auto mt-1.5 h-2 w-12 rounded-full bg-[#282522]" /><div className="mx-2 mt-3 rounded-lg bg-[#fff3e8] p-2"><div className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5 text-[#e85d00]" /><span className="text-[7px] font-black">HDMarket</span></div><div className="mt-2 h-10 rounded-md bg-stone-200" /></div>{step === 0 ? <div className="absolute inset-x-2 bottom-3 rounded-lg border border-stone-200 bg-white p-2 text-center text-[7px] font-bold">www.hdmarket.store</div> : null}{step === 1 ? <div className="absolute inset-x-2 bottom-3 flex items-center justify-center rounded-lg bg-[#201f1d] py-3 text-white">{isIos ? <Share className="h-5 w-5" /> : <MoreVertical className="h-5 w-5" />}</div> : null}{step === 2 ? <div className="absolute inset-x-1 bottom-1 rounded-lg border border-stone-200 bg-white p-2"><div className="flex items-center gap-2 rounded-md bg-[#fff0e4] p-2"><Home className="h-4 w-4 text-[#e85d00]" /><span className="text-[7px] font-black">{isIos ? 'Sur l’écran d’accueil' : 'Ajouter à l’écran d’accueil'}</span></div></div> : null}{isIos && step === 3 ? <div className="absolute inset-x-2 bottom-4 flex items-center justify-between rounded-lg border border-stone-200 bg-white p-2 text-[7px] font-black"><span>Ouvrir comme app</span><span className="h-4 w-7 rounded-full bg-emerald-500 p-0.5"><span className="ml-auto block h-3 w-3 rounded-full bg-white" /></span></div> : null}{((isIos && step === 4) || (!isIos && step === 3)) ? <div className="absolute inset-x-2 bottom-4 rounded-lg bg-[#e85d00] p-2 text-center text-[8px] font-black text-white"><Check className="mr-1 inline h-3 w-3" />{isIos ? 'Ajouter' : 'Installer'}</div> : null}</div></div>;
}
