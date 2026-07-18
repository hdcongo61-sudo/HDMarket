import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Blend, Check, ChevronDown, CircleGauge, Cloud, Crop,
  Download, FlipHorizontal, FlipVertical, Focus, History, Image as ImageIcon,
  Layers3, Loader2, Maximize2, Paintbrush, PanelRightClose, Redo2, RotateCw,
  Save, ScanSearch, SlidersHorizontal, Sparkles, Stamp, Undo2, WandSparkles, X,
  ZoomIn, ZoomOut
} from 'lucide-react';
import imageStudioService from '../../services/imageStudioService';
import { formatFileSize } from '../../utils/mediaOptimizer';
import {
  ADJUSTMENT_DEFINITIONS, ASPECT_RATIOS, BACKGROUNDS, FILTER_PRESETS, TEMPLATES,
  applyPreset, applySmartOptimization, createHistoryState, createInitialImageStudioState,
  extensionForMime, getCanvasFilter, getOutputQuality, historyReducer
} from './imageStudioState';

const TOOLS = [
  { id: 'crop', label: 'Recadrer', icon: Crop },
  { id: 'adjust', label: 'Réglages', icon: SlidersHorizontal },
  { id: 'filters', label: 'Filtres', icon: Blend },
  { id: 'background', label: 'Arrière-plan', icon: Layers3 },
  { id: 'ai', label: 'Outils IA', icon: WandSparkles },
  { id: 'watermark', label: 'Filigrane', icon: Stamp },
  { id: 'export', label: 'Exporter', icon: Download }
];

const AI_TOOLS = [
  { id: 'background-remove', label: 'Retirer le fond', description: 'Détection précise du produit', icon: Layers3 },
  { id: 'enhance', label: 'Améliorer', description: 'Détails, couleurs et balance', icon: Sparkles, local: true },
  { id: 'shadow', label: 'Ombre réaliste', description: 'Douce, studio ou flottante', icon: Focus },
  { id: 'relight', label: 'Changer la lumière', description: 'Face, côté, chaud ou froid', icon: WandSparkles },
  { id: 'object-remove', label: 'Effacer un objet', description: 'Pinceau mains, câble, poussière', icon: Paintbrush },
  { id: 'upscale', label: 'Agrandir', description: '2×, 4× ou 8×', icon: Maximize2 },
  { id: 'smart-crop', label: 'Cadrage intelligent', description: 'Centre automatiquement le produit', icon: ScanSearch, local: true }
];

const CHECK_LABELS = {
  resolution: 'Résolution', blur: 'Netteté', brightness: 'Luminosité', contrast: 'Contraste',
  compression: 'Compression', centered: 'Centrage', background: 'Arrière-plan'
};

const resolveSource = (image) => image?.url || image?.src || (image instanceof File ? URL.createObjectURL(image) : String(image || ''));

const drawBackground = (ctx, width, height, background, backgroundImage) => {
  if (backgroundImage?.naturalWidth) {
    const scale = Math.max(width / backgroundImage.naturalWidth, height / backgroundImage.naturalHeight);
    ctx.drawImage(backgroundImage, (width - backgroundImage.naturalWidth * scale) / 2, (height - backgroundImage.naturalHeight * scale) / 2, backgroundImage.naturalWidth * scale, backgroundImage.naturalHeight * scale);
    return;
  }
  const value = background?.customUrl || background?.value;
  if (!value || value === 'transparent') return;
  if (value.startsWith('linear-gradient')) {
    const colors = value.match(/#[0-9a-f]{3,8}/gi) || ['#f5f2ee', '#ffffff'];
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    colors.forEach((color, index) => gradient.addColorStop(index / Math.max(1, colors.length - 1), color));
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = value;
  }
  ctx.fillRect(0, 0, width, height);
};

const drawShadow = (ctx, state, width, height) => {
  if (!state.shadow?.type || state.shadow.type === 'none') return;
  ctx.save();
  const opacity = Number(state.shadow.opacity || 30) / 100;
  const y = height * (state.shadow.type === 'floating' ? 0.8 : 0.84);
  ctx.filter = `blur(${Math.max(8, width * 0.025)}px)`;
  ctx.fillStyle = `rgba(20,18,15,${opacity})`;
  ctx.beginPath();
  ctx.ellipse(width / 2, y, width * 0.27, height * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawWatermark = (ctx, state, width, height) => {
  const watermark = state.watermark;
  if (!watermark?.enabled) return;
  const text = watermark.type === 'verified' ? '✓ HDMarket Verified' : watermark.type === 'qr' ? '▦ HDMARKET' : watermark.text;
  if (!text) return;
  const margin = Math.round(width * 0.04);
  const fontSize = Math.max(18, Math.round(width * 0.032 * Number(watermark.scale || 100) / 100));
  ctx.save();
  ctx.globalAlpha = Number(watermark.opacity || 70) / 100;
  ctx.font = `800 ${fontSize}px "DM Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const positions = {
    'top-left': [margin, margin + fontSize / 2],
    'top-right': [width - margin - metrics.width, margin + fontSize / 2],
    center: [(width - metrics.width) / 2, height / 2],
    'bottom-left': [margin, height - margin - fontSize / 2],
    'bottom-right': [width - margin - metrics.width, height - margin - fontSize / 2]
  };
  const [x, y] = positions[watermark.position] || positions['bottom-right'];
  ctx.translate(x + metrics.width / 2, y);
  ctx.rotate(Number(watermark.rotation || 0) * Math.PI / 180);
  ctx.lineWidth = Math.max(2, fontSize * 0.1);
  ctx.strokeStyle = 'rgba(0,0,0,.38)';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(text, -metrics.width / 2, 0);
  ctx.fillText(text, -metrics.width / 2, 0);
  ctx.restore();
};

const renderToCanvas = ({ canvas, image, state, preview = false, backgroundImage = null }) => {
  if (!canvas || !image?.naturalWidth) return;
  const aspect = ASPECT_RATIOS.find((item) => item.id === state.aspectRatio)?.value || (image.naturalWidth / image.naturalHeight);
  const requestedWidth = preview ? Math.min(1200, canvas.clientWidth * (window.devicePixelRatio || 1)) : Number(state.output.width || 1600);
  const width = Math.max(320, Math.round(requestedWidth));
  const height = Math.max(320, Math.round(width / aspect));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, state.background, backgroundImage);
  drawShadow(ctx, state, width, height);
  const quarterTurn = Math.abs(state.rotation % 180) === 90;
  const naturalWidth = quarterTurn ? image.naturalHeight : image.naturalWidth;
  const naturalHeight = quarterTurn ? image.naturalWidth : image.naturalHeight;
  const cover = Math.max(width / naturalWidth, height / naturalHeight);
  const scale = cover * Number(state.zoom || 1);
  ctx.save();
  ctx.translate(width / 2 + Number(state.pan?.x || 0) * width / 100, height / 2 + Number(state.pan?.y || 0) * height / 100);
  ctx.rotate(Number(state.rotation || 0) * Math.PI / 180);
  ctx.scale(state.flipX ? -1 : 1, state.flipY ? -1 : 1);
  ctx.filter = getCanvasFilter(state.adjustments);
  ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  ctx.restore();
  drawWatermark(ctx, state, width, height);
};

const StudioButton = ({ active, icon: Icon, children, className = '', ...props }) => (
  <button type="button" className={`min-h-11 rounded-xl border px-3 text-sm font-bold transition ${active ? 'border-[#e85d00] bg-[#fff0e4] text-[#b94700]' : 'border-[#e2dcd2] bg-white text-[#4e4740] hover:border-[#bcb3a8]'} ${className}`} {...props}>
    {Icon ? <Icon className="mr-2 inline h-4 w-4" /> : null}{children}
  </button>
);

export default function ProductImageStudio({ isOpen, image, images = [], initialIndex = 0, shopName = '', onClose, onSave }) {
  const initialState = useMemo(() => createInitialImageStudioState({ watermark: { ...createInitialImageStudioState().watermark, text: shopName } }), [shopName]);
  const [history, dispatch] = useReducer(historyReducer, initialState, createHistoryState);
  const [activeTool, setActiveTool] = useState('crop');
  const [loadedImage, setLoadedImage] = useState(null);
  const [loadedBackground, setLoadedBackground] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [compare, setCompare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState('');
  const [message, setMessage] = useState('');
  const [estimate, setEstimate] = useState(0);
  const [quality, setQuality] = useState({ score: 0, suggestions: [], checks: {} });
  const [applyScope, setApplyScope] = useState('selected');
  const [draftRestored, setDraftRestored] = useState(false);
  const canvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const dragRef = useRef(null);
  const state = history.present;
  const currentImage = images[selectedIndex] || image;
  const source = resolveSource(currentImage);
  const draftKey = `hdmarket:image-studio:draft:${currentImage?.name || currentImage?.url || selectedIndex}`;

  const change = useCallback((updater) => dispatch({ type: 'CHANGE', payload: updater }), []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIndex(Math.min(initialIndex, Math.max(0, images.length - 1)));
  }, [images.length, initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen || !source) return undefined;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setLoadedImage(img);
    img.onerror = () => setMessage('Impossible de charger cette image. Vérifiez son accès réseau.');
    img.src = source;
    return () => { img.onload = null; img.onerror = null; };
  }, [isOpen, source]);

  useEffect(() => {
    const customUrl = state.background?.customUrl;
    if (!customUrl) {
      setLoadedBackground(null);
      return undefined;
    }
    const backgroundImage = new Image();
    backgroundImage.onload = () => setLoadedBackground(backgroundImage);
    backgroundImage.src = customUrl;
    return () => { backgroundImage.onload = null; };
  }, [state.background?.customUrl]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (saved?.state?.version === 1) {
        dispatch({ type: 'RESTORE', payload: saved.state });
        setDraftRestored(true);
      } else {
        dispatch({ type: 'RESET', payload: initialState });
      }
    } catch {
      dispatch({ type: 'RESET', payload: initialState });
    }
  }, [draftKey, initialState, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const draftState = state.background?.customUrl
          ? { ...state, background: { ...state.background, customUrl: '' } }
          : state;
        localStorage.setItem(draftKey, JSON.stringify({ state: draftState, savedAt: new Date().toISOString() }));
      } catch {
        // Autosave must never interrupt editing when device storage is full.
      }
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [draftKey, isOpen, state]);

  useEffect(() => {
    if (!loadedImage || !isOpen) return;
    renderToCanvas({ canvas: canvasRef.current, image: loadedImage, state, preview: true, backgroundImage: loadedBackground });
    if (compare) renderToCanvas({ canvas: originalCanvasRef.current, image: loadedImage, state: initialState, preview: true });
  }, [compare, initialState, isOpen, loadedBackground, loadedImage, state]);

  useEffect(() => {
    if (!loadedImage || !isOpen) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const sample = document.createElement('canvas');
        const size = 180;
        sample.width = size;
        sample.height = size;
        const ctx = sample.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(loadedImage, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size);
        const worker = new Worker(new URL('./imageStudio.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (event) => { setQuality(event.data); worker.terminate(); };
        worker.postMessage({ pixels: data.data, width: loadedImage.naturalWidth, height: loadedImage.naturalHeight, originalBytes: currentImage?.file?.size || currentImage?.size || 0 });
      } catch {
        setQuality({ score: 0, suggestions: ['L’analyse locale nécessite une image autorisant l’accès sécurisé.'], checks: {} });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [currentImage, isOpen, loadedImage]);

  useEffect(() => {
    if (!loadedImage || !isOpen) return undefined;
    const timer = window.setTimeout(() => {
      const output = document.createElement('canvas');
      renderToCanvas({ canvas: output, image: loadedImage, state, backgroundImage: loadedBackground });
      output.toBlob((blob) => setEstimate(blob?.size || 0), state.output.format, getOutputQuality(state.output.compression));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isOpen, loadedBackground, loadedImage, state]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'REDO' : 'UNDO' });
      }
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const exportFile = useCallback(async () => {
    const canvas = document.createElement('canvas');
    renderToCanvas({ canvas, image: loadedImage, state, backgroundImage: loadedBackground });
    let mime = state.output.format;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, getOutputQuality(state.output.compression)));
    if (!blob || blob.type !== mime) {
      mime = 'image/webp';
      blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, getOutputQuality(state.output.compression)));
    }
    const base = String(currentImage?.name || currentImage?.file?.name || 'produit').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}-hdmarket.${extensionForMime(mime)}`, { type: mime, lastModified: Date.now() });
  }, [currentImage, loadedBackground, loadedImage, state]);

  const exportImageItem = useCallback(async (item, index) => {
    if (index === selectedIndex) return exportFile();
    const sourceUrl = resolveSource(item);
    const imageElement = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.crossOrigin = 'anonymous';
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error(`La photo ${index + 1} ne peut pas être traitée.`));
      nextImage.src = sourceUrl;
    });
    const canvas = document.createElement('canvas');
    renderToCanvas({ canvas, image: imageElement, state, backgroundImage: loadedBackground });
    let mime = state.output.format;
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, getOutputQuality(state.output.compression)));
    if (!blob || blob.type !== mime) {
      mime = 'image/webp';
      blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, getOutputQuality(state.output.compression)));
    }
    const base = String(item?.name || item?.file?.name || `produit-${index + 1}`).replace(/\.[^.]+$/, '');
    return new File([blob], `${base}-hdmarket.${extensionForMime(mime)}`, { type: mime, lastModified: Date.now() });
  }, [exportFile, loadedBackground, selectedIndex, state]);

  const handleSave = async () => {
    if (!loadedImage || saving) return;
    setSaving(true);
    setMessage('');
    try {
      if (applyScope === 'selected' || images.length <= 1) {
        const file = await exportFile();
        await onSave?.({ file, state, sourceIndex: selectedIndex, applyScope, quality });
      } else {
        const files = [];
        for (let index = 0; index < images.length; index += 1) {
          files.push({ file: await exportImageItem(images[index], index), sourceIndex: index });
        }
        await onSave?.({ files, state, sourceIndex: selectedIndex, applyScope, quality });
      }
      localStorage.removeItem(draftKey);
      onClose?.();
    } catch (error) {
      setMessage(error?.message || 'Impossible d’enregistrer la photo.');
    } finally {
      setSaving(false);
    }
  };

  const runAiTool = async (operation) => {
    if (operation === 'enhance') {
      change((prev) => applyPreset({ ...prev, aiOperations: [...new Set([...(prev.aiOperations || []), operation])] }, 'Studio'));
      return;
    }
    if (operation === 'smart-crop') {
      change((prev) => ({ ...prev, aspectRatio: '1:1', zoom: Math.max(1.08, prev.zoom), pan: { x: 0, y: 0 }, aiOperations: [...new Set([...(prev.aiOperations || []), operation])] }));
      return;
    }
    setProcessing(operation);
    setMessage('');
    try {
      const file = await exportFile();
      const result = await imageStudioService.process({ file, operation, parameters: { shadow: state.shadow } });
      if (!result?.imageUrl) throw new Error(result?.message || 'Le traitement n’a retourné aucune image.');
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const nextFile = new File([blob], file.name, { type: blob.type || file.type });
      await onSave?.({ file: nextFile, state: { ...state, aiOperations: [...new Set([...(state.aiOperations || []), operation])] }, sourceIndex: selectedIndex, applyScope: 'selected', quality, keepOpen: true });
      setMessage('Traitement appliqué. La photo a été ajoutée au produit.');
    } catch (error) {
      setMessage(error?.response?.data?.message || error?.message || 'Ce traitement est temporairement indisponible.');
    } finally {
      setProcessing('');
    }
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, pan: state.pan };
  };
  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = dragRef.current.pan.x + (event.clientX - dragRef.current.x) / rect.width * 100;
    const y = dragRef.current.pan.y + (event.clientY - dragRef.current.y) / rect.height * 100;
    change((prev) => ({ ...prev, pan: { x: Math.max(-50, Math.min(50, x)), y: Math.max(-50, Math.min(50, y)) } }));
    dragRef.current = { x: event.clientX, y: event.clientY, pan: { x, y } };
  };

  if (!isOpen) return null;

  const renderPanel = () => {
    if (activeTool === 'crop') return <div className="space-y-5">
      <PanelTitle title="Recadrage & cadrage" subtitle="Glissez directement la photo pour la repositionner." />
      <div className="grid grid-cols-3 gap-2">{ASPECT_RATIOS.map((ratio) => <StudioButton key={ratio.id} active={state.aspectRatio === ratio.id} onClick={() => change((prev) => ({ ...prev, aspectRatio: ratio.id }))}>{ratio.label}</StudioButton>)}</div>
      <div className="grid grid-cols-3 gap-2">
        <StudioButton icon={RotateCw} onClick={() => change((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))}>Tourner</StudioButton>
        <StudioButton icon={FlipHorizontal} active={state.flipX} onClick={() => change((prev) => ({ ...prev, flipX: !prev.flipX }))}>Miroir H</StudioButton>
        <StudioButton icon={FlipVertical} active={state.flipY} onClick={() => change((prev) => ({ ...prev, flipY: !prev.flipY }))}>Miroir V</StudioButton>
      </div>
      <Range label="Zoom" value={state.zoom} min={0.7} max={3} step={0.01} display={`${Math.round(state.zoom * 100)}%`} onChange={(zoom) => change((prev) => ({ ...prev, zoom }))} />
      <div className="grid grid-cols-2 gap-3"><NumberField label="Largeur" value={state.output.width} onChange={(width) => change((prev) => ({ ...prev, output: { ...prev.output, width } }))} /><NumberField label="Hauteur" value={state.output.height} onChange={(height) => change((prev) => ({ ...prev, output: { ...prev.output, height } }))} /></div>
    </div>;
    if (activeTool === 'adjust') return <div className="space-y-4"><PanelTitle title="Réglages professionnels" subtitle="Chaque réglage est appliqué instantanément." />{ADJUSTMENT_DEFINITIONS.map((item) => <Range key={item.key} label={item.label} value={state.adjustments[item.key]} min={item.min} max={item.max} step={1} display={`${state.adjustments[item.key]}${item.unit}`} onChange={(value) => change((prev) => ({ ...prev, preset: 'Personnalisé', adjustments: { ...prev.adjustments, [item.key]: value } }))} />)}</div>;
    if (activeTool === 'filters') return <div className="space-y-4"><PanelTitle title="Filtres produit" subtitle="Les presets restent entièrement modifiables." /><div className="grid grid-cols-2 gap-2">{Object.keys(FILTER_PRESETS).map((name) => <button key={name} type="button" onClick={() => change((prev) => applyPreset(prev, name))} className={`min-h-20 rounded-2xl border p-3 text-left transition ${state.preset === name ? 'border-[#e85d00] bg-[#fff0e4]' : 'border-[#e2dcd2] bg-white'}`}><span className="block h-7 rounded-lg bg-gradient-to-r from-stone-200 via-orange-100 to-stone-500" /><span className="mt-2 block text-xs font-black text-[#231f1b]">{name}</span></button>)}</div></div>;
    if (activeTool === 'background') return <div className="space-y-5"><PanelTitle title="Arrière-plan" subtitle="Choisissez une surface ou importez votre décor." /><div className="grid grid-cols-3 gap-2">{BACKGROUNDS.map((background) => <button key={background.id} type="button" onClick={() => change((prev) => ({ ...prev, background }))} className={`rounded-2xl border p-2 ${state.background.id === background.id ? 'border-[#e85d00] ring-2 ring-[#fff0e4]' : 'border-[#e2dcd2]'}`}><span className="block aspect-square rounded-xl border border-black/5" style={{ background: background.value || 'repeating-conic-gradient(#e5e7eb 0 25%,#fff 0 50%) 0/12px 12px' }} /><span className="mt-1.5 block text-[11px] font-bold">{background.label}</span></button>)}</div><label className="block"><span className="mb-2 block text-xs font-black">Couleur personnalisée</span><input type="color" className="h-11 w-full rounded-xl border border-[#e2dcd2]" value={state.background.value?.startsWith('#') ? state.background.value : '#ffffff'} onChange={(event) => change((prev) => ({ ...prev, background: { id: 'custom', value: event.target.value, customUrl: '' } }))} /></label><label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#bcb3a8] bg-white px-3 text-xs font-black"><ImageIcon className="mr-2 h-4 w-4" />Importer un arrière-plan<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => change((prev) => ({ ...prev, background: { id: 'uploaded', value: null, customUrl: String(reader.result || '') } })); reader.readAsDataURL(file); }} /></label><PanelTitle title="Modèles" subtitle="Mise en scène optimisée par catégorie." /><div className="grid grid-cols-2 gap-2">{TEMPLATES.map((template) => <StudioButton key={template.id} onClick={() => change((prev) => ({ ...prev, aspectRatio: template.aspectRatio, background: { id: template.id, value: template.background }, shadow: { ...prev.shadow, type: template.shadow } }))}>{template.label}</StudioButton>)}</div></div>;
    if (activeTool === 'ai') return <div className="space-y-4"><PanelTitle title="Outils intelligents" subtitle="Les traitements distants passent uniquement par HDMarket." /><button type="button" onClick={() => change((prev) => applySmartOptimization(prev, shopName))} className="w-full rounded-2xl bg-[#231f1b] p-4 text-left text-white shadow-lg"><span className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-5 w-5 text-[#ff8a3d]" />Optimiser pour HDMarket</span><span className="mt-1 block text-xs text-white/60">Cadrage, WEBP, qualité, fond, ombre et filigrane</span></button><div className="space-y-2">{AI_TOOLS.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" disabled={Boolean(processing)} onClick={() => runAiTool(id)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-[#e2dcd2] bg-white p-3 text-left disabled:opacity-50"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5f2ee]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black">{label}</span><span className="block truncate text-xs text-stone-500">{description}</span></span>{processing === id ? <Loader2 className="h-5 w-5 animate-spin text-[#e85d00]" /> : <ChevronDown className="h-4 w-4 -rotate-90 text-stone-400" />}</button>)}</div><PanelTitle title="Ombre" /><div className="grid grid-cols-3 gap-2">{['none','soft','studio','floating','product','natural'].map((type) => <StudioButton key={type} active={state.shadow.type === type} onClick={() => change((prev) => ({ ...prev, shadow: { ...prev.shadow, type } }))}>{type}</StudioButton>)}</div><Range label="Opacité de l’ombre" value={state.shadow.opacity} min={0} max={100} step={1} display={`${state.shadow.opacity}%`} onChange={(opacity) => change((prev) => ({ ...prev, shadow: { ...prev.shadow, opacity } }))} /></div>;
    if (activeTool === 'watermark') return <div className="space-y-5"><PanelTitle title="Filigrane" subtitle="Protégez vos visuels sans gêner le produit." /><label className="flex min-h-12 items-center justify-between rounded-xl border border-[#e2dcd2] px-3"><span className="text-sm font-black">Afficher le filigrane</span><input type="checkbox" checked={state.watermark.enabled} onChange={(event) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, enabled: event.target.checked } }))} className="h-5 w-5 accent-[#e85d00]" /></label><SelectField label="Type" value={state.watermark.type} options={[['shop-name','Nom de boutique'],['verified','HDMarket Verified'],['qr','QR Code'],['custom','Texte personnalisé']]} onChange={(type) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, type } }))} /><label className="block"><span className="mb-1 block text-xs font-black">Texte</span><input value={state.watermark.text} onChange={(event) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, text: event.target.value } }))} className="min-h-11 w-full rounded-xl border border-[#e2dcd2] px-3 text-sm" /></label><SelectField label="Position" value={state.watermark.position} options={[['top-left','En haut à gauche'],['top-right','En haut à droite'],['center','Au centre'],['bottom-left','En bas à gauche'],['bottom-right','En bas à droite']]} onChange={(position) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, position } }))} /><Range label="Opacité" value={state.watermark.opacity} min={10} max={100} step={1} display={`${state.watermark.opacity}%`} onChange={(opacity) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, opacity } }))} /><Range label="Échelle" value={state.watermark.scale} min={50} max={200} step={1} display={`${state.watermark.scale}%`} onChange={(scale) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, scale } }))} /><Range label="Rotation" value={state.watermark.rotation} min={-180} max={180} step={1} display={`${state.watermark.rotation}°`} onChange={(rotation) => change((prev) => ({ ...prev, watermark: { ...prev.watermark, rotation } }))} /></div>;
    return <div className="space-y-5"><PanelTitle title="Optimisation & export" subtitle="WEBP offre le meilleur équilibre pour HDMarket." /><SelectField label="Format" value={state.output.format} options={[['image/webp','WEBP — recommandé'],['image/jpeg','JPEG'],['image/png','PNG'],['image/avif','AVIF']]} onChange={(format) => change((prev) => ({ ...prev, output: { ...prev.output, format } }))} /><SelectField label="Compression" value={state.output.compression} options={[['low','Faible — qualité maximale'],['medium','Moyenne — recommandée'],['high','Élevée — fichier léger']]} onChange={(compression) => change((prev) => ({ ...prev, output: { ...prev.output, compression } }))} /><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><span className="block text-xs font-bold text-emerald-700">Taille finale estimée</span><span className="mt-1 block text-2xl font-black text-emerald-950">{estimate ? formatFileSize(estimate) : 'Calcul…'}</span></div><QualityPanel quality={quality} /></div>;
  };

  return <div className="fixed inset-0 z-[1000] flex flex-col bg-[#f5f2ee] text-[#231f1b]" role="dialog" aria-modal="true" aria-label="Studio photo produit">
    <header className="flex min-h-16 items-center gap-2 border-b border-[#e2dcd2] bg-white px-3 pt-[env(safe-area-inset-top)] sm:px-5">
      <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f5f2ee]" aria-label="Fermer"><ArrowLeft className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1"><h2 className="truncate text-base font-black sm:text-lg">Studio photo HDMarket</h2><p className="hidden text-xs text-stone-500 sm:block">Édition non destructive · Brouillon enregistré automatiquement</p></div>
      <button type="button" onClick={() => dispatch({ type: 'UNDO' })} disabled={!history.past.length} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f5f2ee] disabled:opacity-30" aria-label="Annuler"><Undo2 className="h-5 w-5" /></button>
      <button type="button" onClick={() => dispatch({ type: 'REDO' })} disabled={!history.future.length} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f5f2ee] disabled:opacity-30" aria-label="Rétablir"><Redo2 className="h-5 w-5" /></button>
      <button type="button" onClick={handleSave} disabled={!loadedImage || saving} className="flex min-h-11 items-center gap-2 rounded-full bg-[#231f1b] px-4 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="hidden sm:inline">Enregistrer</span></button>
    </header>
    <div className="flex min-h-0 flex-1">
      <nav className="hidden w-24 shrink-0 border-r border-[#e2dcd2] bg-white py-3 md:block">{TOOLS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTool(id)} className={`mx-2 mb-1 flex min-h-[68px] w-20 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold ${activeTool === id ? 'bg-[#fff0e4] text-[#b94700]' : 'text-stone-600 hover:bg-[#f5f2ee]'}`}><Icon className="h-5 w-5" />{label}</button>)}</nav>
      <main className="relative flex min-w-0 flex-1 flex-col bg-[#302d2a]">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2"><button type="button" onClick={() => setCompare((value) => !value)} className={`min-h-10 rounded-full px-3 text-xs font-black shadow ${compare ? 'bg-[#e85d00] text-white' : 'bg-white/90 text-[#231f1b]'}`}>Avant / Après</button>{draftRestored ? <span className="rounded-full bg-white/90 px-3 py-2 text-[11px] font-bold"><Cloud className="mr-1 inline h-3.5 w-3.5 text-emerald-600" />Brouillon restauré</span> : null}</div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 pb-20 sm:p-8">
          <div className="relative max-h-full max-w-full overflow-hidden rounded-md bg-[repeating-conic-gradient(#ddd_0_25%,#fff_0_50%)] bg-[length:20px_20px] shadow-2xl touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current = null; }}>
            {compare ? <canvas ref={originalCanvasRef} className="block max-h-[62vh] max-w-full" /> : null}<canvas ref={canvasRef} className={`block max-h-[62vh] max-w-full ${compare ? 'absolute inset-0 [clip-path:inset(0_0_0_50%)]' : ''}`} />
            {compare ? <div className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 bg-white shadow"><span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow"><PanelRightClose className="h-4 w-4" /></span></div> : null}
          </div>
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur"><button type="button" onClick={() => change((prev) => ({ ...prev, zoom: Math.max(.7, prev.zoom - .1) }))} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><ZoomOut className="h-4 w-4" /></button><span className="w-12 text-center text-xs font-black">{Math.round(state.zoom * 100)}%</span><button type="button" onClick={() => change((prev) => ({ ...prev, zoom: Math.min(3, prev.zoom + .1) }))} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><ZoomIn className="h-4 w-4" /></button></div>
      </main>
      <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-[#e2dcd2] bg-[#faf8f5] p-5 lg:block">{renderPanel()}</aside>
    </div>
    <div className="border-t border-[#e2dcd2] bg-white lg:hidden">
      <div className="flex gap-1 overflow-x-auto px-2 py-2 [scrollbar-width:none]">{TOOLS.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setActiveTool(id)} className={`flex min-h-14 min-w-[70px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold ${activeTool === id ? 'bg-[#fff0e4] text-[#b94700]' : 'text-stone-500'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
      <div className="max-h-[42vh] overflow-y-auto border-t border-[#e2dcd2] bg-[#faf8f5] p-4">{renderPanel()}</div>
    </div>
    <footer className="flex min-h-14 items-center gap-3 border-t border-[#e2dcd2] bg-white px-3 pb-[env(safe-area-inset-bottom)] sm:px-5">
      {images.length > 1 ? <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto py-2">{images.map((item, index) => <button key={item?.url || item?.name || index} type="button" onClick={() => setSelectedIndex(index)} className={`h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 ${selectedIndex === index ? 'border-[#e85d00]' : 'border-transparent'}`}><img src={resolveSource(item)} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div> : <div className="flex-1 text-xs font-bold text-stone-500"><ImageIcon className="mr-1 inline h-4 w-4" />Photo {selectedIndex + 1}</div>}
      <select value={applyScope} onChange={(event) => setApplyScope(event.target.value)} className="min-h-11 rounded-xl border border-[#e2dcd2] bg-white px-3 text-xs font-bold"><option value="selected">Image sélectionnée</option><option value="all">Toutes les images</option><option value="product">Produit entier</option></select>
      <button type="button" onClick={() => dispatch({ type: 'RESET', payload: initialState })} className="hidden min-h-11 rounded-xl px-3 text-xs font-bold text-red-700 sm:block">Réinitialiser</button>
    </footer>
    {message ? <div className="fixed bottom-20 left-1/2 z-20 max-w-[90vw] -translate-x-1/2 rounded-full bg-[#231f1b] px-4 py-3 text-center text-xs font-bold text-white shadow-xl">{message}<button type="button" className="ml-3" onClick={() => setMessage('')}><X className="inline h-4 w-4" /></button></div> : null}
  </div>;
}

const PanelTitle = ({ title, subtitle }) => <div><h3 className="text-base font-black">{title}</h3>{subtitle ? <p className="mt-1 text-xs leading-relaxed text-stone-500">{subtitle}</p> : null}</div>;
const Range = ({ label, value, min, max, step, display, onChange }) => <label className="block"><span className="mb-2 flex justify-between text-xs font-black"><span>{label}</span><span className="text-[#b94700]">{display}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-1.5 w-full accent-[#e85d00]" /></label>;
const NumberField = ({ label, value, onChange }) => <label className="block"><span className="mb-1 block text-xs font-black">{label}</span><input type="number" min="320" max="6000" value={value} onChange={(event) => onChange(Math.max(320, Math.min(6000, Number(event.target.value) || 320)))} className="min-h-11 w-full rounded-xl border border-[#e2dcd2] px-3 text-sm" /></label>;
const SelectField = ({ label, value, options, onChange }) => <label className="block"><span className="mb-1 block text-xs font-black">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-[#e2dcd2] bg-white px-3 text-sm font-bold">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
const QualityPanel = ({ quality }) => <div className="rounded-2xl border border-[#e2dcd2] bg-white p-4"><div className="flex items-center gap-3"><span className="flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-emerald-500 text-lg font-black">{quality.score || '–'}</span><div><span className="text-sm font-black">Score qualité</span><span className="block text-xs text-stone-500">Analyse locale, privée et rapide</span></div></div><div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(quality.checks || {}).map(([key, result]) => <div key={key} className="flex items-center gap-1.5 text-xs"><Check className={`h-3.5 w-3.5 ${result === 'good' ? 'text-emerald-600' : result === 'bad' ? 'text-red-600' : 'text-amber-600'}`} />{CHECK_LABELS[key] || key}</div>)}</div>{quality.suggestions?.length ? <div className="mt-4 border-t border-[#eee8e0] pt-3"><span className="text-xs font-black">Suggestions</span>{quality.suggestions.map((suggestion) => <p key={suggestion} className="mt-1 text-xs text-stone-600">• {suggestion}</p>)}</div> : <p className="mt-3 text-xs font-bold text-emerald-700"><BadgeCheck className="mr-1 inline h-4 w-4" />Image prête pour la marketplace</p>}</div>;
