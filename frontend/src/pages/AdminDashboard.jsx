import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

export default function AdminDashboard() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('waiting');
  const filesBase = useMemo(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5010/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const normalizeUrl = useCallback((url) => {
    if (!url) return url;
    const cleaned = url.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    return `${filesBase}/${cleaned.replace(/^\/+/, '')}`;
  }, [filesBase]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/payments/admin?status=${filter}`);
    let normalized = Array.isArray(data)
      ? data.map((payment) => ({
          ...payment,
          product: payment.product
            ? {
                ...payment.product,
                images: Array.isArray(payment.product.images)
                  ? payment.product.images.map(normalizeUrl)
                  : undefined
              }
            : payment.product
        }))
      : [];

    const missingImages = normalized.filter(
      (p) => p.product?._id && (!p.product.images || p.product.images.length === 0)
    );

    if (missingImages.length) {
      const fetched = await Promise.all(
        missingImages.map(async (item) => {
          try {
            const res = await api.get(`/products/${item.product._id}`);
            return { id: item.product._id, images: res.data?.images || [] };
          } catch {
            return { id: item.product._id, images: [] };
          }
        })
      );

      const lookup = new Map(fetched.map(({ id, images }) => [id, images.map(normalizeUrl)]));

      normalized = normalized.map((payment) => {
        const productId = payment.product?._id;
        if (!productId) return payment;
        const extraImages = lookup.get(productId);
        if (!extraImages) return payment;
        return {
          ...payment,
          product: {
            ...payment.product,
            images: extraImages
          }
        };
      });
    }

    setPayments(normalized);
  }, [filter, normalizeUrl]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, type) => {
    try {
      if (type === 'verify') await api.put(`/payments/admin/${id}/verify`);
      else await api.put(`/payments/admin/${id}/reject`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-bold">Admin – Vérification des paiements</h2>
      <div className="flex gap-2 items-center">
        <label>Filtre :</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border p-2">
          <option value="waiting">En attente</option>
          <option value="verified">Validés</option>
          <option value="rejected">Rejetés</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Image</th>
              <th className="p-2 border">Annonce</th>
              <th className="p-2 border">Prix</th>
              <th className="p-2 border">Payeur</th>
              <th className="p-2 border">Opérateur</th>
              <th className="p-2 border">Montant</th>
              <th className="p-2 border">Statut</th>
              <th className="p-2 border">Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id}>
                <td className="p-2 border align-top">
                  {p.product?.images?.length ? (
                    <div className="flex items-center gap-2 max-w-[220px] overflow-x-auto">
                      {p.product.images.slice(0, 3).map((src, idx) => (
                        <a
                          key={src || idx}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          title="Ouvrir l'image dans un nouvel onglet"
                        >
                          <img
                            src={src}
                            alt={`${p.product?.title || 'Produit'} ${idx + 1}`}
                            className="h-16 w-20 object-cover rounded border shadow-sm"
                            loading="lazy"
                          />
                        </a>
                      ))}
                      {p.product.images.length > 3 && (
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                          +{p.product.images.length - 3} autres
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Aucune image</span>
                  )}
                </td>
                <td className="p-2 border">{p.product?.title}</td>
                <td className="p-2 border">{Number(p.product?.price || 0).toLocaleString()} FCFA</td>
                <td className="p-2 border">{p.payerName}</td>
                <td className="p-2 border">{p.operator}</td>
                <td className="p-2 border">{p.amount}</td>
                <td className="p-2 border">{p.status}</td>
                <td className="p-2 border flex gap-2">
                  {p.status === 'waiting' && (
                    <>
                      <button onClick={() => act(p._id, 'verify')} className="bg-green-600 text-white px-3 py-1 rounded">Valider</button>
                      <button onClick={() => act(p._id, 'reject')} className="bg-red-600 text-white px-3 py-1 rounded">Refuser</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
