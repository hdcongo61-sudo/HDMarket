import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Hls from 'hls.js';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  Send,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { useToast } from '../context/ToastContext';
import { buildProductPath, buildShopPath } from '../utils/links';
import { readRouteViewCache, writeRouteViewCache } from '../utils/routeViewCache';
import { getVideoHashtags, stripVideoHashtags } from '../utils/videoHashtags';
import useNetworkProfile from '../hooks/useNetworkProfile';
import VerifiedBadge from '../components/VerifiedBadge';

const FILTERS = [
  ['for_you', 'Pour vous'],
  ['following', 'Abonnements'],
  ['trending', 'Tendances'],
  ['nearby', 'À proximité'],
  ['newest', 'Nouveautés'],
  ['discounts', 'Promos'],
  ['verified', 'Vendeurs vérifiés'],
  ['free_delivery', 'Livraison offerte'],
  ['wholesale', 'En gros']
];

const compactNumber = (value) =>
  new Intl.NumberFormat('fr', { notation: Number(value) > 999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(
    Number(value || 0)
  );

const getVideoSource = (video, lite = false) => {
  const sources = Array.isArray(video?.playbackSources) ? video.playbackSources : [];
  if (lite) {
    const liteSource = sources.find((source) => source.quality === '720p');
    if (liteSource?.url) return liteSource.url;
  }
  return sources.find((source) => source.quality === 'auto')?.url || video?.videoUrl || '';
};

// Mirrors the backend rule: an attribute needs a selection when it has no
// default value and is required (select groups with options always are).
const requiresAttributeSelection = (product) =>
  (Array.isArray(product?.attributes) ? product.attributes : []).some(
    (attribute) =>
      !attribute?.defaultValue &&
      (attribute?.required ||
        (attribute?.type === 'select' && Array.isArray(attribute?.options) && attribute.options.length > 0))
  );

function VideoAction({ label, value, active = false, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className="group flex min-w-12 flex-col items-center gap-1 text-white"
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full border border-white/15 shadow-lg backdrop-blur-md transition active:scale-90 ${
          active ? 'bg-rose-500 text-white' : 'bg-black/35 group-hover:bg-black/55'
        }`}
      >
        {children}
      </span>
      {value !== undefined ? <span className="text-[11px] font-bold drop-shadow">{compactNumber(value)}</span> : null}
    </button>
  );
}

function VideoSlide({
  video,
  active,
  defaultMuted,
  autoplay,
  formatPrice,
  user,
  preload = 'metadata',
  liteSource = false,
  onLike,
  onSave,
  onComments,
  onShare,
  onReport,
  onFollow,
  onAddToCart,
  onProductClick,
  onHashtag,
  inCart = false,
  onOpenCart
}) {
  const videoRef = useRef(null);
  const viewedRef = useRef({ startedAt: 0, watchedMs: 0, sent: false });
  const longPressRef = useRef(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const [muted, setMuted] = useState(defaultMuted);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [hashtagsExpanded, setHashtagsExpanded] = useState(false);

  const recordView = useCallback(() => {
    const tracker = viewedRef.current;
    // Count the in-progress segment too, otherwise a view is lost whenever
    // the slide unmounts while still active (page change, tab close).
    if (tracker.startedAt) {
      tracker.watchedMs += performance.now() - tracker.startedAt;
      tracker.startedAt = 0;
    }
    if (tracker.sent || tracker.watchedMs < 500) return;
    tracker.sent = true;
    api
      .post(
        `/product-videos/${video._id}/view`,
        {
          watchTimeMs: Math.round(tracker.watchedMs),
          durationMs: Math.round((videoRef.current?.duration || 0) * 1000),
          completed: Boolean(
            videoRef.current?.ended ||
              (videoRef.current?.duration && videoRef.current.currentTime / videoRef.current.duration >= 0.9)
          ),
          muted: Boolean(videoRef.current?.muted)
        },
        { silentGlobalError: true }
      )
      .catch(() => {});
  }, [video._id]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;
    if (active) {
      viewedRef.current = { startedAt: performance.now(), watchedMs: 0, sent: false };
      if (autoplay) {
        element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    } else {
      if (viewedRef.current.startedAt) {
        viewedRef.current.watchedMs += performance.now() - viewedRef.current.startedAt;
        viewedRef.current.startedAt = 0;
      }
      element.pause();
      setPlaying(false);
      recordView();
    }
    return undefined;
  }, [active, autoplay, recordView]);

  useEffect(() => () => recordView(), [recordView]);

  useEffect(() => {
    const handleVisibility = () => {
      const element = videoRef.current;
      if (!element) return;
      if (document.hidden) {
        element.pause();
        setPlaying(false);
        recordView();
      } else if (active && autoplay) {
        element.play().then(() => setPlaying(true)).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [active, autoplay, recordView]);

  // Pause while the navbar's mobile menu covers the feed; resume on close.
  useEffect(() => {
    const handleMenuToggle = (event) => {
      const element = videoRef.current;
      if (!element) return;
      if (event.detail?.open) {
        element.pause();
        setPlaying(false);
      } else if (active && autoplay && !document.hidden) {
        element.play().then(() => setPlaying(true)).catch(() => {});
      }
    };
    window.addEventListener('hdmarket:mobile-menu', handleMenuToggle);
    return () => window.removeEventListener('hdmarket:mobile-menu', handleMenuToggle);
  }, [active, autoplay]);

  const togglePlayback = () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      if (element.ended) element.currentTime = 0;
      element.play().then(() => setPlaying(true)).catch(() => {});
      setShowReplay(false);
    } else {
      element.pause();
      setPlaying(false);
    }
  };

  const handlePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    longPressRef.current = window.setTimeout(() => {
      videoRef.current?.pause();
      setPlaying(false);
    }, 500);
  };

  const handlePointerUp = (event) => {
    window.clearTimeout(longPressRef.current);
    const movement = Math.hypot(
      event.clientX - pointerStartRef.current.x,
      event.clientY - pointerStartRef.current.y
    );
    if (movement > 12) return;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      onLike();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      window.setTimeout(() => {
        if (lastTapRef.current === now) togglePlayback();
      }, 290);
    }
  };

  const product = video.product || {};
  const seller = video.seller || {};
  const captionText = useMemo(() => stripVideoHashtags(video.caption), [video.caption]);
  const hashtags = useMemo(
    () => getVideoHashtags(video),
    [video.caption, video.hashtags]
  );
  const visibleHashtags = hashtagsExpanded ? hashtags : hashtags.slice(0, 3);
  const originalPrice = Number(product.priceBeforeDiscount || 0);
  const discounted = Number(product.discount || 0) > 0;
  const mp4Source = getVideoSource(video, liteSource);

  // Adaptive bitrate: prefer the HLS stream when available, fall back to MP4.
  const [hlsFailed, setHlsFailed] = useState(false);
  const hlsUrl = useMemo(() => {
    if (hlsFailed) return '';
    const sources = Array.isArray(video?.playbackSources) ? video.playbackSources : [];
    const hls = sources.find(
      (item) =>
        String(item?.type || '').toLowerCase().includes('mpegurl') ||
        String(item?.url || '').endsWith('.m3u8')
    );
    return hls?.url || '';
  }, [video, hlsFailed]);
  const nativeHls = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(document.createElement('video').canPlayType('application/vnd.apple.mpegurl'));
  }, []);
  const useHlsJs = Boolean(hlsUrl) && !nativeHls && Hls.isSupported();
  const hlsActive = Boolean(hlsUrl) && (nativeHls || useHlsJs);
  const source = hlsActive && !useHlsJs ? hlsUrl : mp4Source;

  useEffect(() => {
    setHashtagsExpanded(false);
  }, [video._id]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !useHlsJs) return undefined;
    const hls = new Hls({
      capLevelToPlayerSize: true,
      maxBufferLength: 20,
      backBufferLength: 10
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(element);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data?.fatal) {
        hls.destroy();
        setHlsFailed(true);
      }
    });
    return () => hls.destroy();
  }, [hlsUrl, useHlsJs]);

  return (
    <article
      className="relative h-full w-full overflow-hidden bg-neutral-950 text-white"
      aria-label={`Vidéo du produit ${product.title || ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => window.clearTimeout(longPressRef.current)}
    >
      {!failed && (hlsActive || source) ? (
        <video
          ref={videoRef}
          src={useHlsJs ? undefined : source}
          poster={video.thumbnailUrl || product.images?.[0]}
          muted={muted}
          playsInline
          preload={preload}
          loop={false}
          className="h-full w-full object-cover"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            const element = event.currentTarget;
            setProgress(element.duration ? element.currentTime / element.duration : 0);
          }}
          onEnded={() => {
            setPlaying(false);
            setShowReplay(true);
            recordView();
          }}
          onError={() => (hlsActive ? setHlsFailed(true) : setFailed(true))}
        />
      ) : (
        <img
          src={video.thumbnailUrl || product.images?.[0]}
          alt={product.title || 'Produit'}
          className="h-full w-full object-cover"
          loading={active ? 'eager' : 'lazy'}
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/85" />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-2">
        {video.status === 'pending' ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-500/85 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            En modération · visible par vous uniquement
          </span>
        ) : null}
        {video.sponsored ? (
          <span className="rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[11px] font-semibold backdrop-blur-md">
            Sponsorisé
          </span>
        ) : null}
      </div>

      <AnimatePresence>
        {!playing || showReplay ? (
          <motion.button
            type="button"
            aria-label={showReplay ? 'Rejouer' : 'Lire'}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            onClick={(event) => {
              event.stopPropagation();
              togglePlayback();
            }}
            className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 shadow-2xl backdrop-blur-lg"
          >
            {showReplay ? <RotateCcw size={28} /> : <Play size={28} fill="currentColor" />}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div className="absolute bottom-16 right-3 z-10 flex flex-col items-center gap-4 sm:right-5">
        <Link
          to={buildShopPath(seller)}
          onClick={(event) => event.stopPropagation()}
          className="relative"
          aria-label={`Voir la boutique ${seller.shopName || seller.name || ''}`}
        >
          <img
            src={seller.shopLogo || seller.profileImage || '/default-avatar.png'}
            alt=""
            className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-xl"
          />
          <span className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-emerald-500 text-white">
            <Check size={13} strokeWidth={3} />
          </span>
        </Link>
        <VideoAction label={video.viewer?.liked ? 'Retirer le J’aime' : 'J’aime'} value={video.counters?.likes} active={video.viewer?.liked} onClick={onLike}>
          <Heart size={22} fill={video.viewer?.liked ? 'currentColor' : 'none'} />
        </VideoAction>
        <VideoAction label="Commentaires" value={video.counters?.comments} onClick={onComments}>
          <MessageCircle size={22} />
        </VideoAction>
        <VideoAction label={video.viewer?.saved ? 'Retirer des vidéos enregistrées' : 'Enregistrer'} value={video.counters?.saves} active={video.viewer?.saved} onClick={onSave}>
          <Bookmark size={22} fill={video.viewer?.saved ? 'currentColor' : 'none'} />
        </VideoAction>
        <VideoAction label="Partager" value={video.counters?.shares} onClick={onShare}>
          <Share2 size={22} />
        </VideoAction>
        <VideoAction label="Plus d’options" onClick={onReport}>
          <MoreHorizontal size={22} />
        </VideoAction>
        <VideoAction label={muted ? 'Activer le son' : 'Couper le son'} onClick={() => setMuted((value) => !value)}>
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </VideoAction>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[5] pr-20 sm:pr-24">
        {/* The mobile tab bar is hidden on /videos, so only the safe area
            needs clearing — 5.25rem left a dead band under the CTA row. */}
        <div className="space-y-2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:px-6 lg:pb-5">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Link to={buildShopPath(seller)} onClick={(event) => event.stopPropagation()} className="hover:underline">
              @{seller.shopName || seller.name || 'HDMarket'}
            </Link>
            {seller.shopVerified ? <VerifiedBadge verified showLabel={false} /> : null}
            {user && String(user._id || user.id) !== String(seller._id) ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFollow();
                }}
                className="rounded-full border border-white/60 px-3 py-1 text-xs transition hover:bg-white hover:text-black"
              >
                Suivre
              </button>
            ) : null}
          </div>
          {captionText ? <p className="line-clamp-2 text-sm leading-relaxed text-white/90">{captionText}</p> : null}
          {hashtags.length ? (
            <div
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${hashtagsExpanded ? 'max-h-24 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''}`}
              aria-label="Hashtags de la vidéo"
            >
              {visibleHashtags.map((hashtag) => (
                <button
                  key={hashtag.toLocaleLowerCase('fr')}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onHashtag?.(hashtag);
                  }}
                  className="font-bold text-emerald-300 transition hover:text-emerald-200 hover:underline"
                >
                  #{hashtag}
                </button>
              ))}
              {hashtags.length > 3 ? (
                <button
                  type="button"
                  aria-expanded={hashtagsExpanded}
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerUp={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setHashtagsExpanded((value) => !value);
                  }}
                  className="rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[11px] font-black text-white shadow-sm backdrop-blur-md transition hover:bg-black/55"
                >
                  {hashtagsExpanded ? 'Voir moins' : `+${hashtags.length - 3}`}
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onProductClick();
            }}
            className="block max-w-full text-left"
          >
            <span className="line-clamp-1 text-base font-bold">{product.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-black">{formatPrice(product.price)}</span>
              {discounted ? (
                <>
                  {originalPrice ? <span className="text-xs text-white/60 line-through">{formatPrice(originalPrice)}</span> : null}
                  <span className="rounded-md bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold">-{product.discount}%</span>
                </>
              ) : null}
            </span>
          </button>
          <div className="flex items-center gap-2 text-xs text-white/75">
            <MapPin size={13} /> {product.city || seller.city || 'Congo'}
            <span>•</span>
            <span>{compactNumber(video.counters?.views)} vues</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (inCart) onOpenCart();
                else onAddToCart();
              }}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl font-bold shadow-lg transition active:scale-[0.98] ${
                inCart ? 'bg-gradient-to-r from-[#FFB000] to-[#FF6A00] text-white' : 'bg-white text-neutral-950'
              }`}
            >
              {inCart ? (
                <>
                  <Check size={18} strokeWidth={2.5} /> Ajouté
                </>
              ) : (
                <>
                  <ShoppingCart size={18} /> Ajouter
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onProductClick(true);
              }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold shadow-lg transition active:scale-[0.98]"
            >
              <ShoppingBag size={18} /> Acheter
            </button>
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/20">
        <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
      </div>
    </article>
  );
}

function CartOptionsSheet({ video, formatPrice, submitting, onClose, onConfirm }) {
  const product = video?.product || {};
  const attributes = (Array.isArray(product.attributes) ? product.attributes : []).filter(
    (attribute) => attribute && attribute.name
  );
  const requiredAttributes = attributes.filter(
    (attribute) =>
      !attribute.defaultValue &&
      (attribute.required ||
        (attribute.type === 'select' && Array.isArray(attribute.options) && attribute.options.length > 0))
  );
  const [selections, setSelections] = useState({});
  const missing = requiredAttributes.filter((attribute) => !selections[attribute.name]);

  const priceOverride = attributes.reduce((found, attribute) => {
    if (found !== null) return found;
    const value = selections[attribute.name];
    const price = value ? Number(attribute.optionPrices?.[value]) : NaN;
    return Number.isFinite(price) && price > 0 ? price : found;
  }, null);
  const displayPrice = priceOverride ?? product.price;

  const confirm = () => {
    if (missing.length || submitting) return;
    const selectedAttributes = attributes
      .map((attribute) => ({
        name: attribute.name,
        value: selections[attribute.name] || attribute.defaultValue || ''
      }))
      .filter((entry) => entry.value !== '');
    onConfirm(selectedAttributes);
  };

  return (
    <>
      <motion.button
        type="button"
        aria-label="Fermer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[240] bg-black/55"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        role="dialog"
        aria-modal="true"
        aria-label="Choisir les options du produit"
        className="fixed inset-x-0 bottom-0 z-[250] mx-auto max-w-lg rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-neutral-900 shadow-2xl dark:bg-neutral-900 dark:text-white"
      >
        <div className="flex items-start gap-3">
          <img
            src={video?.thumbnailUrl || product.images?.[0]}
            alt=""
            className="h-16 w-16 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-bold">{product.title || 'Produit'}</p>
            <p className="mt-1 text-lg font-black text-emerald-600">{formatPrice(displayPrice)}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 dark:bg-white/10">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 max-h-[40vh] space-y-4 overflow-y-auto">
          {attributes.map((attribute) => (
            <div key={attribute.name}>
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                {attribute.name}
                {requiredAttributes.includes(attribute) ? <span className="text-rose-500"> *</span> : null}
              </p>
              {Array.isArray(attribute.options) && attribute.options.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attribute.options.map((option) => {
                    const selected = selections[attribute.name] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelections((current) => ({ ...current, [attribute.name]: option }))}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selected
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 dark:border-white/15 dark:bg-transparent dark:text-neutral-200'
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  value={selections[attribute.name] || ''}
                  onChange={(event) => setSelections((current) => ({ ...current, [attribute.name]: event.target.value }))}
                  placeholder={attribute.name}
                  className="mt-2 h-11 w-full rounded-xl border border-neutral-200 bg-transparent px-3 outline-none focus:border-emerald-500 dark:border-white/15"
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={missing.length > 0 || submitting}
          onClick={confirm}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
          {submitting
            ? 'Ajout en cours…'
            : missing.length
              ? `Sélectionnez ${missing[0].name}`
              : `Ajouter au panier · ${formatPrice(displayPrice)}`}
        </button>
      </motion.div>
    </>
  );
}

function CommentsSheet({ video, onClose, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/product-videos/${video._id}/comments`, { silentGlobalError: true })
      .then(({ data }) => active && setComments(data?.items || []))
      .catch(() => active && showToast('Impossible de charger les commentaires.', { variant: 'error' }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [showToast, video._id]);

  const submit = async (event) => {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    try {
      const { data } = await api.post(`/product-videos/${video._id}/comments`, {
        message: value,
        parentId: replyTo?._id
      });
      setComments((items) => [data, ...items]);
      setMessage('');
      setReplyTo(null);
      onCountChange(1);
    } catch (error) {
      showToast(error.response?.data?.message || 'Commentaire non envoyé.', { variant: 'error' });
    }
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="fixed inset-x-0 bottom-0 z-[250] mx-auto flex max-h-[72dvh] max-w-xl flex-col rounded-t-3xl bg-white text-neutral-900 shadow-2xl dark:bg-neutral-950 dark:text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Commentaires"
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-white/10">
        <span className="font-bold">{compactNumber(video.counters?.comments)} commentaires</span>
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-white/10">
          <X size={20} />
        </button>
      </div>
      <div className="min-h-48 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {loading ? <Loader2 className="mx-auto animate-spin" /> : null}
        {!loading && !comments.length ? <p className="py-12 text-center text-sm text-neutral-500">Soyez le premier à commenter.</p> : null}
        {comments.map((comment) => (
          <div key={comment._id} className={comment.parent ? 'ml-10' : ''}>
            <div className="flex gap-3">
              <img src={comment.user?.profileImage || '/default-avatar.png'} alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-neutral-500">{comment.user?.shopName || comment.user?.name || 'Utilisateur'}</p>
                <p className="mt-1 text-sm">{comment.message}</p>
                <button type="button" onClick={() => setReplyTo(comment)} className="mt-2 text-xs font-semibold text-neutral-500">Répondre</button>
              </div>
              <button
                type="button"
                aria-label="Aimer le commentaire"
                onClick={async () => {
                  try {
                    const { data } = await api.post(`/product-videos/comments/${comment._id}/like`);
                    setComments((items) => items.map((item) => (item._id === comment._id ? { ...item, viewerLiked: data.active, likesCount: data.likesCount } : item)));
                  } catch {
                    showToast('Connectez-vous pour aimer.', { variant: 'info' });
                  }
                }}
                className={comment.viewerLiked ? 'text-rose-500' : 'text-neutral-400'}
              >
                <Heart size={16} fill={comment.viewerLiked ? 'currentColor' : 'none'} />
                <span className="text-[10px]">{comment.likesCount || ''}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="border-t border-neutral-200 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] dark:border-white/10">
        {replyTo ? <p className="mb-2 text-xs text-neutral-500">Réponse à {replyTo.user?.name} · <button type="button" onClick={() => setReplyTo(null)}>annuler</button></p> : null}
        <div className="flex gap-2">
          <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder="Ajouter un commentaire…" className="h-11 flex-1 rounded-full bg-neutral-100 px-4 outline-none ring-emerald-500 focus:ring-2 dark:bg-white/10" />
          <button type="submit" aria-label="Envoyer" className="grid h-11 w-11 place-items-center rounded-full bg-emerald-500 text-white"><Send size={18} /></button>
        </div>
      </form>
    </motion.div>
  );
}

export default function ProductVideos() {
  const { user } = useContext(AuthContext);
  const { addItem, cart } = useContext(CartContext);
  const cartProductIds = useMemo(
    () => new Set((cart?.items || []).map((item) => String(item?.product?._id || item?.product || '')).filter(Boolean)),
    [cart?.items]
  );
  const { formatPrice, getRuntimeValue } = useAppSettings();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const loadingRef = useRef(false);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [filter, setFilter] = useState('for_you');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [commentsVideo, setCommentsVideo] = useState(null);
  const [cartSheetVideo, setCartSheetVideo] = useState(null);
  const [cartSubmitting, setCartSubmitting] = useState(false);
  const [reportVideo, setReportVideo] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [capabilities, setCapabilities] = useState(null);
  const requestedVideoId = useMemo(() => new URLSearchParams(location.search).get('video'), [location.search]);
  // One cache entry per discovery view so returning to /videos restores the
  // exact feed (items, pagination cursor, last slide) instead of reloading.
  const feedCacheKey = useMemo(
    () => ['videos:feed', filter, submittedSearch || 'all'].join(':'),
    [filter, submittedSearch]
  );
  const { saveData, slowConnection } = useNetworkProfile();
  const defaultMuted = capabilities?.defaultMuted ?? Boolean(getRuntimeValue('product_video_default_muted', true));
  const autoplay = capabilities?.autoplay ?? Boolean(getRuntimeValue('product_video_autoplay_enabled', true));
  // On constrained networks, serve the 720p variant and limit preload-ahead.
  const liteSource = Boolean(saveData || slowConnection);
  const preloadCount = Math.max(
    1,
    Number(capabilities?.preloadCount ?? getRuntimeValue('product_video_preload_count', 1)) || 1
  );
  const effectivePreloadCount = liteSource ? Math.min(preloadCount, 1) : preloadCount;

  const requireLogin = useCallback(() => {
    if (user) return true;
    navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
    return false;
  }, [location.pathname, location.search, navigate, user]);

  useEffect(() => {
    api.get('/product-videos/capabilities', { silentGlobalError: true }).then(({ data }) => setCapabilities(data)).catch(() => {});
  }, []);

  const loadPage = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current || (!reset && !hasMore)) return;
      loadingRef.current = true;
      if (reset) setLoading(true);
      try {
        const pageCursor = reset ? 0 : cursor;
        const { data } = await api.get('/product-videos/feed', {
          params: { cursor: pageCursor, limit: 8, filter, search: submittedSearch || undefined },
          silentGlobalError: true
        });
        const nextItems = data?.items || [];
        const nextCursor = data?.nextCursor ?? pageCursor + nextItems.length;
        const nextHasMore = Boolean(data?.hasMore);
        setItems((current) => {
          const base = reset ? [] : current;
          const existing = new Set(base.map((item) => item._id));
          const merged = [...base, ...nextItems.filter((item) => !existing.has(item._id))];
          writeRouteViewCache(feedCacheKey, {
            items: merged,
            cursor: nextCursor,
            hasMore: nextHasMore,
            currentIndex: readRouteViewCache(feedCacheKey)?.currentIndex || 0
          });
          return merged;
        });
        setCursor(nextCursor);
        setHasMore(nextHasMore);
        if (reset) {
          setCurrentIndex(0);
          containerRef.current?.scrollTo({ top: 0 });
        }
      } catch (error) {
        if (error.response?.status !== 404) showToast('Le flux vidéo est momentanément indisponible.', { variant: 'error' });
        setHasMore(false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [cursor, feedCacheKey, filter, hasMore, showToast, submittedSearch]
  );

  useLayoutEffect(() => {
    // Instant restore: show the cached feed exactly as it was left (including
    // the slide position) instead of refetching and blanking the page.
    const cached = readRouteViewCache(feedCacheKey);
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      setItems(cached.items);
      setCursor(Number(cached.cursor) || cached.items.length);
      setHasMore(Boolean(cached.hasMore));
      setCurrentIndex(Math.min(Number(cached.currentIndex) || 0, cached.items.length - 1));
      setLoading(false);
      return;
    }
    setHasMore(true);
    setCursor(0);
    loadPage({ reset: true });
    // loadPage intentionally re-runs only when discovery criteria change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, submittedSearch, feedCacheKey]);

  // Keep the last-viewed slide in sync with the cache so a later restore can
  // land on it.
  useEffect(() => {
    const cached = readRouteViewCache(feedCacheKey);
    if (!cached || !Array.isArray(cached.items) || !cached.items.length) return;
    if (Number(cached.currentIndex) === currentIndex) return;
    writeRouteViewCache(feedCacheKey, { ...cached, currentIndex });
  }, [currentIndex, feedCacheKey]);

  // After a cached restore, jump (without animation) back to the slide the
  // user was watching.
  const restoredFeedRef = useRef('');
  useLayoutEffect(() => {
    if (!items.length || restoredFeedRef.current === feedCacheKey) return;
    const cached = readRouteViewCache(feedCacheKey);
    if (!cached || !Array.isArray(cached.items) || !cached.items.length) return;
    restoredFeedRef.current = feedCacheKey;
    const index = Math.min(Number(cached.currentIndex) || 0, items.length - 1);
    if (index > 0) containerRef.current?.scrollTo({ top: index * containerRef.current.clientHeight });
  }, [items.length, feedCacheKey]);

  useEffect(() => {
    if (!requestedVideoId) return;
    let active = true;
    api.get(`/product-videos/${requestedVideoId}`, { silentGlobalError: true }).then(({ data }) => {
      if (!active || !data?._id) return;
      setItems((current) => [data, ...current.filter((item) => item._id !== data._id)]);
      setCurrentIndex(0);
      containerRef.current?.scrollTo({ top: 0 });
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [requestedVideoId]);

  useEffect(() => {
    if (currentIndex >= items.length - 3) loadPage();
  }, [currentIndex, items.length, loadPage]);

  const patchItem = useCallback((id, updater) => {
    setItems((current) => current.map((item) => (item._id === id ? updater(item) : item)));
  }, []);

  // A video hard-deleted by moderation while the feed is open returns 404 on
  // interaction: drop it from the feed instead of leaving a dead slide.
  const removeUnavailableVideo = useCallback((videoId) => {
    setItems((current) => current.filter((item) => item._id !== videoId));
    showToast('Cette vidéo n’est plus disponible.', { variant: 'info' });
  }, [showToast]);

  const toggle = async (video, field) => {
    if (!requireLogin()) return;
    const endpoint = field === 'liked' ? 'like' : 'save';
    const counter = field === 'liked' ? 'likes' : 'saves';
    const previous = Boolean(video.viewer?.[field]);
    patchItem(video._id, (item) => ({
      ...item,
      viewer: { ...item.viewer, [field]: !previous },
      counters: { ...item.counters, [counter]: Math.max(0, Number(item.counters?.[counter] || 0) + (previous ? -1 : 1)) }
    }));
    try {
      await api.post(`/product-videos/${video._id}/${endpoint}`);
    } catch (error) {
      if (error.response?.status === 404) {
        removeUnavailableVideo(video._id);
        return;
      }
      patchItem(video._id, (item) => ({
        ...item,
        viewer: { ...item.viewer, [field]: previous },
        counters: { ...item.counters, [counter]: Math.max(0, Number(item.counters?.[counter] || 0) + (previous ? 1 : -1)) }
      }));
      showToast(error.response?.data?.message || 'Action impossible.', { variant: 'error' });
    }
  };

  const recordAction = (video, action) =>
    api.post(`/product-videos/${video._id}/action`, { action }, { silentGlobalError: true }).catch(() => {});

  const share = async (video) => {
    const url = `${window.location.origin}/videos?video=${video._id}`;
    const payload = { title: video.product?.title || 'HDMarket Videos', text: video.caption || 'Découvrez ce produit sur HDMarket', url };
    try {
      if (navigator.share) await navigator.share(payload);
      else {
        await navigator.clipboard.writeText(url);
        showToast('Lien copié.', { variant: 'success' });
      }
      recordAction(video, 'share');
      patchItem(video._id, (item) => ({ ...item, counters: { ...item.counters, shares: Number(item.counters?.shares || 0) + 1 } }));
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('Partage impossible.', { variant: 'error' });
    }
  };

  const productClick = (video) => {
    recordAction(video, 'product_click');
    navigate(buildProductPath(video.product));
  };

  const addToCart = async (video) => {
    if (!requireLogin()) return;
    // Products with mandatory options (size, color…) open an in-page option
    // sheet so the viewer never leaves the feed.
    if (requiresAttributeSelection(video.product)) {
      setCartSheetVideo(video);
      return;
    }
    try {
      await addItem(video.product?._id, 1);
      recordAction(video, 'add_to_cart');
      showToast('Produit ajouté au panier.', { variant: 'success' });
    } catch {
      showToast('Impossible d’ajouter ce produit.', { variant: 'error' });
    }
  };

  const confirmAddToCart = async (selectedAttributes) => {
    const video = cartSheetVideo;
    if (!video || cartSubmitting) return;
    setCartSubmitting(true);
    try {
      await addItem(video.product?._id, 1, selectedAttributes);
      recordAction(video, 'add_to_cart');
      showToast('Produit ajouté au panier.', { variant: 'success' });
      setCartSheetVideo(null);
    } catch {
      showToast('Impossible d’ajouter ce produit.', { variant: 'error' });
    } finally {
      setCartSubmitting(false);
    }
  };

  const follow = async (video) => {
    if (!requireLogin()) return;
    try {
      await api.post(`/users/shops/${video.seller?._id}/follow`);
      showToast(`Vous suivez ${video.seller?.shopName || video.seller?.name}.`, { variant: 'success' });
    } catch (error) {
      showToast(error.response?.data?.message || 'Abonnement impossible.', { variant: 'error' });
    }
  };

  const scrollTo = useCallback((index) => {
    const target = Math.max(0, Math.min(items.length - 1, index));
    containerRef.current?.scrollTo({ top: target * containerRef.current.clientHeight, behavior: 'smooth' });
  }, [items.length]);

  // Filter the whole feed to one hashtag: the swipe experience stays, only
  // matching videos are loaded (backend search covers caption + hashtags).
  const openHashtag = useCallback((tag) => {
    const value = String(tag || '').replace(/^#/, '').trim();
    if (!value) return;
    setSearch(`#${value}`);
    setSubmittedSearch(value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearch('');
    setSubmittedSearch('');
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollTo(currentIndex + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollTo(currentIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, scrollTo]);

  if (loading && !items.length) {
    return (
      <div className="grid h-[calc(100dvh-124px)] place-items-center bg-neutral-950 text-white lg:h-[calc(100dvh-7rem)]">
        <div className="text-center"><Loader2 className="mx-auto mb-3 animate-spin" /><p className="text-sm text-white/70">Préparation de votre flux…</p></div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-[calc(100dvh-124px-env(safe-area-inset-top,0px))] w-full overflow-hidden bg-neutral-950 lg:h-[calc(100dvh-7rem-env(safe-area-inset-top,0px))] lg:max-w-[520px] lg:rounded-t-3xl lg:shadow-2xl">
      {/* z-30 keeps the header under the navbar's mobile menu overlay (z-40). */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/60 via-black/25 to-transparent pb-8 pt-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedSearch(search.trim());
          }}
          className="pointer-events-auto mx-3 flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/40 pl-3.5 pr-1.5 text-white shadow-lg backdrop-blur-2xl transition-colors focus-within:border-[#FF6A00]/80 focus-within:bg-black/55"
        >
          <Search size={16} className="shrink-0 text-white/60" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Produits, boutiques, #tags"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/50"
          />
          {search ? (
            <button
              type="button"
              aria-label="Effacer"
              onClick={() => { setSearch(''); setSubmittedSearch(''); }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/15 text-white/80 transition-colors hover:bg-white/25"
            >
              <X size={14} />
            </button>
          ) : null}
          {search.trim() ? (
            <button
              type="submit"
              aria-label="Rechercher"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-r from-[#FFB000] to-[#FF6A00] text-white shadow-md"
            >
              <Search size={15} strokeWidth={2.5} />
            </button>
          ) : null}
        </form>
        <div className="pointer-events-auto mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if ((key === 'following' || key === 'nearby') && !requireLogin()) return;
                setFilter(key);
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold backdrop-blur-xl transition-colors ${filter === key ? 'border-[#FF6A00] bg-[#FF6A00] text-white shadow-md' : 'border-white/20 bg-black/40 text-white/85'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {submittedSearch ? (
          <div className="mt-2 flex px-3">
            <span className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/85 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md">
              <span className="truncate">#{submittedSearch.replace(/^#/, '')}</span>
              <button type="button" aria-label="Retirer le filtre" onClick={clearSearch} className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/20 transition hover:bg-white/35">
                <X size={11} />
              </button>
            </span>
          </div>
        ) : null}
      </header>

      {!items.length ? (
        <div className="grid h-full place-items-center px-8 text-center text-white">
          <div>
            <Play className="mx-auto mb-4 opacity-50" size={42} />
            <h1 className="text-xl font-bold">{submittedSearch ? `Aucune vidéo avec #${submittedSearch.replace(/^#/, '')}` : 'Aucune vidéo pour le moment'}</h1>
            <p className="mt-2 text-sm text-white/60">{submittedSearch ? 'Ce hashtag n’a pas encore de vidéo publiée.' : 'Essayez un autre filtre ou revenez bientôt.'}</p>
            {submittedSearch ? (
              <button type="button" onClick={clearSearch} className="mt-4 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-neutral-950">
                Voir toutes les vidéos
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={(event) => {
            const element = event.currentTarget;
            const index = Math.round(element.scrollTop / Math.max(1, element.clientHeight));
            if (index !== currentIndex) setCurrentIndex(index);
          }}
        >
          {items.map((video, index) => (
            <section key={video._id} className="h-full snap-start snap-always">
              {Math.abs(index - currentIndex) <= effectivePreloadCount ? (
                <VideoSlide
                  video={video}
                  active={index === currentIndex}
                  defaultMuted={defaultMuted}
                  autoplay={autoplay}
                  formatPrice={formatPrice}
                  user={user}
                  preload={index <= currentIndex + effectivePreloadCount && index >= currentIndex ? 'auto' : 'metadata'}
                  liteSource={liteSource}
                  onLike={() => toggle(video, 'liked')}
                  onSave={() => toggle(video, 'saved')}
                  onComments={() => requireLogin() && setCommentsVideo(video)}
                  onShare={() => share(video)}
                  onReport={() => requireLogin() && setReportVideo(video)}
                  onFollow={() => follow(video)}
                  onAddToCart={() => addToCart(video)}
                  onProductClick={() => productClick(video)}
                  onHashtag={openHashtag}
                  inCart={cartProductIds.has(String(video.product?._id || ''))}
                  onOpenCart={() => navigate('/cart')}
                />
              ) : (
                <div className="h-full bg-neutral-950" aria-hidden="true" />
              )}
            </section>
          ))}
          {loading ? <div className="grid h-24 place-items-center text-white"><Loader2 className="animate-spin" /></div> : null}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        <button type="button" onClick={() => scrollTo(currentIndex - 1)} disabled={currentIndex === 0} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white disabled:opacity-25"><ChevronUp size={20} /></button>
        <button type="button" onClick={() => scrollTo(currentIndex + 1)} disabled={currentIndex >= items.length - 1} className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white disabled:opacity-25"><ChevronDown size={20} /></button>
      </div>

      <AnimatePresence>
        {commentsVideo ? (
          <>
            <motion.button type="button" aria-label="Fermer les commentaires" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCommentsVideo(null)} className="fixed inset-0 z-[240] bg-black/55" />
            <CommentsSheet video={commentsVideo} onClose={() => setCommentsVideo(null)} onCountChange={(change) => patchItem(commentsVideo._id, (item) => ({ ...item, counters: { ...item.counters, comments: Number(item.counters?.comments || 0) + change } }))} />
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {cartSheetVideo ? (
          <CartOptionsSheet
            video={cartSheetVideo}
            formatPrice={formatPrice}
            submitting={cartSubmitting}
            onClose={() => setCartSheetVideo(null)}
            onConfirm={confirmAddToCart}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {reportVideo ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[260] grid place-items-center bg-black/65 p-5" role="dialog" aria-modal="true">
            <motion.form
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              onSubmit={async (event) => {
                event.preventDefault();
                try {
                  await api.post(`/product-videos/${reportVideo._id}/report`, { category: 'other', reason: reportReason });
                  showToast('Signalement transmis à la modération.', { variant: 'success' });
                  setReportVideo(null);
                  setReportReason('');
                } catch (error) {
                  showToast(error.response?.data?.message || 'Signalement impossible.', { variant: 'error' });
                }
              }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 text-neutral-900 shadow-2xl dark:bg-neutral-900 dark:text-white"
            >
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Signaler cette vidéo</h2><button type="button" onClick={() => setReportVideo(null)}><X /></button></div>
              <p className="mt-2 text-sm text-neutral-500">Expliquez ce qui ne respecte pas les règles HDMarket.</p>
              <textarea value={reportReason} onChange={(event) => setReportReason(event.target.value)} required maxLength={1000} className="mt-4 min-h-28 w-full rounded-2xl border border-neutral-200 bg-transparent p-3 outline-none focus:border-rose-400 dark:border-white/15" />
              <button type="submit" className="mt-4 h-11 w-full rounded-xl bg-rose-500 font-bold text-white">Envoyer le signalement</button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
