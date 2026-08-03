import React, { useEffect, useState } from 'react';
import { Bookmark, Eye, Heart, Loader2, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function SavedProductVideos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    api.get('/product-videos/saved', { silentGlobalError: true })
      .then(({ data }) => active && setItems(data?.items || []))
      .catch((error) => active && showToast(error.response?.data?.message || 'Vidéos enregistrées indisponibles.', { variant: 'error' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [showToast]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"><Bookmark /></span><div><h1 className="text-2xl font-black">Vidéos enregistrées</h1><p className="text-sm text-neutral-500">Retrouvez les produits que vous voulez revoir.</p></div></div>
      {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="animate-spin" /></div> : null}
      {!loading && !items.length ? <div className="mt-10 rounded-3xl border border-dashed border-neutral-300 p-12 text-center dark:border-white/15"><Bookmark className="mx-auto text-neutral-400" size={36} /><p className="mt-4 font-bold">Aucune vidéo enregistrée</p><Link to="/videos" className="mt-4 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white">Découvrir HDMarket Videos</Link></div> : null}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((video) => <Link key={video._id} to={`/videos?video=${video._id}`} className="group overflow-hidden rounded-2xl bg-neutral-950 text-white shadow-sm"><div className="relative aspect-[3/4]"><img src={video.thumbnailUrl || video.product?.images?.[0]} alt={video.product?.title || ''} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /><span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" /><Play className="absolute left-3 top-3 drop-shadow" fill="currentColor" /><div className="absolute inset-x-0 bottom-0 p-3"><p className="line-clamp-2 text-sm font-bold">{video.product?.title}</p><div className="mt-2 flex gap-3 text-[11px] text-white/75"><span className="flex items-center gap-1"><Eye size={12} />{video.counters?.views || 0}</span><span className="flex items-center gap-1"><Heart size={12} />{video.counters?.likes || 0}</span></div></div></div></Link>)}
      </div>
    </div>
  );
}
