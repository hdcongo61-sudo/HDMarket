import React from 'react';
import { ChevronRight, TicketPercent } from 'lucide-react';
import { useAppSettings } from '../../context/AppSettingsContext';
import { getLowestProductPrice } from '../../utils/productAttributes';

/**
 * Taobao-style coupon banner shown when the shop has an active promotion.
 * Highlights the first promo product and deep-links to the "Promos" filter.
 */
export default function ShopPromoBanner({ shop, hasActivePromo, promoProduct, onViewPromos, t }) {
  const { formatPrice } = useAppSettings();
  if (!hasActivePromo) return null;

  const promoCount = Number(shop?.activePromoCountNow || 0);
  const discount = Math.round(Number(promoProduct?.discount || 0));
  const title = String(promoProduct?.title || promoProduct?.name || '').trim();
  const price = promoProduct
    ? formatPrice(
        getLowestProductPrice({
          productAttributes: promoProduct?.attributes,
          basePrice: promoProduct?.price
        })
      )
    : null;

  return (
    <div className="mx-3 sm:mx-0">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF5000] to-[#FF3D00] px-4 py-3 text-white shadow-sm sm:px-5 sm:py-4">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-12 right-16 h-24 w-24 rounded-full bg-white/10"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <TicketPercent size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/90">
              {discount > 0
                ? `PROMO −${discount}%`
                : t('shop_profile.promo_banner_title', 'Promotions')}
              <span className="font-medium normal-case">
                {' '}
                · {t('shop_profile.promo_banner_period', 'Cette semaine')}
                {promoCount > 1 ? ` · ${promoCount}` : ''}
              </span>
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold sm:text-base">
              {title || t('shop_profile.promo_banner_generic', 'Offres en cours dans la boutique')}
              {price ? <span className="font-bold"> · {price}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewPromos}
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#FF3D00] shadow-sm transition active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
          >
            {t('shop_profile.promo_banner_cta', 'Promos')}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
