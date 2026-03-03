import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  FolderOpen,
  Image as ImageIcon,
  Package,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Tag,
  X
} from 'lucide-react';
import api from '../services/api';
import PaymentForm from '../components/PaymentForm';
import ProductAnalytics from '../components/ProductAnalytics';
import { useToast } from '../context/ToastContext';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import { buildProductPath } from '../utils/links';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Approuvee',
  rejected: 'Rejetee',
  disabled: 'Desactivee'
};

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  disabled: 'bg-gray-100 text-gray-700'
};

const STATUS_ICONS = {
  pending: Clock,
  approved: CheckCircle,
  rejected: X,
  disabled: PowerOff
};

const STATUS_MESSAGES = {
  pending: 'Annonce en attente de validation apres paiement.',
  approved: 'Annonce validee et visible par les acheteurs.',
  rejected: 'Annonce rejetee. Consultez le support si necessaire.',
  disabled: "Annonce desactivee. Elle n'est plus visible publiquement."
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const resolveIdentifier = (product) => {
  if (!product) return '';
  return product.slug || product._id || product.id || '';
};

export default function MyListingDetail() {
  const { listingId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const externalLinkProps = useDesktopExternalLink();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [analyticsProduct, setAnalyticsProduct] = useState(null);

  const loadProduct = useCallback(async () => {
    if (!listingId) {
      setError('Annonce introuvable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      let nextProduct = null;

      try {
        const { data } = await api.get(`/products/${listingId}`);
        nextProduct = data;
      } catch (detailError) {
        const statusCode = detailError?.response?.status;
        if (statusCode && statusCode !== 400 && statusCode !== 404) {
          throw detailError;
        }

        const { data } = await api.get('/products');
        const entries = Array.isArray(data) ? data : [];
        nextProduct = entries.find((entry) => {
          const candidates = [entry?._id, entry?.id, entry?.slug].filter(Boolean).map(String);
          return candidates.includes(String(listingId));
        });

        if (!nextProduct) {
          throw detailError;
        }
      }

      setProduct(nextProduct || null);
      if (!nextProduct) {
        setError('Annonce introuvable.');
      }
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'Impossible de charger cette annonce.';
      setError(message);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const status = product?.status || 'pending';
  const StatusIcon = STATUS_ICONS[status] || Clock;
  const statusClass = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const productIdentifier = resolveIdentifier(product);

  const mainImage = useMemo(() => {
    if (!Array.isArray(product?.images) || product.images.length === 0) return null;
    return product.images[0];
  }, [product]);

  const galleryImages = useMemo(() => {
    if (!Array.isArray(product?.images)) return [];
    return product.images.slice(1, 7);
  }, [product]);

  const isApproved = status === 'approved';

  const handleStatusUpdate = async (action) => {
    if (!productIdentifier) return;

    setUpdating(true);
    try {
      await api.patch(`/products/${productIdentifier}/${action}`);
      showToast(action === 'disable' ? 'Annonce desactivee avec succes.' : 'Annonce reactivee avec succes.', {
        variant: 'success'
      });
      await loadProduct();
    } catch (e) {
      showToast(e?.response?.data?.message || e?.message || 'Erreur lors de la mise a jour.', {
        variant: 'error'
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-5 space-y-4">
          <div className="h-10 w-full rounded-2xl bg-white border border-gray-100 animate-pulse" />
          <div className="h-56 w-full rounded-3xl bg-white border border-gray-100 animate-pulse" />
          <div className="h-40 w-full rounded-2xl bg-white border border-gray-100 animate-pulse" />
          <div className="h-96 w-full rounded-2xl bg-white border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
        <div className="mx-auto max-w-xl px-4 py-10">
          <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="space-y-4">
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Impossible d'ouvrir cette annonce</h1>
                  <p className="text-sm text-gray-600 mt-1">{error || 'Annonce introuvable.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/my')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour a la liste
                  </button>
                  <button
                    type="button"
                    onClick={loadProduct}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reessayer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const actionButtons = (
    <>
      {productIdentifier ? (
        <Link
          to={`/product/${productIdentifier}/edit`}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 active:scale-[0.98]"
        >
          <Pencil className="w-4 h-4" />
          Modifier
        </Link>
      ) : null}

      {isApproved ? (
        <Link
          to={buildProductPath(product)}
          {...externalLinkProps}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-700 active:scale-[0.98]"
        >
          <Eye className="w-4 h-4" />
          Voir publique
        </Link>
      ) : null}

      <button
        type="button"
        onClick={() => setAnalyticsProduct({ id: product._id || product.id || product.slug, title: product.title })}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 active:scale-[0.98]"
      >
        <BarChart3 className="w-4 h-4" />
        Analytics
      </button>

      {status !== 'disabled' ? (
        <button
          type="button"
          disabled={updating}
          onClick={() => handleStatusUpdate('disable')}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 active:scale-[0.98] disabled:opacity-60"
        >
          <PowerOff className="w-4 h-4" />
          Desactiver
        </button>
      ) : (
        <button
          type="button"
          disabled={updating}
          onClick={() => handleStatusUpdate('enable')}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 active:scale-[0.98] disabled:opacity-60"
        >
          <Power className="w-4 h-4" />
          Reactiver
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 pb-28 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate('/my')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Mes annonces</span>
            <span className="sm:hidden">Retour</span>
          </button>
          <button
            type="button"
            onClick={loadProduct}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 text-sm font-semibold text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 space-y-4">
        <section className="rounded-3xl border border-gray-100 bg-white/95 p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-[1.1fr,1fr]">
            <div className="relative overflow-hidden rounded-2xl bg-gray-100 aspect-video">
              {mainImage ? (
                <img src={mainImage} alt={product.title || 'Annonce'} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${statusClass}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {STATUS_LABELS[status] || status}
                  </span>
                  {product.boosted ? (
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-[11px] font-semibold text-purple-700">
                      Boostee
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Annonce detail</p>
                <h1 className="text-lg font-extrabold leading-tight text-gray-900 sm:text-xl">{product.title || 'Annonce'}</h1>
                <p className="text-sm text-gray-600">{STATUS_MESSAGES[status] || 'Statut en cours de mise a jour.'}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Prix affiche</p>
                <p className="mt-1 text-2xl font-black text-gray-900">{formatPriceWithStoredSettings(product.price || 0)}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-center">
                  <p className="font-semibold text-gray-900 truncate">{product.category || 'N/A'}</p>
                  <p className="mt-0.5 text-[11px]">Categorie</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-center">
                  <p className="font-semibold text-gray-900">{Array.isArray(product.images) ? product.images.length : 0}</p>
                  <p className="mt-0.5 text-[11px]">Images</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-center">
                  <p className="font-semibold text-gray-900 truncate">{productIdentifier || 'N/A'}</p>
                  <p className="mt-0.5 text-[11px]">Ref</p>
                </div>
              </div>
            </div>
          </div>

          {galleryImages.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {galleryImages.map((image, index) => (
                <div key={`${image}-${index}`} className="aspect-square overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
                  <img src={image} alt={`Annonce ${index + 2}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="md:hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-2">{actionButtons}</div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.3fr,0.9fr] md:items-start">
          <div className="space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Description</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                {product.description || 'Aucune description fournie.'}
              </p>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-gray-900">Paiement et activation</h2>
              <p className="text-sm text-gray-600">
                Suivez ici l'etat du paiement pour la publication de cette annonce.
              </p>
              {product.status !== 'disabled' ? (
                <PaymentForm product={product} onSubmitted={loadProduct} />
              ) : (
                <p className="text-sm text-gray-500">Paiement indisponible pendant la desactivation.</p>
              )}
            </section>
          </div>

          <aside className="hidden md:block md:sticky md:top-20 space-y-4">
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-gray-900">Gestion</h2>
              <div className="grid grid-cols-1 gap-2">{actionButtons}</div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Informations</h2>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500"><Package className="w-4 h-4" /> Categorie</span>
                  <span className="font-semibold text-right">{product.category || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500"><Tag className="w-4 h-4" /> Reference</span>
                  <span className="font-semibold text-right">{productIdentifier || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500"><Calendar className="w-4 h-4" /> Creee le</span>
                  <span className="font-semibold text-right">{formatDate(product.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500"><Calendar className="w-4 h-4" /> Mise a jour</span>
                  <span className="font-semibold text-right">{formatDate(product.updatedAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1 text-gray-500"><FolderOpen className="w-4 h-4" /> Images</span>
                  <span className="font-semibold text-right">{Array.isArray(product.images) ? product.images.length : 0}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          {productIdentifier ? (
            <Link
              to={`/product/${productIdentifier}/edit`}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700"
            >
              <Pencil className="w-4 h-4" />
              Modifier
            </Link>
          ) : null}
          {status !== 'disabled' ? (
            <button
              type="button"
              disabled={updating}
              onClick={() => handleStatusUpdate('disable')}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              <PowerOff className="w-4 h-4" />
              Desactiver
            </button>
          ) : (
            <button
              type="button"
              disabled={updating}
              onClick={() => handleStatusUpdate('enable')}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 disabled:opacity-60"
            >
              <Power className="w-4 h-4" />
              Reactiver
            </button>
          )}
        </div>
      </div>

      {analyticsProduct ? (
        <ProductAnalytics
          productId={analyticsProduct.id}
          productTitle={analyticsProduct.title}
          onClose={() => setAnalyticsProduct(null)}
        />
      ) : null}
    </div>
  );
}
