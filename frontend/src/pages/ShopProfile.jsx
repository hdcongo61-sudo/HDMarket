import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Clock, MapPin, Phone, Star, Users, Edit3, X } from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import AuthContext from '../context/AuthContext';
import VerifiedBadge from '../components/VerifiedBadge';

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

  useEffect(() => {
    let active = true;
    const fetchShop = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/shops/${slug}`);
        if (!active) return;
        setShop(data.shop);
        setProducts(Array.isArray(data.products) ? data.products : []);
        setRecentReviews(Array.isArray(data.recentReviews) ? data.recentReviews : []);
        setError('');
      } catch (e) {
        if (!active) return;
        setError(e.response?.data?.message || e.message || 'Boutique introuvable.');
        setShop(null);
        setProducts([]);
        setRecentReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchShop();
    return () => {
      active = false;
    };
  }, [slug, reloadKey]);

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
        const { data } = await api.get(`/shops/${slug}/reviews/user`);
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
        className="inline-flex items-center justify-center rounded-full bg-white/20 px-5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30"
      >
        Appeler la boutique
      </a>
    )
    : (
      <Link
        to="/login"
        state={{ from: `/shop/${slug}` }}
        className="inline-flex items-center justify-center rounded-full border border-white/60 px-5 py-2 text-sm font-semibold text-white transition hover:border-white"
      >
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
      className={`inline-flex items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition motion-safe:hover:scale-105 motion-safe:animate-pulse ${
        isFollowing
          ? 'border-white/60 bg-white/20 text-white hover:bg-white/30'
          : 'border-white text-white hover:bg-white/10'
      } ${(!shop?.shopVerified || followLoading) ? 'opacity-50 cursor-not-allowed motion-safe:animate-none' : ''}`}
    >
      {followLoading ? 'Traitement...' : followLabel}
    </button>
  );

  const loadAllComments = async () => {
    setCommentsLoading(true);
    setCommentsError('');
    try {
      const { data } = await api.get(`/shops/${slug}/reviews`, {
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
      const target = shop?.slug || slug;
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

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm font-serif text-slate-800">
          <article className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Commentaires récents</h3>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sélection</p>
              </div>
              <button
                type="button"
                onClick={openCommentsModal}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-400"
              >
                Voir tous les commentaires
              </button>
            </div>
            {reviewSuccess && (
              <p className="mt-3 text-xs text-emerald-600">{reviewSuccess}</p>
            )}
            {showReviewForm && (
              <form className="space-y-4" onSubmit={handleReviewSubmit}>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">Votre note</p>
                  <div className="flex items-center gap-2">
                    {ratingOptions.map((value) => (
                      <button
                        type="button"
                        key={`rating-${value}`}
                        onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          reviewForm.rating === value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        <Star className="inline-block h-3 w-3 text-amber-500" />
                        <span className="ml-1">{value}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Commentaire</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(event) =>
                      setReviewForm((prev) => ({ ...prev, comment: event.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Partagez votre expérience avec cette boutique..."
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                  {!user && (
                    <p className="text-xs text-slate-500">
                      <Link to="/login" state={{ from: `/shop/${slug}` }} className="text-indigo-600">
                        Connectez-vous
                      </Link>{' '}
                      pour laisser un commentaire.
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={reviewSubmitting || !user}
                  className="w-full rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
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
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p>Votre commentaire est publié.</p>
                <button
                  type="button"
                  onClick={() => setIsEditingReview(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"
                >
                  <Edit3 className="h-4 w-4" />
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
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4 leading-relaxed text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-semibold text-slate-800">
                            {formatRatingLabel(review.rating)}
                          </span>
                          <span className="text-xs italic text-slate-500">
                            {review.user?.name || review.user?.shopName || 'Utilisateur'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                          {isOwnReview && (
                            <button
                              type="button"
                              onClick={() => handleEditReview(review)}
                              className="inline-flex items-center justify-center rounded-full p-1 text-slate-500 hover:bg-white/70"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">
                        {review.comment || 'Pas de commentaire fourni.'}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">Aucun commentaire publié pour le moment.</p>
              )}
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="space-y-6">
            <article className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Horaires d&apos;ouverture</h3>
                <span className="text-xs uppercase tracking-[0.3em] text-gray-500">Données directes</span>
              </div>
              {hours.length ? (
                <div className="mt-4 space-y-3">
                  {hours.map((entry) => {
                    const dayLabel = DAY_LABELS[entry.day] || entry.day || 'Jour';
                    const timeLabel = entry.closed
                      ? 'Fermé'
                      : entry.open && entry.close
                        ? `${entry.open} – ${entry.close}`
                        : 'Horaires partiels';
                    return (
                      <div
                        key={`${entry.day}-${entry.open}-${entry.close}`}
                        className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{dayLabel}</p>
                          <p className="text-xs text-gray-500">{timeLabel}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold rounded-full px-3 py-1 ${
                            entry.closed ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {entry.closed ? 'Fermé' : 'Ouvert'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Pas encore d’horaire organisé.</p>
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

        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Catalogue</p>
              <h2 className="text-2xl font-semibold text-gray-900">Produits de la boutique</h2>
              <p className="text-sm text-gray-500">{filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} affiché{filteredProducts.length > 1 ? 's' : ''}</p>
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`rounded-full border px-4 py-1 text-xs font-semibold transition ${
                    activeCategory === 'all'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Tous
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full border px-4 py-1 text-xs font-semibold transition ${
                      activeCategory === category
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
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
                <ProductCard key={product._id} p={product} />
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
        {showCommentsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
            <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Tous les commentaires</h3>
                <button
                  type="button"
                  onClick={closeCommentsModal}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 h-[60vh] space-y-4 overflow-y-auto pr-2">
                {commentsLoading ? (
                  <p className="text-sm text-slate-500">Chargement des commentaires…</p>
                ) : commentsError ? (
                  <p className="text-sm text-red-600">{commentsError}</p>
                ) : !allComments.length ? (
                  <p className="text-sm text-slate-500">Aucun commentaire pour cette boutique.</p>
                ) : (
                  allComments.map((review) => (
                    <div
                      key={`modal-${review._id}`}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{review.user?.name || review.user?.shopName || 'Utilisateur'}</span>
                        <span>{formatDate(review.createdAt)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-slate-800">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-semibold">{formatRatingLabel(review.rating)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{review.comment || 'Pas de commentaire.'}</p>
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
