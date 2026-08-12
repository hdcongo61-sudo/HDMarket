import { useEffect, useState } from 'react';
import api from '../services/api';

export default function useOrderCategorySuggestions(order, enabled = true) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    if (!order?.items?.length && !order?.productSnapshot) return undefined;

    const orderedProductIds = new Set(
      (order?.items || [])
        .map((item) => item?.product?._id || item?.product)
        .filter(Boolean)
        .map(String)
    );
    if (order?.product) orderedProductIds.add(String(order.product?._id || order.product));

    const category =
      (order?.items || [])
        .map((item) => item?.product?.category || item?.snapshot?.category)
        .find(Boolean) || order?.productSnapshot?.category || '';

    let active = true;
    setLoading(true);
    api
      .get('/products/public', {
        params: { limit: 12, sort: 'new', ...(category ? { category } : {}) }
      })
      .then(({ data }) => {
        if (!active) return;
        const raw = Array.isArray(data) ? data : data?.items || data?.data || [];
        setProducts(
          raw
            .filter((product) => product?._id && !orderedProductIds.has(String(product._id)))
            .slice(0, 9)
        );
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, order?._id, order?.items, order?.product, order?.productSnapshot]);

  return { products, loading };
}
