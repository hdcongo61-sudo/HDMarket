import React, { useContext, useEffect, useState } from 'react';
import { ArrowLeft, Edit3, Loader2, PackageSearch } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ProductForm from '../components/ProductForm';
import AuthContext from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export default function EditProduct() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { showToast } = useToast();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/products/${slug}`, {
          skipCache: true,
          headers: { 'x-skip-cache': '1' }
        });
        if (!active) return;
        const ownerId = data?.user?._id || data?.user;
        const currentUserId = user?._id || user?.id;
        const canModerate = ['admin', 'founder'].includes(String(user?.role || ''));
        if (!canModerate && ownerId && String(ownerId) !== String(currentUserId || '')) {
          setError("Vous n'êtes pas autorisé à modifier cette annonce.");
          return;
        }
        setProduct(data);
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError?.response?.status === 403
            ? "Vous n'êtes pas autorisé à modifier cette annonce."
            : requestError?.response?.status === 404
              ? 'Annonce introuvable.'
              : requestError?.response?.data?.message || 'Impossible de charger cette annonce.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProduct();
    return () => { active = false; };
  }, [slug, user?._id, user?.id, user?.role]);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f5f2ee] px-4">
        <div className="rounded-2xl border border-[#e2dcd2] bg-white px-8 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#e85d00]" />
          <p className="mt-3 text-sm font-bold text-stone-600">Chargement de toutes les options…</p>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f5f2ee] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[#e2dcd2] bg-white p-7 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff0e4]">
            <PackageSearch className="h-7 w-7 text-[#b94700]" />
          </span>
          <h1 className="mt-4 text-xl font-black text-[#231f1b]">Modification indisponible</h1>
          <p className="mt-2 text-sm text-stone-600">{error || 'Annonce introuvable.'}</p>
          <button
            type="button"
            onClick={() => navigate('/my')}
            className="mt-6 min-h-11 rounded-full bg-[#231f1b] px-5 text-sm font-black text-white"
          >
            Retour à mes annonces
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f2ee] pb-24">
      <header className="sticky top-0 z-30 border-b border-[#e2dcd2] bg-white/95">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#231f1b] hover:bg-[#f5f2ee]"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0e4]">
            <Edit3 className="h-5 w-5 text-[#b94700]" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-[#231f1b]">Modifier le produit</h1>
            <p className="truncate text-xs text-stone-500">Prix, photos, couleurs, options et disponibilité</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-3 pt-4 sm:px-4">
        <ProductForm
          key={product._id || product.id || slug}
          initialValues={product}
          productId={product._id || product.id}
          submitLabel="Enregistrer les modifications"
          onCancel={() => navigate(-1)}
          onUpdated={(updatedProduct) => {
            showToast('Annonce mise à jour avec succès !', { variant: 'success' });
            navigate(updatedProduct?.slug ? `/product/${updatedProduct.slug}` : '/my');
          }}
        />
      </div>
    </main>
  );
}
