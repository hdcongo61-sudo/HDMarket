import React, { useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  ShoppingCart,
  MessageCircle,
  Shield,
  Truck,
  ArrowLeft,
  Share2,
  Eye,
  Clock,
  Check,
  AlertCircle,
  MapPin,
  Store,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Phone,
  Reply,
  CornerDownLeft,
  X,
  ChevronDown,
  ChevronUp,
  Flag,
  Trash2,
  Search,
  Video,
  Zap,
  SlidersHorizontal,
  ExternalLink
} from "lucide-react";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import api, { getApiErrorMessage, isApiPossiblyCommittedError } from "../services/api";
import { buildWhatsappLink } from "../utils/whatsapp";
import { parseSocialVideo } from "../utils/socialVideo";
import { buildProductShareUrl, buildProductPath, buildShopPath } from "../utils/links";
import { recordProductView } from "../utils/recentViews";
import { setPendingAction } from "../utils/pendingAction";
import { formatPriceWithStoredSettings } from "../utils/priceFormatter";
import {
  buildSelectedAttributesSelectionKey,
  formatPhysicalSpecs,
  getDefaultSelectedAttributes,
  isProductAttributeSelectionRequired,
  normalizeProductAttributes,
  normalizeSelectedAttributes,
  resolveProductImagePrice,
  resolveSelectedAttributesImage,
  resolveSelectedAttributesPrice,
  validateSelectedAttributes
} from "../utils/productAttributes";
import { resolveUserProfileImage } from "../utils/userAvatar";
import { isColorAttribute, resolveSwatchColor } from "../utils/colorSwatch";
import VerifiedBadge from "../components/VerifiedBadge";
import OrderChat from "../components/OrderChat";
import BundleDeal from "../components/BundleDeal";
import ProductQuestionsSection from "../components/ProductQuestionsSection";
import GroupBuySection from "../components/GroupBuySection";
import { useAppSettings } from "../context/AppSettingsContext";
import ReportModal from "../components/ReportModal";
import BaseModal, { ModalBody, ModalHeader } from "../components/modals/BaseModal";
import { useToast } from "../context/ToastContext";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import useIsMobile from "../hooks/useIsMobile";
import useNetworkProfile from "../hooks/useNetworkProfile";
import { loadOfflineSnapshot, saveOfflineSnapshot } from "../utils/offlineSnapshots";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Zoom } from "swiper/modules";
import { motion, AnimatePresence } from "framer-motion";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/zoom";
import { appAlert, appConfirm } from "../utils/appDialog";
import SelectedAttributesList from "../components/orders/SelectedAttributesList";

const PRODUCT_DETAILS_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 15;

export default function ProductDetails() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const authContextValue = useContext(AuthContext);
  const user = authContextValue?.user;
  const updateUser = authContextValue?.updateUser;
  const { addItem, cart } = useContext(CartContext);
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  const { showToast } = useToast();
  const authLoading = Boolean(authContextValue?.loading);
  const { getRuntimeValue } = useAppSettings();
  const groupBuyingEnabled = ['true', '1', 'yes', 'on'].includes(
    String(getRuntimeValue('enable_group_buying', false)).trim().toLowerCase()
  );

  const [product, setProduct] = useState(null);
  const [offlineSnapshotActive, setOfflineSnapshotActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartFeedback, setCartFeedback] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState([]);
  const [selectedOptionsByAttribute, setSelectedOptionsByAttribute] = useState({});
  const [selectionError, setSelectionError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [whatsappClicks, setWhatsappClicks] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [shopGalleryProducts, setShopGalleryProducts] = useState([]);
  const [bundleData, setBundleData] = useState(null);
  const [isFollowingShop, setIsFollowingShop] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [highlightedCommentId, setHighlightedCommentId] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [isCertifying, setIsCertifying] = useState(false);
  const [certifyMessage, setCertifyMessage] = useState("");
  const [certifyError, setCertifyError] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);
  const trackedProductViewsRef = useRef(new Set());
  const pendingFocusCommentIdRef = useRef('');
  const commentHighlightTimerRef = useRef(null);
  const mobileGallerySwiperRef = useRef(null);
  const modalSwiperRef = useRef(null);
  const isMobileView = useIsMobile();
  const externalLinkProps = useDesktopExternalLink();
  const isAdminUser = user?.role === 'admin' || user?.role === 'founder';
  const [sellerExpanded, setSellerExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    description: false,
    specifications: false,
    shipping: false,
  });
  const [inquiryOrder, setInquiryOrder] = useState(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [reportModal, setReportModal] = useState({ isOpen: false, type: null, commentId: null, photoUrl: null });
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  const {
    rapid3GActive,
    shouldUseOfflineSnapshot,
    offlineBannerText,
    rapid3GBannerText
  } = useNetworkProfile();
  const previewBackPath = useMemo(() => {
    const raw = location?.state?.previewBackPath;
    if (typeof raw !== "string") return "";
    const trimmed = raw.trim();
    return trimmed.startsWith("/product-preview/") ? trimmed : "";
  }, [location?.state?.previewBackPath]);
  const productSnapshotKey = useMemo(() => `product-details:${slug || 'unknown'}`, [slug]);

  const handleSessionExpired = useCallback(() => {
    if (typeof authContextValue?.logout === 'function') {
      authContextValue.logout();
    }
    navigate('/', { replace: true });
  }, [authContextValue, navigate]);

  const handleBackNavigation = useCallback(() => {
    // Prefer real history: when the user came from the preview, it IS the
    // previous entry, and popping keeps the rest of the stack (Home…) intact.
    // Replacing with previewBackPath here used to duplicate the preview entry,
    // turning the preview's own back button into a no-op.
    const routerIndex = window.history.state?.idx;
    const hasSpaHistory = typeof routerIndex === 'number' ? routerIndex > 0 : window.history.length > 1;
    if (hasSpaHistory) {
      navigate(-1);
      return;
    }
    // Deep link / new tab: no SPA history — fall back to the preview, then products.
    if (previewBackPath) {
      navigate(previewBackPath, { replace: true });
      return;
    }
    navigate('/products');
  }, [navigate, previewBackPath]);

  // 🔒 PROTECTION CONTRE LES ACCÈS À NULL
  const isInFavorites = product ? isFavorite(product._id) : false;
  const whatsappLink = product ? buildWhatsappLink(product, product?.user?.phone) : "";

  // 📞 NUMÉRO DE TÉLÉPHONE
  const phoneNumber = product?.user?.phone;
  const showPhone = phoneNumber && user;

  // 🏪 TYPE DE VENDEUR
  const isProfessional = product?.user?.accountType === 'shop';
  const shopName = product?.user?.shopName;
  const shopLogo = product?.user?.shopLogo;
  const shopAddress = product?.user?.shopAddress;
  const shopIdentifier =
    product?.user && (product.user.slug || product.user._id)
      ? { slug: product.user.slug, _id: product.user._id }
      : null;
  const canOpenShopProfile = Boolean(isProfessional && shopIdentifier);
  const sellerCity = product?.user?.city || product?.city || '';
  const sellerCountry = product?.user?.country || product?.country || 'République du Congo';
  // product.user may be populated { _id, name, ... } or just the id (string/ObjectId)
  const productSellerId = product?.user != null
    ? (product.user._id ?? product.user.id ?? product.user)
    : null;
  const isOwnProduct =
    productSellerId &&
    user &&
    String(productSellerId) === String(user._id || user.id);

  async function verifyShopFollowMutation(expectedFollowing) {
    const targetShopId = String(product?.user?._id || '').trim();
    if (!targetShopId || !user) return null;
    try {
      const shopLookupId = product?.user?.slug || product?.user?._id;
      const [{ data: followedShops }, shopResponse] = await Promise.all([
        api.get('/users/shops/following', {
          skipCache: true,
          silentGlobalError: true,
          headers: { 'x-skip-cache': '1' }
        }),
        shopLookupId
          ? api.get(`/shops/${shopLookupId}`, {
              params: { limit: 1 },
              skipCache: true,
              silentGlobalError: true,
              headers: { 'x-skip-cache': '1' }
            })
          : Promise.resolve(null)
      ]);
      const normalizedList = Array.isArray(followedShops) ? followedShops : [];
      const followedIds = normalizedList
        .map((entry) => String(entry?._id || '').trim())
        .filter(Boolean);
      const confirmedFollowing = followedIds.includes(targetShopId);
      if (confirmedFollowing !== expectedFollowing) {
        return null;
      }

      setIsFollowingShop(confirmedFollowing);
      if (typeof updateUser === 'function') {
        updateUser({ followingShops: followedIds });
      }

      const confirmedFollowersCount = Number(
        shopResponse?.data?.shop?.followersCount ??
          shopResponse?.data?.followersCount ??
          product?.user?.followersCount ??
          0
      );
      setProduct((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                followersCount: confirmedFollowersCount
              }
            }
          : prev
      );
      return confirmedFollowing;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!user || !product?.user?._id) {
      setIsFollowingShop(false);
      return;
    }
    const list = Array.isArray(user.followingShops) ? user.followingShops : [];
    const following = list.some((entry) => String(entry) === String(product.user._id));
    setIsFollowingShop(following);
  }, [product?.user?._id, user?.followingShops, user]);

  const productOptionDefinitions = useMemo(
    () => normalizeProductAttributes(product?.attributes),
    [product?.attributes]
  );
  const defaultSelectedAttributes = useMemo(
    () => getDefaultSelectedAttributes(productOptionDefinitions),
    [productOptionDefinitions]
  );
  const selectedAttributeValidation = useMemo(
    () =>
      validateSelectedAttributes({
        productAttributes: productOptionDefinitions,
        selectedAttributes
      }),
    [productOptionDefinitions, selectedAttributes]
  );
  const normalizedSelectedAttributes = useMemo(
    () => normalizeSelectedAttributes(selectedAttributeValidation.selectedAttributes),
    [selectedAttributeValidation.selectedAttributes]
  );
  const getSelectedOptionValues = useCallback(
    (attribute) => {
      const key = String(attribute?.name || '').trim().toLowerCase();
      return Array.isArray(selectedOptionsByAttribute[key])
        ? selectedOptionsByAttribute[key]
        : [];
    },
    [selectedOptionsByAttribute]
  );
  const selectedAttributeCombinations = useMemo(() => {
    if (!selectedAttributeValidation.valid) return [];
    let combinations = [[]];

    productOptionDefinitions.forEach((attribute) => {
      const attributeName = String(attribute?.name || '').trim();
      if (!attributeName) return;
      if (attribute.type !== 'select') {
        const entry = normalizedSelectedAttributes.find(
          (item) => item.name.toLowerCase() === attributeName.toLowerCase()
        );
        if (entry) combinations = combinations.map((combination) => [...combination, entry]);
        return;
      }

      const selectedValues = getSelectedOptionValues(attribute);
      combinations = combinations.flatMap((combination) =>
        selectedValues.map((value) => [...combination, { name: attributeName, value }])
      );
    });

    return combinations;
  }, [
    getSelectedOptionValues,
    normalizedSelectedAttributes,
    productOptionDefinitions,
    selectedAttributeValidation.valid
  ]);
  const selectedAttributesSummary = useMemo(
    () =>
      productOptionDefinitions.flatMap((attribute) => {
        if (attribute.type === 'select') {
          const values = getSelectedOptionValues(attribute);
          return values.length ? [{ name: attribute.name, value: values.join(', ') }] : [];
        }
        const entry = normalizedSelectedAttributes.find(
          (item) => item.name.toLowerCase() === attribute.name.toLowerCase()
        );
        return entry ? [entry] : [];
      }),
    [getSelectedOptionValues, normalizedSelectedAttributes, productOptionDefinitions]
  );
  const selectedOutOfStockOptions = useMemo(
    () =>
      productOptionDefinitions.flatMap((attribute) =>
        getSelectedOptionValues(attribute)
          .filter((value) => attribute.optionOutOfStock?.[String(value).trim().toLowerCase()])
          .map((value) => ({ name: attribute.name, value }))
      ),
    [getSelectedOptionValues, productOptionDefinitions]
  );
  const hasSelectedOutOfStockOption = selectedOutOfStockOptions.length > 0;
  const selectedOptionStockMessage = hasSelectedOutOfStockOption
    ? `${selectedOutOfStockOptions.map((entry) => entry.value).join(', ')} : rupture de stock.`
    : '';
  const hasRequiredProductOptions = productOptionDefinitions.some(isProductAttributeSelectionRequired);
  const hasProductOptions = productOptionDefinitions.length > 0;
  const matchingCartLines = useMemo(() => {
    if (!product?._id || !user) return null;
    const selectedKeys = new Set(
      selectedAttributeCombinations.map(buildSelectedAttributesSelectionKey)
    );
    return (cart?.items || []).filter((item) => {
      if (String(item?.product?._id || '') !== String(product._id)) return false;
      const itemSelectionKey = String(
        item?.selectionKey || buildSelectedAttributesSelectionKey(item?.selectedAttributes || [])
      ).trim();
      return selectedKeys.has(itemSelectionKey);
    });
  }, [cart?.items, product?._id, selectedAttributeCombinations, user]);
  const inCart = selectedAttributeCombinations.length > 0 &&
    matchingCartLines?.length === selectedAttributeCombinations.length;

  useEffect(() => {
    setSelectedAttributes(defaultSelectedAttributes);
    setSelectedOptionsByAttribute(
      productOptionDefinitions.reduce((result, attribute) => {
        if (attribute.type === 'select' && attribute.defaultValue) {
          result[attribute.name.toLowerCase()] = [attribute.defaultValue];
        }
        return result;
      }, {})
    );
    setSelectionError("");
  }, [defaultSelectedAttributes, product?._id, productOptionDefinitions]);

  // Jump the gallery to the photo linked to the selected option (e.g. the red
  // photo when "Rouge" is picked). Gallery indexes the deduplicated image list.
  useEffect(() => {
    const images = Array.isArray(product?.images) ? product.images : [];
    const variantImage = resolveSelectedAttributesImage({
      productAttributes: productOptionDefinitions,
      selectedAttributes: normalizedSelectedAttributes,
      images
    });
    if (!variantImage.applied || !variantImage.image) return;
    const unique = Array.from(
      new Set(images.map((value) => String(value || '').trim()).filter(Boolean))
    ).slice(0, 10);
    const galleryIndex = unique.indexOf(String(variantImage.image).trim());
    if (galleryIndex >= 0) setSelectedImage(galleryIndex);
  }, [normalizedSelectedAttributes, productOptionDefinitions, product?.images]);

  const handleAttributeValueChange = useCallback((attribute, value) => {
    setSelectionError("");
    const attributeName = String(attribute?.name || '').trim();
    const nextValue = String(value ?? '').trim();
    if (attribute?.type === 'select') {
      const attributeKey = attributeName.toLowerCase();
      setSelectedOptionsByAttribute((prev) => {
        const currentValues = Array.isArray(prev[attributeKey]) ? prev[attributeKey] : [];
        const alreadySelected = currentValues.some(
          (item) => item.toLowerCase() === nextValue.toLowerCase()
        );
        const nextValues = alreadySelected
          ? currentValues.filter((item) => item.toLowerCase() !== nextValue.toLowerCase())
          : [...currentValues, nextValue];

        setSelectedAttributes((currentAttributes) => {
          const current = normalizeSelectedAttributes(currentAttributes);
          const filtered = current.filter(
            (entry) => entry.name.toLowerCase() !== attributeKey
          );
          const representativeValue = alreadySelected
            ? nextValues[nextValues.length - 1] || ''
            : nextValue;
          return representativeValue
            ? [...filtered, { name: attributeName, value: representativeValue }]
            : filtered;
        });

        return { ...prev, [attributeKey]: nextValues };
      });
      return;
    }
    setSelectedAttributes((prev) => {
      const current = normalizeSelectedAttributes(prev);
      const filtered = current.filter(
        (entry) => entry.name.toLowerCase() !== attributeName.toLowerCase()
      );
      if (!nextValue) return filtered;
      return [...filtered, { name: attributeName, value: nextValue }];
    });
  }, []);

  const requireSelectedProductOptions = useCallback(() => {
    if (selectedAttributeValidation.valid) {
      setSelectionError("");
      return selectedAttributeValidation.selectedAttributes;
    }
    const missingOptions = selectedAttributeValidation.missing || [];
    setSelectionError(
      missingOptions.length
        ? `Veuillez sélectionner : ${missingOptions.join(', ')}.`
        : 'Veuillez sélectionner toutes les options du produit.'
    );
    return null;
  }, [selectedAttributeValidation]);

  const requireSelectedProductOptionCombinations = useCallback(() => {
    if (!requireSelectedProductOptions()) return null;
    if (hasSelectedOutOfStockOption) {
      setSelectionError(selectedOptionStockMessage);
      return null;
    }
    if (selectedAttributeCombinations.length > 50) {
      setSelectionError('Veuillez limiter votre sélection à 50 combinaisons à la fois.');
      return null;
    }
    return selectedAttributeCombinations;
  }, [
    hasSelectedOutOfStockOption,
    requireSelectedProductOptions,
    selectedAttributeCombinations,
    selectedOptionStockMessage
  ]);

  const promptProductOptionSelection = useCallback(() => {
    const missingOptions = selectedAttributeValidation.missing || [];
    setSelectionError(
      missingOptions.length
        ? `Veuillez sélectionner : ${missingOptions.join(', ')}.`
        : 'Veuillez sélectionner toutes les options du produit.'
    );
    if (isMobileView) {
      setIsVariantSheetOpen(true);
      return;
    }
    window.requestAnimationFrame(() => {
      document.getElementById('product-purchase-options')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    });
  }, [isMobileView, selectedAttributeValidation.missing]);

  const handleFollowToggle = async () => {
    if (!product?.user?._id) return;
    if (!user) {
      setPendingAction({ type: 'followShop', payload: { shopId: product.user._id } });
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }
    if (!isProfessional || !isShopVerified || isOwnProduct) return;
    setFollowLoading(true);
    const expectedFollowing = !isFollowingShop;
    try {
      const response = isFollowingShop
        ? await api.delete(`/users/shops/${product.user._id}/follow`, {
            silentGlobalError: true
          })
        : await api.post(`/users/shops/${product.user._id}/follow`, null, {
            silentGlobalError: true
          });
      setIsFollowingShop(!isFollowingShop);
      if (typeof updateUser === 'function') {
        const currentList = Array.isArray(user.followingShops) ? user.followingShops : [];
        const normalized = currentList.map((entry) => String(entry));
        const nextList = isFollowingShop
          ? normalized.filter((entry) => entry !== String(product.user._id))
          : Array.from(new Set([...normalized, String(product.user._id)]));
        updateUser({ followingShops: nextList });
      }
      if (response?.data?.followersCount !== undefined) {
        setProduct((prev) =>
          prev ? { ...prev, user: { ...prev.user, followersCount: response.data.followersCount } } : prev
        );
      }
    } catch (err) {
      if (err?.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      if (isApiPossiblyCommittedError(err)) {
        const confirmedFollowing = await verifyShopFollowMutation(expectedFollowing);
        if (confirmedFollowing !== null) {
          showToast(
            confirmedFollowing ? 'Boutique suivie.' : 'Boutique désabonnée.',
            { variant: 'success' }
          );
          return;
        }
      }
      console.error('Erreur suivi boutique:', err);
      showToast(getApiErrorMessage(err, 'Impossible de mettre à jour le suivi de la boutique.'), {
        variant: 'error'
      });
    } finally {
      setFollowLoading(false);
    }
  };

  // 🔄 CHARGEMENT DES DONNÉES
  useEffect(() => {
    if (!slug) {
      setError("Produit non trouvé ou indisponible");
      setLoading(false);
      return;
    }

    if (authLoading) {
      return;
    }

    let active = true;

    const loadProduct = async () => {
      let snapshot = null;
      let hydratedFromSnapshot = false;

      try {
        setError("");
        snapshot = await loadOfflineSnapshot(productSnapshotKey, {
          maxAgeMs: PRODUCT_DETAILS_SNAPSHOT_MAX_AGE_MS
        });
        hydratedFromSnapshot = Boolean(snapshot && typeof snapshot === "object" && snapshot.product);
        setCommentsLoading(false);
        setRelatedLoading(false);

        if (hydratedFromSnapshot && active) {
          setProduct(snapshot.product || null);
          setRelatedProducts(Array.isArray(snapshot.relatedProducts) ? snapshot.relatedProducts : []);
          setShopGalleryProducts(Array.isArray(snapshot.shopGalleryProducts) ? snapshot.shopGalleryProducts : []);
          setComments(Array.isArray(snapshot.comments) ? snapshot.comments : []);
          setWhatsappClicks(Number(snapshot.whatsappClicks || snapshot.product?.whatsappClicks || 0));
          setFavoriteCount(Number(snapshot.favoriteCount || snapshot.product?.favoritesCount || 0));
          setOfflineSnapshotActive(false);
          setLoading(false);
        } else {
          setLoading(true);
          setComments([]);
          setRelatedProducts([]);
          setShopGalleryProducts([]);
          setUserRating(0);
          setRating(0);
        }

        let data;
        console.debug("Loading product", { slug });
        try {
          const response = await api.get(`/products/public/${slug}`, { silentGlobalError: true });
          data = response.data;
        } catch (publicError) {
          const status = publicError?.response?.status;
          if (status === 404 && user) {
            try {
              const response = await api.get(`/products/${slug}`, { silentGlobalError: true });
              data = response.data;
            } catch (privateError) {
              if (privateError?.response?.status === 401) {
                handleSessionExpired();
                return;
              }
              throw privateError;
            }
          } else {
            if (status === 401) {
              handleSessionExpired();
              return;
            }
            throw publicError;
          }
        }

        if (!data) {
          throw new Error("Produit non trouvé");
        }

        if (!active) return;
        setProduct(data);
        setOfflineSnapshotActive(false);
        setWhatsappClicks(data.whatsappClicks || 0);
        setFavoriteCount(data.favoritesCount || 0);
        // Fetch bundle suggestions
        const pid = data._id || data.id;
        if (pid) {
          api.get(`/products/public/${pid}/bundle-suggestions`)
            .then(({ data: bd }) => setBundleData(bd))
            .catch(() => setBundleData(null));
        }
        if (!hydratedFromSnapshot) {
          setComments([]);
          setRelatedProducts([]);
          setShopGalleryProducts([]);
          setUserRating(0);
          setRating(0);
        }
        setLoading(false);

        // Load secondary data after the product itself is visible.
        if (data.status === 'approved') {
          setCommentsLoading(true);
          void Promise.all([
            loadComments(data._id || data.slug),
            loadUserRating(data._id)
          ]).finally(() => {
            if (active) setCommentsLoading(false);
          });
        } else {
          if (active) {
            setComments([]);
            setUserRating(0);
            setRating(0);
            setCommentsLoading(false);
          }
        }

        if (data.category) {
          const relatedLimit = rapid3GActive ? 2 : 4;
          setRelatedLoading(true);
          void api
            .get(`/products/public?category=${data.category}&limit=${relatedLimit}`)
            .then((relatedResponse) => {
              const relatedItems = Array.isArray(relatedResponse.data?.items)
                ? relatedResponse.data.items
                : [];
              const filteredItems = relatedItems.filter((item) => {
                if (!item) return false;
                if (data?._id && item._id && item._id === data._id) return false;
                if (data?.slug && item.slug && item.slug === data.slug) return false;
                return true;
              });
              if (active) setRelatedProducts(filteredItems.slice(0, relatedLimit));
            })
            .catch((relatedError) => {
              console.error("Erreur chargement produits similaires:", relatedError);
              if (active) setRelatedProducts([]);
            })
            .finally(() => {
              if (active) setRelatedLoading(false);
            });
        } else if (active) {
          setRelatedProducts([]);
          setRelatedLoading(false);
        }
      } catch (err) {
        if (!active) return;
        setCommentsLoading(false);
        setRelatedLoading(false);
        if (err.response?.status === 401) {
          handleSessionExpired();
          return;
        }
        if (snapshot && typeof snapshot === 'object' && snapshot.product) {
          setProduct(snapshot.product || null);
          setRelatedProducts(Array.isArray(snapshot.relatedProducts) ? snapshot.relatedProducts : []);
          setShopGalleryProducts(Array.isArray(snapshot.shopGalleryProducts) ? snapshot.shopGalleryProducts : []);
          setComments(Array.isArray(snapshot.comments) ? snapshot.comments : []);
          setWhatsappClicks(Number(snapshot.whatsappClicks || snapshot.product?.whatsappClicks || 0));
          setFavoriteCount(Number(snapshot.favoriteCount || snapshot.product?.favoritesCount || 0));
          setOfflineSnapshotActive(Boolean(shouldUseOfflineSnapshot));
          setError("");
          return;
        }
        setError(err.response?.data?.message || "Produit non trouvé ou indisponible");
        console.error("Erreur chargement produit:", err);
      } finally {
        if (active && !hydratedFromSnapshot) setLoading(false);
      }
    };

    loadProduct();
    return () => {
      active = false;
    };
  }, [slug, user?._id, authLoading, handleSessionExpired, productSnapshotKey, rapid3GActive, shouldUseOfflineSnapshot]);

  useEffect(() => {
    if (!product?._id) return;
    recordProductView(product);
  }, [product?._id, product?.category]);

  useEffect(() => {
    if (!product?._id || product?.status !== 'approved') return;
    const dedupeKey = String(product._id);
    if (trackedProductViewsRef.current.has(dedupeKey)) return;
    trackedProductViewsRef.current.add(dedupeKey);

    const identifier = product._id || product.slug;
    const optimisticViews = Number(product.viewsCount ?? product.views ?? 0) + 1;
    const optimisticTodayViews = Number(product.todayViewsCount || 0) + 1;

    setProduct((prev) =>
      prev
        ? {
          ...prev,
          viewsCount: Math.max(optimisticViews, Number(prev.viewsCount ?? prev.views ?? 0)),
          views: Math.max(optimisticViews, Number(prev.views ?? prev.viewsCount ?? 0)),
          todayViewsCount: Math.max(optimisticTodayViews, Number(prev.todayViewsCount || 0)),
          lastViewedAt: new Date().toISOString()
        }
        : prev
    );

    let cancelled = false;
    api
      .post(`/products/public/${identifier}/view`, null, { skipCache: true, headers: { 'x-skip-cache': '1' } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setProduct((prev) =>
          prev
            ? {
              ...prev,
              viewsCount: Number(data.viewsCount ?? prev.viewsCount ?? prev.views ?? 0),
              uniqueViewsCount: Number(data.uniqueViewsCount ?? prev.uniqueViewsCount ?? 0),
              views: Number(data.viewsCount ?? prev.views ?? prev.viewsCount ?? 0),
              todayViewsCount: Number(data.todayViewsCount ?? prev.todayViewsCount ?? 0),
              lastViewedAt: data.lastViewedAt || prev.lastViewedAt
            }
            : prev
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [product?._id, product?.slug, product?.status]);

  // Scroll to top when page opens or slug changes
  useEffect(() => {
    // Reset image selection when navigating to a new product
    setSelectedImage(0);
    // Immediate scroll to top
    window.scrollTo(0, 0);
    // Smooth scroll as fallback
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
    // Reset mobile accordion / seller states
    setSellerExpanded(false);
    setExpandedSections({ description: false, specifications: false, shipping: false });
  }, [slug]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openParam = String(params.get('open') || params.get('tab') || '').trim().toLowerCase();
    const hashValue = String(location.hash || '').trim().toLowerCase();
    const shouldOpenReviews =
      ['reviews', 'review', 'comments', 'comment'].includes(openParam) ||
      hashValue === '#comments' ||
      hashValue === '#reviews';

    if (shouldOpenReviews) {
      setActiveTab('reviews');
    }

    const commentId = String(params.get('commentId') || params.get('focusCommentId') || '').trim();
    if (commentId) {
      pendingFocusCommentIdRef.current = commentId;
      setHighlightedCommentId(commentId);
    }

    const imageParam = parseInt(params.get('image'), 10);
    if (Number.isFinite(imageParam) && imageParam >= 0) {
      setSelectedImage(imageParam);
    }
  }, [location.hash, location.search]);

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    const targetCommentId = String(pendingFocusCommentIdRef.current || '').trim();
    if (!targetCommentId) return;

    const node =
      document.getElementById(`comment-${targetCommentId}`) ||
      document.getElementById(`reply-${targetCommentId}`);
    if (!node) return;

    pendingFocusCommentIdRef.current = '';
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (commentHighlightTimerRef.current) {
      clearTimeout(commentHighlightTimerRef.current);
    }
    commentHighlightTimerRef.current = setTimeout(() => {
      setHighlightedCommentId('');
      commentHighlightTimerRef.current = null;
    }, 2200);
  }, [activeTab, comments]);

  useEffect(
    () => () => {
      if (commentHighlightTimerRef.current) {
        clearTimeout(commentHighlightTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMobileView || !product || !canOpenShopProfile) {
      setShopGalleryProducts([]);
      return;
    }

    if (offlineSnapshotActive && shouldUseOfflineSnapshot) {
      return;
    }

    const shopId = product.user?.slug || product.user?._id;
    if (!shopId) {
      setShopGalleryProducts([]);
      return;
    }

    let active = true;
    const loadShopGallery = async () => {
      try {
        const { data } = await api.get(`/shops/${shopId}`, { params: { limit: 12 } });
        const items = Array.isArray(data?.products) ? data.products : [];
        const filtered = items.filter((item) => {
          if (!item) return false;
          if (product?._id && item._id && item._id === product._id) return false;
          if (product?.slug && item.slug && item.slug === product.slug) return false;
          return true;
        });
        if (active) setShopGalleryProducts(filtered);
      } catch (error) {
        if (active) setShopGalleryProducts([]);
      }
    };

    loadShopGallery();
    return () => {
      active = false;
    };
  }, [
    canOpenShopProfile,
    isMobileView,
    isProfessional,
    offlineSnapshotActive,
    product?._id,
    product?.slug,
    product?.user?._id,
    product?.user?.slug,
    shouldUseOfflineSnapshot
  ]);

  useEffect(() => {
    if (!product?._id) return;
    if (shouldUseOfflineSnapshot) return;
    saveOfflineSnapshot(productSnapshotKey, {
      product,
      relatedProducts,
      shopGalleryProducts,
      comments,
      whatsappClicks,
      favoriteCount
    });
  }, [
    comments,
    favoriteCount,
    product,
    product?._id,
    productSnapshotKey,
    relatedProducts,
    shopGalleryProducts,
    shouldUseOfflineSnapshot,
    whatsappClicks
  ]);

  useEffect(() => {
    setCertifyMessage("");
    setCertifyError("");
  }, [product?._id]);

  useEffect(() => {
    setSelectedQuantity(1);
  }, [product?._id]);

  // 💬 CHARGEMENT DES COMMENTAIRES
  const loadComments = async (identifier) => {
    const target = identifier || slug;
    try {
      const { data } = await api.get(`/products/public/${target}/comments`, { skipCache: true });
      const normalizedComments = organizeComments(Array.isArray(data) ? data : []);
      setComments(normalizedComments);
      return normalizedComments;
    } catch (error) {
      if (error.response?.status === 404) {
        setComments([]);
        return [];
      }
      console.error("Erreur chargement commentaires:", error);
      setComments([]);
      return [];
    }
  };

  // 🧩 ORGANISATION DES COMMENTAIRES EN THREADS
  const organizeComments = (comments) => {
    const commentMap = new Map();
    const roots = [];

    // Créer une map de tous les commentaires
    comments.forEach(comment => {
      const commentId = String(comment._id);
      commentMap.set(commentId, { ...comment, replies: [] });
    });

    // Organiser en hiérarchie
    comments.forEach(comment => {
      const commentId = String(comment._id);
      const commentWithReplies = commentMap.get(commentId);
      if (!commentWithReplies) return;
      const parentId =
        typeof comment.parent === 'string'
          ? comment.parent
          : comment.parent && comment.parent._id
            ? String(comment.parent._id)
            : null;
      if (parentId) {
        const parent = commentMap.get(parentId);
        if (parent) {
          parent.replies.push(commentWithReplies);
          return;
        }
      }
      roots.push(commentWithReplies);
    });

    // Sort newest comments first
    const sortByDateDesc = (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    const sortByDateAsc = (a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();

    roots.sort(sortByDateDesc);
    roots.forEach((root) => {
      if (Array.isArray(root.replies)) {
        root.replies.sort(sortByDateAsc);
      }
    });

    return roots;
  };

  const flattenComments = (list) =>
    (Array.isArray(list) ? list : []).flatMap((entry) => [
      entry,
      ...flattenComments(Array.isArray(entry?.replies) ? entry.replies : [])
    ]);

  const insertCommentIntoState = (newComment) => {
    if (!newComment || !newComment._id) return;
    const parentId =
      (typeof newComment.parent === 'string' && newComment.parent) ||
      newComment.parent?._id ||
      null;

    setComments((prev) => {
      if (!Array.isArray(prev)) return prev;
      if (parentId) {
        return prev.map((comment) => {
          if (String(comment._id) !== String(parentId)) return comment;
          const replies = Array.isArray(comment.replies) ? comment.replies : [];
          if (replies.some((reply) => String(reply._id) === String(newComment._id))) {
            return comment;
          }
          return {
            ...comment,
            replies: [...replies, newComment]
          };
        });
      }
      if (prev.some((comment) => String(comment._id) === String(newComment._id))) {
        return prev;
      }
      return [newComment, ...prev];
    });
  };

  const incrementCommentCount = () => {
    setProduct((prev) =>
      prev ? { ...prev, commentCount: Number(prev.commentCount || 0) + 1 } : prev
    );
  };

  const decrementCommentCount = () => {
    setProduct((prev) =>
      prev ? { ...prev, commentCount: Math.max(0, Number(prev.commentCount || 0) - 1) } : prev
    );
  };

  const replaceCommentInState = (temporaryId, persistedComment) => {
    if (!temporaryId || !persistedComment?._id) return;
    const tempId = String(temporaryId);
    const replaceRecursively = (list) =>
      (Array.isArray(list) ? list : []).map((entry) => {
        const entryId = String(entry?._id || '');
        if (entryId === tempId) {
          const existingReplies = Array.isArray(entry?.replies) ? entry.replies : [];
          const persistedReplies = Array.isArray(persistedComment?.replies) ? persistedComment.replies : existingReplies;
          return { ...persistedComment, replies: persistedReplies };
        }
        const replies = Array.isArray(entry?.replies) ? entry.replies : [];
        if (!replies.length) return entry;
        return { ...entry, replies: replaceRecursively(replies) };
      });

    setComments((prev) => replaceRecursively(prev));
  };

  const removeCommentFromState = (commentId) => {
    if (!commentId) return;
    const targetId = String(commentId);
    const pruneRecursively = (list) =>
      (Array.isArray(list) ? list : [])
        .filter((entry) => String(entry?._id || '') !== targetId)
        .map((entry) => {
          const replies = Array.isArray(entry?.replies) ? entry.replies : [];
          return replies.length ? { ...entry, replies: pruneRecursively(replies) } : entry;
        });

    setComments((prev) => pruneRecursively(prev));
  };

  const updateRatingStats = (nextRating, previousRating) => {
    setProduct((prev) => {
      if (!prev) return prev;
      const prevCount = Number(prev.ratingCount || 0);
      const prevAvg = Number(prev.ratingAverage || 0);
      let nextCount = prevCount;
      let nextAvg = prevAvg;

      if (previousRating && prevCount > 0) {
        nextAvg = (prevAvg * prevCount - previousRating + nextRating) / prevCount;
      } else {
        nextCount = prevCount + 1;
        nextAvg = (prevAvg * prevCount + nextRating) / nextCount;
      }

      return {
        ...prev,
        ratingAverage: Number(nextAvg.toFixed(2)),
        ratingCount: nextCount
      };
    });
  };

  // ⭐ CHARGEMENT DE LA NOTE UTILISATEUR
  const loadUserRating = async (identifier) => {
    if (!user) return;

    try {
      const target = identifier;
      if (!target) return;
      const { data } = await api.get(`/products/${target}/rating`, {
        params: { productId: target }
      });
      const nextValue = Number(data?.value || 0);
      setUserRating(nextValue);
      setRating(nextValue);
      return nextValue;
    } catch (error) {
      console.error("Erreur chargement note utilisateur:", error);
      setUserRating(0);
      setRating(0);
      return 0;
    }
  };

  const refreshProductEngagement = async () => {
    if (!slug) return null;
    try {
      const { data } = await api.get(`/products/public/${slug}`, {
        skipCache: true,
        silentGlobalError: true
      });
      if (data) {
        setProduct(data);
        setWhatsappClicks(Number(data.whatsappClicks || 0));
        setFavoriteCount(Number(data.favoritesCount || 0));
      }
      return data ?? null;
    } catch (publicError) {
      if (publicError?.response?.status === 404 && user) {
        try {
          const { data } = await api.get(`/products/${slug}`, {
            skipCache: true,
            silentGlobalError: true
          });
          if (data) {
            setProduct(data);
            setWhatsappClicks(Number(data.whatsappClicks || 0));
            setFavoriteCount(Number(data.favoritesCount || 0));
          }
          return data ?? null;
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const verifyCommentMutation = async ({ message, parentId = null }) => {
    const [nextComments] = await Promise.all([
      loadComments(product?._id || slug),
      refreshProductEngagement()
    ]);

    const normalizedMessage = String(message || '').trim();
    const currentUserId = String(user?._id || user?.id || '').trim();
    if (!normalizedMessage || !currentUserId) {
      return Array.isArray(nextComments) && nextComments.length > 0;
    }

    return flattenComments(nextComments).some((entry) => {
      const entryUserId = String(entry?.user?._id || entry?.user?.id || entry?.user || '').trim();
      const entryMessage = String(entry?.message || '').trim();
      const entryParentId = String(
        typeof entry?.parent === 'string' ? entry.parent : entry?.parent?._id || ''
      ).trim();
      return (
        entryUserId === currentUserId &&
        entryMessage === normalizedMessage &&
        entryParentId === String(parentId || '').trim()
      );
    });
  };

  const verifyRatingMutation = async (expectedRating) => {
    const [confirmedRating] = await Promise.all([
      loadUserRating(product?._id),
      refreshProductEngagement()
    ]);
    return Number(confirmedRating || 0) === Number(expectedRating || 0);
  };

  const handleCertificationToggle = async () => {
    if (!product || isCertifying) return;
    setCertifyMessage("");
    setCertifyError("");
    setIsCertifying(true);
    try {
      const desiredState = !product.certified;
      const { data } = await api.patch(`/admin/products/${product._id}/certify`, {
        certified: desiredState
      });
      setProduct((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          certified: data.certified,
          certifiedBy: data.certifiedBy,
          certifiedAt: data.certifiedAt
        };
      });
      setCertifyMessage(desiredState ? "Produit certifié." : "Certification retirée.");
    } catch (error) {
      console.error("Erreur certification produit:", error);
      setCertifyError(error?.response?.data?.message || "Une erreur est survenue.");
    } finally {
      setIsCertifying(false);
    }
  };

  // 💬 SOUMISSION D'UN COMMENTAIRE PRINCIPAL
  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmittingComment(true);
    setCommentError("");
    const message = newComment.trim();
    const tempCommentId = `tmp-comment-${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      message,
      product: product?._id,
      user: {
        _id: user?._id || user?.id || 'me',
        name: user?.name || 'Vous'
      },
      parent: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    };
    setNewComment("");
    insertCommentIntoState(optimisticComment);
    incrementCommentCount();

    try {
      const commentData = {
        productId: product?._id,
        message
      };

      const commentTarget = product?._id || slug;
      const response = await api.post(`/products/${commentTarget}/comments`, commentData, {
        silentGlobalError: true
      });
      replaceCommentInState(tempCommentId, response?.data);

    } catch (error) {
      if (error.response?.status === 401) {
        removeCommentFromState(tempCommentId);
        decrementCommentCount();
        setNewComment(message);
        handleSessionExpired();
        return;
      }

      if (isApiPossiblyCommittedError(error)) {
        const confirmed = await verifyCommentMutation({ message });
        if (confirmed) {
          showToast('Commentaire enregistré.', { variant: 'success' });
          return;
        }
      }

      removeCommentFromState(tempCommentId);
      decrementCommentCount();
      setNewComment(message);
      console.error("Erreur soumission commentaire:", error);
      setCommentError(getApiErrorMessage(error, "Erreur lors de l'envoi du commentaire."));
    } finally {
      setSubmittingComment(false);
    }
  };

  // 🗑️ SUPPRESSION D'UN COMMENTAIRE (ADMIN)
  const handleDeleteComment = async (commentId) => {
    if (!user || !['admin', 'founder'].includes(String(user.role || ''))) return;
    if (!(await appConfirm('Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action supprimera également toutes les réponses associées.'))) {
      return;
    }

    setDeletingCommentId(commentId);
    try {
      await api.delete(`/admin/comments/${commentId}`);
      await loadComments(product?._id || product?.slug);

      // Reload product to update commentCount
      const { data: updatedProduct } = await api.get(`/products/public/${slug}`, { skipCache: true });
      setProduct(updatedProduct);

      showToast('Commentaire supprimé avec succès.', { variant: 'success' });
    } catch (error) {
      console.error('Erreur suppression commentaire:', error);
      const msg = error.response?.data?.message || 'Erreur lors de la suppression.';
      showToast(msg, { variant: 'error' });
    } finally {
      setDeletingCommentId(null);
    }
  };

  // 💬 SOUMISSION D'UNE RÉPONSE
  const handleSubmitReply = async (parentComment) => {
    if (!user || !replyText.trim()) return;

    setSubmittingComment(true);
    setCommentError("");
    const message = replyText.trim();
    const tempReplyId = `tmp-reply-${Date.now()}`;
    const optimisticReply = {
      _id: tempReplyId,
      message,
      product: product?._id,
      user: {
        _id: user?._id || user?.id || 'me',
        name: user?.name || 'Vous'
      },
      parent: {
        _id: parentComment?._id,
        message: parentComment?.message || '',
        user: parentComment?.user || null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setReplyText("");
    setReplyingTo(null);
    insertCommentIntoState(optimisticReply);
    incrementCommentCount();

    try {
      const replyData = {
        productId: product?._id,
        message,
        parentId: parentComment._id  // Référence au commentaire parent
      };

      const commentTarget = product?._id || slug;
      const response = await api.post(`/products/${commentTarget}/comments`, replyData, {
        silentGlobalError: true
      });
      replaceCommentInState(tempReplyId, response?.data);

    } catch (error) {
      if (error.response?.status === 401) {
        removeCommentFromState(tempReplyId);
        decrementCommentCount();
        setReplyingTo(parentComment?._id || null);
        setReplyText(message);
        handleSessionExpired();
        return;
      }

      if (isApiPossiblyCommittedError(error)) {
        const confirmed = await verifyCommentMutation({
          message,
          parentId: parentComment?._id || null
        });
        if (confirmed) {
          showToast('Réponse enregistrée.', { variant: 'success' });
          return;
        }
      }

      removeCommentFromState(tempReplyId);
      decrementCommentCount();
      setReplyingTo(parentComment?._id || null);
      setReplyText(message);
      console.error("Erreur soumission réponse:", error);
      setCommentError(getApiErrorMessage(error, "Erreur lors de l'envoi de la réponse."));
    } finally {
      setSubmittingComment(false);
    }
  };

  // ⭐ SOUMISSION D'UNE NOTE
  const handleSubmitRating = async (newRating) => {
    if (!user) {
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }

    const previousRating = userRating || 0;
    const previousRatingAverage = Number(product?.ratingAverage || 0);
    const previousRatingCount = Number(product?.ratingCount || 0);
    setSubmittingRating(true);
    setUserRating(newRating);
    setRating(newRating);
    updateRatingStats(newRating, previousRating);
    try {
      await api.put(`/products/${slug}/rating`, {
        value: newRating,
        productId: product?._id
      }, {
        silentGlobalError: true
      });

    } catch (error) {
      if (error.response?.status === 401) {
        setUserRating(previousRating);
        setRating(previousRating);
        setProduct((prev) =>
          prev
            ? {
              ...prev,
              ratingAverage: previousRatingAverage,
              ratingCount: previousRatingCount
            }
            : prev
        );
        handleSessionExpired();
        return;
      }

      if (isApiPossiblyCommittedError(error)) {
        const confirmed = await verifyRatingMutation(newRating);
        if (confirmed) {
          showToast('Note enregistrée.', { variant: 'success' });
          return;
        }
      }

      setUserRating(previousRating);
      setRating(previousRating);
      setProduct((prev) =>
        prev
          ? {
            ...prev,
            ratingAverage: previousRatingAverage,
            ratingCount: previousRatingCount
          }
          : prev
      );
      console.error("Erreur soumission note:", error);
      appAlert(`Erreur lors de l'ajout de la note : ${getApiErrorMessage(error, 'Une erreur est survenue lors de l’envoi de votre note.')}`);
    } finally {
      setSubmittingRating(false);
    }
  };

  // 🛒 GESTION PANIER
  const handleAddToCart = async () => {
    if (!product) return;
    const safeQty = Math.min(9999, Math.max(1, Math.trunc(Number(selectedQuantity || 1))));
    const selectedCombinations = requireSelectedProductOptionCombinations();
    if (!selectedCombinations) return;

    if (!user) {
      setPendingAction({
        type: 'addToCart',
        payload: {
          productId: product._id,
          quantity: safeQty,
          items: selectedCombinations.map((selectedAttributes) => ({
            productId: product._id,
            quantity: safeQty,
            selectedAttributes
          }))
        }
      });
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }

    if (inCart) return;

    setAddingToCart(true);
    setCartFeedback("");
    try {
      const cartSelectionKeys = new Set(
        (cart?.items || [])
          .filter((item) => String(item?.product?._id || '') === String(product._id))
          .map((item) => item?.selectionKey || buildSelectedAttributesSelectionKey(item?.selectedAttributes || []))
      );
      const combinationsToAdd = selectedCombinations.filter(
        (attributes) => !cartSelectionKeys.has(buildSelectedAttributesSelectionKey(attributes))
      );
      for (const attributes of combinationsToAdd) {
        await addItem(product._id, safeQty, attributes);
      }
      setCartFeedback(
        combinationsToAdd.length > 1
          ? `✅ ${combinationsToAdd.length} options ajoutées au panier !`
          : '✅ Ajouté au panier !'
      );
      setTimeout(() => setCartFeedback(''), 3000);
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      setCartFeedback('❌ Erreur lors de l\'ajout');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product) return;
    const safeQty = Math.min(9999, Math.max(1, Math.trunc(Number(selectedQuantity || 1))));
    const selectedCombinations = requireSelectedProductOptionCombinations();
    if (!selectedCombinations) return;
    const liveStock = Number(product?.stock ?? product?.quantity ?? product?.availableStock ?? Number.NaN);
    if (Number.isFinite(liveStock) && liveStock <= 0) {
      setCartFeedback('❌ Produit en rupture de stock');
      return;
    }

    if (!user) {
      setPendingAction({
        type: 'buyNow',
        payload: {
          productId: product._id,
          quantity: safeQty,
          items: selectedCombinations.map((selectedAttributes) => ({
            productId: product._id,
            quantity: safeQty,
            selectedAttributes
          }))
        }
      });
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }

    if (inCart) {
      navigate('/orders/checkout');
      return;
    }

    setAddingToCart(true);
    setCartFeedback('');
    try {
      const cartSelectionKeys = new Set(
        (cart?.items || [])
          .filter((item) => String(item?.product?._id || '') === String(product._id))
          .map((item) => item?.selectionKey || buildSelectedAttributesSelectionKey(item?.selectedAttributes || []))
      );
      const combinationsToAdd = selectedCombinations.filter(
        (attributes) => !cartSelectionKeys.has(buildSelectedAttributesSelectionKey(attributes))
      );
      for (const attributes of combinationsToAdd) {
        await addItem(product._id, safeQty, attributes);
      }
      setCartFeedback('✅ Sélection ajoutée. Redirection...');
      navigate('/orders/checkout');
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      setCartFeedback('❌ Erreur lors de l\'ajout');
    } finally {
      setAddingToCart(false);
    }
  };

  // ❤️ GESTION FAVORIS
  const handleFavoriteToggle = async () => {
    if (!product) return;

    if (!user) {
      setPendingAction({ type: 'addFavorite', payload: { product } });
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }

    try {
      const result = await toggleFavorite(product);
      if (result === true) {
        setFavoriteCount(prev => prev + 1);
      } else if (result === false) {
        setFavoriteCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      console.error("Erreur favori:", err);
    }
  };

  // Gestion WhatsApp
  const handleWhatsappClick = async (event) => {
    if (!product) return;

    if (!user) {
      if (event?.preventDefault) event.preventDefault();
      appAlert('Veuillez vous connecter pour contacter le vendeur via WhatsApp.');
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }

    try {
      const target = product.slug || product._id;
      const { data } = await api.post(`/products/public/${target}/whatsapp-click`);
      setWhatsappClicks(data?.whatsappClicks || whatsappClicks + 1);
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      console.error("Erreur comptage WhatsApp:", err);
    }
  };

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const updateSelectedQuantity = useCallback((nextValue) => {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) {
      setSelectedQuantity(1);
      return;
    }
    setSelectedQuantity(Math.min(9999, Math.max(1, Math.trunc(parsed))));
  }, []);

  const increaseQuantity = useCallback(() => {
    setSelectedQuantity((prev) => Math.min(9999, Number(prev || 1) + 1));
  }, []);

  const decreaseQuantity = useCallback(() => {
    setSelectedQuantity((prev) => Math.max(1, Number(prev || 1) - 1));
  }, []);

  // 🎨 CALCULS ET FORMATAGES
  const hasDiscount = product?.discount > 0;
  const originalPrice = hasDiscount ? product?.priceBeforeDiscount : product?.price;
  // A selected variant (e.g. size) with its own price replaces the base price.
  const variantPricing = resolveSelectedAttributesPrice({
    productAttributes: productOptionDefinitions,
    selectedAttributes: normalizedSelectedAttributes,
    basePrice: product?.price || 0
  });
  const displayedPhotoPricing = resolveProductImagePrice({
    productAttributes: productOptionDefinitions,
    imageIndex:
      selectedImage >= 0 && selectedImage < (Array.isArray(product?.images) ? product.images.length : 0)
        ? selectedImage
        : -1
  });
  const finalPrice = displayedPhotoPricing.applied
    ? Number(displayedPhotoPricing.unitPrice || 0)
    : variantPricing.applied
      ? Number(variantPricing.unitPrice || 0)
      : Number(product?.price || 0);
  const normalizedQuantity = Math.min(9999, Math.max(1, Math.trunc(Number(selectedQuantity || 1))));
  const discountPercentage = product?.discount || 0;
  // Taobao-style variant strip + "Tout" sheet: driven by the first select
  // attribute whose options are mapped to product photos.
  const imageVariantAttribute = useMemo(
    () =>
      (Array.isArray(productOptionDefinitions) ? productOptionDefinitions : []).find(
        (attr) =>
          attr?.type === 'select' &&
          attr?.optionImages &&
          Array.isArray(attr?.options) &&
          attr.options.length > 0
      ) || null,
    [productOptionDefinitions]
  );
  const selectableAttributes = useMemo(
    () =>
      (Array.isArray(productOptionDefinitions) ? productOptionDefinitions : []).filter(
        (attr) => attr?.type === 'select' && Array.isArray(attr?.options) && attr.options.length > 0
      ),
    [productOptionDefinitions]
  );
  const wholesaleTiers = useMemo(() => {
    if (!Array.isArray(product?.wholesaleTiers)) return [];
    return product.wholesaleTiers
      .map((tier) => ({
        minQty: Number(tier?.minQty),
        unitPrice: Number(tier?.unitPrice),
        label: String(tier?.label || '').trim()
      }))
      .filter(
        (tier) =>
          Number.isInteger(tier.minQty) &&
          tier.minQty >= 2 &&
          Number.isFinite(tier.unitPrice) &&
          tier.unitPrice > 0
      )
      .sort((a, b) => a.minQty - b.minQty);
  }, [product?.wholesaleTiers]);
  const wholesaleEnabled = Boolean(product?.wholesaleEnabled) && wholesaleTiers.length > 0;
  const activeWholesaleTier = useMemo(() => {
    // Wholesale tiers quote the base price — skip them for variant prices.
    if (!wholesaleEnabled || variantPricing.applied) return null;
    return wholesaleTiers.reduce((active, tier) => {
      if (normalizedQuantity >= tier.minQty) return tier;
      return active;
    }, null);
  }, [wholesaleEnabled, wholesaleTiers, normalizedQuantity, variantPricing.applied]);
  const appliedUnitPrice = activeWholesaleTier?.unitPrice || finalPrice;
  const computedLineTotal = Number((appliedUnitPrice * normalizedQuantity).toFixed(2));
  const wholesaleSavingsAmount = Math.max(
    0,
    Number((finalPrice * normalizedQuantity - computedLineTotal).toFixed(2))
  );
  const wholesaleSavingsPercent =
    finalPrice > 0 ? Number(((wholesaleSavingsAmount / (finalPrice * normalizedQuantity)) * 100).toFixed(2)) : 0;
  const installmentOffer = useMemo(() => {
    if (!product?.installmentEnabled) {
      return { available: false, minAmount: 0, duration: 0, endDate: null };
    }
    const startDate = product.installmentStartDate ? new Date(product.installmentStartDate) : null;
    const endDate = product.installmentEndDate ? new Date(product.installmentEndDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime()) || !endDate || Number.isNaN(endDate.getTime())) {
      return { available: false, minAmount: 0, duration: 0, endDate: null };
    }
    const now = new Date();
    const available = now >= startDate && now <= endDate;
    return {
      available,
      minAmount: Number(product.installmentMinAmount || 0),
      duration: Number(product.installmentDuration || 0),
      endDate
    };
  }, [
    product?.installmentEnabled,
    product?.installmentStartDate,
    product?.installmentEndDate,
    product?.installmentMinAmount,
    product?.installmentDuration
  ]);
  const pickupOnly = product?.deliveryAvailable === false && product?.pickupAvailable !== false;
  const deliveryAvailable = product?.deliveryAvailable !== false;
  const pickupAvailable = product?.pickupAvailable !== false;
  const deliveryFeeEnabled = product?.deliveryFeeEnabled !== false;
  const deliveryFeeValue = Number(product?.deliveryFee || 0);
  const normalizedDeliveryFee = Number.isFinite(deliveryFeeValue) && deliveryFeeValue > 0 ? deliveryFeeValue : 0;
  const freeDeliveryAvailable = Boolean(
    (deliveryAvailable && (product?.user?.freeDeliveryEnabled || product?.shopFreeDeliveryEnabled)) ||
    (deliveryAvailable && (!deliveryFeeEnabled || normalizedDeliveryFee <= 0))
  );
  const deliveryPrimaryLabel = pickupOnly
    ? 'Retrait boutique uniquement'
    : freeDeliveryAvailable
      ? 'Livraison gratuite'
      : deliveryAvailable
        ? 'Livraison disponible'
        : pickupAvailable
          ? 'Retrait en boutique'
          : 'Livraison indisponible';
  const deliverySecondaryLabel = pickupOnly
    ? 'Ce produit se retire directement en boutique.'
    : freeDeliveryAvailable
      ? 'Aucun frais de livraison pour ce produit.'
      : deliveryAvailable && normalizedDeliveryFee > 0
        ? `Frais vendeur: ${formatPriceWithStoredSettings(normalizedDeliveryFee)}`
        : deliveryAvailable
          ? 'Contactez le vendeur pour confirmer les modalités.'
          : 'Contactez le vendeur pour les options disponibles.';
  const physicalSpecRows = useMemo(
    () => formatPhysicalSpecs(product?.physical),
    [product?.physical]
  );

  const ratingAverage = Number(product?.ratingAverage || 0).toFixed(1);
  const ratingCount = product?.ratingCount || 0;
  const commentCount = product?.commentCount || 0;

  useEffect(() => {
    if (!product?._id) return;
    let cancelled = false;
    api
      .get(`/product-questions/product/${product._id}`, { params: { limit: 1 } })
      .then(({ data }) => {
        if (!cancelled) setQuestionCount(Number(data?.total || 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product?._id]);

  const cartCount = Array.isArray(cart?.items) ? cart.items.length : 0;
  const totalViews = Number(product?.viewsCount ?? product?.views ?? 0);
  const totalOrdersQty = Number(product?.salesCount || 0);
  const todayViews = Number(product?.todayViewsCount || 0);
  const uniqueViewers = Number(product?.uniqueViewsCount || 0);
  const formattedTotalViews = totalViews.toLocaleString('fr-FR');
  const formattedTotalOrdersQty = totalOrdersQty.toLocaleString('fr-FR');
  const formattedTodayViews = todayViews.toLocaleString('fr-FR');
  const formattedUniqueViewers = uniqueViewers.toLocaleString('fr-FR');
  const rawStockValue = Number(
    product?.stock ?? product?.quantity ?? product?.availableStock ?? Number.NaN
  );
  const stockStatus = Number.isFinite(rawStockValue)
    ? rawStockValue <= 0
      ? { label: 'Rupture', className: 'bg-red-50 text-red-700 border border-red-200' }
      : rawStockValue <= 3
        ? { label: `Stock faible (${rawStockValue})`, className: 'bg-amber-50 text-amber-700 border border-amber-200' }
        : { label: `En stock (${rawStockValue})`, className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
    : { label: 'Disponible', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
  const conditionLabel = product?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionColor = product?.condition === 'new'
    ? 'bg-neutral-900'
    : 'bg-neutral-700';
  const isOutOfStock = Number.isFinite(rawStockValue) && rawStockValue <= 0;
  const isPurchaseOutOfStock = isOutOfStock || hasSelectedOutOfStockOption;
  const productSku = String(product?.sku || product?.confirmationNumber || '').trim();
  const productUpdatedAt = product?.updatedAt ? new Date(product.updatedAt) : null;
  const productUpdatedAtLabel =
    productUpdatedAt && !Number.isNaN(productUpdatedAt.getTime())
      ? productUpdatedAt.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
      : 'Non précisé';
  const sellerFollowersCount = Number(product?.user?.followersCount || 0);
  const formattedSellerFollowers = sellerFollowersCount.toLocaleString('fr-FR');
  const sellerMemberSince = product?.user?.createdAt ? new Date(product.user.createdAt) : null;
  const sellerMemberSinceLabel =
    sellerMemberSince && !Number.isNaN(sellerMemberSince.getTime())
      ? sellerMemberSince.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      : 'Non précisé';
  const deliveryEtaLabel =
    String(product?.estimatedDeliveryTime || product?.deliveryEstimate || '').trim() ||
    (pickupOnly
      ? 'Retrait immédiat en boutique'
      : deliveryAvailable
        ? 'Délais confirmés par le vendeur'
        : 'Non disponible');
  const returnPolicyLabel =
    String(product?.returnPolicy || product?.returnPolicyText || '').trim() ||
    'Retours et échanges selon la politique du vendeur.';
  const warrantyPeriodUnitLabel =
    product?.warrantyPeriodUnit === 'days'
      ? Number(product?.warrantyPeriodValue) > 1
        ? 'jours'
        : 'jour'
      : product?.warrantyPeriodUnit === 'years'
        ? Number(product?.warrantyPeriodValue) > 1
          ? 'ans'
          : 'an'
        : 'mois';
  const warrantyLabel = product?.warrantyEnabled
    ? `${Number(product?.warrantyPeriodValue || 0)} ${warrantyPeriodUnitLabel} après achat`
    : String(product?.warranty || product?.warrantyInfo || '').trim() || 'Aucune garantie confirmée.';
  const sellerResponseRateRaw = Number(product?.user?.responseRate ?? product?.user?.replyRate ?? Number.NaN);
  const sellerResponseRateLabel = Number.isFinite(sellerResponseRateRaw)
    ? `${Math.max(0, Math.min(100, Math.round(sellerResponseRateRaw)))}%`
    : 'N/A';
  const sellerResponseTimeLabel = String(
    product?.user?.responseTime || product?.user?.averageResponseTime || ''
  ).trim();
  const productTags = useMemo(() => {
    if (Array.isArray(product?.tags)) {
      return product.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (typeof product?.tags === 'string') {
      return product.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    return [];
  }, [product?.tags]);
  const variantRows = useMemo(() => {
    const legacyVariants = Array.isArray(product?.variants)
      ? product.variants
      .map((variant, index) => {
        if (typeof variant === 'string') {
          const value = variant.trim();
          return value ? { label: `Variante ${index + 1}`, value } : null;
        }
        if (!variant || typeof variant !== 'object') return null;
        const label = String(variant?.name || variant?.label || `Variante ${index + 1}`).trim();
        if (Array.isArray(variant?.options)) {
          const options = variant.options
            .map((option) => String(option || '').trim())
            .filter(Boolean)
            .join(', ');
          return options ? { label, value: options } : null;
        }
        const value = String(variant?.value || '').trim();
        return value ? { label, value } : null;
      })
      .filter(Boolean)
      : [];
    const attributeVariants = productOptionDefinitions.map((attribute) => ({
      label: attribute.name,
      value:
        attribute.type === 'select'
          ? (attribute.options || []).join(', ')
          : attribute.type === 'number'
            ? 'Valeur numérique'
            : 'Texte libre'
    }));
    return [...legacyVariants, ...attributeVariants].slice(0, 8);
  }, [product?.variants, productOptionDefinitions]);
  const specificationRows = useMemo(
    () =>
      [
        { label: 'Condition', value: conditionLabel },
        { label: 'Catégorie', value: String(product?.category || '').trim() || 'Non précisée' },
        { label: 'Ville', value: sellerCity ? `${sellerCity}, ${sellerCountry}` : 'Non précisée' },
        { label: 'SKU', value: productSku || 'Non précisé' },
        { label: 'Stock', value: stockStatus.label },
        { label: 'Dernière mise à jour', value: productUpdatedAtLabel },
        ...physicalSpecRows
      ].filter((row) => Boolean(row.value)),
    [
      conditionLabel,
      product?.category,
      sellerCity,
      sellerCountry,
      productSku,
      stockStatus.label,
      productUpdatedAtLabel,
      physicalSpecRows
    ]
  );
  const isOptionSelectionBlocked = hasRequiredProductOptions && !selectedAttributeValidation.valid;
  const primaryCartButtonLabel = isPurchaseOutOfStock
    ? 'Rupture'
    : inCart
      ? 'Déjà au panier'
      : addingToCart
        ? 'Ajout...'
        : 'Ajouter au panier';
  const buyNowButtonLabel = isPurchaseOutOfStock
    ? 'Rupture'
    : inCart
    ? 'Passer la commande'
    : addingToCart
      ? 'Traitement...'
      : 'Acheter maintenant';

  const publishedDate = product?.createdAt ? new Date(product.createdAt) : null;
  const daysSince = publishedDate ? Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isNewProduct = daysSince <= 7;

  // Inject Cloudinary 800x800 square transform for consistent rendering
  const squareImageUrl = (url = '', size = 800) => {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
    return url.replace('/upload/', `/upload/c_fill,g_auto,w_${size},h_${size},q_auto,f_auto/`);
  };

  const thumbImageUrl = (url = '') => squareImageUrl(url, 300);

  const galleryImages = useMemo(() => {
    const base = Array.isArray(product?.images) ? product.images : [];
    const cleaned = base
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    // Images first, then video at the end if present
    const items = cleaned.slice(0, 10).map((src) => ({ type: 'image', src: squareImageUrl(src) }));
    if (product?.video && String(product.video).trim()) {
      items.push({ type: 'video', src: String(product.video).trim() });
    }
    return items;
  }, [product?.images, product?.video]);
  const socialVideo = useMemo(() => parseSocialVideo(product?.socialVideoUrl), [product?.socialVideoUrl]);
  const shopGalleryImages = useMemo(() => {
    const pool = [];
    shopGalleryProducts.forEach((shopProduct) => {
      const images = Array.isArray(shopProduct?.images) ? shopProduct.images : [];
      images.forEach((src, imgIndex) => {
        if (!src) return;
        pool.push({ src: squareImageUrl(src), product: shopProduct, imageIndex: imgIndex });
      });
    });
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 6);
  }, [shopGalleryProducts]);
  const isShopVerified = Boolean(product?.user?.shopVerified);
  const shareLink = useMemo(() => {
    if (!product) return window.location.href;
    return buildProductShareUrl(product);
  }, [product]);

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: product?.title || 'Produit HDMarket',
          text: `${product?.title} - ${formatPriceWithStoredSettings(product?.price || 0)}`,
          url: shareLink,
        });
      } catch (_) {
        // User cancelled or error
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareLink);
        setShareFeedback("Lien copié !");
        setTimeout(() => setShareFeedback(""), 2500);
      } catch (_) {
        setShareMenuOpen(true);
      }
    }
  }, [product?.title, product?.price, shareLink]);

  useEffect(() => {
    if (!galleryImages.length) {
      if (selectedImage !== 0) setSelectedImage(0);
      return;
    }
    if (selectedImage >= galleryImages.length) {
      setSelectedImage(0);
    }
  }, [galleryImages.length, selectedImage]);

  const safeSelectedImage = galleryImages.length > 0 ? Math.min(selectedImage, galleryImages.length - 1) : 0;
  const displayedImage = galleryImages[safeSelectedImage]?.src || "https://via.placeholder.com/600x600";
  const isDisplayedVideo = galleryImages[safeSelectedImage]?.type === 'video';
  const displayedVideoSrc = isDisplayedVideo ? galleryImages[safeSelectedImage]?.src : '';
  const imageCursorClass = "cursor-pointer";
  const hasMultipleGalleryImages = galleryImages.length > 1;
  const mobileMainGalleryImageClass = hasMultipleGalleryImages
    ? "h-full w-full object-contain bg-white"
    : "h-full w-full object-cover";
  const desktopMainGalleryImageClass = "h-full w-full object-contain bg-white";
  const desktopGalleryLayoutClass = hasMultipleGalleryImages
    ? "grid gap-3 lg:grid-cols-[84px_minmax(0,1fr)]"
    : "grid gap-0";
  const desktopMainFrameClass = hasMultipleGalleryImages
    ? "relative lg:aspect-square aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm"
    : "relative min-h-[430px] sm:min-h-[520px] lg:min-h-[640px] overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm";

  const openImageModal = useCallback((index = selectedImage) => {
    setSelectedImage(index);
    setIsImageModalOpen(true);
  }, [selectedImage]);

  const closeImageModal = useCallback(() => {
    setIsImageModalOpen(false);
  }, []);

  const handleImageClick = useCallback(() => {
    openImageModal(selectedImage);
  }, [openImageModal, selectedImage]);

  const handleZoomButtonClick = useCallback((event) => {
    event.stopPropagation();
    openImageModal(selectedImage);
  }, [openImageModal, selectedImage]);

  const handleThumbnailClick = useCallback((index) => {
    setSelectedImage(index);
  }, []);

  const goToPrevImage = useCallback(() => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const goToNextImage = useCallback(() => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev + 1) % galleryImages.length);
  }, [galleryImages.length]);

  const handleModalPrev = useCallback(() => {
    goToPrevImage();
  }, [goToPrevImage]);

  const handleModalNext = useCallback(() => {
    goToNextImage();
  }, [goToNextImage]);

  useEffect(() => {
    const swiper = mobileGallerySwiperRef.current;
    if (!swiper || typeof swiper.slideTo !== 'function') return;
    if (swiper.activeIndex === selectedImage) return;
    swiper.slideTo(selectedImage);
  }, [selectedImage]);

  // Keep the fullscreen viewer's swiper in sync when arrows/thumbnails change the
  // active image (the swiper reports back via onSlideChange).
  useEffect(() => {
    const swiper = modalSwiperRef.current;
    if (!isImageModalOpen || !swiper || typeof swiper.slideTo !== 'function') return;
    if (swiper.activeIndex === selectedImage) return;
    swiper.slideTo(selectedImage, 0);
  }, [selectedImage, isImageModalOpen]);

  const renderWholesaleSection = ({ compact = false } = {}) => {
    if (!wholesaleEnabled) return null;
    return (
      <div className={`rounded-2xl border border-neutral-200 bg-neutral-50 ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'}`}>
        <p className={`${compact ? 'text-xs' : 'text-sm'} font-black text-neutral-700`}>
          Vente en gros disponible
        </p>

        <div className={`mt-2 grid ${compact ? 'grid-cols-[auto_1fr_auto] gap-2' : 'grid-cols-[auto_1fr_auto] gap-3'} items-center`}>
          <button
            type="button"
            onClick={decreaseQuantity}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-transform active:scale-95"
            aria-label="Diminuer la quantité"
          >
            -
          </button>
          <div className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-1.5">
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-500`}>Quantité</span>
            <input
              type="number"
              min="1"
              value={selectedQuantity}
              onChange={(event) => updateSelectedQuantity(event.target.value)}
              className={`w-16 border-0 bg-transparent p-0 text-center font-semibold text-neutral-900 focus:outline-none focus:ring-0 ${compact ? 'text-sm' : 'text-base'}`}
            />
          </div>
          <button
            type="button"
            onClick={increaseQuantity}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-700 transition-transform active:scale-95"
            aria-label="Augmenter la quantité"
          >
            +
          </button>
        </div>

        <p className={`mt-2 ${compact ? 'text-[11px]' : 'text-xs'} text-neutral-700`}>
          Prix appliqué: <span className="font-semibold">{formatPriceWithStoredSettings(appliedUnitPrice)}</span> / unité
          {activeWholesaleTier ? (
            <span className="ml-1 text-neutral-500">(à partir de {activeWholesaleTier.minQty} unités)</span>
          ) : (
            <span className="ml-1 text-neutral-500">(prix standard)</span>
          )}
        </p>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-700`}>
          Total pour {normalizedQuantity} unité{normalizedQuantity > 1 ? 's' : ''}:{' '}
          <span className="font-semibold">{formatPriceWithStoredSettings(computedLineTotal)}</span>
        </p>
        {wholesaleSavingsAmount > 0 && (
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-700`}>
            Économie: <span className="font-semibold">{formatPriceWithStoredSettings(wholesaleSavingsAmount)}</span>
            {' '}({wholesaleSavingsPercent}%)
          </p>
        )}

        <div className="mt-2 border-t border-neutral-200 pt-2 space-y-1">
          {wholesaleTiers.map((tier, index) => {
            const nextTier = wholesaleTiers[index + 1];
            const rangeLabel = nextTier ? `${tier.minQty}-${nextTier.minQty - 1}` : `${tier.minQty}+`;
            return (
              <p key={`tier-${tier.minQty}-${index}`} className={`${compact ? 'text-[11px]' : 'text-xs'} text-neutral-600`}>
                {tier.label ? `${tier.label}:` : `À partir de ${tier.minQty} unités (${rangeLabel})`}
                {' '}<span className="font-semibold text-neutral-800">{formatPriceWithStoredSettings(tier.unitPrice)}</span> / unité
              </p>
            );
          })}
        </div>
      </div>
    );
  };


  // 🏗️ AFFICHAGE DU CHARGEMENT
  if (loading) {
    if (isMobileView) {
      return (
        <div className="min-h-screen bg-gray-50">
          <div className="animate-pulse">
            <div className="w-full aspect-square bg-gray-200" />
            <div className="p-4 space-y-3">
              <div className="h-7 bg-gray-200 rounded w-2/5" />
              <div className="h-5 bg-gray-200 rounded w-4/5" />
              <div className="h-4 bg-gray-200 rounded w-3/5" />
              <div className="flex gap-2">
                <div className="h-8 bg-gray-200 rounded-full w-16" />
                <div className="h-8 bg-gray-200 rounded-full w-24" />
                <div className="h-8 bg-gray-200 rounded-full w-14" />
              </div>
              <div className="h-16 bg-gray-200 rounded-2xl" />
              <div className="h-12 bg-gray-200 rounded-2xl" />
              <div className="h-12 bg-gray-200 rounded-2xl" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="flex items-center space-x-2 mb-6">
              <div className="h-4 bg-gray-300 rounded w-24"></div>
              <ChevronRight size={16} className="text-gray-400" />
              <div className="h-4 bg-gray-300 rounded w-32"></div>
            </div>
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="aspect-square bg-gray-300 rounded-2xl"></div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-square bg-gray-300 rounded-xl"></div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-300 rounded w-3/4"></div>
                <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                <div className="h-12 bg-gray-300 rounded w-1/3"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ❌ AFFICHAGE ERREUR
  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Produit non trouvé</h2>
          <p className="text-gray-600 mb-6">
            {error || "Le produit que vous recherchez n'existe pas ou a été supprimé."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-neutral-900 text-white font-semibold rounded-2xl hover:bg-neutral-800 transition-all"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  // Facebook / TikTok video embed — shown on both mobile and desktop renders.
  const renderSocialVideoSection = ({ rounded = 'rounded-2xl' } = {}) => {
    if (!socialVideo) return null;
    const providerLabel = socialVideo.provider === 'tiktok' ? 'TikTok' : 'Facebook';
    const brandClass = socialVideo.provider === 'tiktok' ? 'bg-black' : 'bg-[#1877F2]';
    return (
      <div className={`overflow-hidden ${rounded} border border-gray-200 bg-white shadow-sm`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 className="text-[17px] font-black text-gray-900">
            Vidéo {providerLabel}
          </h2>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white ${brandClass}`}>
            <Video size={11} /> {providerLabel}
          </span>
        </div>
        {socialVideo.embeddable ? (
          <div className={socialVideo.provider === 'tiktok' ? 'bg-black' : 'bg-black p-1.5'}>
            <iframe
              src={socialVideo.embedUrl}
              title={`Vidéo ${providerLabel}`}
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
              scrolling="no"
              className={
                socialVideo.provider === 'tiktok'
                  ? 'mx-auto block h-[70vh] max-h-[720px] w-full max-w-[420px] border-0'
                  : 'aspect-video w-full rounded-xl border-0'
              }
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 bg-gray-50 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#e85d00] shadow-sm">
              <Video size={22} />
            </span>
            <p className="text-sm font-semibold text-gray-700">Aperçu indisponible ici</p>
            <p className="text-xs text-gray-500">Ouvrez la vidéo {providerLabel} via le lien ci-dessous.</p>
          </div>
        )}

        {/* Direct link — kept pinned below the player so it stays visible while watching or after rewatching */}
        <a
          href={socialVideo.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3 transition hover:bg-gray-100"
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${brandClass}`}>
            <ExternalLink size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-black text-gray-900">Ouvrir sur {providerLabel}</span>
            <span className="block truncate text-[11px] text-gray-500">{socialVideo.originalUrl}</span>
          </span>
          <span className="shrink-0 rounded bg-white px-2 py-1 text-[11px] font-black text-[#e85d00] shadow-sm">
            Ouvrir
          </span>
        </a>
      </div>
    );
  };

  // === MOBILE — TAOBAO DESIGN SYSTEM ===
  const renderMobileProductDetails = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="product-detail-page min-h-screen bg-[#f5f5f5] pb-32 dark:bg-neutral-950"
    >
      {/* ── STICKY HEADER ── */}
      <header className="bg-white border-b border-gray-100 dark:border-neutral-800 dark:bg-neutral-950">
        <div
          className="flex items-center justify-between gap-2 px-3 py-2.5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
        >
          <button type="button" onClick={handleBackNavigation}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-800 active:scale-95 dark:bg-neutral-800 dark:text-neutral-100"
            aria-label="Retour">
            <ArrowLeft size={18} />
          </button>
          <button type="button" onClick={() => navigate(`/products?search=${encodeURIComponent(product.title || '')}`)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-left text-sm text-gray-400 mx-2">
            <Search size={15} className="flex-shrink-0" />
            <span className="truncate text-[13px]">{product.title}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handleNativeShare}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-700 active:scale-95"
              aria-label="Partager">
              <Share2 size={16} />
            </button>
            <Link to="/cart"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-700 active:scale-95"
              aria-label="Panier">
              <ShoppingCart size={16} />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-[#e85d00] px-1 text-center text-[9px] font-black text-white leading-4">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── GALLERY ── */}
      <section className="bg-white">
        <div className="relative overflow-hidden bg-white">
          {galleryImages.length > 1 ? (
            <Swiper
              modules={[Pagination]}
              pagination={{ clickable: true }}
              onSwiper={(swiper) => { mobileGallerySwiperRef.current = swiper; }}
              spaceBetween={0}
              slidesPerView={1}
              onSlideChange={(swiper) => setSelectedImage(swiper.activeIndex)}
              className="w-full aspect-square"
            >
              {galleryImages.map((item, index) => (
                <SwiperSlide key={item.src || index}>
                  {item.type === 'video' ? (
                    <video src={item.src} controls playsInline preload="metadata"
                      poster={galleryImages.find((g) => g.type === 'image')?.src}
                      className={mobileMainGalleryImageClass} onClick={(e) => e.stopPropagation()} />
                  ) : (
                    <img src={item.src} alt={`${product.title} - ${index + 1}`}
                      className={mobileMainGalleryImageClass} onClick={() => openImageModal(index)} />
                  )}
                </SwiperSlide>
              ))}
            </Swiper>
          ) : (
            <div className="w-full aspect-square bg-white" onClick={() => openImageModal(0)}>
              {galleryImages[0]?.type === 'video' ? (
                <video src={galleryImages[0].src} controls playsInline preload="metadata"
                  className={mobileMainGalleryImageClass} onClick={(e) => e.stopPropagation()} />
              ) : (
                <img src={galleryImages[0]?.src || "https://via.placeholder.com/600x600"}
                  alt={product.title} className={mobileMainGalleryImageClass} />
              )}
            </div>
          )}

          {/* Overlay badges */}
          <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
            {hasDiscount && (
              <span className="rounded bg-[#e85d00] px-2 py-0.5 text-xs font-black text-white shadow">
                -{discountPercentage}%
              </span>
            )}
            {isNewProduct && (
              <span className="rounded bg-[#0a0a0a] px-2 py-0.5 text-xs font-black text-white shadow">
                Nouveau
              </span>
            )}
          </div>
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5">
            <button type="button" onClick={handleZoomButtonClick}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white active:scale-95"
              aria-label="Agrandir">
              <ZoomIn size={18} />
            </button>
          </div>
          {galleryImages.length > 1 && (
            <span className="absolute bottom-3 right-3 z-20 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">
              {selectedImage + 1}/{galleryImages.length}
            </span>
          )}
          {galleryImages.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToPrevImage(); }}
                className="absolute left-2 top-1/2 z-20 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white active:scale-95">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); goToNextImage(); }}
                className="absolute right-2 top-1/2 z-20 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white active:scale-95">
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
        {/* Thumbnail rail */}
        {galleryImages.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-t border-gray-50">
            {galleryImages.map((item, index) => (
              <button key={`thumb-${item.src || index}`} type="button"
                onClick={() => setSelectedImage(index)}
                className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 transition-all ${selectedImage === index ? 'border-[#e85d00]' : 'border-transparent opacity-55 hover:opacity-80'}`}>
                {item.type === 'video' ? (
                  <>
                    <img src={galleryImages.find((g) => g.type === 'image')?.src || ''} alt="Vidéo" className="h-full w-full object-contain bg-white" loading="lazy" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </span>
                  </>
                ) : (
                  <img src={item.src} alt="" className="h-full w-full object-contain bg-white" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-2 bg-[#f5f5f5]" />

      {/* ── PRIMARY PRODUCT INFORMATION ── */}
      <section className="bg-white px-4 pt-3.5 pb-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[28px] font-black text-neutral-950 leading-tight">
            {formatPriceWithStoredSettings(finalPrice)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm text-gray-400 line-through">
                {formatPriceWithStoredSettings(originalPrice)}
              </span>
              <span className="rounded-full bg-[#fff0e4] px-2.5 py-1 text-[11px] font-black text-[#c2410c]">
                Économisez {formatPriceWithStoredSettings(originalPrice - finalPrice)}
              </span>
            </>
          )}
        </div>
        <h1 className="mt-2 text-[17px] font-black leading-snug text-[#231f1b]">{product.title}</h1>
        <div className="mt-2 flex items-center gap-2.5 text-[11px] text-[#8a8378]">
          <span className="flex items-center gap-1"><Star size={12} className="fill-[#e85d00] text-[#e85d00]" /><strong className="text-[#44403a]">{ratingAverage}</strong> ({ratingCount})</span>
          <span>·</span><span>{formattedTotalOrdersQty} ventes</span>
        </div>
        {installmentOffer.available && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#f7f4ef] px-3 py-2">
            <Clock size={14} className="text-[#e85d00]" />
            <span className="text-[11px] font-semibold text-[#e85d00]">
              Payable en tranches dès {formatPriceWithStoredSettings(installmentOffer.minAmount || 0)} sur {installmentOffer.duration || 0} jours
            </span>
          </div>
        )}
        {wholesaleEnabled && <div className="mt-2">{renderWholesaleSection({ compact: true })}</div>}
      </section>

      {/* ── REASSURANCE ── */}
      <section className="bg-white px-4 pt-3 pb-4">
        <div className="flex flex-col gap-2.5 text-[12px] font-semibold text-[#6b6459]">
          <span className="inline-flex items-center gap-2">
            <Truck size={12} /> {freeDeliveryAvailable ? 'Livraison gratuite' : pickupOnly ? 'Retrait boutique' : deliveryAvailable ? 'Livraison disponible' : 'Retrait uniquement'}
          </span>
          <span className="inline-flex items-center gap-2">
            <Shield size={12} /> Paiement sécurisé{product.warrantyEnabled ? ` · Garantie ${Number(product.warrantyPeriodValue || 0)}${warrantyPeriodUnitLabel}` : ''}{product.certified ? ' · Certifié HDMarket' : ''}
          </span>
          <span className="inline-flex items-center gap-2 font-bold text-[#047857]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{stockStatus.label}
          </span>
        </div>
      </section>

      {socialVideo && (
        <>
          <div className="h-2 bg-[#f5f5f5]" />
          <section className="bg-[#f5f5f5] px-3 py-3">
            {renderSocialVideoSection({ rounded: 'rounded-xl' })}
          </section>
        </>
      )}

      {/* ── DIVIDER ── */}
      <div className="h-2 bg-[#f5f5f5]" />

      {/* ── PRODUCT OPTIONS ── */}
      {hasProductOptions && (
        <>
          <section id="product-purchase-options-mobile" className={`px-4 pt-3.5 pb-4 transition-colors ${isOptionSelectionBlocked ? 'bg-[#FFF7ED]' : 'bg-white'}`}>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[17px] font-black text-gray-900">Options du produit</h3>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Vous pouvez sélectionner plusieurs choix.</p>
              </div>
              {hasRequiredProductOptions && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                    selectedAttributeValidation.valid
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'animate-pulse bg-[#e85d00] text-white'
                  }`}
                >
                  {selectedAttributeValidation.valid ? (
                    <>
                      <Check size={11} /> Prêt
                    </>
                  ) : (
                    'À choisir'
                  )}
                </span>
              )}
            </div>
            <div className="space-y-4">
              {productOptionDefinitions.map((attribute) => {
                const selectedValue = normalizedSelectedAttributes.find(
                  (e) => e.name.toLowerCase() === attribute.name.toLowerCase()
                )?.value || '';
                const selectedValues = attribute.type === 'select'
                  ? getSelectedOptionValues(attribute)
                  : selectedValue ? [selectedValue] : [];
                const isColor = isColorAttribute(attribute);
                return (
                  <div key={`mob-opt-${attribute.key || attribute.name}`}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                      <span>{attribute.name}{isProductAttributeSelectionRequired(attribute) && <span className="ml-0.5 text-[#e85d00]">*</span>}</span>
                      {selectedValues.length ? (
                        <span className="rounded bg-[#FFF0E4] px-1.5 py-0.5 font-black text-[#e85d00]">{selectedValues.join(', ')}</span>
                      ) : isProductAttributeSelectionRequired(attribute) ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-700">À choisir</span>
                      ) : null}
                    </p>
                    {attribute.type === 'select' && attribute.optionImages ? (
                      /* Variantes par photo (style Taobao) : une tuile image par option */
                      <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
                        {(Array.isArray(attribute.options) ? attribute.options : []).map((option) => {
                          const active = selectedValues.some((value) => value.toLowerCase() === String(option).toLowerCase());
                          const optionKey = String(option).trim().toLowerCase();
                          const optionPrice = attribute.optionPrices?.[optionKey];
                          const optionUnavailable = Boolean(attribute.optionOutOfStock?.[optionKey]);
                          const optionImageIdx = attribute.optionImages?.[optionKey];
                          const optionThumb = Number.isInteger(optionImageIdx)
                            ? product?.images?.[optionImageIdx] || ''
                            : '';
                          return (
                            <button key={`${attribute.name}-${option}`} type="button"
                              onClick={() => handleAttributeValueChange(attribute, option)}
                              className={`overflow-hidden rounded-lg border-2 text-left transition-all active:scale-[0.97] ${active
                                ? 'border-[#e85d00] ring-1 ring-orange-200'
                                : 'border-gray-200'}`}
                              aria-pressed={active}>
                              <div className="relative aspect-square bg-gray-100">
                                {optionThumb ? (
                                  <img src={optionThumb} alt={option} className="h-full w-full object-cover" loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xl font-black text-gray-300">
                                    {String(option).charAt(0).toUpperCase()}
                                  </div>
                                )}
                                {optionUnavailable ? (
                                  <span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-center text-[9px] font-black uppercase text-white">
                                    Rupture
                                  </span>
                                ) : null}
                              </div>
                              <div className={`px-1.5 py-1 ${active ? 'bg-[#fff0e4]' : 'bg-white'}`}>
                                <p className={`truncate text-[11px] font-bold ${active ? 'text-[#e85d00]' : 'text-gray-700'}`}>
                                  {option}
                                </p>
                                {Number.isFinite(optionPrice) && optionPrice > 0 ? (
                                  <p className="truncate text-[11px] font-black text-[#e85d00]">
                                    {formatPriceWithStoredSettings(optionPrice)}
                                  </p>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : attribute.type === 'select' ? (
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(attribute.options) ? attribute.options : []).map((option) => {
                          const active = selectedValues.some((value) => value.toLowerCase() === String(option).toLowerCase());
                          const swatch = isColor ? resolveSwatchColor(option) : '';
                          const optionPrice = attribute.optionPrices?.[String(option).trim().toLowerCase()];
                          return (
                            <button key={`${attribute.name}-${option}`} type="button"
                              onClick={() => handleAttributeValueChange(attribute, option)}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${active
                                ? 'border-[#e85d00] bg-[#fff0e4] text-[#e85d00]'
                                : 'border-gray-200 bg-white text-gray-700'}`}>
                              {swatch && (
                                <span
                                  className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-inner"
                                  style={{ background: swatch }}
                                />
                              )}
                              {option}
                              {Number.isFinite(optionPrice) && optionPrice > 0 ? (
                                <span className={`text-[11px] font-black ${active ? 'text-[#e85d00]' : 'text-gray-500'}`}>
                                  {formatPriceWithStoredSettings(optionPrice)}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input type={attribute.type === 'number' ? 'number' : 'text'}
                        value={selectedValue}
                        onChange={(e) => handleAttributeValueChange(attribute, e.target.value)}
                        className="min-h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-[#e85d00] focus:outline-none"
                        placeholder={`Ex: ${attribute.name}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {selectedAttributesSummary.length > 0 && (
              <SelectedAttributesList selectedAttributes={selectedAttributesSummary} className="mt-3" />
            )}
            {(selectionError || selectedOptionStockMessage || isOptionSelectionBlocked) && (
              <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {selectionError || selectedOptionStockMessage || 'Veuillez sélectionner les options obligatoires.'}
              </p>
            )}
          </section>
          <div className="h-2 bg-[#f5f5f5]" />
        </>
      )}

      {/* ── SELLER CARD ── */}
      {product.user && (
        <>
          <section className="bg-white px-4 py-3.5">
            <div className="flex items-center gap-3">
              {shopLogo ? (
                <img src={shopLogo} alt={shopName || product.user.name}
                  className="h-12 w-12 flex-shrink-0 rounded-lg border border-gray-200 object-cover" />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#0a0a0a]">
                  <Store className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-black text-gray-900">{shopName || product.user.name}</span>
                  {isProfessional && <VerifiedBadge verified={isShopVerified} showLabel={false} />}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-gray-500">{formattedSellerFollowers} abonnés</span>
                  {sellerCity && <span className="text-[11px] text-gray-400">· {sellerCity}</span>}
                </div>
              </div>
              {isProfessional && !isOwnProduct && isShopVerified && (
                <button type="button" onClick={handleFollowToggle} disabled={followLoading}
                  className={`flex min-h-11 flex-shrink-0 items-center rounded-full px-4 text-xs font-semibold border transition-all active:scale-95 ${isFollowingShop
                    ? 'border-gray-300 bg-white text-gray-700'
                    : 'border-[#e85d00] bg-[#fff0e4] text-[#e85d00]'}`}>
                  {followLoading ? '...' : isFollowingShop ? 'Abonné ✓' : 'Suivre'}
                </button>
              )}
            </div>
            {(sellerResponseTimeLabel || showPhone) && (
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
                {sellerResponseTimeLabel && (
                  <span className="flex items-center gap-1"><Clock size={11} /> Répond en {sellerResponseTimeLabel}</span>
                )}
                {showPhone && (
                  <a href={`tel:${(phoneNumber || '').replace(/\s+/g, '')}`} className="flex items-center gap-1 text-[#e85d00] font-semibold">
                    <Phone size={11} /> {phoneNumber}
                  </a>
                )}
              </div>
            )}
            {canOpenShopProfile && (
              <Link to={buildShopPath(shopIdentifier)}
                className="mt-3 flex min-h-11 items-center justify-center gap-2 w-full rounded-full bg-[#f7f4ef] text-gray-900 text-xs font-bold active:scale-[0.98] transition-transform">
                <Store size={13} /> Voir la boutique
              </Link>
            )}
          </section>
          <div className="h-2 bg-[#f5f5f5]" />
        </>
      )}

      {/* ── TAB BAR (sticky) ── */}
      <div className="bg-white border-b border-gray-100">
        <div className="flex">
          {[
            { key: 'description', label: 'Description' },
            { key: 'specifications', label: 'Spécifications' },
            { key: 'reviews', label: `Avis (${commentCount})` },
            { key: 'questions', label: `Questions (${questionCount})` },
          ].map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              className={`min-h-11 flex-1 py-3 text-[13px] font-semibold transition-colors ${activeTab === key
                ? 'text-gray-950 border-b-2 border-[#e85d00]'
                : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="bg-white px-4 py-4 min-h-[200px]">
        {/* Description tab */}
        {activeTab === 'description' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
            {/* Delivery details */}
            <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Livraison & Retours</h4>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Truck size={13} className="mt-0.5 flex-shrink-0 text-[#e85d00]" />
                <span>{deliveryPrimaryLabel} · {deliverySecondaryLabel}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Clock size={13} className="mt-0.5 flex-shrink-0 text-gray-400" />
                <span>Délai estimé: {deliveryEtaLabel}</span>
              </div>
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Shield size={13} className="mt-0.5 flex-shrink-0 text-gray-400" />
                <span>Retour: {returnPolicyLabel} · Garantie: {warrantyLabel}</span>
              </div>
            </div>
            {product.confirmationNumber && (
              <p className="text-xs text-gray-400">Code produit: <span className="font-semibold text-gray-700">{product.confirmationNumber}</span></p>
            )}
            {productTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {productTags.map((tag) => (
                  <span key={`tab-tag-${tag}`} className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-600">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Specifications tab */}
        {activeTab === 'specifications' && (
          <div className="space-y-0 divide-y divide-gray-50">
            {specificationRows.map((row) => (
              <div key={`tab-spec-${row.label}`} className="flex items-start justify-between gap-4 py-3 text-sm">
                <span className="text-gray-500 flex-shrink-0 w-32">{row.label}</span>
                <span className="font-semibold text-gray-900 text-right">{row.value}</span>
              </div>
            ))}
            {variantRows.length > 0 && (
              <div className="pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Variantes disponibles</p>
                <div className="space-y-2">
                  {variantRows.map((variant) => (
                    <div key={`tab-var-${variant.label}`} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-gray-500">{variant.label}</span>
                      <span className="font-semibold text-gray-800 text-right">{variant.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Rating summary */}
            <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
              <div className="text-center">
                <p className="text-4xl font-black text-[#e85d00]">{ratingAverage}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={13} className={s <= Math.floor(Number(ratingAverage)) ? 'fill-[#e85d00] text-[#e85d00]' : 'text-gray-200'} />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">{ratingCount} avis</p>
              </div>
              <div className="flex-1 space-y-1">
                {[5,4,3,2,1].map((s) => {
                  const pct = ratingCount > 0 ? Math.round((comments.filter(c => Math.round(Number(c.rating || 0)) === s).length / Math.max(1, ratingCount)) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span className="w-3 text-right">{s}</span>
                      <Star size={10} className="fill-[#e85d00] text-[#e85d00]" />
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#e85d00]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Rate + Comment input */}
            {user && !isOwnProduct && (
              <div className="rounded border border-gray-100 bg-gray-50 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Votre note:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => handleSubmitRating(star)} disabled={submittingRating} className="focus:outline-none">
                      <Star size={20} className={star <= userRating ? 'fill-[#e85d00] text-[#e85d00]' : 'text-gray-300'} />
                    </button>
                  ))}
                  {submittingRating && <span className="text-xs text-gray-400 ml-1">...</span>}
                </div>
                <form onSubmit={handleSubmitComment} className="flex gap-2">
                  <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Écrire un avis..." disabled={submittingComment}
                    className="flex-1 min-w-0 rounded border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#e85d00] focus:outline-none" />
                  <button type="submit" disabled={submittingComment || !newComment.trim()}
                    className="rounded bg-[#e85d00] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                    {submittingComment ? '...' : 'Envoyer'}
                  </button>
                </form>
                {commentError && <p className="text-xs text-red-600">{commentError}</p>}
              </div>
            )}
            {!user && (
              <p className="text-xs text-gray-400">
                <Link to="/login" className="text-[#e85d00] font-semibold">Connectez-vous</Link> pour noter ou commenter.
              </p>
            )}
            {commentsLoading && comments.length === 0 && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded border border-gray-100 bg-gray-50 p-3 animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-7 w-7 rounded-full bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                    </div>
                    <div className="h-3 rounded bg-gray-200 w-full" />
                  </div>
                ))}
              </div>
            )}
            {comments.length > 0 && (
              <div className="space-y-3">
                {comments.slice(0, 3).map((comment) => (
                  <div key={comment._id} className="rounded border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {resolveUserProfileImage(comment?.user) ? (
                          <img src={resolveUserProfileImage(comment.user)} alt={comment.user?.name || 'U'}
                            className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                            {String(comment.user?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-semibold text-gray-800">{comment.user?.name || 'Utilisateur'}</span>
                      </div>
                      <span className="text-[11px] text-gray-400">{new Date(comment.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">{comment.message}</p>
                  </div>
                ))}
                {comments.length > 3 && (
                  <button type="button" onClick={() => setIsReviewsModalOpen(true)}
                    className="w-full rounded border border-gray-200 py-2.5 text-xs font-semibold text-[#e85d00]">
                    Voir les {comments.length} avis
                  </button>
                )}
              </div>
            )}
            {comments.length === 0 && !commentsLoading && (
              <p className="text-xs text-gray-400 text-center py-4">Aucun avis pour ce produit.</p>
            )}
          </div>
        )}

        {/* Questions tab */}
        {activeTab === 'questions' && (
          <ProductQuestionsSection productId={product._id} onCountChange={setQuestionCount} />
        )}
      </div>

      {/* ── DIVIDER ── */}
      <div className="h-2 bg-[#f5f5f5]" />

      {/* ── SHOP GALLERY ── */}
      {canOpenShopProfile && (
        <section className="bg-white px-4 pt-3.5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <Link
              to={`${buildShopPath(shopIdentifier)}#products`}
              {...externalLinkProps}
              className="text-[17px] font-black text-gray-900 transition-colors hover:text-[#e85d00]"
            >
              Autres articles de la boutique
            </Link>
            <Link
              to={`${buildShopPath(shopIdentifier)}#products`}
              {...externalLinkProps}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#e85d00]"
            >
              Voir tout
              <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {shopGalleryImages.length > 0
              ? shopGalleryImages.map((image) => (
                  <Link key={`${image.product?._id || 'shop'}-${image.src}`}
                    to={`${buildProductPath(image.product)}?image=${image.imageIndex}`} {...externalLinkProps}
                    className="aspect-square overflow-hidden rounded border border-gray-100 bg-gray-50">
                    <img src={image.src} alt={image.product?.title || 'Boutique'} className="w-full h-full object-cover" loading="lazy" />
                  </Link>
                ))
              : Array.from({ length: 3 }).map((_, i) => (
                  <div key={`shop-skel-${i}`} className="aspect-square rounded border border-gray-100 bg-gray-100 animate-pulse" />
                ))
            }
          </div>
        </section>
      )}

      {/* ── GROUP BUY ── */}
      {groupBuyingEnabled && product?._id && (
        <>
          <div className="h-2 bg-[#f5f5f5]" />
          <section className="bg-white px-4 py-4">
            <GroupBuySection productId={product._id} enabled={groupBuyingEnabled} />
          </section>
        </>
      )}

      {/* ── BUNDLE DEALS ── */}
      {bundleData && bundleData.bundle && bundleData.bundle.length > 0 && (
        <>
          <div className="h-2 bg-[#f5f5f5]" />
          <section className="bg-white px-4 py-4">
            <BundleDeal bundleData={bundleData}
              onAddAll={async (items) => { for (const item of items) await addItem(item._id, 1); }} />
          </section>
        </>
      )}

      {/* ── DIVIDER ── */}
      <div className="h-2 bg-[#f5f5f5]" />

      {/* ── RELATED PRODUCTS ── */}
      {(relatedLoading || relatedProducts.length > 0) && (
        <section className="bg-white pt-3.5 pb-4">
          <div className="flex items-center justify-between px-4 mb-3">
            <h3 className="text-[17px] font-black text-gray-900">Recommandé pour vous</h3>
            <Link to={`/products?category=${product.category}`} className="text-xs font-semibold text-[#e85d00]">Voir tout</Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {relatedLoading && relatedProducts.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={`rskel-${i}`} className="flex-shrink-0 w-32 rounded border border-gray-100 bg-white overflow-hidden">
                    <div className="aspect-square bg-gray-100 animate-pulse" />
                    <div className="p-2 space-y-1.5">
                      <div className="h-2.5 rounded bg-gray-100 animate-pulse" />
                      <div className="h-2.5 w-2/3 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))
              : relatedProducts.map((rp) => (
                  <Link key={rp._id} to={buildProductPath(rp)} {...externalLinkProps}
                    className="flex-shrink-0 w-32 rounded border border-gray-100 bg-white overflow-hidden active:scale-[0.97] transition-transform">
                    <div className="aspect-square bg-gray-50 overflow-hidden">
                      <img src={thumbImageUrl(rp.images?.[0])} alt={rp.title} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-gray-800 line-clamp-2 mb-1">{rp.title}</p>
                      <p className="text-xs font-black text-neutral-950">{formatPriceWithStoredSettings(rp.price)}</p>
                    </div>
                  </Link>
                ))
            }
          </div>
        </section>
      )}

      {/* ── PDF ── */}
      {product?.pdf && (
        <>
          <div className="h-2 bg-[#f5f5f5]" />
          <section className="bg-white px-4 py-4">
            <h3 className="text-[17px] font-black text-gray-900 mb-3">Document joint</h3>
            <img src={product.pdf} alt={`Document ${product.title || ''}`} className="w-full h-auto rounded border border-gray-100" loading="lazy" />
          </section>
        </>
      )}

      {/* ── INQUIRY / CONTACT ── */}
      {!isOwnProduct && (
        <>
          <div className="h-2 bg-[#f5f5f5]" />
          <section className="bg-white px-4 py-4">
            {user ? (
              <>
                <button type="button" disabled={inquiryLoading}
                  onClick={async () => {
                    if (!product?._id) return;
                    setInquiryError('');
                    setInquiryLoading(true);
                    try {
                      const { data } = await api.post('/orders/inquiry', { productId: product._id });
                      setInquiryOrder(data);
                    } catch (err) {
                      setInquiryError(err.response?.data?.message || "Impossible d'ouvrir la conversation.");
                    } finally {
                      setInquiryLoading(false);
                    }
                  }}
                  className="flex items-center justify-center gap-2 w-full rounded border border-gray-200 bg-gray-50 py-3 text-sm font-medium text-gray-700 active:scale-[0.98] transition-all disabled:opacity-60">
                  <MessageCircle className="w-4 h-4 flex-shrink-0 text-[#e85d00]" />
                  <span>{inquiryLoading ? 'Ouverture...' : 'Des questions ? Contacter le vendeur'}</span>
              </button>
              {inquiryError && <p className="text-xs text-red-600 mt-1.5">{inquiryError}</p>}
            </>
          ) : (
            <Link to="/login" state={{ from: { pathname: `/product/${product?.slug || product?._id}` } }}
              className="flex items-center justify-center gap-2 w-full rounded border border-gray-200 bg-gray-50 py-3 text-sm font-medium text-gray-700 active:scale-[0.98] transition-all">
              <MessageCircle className="w-4 h-4 flex-shrink-0 text-[#e85d00]" />
              <span>Connectez-vous pour contacter le vendeur</span>
            </Link>
          )}
        </section>
      </>
      )}

      {/* ── DIVIDER ── */}
      <div className="h-2 bg-[#f5f5f5]" />

      {/* ── SHARE ── */}
      <section className="bg-white px-4 py-4">
        <h3 className="text-[17px] font-black text-gray-900 mb-3">Partager ce produit</h3>
        <div className="flex flex-wrap gap-2">
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#1877F2] text-white text-xs font-black active:scale-95">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`${product?.title || 'Produit'} - ${shareLink}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#25D366] text-white text-xs font-black active:scale-95">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#229ED9] text-white text-xs font-black active:scale-95">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </a>
          <button type="button"
            onClick={async () => {
              try { await navigator.clipboard.writeText(shareLink); setShareFeedback('Lien copié !'); }
              catch { setShareFeedback('Impossible de copier.'); }
              setTimeout(() => setShareFeedback(''), 2500);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-gray-100 text-gray-700 text-xs font-semibold active:scale-95">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copier
          </button>
        </div>
        {shareFeedback && <p className="mt-2 text-xs font-semibold text-gray-500">{shareFeedback}</p>}
      </section>

      {/* ── TAOBAO BOTTOM CTA BAR (fixed) ── */}
      {!isOwnProduct && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-stretch h-[58px]">
            {/* Chat / WhatsApp icon */}
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" onClick={handleWhatsappClick}
                className="flex w-14 flex-col items-center justify-center gap-0.5 border-r border-gray-100 text-gray-600 active:bg-gray-50">
                <MessageCircle size={19} />
                <span className="text-[10px] font-semibold">Chat</span>
              </a>
            ) : (
              <button type="button" onClick={() => setIsReviewsModalOpen(true)}
                className="flex w-14 flex-col items-center justify-center gap-0.5 border-r border-gray-100 text-gray-600 active:bg-gray-50">
                <Star size={19} />
                <span className="text-[10px] font-semibold">Avis</span>
              </button>
            )}
            {/* Favorite icon */}
            <button type="button" onClick={handleFavoriteToggle}
              className="flex w-14 flex-col items-center justify-center gap-0.5 border-r border-gray-100 active:bg-gray-50">
              <Heart size={19}
                className={isInFavorites ? 'text-[#e85d00]' : 'text-gray-600'}
                fill={isInFavorites ? 'currentColor' : 'none'} />
              <span className={`text-[10px] font-semibold ${isInFavorites ? 'text-[#e85d00]' : 'text-gray-600'}`}>
                {favoriteCount > 0 ? favoriteCount : 'Favori'}
              </span>
            </button>
            {/* Add to Cart + Buy Now */}
            <div className="flex flex-1 items-center gap-2 px-2">
              <button type="button" onClick={isOptionSelectionBlocked ? promptProductOptionSelection : handleAddToCart}
                disabled={addingToCart || inCart || isPurchaseOutOfStock}
                className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-black transition active:scale-[0.97] disabled:active:scale-100 ${inCart || isPurchaseOutOfStock
                  ? 'bg-gray-100 text-gray-400'
                  : 'border border-[#e85d00] bg-[#FFF0E4] text-[#e85d00]'}`}>
                <ShoppingCart size={16} className="flex-shrink-0" />
                <span className="truncate">{isOptionSelectionBlocked ? 'Choisir les options' : isPurchaseOutOfStock ? 'Rupture' : inCart ? 'Dans le panier' : 'Ajouter au panier'}</span>
              </button>
              <button type="button" onClick={isOptionSelectionBlocked ? promptProductOptionSelection : handleBuyNow}
                disabled={addingToCart || isPurchaseOutOfStock}
                className={`flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-black transition active:scale-[0.97] disabled:active:scale-100 ${isPurchaseOutOfStock
                  ? 'bg-gray-200 text-gray-400'
                  : isOptionSelectionBlocked
                    ? 'bg-black text-white'
                    : 'bg-[#e85d00] text-white shadow-sm'}`}>
                <Zap size={16} className="flex-shrink-0" fill="currentColor" />
                <span className="truncate">{isOptionSelectionBlocked ? 'Choisir' : isPurchaseOutOfStock ? 'Rupture' : inCart ? 'Commander' : addingToCart ? '...' : 'Acheter'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIANT PICKER SHEET (style Taobao "Tout") ── */}
      {isVariantSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
          <button type="button" aria-label="Fermer"
            onClick={() => setIsVariantSheetOpen(false)}
            className="absolute inset-0 bg-black/50" />
          <div className="relative flex max-h-[85vh] flex-col rounded-t-2xl bg-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Header : sélection courante + fermer */}
            <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
              <p className="min-w-0 text-sm font-black text-gray-900">
                {selectedAttributesSummary.length > 0 ? (
                  <>Sélectionné : «{selectedAttributesSummary.map((entry) => entry.value).join(' ; ')}»</>
                ) : (
                  'Choisissez vos options'
                )}
              </p>
              <button type="button" onClick={() => setIsVariantSheetOpen(false)}
                className="flex-shrink-0 rounded-full p-1 text-gray-500 active:scale-95" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            {/* Aperçu : photo courante + prix + quantité */}
            <div className="flex items-start gap-3 border-b border-gray-100 px-4 pb-3">
              <button type="button" onClick={() => openImageModal(selectedImage)}
                className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 active:scale-[0.97]"
                aria-label="Agrandir la photo">
                <img
                  src={
                    galleryImages[selectedImage]?.type === 'image'
                      ? galleryImages[selectedImage]?.src
                      : galleryImages.find((g) => g.type === 'image')?.src || product?.images?.[0] || ''
                  }
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-[#e85d00]">
                    {formatPriceWithStoredSettings(appliedUnitPrice)}
                  </span>
                  {hasDiscount && Number(originalPrice) > appliedUnitPrice ? (
                    <span className="text-xs text-gray-400 line-through">
                      {formatPriceWithStoredSettings(originalPrice)}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1 text-xs font-semibold ${hasSelectedOutOfStockOption ? 'text-red-600' : 'text-gray-500'}`}>
                  {selectedOptionStockMessage || stockStatus.label}
                </p>
                <div className="mt-2 inline-flex items-center rounded-lg border border-gray-200">
                  <button type="button" onClick={decreaseQuantity} disabled={normalizedQuantity <= 1}
                    className="px-3 py-1.5 text-sm font-black text-gray-600 disabled:text-gray-300" aria-label="Réduire la quantité">−</button>
                  <span className="min-w-[36px] border-x border-gray-200 px-2 py-1.5 text-center text-sm font-black">
                    {normalizedQuantity}
                  </span>
                  <button type="button" onClick={increaseQuantity}
                    className="px-3 py-1.5 text-sm font-black text-gray-600" aria-label="Augmenter la quantité">+</button>
                </div>
              </div>
            </div>
            {/* Toutes les options */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {selectableAttributes.map((attribute) => {
                const selectedValues = getSelectedOptionValues(attribute);
                return (
                  <div key={`sheet-opt-${attribute.key || attribute.name}`} className="mb-4 last:mb-0">
                    <p className="mb-2 text-sm font-black text-gray-900">
                      {attribute.name} ({attribute.options.length})
                      {isProductAttributeSelectionRequired(attribute) && <span className="ml-0.5 text-[#e85d00]">*</span>}
                      <span className="ml-2 text-[10px] font-semibold text-gray-400">Choix multiple</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {attribute.options.map((option) => {
                        const optionKey = String(option).trim().toLowerCase();
                        const active = selectedValues.some((value) => value.toLowerCase() === optionKey);
                        const optionPrice = attribute.optionPrices?.[optionKey];
                        const optionUnavailable = Boolean(attribute.optionOutOfStock?.[optionKey]);
                        const optionImageIdx = attribute.optionImages?.[optionKey];
                        const optionThumb = Number.isInteger(optionImageIdx)
                          ? product?.images?.[optionImageIdx] || ''
                          : '';
                        return (
                          <button key={`sheet-${attribute.name}-${option}`} type="button"
                            onClick={() => handleAttributeValueChange(attribute, option)}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border p-1 pr-2.5 text-left transition-all active:scale-[0.97] ${active
                              ? 'border-[#e85d00] bg-[#fff0e4]'
                              : 'border-transparent bg-gray-100'}`}
                            aria-pressed={active}>
                            {optionThumb ? (
                              <img src={optionThumb} alt="" loading="lazy"
                                className="h-8 w-8 flex-shrink-0 rounded object-cover" />
                            ) : null}
                            <span className={`truncate text-sm font-semibold ${active ? 'text-[#e85d00]' : 'text-gray-700'}`}>
                              {option}
                            </span>
                            {Number.isFinite(optionPrice) && optionPrice > 0 ? (
                              <span className={`flex-shrink-0 text-xs font-black ${active ? 'text-[#e85d00]' : 'text-gray-500'}`}>
                                {formatPriceWithStoredSettings(optionPrice)}
                              </span>
                            ) : null}
                            {optionUnavailable ? (
                              <span className="flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-700">
                                Rupture
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {(selectionError || selectedOptionStockMessage || isOptionSelectionBlocked) && (
                <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {selectionError || selectedOptionStockMessage || 'Veuillez sélectionner les options obligatoires.'}
                </p>
              )}
            </div>
            {/* Actions */}
            {!isOwnProduct && (
              <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                <button type="button"
                  onClick={() => { setIsVariantSheetOpen(false); handleAddToCart(); }}
                  disabled={addingToCart || inCart || isPurchaseOutOfStock || isOptionSelectionBlocked}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition active:scale-[0.97] disabled:active:scale-100 ${inCart || isPurchaseOutOfStock || isOptionSelectionBlocked
                    ? 'bg-gray-100 text-gray-400'
                    : 'border border-[#e85d00] bg-[#FFF0E4] text-[#e85d00]'}`}>
                  {isPurchaseOutOfStock ? 'Rupture' : inCart ? 'Déjà au panier' : 'Ajouter au panier'}
                </button>
                <button type="button"
                  onClick={() => { setIsVariantSheetOpen(false); handleBuyNow(); }}
                  disabled={addingToCart || isPurchaseOutOfStock || isOptionSelectionBlocked}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-black transition active:scale-[0.97] disabled:active:scale-100 ${isPurchaseOutOfStock || isOptionSelectionBlocked
                    ? 'bg-gray-200 text-gray-400'
                    : 'bg-[#e85d00] text-white shadow-sm'}`}>
                  {isPurchaseOutOfStock ? 'Rupture' : addingToCart ? '...' : 'Acheter'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cart / share feedback toasts */}
      {cartFeedback && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-semibold shadow-sm ${cartFeedback.includes('✅') ? 'bg-gray-800 text-white' : 'bg-gray-900 text-white'}`}>
          {cartFeedback}
        </div>
      )}
      {shareFeedback && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm">
          {shareFeedback}
        </div>
      )}
    </motion.div>
  );

  // === DESKTOP PRODUCT DETAILS (unchanged) ===
  const renderDesktopProductDetails = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="product-detail-page product-detail-commerce min-h-screen bg-gray-50 dark:bg-black"
    >
      {/* 🎯 NAVIGATION ENHANCED */}
      <nav className="product-detail-subnav border-b border-neutral-200/80 bg-white/80 dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleBackNavigation}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200 active:scale-95"
            >
              <ArrowLeft size={18} />
              <span>Retour</span>
            </button>
            <div className="flex items-center justify-end gap-3 w-full sm:w-auto">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((prev) => !prev)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <Share2 size={20} className="text-gray-400" />
                </button>
                {shareMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-md z-20">
                    <div className="p-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">Partager ce produit</p>
                      <p className="text-xs text-gray-500">Diffusez l’annonce en un clic.</p>
                    </div>
                    <div className="p-2 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareLink);
                            setShareFeedback("Lien copié !");
                            setTimeout(() => setShareFeedback(""), 2500);
                          } catch (err) {
                            setShareFeedback("Impossible de copier.");
                            setTimeout(() => setShareFeedback(""), 2500);
                          } finally {
                            setShareMenuOpen(false);
                          }
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Copier le lien
                      </button>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-neutral-50 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Partager sur Facebook
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${product?.title || 'Produit'} - ${shareLink}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-neutral-50 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Envoyer sur WhatsApp
                      </a>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-neutral-50 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Partager sur Telegram
                      </a>
                      <a
                        href={`https://www.tiktok.com/share?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-black/5 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Partager sur TikTok
                      </a>
                    </div>
                    {shareFeedback && (
                      <div className="px-3 pb-3 text-xs text-neutral-600">{shareFeedback}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="product-detail-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        {/* 🍞 BREADCRUMB ENHANCED */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8">
          <Link to="/" className="hover:text-neutral-800 transition-colors font-medium">Accueil</Link>
          <ChevronRight size={14} className="text-gray-400" />
          <Link
            to={`/products?category=${product.category}`}
            className="hover:text-neutral-800 transition-colors capitalize font-medium"
          >
            {product.category}
          </Link>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-gray-900 font-bold truncate">{product.title}</span>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          {/* 🖼️ GALERIE D'IMAGES ENHANCED */}
          <div className="space-y-4">
            <div className="product-detail-gallery rounded-2xl border border-gray-100 bg-white p-3 shadow-sm shadow-gray-200/50">
              <div className={desktopGalleryLayoutClass}>
                {hasMultipleGalleryImages && (
                  <div className="order-2 flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:max-h-[620px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {galleryImages.map((item, index) => (
                      <button
                        key={`desktop-thumb-${item.src || index}`}
                        type="button"
                        onClick={() => handleThumbnailClick(index)}
                        className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-[14px] bg-gray-50 border transition-all duration-300 sm:h-[72px] sm:w-[72px] lg:h-20 lg:w-20 relative ${selectedImage === index
                          ? 'ring-2 ring-neutral-900 border-transparent ring-offset-1 opacity-100 shadow-md'
                          : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                          }`}
                      >
                        {item.type === 'video' ? (
                          <>
                            <img
                              src={galleryImages.find((g) => g.type === 'image')?.src || ''}
                              alt="Vidéo"
                              className="h-full w-full object-contain"
                            />
                            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </span>
                          </>
                        ) : (
                          <img src={item.src} alt={`${product.title} - Image ${index + 1}`} className="h-full w-full object-contain" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`order-1 relative group ${hasMultipleGalleryImages ? 'lg:order-2' : ''}`}>
                  <div
                    className={`${desktopMainFrameClass} ${imageCursorClass}`}
                    onClick={handleImageClick}
                  >
                    <AnimatePresence mode="popLayout">
                      {isDisplayedVideo ? (
                        <motion.video
                          key={`video-${selectedImage}`}
                          src={displayedVideoSrc}
                          controls
                          playsInline
                          preload="metadata"
                          poster={galleryImages.find((g) => g.type === 'image')?.src}
                          initial={{ opacity: 0, filter: "blur(4px)", scale: 0.98 }}
                          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                          exit={{ opacity: 0, filter: "blur(4px)", scale: 1.02 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className={`${desktopMainGalleryImageClass} transition-transform duration-700 group-hover:scale-[1.03]`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <motion.img
                          key={selectedImage}
                          src={displayedImage}
                          alt={product?.title || 'Produit'}
                          initial={{ opacity: 0, filter: "blur(4px)", scale: 0.98 }}
                          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                          exit={{ opacity: 0, filter: "blur(4px)", scale: 1.02 }}
                          transition={{ duration: 0.35, ease: "easeOut" }}
                          className={`${desktopMainGalleryImageClass} transition-transform duration-700 group-hover:scale-[1.03]`}
                        />
                      )}
                    </AnimatePresence>

                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFavoriteToggle();
                      }}
                      className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/20 shadow-sm transition-all duration-200 active:scale-90 hover:bg-white/30"
                    >
                      <Heart
                        size={20}
                        className="text-white drop-shadow-md"
                        strokeWidth={2}
                        fill={isInFavorites ? 'white' : 'none'}
                      />
                    </button>

                    <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
                      {hasDiscount && (
                        <span className="rounded-full bg-neutral-900/80 border border-white/10 px-3 py-2 text-xs font-black text-white shadow-sm">
                          -{discountPercentage}%
                        </span>
                      )}
                      {isNewProduct && (
                        <span className="rounded-full bg-neutral-800/80 border border-white/10 px-3 py-2 text-xs font-black text-white shadow-sm">
                          Nouveau
                        </span>
                      )}
                      <span className={`${conditionColor.replace('bg-', 'bg-').replace('text-', 'text-')} rounded-full border border-white/10 px-3 py-2 text-xs font-black text-white shadow-sm`}>
                        {conditionLabel}
                      </span>
                      {product.certified && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-white/40 px-3 py-2 text-xs font-black text-neutral-900 shadow-sm">
                          <Shield className="h-4 w-4" />
                          Certifié HDMarket
                        </span>
                      )}
                    </div>

                    {hasMultipleGalleryImages && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            goToPrevImage();
                          }}
                          className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white shadow-sm transition active:scale-95 hover:bg-white/30"
                          aria-label="Image précédente"
                        >
                          <ChevronLeft size={20} className="drop-shadow-md" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            goToNextImage();
                          }}
                          className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white shadow-sm transition active:scale-95 hover:bg-white/30"
                          aria-label="Image suivante"
                        >
                          <ChevronRight size={20} className="drop-shadow-md" />
                        </button>
                      </div>
                    )}

                    {hasMultipleGalleryImages && (
                      <div className="absolute bottom-4 left-4 z-20 rounded-full bg-white/20 border border-white/40 shadow-sm px-3 py-1.5 text-xs font-bold text-white">
                        {selectedImage + 1} / {galleryImages.length}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleZoomButtonClick}
                      className="absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/20 text-white opacity-0 group-hover:opacity-100 shadow-sm transition-all duration-300 active:scale-90 hover:bg-white/30"
                    >
                      <ZoomIn size={20} className="drop-shadow-md" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {product.video && (
              <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 bg-[#fff2e6] px-5 py-4 dark:bg-neutral-900">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e85d00] text-white shadow-sm">
                      <Video className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-base font-black text-slate-950">Vidéo de présentation</p>
                      <p className="text-sm font-semibold text-stone-500">Un aperçu concret du produit, sans quitter la fiche.</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#9A4A00] ring-1 ring-orange-100 dark:text-orange-300 dark:ring-orange-900/40">
                    Aperçu
                  </span>
                </div>
                <div className="bg-black p-1.5">
                  <video
                    src={product.video}
                    controls
                    poster={galleryImages[0]}
                    preload="metadata"
                    className="aspect-video w-full rounded-[22px] object-contain"
                  />
                </div>
              </div>
            )}
            {renderSocialVideoSection({ rounded: 'rounded-2xl' })}
          </div>

          {/* 📋 INFORMATIONS PRODUIT ENHANCED - STICKY */}
          <div className="lg:sticky lg:top-24 space-y-6 h-fit">
            <div className="product-detail-buybox bg-white rounded-2xl border border-gray-100 shadow-md p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">{product.title}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${stockStatus.className}`}>
                    {stockStatus.label}
                  </span>
                  <span className="inline-flex items-center bg-neutral-100 px-4 py-2 rounded-full text-sm font-bold text-neutral-700 border border-neutral-200">
                    {product.category}
                  </span>
                  <div className="flex items-center space-x-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                    <Clock size={14} />
                    <span className="font-medium">{daysSince === 0 ? "Aujourd'hui" : daysSince === 1 ? "Hier" : `Il y a ${daysSince} jours`}</span>
                  </div>
                  {pickupOnly && (
                    <span className="inline-flex items-center bg-neutral-100 px-3 py-1.5 rounded-full text-sm font-bold text-neutral-700 border border-neutral-200">
                      Retrait boutique
                    </span>
                  )}
                  {freeDeliveryAvailable && (
                    <span className="inline-flex items-center bg-neutral-100 px-3 py-1.5 rounded-full text-sm font-bold text-neutral-700 border border-neutral-200">
                      Livraison gratuite
                    </span>
                  )}
                  {!pickupOnly && deliveryAvailable && !freeDeliveryAvailable && normalizedDeliveryFee > 0 && (
                    <span className="inline-flex items-center bg-neutral-100 px-3 py-1.5 rounded-full text-sm font-bold text-neutral-700 border border-neutral-200">
                      Livraison vendeur: {formatPriceWithStoredSettings(normalizedDeliveryFee)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 py-4 border-y border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2.5 rounded-2xl border border-neutral-200">
                    <Star className="w-6 h-6 text-neutral-500" fill="currentColor" />
                    <span className="text-2xl font-black text-gray-900">{ratingAverage}</span>
                    <span className="text-gray-600 font-semibold">({ratingCount})</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <MessageCircle size={16} className="text-neutral-800" />
                    <span className="font-semibold text-gray-700">{commentCount}</span>
                    <span className="text-gray-500">commentaires</span>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <Eye size={16} className="text-neutral-800" />
                    <span className="font-semibold text-gray-700">{formattedTotalViews}</span>
                    <span className="text-gray-500">vues</span>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
                    <ShoppingCart size={16} className="text-neutral-800" />
                    <span className="font-semibold text-gray-700">{formattedTotalOrdersQty}</span>
                    <span className="text-gray-500">commandes</span>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-100">
                    <Heart size={16} className="text-neutral-500" fill="currentColor" />
                    <span className="font-semibold text-gray-700">{favoriteCount}</span>
                    <span className="text-gray-500">favoris</span>
                  </div>
                </div>
              </div>
              {(todayViews > 0 || uniqueViewers > 0) && (
                <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                  {todayViews > 0 ? `${formattedTodayViews} vues aujourd'hui` : null}
                  {todayViews > 0 && uniqueViewers > 0 ? ' · ' : null}
                  {uniqueViewers > 0 ? `${formattedUniqueViewers} visiteurs uniques` : null}
                </div>
              )}

              <div className="space-y-3">
                {hasDiscount ? (
                  <>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="text-4xl sm:text-5xl font-black text-gray-900">{formatPriceWithStoredSettings(finalPrice)}</span>
                      <span className="text-xl sm:text-2xl text-gray-400 line-through font-bold">{formatPriceWithStoredSettings(originalPrice)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-black shadow-sm">
                        Économisez {formatPriceWithStoredSettings(originalPrice - finalPrice)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-4xl sm:text-5xl font-black text-gray-900">{formatPriceWithStoredSettings(finalPrice)}</span>
                )}
              </div>
              {installmentOffer.available && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <p className="text-sm font-black text-neutral-700">
                    Paiement par tranche disponible: profitez de ce produit dès aujourd’hui.
                  </p>
                  <p className="text-xs text-neutral-700 mt-1">
                    Premier paiement min: {formatPriceWithStoredSettings(installmentOffer.minAmount || 0)} · Durée: {installmentOffer.duration || 0} jours
                  </p>
                </div>
              )}
              {wholesaleEnabled && renderWholesaleSection()}

              {product.confirmationNumber && (
                <p className="text-xs text-gray-500">
                  Code produit :
                  <span className="font-semibold text-gray-900 ml-1">{product.confirmationNumber}</span>
                  <span className="block text-[11px] text-gray-400">
                    Mentionnez ce code à l’administrateur lorsque vous validez votre commande.
                  </span>
                </p>
              )}

              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                    {product.certified && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-700">
                        <Shield className="w-4 h-4 text-neutral-500" />
                        Produit certifié HDMarket
                      </span>
                    )}
                    {product.certifiedBy && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700">
                        Certifié par {product.certifiedBy?.name || 'HDMarket'}
                      </span>
                    )}
                    {product.certifiedAt && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                        {new Date(product.certifiedAt).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  {isAdminUser && (
                    <button
                      type="button"
                      onClick={handleCertificationToggle}
                      disabled={isCertifying}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {product.certified ? 'Retirer la certification' : 'Certifier ce produit'}
                    </button>
                  )}
                </div>
                {(certifyMessage || certifyError) && (
                  <p className={`text-xs ${certifyError ? 'text-neutral-800' : 'text-neutral-600'}`}>
                    {certifyError || certifyMessage}
                  </p>
                )}
              </div>

              {/* 🏪 INFORMATION VENDEUR ENHANCED */}
              {product.user && (
                <section className="product-shop-card relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="relative space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                        {isProfessional ? 'Boutique' : 'Vendeur'}
                      </p>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        <Store size={13} />
                        {isProfessional ? 'Vendeur professionnel' : 'Vendeur particulier'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          {shopLogo ? (
                            <img
                              src={shopLogo}
                              alt={shopName || product.user.name}
                              className="h-20 w-20 flex-shrink-0 rounded-[22px] border border-white/80 object-cover shadow-md ring-1 ring-slate-200"
                            />
                          ) : (
                            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-[22px] bg-neutral-950 shadow-md">
                              <Store className="h-11 w-11 text-white" />
                            </div>
                          )}

                          <div className="min-w-0 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-2xl font-black tracking-tight text-slate-900">
                                {canOpenShopProfile ? (
                                  <Link
                                    to={buildShopPath(shopIdentifier)}
                                    className="transition-colors hover:text-neutral-700"
                                  >
                                    {shopName || product.user.name}
                                  </Link>
                                ) : (
                                  shopName || product.user.name
                                )}
                              </h3>
                              {isProfessional && (
                                <VerifiedBadge verified={isShopVerified} showLabel={false} />
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-3 py-1">
                                <Shield size={12} />
                                Profil vendeur
                              </span>
                              {isProfessional && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                                  <Check size={12} />
                                  Boutique vérifiée
                                </span>
                              )}
                            </div>

                            {(sellerCity || shopAddress) && (
                              <p className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin size={16} className="flex-shrink-0 text-slate-500" />
                                <span className="line-clamp-1">
                                  {sellerCity ? `${sellerCity}, ${sellerCountry}` : ''}
                                  {shopAddress ? `${sellerCity ? ' • ' : ''}${shopAddress}` : ''}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {canOpenShopProfile && (
                        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[240px]">
                          <Link
                            to={buildShopPath(shopIdentifier)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-black active:scale-95"
                          >
                            <Store size={18} />
                            Voir la boutique
                          </Link>
                          {!isOwnProduct && (
                            <button
                              type="button"
                              onClick={handleFollowToggle}
                              disabled={followLoading || !isShopVerified}
                              className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-95 ${isFollowingShop
                                ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                : 'border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                } ${(!isShopVerified || followLoading) ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              {followLoading ? 'Traitement…' : isFollowingShop ? 'Se désabonner' : 'Suivre la boutique'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      <div className="product-shop-metric rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Abonnés</p>
                        <p className="mt-1 text-base font-black text-slate-900">{formattedSellerFollowers}</p>
                      </div>
                      <div className="product-shop-metric rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Membre depuis</p>
                        <p className="mt-1 text-base font-black text-slate-900">{sellerMemberSinceLabel}</p>
                      </div>
                      <div className="product-shop-metric rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Taux réponse</p>
                        <p className="mt-1 text-base font-black text-slate-900">{sellerResponseRateLabel}</p>
                      </div>
                      <div className="product-shop-metric rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Temps réponse</p>
                        <p className="mt-1 text-base font-black text-slate-900">{sellerResponseTimeLabel || 'N/A'}</p>
                      </div>
                    </div>

                    {showPhone && (
                      <a
                        href={`tel:${(phoneNumber || '').replace(/\s+/g, '')}`}
                        className="inline-flex w-full items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:bg-slate-50"
                      >
                        <Phone size={18} className="text-slate-600" />
                        <span className="font-black text-slate-900">{phoneNumber}</span>
                        <span className="ml-auto text-xs font-semibold text-slate-500">Contact direct</span>
                      </a>
                    )}
                  </div>
                </section>
              )}

              {visibleProductSpecsPanel}

              {!isOwnProduct && (
                <div className="space-y-4">
                  {productOptionsPanel}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <button
                      onClick={isOptionSelectionBlocked ? promptProductOptionSelection : handleAddToCart}
                      disabled={addingToCart || inCart || isPurchaseOutOfStock}
                      className={`group inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold transition-all duration-200 active:scale-[0.98] ${inCart || isPurchaseOutOfStock
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500 opacity-70'
                        : 'border border-[#e85d00] bg-[#FFF0E4] text-[#e85d00] hover:bg-[#ffe4cf]'
                        }`}
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#e85d00]">
                        <ShoppingCart size={16} />
                      </span>
                      <span className="truncate leading-tight">
                        {isOptionSelectionBlocked ? 'Choisir les options' : primaryCartButtonLabel}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={isOptionSelectionBlocked ? promptProductOptionSelection : handleBuyNow}
                      disabled={addingToCart || isPurchaseOutOfStock}
                      className={`group inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold transition-all duration-200 active:scale-[0.98] ${isPurchaseOutOfStock
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500 opacity-70'
                        : isOptionSelectionBlocked
                          ? 'bg-black text-white hover:bg-neutral-800'
                          : 'bg-[#e85d00] text-white shadow-sm hover:bg-[#f45f00]'
                        }`}
                    >
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${isPurchaseOutOfStock ? 'bg-slate-300' : 'bg-white/15 text-white'
                        }`}>
                        <Zap size={16} fill="currentColor" />
                      </span>
                      <span className="truncate leading-tight">
                        {isOptionSelectionBlocked ? 'Choisir les options' : buyNowButtonLabel}
                      </span>
                    </button>

                    {whatsappLink && (
                      <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleWhatsappClick}
                        className="group inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl border border-emerald-300/80 bg-emerald-50 px-5 py-3.5 text-sm font-bold text-emerald-700 shadow-sm transition-all duration-200 active:scale-[0.98] hover:bg-emerald-100"
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                          <MessageCircle size={15} />
                        </span>
                        <span className="truncate leading-tight">WhatsApp</span>
                      </a>
                    )}
                  </div>

                  {cartFeedback && (
                    <div className={`rounded-2xl p-4 text-center font-semibold ${cartFeedback.includes('✅')
                      ? 'bg-neutral-50 text-neutral-700 border border-neutral-200'
                      : 'bg-neutral-50 text-red-700 border border-neutral-200'
                      }`}>
                      {cartFeedback}
                    </div>
                  )}

                  {whatsappLink && (
                    <p className="text-center text-sm text-gray-500">
                      {whatsappClicks > 0 ? `Contacté ${whatsappClicks} fois via WhatsApp` : 'Soyez le premier à contacter ce vendeur'}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2 bg-neutral-50 px-4 py-3 rounded-xl border border-neutral-100">
                  <Shield className="w-5 h-5 text-neutral-600" />
                  <span className="text-sm font-semibold text-gray-700">Paiement sécurisé</span>
                </div>
                <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl border ${pickupOnly
                  ? 'bg-neutral-50 border-neutral-200'
                  : freeDeliveryAvailable
                    ? 'bg-neutral-50 border-neutral-100'
                    : 'bg-neutral-50 border-neutral-200'
                  }`}>
                  <Truck className={`w-5 h-5 ${pickupOnly ? 'text-neutral-600' : freeDeliveryAvailable ? 'text-neutral-600' : 'text-neutral-800'
                    }`} />
                  <span className="text-sm font-semibold text-gray-700">{deliveryPrimaryLabel}</span>
                </div>
              </div>

              {/* Ouvrir la messagerie commande depuis la fiche produit */}
              {!isOwnProduct && (
                <>
                  {user ? (
                    <button
                      type="button"
                      disabled={inquiryLoading}
                      onClick={async () => {
                        if (!product?._id) return;
                        setInquiryError("");
                        setInquiryLoading(true);
                        try {
                          const { data } = await api.post("/orders/inquiry", { productId: product._id });
                          setInquiryOrder(data);
                        } catch (err) {
                          setInquiryError(err.response?.data?.message || "Impossible d'ouvrir la conversation.");
                        } finally {
                          setInquiryLoading(false);
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-200 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed w-full"
                    >
                      <MessageCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{inquiryLoading ? "Ouverture..." : "Des questions sur ce produit ? Contacter le vendeur"}</span>
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      state={{ from: { pathname: `/product/${product?.slug || product?._id}` } }}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-200 transition-colors text-sm font-medium w-full"
                    >
                      <MessageCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Des questions sur ce produit ? Connectez-vous pour contacter le vendeur</span>
                    </Link>
                  )}
                  {inquiryError && (
                    <p className="text-sm text-neutral-800 mt-1">{inquiryError}</p>
                  )}
                </>
              )}

              {/* Boutons de partage */}
              <div className="bg-neutral-50 rounded-2xl p-4 border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Share2 size={16} className="text-neutral-800" />
                  Partager ce produit
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Facebook */}
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] text-white font-black text-sm hover:brightness-95 transition-all duration-200 active:scale-95 shadow-sm"
                    title="Partager sur Facebook"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span className="hidden sm:inline">Facebook</span>
                  </a>

                  {/* WhatsApp */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${product?.title || 'Produit'} - ${shareLink}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white font-black text-sm hover:brightness-95 transition-all duration-200 active:scale-95 shadow-sm"
                    title="Partager sur WhatsApp"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#229ED9] text-white font-black text-sm hover:brightness-95 transition-all duration-200 active:scale-95 shadow-sm"
                    title="Partager sur Telegram"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    <span className="hidden sm:inline">Telegram</span>
                  </a>

                  {/* TikTok */}
                  <a
                    href={`https://www.tiktok.com/share?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#010101] text-white font-black text-sm hover:brightness-110 transition-all duration-200 active:scale-95 shadow-sm"
                    title="Partager sur TikTok"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                    <span className="hidden sm:inline">TikTok</span>
                  </a>

                  {/* Twitter/X */}
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#000000] text-white font-black text-sm hover:brightness-110 transition-all duration-200 active:scale-95 shadow-sm"
                    title="Partager sur X (Twitter)"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span className="hidden sm:inline">X</span>
                  </a>

                  {/* Copy Link */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareLink);
                        setShareFeedback("Lien copié !");
                        setTimeout(() => setShareFeedback(""), 2500);
                      } catch (err) {
                        setShareFeedback("Impossible de copier.");
                        setTimeout(() => setShareFeedback(""), 2500);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 transition-all duration-200 active:scale-95"
                    title="Copier le lien"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="hidden sm:inline">Copier</span>
                  </button>
                </div>
                {shareFeedback && (
                  <p className="mt-2 text-sm font-semibold text-neutral-600">{shareFeedback}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 📖 SECTIONS DÉTAILLÉES ENHANCED */}
        <div className="mt-12 sm:mt-16">
          <div className="product-detail-tabs bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
            <div className="border-b border-gray-100 overflow-x-auto">
              <nav className="flex flex-wrap gap-2 sm:gap-4 min-w-full px-4 sm:px-6 pt-4">
                {[
                  { id: 'description', label: 'Description', icon: Eye },
                  { id: 'specifications', label: 'Spécifications', icon: Shield },
                  { id: 'reviews', label: `Avis (${commentCount})`, icon: Star },
                  { id: 'shipping', label: 'Livraison', icon: Truck }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-sm rounded-2xl transition-all duration-200 active:scale-95 ${activeTab === tab.id
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6 sm:p-8">
              {activeTab === 'description' && (
                <div className="prose max-w-none">
                  <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base sm:text-lg">{product.description}</p>
                  </div>
                </div>
              )}

              {activeTab === 'specifications' && (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                    {specificationRows.map((row) => (
                      <div
                        key={`desktop-spec-${row.label}`}
                        className="grid grid-cols-[150px_1fr] items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                      >
                        <span className="text-sm font-semibold text-gray-500">{row.label}</span>
                        <span className="text-sm font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {variantRows.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-neutral-50 p-4">
                      <h4 className="text-sm font-bold text-gray-800 mb-2">Variantes</h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {variantRows.map((variant) => (
                          <div key={`desktop-variant-${variant.label}`} className="rounded-xl border border-gray-100 bg-white px-3 py-2">
                            <p className="text-xs text-gray-500">{variant.label}</p>
                            <p className="text-sm font-semibold text-gray-900">{variant.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {productTags.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-neutral-50 p-4">
                      <h4 className="text-sm font-bold text-gray-800 mb-2">Tags produit</h4>
                      <div className="flex flex-wrap gap-2">
                        {productTags.map((tag) => (
                          <span
                            key={`desktop-tag-${tag}`}
                            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 bg-neutral-50 px-4 py-3">
                      <p className="text-xs text-gray-500">Retour</p>
                      <p className="text-sm font-medium text-gray-800">{returnPolicyLabel}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-neutral-50 px-4 py-3">
                      <p className="text-xs text-gray-500">Garantie</p>
                      <p className="text-sm font-medium text-gray-800">{warrantyLabel}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-neutral-50 px-4 py-3">
                      <p className="text-xs text-gray-500">Délai estimé</p>
                      <p className="text-sm font-medium text-gray-800">{deliveryEtaLabel}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="space-y-8" id="comments">
                  {/* SECTION NOTES ENHANCED */}
                  <div className="bg-neutral-50 rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-md">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="text-center lg:text-left">
                        <div className="text-5xl sm:text-6xl font-black text-gray-900 mb-2">{ratingAverage}</div>
                        <div className="flex items-center justify-center lg:justify-start gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={24}
                              className={`${star <= Math.floor(ratingAverage)
                                ? 'text-neutral-500 fill-neutral-500'
                                : 'text-gray-300'
                                }`}
                            />
                          ))}
                        </div>
                        <div className="text-sm text-gray-700 font-bold">
                          {ratingCount} avis • {commentCount} commentaires
                        </div>
                      </div>

                      <div className="flex-1 w-full max-w-md">
                        <h4 className="font-black text-gray-900 mb-4 text-lg">
                          {userRating > 0 ? 'Votre note' : 'Notez ce produit'}
                        </h4>
                        {!user ? (
                          <Link
                            to="/login"
                            state={{ from: `/product/${slug}` }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-50 text-neutral-800 font-semibold rounded-xl hover:bg-neutral-100 transition-colors text-sm border border-neutral-200"
                          >
                            Connectez-vous pour noter
                          </Link>
                        ) : isOwnProduct ? (
                          <p className="text-sm text-gray-500">Vous ne pouvez pas noter votre propre produit.</p>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleSubmitRating(star)}
                                  disabled={submittingRating}
                                  className="focus:outline-none disabled:opacity-50 hover:scale-110 transition-transform"
                                >
                                  <Star
                                    size={28}
                                    className={`${star <= userRating
                                      ? 'text-neutral-500 fill-neutral-500'
                                      : 'text-gray-300'
                                      } hover:text-neutral-400 transition-colors`}
                                  />
                                </button>
                              ))}
                              {submittingRating && <span className="text-sm text-gray-600 font-semibold ml-2">Envoi...</span>}
                            </div>
                            {userRating > 0 && (
                              <p className="text-sm text-neutral-600 font-bold mt-3 bg-neutral-50 px-3 py-2 rounded-xl inline-block">✓ Vous avez noté {userRating}/5</p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SECTION COMMENTAIRES ENHANCED */}
                  <div className="bg-neutral-50 rounded-2xl p-6 sm:p-8 border border-neutral-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-sm">
                        <MessageCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-gray-900">Commentaires</h4>
                        <p className="text-sm text-gray-600">{comments.length} commentaire{comments.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {commentError && (
                      <div className="mb-4 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                        <p className="text-red-700 text-sm">{commentError}</p>
                      </div>
                    )}

                    {/* Formulaire commentaire principal */}
                    {user && (
                      <form onSubmit={handleSubmitComment} className="mb-6">
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Laissez un commentaire..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                            disabled={submittingComment}
                          />
                          <button
                            type="submit"
                            disabled={!newComment.trim() || submittingComment}
                            className="px-4 py-2.5 bg-neutral-900 text-white rounded-2xl font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm w-full sm:w-auto"
                          >
                            {submittingComment ? 'Envoi...' : 'Commenter'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Liste des commentaires avec réponses */}
                    <div className="space-y-4">
                      {commentsLoading && comments.length === 0 ? (
                        <div className="space-y-3">
                          {Array.from({ length: 2 }).map((_, index) => (
                            <div
                              key={`desktop-comment-skeleton-${index}`}
                              className="rounded-2xl border border-gray-200 bg-gray-50 p-5 animate-pulse"
                            >
                              <div className="mb-3 flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-200" />
                                <div className="space-y-2">
                                  <div className="h-3 w-32 rounded bg-gray-200" />
                                  <div className="h-3 w-20 rounded bg-gray-200" />
                                </div>
                              </div>
                              <div className="h-3 rounded bg-gray-200" />
                            </div>
                          ))}
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
                          <p>Aucun commentaire pour le moment.</p>
                          {!user && (
                            <p className="text-sm mt-2">
                              <button
                                onClick={() => navigate('/login')}
                                className="text-neutral-800 hover:text-neutral-700"
                              >
                                Connectez-vous
                              </button>{" "}
                              pour laisser le premier commentaire.
                            </p>
                          )}
                        </div>
                      ) : (
                        comments.map((comment) => (
                          <CommentThread
                            key={comment._id}
                            comment={comment}
                            user={user}
                            replyingTo={replyingTo}
                            setReplyingTo={setReplyingTo}
                            replyText={replyText}
                            setReplyText={setReplyText}
                            onSubmitReply={handleSubmitReply}
                            submittingComment={submittingComment}
                            onReport={(replyId) => setReportModal({ isOpen: true, type: 'comment', commentId: replyId || comment._id, photoUrl: null })}
                            productId={product?._id}
                            onDelete={handleDeleteComment}
                            deletingCommentId={deletingCommentId}
                            highlightedCommentId={highlightedCommentId}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-3 p-5 bg-neutral-50 rounded-2xl border border-neutral-200 text-left">
                      <div className="w-11 h-11 bg-neutral-900 rounded-xl flex items-center justify-center shadow-md">
                        <Truck className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 text-base mb-1">Options de livraison</h4>
                        <p className="text-sm text-gray-700 font-medium">{deliveryPrimaryLabel}</p>
                        <p className="text-xs text-gray-500 mt-1">{deliverySecondaryLabel}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 p-5 bg-neutral-50 rounded-2xl border border-neutral-200 text-left">
                      <div className="w-11 h-11 bg-neutral-900 rounded-xl flex items-center justify-center shadow-md">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-black text-gray-900 text-base mb-1">Délai estimé</h4>
                        <p className="text-sm text-gray-700 font-medium">{deliveryEtaLabel}</p>
                        <p className="text-xs text-gray-500 mt-1">Confirmation finale faite par le vendeur lors de l’échange.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                    <h4 className="font-black text-gray-900 text-base mb-3">Politique client</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm text-gray-700">
                        <Shield className="w-4 h-4 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <span><span className="font-semibold text-gray-900">Retour:</span> {returnPolicyLabel}</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 mt-0.5 text-neutral-600 flex-shrink-0" />
                        <span><span className="font-semibold text-gray-900">Garantie:</span> {warrantyLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {product?.pdf && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">Document joint</h3>
            </div>
            <div className="mt-4 relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              <img
                src={product.pdf}
                alt={`Document ${product.title || ''}`}
                className="w-full h-auto object-contain bg-white"
                loading="lazy"
              />
            </div>
          </section>
        )}

        {isMobileView && isProfessional && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Photos de la boutique</h3>
              <span className="text-xs text-gray-500">Sélection aléatoire</span>
            </div>
            {shopGalleryImages.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {shopGalleryImages.map((image) => (
                  <Link
                    key={`${image.product?._id || 'shop'}-${image.src}`}
                    to={`${buildProductPath(image.product)}?image=${image.imageIndex}`}
                    {...externalLinkProps}
                    className="aspect-square overflow-hidden rounded-xl border border-gray-100"
                  >
                    <img
                      src={image.src}
                      alt={image.product?.title || 'Photo boutique'}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`shop-photo-skeleton-${index}`}
                    className="aspect-square rounded-xl border border-gray-100 bg-gray-100 animate-pulse"
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {isMobileView && (relatedLoading || relatedProducts.length > 0) && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">Produits similaires</h3>
                <p className="text-xs text-gray-600">Découvrez d'autres produits</p>
              </div>
              <Link
                to={`/products?category=${product.category}`}
                className="text-xs font-bold text-neutral-800 hover:text-neutral-700"
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {relatedLoading && relatedProducts.length === 0
                ? Array.from({ length: rapid3GActive ? 2 : 4 }).map((_, index) => (
                    <div
                      key={`mobile-related-skeleton-${index}`}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                    >
                      <div className="aspect-square bg-gray-100 animate-pulse" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 rounded bg-gray-100 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
                      </div>
                    </div>
                  ))
                : relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct._id}
                  to={buildProductPath(relatedProduct)}
                  {...externalLinkProps}
                  className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:shadow-sm hover:border-neutral-300"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <img
                      src={thumbImageUrl(relatedProduct.images?.[0]) || "https://via.placeholder.com/300x300"}
                      alt={relatedProduct.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-gray-900 line-clamp-2 mb-2 min-h-[2rem] group-hover:text-neutral-800 transition-colors">
                      {relatedProduct.title}
                    </p>
                    <p className="text-sm font-black text-neutral-800">
                      {formatPriceWithStoredSettings(relatedProduct.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {isMobileView && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Avis & notes</h3>
              <button
                type="button"
                onClick={() => setIsReviewsModalOpen(true)}
                className="text-xs font-semibold text-neutral-800"
              >
                Voir tout
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-neutral-400" />
                <span className="font-semibold text-gray-900">{ratingAverage}</span>
                <span>({ratingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{commentCount} commentaires</span>
              </div>
            </div>
            {commentsLoading && comments.length === 0 ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`mobile-comment-skeleton-${index}`}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 animate-pulse"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                    </div>
                    <div className="h-3 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : comments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {comments.slice(0, 2).map((comment) => (
                  <div key={comment._id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        {resolveUserProfileImage(comment.user) ? (
                          <img
                            src={resolveUserProfileImage(comment.user)}
                            alt={comment.user?.name || 'Utilisateur'}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                            {String(comment.user?.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-semibold text-gray-800">
                          {comment.user?.name || 'Utilisateur'}
                        </span>
                      </div>
                      <span>{new Date(comment.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700 line-clamp-3">{comment.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">Aucun avis pour le moment.</p>
            )}
          </section>
        )}

        {/* 🎯 PRODUITS SIMILAIRES ENHANCED */}
        {!isMobileView && (relatedLoading || relatedProducts.length > 0) && (
          <section className="mt-16 sm:mt-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Produits similaires</h2>
                <p className="text-gray-600 text-sm">Découvrez d'autres produits de la même catégorie</p>
              </div>
              <Link
                to={`/products?category=${product.category}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-all shadow-md hover:shadow-sm text-sm"
              >
                Voir tout <ChevronRight size={18} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4">
              {relatedLoading && relatedProducts.length === 0
                ? Array.from({ length: rapid3GActive ? 2 : 4 }).map((_, index) => (
                    <div
                      key={`desktop-related-skeleton-${index}`}
                      className="block rounded-2xl border border-gray-200 overflow-hidden bg-white"
                    >
                      <div className="aspect-square bg-gray-100 animate-pulse" />
                      <div className="p-4 space-y-2">
                        <div className="h-3 rounded bg-gray-100 animate-pulse" />
                        <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
                      </div>
                    </div>
                  ))
                : relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct._id}
                  to={buildProductPath(relatedProduct)}
                  {...externalLinkProps}
                  className="group block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-sm hover:border-neutral-300 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-square bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                    <img
                      src={thumbImageUrl(relatedProduct.images?.[0]) || "https://via.placeholder.com/300x300"}
                      alt={relatedProduct.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-neutral-800 transition-colors">
                      {relatedProduct.title}
                    </h3>
                    <p className="text-lg font-black text-neutral-800">
                      {formatPriceWithStoredSettings(relatedProduct.price)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

    </motion.div>
  );

  // === MAIN RETURN: conditional mobile / desktop ===
  const productOptionsPanel = hasProductOptions ? (
    <div
      id="product-purchase-options"
      className={`rounded-2xl border bg-white p-4 shadow-sm space-y-4 transition-colors ${
        isOptionSelectionBlocked ? 'border-[#e85d00]/40 ring-1 ring-[#e85d00]/20' : 'border-slate-200/80'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e85d00] text-white shadow-sm">
            <SlidersHorizontal size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">Options du produit</p>
            <p className="text-xs text-slate-500">
              {isOptionSelectionBlocked
                ? 'Sélectionnez vos options pour continuer.'
                : selectedAttributeCombinations.length > 1
                  ? `${selectedAttributeCombinations.length} combinaisons seront ajoutées au panier.`
                  : 'Vous pouvez sélectionner plusieurs choix.'}
            </p>
          </div>
        </div>
        {hasRequiredProductOptions && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
              selectedAttributeValidation.valid
                ? 'bg-emerald-50 text-emerald-700'
                : 'animate-pulse bg-[#e85d00] text-white'
            }`}
          >
            {selectedAttributeValidation.valid ? (
              <>
                <Check size={12} /> Prêt
              </>
            ) : (
              'À choisir'
            )}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {productOptionDefinitions.map((attribute) => {
          const selectedValue =
            normalizedSelectedAttributes.find(
              (entry) => entry.name.toLowerCase() === attribute.name.toLowerCase()
            )?.value || '';
          const selectedValues = attribute.type === 'select'
            ? getSelectedOptionValues(attribute)
            : selectedValue ? [selectedValue] : [];

          return (
            <div key={`product-option-${attribute.key || attribute.name}`} className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{attribute.name}</p>
                {isProductAttributeSelectionRequired(attribute) && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Obligatoire
                  </span>
                )}
              </div>

              {attribute.type === 'select' && attribute.optionImages ? (
                <div className="grid grid-cols-4 gap-2 lg:grid-cols-6">
                  {(Array.isArray(attribute.options) ? attribute.options : []).map((option) => {
                    const active = selectedValues.some((value) => value.toLowerCase() === String(option).toLowerCase());
                    const optionKey = String(option).trim().toLowerCase();
                    const optionPrice = attribute.optionPrices?.[optionKey];
                    const optionUnavailable = Boolean(attribute.optionOutOfStock?.[optionKey]);
                    const optionImageIdx = attribute.optionImages?.[optionKey];
                    const optionThumb = Number.isInteger(optionImageIdx)
                      ? product?.images?.[optionImageIdx] || ''
                      : '';
                    return (
                      <button
                        key={`${attribute.name}-${option}`}
                        type="button"
                        onClick={() => handleAttributeValueChange(attribute, option)}
                        className={`overflow-hidden rounded-xl border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                          active ? 'border-slate-900 ring-1 ring-slate-300' : 'border-slate-200 hover:border-slate-300'
                        }`}
                        aria-pressed={active}
                      >
                        <div className="relative aspect-square bg-slate-100">
                          {optionThumb ? (
                            <img src={optionThumb} alt={option} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl font-black text-slate-300">
                              {String(option).charAt(0).toUpperCase()}
                            </div>
                          )}
                          {optionUnavailable ? (
                            <span className="absolute inset-x-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-center text-[9px] font-black uppercase text-white">
                              Rupture
                            </span>
                          ) : null}
                        </div>
                        <div className={`px-1.5 py-1 ${active ? 'bg-slate-900' : 'bg-white'}`}>
                          <p className={`truncate text-[11px] font-bold ${active ? 'text-white' : 'text-slate-700'}`}>
                            {option}
                          </p>
                          {Number.isFinite(optionPrice) && optionPrice > 0 ? (
                            <p className={`truncate text-[11px] font-black ${active ? 'text-orange-300' : 'text-[#e85d00]'}`}>
                              {formatPriceWithStoredSettings(optionPrice)}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : attribute.type === 'select' ? (
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(attribute.options) ? attribute.options : []).map((option) => {
                    const active = selectedValues.some((value) => value.toLowerCase() === String(option).toLowerCase());
                    const swatch = isColorAttribute(attribute) ? resolveSwatchColor(option) : '';
                    const optionPrice = attribute.optionPrices?.[String(option).trim().toLowerCase()];
                    return (
                      <button
                        key={`${attribute.name}-${option}`}
                        type="button"
                        onClick={() => handleAttributeValueChange(attribute, option)}
                        className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {swatch && (
                          <span
                            className={`h-4 w-4 shrink-0 rounded-full border shadow-inner ${active ? 'border-white/40' : 'border-black/15'}`}
                            style={{ background: swatch }}
                          />
                        )}
                        {option}
                        {Number.isFinite(optionPrice) && optionPrice > 0 ? (
                          <span className={`text-[11px] font-black ${active ? 'text-white/80' : 'text-slate-500'}`}>
                            {formatPriceWithStoredSettings(optionPrice)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type={attribute.type === 'number' ? 'number' : 'text'}
                  value={selectedValue}
                  onChange={(event) => handleAttributeValueChange(attribute, event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder={
                    attribute.type === 'number'
                      ? `Saisir ${attribute.name.toLowerCase()}`
                      : `Ex: ${attribute.name}`
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {selectedAttributesSummary.length > 0 && (
        <SelectedAttributesList selectedAttributes={selectedAttributesSummary} className="pt-1" />
      )}

      {(selectionError || selectedOptionStockMessage || isOptionSelectionBlocked) && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {selectionError || selectedOptionStockMessage || 'Veuillez sélectionner les options obligatoires.'}
        </p>
      )}
    </div>
  ) : null;
  const specPreviewRows = specificationRows.slice(0, 4);
  const visibleProductSpecsPanel =
    specPreviewRows.length > 0 || variantRows.length > 0 ? (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Détails essentiels</p>
            <p className="text-xs text-slate-500">
              Les informations essentielles de cette annonce.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('specifications');
              setExpandedSections((prev) => ({ ...prev, specifications: true }));
            }}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Voir tout
          </button>
        </div>

        {specPreviewRows.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {specPreviewRows.map((row) => (
              <div
                key={`spec-preview-${row.label}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {row.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        {variantRows.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Options disponibles
            </p>
            <div className="flex flex-wrap gap-2">
              {variantRows.slice(0, 6).map((variant) => (
                <span
                  key={`visible-variant-${variant.label}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                >
                  <span className="font-semibold">{variant.label}:</span>
                  <span>{variant.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      {(offlineSnapshotActive || rapid3GActive) && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <section
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
              offlineSnapshotActive
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-sky-200 bg-sky-50 text-sky-800'
            }`}
          >
            <p className="font-semibold">
              {offlineSnapshotActive ? offlineBannerText : rapid3GBannerText}
            </p>
          </section>
        </div>
      )}
      {isMobileView ? renderMobileProductDetails() : renderDesktopProductDetails()}

      <BaseModal
        isOpen={isReviewsModalOpen}
        onClose={() => setIsReviewsModalOpen(false)}
        size="md"
        mobileSheet
        ariaLabel="Avis et notes"
        panelClassName="product-detail-modal-panel"
      >
        <ModalHeader
          title="Avis & notes"
          onClose={() => setIsReviewsModalOpen(false)}
        />
        <ModalBody className="space-y-4">
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-neutral-400" />
                <span className="font-semibold text-gray-900">{ratingAverage}</span>
                <span>({ratingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{commentCount} commentaires</span>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {user && !isOwnProduct && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Votre note :</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={`modal-rating-${star}`}
                        type="button"
                        onClick={() => handleSubmitRating(star)}
                        disabled={submittingRating}
                        className="focus:outline-none disabled:opacity-50"
                      >
                        <Star
                          size={18}
                          className={star <= userRating ? 'text-neutral-500 fill-neutral-500' : 'text-gray-300'}
                        />
                      </button>
                    ))}
                    {submittingRating && <span className="text-xs text-gray-500 ml-1">...</span>}
                  </div>
                  <form onSubmit={handleSubmitComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Laisser un commentaire..."
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      disabled={submittingComment}
                    />
                    <button
                      type="submit"
                      disabled={submittingComment || !newComment.trim()}
                      className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {submittingComment ? '...' : 'Envoyer'}
                    </button>
                  </form>
                  {commentError && (
                    <p className="text-xs text-neutral-800">{commentError}</p>
                  )}
                </div>
              )}
              {!user && (
                <p className="text-xs text-gray-500">
                  <Link to="/login" className="text-neutral-800 font-semibold">Connectez-vous</Link> pour noter ou commenter.
                </p>
              )}
              {user && isOwnProduct && (
                <p className="text-xs text-gray-500">Vous ne pouvez pas noter votre propre produit.</p>
              )}
            </div>
            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-500">Aucun avis pour le moment.</p>
              ) : (
                comments.map((comment) => (
                  <CommentThread
                    key={comment._id}
                    comment={comment}
                    user={user}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    onSubmitReply={handleSubmitReply}
                    submittingComment={submittingComment}
                    onReport={(replyId) => setReportModal({ isOpen: true, type: 'comment', commentId: replyId || comment._id, photoUrl: null })}
                    productId={product?._id}
                    onDelete={handleDeleteComment}
                    deletingCommentId={deletingCommentId}
                    highlightedCommentId={highlightedCommentId}
                  />
                ))
              )}
            </div>
        </ModalBody>
      </BaseModal>

      {/* IMAGE MODAL (shared) */}
      <BaseModal
        isOpen={isImageModalOpen}
        onClose={closeImageModal}
        size="full"
        mobileSheet={false}
        fullscreen
        ariaLabel="Image produit"
        backdropClassName="!bg-black"
        panelClassName="!border-0 !bg-black text-white"
      >
          <div className="relative flex h-full w-full flex-col bg-black">
            {/* Top bar: page counter + actions */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:p-4">
              {galleryImages.length > 1 ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-bold tabular-nums text-white">
                  {safeSelectedImage + 1} / {galleryImages.length}
                </span>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                {user && !isDisplayedVideo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportModal({ isOpen: true, type: 'photo', commentId: null, photoUrl: displayedImage });
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90"
                    title="Signaler cette photo"
                  >
                    <Flag size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeImageModal}
                  aria-label="Fermer"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Zoomable, swipeable viewer (pinch + double-tap to zoom) */}
            <Swiper
              modules={[Zoom]}
              zoom={{ maxRatio: 3, minRatio: 1, toggle: true }}
              initialSlide={safeSelectedImage}
              spaceBetween={24}
              onSwiper={(s) => {
                modalSwiperRef.current = s;
              }}
              onSlideChange={(s) => setSelectedImage(s.activeIndex)}
              className="h-full w-full [&_.swiper-slide]:flex [&_.swiper-slide]:items-center [&_.swiper-slide]:justify-center"
            >
              {galleryImages.map((item, index) => (
                <SwiperSlide key={`modal-slide-${item.src || index}`}>
                  {item.type === 'video' ? (
                    <video
                      src={item.src}
                      controls
                      playsInline
                      preload="metadata"
                      poster={galleryImages.find((g) => g.type === 'image')?.src}
                      className="max-h-full w-auto max-w-full"
                    />
                  ) : (
                    <div className="swiper-zoom-container h-full w-full">
                      <img
                        src={item.src}
                        alt={`${product?.title || 'Produit'} ${index + 1}`}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Desktop navigation arrows (mobile uses swipe) */}
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleModalPrev}
                  aria-label="Image précédente"
                  className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={handleModalNext}
                  aria-label="Image suivante"
                  className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:flex"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Bottom thumbnail rail */}
            {galleryImages.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3">
                <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl bg-white/10 px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {galleryImages.map((item, index) => (
                    <button
                      key={`modal-thumb-${item.src || index}`}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={`relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border transition ${
                        safeSelectedImage === index
                          ? 'border-[#e85d00] ring-2 ring-[#e85d00]/50'
                          : 'border-white/20 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {item.type === 'video' ? (
                        <>
                          <img
                            src={galleryImages.find((g) => g.type === 'image')?.src || ''}
                            alt="Vidéo miniature"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                          </span>
                        </>
                      ) : (
                        <img
                          src={item.src}
                          alt={`${product?.title || 'Produit'} miniature ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
      </BaseModal>

      {/* Chat commande inline (depuis la fiche produit) */}
      {inquiryOrder && (
        <OrderChat
          order={inquiryOrder}
          onClose={() => setInquiryOrder(null)}
          defaultOpen
          buttonText="Contacter le vendeur"
        />
      )}

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ isOpen: false, type: null, commentId: null, photoUrl: null })}
        type={reportModal.type}
        commentId={reportModal.commentId}
        productId={product?._id}
        photoUrl={reportModal.photoUrl}
        productTitle={product?.title}
      />
    </>
  );
}

// COMPOSANT THREAD DE COMMENTAIRE ENHANCED
function CommentThread({
  comment,
  user,
  replyingTo,
  setReplyingTo,
  replyText,
  setReplyText,
  onSubmitReply,
  submittingComment,
  onReport,
  productId,
  onDelete,
  deletingCommentId,
  highlightedCommentId
}) {
  const isAdmin = user?.role === 'admin' || user?.role === 'founder';
  const isHighlightedComment =
    highlightedCommentId && String(highlightedCommentId) === String(comment?._id || '');
  return (
    <div
      id={`comment-${comment?._id}`}
      className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-shadow hover:shadow-md ${
        isHighlightedComment ? 'border-neutral-500 ring-2 ring-neutral-300' : 'border-gray-200'
      }`}
    >
      {/* Commentaire principal */}
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3">
            {resolveUserProfileImage(comment.user) ? (
              <img
                src={resolveUserProfileImage(comment.user)}
                alt={comment.user?.name || 'Utilisateur'}
                className="h-12 w-12 rounded-2xl object-cover shadow-sm ring-2 ring-white"
              />
            ) : (
              <div className="w-12 h-12 bg-neutral-900 rounded-2xl flex items-center justify-center shadow-sm ring-2 ring-white">
                <span className="text-white text-base font-black">
                  {comment.user?.name?.charAt(0) || 'U'}
                </span>
              </div>
            )}
            <div>
              <span className="font-black text-gray-900 text-base">
                {comment.user?.name || 'Utilisateur'}
              </span>
              <div className="text-xs text-gray-600 font-medium mt-0.5">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>

          {/* Boutons actions */}
          {user && (
            <div className="flex items-center gap-2">
              {isAdmin && onDelete && (
                <button
                  onClick={() => onDelete(comment._id)}
                  disabled={deletingCommentId === comment._id}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-50 text-neutral-800 rounded-2xl hover:bg-neutral-100 transition-all duration-200 active:scale-95 text-sm font-medium disabled:opacity-50"
                  title="Supprimer ce commentaire"
                >
                  {deletingCommentId === comment._id ? (
                    <div className="h-4 w-4 animate-spin rounded-full border border-red-600 border-t-transparent" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
              {onReport && user && user._id !== comment.user?._id && (
                <button
                  onClick={() => onReport(comment._id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 text-neutral-800 rounded-2xl hover:bg-neutral-100 transition-all duration-200 active:scale-95 text-sm font-medium"
                  title="Signaler ce commentaire"
                >
                  <Flag size={14} />
                  <span className="hidden sm:inline">Signaler</span>
                </button>
              )}
              <button
                onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition-all duration-200 active:scale-95 text-sm font-medium"
              >
                <Reply size={16} />
                <span>Répondre</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-gray-700 leading-relaxed text-base">{comment.message}</p>

        {/* Formulaire de réponse ENHANCED */}
        {replyingTo === comment._id && (
          <div className="mt-4 pl-4 border-l-2 border-neutral-400 bg-neutral-50/50 rounded-r-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CornerDownLeft size={16} className="text-neutral-800" />
              <span className="text-sm font-bold text-neutral-700">Réponse à {comment.user?.name}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Répondre à ${comment.user?.name}...`}
                className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 text-sm font-medium"
                disabled={submittingComment}
              />
              <button
                onClick={() => onSubmitReply(comment)}
                disabled={!replyText.trim() || submittingComment}
                className="px-4 py-2.5 bg-neutral-900 text-white rounded-2xl font-semibold hover:bg-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm transition-all duration-200 active:scale-95"
              >
                {submittingComment ? 'Envoi...' : 'Envoyer'}
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
                className="px-4 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-2xl hover:bg-gray-50 text-sm font-medium transition-all duration-200 active:scale-95"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Réponses ENHANCED */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="bg-neutral-50 border-t border-gray-200">
          {comment.replies.map((reply) => {
            const isHighlightedReply =
              highlightedCommentId && String(highlightedCommentId) === String(reply?._id || '');
            return (
            <div
              key={reply._id}
              id={`reply-${reply?._id}`}
              className={`p-4 sm:p-4 border-b border-gray-200 last:border-b-0 ${
                isHighlightedReply ? 'bg-neutral-50 ring-1 ring-neutral-300' : ''
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <CornerDownLeft size={16} className="text-neutral-700" />
                {resolveUserProfileImage(reply.user) ? (
                  <img
                    src={resolveUserProfileImage(reply.user)}
                    alt={reply.user?.name || 'Utilisateur'}
                    className="h-10 w-10 rounded-xl object-cover shadow-md ring-2 ring-white"
                  />
                ) : (
                  <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center shadow-md ring-2 ring-white">
                    <span className="text-white text-sm font-black">
                      {reply.user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <span className="font-black text-gray-900 text-sm">
                    {reply.user?.name || 'Utilisateur'}
                  </span>
                  <div className="text-xs text-gray-600 font-medium">
                    {new Date(reply.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && onDelete && (
                    <button
                      onClick={() => onDelete(reply._id)}
                      disabled={deletingCommentId === reply._id}
                      className="p-1.5 text-neutral-800 hover:bg-neutral-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Supprimer cette réponse"
                    >
                      {deletingCommentId === reply._id ? (
                        <div className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  )}
                  {user && onReport && user._id !== reply.user?._id && (
                    <button
                      onClick={() => {
                        if (typeof onReport === 'function') {
                          onReport(reply._id);
                        }
                      }}
                      className="p-1.5 text-neutral-800 hover:bg-neutral-50 rounded-lg transition-colors"
                      title="Signaler cette réponse"
                      aria-label="Signaler cette réponse"
                    >
                      <Flag size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-gray-700 text-sm ml-14 leading-relaxed">{reply.message}</p>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

// COMPOSANT PRODUITS SIMILAIRES ENHANCED
function RelatedProducts({ relatedProducts, product }) {
  const externalLinkProps = useDesktopExternalLink();
  return (
    <section className="mt-16 sm:mt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Produits similaires</h2>
          <p className="text-gray-600 text-sm">Découvrez d'autres produits de la même catégorie</p>
        </div>
        <Link
          to={`/products?category=${product.category}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-all shadow-md hover:shadow-sm text-sm"
        >
          Voir tout <ChevronRight size={18} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4">
        {relatedProducts.map((relatedProduct) => (
          <Link
            key={relatedProduct._id}
            to={buildProductPath(relatedProduct)}
            {...externalLinkProps}
            className="group block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-sm hover:border-neutral-300 transition-all hover:-translate-y-1"
          >
            <div className="aspect-square bg-gray-100 dark:bg-neutral-800 overflow-hidden">
              <img
                src={relatedProduct.images?.[0] || "https://via.placeholder.com/300x300"}
                alt={relatedProduct.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-neutral-800 transition-colors">
                {relatedProduct.title}
              </h3>
              <p className="text-lg font-black text-neutral-800">
                {formatPriceWithStoredSettings(relatedProduct.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
