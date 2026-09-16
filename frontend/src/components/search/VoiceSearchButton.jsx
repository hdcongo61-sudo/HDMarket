import React, { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import BaseModal, { ModalBody, ModalHeader } from '../modals/BaseModal';

export default function VoiceSearchButton({ onResult, className = '', label = 'Recherche vocale' }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [query, setQuery] = useState('');
  const [interim, setInterim] = useState('');
  const [language, setLanguage] = useState('fr-FR');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const stop = (update = true) => {
    clearTimeout(timerRef.current);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped. */ }
    }
    if (update) { setListening(false); setInterim(''); }
  };
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { stop(false); document.removeEventListener('visibilitychange', hide); };
  }, []);
  const close = () => { stop(); setOpen(false); };
  const start = () => {
    if (recognitionRef.current) { stop(); return; }
    setError('');
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !window.isSecureContext) {
      setError('Microphone indisponible dans ce navigateur. Vous pouvez saisir votre recherche ci-dessous.');
      return;
    }
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = language;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = event => {
        if (recognitionRef.current !== recognition) return;
        let finalText = ''; let partialText = '';
        for (let i = 0; i < event.results.length; i += 1) {
          const text = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalText += `${text} `;
          else partialText += `${text} `;
        }
        setInterim(partialText.trim());
        if (finalText.trim()) setQuery(finalText.trim().slice(0, 200));
      };
      recognition.onerror = event => {
        if (recognitionRef.current !== recognition) return;
        stop();
        if (event.error === 'aborted') return;
        setError(['not-allowed', 'service-not-allowed'].includes(event.error)
          ? 'Autorisez le microphone dans les paramètres du navigateur, puis réessayez.'
          : event.error === 'no-speech' ? 'Aucune parole détectée. Réessayez ou saisissez votre recherche.'
          : 'Écoute indisponible. Vérifiez le microphone et votre connexion.');
      };
      recognition.onend = () => { if (recognitionRef.current === recognition) stop(); };
      setListening(true);
      recognition.start();
      timerRef.current = setTimeout(() => { if (recognitionRef.current === recognition) stop(); }, 20000);
    } catch { stop(); setError('Impossible de démarrer le microphone. Vous pouvez saisir votre recherche.'); }
  };
  return <>
    <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setOpen(true); start(); }} aria-label={label} title={label} className={`grid h-8 w-8 place-items-center rounded-lg text-[#e85d00] hover:bg-orange-100 ${className}`}><MicrophoneIcon className="h-4 w-4" /></button>
    <BaseModal isOpen={open} onClose={close} size="lg" mobileSheet>
      <ModalHeader title="Dites ce que vous cherchez" subtitle="Dictez votre recherche, puis vérifiez les mots avant de lancer la recherche." onClose={close} />
      <ModalBody>
        <div className="flex flex-col items-center gap-3 py-4">
          <button type="button" onClick={start} aria-label={listening ? 'Arrêter le microphone' : 'Démarrer le microphone'} aria-pressed={listening} className={`grid h-20 w-20 place-items-center rounded-full text-white ${listening ? 'animate-pulse bg-red-500' : 'bg-[#e85d00]'}`}><MicrophoneIcon className="h-8 w-8" /></button>
          <p role="status" className="text-sm text-neutral-500">{listening ? interim || 'Je vous écoute…' : 'Touchez le microphone pour dicter'}</p>
          <label className="text-sm">Langue <select value={language} onChange={event => { stop(); setLanguage(event.target.value); }} className="ml-2 rounded-lg border p-2 dark:bg-neutral-900"><option value="fr-FR">Français</option><option value="en-US">English</option></select></label>
        </div>
        {error ? <p role="alert" className="mb-3 text-sm text-red-600">{error}</p> : null}
        <form onSubmit={event => { event.preventDefault(); if (!query.trim()) return; close(); onResult(query.trim()); }} className="space-y-3">
          <label className="block text-sm font-bold">Votre recherche<input value={query} onChange={event => { stop(); setQuery(event.target.value); }} maxLength={200} placeholder="Ex. chaussures de sport noires" className="mt-2 w-full rounded-xl border border-neutral-300 p-3 dark:bg-neutral-900" /></label>
          <button disabled={!query.trim()} className="min-h-11 w-full rounded-xl bg-[#e85d00] px-4 font-bold text-white disabled:opacity-40">Rechercher les produits</button>
        </form>
      </ModalBody>
    </BaseModal>
  </>;
}
