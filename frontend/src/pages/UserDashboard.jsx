import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import ProductForm from '../components/ProductForm';

export default function UserDashboard() {
  const [items, setItems] = useState([]);
  const load = async () => {
    const { data } = await api.get('/products');
    setItems(data);
  };
  useEffect(() => { load(); }, []);
  const statusMessages = {
    pending: "Annonce en attente de validation après paiement.",
    approved: "Annonce validée et visible par les acheteurs.",
    rejected: "Annonce rejetée. Consultez le support pour plus de détails.",
    disabled: "Annonce désactivée. Elle n'est plus visible par les acheteurs."
  };
  const statusStyles = {
    pending: 'text-yellow-600',
    approved: 'text-green-600',
    rejected: 'text-red-600',
    disabled: 'text-gray-500'
  };

  const updateStatus = async (id, action) => {
    try {
      await api.patch(`/products/${id}/${action}`);
      load();
    } catch (e) {
      alert(e.response?.data?.message || e.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold">Mes annonces</h2>
      <ProductForm onCreated={load} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((p) => (
          <div key={p._id} className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{p.title}</h3>
              <span className="text-xs uppercase">{p.status}</span>
            </div>
            {p.images?.length ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {p.images.map((src, idx) => (
                  <img
                    key={src || idx}
                    src={src}
                    alt={`${p.title} ${idx + 1}`}
                    className="h-24 w-24 object-cover rounded border"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <div className="h-24 w-full bg-gray-100 flex items-center justify-center text-xs text-gray-500 rounded">
                Aucune image
              </div>
            )}
            <p className="text-sm text-gray-600">{Number(p.price).toLocaleString()} FCFA</p>
            <p className={`text-sm font-medium ${statusStyles[p.status] || 'text-gray-600'}`}>
              {statusMessages[p.status] || 'Statut en cours de mise à jour.'}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Link
                to={`/product/${p._id}`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Voir l'annonce
              </Link>
              <span className="text-gray-300">|</span>
              <Link
                to={`/product/${p._id}/edit`}
                className="text-sm text-indigo-600 hover:underline"
              >
                Modifier
              </Link>
              <span className="text-gray-300">|</span>
              {p.status !== 'disabled' ? (
                <button
                  onClick={() => updateStatus(p._id, 'disable')}
                  className="text-sm text-red-600 hover:underline"
                  type="button"
                >
                  Désactiver
                </button>
              ) : (
                <button
                  onClick={() => updateStatus(p._id, 'enable')}
                  className="text-sm text-indigo-600 hover:underline"
                  type="button"
                >
                  Réactiver
                </button>
              )}
            </div>
            {p.status !== 'disabled' && <PaymentForm product={p} onSubmitted={load} />}
          </div>
        ))}
      </div>
    </div>
  );
}
