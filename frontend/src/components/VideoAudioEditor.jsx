import { useContext, useEffect, useRef, useState } from 'react';
import { editVideoAudio } from '../services/videoAudioEditor';
import AuthContext from '../context/AuthContext';
import { listSavedVideoSounds, rememberVideoSound, removeSavedVideoSound, SAVED_SOUNDS_CHANGED } from '../services/savedVideoSounds';

export default function VideoAudioEditor({ file, disabled = false, onApply, maxBytes = 50 * 1024 * 1024 }) {
  const { user } = useContext(AuthContext);
  const userId = user?._id || user?.id;
  const [sounds, setSounds] = useState([]);
  const [storageMessage, setStorageMessage] = useState('');
  const [mode, setMode] = useState('mute');
  const [audioFile, setAudioFile] = useState(null);
  const [originalVolume, setOriginalVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const controller = useRef(null);
  useEffect(() => {
    let active = true;
    setSounds([]);
    setAudioFile(null);
    setPreview(null);
    const refresh = () => listSavedVideoSounds(userId).then(items => { if (active) setSounds(items); }).catch(() => {
      if (active) setStorageMessage('Les sons enregistrés ne sont pas accessibles sur ce navigateur.');
    });
    refresh();
    window.addEventListener(SAVED_SOUNDS_CHANGED, refresh);
    return () => { active = false; window.removeEventListener(SAVED_SOUNDS_CHANGED, refresh); };
  }, [userId]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!preview) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);
  useEffect(() => { controller.current?.abort(); setPreview(null); }, [file]);
  const changed = () => { setPreview(null); setError(''); };
  const prepare = async () => {
    if (controller.current || disabled) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(''); setProgress(0); setPreview(null);
    try {
      const result = await editVideoAudio(file, { mode, audioFile, originalVolume, musicVolume, signal: abort.signal, onProgress: setProgress });
      if (result.size > maxBytes) throw new Error('La vidéo préparée est trop volumineuse. Utilisez un clip plus court.');
      setPreview(result);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Modification audio impossible.');
    } finally { controller.current = null; setBusy(false); }
  };
  return <details className="mt-3 rounded-xl border border-neutral-200 p-3 text-sm dark:border-white/15">
    <summary className="cursor-pointer font-semibold">Modifier le son</summary>
    <fieldset disabled={disabled || busy} className="mt-3 space-y-3 disabled:opacity-60">
      <label className="block">Son de la vidéo
        <select value={mode} onChange={event => { setMode(event.target.value); changed(); }} className="mt-1 block w-full rounded border p-2 text-neutral-900">
          <option value="mute">Couper le son</option><option value="replace">Remplacer le son</option><option value="mix">Mélanger avec une musique ou une voix</option>
        </select>
      </label>
      {mode !== 'mute' && <label className="block">Musique ou enregistrement (20 Mo maximum)
        <input type="file" accept="audio/*" className="mt-1 block w-full" onChange={event => { setAudioFile(event.target.files?.[0] || null); changed(); }} />
      </label>}
      {mode !== 'mute' && userId && <div className="space-y-2">
        <p className="font-semibold">Vos 4 sons les plus utilisés</p>
        <p className="text-xs text-neutral-500">Conservés sur cet appareil après application à une vidéo.</p>
        {!sounds.length && <p className="text-xs">Vos sons apparaîtront ici après leur première utilisation.</p>}
        {sounds.map(sound => <div key={sound.id} className="flex items-center gap-2">
          <button type="button" onClick={() => { setAudioFile(sound.file); changed(); }} className="min-w-0 flex-1 truncate rounded-lg border p-2 text-left" title={sound.name}>{sound.name} · {sound.uses} utilisation{sound.uses > 1 ? 's' : ''}</button>
          <button type="button" aria-label={`Retirer le son ${sound.name}`} onClick={() => removeSavedVideoSound(userId, sound.id).catch(() => setStorageMessage('Impossible de retirer ce son.'))} className="rounded p-2 text-red-600">Retirer</button>
        </div>)}
      </div>}
      {mode !== 'mute' && audioFile && <p className="text-xs">Son sélectionné : {audioFile.name}</p>}
      {mode === 'mix' && <label className="block">Son original : {Math.round(originalVolume * 100)} %
        <input aria-label="Volume du son original" type="range" min="0" max="1" step="0.05" value={originalVolume} onChange={event => { setOriginalVolume(Number(event.target.value)); changed(); }} className="block w-full" />
      </label>}
      {mode !== 'mute' && <label className="block">Son ajouté : {Math.round(musicVolume * 100)} %
        <input aria-label="Volume du son ajouté" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={event => { setMusicVolume(Number(event.target.value)); changed(); }} className="block w-full" />
      </label>}
      <p className="text-xs text-neutral-500">La piste commence au début, se répète si nécessaire et s’arrête avec la vidéo. Gardez cet onglet visible pendant la préparation, qui dure environ le temps de la vidéo.</p>
      <button type="button" onClick={prepare} disabled={mode !== 'mute' && !audioFile} className="rounded-lg bg-neutral-800 px-3 py-2 text-white disabled:opacity-40">Préparer l’aperçu</button>
    </fieldset>
    {busy && <div role="status" className="mt-2">Préparation : {progress} % <button type="button" onClick={() => controller.current?.abort()} className="underline">Annuler</button></div>}
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {storageMessage && <p role="status" className="mt-2 text-xs">{storageMessage}</p>}
    {previewUrl && <div className="mt-3 space-y-2"><video src={previewUrl} controls playsInline className="max-h-64 w-full" /><button type="button" disabled={disabled || busy} onClick={async () => {
      setBusy(true);
      if (mode !== 'mute' && audioFile) {
        try { await rememberVideoSound(userId, audioFile); }
        catch { setStorageMessage('Son appliqué, mais sa conservation sur cet appareil a échoué.'); }
      }
      onApply(preview); setPreview(null); setBusy(false);
    }} className="rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-40">Appliquer ce son à la vidéo</button></div>}
  </details>;
}
