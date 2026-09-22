import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function ShoppingPrivateImage({ url, orderId, index = 'receipt', alt, className = '' }) {
  const [source, setSource] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false, objectUrl;
    setSource(''); setFailed(false);
    const endpoint = url?.startsWith('api/buy-for-me/media/') ? url.slice(3) : `/buy-for-me/orders/${orderId}/receipt/${index}`;
    api.get(endpoint, { responseType: 'blob', skipCache: true }).then(({ data }) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(data); setSource(objectUrl);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url, orderId, index]);
  if (!source) return <span className={`grid place-items-center text-xs text-gray-500 ${className}`}>{failed ? 'Photo indisponible' : 'Chargement…'}</span>;
  return <a href={source} target="_blank" rel="noreferrer"><img src={source} alt={alt} className={className} /></a>;
}
