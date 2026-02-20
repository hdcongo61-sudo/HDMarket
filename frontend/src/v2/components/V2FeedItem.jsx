import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { fadeUp } from '../motion';
import V2Badge from './V2Badge';

export default function V2FeedItem({
  title,
  price,
  city,
  seller,
  boosted = false,
  installment = false,
  image
}) {
  return (
    <motion.article {...fadeUp} className="border-b v2-divider py-4">
      <div className="flex gap-3">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-[var(--v2-surface-soft)]">
          {image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold">{title}</p>
            <p className="text-sm font-semibold">{price}</p>
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-xs v2-text-soft"><MapPin className="h-3.5 w-3.5" />{city}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <V2Badge tone="neutral"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{seller}</V2Badge>
            {installment ? <V2Badge tone="accent">Paiement en tranche</V2Badge> : null}
            {boosted ? <V2Badge tone="warning"><Sparkles className="mr-1 h-3.5 w-3.5" />Sponsorisé</V2Badge> : null}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
