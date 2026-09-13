import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { buildProductPath } from '../utils/links';

const STORAGE_KEY = 'hdmarket:daily-deals-cache';

const readCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || Date.now() - Number(parsed.savedAt || 0) > 10 * 60 * 1000) return null;
    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
};

/** "Deals du jour" strip with a countdown to local midnight (Taobao 天天特卖). */
export default function DailyDealsStrip() {
  const [items, setItems] = useState(readCache);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .get('/products/public', { params: { sort: 'discount', limit: 6 } })
      .then(({ data }) => {
        if (!active) return;
        const fetched = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const deals = fetched.filter((product) => Number(product.discount) > 0).slice(0, 6);
        if (!deals.length) return;
        setItems(deals);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: deals, savedAt: Date.now() }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* strip is decorative — silent fail */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      setSecondsLeft(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  if (!items?.length) return null;

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const pad = (value) => String(value).padStart(2, '0');

  return (
    <section aria-label="Deals du jour" className="rounded-[22px] border border-[#eeeff3] bg-white p-[14px_12px] shadow-none">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <p className="flex items-center gap-1.5 text-[13px] font-black text-[#231f1b]">
          🔥 Deals du jour
        </p>
        <span className="rounded-full bg-[#231f1b] px-2.5 py-1 text-[11px] font-black tabular-nums text-white">
          {pad(hours)}:{pad(minutes)}:{pad(seconds)}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {items.map((product) => (
          <Link
            key={product._id || product.id}
            to={buildProductPath(product)}
            className="w-[110px] shrink-0 overflow-hidden rounded-2xl border border-[#eeeef2] bg-white active:scale-[0.98]"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-[#f1ece4]">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
              ) : null}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-[#e85d00] px-1.5 py-0.5 text-[10px] font-black text-white">
                -{Math.round(product.discount)}%
              </span>
            </div>
            <div className="p-1.5">
              <p className="line-clamp-2 min-h-[30px] text-[10.5px] font-semibold leading-[14px] text-[#231f1b]">
                {product.title}
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[11px] font-black text-[#e85d00]">
                  {formatPriceWithStoredSettings(product.price)}
                </span>
                {Number(product.priceBeforeDiscount) > 0 ? (
                  <span className="text-[9px] text-neutral-400 line-through">
                    {formatPriceWithStoredSettings(product.priceBeforeDiscount)}
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
