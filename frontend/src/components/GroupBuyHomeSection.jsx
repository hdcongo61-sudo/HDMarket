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
    <section className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[17px] font-black tracking-[-0.01em] text-[#231f1b]">
          🔥 Achats groupés en cours
        </h2>
      </div>
      <div
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((groupBuy) => {
          const remaining = Math.max(0, groupBuy.targetSize - groupBuy.members.length);
          const progressPct = Math.min(100, Math.round((groupBuy.members.length / groupBuy.targetSize) * 100));
          const product = groupBuy.productId || {};
          return (
            <Link
              key={groupBuy._id}
              to={product.slug ? `/product/${product.slug}` : `/product/${product._id}`}
              className="w-[150px] shrink-0 snap-start overflow-hidden rounded-[14px] border border-[#eee8e0] bg-white shadow-sm"
            >
              <div className="aspect-square overflow-hidden bg-[#f3f0ec]">
                <img
                  src={getProductCardImageUrl(product.images?.[0])}
                  alt={product.title || 'Produit'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="p-2">
                <p className="line-clamp-1 text-[12px] font-bold text-gray-800">{product.title}</p>
                <p className="mt-0.5 text-sm font-black text-[#e85d00]">{formatCurrency(groupBuy.groupPrice)}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#e85d00]" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-gray-500">
                  <Users size={10} />
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
