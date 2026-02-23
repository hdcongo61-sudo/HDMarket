import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Package,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
  X
} from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import AuthContext from '../context/AuthContext';
import VerifiedBadge from '../components/VerifiedBadge';
import { buildProductPath } from '../utils/links';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';
import useIsMobile from '../hooks/useIsMobile';
import { formatPriceWithStoredSettings } from '../utils/priceFormatter';
import { useToast } from '../context/ToastContext';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche'
};
const WEEKDAY_TO_KEY = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday'
};
const SHOP_SNAPSHOT_PREFIX = 'hdmarket:shop-snapshot:';

const numberFormatter = new Intl.NumberFormat('fr-FR');

const formatCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return numberFormatter.format(parsed);
};

const formatRatingLabel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0,0';
  return parsed.toFixed(1).replace('.', ',');
};

const formatDate = (value) => {
  if (!value) return 'Date inconnue';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date inconnue';
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value) => formatPriceWithStoredSettings(value);

const normalizeTimeLabel = (value) => {
  if (!value) return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return str;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const toMinutes = (timeValue) => {
  const normalized = normalizeTimeLabel(timeValue);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const getTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Brazzaville';
  } catch {
    return 'Africa/Brazzaville';
  }
};

const getNowInTimeZone = (timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const weekday = String(parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  const dayKey = WEEKDAY_TO_KEY[weekday] || 'monday';
  return { dayKey, minutes: hour * 60 + minute };
};

const getOpeningSummary = (hours, timeZone) => {
  const normalizedHours = DAY_ORDER.map((day) => {
    const entry = Array.isArray(hours) ? hours.find((item) => item?.day === day) : null;
    return {
      day,
      dayLabel: DAY_LABELS[day],
      closed: Boolean(entry?.closed),
      open: normalizeTimeLabel(entry?.open || ''),
      close: normalizeTimeLabel(entry?.close || '')
    };
  });

  const { dayKey: todayKey, minutes: currentMinutes } = getNowInTimeZone(timeZone);
  const todayIndex = Math.max(0, DAY_ORDER.indexOf(todayKey));
  const today = normalizedHours[todayIndex];

  let isOpen = false;
  let closesAt = null;

  if (today && !today.closed && today.open && today.close) {
    const openMinutes = toMinutes(today.open);
    const closeMinutes = toMinutes(today.close);
    if (openMinutes != null && closeMinutes != null) {
      if (closeMinutes > openMinutes) {
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      } else if (closeMinutes < openMinutes) {
        isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
      }
      if (isOpen) closesAt = today.close;
    }
  }

  let nextOpen = null;
  if (!isOpen) {
    for (let offset = 0; offset < 7; offset += 1) {
      const index = (todayIndex + offset) % 7;
      const item = normalizedHours[index];
      if (!item || item.closed || !item.open) continue;
      const openMinutes = toMinutes(item.open);
      if (offset === 0 && openMinutes != null && openMinutes <= currentMinutes) continue;
      nextOpen = { ...item, offset };
      break;
    }
  }

  let statusText = 'Fermé';
  if (isOpen && closesAt) {
    statusText = `Ouvert · Ferme à ${closesAt}`;
  } else if (nextOpen) {
    if (nextOpen.offset === 0) {
      statusText = `Fermé · Ouvre à ${nextOpen.open}`;
    } else if (nextOpen.offset === 1) {
      statusText = `Fermé · Ouvre demain à ${nextOpen.open}`;
    } else {
      statusText = `Fermé · Ouvre ${nextOpen.dayLabel} à ${nextOpen.open}`;
    }
  }

  return {
    todayKey,
    statusText,
    isOpen,
    closesAt,
    nextOpen,
    normalizedHours
  };
};

const readShopSnapshot = (slug) => {
  if (!slug || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${SHOP_SNAPSHOT_PREFIX}${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.shop || typeof parsed.shop !== 'object') return null;
    if (!parsed.shop._id) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeShopSnapshot = (slug, payload) => {
  if (!slug || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${SHOP_SNAPSHOT_PREFIX}${slug}`, JSON.stringify(payload));
  } catch {
    // ignore storage quota issues
  }
};

const useSectionInView = ({ rootMargin = '220px' } = {}) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) return undefined;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return [ref, isVisible];
};

const ShopHeaderSkeleton = memo(function ShopHeaderSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="h-44 animate-pulse bg-slate-200 sm:h-52" />
      <div className="space-y-3 px-4 pb-5 pt-12 sm:px-6">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
});

const ProductsSkeleton = memo(function ProductsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="aspect-[0.72] animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
});

const OpeningHoursCard = memo(function OpeningHoursCard({ hours, className = '', certified = false }) {
  const [expanded, setExpanded] = useState(false);
  const timeZone = getTimeZone();

  const summary = useMemo(() => getOpeningSummary(hours, timeZone), [hours, timeZone]);

  return (
    <section
      className={`rounded-2xl border bg-white shadow-sm ${
        certified ? 'border-emerald-200/90' : 'border-slate-200'
      } ${className}`}
      aria-label="Horaires d'ouverture"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Horaires</h3>
          <p className="mt-1 text-xs text-slate-500">Fuseau: {timeZone}</p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            summary.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${summary.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {summary.isOpen ? 'Ouvert' : 'Fermé'}
        </span>
      </div>

      <div className={`border-y px-4 py-3 sm:px-5 ${certified ? 'border-emerald-100/80' : 'border-slate-100'}`}>
        <p className="text-sm font-medium text-slate-800">{summary.statusText}</p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:px-5"
        aria-expanded={expanded}
        aria-controls="shop-hours-weekly"
      >
        <span>Voir la semaine complète</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      <div
        id="shop-hours-weekly"
        className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-2 px-4 pb-4 sm:px-5">
            {summary.normalizedHours.map((entry) => {
              const isToday = entry.day === summary.todayKey;
              return (
                <li
                  key={entry.day}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                    isToday ? 'bg-neutral-50 text-neutral-700' : 'text-slate-600'
                  }`}
                >
                  <span className="font-medium">{entry.dayLabel}</span>
                  <span>
                    {entry.closed ? 'Fermé' : entry.open && entry.close ? `${entry.open} - ${entry.close}` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
});

export default function ShopProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const isMobile = useIsMobile();
  const externalLinkProps = useDesktopExternalLink();

  const [activeCategory, setActiveCategory] = useState('all');
  const [promoOnly, setPromoOnly] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  const [productsRef, productsInView] = useSectionInView({ rootMargin: '320px' });
  const [reviewsRef, reviewsInView] = useSectionInView({ rootMargin: '240px' });

  const shopQuery = useQuery({
    queryKey: ['shop-profile', slug],
    enabled: Boolean(slug),
    initialData: () => readShopSnapshot(slug),
    initialDataUpdatedAt: 0,
    refetchOnMount: 'always',
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/shops/${slug}`, {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      writeShopSnapshot(slug, data);
      return data;
    }
  });

  const shop = shopQuery.data?.shop || null;
  const products = useMemo(() => (Array.isArray(shopQuery.data?.products) ? shopQuery.data.products : []), [shopQuery.data?.products]);
  const recentReviews = useMemo(
    () => (Array.isArray(shopQuery.data?.recentReviews) ? shopQuery.data.recentReviews : []),
    [shopQuery.data?.recentReviews]
  );

  const shopIdentifier = shop?.slug || shop?._id || slug;
  const userScopeId = user?._id || user?.id;

  const userReviewQuery = useQuery({
    queryKey: ['shop-user-review', shopIdentifier, userScopeId],
    enabled: Boolean(shopIdentifier && userScopeId),
    staleTime: 15 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/shops/${shopIdentifier}/reviews/user`, {
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return data;
    }
  });

  const allCommentsQuery = useQuery({
    queryKey: ['shop-reviews', shopIdentifier, 'all'],
    enabled: Boolean(showCommentsModal && shopIdentifier),
    staleTime: 20 * 1000,
    queryFn: async () => {
      const { data } = await api.get(`/shops/${shopIdentifier}/reviews`, {
        params: { page: 1, limit: 50 },
        skipCache: true,
        headers: { 'x-skip-cache': '1' }
      });
      return Array.isArray(data?.reviews) ? data.reviews : [];
    }
  });

  const currentUserReview = userReviewQuery.data || null;

  useEffect(() => {
    if (currentUserReview) {
      setReviewForm({
        rating: Number(currentUserReview.rating || 0),
        comment: currentUserReview.comment || ''
      });
      setIsEditingReview(!Boolean(currentUserReview.comment?.trim()));
      return;
    }
    setReviewForm({ rating: 0, comment: '' });
    setIsEditingReview(true);
  }, [currentUserReview?._id, currentUserReview?.rating, currentUserReview?.comment]);

  useEffect(() => {
    setActiveCategory('all');
    setPromoOnly(false);
    setReviewSuccess('');
    setReviewError('');
  }, [slug]);

  const categories = useMemo(() => {
    const seen = new Set();
    return products.reduce((acc, product) => {
      const category = String(product?.category || '').trim();
      if (!category || seen.has(category)) return acc;
      seen.add(category);
      acc.push(category);
      return acc;
    }, []);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const byCategory =
      activeCategory === 'all'
        ? products
        : products.filter((product) => String(product?.category || '').trim() === activeCategory);
    if (!promoOnly) return byCategory;
    return byCategory.filter((product) => Boolean(product?.hasActivePromo));
  }, [activeCategory, promoOnly, products]);

  const topSellingProducts = useMemo(() => {
    return [...products]
      .filter((product) => Number(product?.salesCount || 0) > 0)
      .sort((a, b) => Number(b.salesCount || 0) - Number(a.salesCount || 0))
      .slice(0, 6);
  }, [products]);

  const hasPromoProducts = useMemo(() => products.some((product) => Boolean(product?.hasActivePromo)), [products]);

  const isFollowing = useMemo(() => {
    if (!shop?._id || !Array.isArray(user?.followingShops)) return false;
    return user.followingShops.some((entry) => String(entry) === String(shop._id));
  }, [shop?._id, user?.followingShops]);
  const viewerUserId = user?._id || user?.id || null;
  const isOwnShop = useMemo(
    () => Boolean(viewerUserId && shop?._id && String(viewerUserId) === String(shop._id)),
    [shop?._id, viewerUserId]
  );

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!shop?._id) throw new Error('Boutique introuvable.');
      if (isFollowing) {
        const { data } = await api.delete(`/users/shops/${shop._id}/follow`);
        return data;
      }
      const { data } = await api.post(`/users/shops/${shop._id}/follow`);
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['shop-profile', slug] });
      const previous = queryClient.getQueryData(['shop-profile', slug]);
      queryClient.setQueryData(['shop-profile', slug], (old) => {
        if (!old?.shop) return old;
        const currentFollowers = Number(old.shop.followersCount || 0);
        const nextFollowers = isFollowing
          ? Math.max(0, currentFollowers - 1)
          : currentFollowers + 1;
        return {
          ...old,
          shop: {
            ...old.shop,
            followersCount: nextFollowers
          }
        };
      });
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['shop-profile', slug], context.previous);
      }
      showToast(
        err?.response?.data?.message || err?.message || 'Impossible de suivre cette boutique.',
        { variant: 'error' }
      );
    },
    onSuccess: (data) => {
      if (typeof updateUser === 'function' && shop?._id) {
        const current = Array.isArray(user?.followingShops)
          ? user.followingShops.map((entry) => String(entry))
          : [];
        const next = isFollowing
          ? current.filter((entry) => entry !== String(shop._id))
          : Array.from(new Set([...current, String(shop._id)]));
        updateUser({ followingShops: next });
      }

      queryClient.setQueryData(['shop-profile', slug], (old) => {
        if (!old?.shop) return old;
        return {
          ...old,
          shop: {
            ...old.shop,
            followersCount: Number(data?.followersCount ?? old.shop.followersCount ?? 0)
          }
        };
      });
      showToast(data?.message || (isFollowing ? 'Boutique désabonnée.' : 'Boutique suivie.'), {
        variant: 'success'
      });
    }
  });
  const followDisabled = followMutation.isPending || !shop?._id || !shop?.shopVerified || isOwnShop;

  const reviewMutation = useMutation({
    mutationFn: async ({ rating, comment }) => {
      const { data } = await api.post(`/shops/${shopIdentifier}/reviews`, { rating, comment });
      return data;
    },
    onSuccess: (data) => {
      setReviewSuccess('Votre avis a été enregistré.');
      setReviewError('');
      setIsEditingReview(!Boolean(data?.comment?.trim()));
      queryClient.setQueryData(['shop-user-review', shopIdentifier, userScopeId], data);
      queryClient.invalidateQueries({ queryKey: ['shop-profile', slug] });
      queryClient.invalidateQueries({ queryKey: ['shop-reviews', shopIdentifier] });
    },
    onError: (err) => {
      setReviewSuccess('');
      setReviewError(
        err?.response?.data?.message ||
          err?.message ||
          "Impossible d'enregistrer votre avis pour l'instant."
      );
    }
  });

  const goToMessage = useCallback(() => {
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    const firstProduct = products[0];
    if (firstProduct?._id) {
      navigate('/orders/messages', { state: { inquireProduct: firstProduct } });
      return;
    }
    navigate('/orders/messages');
  }, [navigate, products, slug, user]);

  const handleDirections = useCallback(() => {
    const query = shop?.shopAddress || shop?.shopName || 'HDMarket';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [shop?.shopAddress, shop?.shopName]);

  const handleFollowToggle = useCallback(() => {
    if (followMutation.isPending) return;
    if (!shop?._id) {
      showToast('Chargement de la boutique en cours. Réessayez dans un instant.', { variant: 'info' });
      shopQuery.refetch();
      return;
    }
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    if (isOwnShop) {
      showToast('Vous ne pouvez pas suivre votre propre boutique.', { variant: 'info' });
      return;
    }
    if (!shop.shopVerified) {
      showToast('Seules les boutiques certifiées peuvent être suivies.', { variant: 'info' });
      return;
    }
    followMutation.mutate();
  }, [followMutation, isOwnShop, navigate, shop?._id, shop?.shopVerified, shopQuery, showToast, slug, user]);

  const handleSubmitReview = (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/shop/${slug}` } });
      return;
    }
    const rating = Number(reviewForm.rating || 0);
    const comment = String(reviewForm.comment || '').trim();
    if (!rating && !comment) {
      setReviewError('Ajoutez une note ou un commentaire pour continuer.');
      return;
    }
    reviewMutation.mutate({ rating, comment });
  };

  const ratingAverage = Number(shop?.ratingAverage || 0);
  const ratingCount = Number(shop?.ratingCount || 0);
  const followersCount = Number(shop?.followersCount || 0);
  const isCertifiedShop = Boolean(shop?.shopVerified);
  const hasActivePromo = Boolean(shop?.hasActivePromo && Number(shop?.activePromoCountNow || 0) > 0);
  const hasFreeDelivery = Boolean(shop?.freeDeliveryEnabled);
  const ownCommentExists = Boolean(currentUserReview?.comment?.trim());
  const showReviewForm = !ownCommentExists || isEditingReview;

  const stats = [
    {
      icon: <Package size={16} className="text-neutral-600" />,
      label: 'Produits',
      value: formatCount(shop?.productCount ?? products.length)
    },
    {
      icon: <Star size={16} className="text-amber-500" />,
      label: 'Note',
      value: formatRatingLabel(ratingAverage)
    },
    {
      icon: <Users size={16} className="text-sky-600" />,
      label: 'Abonnés',
      value: formatCount(followersCount)
    }
  ];

  const isOfflineSnapshot = shopQuery.isError && Boolean(shopQuery.data);

  if (shopQuery.isLoading && !shop) {
    return (
      <main className="bg-slate-50 pb-24 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-5 lg:px-8">
          <ShopHeaderSkeleton />
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="h-56 animate-pulse rounded-2xl bg-white" />
              <div className="h-72 animate-pulse rounded-2xl bg-white" />
            </div>
            <div className="h-72 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  if (shopQuery.isError && !shop) {
    return (
      <main className="bg-slate-50 pb-24 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-red-700">
              {shopQuery.error?.response?.data?.message || shopQuery.error?.message || 'Boutique introuvable.'}
            </p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900">
              Retour à l'accueil
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!shop) {
    return (
      <main className="bg-slate-50 pb-24 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Impossible d'afficher cette boutique pour le moment.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => shopQuery.refetch()}
                className="inline-flex min-h-11 items-center rounded-xl bg-neutral-600 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700"
              >
                Réessayer
              </button>
              <Link to="/" className="text-sm font-semibold text-neutral-700 hover:text-neutral-900 dark:text-neutral-300">
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const phoneLabel = user && shop.phone ? shop.phone : 'Connectez-vous pour afficher le numéro';

  return (
    <main
      className={`bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        isMobile ? (isCertifiedShop ? 'pb-44' : 'pb-28') : 'pb-12'
      }`}
    >
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <header
          className={`sticky top-20 z-20 mb-4 rounded-2xl border bg-white/85 px-4 py-3 backdrop-blur-xl dark:bg-slate-900/85 sm:top-24 md:top-28 ${
            isCertifiedShop
              ? 'border-emerald-200/70 dark:border-emerald-900/70'
              : 'border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                {isCertifiedShop ? 'Boutique certifiée' : 'Boutique'}
              </p>
              <h1 className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">{shop.shopName}</h1>
            </div>
            <div className="flex items-center gap-2">
              {isMobile && isCertifiedShop && (
                <span className="inline-flex min-h-9 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold text-emerald-700">
                  Certifiée
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Retour
              </button>
              {!isMobile && (
                <button
                  type="button"
                  onClick={goToMessage}
                  className="min-h-11 rounded-xl bg-neutral-600 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700"
                >
                  Message
                </button>
              )}
            </div>
          </div>
        </header>

        {isOfflineSnapshot && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Vous consultez une version hors ligne récente de cette boutique. Les données se mettront à jour dès la reconnexion.
          </div>
        )}

        <section
          className={`relative overflow-hidden rounded-3xl border bg-slate-900 text-white shadow-lg ${
            isCertifiedShop ? 'border-emerald-300/40' : 'border-slate-200'
          }`}
        >
          <div className="h-36 w-full sm:h-56 lg:h-64">
            {shop.shopBanner ? (
              <img
                src={shop.shopBanner}
                alt={`Bannière ${shop.shopName}`}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700" />
            )}
            <div
              className={`absolute inset-0 bg-gradient-to-t ${
                isCertifiedShop
                  ? 'from-emerald-950/90 via-slate-900/40 to-transparent'
                  : 'from-slate-950/85 via-slate-900/35 to-transparent'
              }`}
            />
          </div>

          <div className="relative z-10 px-4 pb-5 pt-0 sm:px-6 sm:pb-6">
            <div className="-mt-10 flex flex-col items-center gap-3 text-center sm:-mt-14 sm:flex-row sm:items-start sm:gap-4 sm:text-left">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white/80 bg-white shadow-md sm:h-24 sm:w-24">
                {shop.shopLogo ? (
                  <img src={shop.shopLogo} alt={`Logo ${shop.shopName}`} className="h-full w-full object-cover" loading="eager" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-bold text-slate-600">
                    {String(shop.shopName || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-1 sm:pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h2 className="truncate text-xl font-bold sm:text-2xl">{shop.shopName}</h2>
                  <VerifiedBadge verified={shop.shopVerified} />
                </div>
                <p className="mt-1 text-sm text-white/85">Gérée par {shop.ownerName}</p>
                <p className="mt-2 line-clamp-2 text-sm text-white/80 sm:line-clamp-3">
                  {shop.shopDescription || 'Cette boutique n\'a pas encore ajouté de description publique.'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur">
                  <div className="flex items-center gap-1 text-[11px] text-white/80">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold leading-none">{item.value}</p>
                </div>
              ))}
            </div>

            {isCertifiedShop && (
              <div className="mt-3 rounded-xl border border-emerald-300/70 bg-emerald-300/20 px-3 py-2 text-xs font-semibold text-emerald-50">
                <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <ShieldCheck size={14} />
                  Boutique certifiée HDMarket
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hasActivePromo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-100">
                  <Sparkles size={14} />
                  {formatCount(shop.activePromoCountNow)} promo(s) active(s)
                  {Number(shop.maxPromoPercentNow || 0) > 0 ? ` · jusqu'à -${Math.round(shop.maxPromoPercentNow)}%` : ''}
                </span>
              )}
              {hasFreeDelivery ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  <MapPin size={13} />
                  Livraison gratuite
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/70 bg-sky-300/20 px-3 py-1 text-xs font-semibold text-sky-100">
                  <Store size={13} />
                  Retrait en boutique
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                <Calendar size={13} />
                Depuis {formatDate(shop.createdAt)}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:hidden">
              <div className="space-y-3">
                <OpeningHoursCard hours={shop.shopHours} certified={isCertifiedShop} />
              </div>
            </section>

            <section
              className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                isCertifiedShop ? 'border-emerald-200/80' : 'border-slate-200'
              }`}
              aria-label="Actions boutique"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Actions rapides</h3>
                {isCertifiedShop && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck size={12} />
                    Vérifiée
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {user && shop.phone ? (
                  <a
                    href={`tel:${shop.phone}`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    aria-label="Appeler la boutique"
                  >
                    <Phone size={16} />
                    Appeler
                  </a>
                ) : (
                  <Link
                    to="/login"
                    state={{ from: `/shop/${slug}` }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    aria-label="Se connecter pour appeler"
                  >
                    <Phone size={16} />
                    Appeler
                  </Link>
                )}

                <button
                  type="button"
                  onClick={goToMessage}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-600 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700 active:scale-[0.99]"
                  aria-label="Envoyer un message à la boutique"
                >
                  <MessageCircle size={16} />
                  Message
                </button>

                <button
                  type="button"
                  onClick={handleDirections}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  aria-label="Ouvrir l'itinéraire"
                >
                  <Navigation size={16} />
                  Itinéraire
                </button>

                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followDisabled}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                    isFollowing
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  } ${followDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-label="Suivre la boutique"
                >
                  <Heart size={16} className={isFollowing ? 'fill-current' : ''} />
                  {followMutation.isPending ? '...' : isOwnShop ? 'Votre boutique' : isFollowing ? 'Boutique suivie' : 'Suivre'}
                </button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Confiance & service</p>
                <div className="mt-1 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> Paiement sécurisé</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle size={13} /> Boutique vérifiée</span>
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> Réponse en journée</span>
                </div>
              </div>
            </section>

            <section ref={productsRef} id="products" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Produits de la boutique">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Produits</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCount(filteredProducts.length)} produit{filteredProducts.length > 1 ? 's' : ''} visible{filteredProducts.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const node = document.getElementById('reviews');
                    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Aller aux avis
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeCategory === 'all'
                      ? 'bg-neutral-600 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tous
                </button>
                {hasActivePromo && (
                  <button
                    type="button"
                    onClick={() => setPromoOnly((prev) => !prev)}
                    disabled={!hasPromoProducts}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                      promoOnly
                        ? 'bg-amber-500 text-white'
                        : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    } ${!hasPromoProducts ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    Promos
                  </button>
                )}
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                      activeCategory === category
                        ? 'bg-neutral-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {!productsInView && <ProductsSkeleton />}
                {productsInView && filteredProducts.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
                    {filteredProducts.map((product) => (
                      <ProductCard key={product._id} p={product} hideMobileDiscountBadge />
                    ))}
                  </div>
                )}
                {productsInView && filteredProducts.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {promoOnly
                        ? 'Aucun produit en promo dans ce filtre.'
                        : activeCategory !== 'all'
                          ? `Aucun produit dans la catégorie ${activeCategory}.`
                          : 'Aucun produit publié pour le moment.'}
                    </p>
                  </div>
                )}
              </div>

              {topSellingProducts.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-800">Produits populaires</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
                    {topSellingProducts.map((product) => (
                      <Link
                        key={`top-${product._id}`}
                        to={buildProductPath(product)}
                        {...externalLinkProps}
                        className="group rounded-xl border border-slate-200 bg-white p-2 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm"
                      >
                        <div className="aspect-[1.2] overflow-hidden rounded-lg bg-slate-100">
                          <img
                            src={product.images?.[0] || product.image || ''}
                            alt={product.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-800">{product.title}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-900">{formatCurrency(product.price)}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Informations boutique">
              <h3 className="text-lg font-semibold text-slate-900">Informations</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adresse</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>{shop.shopAddress || 'Adresse non renseignée'}</span>
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Téléphone</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                    <Phone size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>{phoneLabel}</span>
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Création</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                    <Calendar size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>{formatDate(shop.createdAt)}</span>
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profil</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                    <ShieldCheck size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>{shop.shopVerified ? 'Boutique vérifiée' : 'Vérification en attente'}</span>
                  </dd>
                </div>
              </dl>
            </section>

            <section ref={reviewsRef} id="reviews" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Avis boutique">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Avis clients</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCount(ratingCount)} avis · note {formatRatingLabel(ratingAverage)}/5
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommentsModal(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Voir tout
                  <ExternalLink size={14} />
                </button>
              </div>

              {!reviewsInView && (
                <div className="mt-4 space-y-3">
                  {[1, 2].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {reviewsInView && (
                <>
                  {reviewSuccess && (
                    <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                      {reviewSuccess}
                    </p>
                  )}

                  {showReviewForm && (
                    <form onSubmit={handleSubmitReview} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <label className="text-sm font-semibold text-slate-800">Votre note</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[5, 4, 3, 2, 1].map((value) => (
                          <button
                            key={`rate-${value}`}
                            type="button"
                            onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                            className={`inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold transition ${
                              Number(reviewForm.rating) === value
                                ? 'bg-amber-500 text-white'
                                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Star size={14} className={Number(reviewForm.rating) === value ? 'fill-current' : ''} />
                            {value}
                          </button>
                        ))}
                      </div>

                      <label className="mt-3 block text-sm font-semibold text-slate-800">Commentaire</label>
                      <textarea
                        value={reviewForm.comment}
                        onChange={(event) =>
                          setReviewForm((prev) => ({ ...prev, comment: event.target.value }))
                        }
                        rows={4}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-100"
                        placeholder="Partagez votre expérience..."
                      />

                      {reviewError && (
                        <p className="mt-2 text-xs font-medium text-red-600">{reviewError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={reviewMutation.isPending || !user}
                        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-neutral-600 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {reviewMutation.isPending
                          ? 'Envoi...'
                          : currentUserReview
                            ? 'Mettre à jour mon avis'
                            : 'Publier mon avis'}
                      </button>
                    </form>
                  )}

                  {!showReviewForm && ownCommentExists && (
                    <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-sm font-medium text-emerald-700">Votre avis est publié.</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingReview(true)}
                        className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Modifier
                      </button>
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    {recentReviews.length > 0 ? (
                      recentReviews.map((review) => {
                        const isOwn =
                          Boolean(userScopeId) &&
                          Boolean(review?.user?._id) &&
                          String(review.user._id) === String(userScopeId);
                        return (
                          <article
                            key={review._id}
                            className="rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">
                                  {review.user?.name || review.user?.shopName || 'Utilisateur'}
                                </p>
                                <div className="mt-1 flex items-center gap-1 text-amber-500">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star key={`${review._id}-s-${star}`} size={13} className={star <= Number(review.rating || 0) ? 'fill-current' : ''} />
                                  ))}
                                </div>
                                <p className="mt-2 text-sm text-slate-700">{review.comment || 'Pas de commentaire.'}</p>
                                <p className="mt-2 text-xs text-slate-500">{formatDate(review.createdAt)}</p>
                              </div>
                              {isOwn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingReview(true);
                                    setReviewForm({
                                      rating: Number(review.rating || 0),
                                      comment: review.comment || ''
                                    });
                                  }}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                                >
                                  Modifier
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                        Aucun avis publié pour le moment.
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              <OpeningHoursCard hours={shop.shopHours} certified={isCertifiedShop} />

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Contact boutique">
                <h3 className="text-base font-semibold text-slate-900">Contacter la boutique</h3>
                <p className="mt-1 text-xs text-slate-500">Actions rapides pour convertir plus vite.</p>

                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={goToMessage}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-600 px-4 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    <MessageCircle size={16} />
                    Message boutique
                  </button>

                  {user && shop.phone ? (
                    <a
                      href={`tel:${shop.phone}`}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Phone size={16} />
                      Appeler
                    </a>
                  ) : (
                    <Link
                      to="/login"
                      state={{ from: `/shop/${slug}` }}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <Phone size={16} />
                      Connectez-vous pour appeler
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleDirections}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Navigation size={16} />
                    Itinéraire
                  </button>

                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={followDisabled}
                    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
                      isFollowing
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    } ${followDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <Heart size={16} className={isFollowing ? 'fill-current' : ''} />
                    {followMutation.isPending ? '...' : isOwnShop ? 'Votre boutique' : isFollowing ? 'Boutique suivie' : 'Suivre'}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Confiance</p>
                  <div className="mt-2 space-y-2 text-xs text-slate-700">
                    <p className="flex items-center gap-2"><ShieldCheck size={13} /> Paiement sécurisé</p>
                    <p className="flex items-center gap-2"><CheckCircle size={13} /> {shop.shopVerified ? 'Boutique vérifiée' : 'Vérification en cours'}</p>
                    <p className="flex items-center gap-2"><Sparkles size={13} /> {hasFreeDelivery ? 'Livraison gratuite active' : 'Retrait en boutique possible'}</p>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {isMobile && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-xl safe-area-pb">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={goToMessage}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-600 text-sm font-semibold text-white"
              >
                <MessageCircle size={16} />
                Message
              </button>
              {user && shop.phone ? (
                <a
                  href={`tel:${shop.phone}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700"
                >
                  <Phone size={16} />
                  Appeler
                </a>
              ) : (
                <Link
                  to="/login"
                  state={{ from: `/shop/${slug}` }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700"
                >
                  <Phone size={16} />
                  Appeler
                </Link>
              )}
            </div>

            {isCertifiedShop && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDirections}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                >
                  <Navigation size={14} />
                  Itinéraire
                </button>
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followDisabled}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border text-xs font-semibold transition ${
                    isFollowing
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  } ${followDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <Heart size={14} className={isFollowing ? 'fill-current' : ''} />
                  {followMutation.isPending ? '...' : isOwnShop ? 'Votre boutique' : isFollowing ? 'Suivie' : 'Suivre'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showCommentsModal && (
        <div
          className={`fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm ${isMobile ? 'items-end' : 'items-center justify-center px-4 py-8'}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCommentsModal(false);
            }
          }}
        >
          <div
            className={`w-full overflow-hidden border border-slate-200 bg-white shadow-2xl ${
              isMobile ? 'max-h-[90vh] rounded-t-3xl' : 'max-h-[88vh] max-w-4xl rounded-3xl'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Tous les commentaires</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {formatCount(allCommentsQuery.data?.length || 0)} commentaire{(allCommentsQuery.data?.length || 0) > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCommentsModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-6">
              {allCommentsQuery.isLoading && (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                  ))}
                </div>
              )}

              {allCommentsQuery.isError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {allCommentsQuery.error?.response?.data?.message || 'Impossible de charger les commentaires.'}
                </p>
              )}

              {!allCommentsQuery.isLoading && !allCommentsQuery.isError && (allCommentsQuery.data?.length || 0) === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
                  Aucun commentaire pour cette boutique.
                </p>
              )}

              {!allCommentsQuery.isLoading && !allCommentsQuery.isError && (allCommentsQuery.data?.length || 0) > 0 && (
                <div className="space-y-3">
                  {allCommentsQuery.data.map((review) => (
                    <article key={`full-${review._id}`} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {review.user?.name || review.user?.shopName || 'Utilisateur'}
                          </p>
                          <div className="mt-1 flex items-center gap-1 text-amber-500">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star key={`${review._id}-full-${star}`} size={12} className={star <= Number(review.rating || 0) ? 'fill-current' : ''} />
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(review.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{review.comment || 'Pas de commentaire.'}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
