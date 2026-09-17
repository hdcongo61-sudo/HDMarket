import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';

export default function AiVoiceRecorder({ onTranscript, onError, onRecordingChange, onStart }) {
  const recording = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const request = useRef(null);
  const alive = useRef(true);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clip, setClip] = useState(null);
  const [starting, setStarting] = useState(false);
  const stop = () => {
    clearTimeout(timer.current);
    if (recording.current?.state === 'recording') recording.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (alive.current) { setActive(false); onRecordingChange?.(false); }
  };
  useEffect(() => {
    alive.current = true;
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { alive.current = false; stop(); request.current?.abort(); document.removeEventListener('visibilitychange', hide); };
  }, []);
  async function start() {
    if (active) { stop(); return; }
    if (starting || busy) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      onError('Enregistrement indisponible : utilisez la dictée du navigateur ou saisissez votre recherche.'); return;
    }
    onStart?.(); setStarting(true); onRecordingChange?.(true); onError(''); setClip(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || document.hidden) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('format');
      const recorder = new MediaRecorder(media, { mimeType });
      const chunks = [];
      let size = 0;
      recorder.ondataavailable = event => { if (event.data.size) { chunks.push(event.data); size += event.data.size; if (size > 3 * 1024 * 1024) stop(); } };
      recorder.onstop = () => {
        if (!alive.current) return;
        if (size > 3 * 1024 * 1024) { onError('Enregistrement trop volumineux. Recommencez avec une phrase courte.'); return; }
        setClip(new Blob(chunks, { type: mimeType })); setActive(false);
      };
      recorder.onerror = () => { stop(); if (alive.current) onError('Échec de l’enregistrement. Réessayez.'); };
      recording.current = recorder; recorder.start(250); setActive(true); timer.current = setTimeout(stop, 20000);
    } catch { stop(); if (alive.current) onError('Autorisez le microphone ou saisissez votre recherche.'); }
    finally { if (alive.current) { setStarting(false); if (!stream.current) onRecordingChange?.(false); } }
  }
  async function transcribe() {
    if (!clip?.size || busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); onError('');
    try {
      const form = new FormData();
      const extension = clip.type.includes('mp4') ? 'm4a' : clip.type.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', clip, `search.${extension}`);
      const { data } = await api.post('/search/ai/transcribe', form, { signal: controller.signal, timeout: 30000 });
      if (alive.current && !controller.signal.aborted) { onTranscript(data.text); setClip(null); }
    } catch (e) { if (alive.current && !controller.signal.aborted) onError(e.response?.data?.message || 'Transcription indisponible. Utilisez la dictée classique.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <div className="space-y-2 rounded-xl border border-orange-200 p-3">
    <p className="text-xs text-neutral-600 dark:text-neutral-300">Dictée IA : enregistrez jusqu’à 20 secondes, puis envoyez l’audio à OpenAI pour le transcrire. Vous pourrez corriger le texte.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || starting} onClick={start} className="min-h-11 rounded-lg border px-3 text-sm">{starting ? 'Ouverture du micro…' : active ? 'Arrêter l’enregistrement IA' : 'Enregistrer pour l’IA'}</button>
    {clip && !active && <><button type="button" disabled={busy || !clip.size} onClick={transcribe} className="min-h-11 rounded-lg bg-orange-700 px-3 text-sm font-bold text-white">{busy ? 'Transcription…' : 'Envoyer et transcrire'}</button><button type="button" disabled={busy} onClick={() => setClip(null)} className="min-h-11 px-3 text-sm">Effacer</button></>}
    {busy && <button type="button" onClick={() => request.current?.abort()} className="min-h-11 px-3 text-sm">Annuler</button>}</div>
    <span role="status" className="text-xs">{active ? 'Enregistrement en cours…' : ''}</span>
  </div>;
}
