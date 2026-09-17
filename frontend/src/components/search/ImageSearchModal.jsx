import { imageSearchCrop } from '../../utils/imageSearchCrop';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CameraIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import BaseModal, { ModalBody, ModalHeader } from '../modals/BaseModal';
import api from '../../services/api';
import { formatPriceWithStoredSettings } from '../../utils/priceFormatter';
import { buildProductPath } from '../../utils/links';

/** Extracts the photo's average color locally (canvas) — nothing is uploaded. */
const extractDominantColor = (file, selection) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const timer = setTimeout(() => { image.onload = image.onerror = null; URL.revokeObjectURL(url); reject(new Error('Image trop longue à décoder. Essayez une image plus petite.')); }, 10000);
    image.onload = () => {
      clearTimeout(timer);
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        context.fillStyle = "white";
        context.fillRect(0, 0, size, size);
        const crop = imageSearchCrop(image.naturalWidth, image.naturalHeight, selection);
        context.drawImage(image, crop.sx, crop.sy, crop.size, crop.size, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        const thumbnail = document.createElement('canvas');
        thumbnail.width = thumbnail.height = 320;
        thumbnail.getContext('2d').drawImage(image, crop.sx, crop.sy, crop.size, crop.size, 0, 0, 320, 320);
        resolve({ r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count), preview: thumbnail.toDataURL('image/jpeg', 0.8) });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible.'));
    };
    image.src = url;
  });

export default function ImageSearchModal({ open, onClose }) {
  const requestRef = useRef(null);
  const aiRequest = useRef(null);
  const aiCache = useRef(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    api.get('/search/ai/capabilities', { signal: controller.signal }).then(({ data }) => setAiEnabled(Boolean(data.image))).catch(() => setAiEnabled(false));
    return () => { controller.abort(); aiRequest.current?.abort(); };
  }, [open]);
  const [selection, setSelection] = useState({ zoom: 1, x: 50, y: 50 });
  const [filters, setFilters] = useState({ query: '', minPrice: '', maxPrice: '', sort: 'similarity' });
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [applied, setApplied] = useState(null);
  const [cropPreview, setCropPreview] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [partial, setPartial] = useState(false);
  const [scanned, setScanned] = useState(0);

  useEffect(() => {
    if (!open) {
      requestRef.current?.abort();
      aiRequest.current?.abort(); aiCache.current = null; setAiBusy(false); setAiSuggestion(null);
      setLastFile(null);
      setCropPreview('');
      setApplied(null);
      setHasMore(false);
      setPartial(false);
    setScanned(0);
      setPreview('');
      setError('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!open || !lastFile) return;
    let active = true;
    const timer = setTimeout(() => {
      extractDominantColor(lastFile, selection).then(result => { if (active) setCropPreview(result.preview); }).catch(() => {});
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [lastFile, selection, open]);

  const searchFile = async (file, append = false, cropOverride = selection) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPartial(false);
    setScanned(0);
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      setError('Choisissez une image de moins de 10 Mo.');
      setLoading(false);
      setResults([]);
      return;
    }
    setLastFile(file);
    setError('');
    if (!append) setResults([]);
    if (!append) setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const color = append ? applied.color : await extractDominantColor(file, cropOverride);
      if (controller.signal.aborted) return;
      if (!append) setCropPreview(color.preview);
      const searchFilters = append ? applied.filters : filters;
      if (controller.signal.aborted) return;
      const { data } = await api.post('/search/by-color', { color: [color.r, color.g, color.b], ...searchFilters, minPrice: searchFilters.minPrice === '' ? undefined : Number(searchFilters.minPrice), maxPrice: searchFilters.maxPrice === '' ? undefined : Number(searchFilters.maxPrice), offset: append ? nextOffset : 0, limit: 12 }, { signal: controller.signal, timeout: 20000 });
      if (controller.signal.aborted) return;
      const incoming = Array.isArray(data?.results) ? data.results : [];
      setResults(previous => append ? [...previous, ...incoming.filter(item => !previous.some(old => old.id === item.id))] : incoming);
      setApplied({ color, filters: { ...searchFilters } });
      setHasMore(Boolean(data?.hasMore));
      setNextOffset(Number(data?.nextOffset || 0));
      setScanned(Number(data?.scanned || 0));
      setPartial(Boolean(data?.partial));
      if (!data?.results?.length) {
        setError('Aucun produit trouvé avec ces critères. Élargissez les prix, changez les mots-clés ou essayez une autre photo.');
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err.response?.data?.message || err.message || 'Recherche par image impossible.');
    } finally {
      if (requestRef.current === controller && !controller.signal.aborted) setLoading(false);
    }
  };

  const identifyProduct = async () => {
    if (!lastFile || aiBusy) return;
    const controller = new AbortController(); aiRequest.current = controller;
    setAiBusy(true); setError(''); setAiSuggestion(null);
    try {
      const crop = await extractDominantColor(lastFile, selection);
      if (controller.signal.aborted) return;
      let suggestion;
      if (aiCache.current?.preview === crop.preview) suggestion = aiCache.current.result;
      else {
        const { data } = await api.post('/search/ai/image', { image: crop.preview }, { signal: controller.signal, timeout: 30000 });
        suggestion = data;
        if (!controller.signal.aborted) aiCache.current = { preview: crop.preview, result: data };
      }
      if (!controller.signal.aborted) {
        if (suggestion.query) setAiSuggestion(suggestion);
        else setError('L’IA ne reconnaît pas de produit. Recadrez la photo ou saisissez un mot-clé.');
      }
    } catch (e) { if (!controller.signal.aborted) setError(e.response?.data?.message || 'Reconnaissance indisponible. La recherche par couleur reste disponible.'); }
    finally { if (!controller.signal.aborted) setAiBusy(false); }
  };
  const handleFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      aiRequest.current?.abort(); aiCache.current = null; setAiBusy(false); setAiSuggestion(null);
      const reset = { zoom: 1, x: 50, y: 50 };
      setSelection(reset);
      searchFile(file, false, reset);
    }
  };

  return (
    <BaseModal isOpen={open} onClose={onClose} size="lg" mobileSheet>
      <ModalHeader
        title="Recherche par image"
        subtitle={aiEnabled ? "Reconnaissez un article avec l’IA, puis recherchez des produits de ce type et de couleurs proches." : "Trouvez des produits aux couleurs proches, ou précisez le type de produit."}
        onClose={onClose}
      />
      <ModalBody>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-[#e85d00] px-4 py-2.5 text-xs font-black text-white active:scale-[0.98]">
          <CameraIcon className="h-4 w-4" /> Prendre une photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
        <label className="ml-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-black text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
          <CloudArrowUpIcon className="h-4 w-4" /> Choisir une image
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>

        {preview ? (
          <div className="mt-4 flex items-center gap-3">
            <img src={cropPreview || preview} alt="Zone à rechercher" className="h-28 w-28 rounded-2xl object-cover ring-1 ring-neutral-200" />
            <p className="text-xs text-neutral-500">
              {loading ? 'Recherche de produits aux couleurs proches…' : scanned ? `${scanned} produits comparés.${partial ? ' Résultats partiels : réessayez pour élargir la recherche.' : ''}` : ''}
            </p>
          </div>
        ) : null}

        {lastFile ? <form onSubmit={event => { event.preventDefault(); searchFile(lastFile); }} className="mt-4 space-y-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-3"><legend className="mb-2 text-sm font-bold">Cadrer l’article</legend>
            {[['zoom', 'Zoom', 1, 4, 0.1], ['x', 'Position horizontale', 0, 100, 1], ['y', 'Position verticale', 0, 100, 1]].map(([key, label, min, max, step]) => <label key={key} className="text-xs font-medium">{label}<input type="range" min={min} max={max} step={step} value={selection[key]} onChange={event => { aiRequest.current?.abort(); setAiBusy(false); setAiSuggestion(null); setSelection(previous => ({ ...previous, [key]: Number(event.target.value) })); }} className="mt-2 block w-full accent-orange-600" /></label>)}
          </fieldset>
          {aiEnabled && <div className="space-y-2"><button type="button" disabled={aiBusy || loading} onClick={identifyProduct} className="min-h-11 rounded-xl border border-orange-300 bg-white px-4 text-sm font-bold text-orange-800">{aiBusy ? 'Reconnaissance…' : 'Identifier cet article avec l’IA'}</button><p className="text-xs text-neutral-500">Seul l’aperçu recadré est envoyé à OpenAI. La reconnaissance peut se tromper : vérifiez le mot-clé proposé.</p></div>}
          {aiSuggestion && <div className="space-y-2 rounded-xl border p-3"><p className="text-sm font-semibold">Article proposé : {aiSuggestion.query}</p><p className="text-xs">{aiSuggestion.label}</p><button type="button" onClick={() => { setFilters(previous => ({ ...previous, query: aiSuggestion.query })); setAiSuggestion(null); }} className="min-h-11 rounded-lg border px-3 text-xs font-bold">Utiliser ce mot-clé, puis appliquer les filtres</button></div>}
          <label className="block text-xs font-bold">Préciser le produit<input value={filters.query} maxLength={100} onChange={event => setFilters(previous => ({ ...previous, query: event.target.value }))} placeholder="Ex. sac, chaussures, robe…" className="mt-1 w-full rounded-xl border p-3 text-sm dark:bg-neutral-950" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">Prix minimum<input type="number" min="0" value={filters.minPrice} onChange={event => setFilters(previous => ({ ...previous, minPrice: event.target.value }))} className="mt-1 w-full rounded-lg border p-2 dark:bg-neutral-950" /></label>
            <label className="text-xs">Prix maximum<input type="number" min={filters.minPrice || 0} value={filters.maxPrice} onChange={event => setFilters(previous => ({ ...previous, maxPrice: event.target.value }))} className="mt-1 w-full rounded-lg border p-2 dark:bg-neutral-950" /></label>
          </div>
          <label className="block text-xs">Trier par<select value={filters.sort} onChange={event => setFilters(previous => ({ ...previous, sort: event.target.value }))} className="ml-2 rounded-lg border p-2 dark:bg-neutral-950"><option value="similarity">Couleurs proches</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option><option value="newest">Nouveautés</option></select></label>
          <button disabled={loading} className="min-h-11 w-full rounded-xl bg-[#e85d00] px-4 text-sm font-bold text-white disabled:opacity-50">Appliquer le cadrage et les filtres</button>
          <p className="text-xs text-neutral-500">Centrez l’article dans l’aperçu, puis appliquez pour rechercher cette zone.</p>
        </form> : null}

        {loading ? (
          <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse space-y-2">
                <div className="aspect-square rounded-xl bg-neutral-100 dark:bg-neutral-900" />
                <div className="h-3 w-4/5 rounded-full bg-neutral-100 dark:bg-neutral-900" />
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div role="alert" className="mt-4 text-xs font-medium text-red-600"><p>{error}</p>{lastFile && !loading ? <button type="button" className="mt-2 underline" onClick={() => searchFile(lastFile)}>Réessayer</button> : null}</div> : null}

        {results.length ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-black text-neutral-800 dark:text-neutral-100">
              Résultats visuels ({results.length})
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {results.map((item) => (
                <Link
                  key={item.id}
                  to={buildProductPath({ _id: item.id, slug: item.slug })}
                  onClick={onClose}
                  className="overflow-hidden rounded-xl border border-neutral-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <div className="aspect-square overflow-hidden bg-[#f1ece4]">
                    {item.image ? (
                      <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 min-h-[30px] text-[10.5px] font-semibold leading-[14px] text-neutral-800 dark:text-neutral-200">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] font-black text-[#e85d00]">
                      {formatPriceWithStoredSettings(item.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {hasMore && !loading && !error ? <button type="button" onClick={() => searchFile(lastFile, true)} className="mt-4 min-h-11 w-full rounded-xl border border-orange-200 font-bold text-[#e85d00]">Voir plus de produits</button> : null}
      </ModalBody>
    </BaseModal>
  );
}
