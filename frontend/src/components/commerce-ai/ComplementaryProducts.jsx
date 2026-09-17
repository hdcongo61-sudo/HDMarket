import React from 'react';
import AiPanel, { aiButton, AiProductResults, useAiRequest } from './AiPanel';
export default function ComplementaryProducts({ productId, exclude = [] }) {
  const { result, busy, error, run } = useAiRequest();
  if (!productId) return null;
  return <AiPanel title="Complétez votre achat" subtitle="Trouvez des compléments utiles dans la même boutique. Vérifiez la compatibilité sur chaque fiche." busy={busy} error={error}>
    <button type="button" className={aiButton} disabled={busy} onClick={() => run('/commerce-ai/complements', { productId, exclude })}>Proposer des compléments</button>
    {result && <div className="mt-3" aria-live="polite"><p className="text-sm">{result.summary}</p><AiProductResults products={result.products} /></div>}
  </AiPanel>;
}
