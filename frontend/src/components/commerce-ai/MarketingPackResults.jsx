import React, { useEffect, useState } from 'react';
import { aiButton, aiInput } from './AiPanel';

export async function renderMarketingBanner(url, title, width, height) {
  const image = new Image(); image.crossOrigin = 'anonymous'; image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff7ed'; ctx.fillRect(0, 0, width, height);
  const photoSize = Math.min(height * 0.70, width * 0.64);
  const scale = Math.min(photoSize / image.naturalWidth, photoSize / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.drawImage(image, (width - w) / 2, 26, w, h);
  ctx.fillStyle = '#231f1b'; ctx.textAlign = 'center'; ctx.font = `bold ${Math.round(height * 0.043)}px sans-serif`;
  const words = title.split(/\s+/); const lines = []; let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (ctx.measureText(next).width > width - 90 && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((value, index) => ctx.fillText(value, width / 2, height * 0.81 + index * height * 0.055, width - 80));
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('Export indisponible')), 'image/png'));
}
export default function MarketingPackResults({ job }) {
  const [headline, setHeadline] = useState(job.marketingCopy?.headline || job.marketingTitle || '');
  const [whatsapp, setWhatsapp] = useState(job.marketingCopy?.whatsapp || ''), [facebook, setFacebook] = useState(job.marketingCopy?.facebook || '');
  const [banners, setBanners] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => () => banners.forEach(b => URL.revokeObjectURL(b.url)), [banners]);
  const generate = async () => {
    setBusy(true); setError('');
    const created = [];
    try {
      for (const [width, height, label] of [[1080, 1080, 'Carré réseaux sociaux'], [1200, 628, 'Bannière paysage']]) created.push({ url: await renderMarketingBanner(job.resultUrl, headline, width, height), label, width, height });
      setBanners(created);
    } catch { created.forEach(b => URL.revokeObjectURL(b.url)); setError('Impossible de préparer les bannières. La photo et les textes restent disponibles. Réessayez.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl bg-orange-50 p-4 text-neutral-900">
    <h3 className="font-bold">Votre pack marketing</h3><p className="text-xs">Relisez les textes. Les deux bannières utilisent votre photo retouchée. Leur export et les corrections ci-dessous sont gratuits et ne lancent aucune nouvelle génération IA.</p>
    <label className="block text-sm">Titre sur les bannières<input value={headline} maxLength={80} onChange={e => { setHeadline(e.target.value); setBanners([]); }} className={aiInput} /></label>
    <button type="button" className={aiButton} disabled={busy || !headline.trim()} onClick={generate}>{busy ? 'Préparation…' : 'Prévisualiser les deux bannières'}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{banners.map(b => <div key={b.label}><img src={b.url} alt={b.label} className="w-full rounded-lg" /><a className="inline-flex min-h-11 items-center font-semibold text-orange-700" href={b.url} download={`hdmarket-${b.width}x${b.height}.png`}>Télécharger · {b.width} × {b.height}</a></div>)}</div>
    {[['WhatsApp', whatsapp, setWhatsapp, 500], ['Facebook', facebook, setFacebook, 800]].map(([label, value, setter, max]) => <label className="block text-sm" key={label}>Texte {label} · sélectionnez pour copier<textarea className={aiInput} rows={3} maxLength={max} value={value} onChange={e => setter(e.target.value)} /></label>)}
    <p className="text-xs">Les textes d’origine et la photo sont sauvegardés dans votre historique. Les corrections manuelles restent sur cette page.</p>
  </div>;
}
