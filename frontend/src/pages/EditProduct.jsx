import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M7.33333 3.33337L2.66667 8.00004L7.33333 12.6667"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.3333 8.00004H2.66666"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DiscountTagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 13L11 21L21 11L13 3H6L3 6V13Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.5 9C9.5 9.82843 8.82843 10.5 8 10.5C7.17157 10.5 6.5 9.82843 6.5 9C6.5 8.17157 7.17157 7.5 8 7.5C8.82843 7.5 9.5 8.17157 9.5 9Z"
      fill="currentColor"
    />
    <path
      d="M15 15C15 15.8284 14.3284 16.5 13.5 16.5C12.6716 16.5 12 15.8284 12 15C12 14.1716 12.6716 13.5 13.5 13.5C14.3284 13.5 15 14.1716 15 15Z"
      fill="currentColor"
    />
    <path
      d="M10 14L14 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function EditProduct() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    discount: 0,
    condition: 'used',
    images: []
  });
  const [error, setError] = useState('');

  const priceDisplay = useMemo(() => {
    if (!product) return { current: '', before: '' };
    const current = Number(product.price).toLocaleString();
    const before = product.priceBeforeDiscount
      ? Number(product.priceBeforeDiscount).toLocaleString()
      : product.discount > 0
      ? Number((product.price / (1 - product.discount / 100)).toFixed(0)).toLocaleString()
      : '';
    return { current, before };
  }, [product]);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/products/${id}`);
        if (!active) return;
        const ownerId = data.user?._id || data.user;
        if (user?.role !== 'admin' && ownerId && String(ownerId) !== user?.id) {
          setError("Vous n'êtes pas autorisé à modifier cette annonce.");
          return;
        }
        setProduct(data);
        setForm({
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          discount: data.discount ?? 0,
          condition: data.condition || 'used',
          images: data.images || []
        });
        setError('');
      } catch (e) {
        if (!active) return;
        const message =
          e.response?.status === 403
            ? "Accès refusé. Cette annonce ne vous appartient pas."
            : e.response?.status === 404
            ? 'Annonce introuvable.'
            : e.response?.data?.message || e.message || 'Erreur lors du chargement.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProduct();
    return () => {
      active = false;
    };
  }, [id]);

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        discount: form.discount,
        condition: form.condition
      };
      await api.put(`/products/${id}`, payload);
      navigate('/my');
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Erreur lors de la mise à jour.';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-4">
        <p className="text-sm text-gray-500">Chargement de l'annonce…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
        >
          <ArrowLeftIcon /> Retour
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-1 text-sm border rounded hover:bg-gray-100"
      >
        <ArrowLeftIcon /> Retour
      </button>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Modifier l'annonce</h1>
        <p className="text-sm text-gray-500">
          Le prix actuel ne peut pas être modifié. Vous pouvez toutefois appliquer une remise pour mettre en avant votre annonce.
        </p>
      </header>

      <section className="bg-white border rounded-lg shadow-sm p-5">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700">
              Titre
              <input
                className="mt-1 w-full border p-2 rounded"
                value={form.title}
                onChange={(e) => onChange('title', e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Catégorie
              <input
                className="mt-1 w-full border p-2 rounded"
                value={form.category}
                onChange={(e) => onChange('category', e.target.value)}
                required
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Description
            <textarea
              className="mt-1 w-full border p-2 rounded min-h-[140px]"
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              required
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.condition === 'new'}
              onChange={(e) => onChange('condition', e.target.checked ? 'new' : 'used')}
            />
            <span>{form.condition === 'new' ? 'Produit neuf' : "Produit d'occasion"}</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded p-3 bg-slate-50">
              <p className="text-xs uppercase text-gray-500">Prix actuel</p>
              <p className="text-xl font-semibold text-indigo-600">{priceDisplay.current} FCFA</p>
              {priceDisplay.before && (
                <p className="text-sm text-gray-500 line-through">{priceDisplay.before} FCFA</p>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700">
              <span className="flex items-center gap-2">
                <DiscountTagIcon /> Remise (%)
              </span>
              <input
                type="number"
                className="mt-1 w-full border p-2 rounded"
                min="0"
                max="99"
                step="1"
                value={form.discount}
                onChange={(e) => onChange('discount', Number(e.target.value))}
              />
              <span className="text-xs text-gray-500">Seul le pourcentage de remise peut être ajusté.</span>
            </label>
          </div>

          {form.images?.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Aperçu des images</p>
              <div className="flex gap-2 overflow-x-auto">
                {form.images.map((src, idx) => (
                  <img
                    key={src || idx}
                    src={src}
                    alt={`${form.title} ${idx + 1}`}
                    className="h-20 w-24 object-cover rounded border"
                    loading="lazy"
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => navigate('/my')}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-70"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
