import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { setSocialAttribution } from '../utils/socialAttribution';

// The smart link target (/s/HD-8F42K?source=tiktok&campaign=...). Resolves
// the code, records the click server-side, stores attribution for later
// checkout, then redirects to the canonical product page — a thin,
// non-indexed transition page, not a duplicate product page (spec §8).
export default function SocialRedirect() {
  const { socialCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const query = new URLSearchParams();
      const source = searchParams.get('source');
      const campaign = searchParams.get('campaign');
      if (source) query.set('source', source);
      if (campaign) query.set('campaign', campaign);

      try {
        const { data } = await api.get(
          `/social-commerce/resolve/${encodeURIComponent(socialCode)}${query.toString() ? `?${query.toString()}` : ''}`,
          { silentGlobalError: true }
        );
        if (cancelled) return;
        const payload = data?.data;
        if (payload?.socialClickId) {
          setSocialAttribution({
            socialClickId: payload.socialClickId,
            source: payload.channel,
            campaign: payload.campaign,
            socialCode
          });
        }
        navigate(payload?.productPath || '/products', { replace: true });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [socialCode, searchParams, navigate]);

  if (failed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f6f3ee] px-6 text-center">
        <p className="text-lg font-black text-[#141210]">Produit introuvable</p>
        <p className="max-w-xs text-sm font-medium text-[#8a8378]">
          Ce lien ne correspond à aucun produit disponible sur HDMarket pour le moment.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 rounded-full bg-[#141210] px-5 py-3 text-sm font-black text-white"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
          Rechercher sur HDMarket
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f6f3ee]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e85d00] border-t-transparent" />
    </div>
  );
}
