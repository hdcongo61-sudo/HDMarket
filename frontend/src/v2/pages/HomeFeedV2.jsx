import React from 'react';
import { motion } from 'framer-motion';
import { Compass, Sparkles } from 'lucide-react';
import { fadeUp, staggerContainer } from '../motion';
import V2Card from '../components/V2Card';
import V2FeedItem from '../components/V2FeedItem';
import V2Button from '../components/V2Button';

const demoItems = [
  { title: 'iPhone 14 Pro Max 256Go', price: '650 000 FCFA', city: 'Brazzaville', seller: 'Boutique Mbolo', installment: true, boosted: true },
  { title: 'Chaise ergonomique neuve', price: '75 000 FCFA', city: 'Brazzaville', seller: 'Design Work', installment: false, boosted: false },
  { title: 'Samsung S23 Ultra', price: '590 000 FCFA', city: 'Pointe-Noire', seller: 'AfriMobile', installment: true, boosted: true },
  { title: 'Pack solaire maison 5KW', price: '1 200 000 FCFA', city: 'Oyo', seller: 'Energy Hub', installment: true, boosted: false }
];

export default function HomeFeedV2() {
  return (
    <motion.section variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      <V2Card
        title="Home Feed · Local Priority"
        subtitle="Threads-style feed with natural sponsored insertion and local-first ranking"
        right={<V2Button variant="secondary" className="h-9 min-h-9 px-3">Pull to refresh</V2Button>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--v2-surface-soft)] px-3 py-1.5 text-xs v2-text-soft"><Compass className="h-3.5 w-3.5" />Près de vous</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-xs text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"><Sparkles className="h-3.5 w-3.5" />Suggestions intelligentes</span>
        </div>
      </V2Card>

      <motion.div {...fadeUp} className="v2-surface divide-y v2-divider px-3 sm:px-4">
        {demoItems.map((item) => (
          <V2FeedItem key={item.title} {...item} />
        ))}
      </motion.div>
    </motion.section>
  );
}
