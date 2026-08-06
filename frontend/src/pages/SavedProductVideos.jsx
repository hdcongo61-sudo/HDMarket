import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Eye, Heart, Loader2, Play, ShoppingBag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { buildProductPath } from '../utils/links';

const getPlayableSource = (video) =>
  video?.playbackSources?.find((source) => source.quality === 'auto')?.url || video?.videoUrl || '';

export default function SavedProductVideos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    api.get('/product-videos/saved', { silentGlobalError: true })
      .then(({ data }) => active && setItems(data?.items || []))
      .catch((error) => active && showToast(error.response?.data?.message || 'Vidéos enregistrées indisponibles.', { variant: 'error' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [showToast]);

  // Lock page scroll and allow Escape to close while the player is open.
  useEffect(() => {
    if (!activeVideo) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setActiveVideo(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeVideo]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Bookmark /></span><div><h1 className="text-2xl font-black">Vidéos enregistrées</h1><p className="text-sm text-neutral-500">Retrouvez les produits que vous voulez revoir.</p></div></div>
      {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin" /></div> : null}
      {!loading && !items.length ? <div className="mt-10 rounded-3xl border border-dashed border-neutral-300 p-12 text-center dark:border-white/15"><Bookmark className="mx-auto text-neutral-400" size={36} /><p className="mt-4 font-bold">Aucune vidéo enregistrée</p><Link to="/videos" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">Découvrir HDMarket Videos</Link></div> : null}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((video) => (
          <button
            key={video._id}
            type="button"
            onClick={() => setActiveVideo(video)}
            aria-label={`Lire la vidéo ${video.product?.title || ''}`}
            className="group overflow-hidden rounded-2xl bg-neutral-950 text-left text-white shadow-sm"
          >
            <div className="relative aspect-[3/4]">
              <img src={video.thumbnailUrl || video.product?.images?.[0]} alt={video.product?.title || ''} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-emerald-500">
                <Play size={20} fill="currentColor" />
              </span>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="line-clamp-2 text-sm font-bold">{video.product?.title}</p>
                <div className="mt-2 flex gap-3 text-[11px] text-white/75"><span className="flex items-center gap-1"><Eye size={12} />{video.counters?.views || 0}</span><span className="flex items-center gap-1"><Heart size={12} />{video.counters?.likes || 0}</span></div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeVideo ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Lecture de la vidéo ${activeVideo.product?.title || ''}`}
            className="fixed inset-0 z-[260] grid place-items-center bg-black/90 p-4"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 16 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-neutral-950 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Fermer le lecteur"
                onClick={() => setActiveVideo(null)}
                className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
              >
                <X size={18} />
              </button>
              <video
                src={getPlayableSource(activeVideo)}
                poster={activeVideo.thumbnailUrl || activeVideo.product?.images?.[0]}
                controls
                autoPlay
                playsInline
                className="aspect-[3/4] w-full bg-neutral-950 object-contain"
              />
              <div className="flex items-center justify-between gap-3 p-4 text-white">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-bold">{activeVideo.product?.title || 'Produit'}</p>
                  <p className="mt-0.5 text-xs text-white/60">{activeVideo.counters?.views || 0} vues · {activeVideo.counters?.likes || 0} J’aime</p>
                </div>
                {activeVideo.product ? (
                  <Link
                    to={buildProductPath(activeVideo.product)}
                    className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white"
                  >
                    <ShoppingBag size={15} /> Voir le produit
                  </Link>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
