import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Eye,
  Heart,
  Loader2,
  MousePointerClick,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShoppingCart,
  Store,
  Trash2,
  Upload,
  XCircle
} from 'lucide-react';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import {
  getVideoFileValidationError,
  getVideoFilesUploadProgress,
  getVideoUploadErrorMessage
} from '../utils/videoUploadErrors';

const statusStyles = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-rose-100 text-rose-700',
  hidden: 'bg-neutral-200 text-neutral-700',
  deleted: 'bg-neutral-200 text-neutral-500'
};

const statusLabels = {
  approved: 'Publiée',
  pending: 'En modération',
  rejected: 'Refusée',
  hidden: 'Masquée',
  deleted: 'Supprimée'
};

const readDuration = (file) =>
  new Promise((resolve, reject) => {
    const element = document.createElement('video');
    const url = URL.createObjectURL(file);
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number(element.duration || 0));
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Vidéo illisible.'));
    };
    element.src = url;
  });

function Metric({ icon: Icon, label, value, accent = 'text-neutral-900 dark:text-white' }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><Icon size={15} /> {label}</div>
      <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
    </div>
  );
}

function FeedbackAlert({ feedback }) {
  if (!feedback?.message) return null;
  const presentation = {
    success: {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
    },
    error: {
      icon: XCircle,
      className: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200'
    },
    info: {
      icon: Clock3,
      className: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200'
    }
  }[feedback.type] || {};
  const Icon = presentation.icon || Clock3;
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-bold leading-5 ${presentation.className || ''}`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      <span>{feedback.message}</span>
    </div>
  );
}

function SellerVideoPlayer({ video }) {
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const source = String(
    video?.videoUrl ||
      video?.playbackSources?.find((item) => String(item?.type || '').includes('mp4'))?.url ||
      video?.playbackSources?.find((item) => item?.url)?.url ||
      ''
  );
  const poster = video?.thumbnailUrl || video?.product?.images?.[0] || '';

  useEffect(() => setPlaybackFailed(false), [source]);

  if (!source || playbackFailed) {
    return (
      <div className="relative h-full w-full">
        {poster ? <img src={poster} alt="" className="h-full w-full object-cover opacity-70" loading="lazy" /> : null}
        <div className="absolute inset-0 grid place-items-center bg-black/45 px-5 text-center text-white">
          <div>
            <XCircle className="mx-auto" size={28} />
            <p className="mt-2 text-xs font-bold">
              {source ? 'Cette vidéo ne peut pas être lue pour le moment.' : 'Source vidéo indisponible.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <video
      key={source}
      src={source}
      poster={poster || undefined}
      controls
      playsInline
      preload="metadata"
      onError={() => setPlaybackFailed(true)}
      className="h-full w-full object-contain"
      aria-label={`Lire la vidéo de ${video?.product?.title || 'ce produit'}`}
    >
      Votre navigateur ne peut pas lire cette vidéo.
    </video>
  );
}

export default function SellerProductVideos() {
  const { user } = useContext(AuthContext);
  const { getRuntimeValue, formatPrice } = useAppSettings();
  const { showToast } = useToast();
  const [videos, setVideos] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [productId, setProductId] = useState('');
  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState([]);
  const [fileUploadProgress, setFileUploadProgress] = useState([]);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [videoFeedback, setVideoFeedback] = useState({});
  const [replacingVideoId, setReplacingVideoId] = useState('');
  const fileInputRef = useRef(null);
  const maxDuration = Number(getRuntimeValue('product_video_max_duration_seconds', 60));
  const maxUploads = Number(getRuntimeValue('product_video_max_uploads_per_product', 1));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [videosResult, analyticsResult, productsResult] = await Promise.all([
        api.get('/product-videos/seller/mine', { headers: { 'x-skip-cache': '1' } }),
        api.get('/product-videos/seller/analytics', { headers: { 'x-skip-cache': '1' } }),
        api.get('/products', { headers: { 'x-skip-cache': '1' } })
      ]);
      setVideos(videosResult.data?.items || []);
      setAnalytics(analyticsResult.data || null);
      const productPayload = productsResult.data;
      setProducts(Array.isArray(productPayload) ? productPayload : productPayload?.products || productPayload?.items || []);
    } catch (error) {
      showToast(error.response?.data?.message || 'Impossible de charger votre espace vidéo.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && user.accountType !== 'shop') {
      setLoading(false);
      return;
    }
    load();
  }, [load, user]);

  const selectedProductVideos = useMemo(
    () => videos.filter((video) => String(video.product?._id || video.product) === String(productId) && video.status !== 'deleted').length,
    [productId, videos]
  );

  const chooseFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    setFiles([]);
    setFileUploadProgress([]);
    setUploadFeedback(null);
    if (!productId) {
      const message = 'Choisissez d’abord le produit associé à cette vidéo.';
      setUploadFeedback({ type: 'error', message });
      showToast(message, { variant: 'error' });
      event.target.value = '';
      return;
    }
    const fileError = selected.map(getVideoFileValidationError).find(Boolean);
    if (fileError) {
      setUploadFeedback({ type: 'error', message: fileError });
      showToast(fileError, { variant: 'error' });
      event.target.value = '';
      return;
    }
    if (selected.length + selectedProductVideos > maxUploads) {
      const message = `Maximum ${maxUploads} vidéos pour ce produit. Supprimez ou remplacez une vidéo existante.`;
      setUploadFeedback({ type: 'error', message });
      showToast(message, { variant: 'error' });
      event.target.value = '';
      return;
    }
    try {
      setUploadFeedback({ type: 'info', message: 'Vérification des vidéos sélectionnées…' });
      const durations = await Promise.all(
        selected.map(async (file) => {
          try {
            return await readDuration(file);
          } catch {
            throw new Error(`${file.name} est illisible ou endommagée.`);
          }
        })
      );
      const invalidIndex = durations.findIndex((duration) => duration > maxDuration);
      if (invalidIndex >= 0) {
        const message = `${selected[invalidIndex].name} dépasse la durée maximale de ${maxDuration} secondes.`;
        setUploadFeedback({ type: 'error', message });
        showToast(message, { variant: 'error' });
        event.target.value = '';
        return;
      }
      setFiles(selected);
      setFileUploadProgress(selected.map(() => 0));
      setUploadFeedback({
        type: 'success',
        message: `${selected.length} vidéo${selected.length > 1 ? 's' : ''} prête${selected.length > 1 ? 's' : ''} à être envoyée${selected.length > 1 ? 's' : ''}.`
      });
    } catch (error) {
      const message = error.message || 'Une vidéo est illisible.';
      setUploadFeedback({ type: 'error', message });
      showToast(message, { variant: 'error' });
      event.target.value = '';
    }
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!productId || !files.length) {
      setUploadFeedback({ type: 'error', message: 'Sélectionnez un produit et au moins une vidéo.' });
      return;
    }
    const body = new FormData();
    body.append('productId', productId);
    body.append('caption', caption);
    files.forEach((file) => body.append('video', file));
    setUploading(true);
    setUploadProgress(0);
    setFileUploadProgress(files.map(() => 0));
    setUploadFeedback({ type: 'info', message: 'Envoi en cours. Gardez cette page ouverte jusqu’à la confirmation.' });
    try {
      const { data } = await api.post('/product-videos/seller', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
          setFileUploadProgress(getVideoFilesUploadProgress(files, event.loaded, event.total));
        }
      });
      const message = data?.moderationRequired ? 'Vidéo envoyée à la modération.' : 'Vidéo publiée avec succès.';
      showToast(message, { variant: 'success' });
      setUploadFeedback({ type: 'success', message });
      setCaption('');
      setFiles([]);
      setFileUploadProgress([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (error) {
      const message = getVideoUploadErrorMessage(error);
      setUploadFeedback({ type: 'error', message });
      showToast(message, { variant: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const replaceVideo = async (video, file, input) => {
    if (!file) return;
    const setFeedback = (feedback) =>
      setVideoFeedback((current) => ({ ...current, [video._id]: feedback }));
    const fileError = getVideoFileValidationError(file);
    if (fileError) {
      setFeedback({ type: 'error', message: fileError });
      showToast(fileError, { variant: 'error' });
      input.value = '';
      return;
    }

    setReplacingVideoId(video._id);
    setFeedback({ type: 'info', message: 'Vérification de la nouvelle vidéo…' });
    try {
      const duration = await readDuration(file);
      if (duration > maxDuration) {
        throw new Error(`${file.name} dépasse la durée maximale de ${maxDuration} secondes.`);
      }
      const body = new FormData();
      body.append('video', file);
      setFeedback({ type: 'info', message: 'Remplacement en cours…' });
      await api.patch(`/product-videos/seller/${video._id}`, body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFeedback({ type: 'success', message: 'Nouvelle version envoyée avec succès.' });
      showToast('Nouvelle version envoyée.', { variant: 'success' });
      await load();
    } catch (error) {
      const localValidationMessage = String(error?.message || '');
      const message =
        !error?.response &&
        (localValidationMessage.includes('durée maximale') ||
          localValidationMessage.includes('illisible'))
          ? localValidationMessage
          : getVideoUploadErrorMessage(error, 'Remplacement impossible.');
      setFeedback({ type: 'error', message });
      showToast(message, { variant: 'error' });
    } finally {
      setReplacingVideoId('');
      input.value = '';
    }
  };

  if (user && user.accountType !== 'shop') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Store size={26} /></span>
        <h1 className="mt-4 text-2xl font-black text-neutral-950 dark:text-white">Réservé aux boutiques</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Seuls les comptes Boutique peuvent publier des vidéos produit. Transformez votre compte pour présenter vos
          articles en vidéo et suivre leurs performances.
        </p>
        <Link to="/shop-conversion-request" className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-500 px-6 font-black text-white transition active:scale-95">
          <Store size={18} /> Devenir Boutique
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">Vendre en vidéo</p>
          <h1 className="mt-1 text-3xl font-black text-neutral-950 dark:text-white">Mes HDMarket Videos</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">Montrez le produit en situation, publiez plusieurs angles et suivez ce qui transforme les vues en ventes.</p>
        </div>
        <button type="button" onClick={load} className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 px-4 text-sm font-bold dark:border-white/10"><RefreshCw size={16} /> Actualiser</button>
      </div>

      <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Metric icon={Play} label="Vidéos" value={analytics?.videos || 0} />
        <Metric icon={Eye} label="Vues" value={analytics?.views || 0} />
        <Metric icon={Clock3} label="Visionnage moyen" value={`${analytics?.averageWatchSeconds || 0}s`} />
        <Metric icon={CheckCircle2} label="Complétion" value={`${analytics?.completionRate || 0}%`} />
        <Metric icon={MousePointerClick} label="CTR produit" value={`${analytics?.clickThroughRate || 0}%`} />
        <Metric icon={ShoppingCart} label="Ajouts panier" value={analytics?.addToCarts || 0} accent="text-emerald-600" />
      </section>

      <div className="mt-8 grid gap-7 lg:grid-cols-[380px_1fr]">
        <form onSubmit={upload} className="h-fit rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Plus /></span><div><h2 className="font-black">Nouvelle vidéo</h2><p className="text-xs text-neutral-500">MP4, MOV ou WEBM · {maxDuration}s max.</p></div></div>
          <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-neutral-500">Produit</label>
          <select
            required
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setFiles([]);
              setFileUploadProgress([]);
              setUploadFeedback(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="mt-2 h-12 w-full rounded-xl border border-neutral-200 bg-transparent px-3 outline-none focus:border-emerald-500 dark:border-white/10"
          >
            <option value="">Sélectionner un produit</option>
            {products.map((product) => <option key={product._id} value={product._id}>{product.title} · {formatPrice(product.price)}</option>)}
          </select>
          <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-neutral-500">Légende et hashtags</label>
          <textarea value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} placeholder="Montrez le détail qui fait la différence… #nouveauté" className="mt-2 min-h-24 w-full rounded-xl border border-neutral-200 bg-transparent p-3 outline-none focus:border-emerald-500 dark:border-white/10" />
          <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-4 text-center transition hover:border-emerald-400 dark:border-white/10 dark:bg-white/[0.03]">
            <Upload className="text-emerald-600" />
            <span className="mt-2 text-sm font-bold">{maxUploads > 1 ? `Choisir jusqu’à ${maxUploads} vidéos` : 'Choisir une vidéo'}</span>
            <span className="text-xs text-neutral-500">La compression adaptative est appliquée après l’envoi.</span>
            <input ref={fileInputRef} type="file" multiple={maxUploads > 1} accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" onChange={chooseFiles} className="sr-only" />
          </label>
          {files.length ? (
            <div className="mt-3 space-y-2">
              {files.map((file, index) => {
                const progress = fileUploadProgress[index] || 0;
                return (
                  <div key={`${file.name}-${file.size}-${file.lastModified || index}`} className="rounded-xl bg-neutral-100 px-3 py-2.5 text-xs dark:bg-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate font-bold">{file.name}</span>
                      <span className="shrink-0 text-neutral-500">
                        {uploading || progress > 0 ? `${progress}%` : `${Math.round(file.size / 1024 / 1024)} Mo`}
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10"
                      role="progressbar"
                      aria-label={`Progression de ${file.name}`}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={progress}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-200 ${progress === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-neutral-500">
                      {progress === 100 ? 'Vidéo envoyée' : uploading ? 'Envoi en cours…' : 'Prête à envoyer'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
          {uploadFeedback ? <div className="mt-3"><FeedbackAlert feedback={uploadFeedback} /></div> : null}
          {uploading ? (
            <div className="mt-4 space-y-1.5" role="status" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-center text-xs font-bold text-neutral-500">Envoi des vidéos… {uploadProgress}%</p>
            </div>
          ) : null}
          <button type="submit" disabled={uploading || !productId || !files.length} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} {uploading ? `Envoi en cours… ${uploadProgress}%` : 'Envoyer les vidéos'}
          </button>
        </form>

        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">Bibliothèque</h2><span className="text-sm text-neutral-500">{videos.filter((video) => video.status !== 'deleted').length} vidéo(s)</span></div>
          {!videos.length ? <div className="rounded-3xl border border-dashed border-neutral-300 p-12 text-center dark:border-white/15"><BarChart3 className="mx-auto text-neutral-400" /><p className="mt-3 font-bold">Votre première vidéo peut être publiée maintenant.</p></div> : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.filter((video) => video.status !== 'deleted').map((video) => (
              <article key={video._id} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
                <div className="relative aspect-[4/5] bg-neutral-950">
                  <SellerVideoPlayer video={video} />
                  <span className={`pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${statusStyles[video.status] || statusStyles.hidden}`}>{statusLabels[video.status] || video.status}</span>
                  <span className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white shadow-sm"><Eye size={12} /> {video.counters?.views || 0}</span>
                </div>
                <div className="p-4">
                  <p className="line-clamp-1 font-bold">{video.product?.title || 'Produit'}</p>
                  <p className="mt-1 line-clamp-2 min-h-9 text-xs text-neutral-500">{video.caption || 'Sans légende'}</p>
                  {video.moderationReason ? <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30">{video.moderationReason}</p> : null}
                  {videoFeedback[video._id] ? <div className="mt-2"><FeedbackAlert feedback={videoFeedback[video._id]} /></div> : null}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span><Eye size={13} className="mx-auto" />{video.counters?.views || 0}</span><span><Heart size={13} className="mx-auto" />{video.counters?.likes || 0}</span><span><Save size={13} className="mx-auto" />{video.counters?.saves || 0}</span></div>
                  <div className="mt-4 flex gap-2">
                    <label className={`flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-neutral-200 text-xs font-bold dark:border-white/10 ${replacingVideoId === video._id ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
                      {replacingVideoId === video._id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {replacingVideoId === video._id ? 'Envoi…' : 'Remplacer'}
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                        disabled={Boolean(replacingVideoId)}
                        className="sr-only"
                        onChange={(event) => replaceVideo(video, event.target.files?.[0], event.target)}
                      />
                    </label>
                    <button type="button" aria-label="Supprimer" onClick={async () => { if (!window.confirm('Supprimer définitivement cette vidéo ? Cette action est irréversible.')) return; try { await api.delete(`/product-videos/seller/${video._id}`); setVideos((items) => items.filter((item) => item._id !== video._id)); showToast('Vidéo supprimée.', { variant: 'success' }); } catch (error) { showToast(error.response?.data?.message || 'Suppression impossible.', { variant: 'error' }); } }} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 text-rose-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-8 flex flex-wrap gap-4 rounded-2xl bg-neutral-100 p-4 text-sm dark:bg-white/5"><span className="flex items-center gap-2"><CheckCircle2 className="text-emerald-500" size={18} /> Formats contrôlés</span><span className="flex items-center gap-2"><Clock3 className="text-amber-500" size={18} /> Modération configurable</span><span className="flex items-center gap-2"><XCircle className="text-rose-500" size={18} /> Contenu trompeur refusé</span></div>
    </div>
  );
}
