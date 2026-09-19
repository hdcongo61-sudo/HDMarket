import React, { useEffect, useRef, useState } from 'react';
import { muteVideo } from '../services/videoAudioEditor';

export default function VideoAudioEditor({ file, disabled = false, onApply, maxBytes = 50 * 1024 * 1024 }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!preview) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  useEffect(() => {
    controller.current?.abort();
    setPreview(null);
    setError('');
  }, [file]);
  useEffect(() => {
    if (disabled) controller.current?.abort();
  }, [disabled]);

  const prepare = async () => {
    if (controller.current || disabled) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(''); setProgress(0); setPreview(null);
    try {
      const result = await muteVideo(file, { signal: abort.signal, onProgress: setProgress });
      if (abort.signal.aborted) return;
      if (result.size > maxBytes) throw new Error('La vidéo préparée est trop volumineuse. Utilisez un clip plus court.');
      setPreview(result);
    } catch (err) {
      if (!abort.signal.aborted) setError(err.message || 'Impossible de couper le son.');
    } finally { controller.current = null; setBusy(false); }
  };

  return <details className="mt-3 rounded-xl border border-neutral-200 p-3 text-sm dark:border-white/15">
    <summary className="cursor-pointer font-semibold">Couper le son</summary>
    <p className="mt-3 text-xs text-neutral-500">Préparez une version sans son, puis appliquez-la avant l’envoi. Gardez cet onglet visible pendant la préparation.</p>
    <button type="button" onClick={prepare} disabled={disabled || busy}
      className="mt-3 rounded-lg bg-[#e85d00] px-3 py-2 text-white disabled:opacity-40">Préparer la vidéo sans son</button>
    {busy && <div role="status" className="mt-2">Préparation : {progress} % <button type="button" onClick={() => controller.current?.abort()} className="underline">Annuler</button></div>}
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {previewUrl && <div className="mt-3 space-y-2">
      <video src={previewUrl} controls playsInline className="max-h-64 w-full" />
      <button type="button" disabled={disabled || busy} onClick={() => { onApply(preview); setPreview(null); }}
        className="rounded-lg bg-[#e85d00] px-3 py-2 text-white disabled:opacity-40">Appliquer la vidéo sans son</button>
    </div>}
  </details>;
}
