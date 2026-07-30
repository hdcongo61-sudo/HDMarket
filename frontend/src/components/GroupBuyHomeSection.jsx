import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../services/api';
import { formatPriceWithStoredSettings as formatCurrency } from '../utils/priceFormatter';
import { getProductCardImageUrl } from '../utils/productImageUrl';

/**
 * Home "🔥 Achats groupés en cours" — surfaces open teams so passers-by can
 * jump straight into filling one (the actual growth mechanic of B.1).
 */
export default function GroupBuyHomeSection({ enabled }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    api
      .get('/group-buys/active', { params: { limit: 8 } })
      .then(({ data }) => setItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setItems([]));
  }, [enabled]);

  if (!enabled || items.length === 0) return null;

  return (
    <section className="min-w-0 py-[22px]">
      <div className="mb-3 flex items-center gap-2 px-5 max-[375px]:px-4">
        <h2 className="text-[18px] font-black tracking-[-0.02em] text-[#1b1d22]">
          🔥 Achats groupés en cours
        </h2>
      </div>
      <div
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[375px]:px-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((groupBuy) => {
          const memberCount = Array.isArray(groupBuy.members) ? groupBuy.members.length : 0;
          const targetSize = Math.max(1, Number(groupBuy.targetSize) || 1);
          const remaining = Math.max(0, targetSize - memberCount);
          const progressPct = Math.min(100, Math.round((memberCount / targetSize) * 100));
          const product = groupBuy.productId || {};
          return (
            <Link
              key={groupBuy._id}
              to={product.slug ? `/product/${product.slug}` : `/product/${product._id}`}
              className="w-[172px] shrink-0 snap-start overflow-hidden rounded-[20px] border border-[#eeeff3] bg-white p-2 active:scale-[0.98]"
            >
              <div className="h-[130px] overflow-hidden rounded-[14px] bg-[#f0f1f5]">
                <img
                  src={getProductCardImageUrl(product.images?.[0])}
                  alt={product.title || 'Produit'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="px-1 pb-1 pt-2">
                <p className="line-clamp-1 text-[13.5px] font-extrabold text-[#1b1d22]">{product.title}</p>
                <p className="mt-0.5 text-[16px] font-black tracking-[-0.02em] text-[#f26522]">{formatCurrency(groupBuy.groupPrice)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f0f1f5]">
                  <div className="h-full rounded-full bg-[#f26522]" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[12px] font-extrabold text-[#5b616c]">
                  <Users size={12} />
                  {remaining > 0 ? `Il manque ${remaining}` : 'Complet'}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
