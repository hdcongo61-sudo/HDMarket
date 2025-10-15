import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const params = useMemo(() => {
    const p = { page, limit, sort };
    if (q) p.q = q;
    if (category) p.category = category;
    if (minPrice) p.minPrice = Number(minPrice);
    if (maxPrice) p.maxPrice = Number(maxPrice);
    return p;
  }, [q, category, minPrice, maxPrice, page, limit, sort]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/products/public', { params });
      const fetchedItems = Array.isArray(data) ? data : data.items || [];
      const pages = Array.isArray(data) ? 1 : data.pagination?.pages || 1;
      setItems(fetchedItems);
      setTotalPages(pages);
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <form onSubmit={onSearch} className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input className="border p-2 md:col-span-2" placeholder="Recherche (titre, description)" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className="border p-2" placeholder="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} />
        <input type="number" className="border p-2" placeholder="Prix min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        <input type="number" className="border p-2" placeholder="Prix max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        <button className="bg-indigo-600 text-white px-3 py-2 rounded">Rechercher</button>
      </form>

      <div className="flex items-center gap-2">
        <span className="text-sm">Trier par :</span>
        <select className="border p-2" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Plus récents</option>
          <option value="price_asc">Prix ↑</option>
          <option value="price_desc">Prix ↓</option>
          <option value="discount">Promotions</option>
        </select>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {items.map((p) => <ProductCard key={p._id} p={p} />)}
          {items.length === 0 && <p>Aucun résultat</p>}
        </div>
      )}

      <div className="flex justify-center items-center gap-2">
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Précédent
        </button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
