import React, { useState } from 'react';
import PaidImageEditor from '../image-studio/PaidImageEditor';
export default function MarketingPackLauncher({ productFacts }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="my-4 rounded-2xl border border-orange-200 bg-orange-50/50 p-4"><summary className="cursor-pointer font-bold text-orange-800">Pack marketing IA · photo, bannières et textes</summary>{open && <div className="mt-4"><PaidImageEditor initialOperation="marketing" productFacts={productFacts} /></div>}</details>;
}
