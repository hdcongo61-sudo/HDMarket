import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
  Pencil,
  Phone,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  TrendingUp,
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
import { useAppSettings } from '../context/AppSettingsContext';
import AppLoader from '../components/AppLoader';

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

const coerceFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'oui', 'verified', 'certified'].includes(normalized);
  }
  return false;
};

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

const getViewportMetrics = () => {
  if (typeof window === 'undefined') {
    return {
      effectiveWidth: 1280,
      innerWidth: 1280,
      clientWidth: 1280,
      visualWidth: 1280
    };
  }
  const innerWidth = Number(window.innerWidth || 0);
  const clientWidth = Number(document?.documentElement?.clientWidth || 0);
  const visualWidth = Number(window.visualViewport?.width || 0);
  const candidates = [innerWidth, clientWidth, visualWidth].filter(
    (value) => Number.isFinite(value) && value > 0
  );
  const effectiveWidth = candidates.length > 0 ? Math.min(...candidates) : innerWidth || 0;
  return {
    effectiveWidth,
    innerWidth,
    clientWidth,
    visualWidth
  };
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

const parseGeoPoint = (location) => {
  const coordinates = location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const longitude = Number(coordinates[0]);
  const latitude = Number(coordinates[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

const buildFullShopAddress = (shop = {}) => {
  const parts = [
    shop?.shopAddress,
    shop?.commune,
    shop?.city
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(parts)).join(', ');
};

const haversineDistanceKm = (from, to) => {
  if (!from || !to) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

const buildGoogleDirectionsUrl = ({ destination, origin = null }) => {
  if (!destination) return '';
  const destinationParam = `${destination.latitude},${destination.longitude}`;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', destinationParam);
  if (origin) {
    url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  }
  return url.toString();
};

const buildAppleDirectionsUrl = ({ destination }) => {
  if (!destination) return '';
  const url = new URL('https://maps.apple.com/');
  url.searchParams.set('daddr', `${destination.latitude},${destination.longitude}`);
  return url.toString();
};

const buildOsmEmbedUrl = (destination) => {
  if (!destination) return '';
  const delta = 0.008;
  const minLon = destination.longitude - delta;
  const minLat = destination.latitude - delta;
  const maxLon = destination.longitude + delta;
  const maxLat = destination.latitude + delta;
  const url = new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set('bbox', `${minLon},${minLat},${maxLon},${maxLat}`);
  url.searchParams.set('layer', 'mapnik');
  url.searchParams.set('marker', `${destination.latitude},${destination.longitude}`);
  return url.toString();
};

const buildGoogleEmbedUrl = (destination) => {
  if (!destination) return '';
  const url = new URL('https://www.google.com/maps');
  url.searchParams.set('q', `${destination.latitude},${destination.longitude}`);
  url.searchParams.set('z', '15');
  url.searchParams.set('output', 'embed');
  return url.toString();
};

const buildOsmDirectionsUrl = ({ destination, origin = null }) => {
  if (!destination) return '';
  const url = new URL('https://www.openstreetmap.org/directions');
  if (origin) {
    url.searchParams.set(
      'route',
      `${origin.latitude},${origin.longitude};${destination.latitude},${destination.longitude}`
    );
    url.searchParams.set('engine', 'fossgis_osrm_car');
  } else {
    url.searchParams.set('route', `${destination.latitude},${destination.longitude}`);
  }
  return url.toString();
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
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="aspect-[0.72] animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
});

const OpeningHoursCard = memo(function OpeningHoursCard({
  hours,
  className = '',
  certified = false,
  compact = false
}) {
  const [expanded, setExpanded] = useState(false);
  const timeZone = getTimeZone();

  const summary = useMemo(() => getOpeningSummary(hours, timeZone), [hours, timeZone]);

  return (
    <section
      className={`${compact ? 'rounded-xl' : 'rounded-2xl'} border bg-white shadow-sm ${
        certified ? 'border-emerald-200/90' : 'border-slate-200'
      } ${className}`}
      aria-label="Horaires d'ouverture"
    >
      <div
        className={`flex items-start justify-between gap-2.5 ${
          compact ? 'px-2.5 py-2 max-[375px]:px-2 max-[375px]:py-1.5' : 'px-4 py-4 sm:px-5'
        }`}
      >
        <div>
          <h3 className={`${compact ? 'text-[13px]' : 'text-base'} font-semibold text-slate-900`}>Horaires</h3>
          <p className={`mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'} text-slate-500`}>Fuseau: {timeZone}</p>
        </div>
        <span
          className={`inline-flex items-center ${compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-2 px-3 py-1 text-xs'} rounded-full font-semibold ${
            summary.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          <span className={`${compact ? 'h-1.5 w-1.5' : 'h-2 w-2'} rounded-full ${summary.isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {summary.isOpen ? 'Ouvert' : 'Fermé'}
        </span>
      </div>

      <div
        className={`border-y ${compact ? 'px-2.5 py-1.5 max-[375px]:px-2 max-[375px]:py-1.5' : 'px-4 py-3 sm:px-5'} ${
          certified ? 'border-emerald-100/80' : 'border-slate-100'
        }`}
      >
        <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-medium text-slate-800`}>{summary.statusText}</p>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`flex w-full items-center justify-between ${
          compact ? 'px-2.5 py-1.5 text-[11px] max-[375px]:px-2' : 'px-4 py-3 text-sm sm:px-5'
        } font-medium text-slate-700 transition-colors hover:bg-slate-50`}
        aria-expanded={expanded}
        aria-controls="shop-hours-weekly"
      >
        <span>Voir la semaine complète</span>
        {expanded ? <ChevronUp size={compact ? 14 : 16} /> : <ChevronDown size={compact ? 14 : 16} />}
      </button>

      <div
        id="shop-hours-weekly"
        className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <ul className={`space-y-1.5 ${compact ? 'px-2.5 pb-2.5 max-[375px]:px-2 max-[375px]:pb-2' : 'px-4 pb-4 sm:px-5'}`}>
            {summary.normalizedHours.map((entry) => {
              const isToday = entry.day === summary.todayKey;
              return (
                <li
                  key={entry.day}
                  className={`flex items-center justify-between rounded-xl ${
                    compact ? 'px-2 py-1 text-[11px] max-[375px]:px-1.5 max-[375px]:py-1 max-[375px]:text-[10px]' : 'px-3 py-2 text-sm'
                  } ${
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUser } = useContext(AuthContext);
  const { showToast } = useToast();
  const { runtime } = useAppSettings();
  const isMobile = useIsMobile();
  const [viewportMetrics, setViewportMetrics] = useState(() => getViewportMetrics());
  const viewportWidth = viewportMetrics.effectiveWidth;
  const externalLinkProps = useDesktopExternalLink();

  const [activeCategory, setActiveCategory] = useState('all');
  const [promoOnly, setPromoOnly] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showDebugDetails, setShowDebugDetails] = useState(true);
  const [viewerLocation, setViewerLocation] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [productGridRuntime, setProductGridRuntime] = useState({
    cssColumns: 0,
    cssTemplate: '',
    containerWidth: 0,
    firstCardWidth: 0,
    gap: '',
    itemCount: 0
  });
  const [layoutContainerWidth, setLayoutContainerWidth] = useState(0);
  const [shopLoaderTimedOut, setShopLoaderTimedOut] = useState(false);

  const [productsRef, productsInView] = useSectionInView({ rootMargin: '320px' });
  const [reviewsRef, reviewsInView] = useSectionInView({ rootMargin: '240px' });
  const productGridDebugRef = useRef(null);
  const pageContainerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportWidth = () => setViewportMetrics(getViewportMetrics());
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    window.addEventListener('orientationchange', updateViewportWidth);
    window.visualViewport?.addEventListener?.('resize', updateViewportWidth);
    window.visualViewport?.addEventListener?.('scroll', updateViewportWidth);
    return () => {
      window.removeEventListener('resize', updateViewportWidth);
      window.removeEventListener('orientationchange', updateViewportWidth);
      window.visualViewport?.removeEventListener?.('resize', updateViewportWidth);
      window.visualViewport?.removeEventListener?.('scroll', updateViewportWidth);
    };
  }, []);

  const isMobileUserAgent = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const userAgent = String(navigator.userAgent || '');
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
  }, []);
  const useMobileLayout = isMobile || (isMobileUserAgent && viewportWidth <= 1024);
  const mapProvider = useMemo(() => {
    const normalized = String(runtime?.map_provider || runtime?.mapProvider || '')
      .trim()
      .toLowerCase();
    return normalized === 'google' ? 'google' : 'osm';
  }, [runtime?.map_provider, runtime?.mapProvider]);
  const shopDebugEnabled = useMemo(() => {
    if (searchParams.get('debug') === '1') return true;
    if (typeof window === 'undefined') return false;
    return String(window.localStorage?.getItem('hdmarket_debug_shop_profile') || '') === '1';
  }, [searchParams]);
  const debugBreakpointState = useMemo(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return {
        max375: false,
        max420: false,
        max640: false,
        max767: false,
        min640: false,
        min1024: false
      };
    }
    return {
      max375: window.matchMedia('(max-width: 375px)').matches,
      max420: window.matchMedia('(max-width: 420px)').matches,
      max640: window.matchMedia('(max-width: 640px)').matches,
      max767: window.matchMedia('(max-width: 767px)').matches,
      min640: window.matchMedia('(min-width: 640px)').matches,
      min1024: window.matchMedia('(min-width: 1024px)').matches
    };
  }, [viewportWidth]);

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
  const shopFullAddress = useMemo(() => buildFullShopAddress(shop), [shop]);
  const products = useMemo(() => (Array.isArray(shopQuery.data?.products) ? shopQuery.data.products : []), [shopQuery.data?.products]);
  const recentReviews = useMemo(
    () => (Array.isArray(shopQuery.data?.recentReviews) ? shopQuery.data.recentReviews : []),
    [shopQuery.data?.recentReviews]
  );
  const shopVerifiedFlag =
    coerceFlag(shop?.shopVerified) ||
    coerceFlag(shop?.verified) ||
    coerceFlag(shop?.isVerified) ||
    coerceFlag(shop?.verificationStatus);
  const shopVerificationSignals = useMemo(
    () => ({
      shopVerified: shop?.shopVerified,
      verified: shop?.verified,
      isVerified: shop?.isVerified,
      verificationStatus: shop?.verificationStatus
    }),
    [shop?.isVerified, shop?.shopVerified, shop?.verificationStatus, shop?.verified]
  );

  useEffect(() => {
    const canonicalSlug = String(shop?.slug || '').trim();
    const routeSlug = String(slug || '').trim();
    const looksLikeObjectId = /^[a-f0-9]{24}$/i.test(routeSlug);
    if (!looksLikeObjectId || !canonicalSlug || canonicalSlug === routeSlug) return;
    navigate(`/shop/${canonicalSlug}`, { replace: true });
  }, [navigate, shop?.slug, slug]);

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

  const categoryCounts = useMemo(() => {
    return products.reduce((acc, product) => {
      const category = String(product?.category || '').trim();
      if (!category) return acc;
      acc[category] = Number(acc[category] || 0) + 1;
      return acc;
    }, {});
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
  const followDisabled = followMutation.isPending || !shop?._id || !shopVerifiedFlag || isOwnShop;
  const mobileFollowLabel =
    followMutation.isPending ? '...' : isOwnShop ? 'Ma boutique' : isFollowing ? 'Suivie' : 'Suivre';

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

  const shopLocation = useMemo(
    () => parseGeoPoint(shop?.location || shop?.shopLocation),
    [shop?.location, shop?.shopLocation]
  );
  const googleDirectionsUrl = useMemo(
    () => buildGoogleDirectionsUrl({ destination: shopLocation, origin: viewerLocation }),
    [shopLocation, viewerLocation]
  );
  const osmDirectionsUrl = useMemo(
    () => buildOsmDirectionsUrl({ destination: shopLocation, origin: viewerLocation }),
    [shopLocation, viewerLocation]
  );
  const appleDirectionsUrl = useMemo(
    () => buildAppleDirectionsUrl({ destination: shopLocation }),
    [shopLocation]
  );
  const osmEmbedUrl = useMemo(() => buildOsmEmbedUrl(shopLocation), [shopLocation]);
  const googleEmbedUrl = useMemo(() => buildGoogleEmbedUrl(shopLocation), [shopLocation]);
  const activeDirectionsUrl = useMemo(
    () => (mapProvider === 'google' ? googleDirectionsUrl : osmDirectionsUrl),
    [googleDirectionsUrl, mapProvider, osmDirectionsUrl]
  );
  const activeEmbedUrl = useMemo(
    () => (mapProvider === 'google' ? googleEmbedUrl : osmEmbedUrl),
    [googleEmbedUrl, mapProvider, osmEmbedUrl]
  );

  const requestViewerLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDistanceError('Géolocalisation indisponible sur cet appareil.');
      return;
    }
    setDistanceLoading(true);
    setDistanceError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setDistanceError('Position actuelle invalide.');
          setDistanceLoading(false);
          return;
        }
        setViewerLocation({ latitude, longitude });
        setDistanceLoading(false);
      },
      (error) => {
        const code = Number(error?.code || 0);
        const message =
          code === 1
            ? 'Permission de localisation refusée.'
            : code === 2
            ? 'Position indisponible.'
            : code === 3
            ? 'Temps de localisation dépassé.'
            : 'Impossible de récupérer votre position.';
        setDistanceError(message);
        setDistanceLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!shopLocation || !viewerLocation) {
      setDistanceKm(null);
      return;
    }
    const computedDistance = haversineDistanceKm(viewerLocation, shopLocation);
    setDistanceKm(Number.isFinite(computedDistance) ? computedDistance : null);
  }, [shopLocation, viewerLocation]);

  const handleDirections = useCallback(() => {
    const fallbackUrl =
      mapProvider === 'google'
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            shop?.shopAddress || shop?.shopName || 'HDMarket'
          )}`
        : `https://www.openstreetmap.org/search?query=${encodeURIComponent(
            shop?.shopAddress || shop?.shopName || 'HDMarket'
          )}`;
    const url =
      activeDirectionsUrl ||
      fallbackUrl;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [activeDirectionsUrl, mapProvider, shop?.shopAddress, shop?.shopName]);

  const handleShareShop = useCallback(async () => {
    const title = shop?.shopName || 'Boutique HDMarket';
    const text = `Découvrez ${title} sur HDMarket`;
    const url =
      typeof window !== 'undefined'
        ? window.location.href
        : `https://hdmarket.app/shop/${slug}`;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('Lien boutique copié.', { variant: 'success' });
        return;
      }
      showToast('Partage indisponible sur cet appareil.', { variant: 'info' });
    } catch {
      // user canceled native share
    }
  }, [shop?.shopName, showToast, slug]);

  const handlePrimaryAction = useCallback(() => {
    if (isOwnShop) {
      navigate('/profile');
      return;
    }
    const node = document.getElementById('products');
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isOwnShop, navigate]);

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
    if (!shopVerifiedFlag) {
      showToast('Seules les boutiques certifiées peuvent être suivies.', { variant: 'info' });
      return;
    }
    followMutation.mutate();
  }, [followMutation, isOwnShop, navigate, shop?._id, shopQuery, shopVerifiedFlag, showToast, slug, user]);

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
  const shopTimeZone = useMemo(() => getTimeZone(), []);
  const openingSummary = useMemo(
    () => getOpeningSummary(shop?.shopHours || [], shopTimeZone),
    [shop?.shopHours, shopTimeZone]
  );
  const hasVerifiedSellerInProducts = useMemo(
    () =>
      products.some((product) =>
        coerceFlag(
          product?.user?.shopVerified ??
            product?.shopVerified ??
            product?.verified ??
            product?.isVerified
        )
      ),
    [products]
  );
  const isCertifiedShop = useMemo(
    () =>
      shopVerifiedFlag ||
      hasVerifiedSellerInProducts,
    [
      hasVerifiedSellerInProducts,
      shopVerifiedFlag
    ]
  );
  const useCompactProductCards = Boolean(useMobileLayout);
  const hasActivePromo = Boolean(shop?.hasActivePromo && Number(shop?.activePromoCountNow || 0) > 0);
  const hasFreeDelivery = Boolean(shop?.freeDeliveryEnabled);
  const completedOrders = useMemo(
    () =>
      products.reduce((total, product) => {
        const count = Number(product?.salesCount || 0);
        return total + (Number.isFinite(count) && count > 0 ? count : 0);
      }, 0),
    [products]
  );
  const yearsActiveLabel = useMemo(() => {
    if (!shop?.createdAt) return 'Nouveau';
    const createdAt = new Date(shop.createdAt);
    if (Number.isNaN(createdAt.getTime())) return 'Nouveau';
    const today = new Date();
    const yearDiff = today.getFullYear() - createdAt.getFullYear();
    return yearDiff <= 0 ? 'Nouveau' : `${yearDiff} an${yearDiff > 1 ? 's' : ''}`;
  }, [shop?.createdAt]);
  const customerSatisfaction = ratingCount > 0 ? `${Math.round((ratingAverage / 5) * 100)}%` : 'Nouveau';
  const ownCommentExists = Boolean(currentUserReview?.comment?.trim());
  const showReviewForm = !ownCommentExists || isEditingReview;
  const sectionCardClass = useMobileLayout
    ? 'shop-panel rounded-xl p-2.5 max-[375px]:p-2'
    : 'shop-panel rounded-2xl p-3.5 sm:p-5';
  const actionButtonClass = useMobileLayout
    ? 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition'
    : 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition sm:min-h-12 sm:gap-2 sm:px-4 sm:text-sm';
  const compactHeaderClass = useMobileLayout
    ? 'shop-glass-head sticky top-20 z-20 mb-3 rounded-xl px-2.5 py-2 max-[375px]:mb-2.5 max-[375px]:px-2 max-[375px]:py-1.5'
    : 'shop-glass-head sticky top-20 z-20 mb-3 rounded-2xl px-3 py-2.5 max-[375px]:mb-2.5 max-[375px]:px-2.5 max-[375px]:py-2 sm:top-24 sm:mb-4 sm:px-4 sm:py-3 md:top-28';
  const sectionStackClass = useMobileLayout ? 'space-y-4' : 'space-y-4 sm:space-y-6';
  const productGridClass = useCompactProductCards
    ? 'mx-auto grid w-full grid-cols-2 gap-2 max-[420px]:gap-1.5 sm:gap-3'
    : 'grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3';
  const productGridStyle = useCompactProductCards ? { maxWidth: '380px' } : undefined;
  const shouldRenderProductsGrid = productsInView || shopDebugEnabled;

  const stats = [
    {
      icon: <Package size={16} className="text-neutral-600" />,
      label: 'Produits',
      value: formatCount(shop?.productCount ?? products.length)
    },
    {
      icon: <TrendingUp size={16} className="text-indigo-600" />,
      label: 'Commandes',
      value: formatCount(completedOrders)
    },
    {
      icon: <Star size={16} className="text-amber-500" />,
      label: 'Avis',
      value: formatCount(ratingCount)
    },
    {
      icon: <Users size={16} className="text-sky-600" />,
      label: 'Abonnés',
      value: formatCount(followersCount)
    }
  ];

  const isOfflineSnapshot = shopQuery.isError && Boolean(shopQuery.data);
  const isNetworkErrorWithoutResponse = Boolean(shopQuery.isError && !shop && !shopQuery.error?.response);

  useEffect(() => {
    if (shop) {
      setShopLoaderTimedOut(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setShopLoaderTimedOut(true);
    }, 8000);
    return () => window.clearTimeout(timeoutId);
  }, [shop, slug]);
  const debugPayload = useMemo(
    () => ({
      routeSlug: slug || '',
      canonicalSlug: shop?.slug || '',
      shopId: shop?._id || '',
      viewportWidth,
      viewportInnerWidth: viewportMetrics.innerWidth,
      viewportClientWidth: viewportMetrics.clientWidth,
      viewportVisualWidth: viewportMetrics.visualWidth,
      isMobileHook: isMobile,
      isMobileUserAgent,
      useMobileLayout,
      useCompactProductCards,
      productGridClass,
      productsCount: products.length,
      isCertifiedShop,
      shopVerifiedFlag,
      hasShopLocation: Boolean(shopLocation),
      shopLocation,
      viewerLocation,
      distanceKm,
      hasVerifiedSellerInProducts,
      mapProvider,
      productGridRuntime,
      layoutContainerWidth,
      breakpoints: debugBreakpointState,
      verificationSignals: shopVerificationSignals
    }),
    [
      debugBreakpointState,
      hasVerifiedSellerInProducts,
      isCertifiedShop,
      isMobile,
      isMobileUserAgent,
      layoutContainerWidth,
      mapProvider,
      distanceKm,
      productGridClass,
      productGridRuntime,
      products.length,
      shop?._id,
      shop?.slug,
      shopLocation,
      shopVerificationSignals,
      shopVerifiedFlag,
      slug,
      useCompactProductCards,
      useMobileLayout,
      viewerLocation,
      viewportMetrics.clientWidth,
      viewportMetrics.innerWidth,
      viewportMetrics.visualWidth,
      viewportWidth
    ]
  );

  useEffect(() => {
    if (!shopDebugEnabled || typeof window === 'undefined') return undefined;
    const container = pageContainerRef.current;
    if (!container) return undefined;

    const updateWidth = () => {
      const nextWidth = Number(container.getBoundingClientRect().width || 0);
      setLayoutContainerWidth((prev) => (Math.round(prev) === Math.round(nextWidth) ? prev : nextWidth));
    };

    updateWidth();
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateWidth();
          })
        : null;
    if (resizeObserver) resizeObserver.observe(container);
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [shopDebugEnabled, useMobileLayout]);

  useEffect(() => {
    if (!shopDebugEnabled || typeof window === 'undefined') return undefined;
    let rafId = null;
    const node = productGridDebugRef.current;

    const measureGrid = () => {
      if (!productGridDebugRef.current) return;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const grid = productGridDebugRef.current;
        if (!grid) return;
        const styles = window.getComputedStyle(grid);
        const template = String(styles.gridTemplateColumns || '').trim();
        const cssColumns = template ? template.split(/\s+/).filter(Boolean).length : 0;
        const firstCardWidth = Number(grid.firstElementChild?.getBoundingClientRect?.().width || 0);
        const nextState = {
          cssColumns,
          cssTemplate: template,
          containerWidth: Number(grid.getBoundingClientRect().width || 0),
          firstCardWidth,
          gap: String(styles.columnGap || styles.gap || ''),
          itemCount: Number(grid.childElementCount || 0)
        };
        setProductGridRuntime((prev) => {
          if (
            prev.cssColumns === nextState.cssColumns &&
            prev.cssTemplate === nextState.cssTemplate &&
            prev.containerWidth === nextState.containerWidth &&
            prev.firstCardWidth === nextState.firstCardWidth &&
            prev.gap === nextState.gap &&
            prev.itemCount === nextState.itemCount
          ) {
            return prev;
          }
          return nextState;
        });
      });
    };

    measureGrid();
    const resizeObserver =
      node && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measureGrid();
          })
        : null;
    if (node && resizeObserver) resizeObserver.observe(node);
    window.addEventListener('resize', measureGrid);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureGrid);
      resizeObserver?.disconnect();
    };
  }, [
    activeCategory,
    filteredProducts.length,
    productGridClass,
    promoOnly,
    shopDebugEnabled,
    useCompactProductCards
  ]);

  useEffect(() => {
    if (!shopDebugEnabled) return;
    // eslint-disable-next-line no-console
    console.info('[ShopProfile][debug]', debugPayload);
  }, [debugPayload, shopDebugEnabled]);

  const handleCopyDebugPayload = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      showToast('Copie indisponible sur cet appareil.', { variant: 'info' });
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugPayload, null, 2));
      showToast('Debug shop copié dans le presse-papiers.', { variant: 'success' });
    } catch {
      showToast('Impossible de copier le debug.', { variant: 'error' });
    }
  }, [debugPayload, showToast]);

  if (!shop) {
    return (
      <>
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
        <AppLoader
          visible
          label="HDMarket"
          timedOut={shopLoaderTimedOut || isNetworkErrorWithoutResponse || Boolean(shopQuery.isError)}
          onRetry={() => {
            setShopLoaderTimedOut(false);
            shopQuery.refetch();
          }}
        />
      </>
    );
  }

  const phoneLabel = user && shop.phone ? shop.phone : 'Connectez-vous pour afficher le numéro';

  return (
    <main
      className={`shop-shell text-slate-900 dark:text-slate-100 ${useMobileLayout ? 'pb-32' : 'pb-12'}`}
    >
      <div
        ref={pageContainerRef}
        className={
          useMobileLayout
            ? 'mx-auto w-full px-2.5 py-3 max-[375px]:px-2'
            : 'mx-auto w-full max-w-7xl px-2.5 py-4 max-[375px]:px-2 sm:px-5 sm:py-6 lg:px-8'
        }
        style={useMobileLayout ? { maxWidth: '430px' } : undefined}
      >
        <header className={compactHeaderClass}>
          <div className="flex items-center justify-between gap-2.5 max-[375px]:gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.2em]">
                {isCertifiedShop ? 'Boutique certifiée' : 'Boutique'}
              </p>
              <h1 className="truncate text-[15px] font-semibold text-slate-900 dark:text-white max-[375px]:text-sm sm:text-lg">{shop.shopName}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {useMobileLayout && isCertifiedShop && (
                <span className="inline-flex min-h-8 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700 sm:min-h-9 sm:text-[11px]">
                  Certifiée
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="min-h-10 rounded-xl border border-slate-200 px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:min-h-11 sm:px-3 sm:text-sm"
              >
                Retour
              </button>
              {!useMobileLayout && (
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

        <section className="shop-panel relative overflow-hidden rounded-[1.4rem] text-white sm:rounded-3xl">
          <div className="h-32 w-full max-[375px]:h-28 sm:h-56 lg:h-64">
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
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-900/35 to-transparent" />
          </div>

          <div className="relative z-10 px-3.5 pb-4 pt-0 max-[375px]:px-3 max-[375px]:pb-3.5 sm:px-6 sm:pb-6">
            <div className="-mt-10 flex flex-col items-center gap-2.5 text-center max-[375px]:-mt-9 max-[375px]:gap-2 sm:-mt-14 sm:flex-row sm:items-start sm:gap-4 sm:text-left">
              <div className="h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-2xl border-4 border-white/85 bg-white shadow-md max-[375px]:h-16 max-[375px]:w-16 sm:h-24 sm:w-24">
                {shop.shopLogo ? (
                  <img src={shop.shopLogo} alt={`Logo ${shop.shopName}`} className="h-full w-full object-cover" loading="eager" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xl font-bold text-slate-600">
                    {String(shop.shopName || 'B').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5 sm:pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h2 className="truncate text-lg font-bold max-[375px]:text-base sm:text-2xl">{shop.shopName}</h2>
                  <VerifiedBadge verified={isCertifiedShop} />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      openingSummary.isOpen
                        ? 'bg-emerald-300/25 text-emerald-100'
                        : 'bg-rose-300/25 text-rose-100'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${openingSummary.isOpen ? 'bg-emerald-300' : 'bg-rose-300'}`} />
                    {openingSummary.statusText}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/90">
                    <Star size={11} className={ratingAverage > 0 ? 'fill-current' : ''} />
                    {formatRatingLabel(ratingAverage)} · {formatCount(ratingCount)} avis
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/85 sm:text-sm">Gérée par {shop.ownerName}</p>
                <p className="mt-1.5 line-clamp-2 text-xs text-white/80 sm:mt-2 sm:text-sm sm:line-clamp-3">
                  {shop.shopDescription || 'Cette boutique n\'a pas encore ajouté de description publique.'}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 max-[375px]:gap-1 sm:mt-4 sm:grid-cols-4 sm:gap-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/18 bg-white/12 px-2 py-1.5 backdrop-blur sm:px-3 sm:py-2">
                  <div className="flex items-center gap-1 text-[10px] text-white/80 sm:text-[11px]">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <p className="mt-1 text-base font-semibold leading-none sm:text-lg">{item.value}</p>
                </div>
              ))}
            </div>

            {isCertifiedShop && (
              <div className="mt-2.5 rounded-xl border border-emerald-300/70 bg-emerald-300/20 px-3 py-2 text-[11px] font-semibold text-emerald-50 sm:mt-3 sm:text-xs">
                <p className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <ShieldCheck size={14} />
                  Boutique certifiée HDMarket
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2">
              {hasActivePromo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-300/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 sm:px-3 sm:text-xs">
                  <Sparkles size={14} />
                  {formatCount(shop.activePromoCountNow)} promo(s) active(s)
                  {Number(shop.maxPromoPercentNow || 0) > 0 ? ` · jusqu'à -${Math.round(shop.maxPromoPercentNow)}%` : ''}
                </span>
              )}
              {hasFreeDelivery ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-300/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 sm:px-3 sm:text-xs">
                  <MapPin size={13} />
                  Livraison gratuite
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/70 bg-sky-300/20 px-2.5 py-1 text-[11px] font-semibold text-sky-100 sm:px-3 sm:text-xs">
                  <Store size={13} />
                  Retrait en boutique
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 sm:px-3 sm:text-xs">
                <Calendar size={13} />
                Depuis {formatDate(shop.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 sm:px-3 sm:text-xs">
                <Clock size={13} />
                Ancienneté: {yearsActiveLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 sm:px-3 sm:text-xs">
                <TrendingUp size={13} />
                Satisfaction: {customerSatisfaction}
              </span>
            </div>
          </div>
        </section>

        <div className={useMobileLayout ? 'mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]' : 'mt-5 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px]'}>
          <div className={sectionStackClass}>
            <section className="lg:hidden" aria-label="Horaires boutique">
              <OpeningHoursCard
                hours={shop.shopHours}
                certified={isCertifiedShop}
                compact={useMobileLayout}
                className="shadow-sm"
              />
            </section>

            <section className={sectionCardClass} aria-label="Actions boutique">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className={useMobileLayout ? 'text-[15px] font-semibold text-slate-900' : 'text-sm font-semibold text-slate-900 sm:text-base'}>Actions rapides</h3>
                  <p className={useMobileLayout ? 'mt-0.5 text-[10px] text-slate-500' : 'mt-0.5 text-[11px] text-slate-500 sm:text-xs'}>Appeler, message, itinéraire et suivi.</p>
                </div>
                {isCertifiedShop && (
                  <span className={useMobileLayout ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700' : 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700'}>
                    <ShieldCheck size={12} />
                    Vérifiée
                  </span>
                )}
              </div>

              <div className={useMobileLayout ? 'mb-2.5 grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1' : 'mb-3 grid grid-cols-2 gap-2 max-[420px]:grid-cols-1'}>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className={`${actionButtonClass} bg-neutral-900 text-white hover:bg-black`}
                >
                  {isOwnShop ? <Pencil size={15} /> : <Store size={15} />}
                  {isOwnShop ? 'Modifier profil' : 'Voir produits'}
                </button>
                <button
                  type="button"
                  onClick={handleShareShop}
                  className={`${actionButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  <Share2 size={15} />
                  Partager
                </button>
                {isOwnShop && (
                  <Link
                    to="/seller/boosts"
                    className={`${useMobileLayout ? 'col-span-2 max-[360px]:col-span-1' : 'col-span-2 max-[420px]:col-span-1'} ${actionButtonClass} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                  >
                    <Rocket size={15} />
                    Booster ma boutique
                  </Link>
                )}
              </div>

              <div className={useMobileLayout ? 'grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1' : 'grid grid-cols-2 gap-2 max-[420px]:grid-cols-1 sm:grid-cols-2'}>
                {user && shop.phone ? (
                  <a
                    href={`tel:${shop.phone}`}
                    className={`${actionButtonClass} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                    aria-label="Appeler la boutique"
                  >
                    <Phone size={15} />
                    <span className="max-[375px]:hidden">Appeler</span>
                    <span className="hidden max-[375px]:inline">Appel</span>
                  </a>
                ) : (
                  <Link
                    to="/login"
                    state={{ from: `/shop/${slug}` }}
                    className={`${actionButtonClass} border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}
                    aria-label="Se connecter pour appeler"
                  >
                    <Phone size={15} />
                    <span className="max-[375px]:hidden">Appeler</span>
                    <span className="hidden max-[375px]:inline">Appel</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={goToMessage}
                  className={`${actionButtonClass} bg-neutral-600 text-white hover:bg-neutral-700 active:scale-[0.99]`}
                  aria-label="Envoyer un message à la boutique"
                >
                  <MessageCircle size={15} />
                  <span className="max-[375px]:hidden">Message</span>
                  <span className="hidden max-[375px]:inline">Msg</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirections}
                  className={`${actionButtonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                  aria-label="Ouvrir l'itinéraire"
                >
                  <Navigation size={15} />
                  <span className="max-[375px]:hidden">Itinéraire</span>
                  <span className="hidden max-[375px]:inline">GPS</span>
                </button>

                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followDisabled}
                  className={`${actionButtonClass} border ${
                    isFollowing
                      ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  } ${followDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-label="Suivre la boutique"
                >
                  <Heart size={15} className={isFollowing ? 'fill-current' : ''} />
                  {mobileFollowLabel}
                </button>
              </div>

              <div className={useMobileLayout ? 'shop-separator mt-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-2.5 py-2 text-[11px] text-slate-600' : 'shop-separator mt-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs text-slate-600'}>
                <p className="font-semibold text-slate-700">Confiance & service</p>
                <div className={useMobileLayout ? 'mt-1 grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1' : 'mt-1 flex flex-wrap gap-2.5'}>
                  <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> Paiement sécurisé</span>
                  <span className="inline-flex items-center gap-1"><CheckCircle size={13} /> {isCertifiedShop ? 'Boutique vérifiée' : 'Vérification en cours'}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> Réponse en journée</span>
                  <span className="inline-flex items-center gap-1"><TrendingUp size={13} /> Satisfaction {customerSatisfaction}</span>
                  {Number.isFinite(distanceKm) && (
                    <span className="inline-flex items-center gap-1">
                      <Navigation size={13} />
                      À {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section
              ref={productsRef}
              id="products"
              className={sectionCardClass}
              aria-label="Produits de la boutique"
            >
              <div className={useMobileLayout ? 'flex flex-wrap items-start justify-between gap-2' : 'flex flex-wrap items-start justify-between gap-2.5 sm:gap-3'}>
                <div>
                  <h3 className={useMobileLayout ? 'text-[15px] font-semibold text-slate-900' : 'text-lg font-semibold text-slate-900 sm:text-xl'}>Produits</h3>
                  <p className={useMobileLayout ? 'mt-0.5 text-[11px] text-slate-500' : 'mt-1 text-xs text-slate-500 sm:text-sm'}>
                    {formatCount(filteredProducts.length)} produit{filteredProducts.length > 1 ? 's' : ''} visible{filteredProducts.length > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const node = document.getElementById('reviews');
                    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={useMobileLayout ? 'inline-flex min-h-9 w-auto items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50' : 'inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-11 sm:w-auto sm:text-sm'}
                >
                  Aller aux avis
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className={useMobileLayout ? 'mt-3 rounded-xl border border-slate-200/80 bg-white/80 p-2 shadow-sm' : 'mt-4 rounded-2xl border border-slate-200/80 bg-white/80 p-2.5 shadow-sm sm:border-transparent sm:bg-transparent sm:p-0 sm:shadow-none'}>
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <p className={useMobileLayout ? 'text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500' : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px]'}>
                    Filtrer par catégorie
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('all');
                      setPromoOnly(false);
                    }}
                    className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
                  >
                    Réinitialiser
                  </button>
                </div>

                <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex w-max snap-x snap-mandatory items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCategory('all')}
                      aria-pressed={activeCategory === 'all'}
                      className={`inline-flex ${useMobileLayout ? 'min-h-9 rounded-lg px-2.5 text-[11px]' : 'min-h-10 rounded-xl px-3 text-xs sm:min-h-9 sm:rounded-full'} snap-start items-center gap-1.5 whitespace-nowrap font-semibold transition ${
                        activeCategory === 'all'
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Tous
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          activeCategory === 'all'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {formatCount(products.length)}
                      </span>
                    </button>

                    {hasActivePromo && (
                      <button
                        type="button"
                        onClick={() => setPromoOnly((prev) => !prev)}
                        disabled={!hasPromoProducts}
                        aria-pressed={promoOnly}
                        className={`inline-flex ${useMobileLayout ? 'min-h-9 rounded-lg px-2.5 text-[11px]' : 'min-h-10 rounded-xl px-3 text-xs sm:min-h-9 sm:rounded-full'} snap-start items-center gap-1.5 whitespace-nowrap font-semibold transition ${
                          promoOnly
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'border border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100'
                        } ${!hasPromoProducts ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <Sparkles size={12} />
                        Promos
                      </button>
                    )}

                    {categories.map((category) => {
                      const isActive = activeCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveCategory(category)}
                          aria-pressed={isActive}
                          className={`inline-flex ${useMobileLayout ? 'min-h-9 rounded-lg px-2.5 text-[11px]' : 'min-h-10 rounded-xl px-3 text-xs sm:min-h-9 sm:rounded-full'} snap-start items-center gap-1.5 whitespace-nowrap font-semibold transition ${
                            isActive
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span>{category}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {formatCount(categoryCounts[category] || 0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {!shouldRenderProductsGrid && <ProductsSkeleton />}
                {shouldRenderProductsGrid && filteredProducts.length > 0 && (
                  <div ref={productGridDebugRef} className={productGridClass} style={productGridStyle}>
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={`${product._id}-${useCompactProductCards ? 'compact' : 'regular'}`}
                        p={product}
                        hideMobileDiscountBadge
                        compactMobile={useCompactProductCards}
                        shopProfileCompact={useCompactProductCards}
                      />
                    ))}
                  </div>
                )}
                {shouldRenderProductsGrid && filteredProducts.length === 0 && (
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
                <div className="shop-separator mt-6 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-800">Produits populaires</p>
                  <div className={productGridClass} style={productGridStyle}>
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

            <section className="shop-panel rounded-2xl p-3.5 sm:p-5" aria-label="Informations boutique">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Informations</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adresse</dt>
                  <dd className="mt-1 flex items-start gap-2 text-sm text-slate-700">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-slate-500" />
                    <span>{shopFullAddress || 'Adresse non renseignée'}</span>
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
                    <span>{isCertifiedShop ? 'Boutique vérifiée' : 'Vérification en attente'}</span>
                  </dd>
                </div>
              </dl>

              {shopLocation ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Localisation boutique</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        shop?.locationVerified
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <MapPin size={12} />
                      {shop?.locationVerified ? 'Position vérifiée' : 'Position déclarée'}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Adresse (texte)
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {shopFullAddress || 'Adresse non renseignée'}
                    </p>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {activeEmbedUrl ? (
                      <iframe
                        title={`Carte ${shop.shopName}`}
                        src={activeEmbedUrl}
                        loading="lazy"
                        className="h-52 w-full border-0"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center text-sm text-slate-500">
                        Carte indisponible
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={activeDirectionsUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-neutral-900 px-3 text-xs font-semibold text-white hover:bg-neutral-800"
                    >
                      <Navigation size={14} />
                      {mapProvider === 'google' ? 'Ouvrir Google Maps' : 'Ouvrir OpenStreetMap'}
                      <ExternalLink size={13} />
                    </a>
                    <a
                      href={appleDirectionsUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <MapPin size={14} />
                      Apple Plans
                      <ExternalLink size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={requestViewerLocation}
                      disabled={distanceLoading}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                    >
                      <Navigation size={14} />
                      {distanceLoading ? 'Calcul…' : 'Calculer la distance'}
                    </button>
                  </div>

                  {shop?.locationNeedsReview ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Position en revue de sécurité. Itinéraire disponible, vérification en cours.
                    </p>
                  ) : null}
                  {Number.isFinite(Number(shop?.locationTrustScore)) ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Score confiance position: {Math.round(Number(shop.locationTrustScore))}
                    </p>
                  ) : null}

                  {Number.isFinite(distanceKm) && (
                    <p className="mt-2 text-xs text-slate-600">
                      Distance estimée:{' '}
                      <span className="font-semibold text-slate-800">
                        {distanceKm < 1
                          ? `${Math.round(distanceKm * 1000)} m`
                          : `${distanceKm.toFixed(1)} km`}
                      </span>
                    </p>
                  )}
                  {shop?.locationUpdatedAt && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Position mise à jour le {new Date(shop.locationUpdatedAt).toLocaleDateString('fr-FR')}
                    </p>
                  )}
                  {distanceError && <p className="mt-2 text-xs text-rose-600">{distanceError}</p>}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  La boutique n’a pas encore partagé sa position GPS précise.
                </p>
              )}
            </section>

            <section className="shop-panel rounded-2xl p-3.5 sm:p-5" aria-label="Politiques boutique">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Politiques boutique</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Livraison</p>
                  <p className="mt-1">{hasFreeDelivery ? 'Livraison gratuite active selon zone.' : 'Retrait en boutique ou livraison standard.'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Paiement</p>
                  <p className="mt-1">Paiement sécurisé sur HDMarket.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Service client</p>
                  <p className="mt-1">Réponse en journée avec suivi des messages.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-semibold text-slate-800">Confiance</p>
                  <p className="mt-1">
                    {isCertifiedShop ? 'Boutique certifiée HDMarket.' : 'Boutique en cours de vérification.'}
                  </p>
                </div>
              </div>
            </section>

            <section ref={reviewsRef} id="reviews" className="shop-panel rounded-2xl p-3.5 sm:p-5" aria-label="Avis boutique">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Avis clients</h3>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    {formatCount(ratingCount)} avis · note {formatRatingLabel(ratingAverage)}/5
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCommentsModal(true)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:min-h-11 sm:text-sm"
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

              <section className="shop-panel rounded-2xl p-4" aria-label="Contact boutique">
                <h3 className="text-base font-semibold text-slate-900">Contacter la boutique</h3>
                <p className="mt-1 text-xs text-slate-500">Actions rapides pour convertir plus vite.</p>

                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black"
                  >
                    {isOwnShop ? <Pencil size={16} /> : <Store size={16} />}
                    {isOwnShop ? 'Modifier profil boutique' : 'Voir produits boutique'}
                  </button>

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
                    onClick={handleShareShop}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Share2 size={16} />
                    Partager
                  </button>

                  {isOwnShop && (
                    <Link
                      to="/seller/boosts"
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      <Rocket size={16} />
                      Booster ma boutique
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

                <div className="shop-separator mt-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Confiance</p>
                  <div className="mt-2 space-y-2 text-xs text-slate-700">
                    <p className="flex items-center gap-2"><ShieldCheck size={13} /> Paiement sécurisé</p>
                    <p className="flex items-center gap-2"><CheckCircle size={13} /> {isCertifiedShop ? 'Boutique vérifiée' : 'Vérification en cours'}</p>
                    <p className="flex items-center gap-2"><Sparkles size={13} /> {hasFreeDelivery ? 'Livraison gratuite active' : 'Retrait en boutique possible'}</p>
                    <p className="flex items-center gap-2"><TrendingUp size={13} /> Satisfaction {customerSatisfaction}</p>
                    <p className="flex items-center gap-2"><Clock size={13} /> Ancienneté {yearsActiveLabel}</p>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {useMobileLayout && (
        <div className="shop-glass-head fixed inset-x-0 bottom-0 z-40 border-t px-2.5 py-2.5 safe-area-pb max-[375px]:px-2 max-[375px]:py-2">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-neutral-900 text-xs font-semibold text-white sm:min-h-12 sm:gap-2 sm:text-sm"
              >
                {isOwnShop ? <Pencil size={15} /> : <Store size={15} />}
                <span>{isOwnShop ? 'Modifier' : 'Produits'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareShop}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 sm:min-h-12 sm:gap-2 sm:text-sm"
              >
                <Share2 size={15} />
                Partager
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={goToMessage}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-neutral-600 text-xs font-semibold text-white sm:min-h-12 sm:gap-2 sm:text-sm"
              >
                <MessageCircle size={15} />
                <span className="max-[375px]:hidden">Message</span>
                <span className="hidden max-[375px]:inline">Msg</span>
              </button>
              {user && shop.phone ? (
                <a
                  href={`tel:${shop.phone}`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 sm:min-h-12 sm:gap-2 sm:text-sm"
                >
                  <Phone size={15} />
                  <span className="max-[375px]:hidden">Appeler</span>
                  <span className="hidden max-[375px]:inline">Appel</span>
                </a>
              ) : (
                <Link
                  to="/login"
                  state={{ from: `/shop/${slug}` }}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 sm:min-h-12 sm:gap-2 sm:text-sm"
                >
                  <Phone size={15} />
                  <span className="max-[375px]:hidden">Appeler</span>
                  <span className="hidden max-[375px]:inline">Appel</span>
                </Link>
              )}
            </div>

          </div>
        </div>
      )}

      {showCommentsModal && (
        <div
          className={`fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm ${useMobileLayout ? 'items-end' : 'items-center justify-center px-4 py-8'}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowCommentsModal(false);
            }
          }}
        >
          <div
            className={`w-full overflow-hidden border border-slate-200 bg-white shadow-2xl ${
              useMobileLayout ? 'max-h-[90vh] rounded-t-3xl' : 'max-h-[88vh] max-w-4xl rounded-3xl'
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

      {shopDebugEnabled && (
        <div className="fixed bottom-3 left-2 right-2 z-[70] rounded-xl border border-amber-300 bg-amber-50/95 p-2 text-[11px] text-amber-900 shadow-lg backdrop-blur sm:bottom-4 sm:left-auto sm:right-4 sm:w-[360px]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowDebugDetails((prev) => !prev)}
              className="inline-flex min-h-8 items-center rounded-lg border border-amber-300 bg-white px-2.5 font-semibold"
            >
              Debug shop layout {showDebugDetails ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={handleCopyDebugPayload}
              className="inline-flex min-h-8 items-center rounded-lg border border-amber-300 bg-white px-2.5 font-semibold"
            >
              Copier JSON
            </button>
          </div>
          {showDebugDetails && (
            <div className="space-y-1 font-mono leading-tight">
              <p>slug route: {debugPayload.routeSlug || '-'}</p>
              <p>slug canon: {debugPayload.canonicalSlug || '-'}</p>
              <p>shopId: {debugPayload.shopId || '-'}</p>
              <p>width: {debugPayload.viewportWidth}px</p>
              <p>
                width raw (inner/client/visual): {Math.round(debugPayload.viewportInnerWidth)} / {Math.round(debugPayload.viewportClientWidth)} / {Math.round(debugPayload.viewportVisualWidth)}
              </p>
              <p>mobileHook: {String(debugPayload.isMobileHook)}</p>
              <p>uaMobile: {String(debugPayload.isMobileUserAgent)}</p>
              <p>mobileLayout: {String(debugPayload.useMobileLayout)}</p>
              <p>compactCards: {String(debugPayload.useCompactProductCards)}</p>
              <p>grid: {debugPayload.productGridClass}</p>
              <p>products: {debugPayload.productsCount}</p>
              <p>isCertifiedShop: {String(debugPayload.isCertifiedShop)}</p>
              <p>shopVerifiedFlag: {String(debugPayload.shopVerifiedFlag)}</p>
              <p>hasVerifiedInProducts: {String(debugPayload.hasVerifiedSellerInProducts)}</p>
              <p>
                bp 375/420/640/767: {String(debugPayload.breakpoints.max375)} / {String(debugPayload.breakpoints.max420)} / {String(debugPayload.breakpoints.max640)} / {String(debugPayload.breakpoints.max767)}
              </p>
              <p>
                grid runtime cols/items: {debugPayload.productGridRuntime.cssColumns} / {debugPayload.productGridRuntime.itemCount}
              </p>
              <p>layout container: {Math.round(debugPayload.layoutContainerWidth)}px</p>
              <p>
                grid runtime size: {Math.round(debugPayload.productGridRuntime.containerWidth)}px / card {Math.round(debugPayload.productGridRuntime.firstCardWidth)}px
              </p>
              <p>grid runtime gap: {debugPayload.productGridRuntime.gap || '-'}</p>
              <p>grid runtime template: {debugPayload.productGridRuntime.cssTemplate || '-'}</p>
              <p>
                verify raw: {String(debugPayload.verificationSignals.shopVerified)} | {String(debugPayload.verificationSignals.verified)} | {String(debugPayload.verificationSignals.isVerified)} | {String(debugPayload.verificationSignals.verificationStatus)}
              </p>
              <p className="pt-1 text-[10px]">
                Tip: `?debug=1` or `localStorage.hdmarket_debug_shop_profile = '1'`
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
