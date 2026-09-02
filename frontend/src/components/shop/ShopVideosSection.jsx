import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { useAppSettings } from '../../context/AppSettingsContext';
import { formatCount } from './shopProfileHelpers';

export default function ShopVideosSection({ shopId, t }) {
  const navigate = useNavigate();
  const { isFeatureEnabled } = useAppSettings();
  const videosEnabled = isFeatureEnabled('product_videos', { defaultValue: false });

  const videosQuery = useQuery({
    queryKey: ['shop-videos', String(shopId || '')],
    queryFn: async () => {
      const { data } = await api.get(`/product-videos/shop/${shopId}`, {
        params: { limit: 12 },
        silentGlobalError: true
      });
      return Array.isArray(data?.items) ? data.items : [];
    },
    enabled: Boolean(videosEnabled && shopId),
    staleTime: 60_000
  });

  const videos = videosQuery.data || [];
  if (!videosEnabled || !videos.length) return null;

  return (
    <section className="overflow-hidden rounded-none bg-white px-4 py-3.5 shadow-sm sm:rounded-2xl sm:ring-1 sm:ring-gray-200 dark:bg-neutral-950 dark:ring-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-black text-gray-900 dark:text-white">
          {t('shop_profile.videos', 'Vidéos')}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/videos')}
          className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[13px] font-bold text-[#FF5000] transition dark:text-orange-300"
        >
          <span>{t('shop_profile.view_all', 'Voir tout')}</span>
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((video) => (
          <button
            key={video._id}
            type="button"
            onClick={() => navigate(`/videos?video=${video._id}`)}
            className="group relative aspect-[9/16] w-[118px] shrink-0 overflow-hidden rounded-xl bg-neutral-900 text-left"
            aria-label={video.product?.title || t('shop_profile.videos', 'Vidéos')}
          >
            {video.thumbnailUrl || video.product?.images?.[0] ? (
              <img
                src={video.thumbnailUrl || video.product?.images?.[0]}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/40">
                <PlayIcon className="h-[26px] w-[26px]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm">
              <PlayIcon fill="currentColor" className="h-4 w-4" />
            </span>
            <div className="absolute inset-x-2 bottom-2 space-y-0.5">
              <p className="truncate text-[11px] font-bold text-white drop-shadow">
                {video.product?.title || video.caption || ''}
              </p>
              <p className="flex items-center gap-1 text-[10px] font-semibold text-white/80">
                <PlayIcon className="h-[9px] w-[9px]" />
                {formatCount(video.counters?.views || 0)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
