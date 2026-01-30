import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Phone,
  Star,
  Users,
  Edit3,
  X,
  Heart,
  ShoppingCart,
  TrendingUp,
  Award,
  CheckCircle,
  MessageCircle,
  Share2,
  Filter,
  Grid3x3,
  List,
  Sparkles,
  Mail,
  Globe,
  Calendar,
  Package,
  Eye,
  ThumbsUp
} from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import AuthContext from '../context/AuthContext';
import VerifiedBadge from '../components/VerifiedBadge';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';

const DAY_LABELS = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return numberFormatter.format(parsed);
};

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0 FCFA';
  return `${numberFormatter.format(parsed)} FCFA`;
};

const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date inconnue';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatRatingLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0,0';
  return parsed.toFixed(1).replace('.', ',');
};

const ratingOptions = [5, 4, 3, 2, 1];

export default function ShopProfile() {
  const { slug } = useParams();
  const { user, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [userReview, setUserReview] = useState(null);
  const [isEditingReview, setIsEditingReview] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [allComments, setAllComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState('');
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [topSellingLoading, setTopSellingLoading] = useState(false);
  const [topSellingError, setTopSellingError] = useState('');
  const shopIdentifier = shop?.slug || shop?._id || slug;
  const externalLinkProps = useDesktopExternalLink();

  useEffect(() => {
    let active = true;
    const fetchShop = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/shops/${slug}`);
        if (!active) return;
        setShop(data.shop);
        const loadedProducts = Array.isArray(data.products) ? data.products : [];
        setProducts(loadedProducts);
        setRecentReviews(Array.isArray(data.recentReviews) ? data.recentReviews : []);
        setError('');
        
        // Extract top selling products from loaded products
        if (loadedProducts.length > 0) {
          const withSales = loadedProducts
            .filter((p) => Number(p.salesCount || 0) > 0)
            .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
            .slice(0, 5);
          setTopSellingProducts(withSales);
          setTopSellingLoading(false);
        }
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Boutique introuvable.');
        setShop(null);
        setProducts([]);
        setRecentReviews([]);
        setTopSellingProducts([]);
        setTopSellingLoading(false);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchShop();
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

  // Fetch top selling products for the shop (fetch more if needed)
  useEffect(() => {
    if (!shop?._id || topSellingProducts.length > 0) {
      return;
    }
    
    // If we already have products with sales, no need to fetch more
    if (products.length > 0) {
      const withSales = products
        .filter((p) => Number(p.salesCount || 0) > 0)
        .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
        .slice(0, 5);
      if (withSales.length > 0) {
        setTopSellingProducts(withSales);
        return;
      }
    }
    
    // Only fetch more if we don't have enough products with sales
    let active = true;
    const fetchTopSelling = async () => {
      setTopSellingLoading(true);
      setTopSellingError('');
      try {
        // Fetch more products from the shop to find top sellers
        const { data: shopData } = await api.get(`/shops/${slug}`, {
          params: { limit: 100 }
        });
        if (!active) return;
        const shopProducts = Array.isArray(shopData?.products) ? shopData.products : [];
        
        // Combine with already loaded products
        const allProducts = [...products, ...shopProducts];
        const uniqueProducts = Array.from(
          new Map(allProducts.map((p) => [String(p._id), p])).values()
        );
        
        // Filter products with salesCount > 0 and sort by salesCount
        const withSales = uniqueProducts
          .filter((p) => Number(p.salesCount || 0) > 0)
          .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
          .slice(0, 5);
        
        setTopSellingProducts(withSales);
        
        if (withSales.length === 0 && uniqueProducts.length > 0) {
          setTopSellingError('Aucun produit avec des ventes enregistrées.');
        }
      } catch (err) {
        if (!active) return;
        console.error('Error fetching top selling products:', err);
        setTopSellingError('Impossible de charger les produits les plus vendus.');
      } finally {
        if (active) setTopSellingLoading(false);
      }
    };
    
    // Only fetch if we have less than 5 products with sales
    const currentWithSales = products.filter((p) => Number(p.salesCount || 0) > 0);
    if (currentWithSales.length < 5) {
      fetchTopSelling();
    }
    
    return () => {
      active = false;
    };
  }, [shop?._id, slug]);

  useEffect(() => {
    setActiveCategory('all');
  }, [slug]);

  useEffect(() => {
    setReviewError('');
    setReviewSuccess('');
  }, [slug, user]);

  useEffect(() => {
    let active = true;
    if (!shop?._id || !user) {
      setUserReview(null);
      setReviewForm({ rating: 0, comment: '' });
      return () => {
        active = false;
      };
    }
    const loadUserReview = async () => {
      try {
        const { data } = await api.get(`/shops/${shopIdentifier}/reviews/user`);
        if (!active) return;
        setUserReview(data);
        setReviewForm({ rating: data.rating || 0, comment: data.comment || '' });
        setIsEditingReview(!Boolean(data.comment?.trim()));
      } catch (err) {
        if (!active) return;
        if (err.response?.status === 404) {
          setUserReview(null);
          setReviewForm({ rating: 0, comment: '' });
          setIsEditingReview(true);
        }
      }
    };
    loadUserReview();
    return () => {
      active = false;
    };
  }, [shop?._id, slug, user, reloadKey]);

  useEffect(() => {
    if (!shop) {
      setFollowersCount(0);
      return;
    }
    setFollowersCount(Number(shop.followersCount ?? 0));
  }, [shop?.followersCount, shop]);

  useEffect(() => {
    if (!shop?._id || !user) {
      setIsFollowing(false);
      return;
    }
    const list = Array.isArray(user.followingShops) ? user.followingShops : [];
    const following = list.some((entry) => String(entry) === String(shop._id));
    setIsFollowing(following);
  }, [shop?._id, user?.followingShops]);

  const categories = useMemo(() => {
    const seen = new Set();
    return products.reduce((acc, product) => {
      const raw = product?.category;
      const normalized = typeof raw === 'string' ? raw.trim() : '';
      if (!normalized || seen.has(normalized)) {
        return acc;
      }
      seen.add(normalized);
      acc.push(normalized);
      return acc;
    }, []);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!activeCategory || activeCategory === 'all') return products;
    return products.filter((product) => {
      const raw = product?.category;
      const normalized = typeof raw === 'string' ? raw.trim() : '';
      return normalized === activeCategory;
    });
  }, [activeCategory, products]);

  const hasOwnComment = Boolean(userReview?.comment?.trim());
  const showReviewForm = !hasOwnComment || isEditingReview;

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10">
        <p className="text-gray-600">Chargement de la boutique…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-10 space-y-3">
        <p className="text-red-600 font-semibold">{error}</p>
        <Link to="/" className="text-indigo-600 underline">
          Retourner à l&apos;accueil
        </Link>
      </main>
    );
  }

  if (!shop) return null;

  const phoneContent = shop.phone
    ? user
      ? shop.phone
      : (
        <Link to="/login" className="text-indigo-600 underline" state={{ from: `/shop/${slug}` }}>
          Connectez-vous pour voir ce numéro
        </Link>
      )
    : 'Non renseigné';

  const renderedPhone = typeof phoneContent === 'string' ? (
    <span className="text-gray-600">{phoneContent}</span>
  ) : (
    phoneContent
  );

  const ratingAverage = Number(shop.ratingAverage || 0);
  const ratingCount = Number(shop.ratingCount || 0);

  const hours = Array.isArray(shop.shopHours) ? shop.shopHours : [];
  const todayKey = (() => {
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayKeys[new Date().getDay()] || 'monday';
  })();

  const summaryStats = [
    { label: 'Produits disponibles', value: shop.productCount ?? products.length },
    { label: 'Avis déposés', value: ratingCount },
    { label: 'Abonnés', value: followersCount }
  ];

  const activeCategoryLabel = activeCategory === 'all' ? 'Tous les produits' : activeCategory;

  const callAction = user && shop.phone
    ? (
      <a
        href={`tel:${shop.phone}`}
        className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/30 hover:scale-105 hover:shadow-lg"
      >
        <Phone size={18} className="transition-transform duration-300 group-hover:scale-110" />
        Appeler la boutique
      </a>
    )
    : (
      <Link
        to="/login"
        state={{ from: `/shop/${slug}` }}
        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/60 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:border-white hover:bg-white/20 hover:scale-105"
      >
        <Phone size={18} />
        Connectez-vous pour appeler
      </Link>
    );

  const followLabel = shop?.shopVerified
    ? isFollowing
      ? 'Boutique suivie'
      : 'Suivre la boutique'
    : 'Boutique non certifiée';

  const handleFollowToggle = async () => {
    if (!shop?._id || followLoading) return;
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    if (!shop.shopVerified) return;
    setFollowLoading(true);
    try {
      const response = isFollowing
        ? await api.delete(`/users/shops/${shop._id}/follow`)
        : await api.post(`/users/shops/${shop._id}/follow`);
      setIsFollowing(!isFollowing);
      setFollowersCount(response.data?.followersCount ?? followersCount);
      if (typeof updateUser === 'function') {
        const currentList = Array.isArray(user.followingShops) ? user.followingShops : [];
        const normalized = currentList.map((entry) => String(entry));
        const nextList = isFollowing
          ? normalized.filter((entry) => entry !== String(shop._id))
          : Array.from(new Set([...normalized, String(shop._id)]));
        updateUser({ followingShops: nextList });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFollowLoading(false);
    }
  };

  const followButton = (
    <button
      type="button"
      onClick={handleFollowToggle}
      disabled={followLoading || !shop?.shopVerified}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl border-2 px-6 py-3 text-sm font-bold transition-all duration-300 ${
        isFollowing
          ? 'border-white/60 bg-gradient-to-r from-emerald-500/30 to-teal-500/30 text-white backdrop-blur-md hover:from-emerald-500/40 hover:to-teal-500/40 hover:scale-105 hover:shadow-lg'
          : 'border-white/60 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 hover:scale-105'
      } ${(!shop?.shopVerified || followLoading) ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
    >
      <Heart 
        size={18} 
        className={`transition-all duration-300 ${isFollowing ? 'fill-white text-white' : ''} ${!followLoading ? 'group-hover:scale-110' : ''}`}
      />
      {followLoading ? 'Traitement...' : followLabel}
    </button>
  );

  const loadAllComments = async () => {
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const { data } = await api.get(`/shops/${shopIdentifier}/reviews`, {
        params: { page: 1, limit: 50 }
      });
      setAllComments(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (err) {
      setCommentsError(
        err.response?.data?.message || err.message || 'Impossible de charger les commentaires.'
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const openCommentsModal = async () => {
    setShowCommentsModal(true);
    await loadAllComments();
  };

  const closeCommentsModal = () => {
    setShowCommentsModal(false);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    const hasRating = Boolean(reviewForm.rating);
    const hasComment = Boolean(reviewForm.comment?.trim());
    if (!hasRating && !hasComment) {
      setReviewError('Ajoutez une note ou un commentaire pour continuer.');
      return;
    }
    setReviewSubmitting(true);
    setReviewError('');
    setReviewSuccess('');
    try {
      const target = shopIdentifier;
      const { data } = await api.post(`/shops/${target}/reviews`, reviewForm);
      setUserReview(data);
      setReviewForm({ rating: data.rating || 0, comment: data.comment || '' });
      setIsEditingReview(!Boolean(data.comment?.trim()));
      setReviewSuccess('Votre avis a bien été enregistré.');
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      setReviewError(
        err.response?.data?.message || err.message || "Impossible d'enregistrer votre avis pour l'instant."
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleEditReview = (review) => {
    setIsEditingReview(true);
    setReviewForm({ rating: review.rating || 0, comment: review.comment || '' });
    setReviewSuccess('');
    setReviewError('');
  };

  return (
    <main className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8 text-slate-900">
        <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 text-white shadow-2xl">
          {shop.shopBanner && (
            <div className="absolute inset-0">
              <img
                src={shop.shopBanner}
                alt={`Bannière ${shop.shopName}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/70" />
            </div>
          )}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at top right, rgba(255,255,255,0.3), transparent 60%), radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 45%)'
            }}
          />
          <div className="relative z-10 flex flex-col gap-8 px-6 py-10 md:px-10 md:py-12">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-5">
                <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/40 bg-white/20">
                  {shop.shopLogo ? (
                    <img
                      src={shop.shopLogo}
                      alt={`Logo ${shop.shopName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold uppercase tracking-wide text-white/90">
                      {shop.shopName?.charAt(0) || 'B'}
                    </div>
                  )}
                </div>
                <div className="w-full space-y-1 text-center text-white sm:text-left">
                  <p className="text-xs uppercase tracking-[0.4em] text-white/80">Boutique</p>
                  <div className="flex flex-col items-center justify-center gap-1 sm:flex-row sm:items-center sm:justify-start">
                    <h1 className="text-3xl font-bold leading-tight text-white">{shop.shopName}</h1>
                    <VerifiedBadge verified={shop.shopVerified} />
                  </div>
                  <p className="text-sm text-white/80">Gérée par {shop.ownerName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 text-sm text-white/80">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Créée le {formatDate(shop.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{shop.shopAddress || 'Adresse non renseignée'}</span>
                </div>
              </div>
            </div>
            <p className="max-w-2xl text-sm text-white/80">
              {shop.shopDescription || 'Aucune description publique n’a encore été ajoutée à cette boutique.'}
            </p>
            <div className="grid gap-4 text-xs uppercase tracking-[0.2em] text-white/80 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-center backdrop-blur">
                <p className="text-[10px]">Prod. disponibles</p>
                <p className="mt-2 text-lg font-semibold">{formatCount(shop.productCount ?? products.length)}</p>
              </div>
              <div className="rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-center backdrop-blur">
                <p className="text-[10px]">Avis</p>
                <p className="mt-2 text-lg font-semibold">{formatRatingLabel(ratingAverage)}</p>
              </div>
              <div className="rounded-2xl border border-white/30 bg-white/5 px-4 py-3 text-center backdrop-blur">
                <p className="text-[10px]">Abonnés</p>
                <p className="mt-2 text-lg font-semibold">{formatCount(followersCount)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-center">
              {callAction}
              {followButton}
              <Link
                to="/shops/verified"
                className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:border-white"
              >
                Découvrir d’autres boutiques
              </Link>
            </div>
          </div>
        </section>

        {/* Premium Reviews Section */}
        <section className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-white to-gray-50/50 p-8 shadow-xl">
          <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <Star size={24} className="text-amber-600 fill-amber-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Avis & Commentaires</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {ratingCount} avis • Note moyenne {formatRatingLabel(ratingAverage)}/5
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={openCommentsModal}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-all duration-200 hover:bg-indigo-100 hover:border-indigo-300 hover:scale-105"
              >
                <MessageCircle size={16} />
                Voir tous les commentaires
              </button>
            </div>
            
            {/* Rating Distribution (if we have reviews) */}
            {ratingCount > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="text-center">
                    <div className="text-5xl font-black bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                      {formatRatingLabel(ratingAverage)}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={20}
                          className={star <= Math.round(ratingAverage) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{formatCount(ratingCount)} avis vérifiés</p>
                  </div>
                </div>
              </div>
            )}
            {reviewSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                <CheckCircle size={20} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-medium text-emerald-800">{reviewSuccess}</p>
              </div>
            )}
            {showReviewForm && (
              <form className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6" onSubmit={handleReviewSubmit}>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-900">Votre note</label>
                  <div className="flex items-center gap-2">
                    {ratingOptions.map((value) => (
                      <button
                        type="button"
                        key={`rating-${value}`}
                        onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                        className={`group flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                          reviewForm.rating === value
                            ? 'border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 scale-105 shadow-md'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                        }`}
                      >
                        <Star 
                          size={16} 
                          className={reviewForm.rating === value ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} 
                        />
                        <span>{value}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-900">Votre commentaire</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(event) =>
                      setReviewForm((prev) => ({ ...prev, comment: event.target.value }))
                    }
                    rows={4}
                    className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all duration-200 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    placeholder="Partagez votre expérience avec cette boutique..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {reviewError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-medium text-red-800">{reviewError}</p>
                    </div>
                  )}
                  {!user && (
                    <p className="text-xs text-gray-600">
                      <Link to="/login" state={{ from: `/shop/${slug}` }} className="font-semibold text-indigo-600 hover:text-indigo-700">
                        Connectez-vous
                      </Link>{' '}
                      pour laisser un commentaire.
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={reviewSubmitting || !user}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {reviewSubmitting
                    ? 'Envoi en cours…'
                    : userReview
                      ? 'Mettre à jour mon avis'
                      : 'Publier mon avis'}
                </button>
              </form>
            )}
            {!showReviewForm && hasOwnComment && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-900">Votre commentaire est publié.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingReview(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-100"
                >
                  <Edit3 size={14} />
                  Modifier
                </button>
              </div>
            )}
            <div className="space-y-4">
              {recentReviews.length ? (
                recentReviews.map((review) => {
                  const isOwnReview =
                    Boolean(user) &&
                    Boolean(review.user?._id) &&
                    String(review.user._id) === String(user.id);
                  return (
                    <div
                      key={review._id}
                      className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100">
                            <span className="text-sm font-bold text-indigo-600">
                              {(review.user?.name || review.user?.shopName || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    className={star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-bold text-gray-900">
                                {formatRatingLabel(review.rating)}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">
                              {review.user?.name || review.user?.shopName || 'Utilisateur'}
                            </p>
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {review.comment || 'Pas de commentaire fourni.'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                          {isOwnReview && (
                            <button
                              type="button"
                              onClick={() => handleEditReview(review)}
                              className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-indigo-600"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <MessageCircle size={32} className="text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">Aucun commentaire publié pour le moment.</p>
                </div>
              )}
            </div>
          </article>
        </section>

        {/* Premium Hours & Rating Section */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="space-y-6">
            <article className="overflow-hidden rounded-3xl border border-gray-200/60 bg-gradient-to-br from-white to-gray-50/30 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/30 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
                    <Clock className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Horaires d&apos;ouverture</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Planification communiquée par la boutique</p>
                  </div>
                </div>
                <span className="rounded-full bg-indigo-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                  Données directes
                </span>
              </div>
              {hours.length ? (
                <div className="space-y-3 px-6 py-5">
                  {hours.map((entry) => {
                    const dayLabel = DAY_LABELS[entry.day] || entry.day || 'Jour';
                    const timeLabel = entry.closed
                      ? 'Fermé'
                      : entry.open && entry.close
                        ? `${entry.open} – ${entry.close}`
                        : 'Horaires partiels';
                    const isToday = entry.day === todayKey;
                    return (
                      <div
                        key={`${entry.day}-${entry.open}-${entry.close}`}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
                          isToday ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">{dayLabel}</p>
                            {isToday && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600">
                                Aujourd&apos;hui
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{timeLabel}</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            entry.closed ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              entry.closed ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                          />
                          {entry.closed ? 'Fermé' : 'Ouvert'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-6 py-5">
                  <p className="text-sm text-slate-500">Pas encore d’horaire organisé.</p>
                </div>
              )}
            </article>

            <article className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Note moyenne</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Star className="h-6 w-6 text-yellow-500" />
                <span className="text-4xl font-bold text-gray-900">{formatRatingLabel(ratingAverage)}</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">{formatCount(ratingCount)} avis vérifiés</p>
            </article>
          </div>
        </section>

        {/* Top Selling Products Section */}
        <section className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-emerald-50/30 via-white to-teal-50/20 p-8 shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 shadow-md">
                  <TrendingUp size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Produits les plus vendus</h2>
                  <p className="text-sm text-gray-500 mt-1">Les 5 meilleures ventes de cette boutique</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 px-4 py-2 border border-emerald-200 shadow-sm">
                <Award size={18} className="text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700">Top Ventes</span>
              </div>
            </div>
            
            {topSellingLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-gray-100 aspect-square" />
                ))}
              </div>
            ) : topSellingError && topSellingProducts.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                <X size={20} className="text-red-600 flex-shrink-0" />
                <p className="text-sm font-medium text-red-800">{topSellingError}</p>
              </div>
            ) : topSellingProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {topSellingProducts.map((product, index) => (
                  <div
                    key={product._id}
                    className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm transition-all duration-300 hover:border-emerald-300 hover:shadow-lg hover:scale-105"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-2 left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg ring-2 ring-white">
                      <span className="text-sm font-black">#{index + 1}</span>
                    </div>
                    
                    {/* Product Image */}
                    <Link
                      to={buildProductPath(product)}
                      {...externalLinkProps}
                      className="block aspect-square overflow-hidden bg-gray-100"
                    >
                      <img
                        src={product.images?.[0] || product.image || '/api/placeholder/200/200'}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        loading="lazy"
                      />
                    </Link>
                    
                    {/* Product Info */}
                    <div className="p-3 space-y-2">
                      <Link
                        to={buildProductPath(product)}
                        {...externalLinkProps}
                        className="block"
                      >
                        <h3 className="text-xs font-bold text-gray-900 line-clamp-2 group-hover:text-emerald-600 transition-colors">
                          {product.title}
                        </h3>
                      </Link>
                      
                      {/* Price */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-gray-900">
                          {formatCurrency(product.price)}
                        </span>
                        {product.priceBeforeDiscount && product.priceBeforeDiscount > product.price && (
                          <span className="text-[10px] text-gray-400 line-through">
                            {formatCurrency(product.priceBeforeDiscount)}
                          </span>
                        )}
                      </div>
                      
                      {/* Sales Count Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 border border-emerald-200">
                          <TrendingUp size={10} className="text-emerald-600" />
                          <span className="text-[10px] font-bold text-emerald-700">
                            {formatCount(product.salesCount || 0)} vente{product.salesCount > 1 ? 's' : ''}
                          </span>
                        </div>
                        {product.ratingAverage > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-semibold text-gray-600">
                              {Number(product.ratingAverage).toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <TrendingUp size={32} className="text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Aucun produit vendu pour le moment.</p>
              </div>
            )}
          </section>

        {/* Premium Products Section */}
        <section className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-white to-gray-50/30 p-8 shadow-xl">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100">
                <Package size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Produits de la boutique</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    activeCategory === 'all'
                      ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-md scale-105'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  <Grid3x3 size={14} />
                  Tous
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-bold transition-all duration-200 ${
                      activeCategory === category
                        ? 'border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 shadow-md scale-105'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filteredProducts.length ? (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => (
                <ProductCard key={product._id} p={product} hideMobileDiscountBadge />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-slate-50 px-6 py-12 text-center">
              <p className="text-lg font-semibold text-gray-700">
                {categories.length && activeCategory !== 'all'
                  ? `Aucun produit dans la catégorie ${activeCategory}.`
                  : 'Aucun produit publié pour le moment.'}
              </p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Retour à l’accueil
              </Link>
            </div>
          )}
        </section>
        {/* Premium Comments Modal */}
        {showCommentsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8">
            <div className="relative w-full max-w-4xl rounded-3xl border border-gray-200 bg-white shadow-2xl max-h-[90vh] flex flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                    <MessageCircle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Tous les commentaires</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{allComments.length} commentaire{allComments.length > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCommentsModal}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 transition-all duration-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700"
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
                      <p className="text-sm font-medium text-gray-600">Chargement des commentaires…</p>
                    </div>
                  </div>
                ) : commentsError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                    <X size={20} className="text-red-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-800">{commentsError}</p>
                  </div>
                ) : !allComments.length ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                    <MessageCircle size={48} className="text-gray-400 mx-auto mb-4" />
                    <p className="text-sm font-medium text-gray-600">Aucun commentaire pour cette boutique.</p>
                  </div>
                ) : (
                  allComments.map((review) => (
                    <div
                      key={`modal-${review._id}`}
                      className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-indigo-200"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex-shrink-0">
                          <span className="text-base font-bold text-indigo-600">
                            {(review.user?.name || review.user?.shopName || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-900">
                                {review.user?.name || review.user?.shopName || 'Utilisateur'}
                              </p>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    className={star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-gray-600">
                                {formatRatingLabel(review.rating)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(review.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{review.comment || 'Pas de commentaire.'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
