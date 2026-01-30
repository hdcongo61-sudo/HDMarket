import React, { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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
  Video,
  X
} from "lucide-react";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import api from "../services/api";
import { buildWhatsappLink } from "../utils/whatsapp";
import { buildProductShareUrl, buildProductPath, buildShopPath } from "../utils/links";
import { recordProductView } from "../utils/recentViews";
import VerifiedBadge from "../components/VerifiedBadge";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";
import useIsMobile from "../hooks/useIsMobile";

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const authContextValue = useContext(AuthContext);
  const user = authContextValue?.user;
  const updateUser = authContextValue?.updateUser;
  const { addItem, cart } = useContext(CartContext);
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartFeedback, setCartFeedback] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [whatsappClicks, setWhatsappClicks] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [shopGalleryProducts, setShopGalleryProducts] = useState([]);
  const [isFollowingShop, setIsFollowingShop] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("description");
  const [comments, setComments] = useState([]);
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
  const [modalZoom, setModalZoom] = useState(1);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const isMobileView = useIsMobile();
  const externalLinkProps = useDesktopExternalLink();
  const isAdminUser = user?.role === 'admin';

  const handleSessionExpired = useCallback(() => {
    if (typeof authContextValue?.logout === 'function') {
      authContextValue.logout();
    }
    navigate('/', { replace: true });
  }, [authContextValue, navigate]);

  // 🔒 PROTECTION CONTRE LES ACCÈS À NULL
  const isInFavorites = product ? isFavorite(product._id) : false;
  const inCart = product && user && cart?.items?.some(item => item.product?._id === product._id);
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
  const sellerCity = product?.user?.city || product?.city || '';
  const sellerCountry = product?.user?.country || product?.country || 'République du Congo';
  const isOwnProduct =
    product?.user &&
    user &&
    String(product.user._id || product.user.id) === String(user._id || user.id);

  useEffect(() => {
    if (!user || !product?.user?._id) {
      setIsFollowingShop(false);
      return;
    }
    const list = Array.isArray(user.followingShops) ? user.followingShops : [];
    const following = list.some((entry) => String(entry) === String(product.user._id));
    setIsFollowingShop(following);
  }, [product?.user?._id, user?.followingShops, user]);

  const handleFollowToggle = async () => {
    if (!product?.user?._id) return;
    if (!user) {
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }
    if (!isProfessional || !isShopVerified || isOwnProduct) return;
    setFollowLoading(true);
    try {
      const response = isFollowingShop
        ? await api.delete(`/users/shops/${product.user._id}/follow`)
        : await api.post(`/users/shops/${product.user._id}/follow`);
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
      console.error('Erreur suivi boutique:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  // 🔄 CHARGEMENT DES DONNÉES
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");
        let data;
        console.debug("Loading product", { slug });
        try {
        const response = await api.get(`/products/public/${slug}`);
          data = response.data;
        } catch (publicError) {
          const status = publicError?.response?.status;
          if (status === 404 && user) {
            try {
              const response = await api.get(`/products/${slug}`);
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
        
        setProduct(data);
        setWhatsappClicks(data.whatsappClicks || 0);
        setFavoriteCount(data.favoritesCount || 0);
        
        // Charger les commentaires et la note utilisateur
        if (data.status === 'approved') {
          await Promise.all([
            loadComments(data.slug || data._id),
            loadUserRating(data._id)
          ]);
        } else {
          setComments([]);
          setUserRating(0);
          setRating(0);
        }
        
        // Charger les produits similaires
        if (data.category) {
          try {
            const relatedResponse = await api.get(`/products/public?category=${data.category}&limit=4`);
            const relatedItems = Array.isArray(relatedResponse.data?.items)
              ? relatedResponse.data.items
              : [];
            const filteredItems = relatedItems.filter((item) => {
              if (!item) return false;
              if (data?._id && item._id && item._id === data._id) return false;
              if (data?.slug && item.slug && item.slug === data.slug) return false;
              return true;
            });
            setRelatedProducts(filteredItems.slice(0, 4));
          } catch (relatedError) {
            console.error("Erreur chargement produits similaires:", relatedError);
            setRelatedProducts([]);
          }
        }
      } catch (err) {
        if (err.response?.status === 401) {
          handleSessionExpired();
          return;
        }
        setError(err.response?.data?.message || "Produit non trouvé ou indisponible");
        console.error("Erreur chargement produit:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [slug]);

  useEffect(() => {
    if (!product?._id) return;
    recordProductView(product);
  }, [product?._id, product?.category]);

  // Scroll to top when page opens or slug changes
  useEffect(() => {
    // Immediate scroll to top
    window.scrollTo(0, 0);
    // Smooth scroll as fallback
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }, [slug]);

  useEffect(() => {
    if (!isMobileView || !product || !isProfessional) {
      setShopGalleryProducts([]);
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
  }, [isMobileView, isProfessional, product?._id, product?.slug, product?.user?._id, product?.user?.slug]);

  useEffect(() => {
    setCertifyMessage("");
    setCertifyError("");
  }, [product?._id]);

  // 💬 CHARGEMENT DES COMMENTAIRES
  const loadComments = async (identifier) => {
    const target = identifier || slug;
    try {
      const { data } = await api.get(`/products/public/${target}/comments`);
      setComments(organizeComments(Array.isArray(data) ? data : []));
      return;
    } catch (error) {
      if (error.response?.status === 404) {
        setComments([]);
        return;
      }
      console.error("Erreur chargement commentaires:", error);
      setComments([]);
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

    return roots;
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
      setUserRating(data?.value || 0);
      setRating(data?.value || 0);
    } catch (error) {
      console.error("Erreur chargement note utilisateur:", error);
      setUserRating(0);
      setRating(0);
    }
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
    
    try {
      const commentData = {
        productId: product?._id,
        message: newComment.trim()
      };

      const response = await api.post(`/products/${slug}/comments`, commentData);
      
      setNewComment("");
      await loadComments(product?.slug || product?._id);
      
    } catch (error) {
      if (error.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      console.error("Erreur soumission commentaire:", error);
      
      if (error.response) {
        setCommentError(error.response.data?.message || `Erreur ${error.response.status}`);
      } else if (error.request) {
        setCommentError("Erreur réseau - impossible de contacter le serveur");
      } else {
        setCommentError("Erreur inattendue: " + error.message);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  // 💬 SOUMISSION D'UNE RÉPONSE
  const handleSubmitReply = async (parentComment) => {
    if (!user || !replyText.trim()) return;

    setSubmittingComment(true);
    setCommentError("");
    
    try {
      const replyData = {
        productId: product?._id,
        message: replyText.trim(),
        parentId: parentComment._id  // Référence au commentaire parent
      };

      const response = await api.post(`/products/${slug}/comments`, replyData);
      
      setReplyText("");
      setReplyingTo(null);
      await loadComments(product?.slug || product?._id);
      
    } catch (error) {
      if (error.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      console.error("Erreur soumission réponse:", error);
      
      if (error.response) {
        setCommentError(error.response.data?.message || `Erreur ${error.response.status}`);
      }
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

    setSubmittingRating(true);
    try {
      await api.put(`/products/${slug}/rating`, {
        value: newRating,
        productId: product?._id
      });

      setUserRating(newRating);
      
      // Recharger le produit pour mettre à jour les notes moyennes
      const { data } = await api.get(`/products/public/${slug}`);
      setProduct(data);
      
    } catch (error) {
      if (error.response?.status === 401) {
        handleSessionExpired();
        return;
      }
      console.error("Erreur soumission note:", error);
      const serverMessage =
        error.response?.data?.message ||
        error.message ||
        'Une erreur est survenue lors de l’envoi de votre note.';
      alert(`Erreur lors de l'ajout de la note : ${serverMessage}`);
    } finally {
      setSubmittingRating(false);
    }
  };

  // 🛒 GESTION PANIER
  const handleAddToCart = async () => {
    if (!product) return;
    
    if (!user) {
      navigate('/login', { state: { from: `/product/${slug}` } });
      return;
    }
    
    if (inCart) return;

    setAddingToCart(true);
    setCartFeedback("");
    try {
      await addItem(product._id, 1);
      setCartFeedback('✅ Ajouté au panier !');
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

  // ❤️ GESTION FAVORIS
  const handleFavoriteToggle = async () => {
    if (!product) return;
    
    if (!user) {
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

  // 📱 GESTION WHATSAPP
  const handleWhatsappClick = async (event) => {
    if (!product) return;
    
    if (!user) {
      if (event?.preventDefault) event.preventDefault();
      alert('Veuillez vous connecter pour contacter le vendeur via WhatsApp.');
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

  // 🎨 CALCULS ET FORMATAGES
  const hasDiscount = product?.discount > 0;
  const originalPrice = hasDiscount ? product?.priceBeforeDiscount : product?.price;
  const finalPrice = product?.price || 0;
  const discountPercentage = product?.discount || 0;

  const ratingAverage = Number(product?.ratingAverage || 0).toFixed(1);
  const ratingCount = product?.ratingCount || 0;
  const commentCount = product?.commentCount || 0;

  const conditionLabel = product?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionColor = product?.condition === 'new' 
    ? 'from-emerald-500 to-green-500' 
    : 'from-amber-500 to-orange-500';

  const publishedDate = product?.createdAt ? new Date(product.createdAt) : null;
  const daysSince = publishedDate ? Math.floor((Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const isNewProduct = daysSince <= 7;
  const galleryImages = Array.isArray(product?.images) ? product.images.slice(0, 3) : [];
  const shopGalleryImages = useMemo(() => {
    const pool = [];
    shopGalleryProducts.forEach((shopProduct) => {
      const images = Array.isArray(shopProduct?.images) ? shopProduct.images : [];
      images.forEach((src) => {
        if (!src) return;
        pool.push({ src, product: shopProduct });
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

  useEffect(() => {
    if (!galleryImages.length) {
      if (selectedImage !== 0) setSelectedImage(0);
      return;
    }
    if (selectedImage >= galleryImages.length) {
      setSelectedImage(0);
    }
  }, [galleryImages.length, selectedImage]);

  const displayedImage = galleryImages[selectedImage] || "https://via.placeholder.com/600x600";
  const imageCursorClass = isMobileView ? "cursor-pointer" : "cursor-zoom-in";

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
    openImageModal(index);
  }, [openImageModal]);

  const handleModalPrev = useCallback(() => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  }, [galleryImages.length]);

  const handleModalNext = useCallback(() => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev + 1) % galleryImages.length);
  }, [galleryImages.length]);

  useEffect(() => {
    if (!isImageModalOpen) return;
    setModalZoom(1);
  }, [isImageModalOpen, selectedImage]);

  const handleModalWheel = useCallback(
    (event) => {
      if (isMobileView) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      const step = event.ctrlKey ? 0.1 : 0.2;
      setModalZoom((prev) => {
        const next = prev + direction * step;
        return Math.max(1, Math.min(3, Number(next.toFixed(2))));
      });
    },
    [isMobileView]
  );

  useEffect(() => {
    if (!isImageModalOpen || typeof document === "undefined") return undefined;
    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previousOverflow;
    };
  }, [isImageModalOpen]);


  // 🏗️ AFFICHAGE DU CHARGEMENT
  if (loading) {
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
                  {[1,2,3,4].map(i => (
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
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Produit non trouvé</h2>
          <p className="text-gray-600 mb-6">
            {error || "Le produit que vous recherchez n'existe pas ou a été supprimé."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-2xl hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            <ArrowLeft size={20} className="mr-2" />
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* 🎯 NAVIGATION ENHANCED */}
      <nav className="bg-white/95 backdrop-blur-xl shadow-lg border-b border-gray-200/50 sticky top-0 z-10 sm:z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-3xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200 active:scale-95"
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
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-xl z-20">
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
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Partager sur Facebook
                      </a>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${product?.title || 'Produit'} - ${shareLink}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-green-50 transition-colors"
                        onClick={() => setShareMenuOpen(false)}
                      >
                        Envoyer sur WhatsApp
                      </a>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
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
                      <div className="px-3 pb-3 text-xs text-green-600">{shareFeedback}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-8">
        {/* 🍞 BREADCRUMB ENHANCED */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8">
          <Link to="/" className="hover:text-indigo-600 transition-colors font-medium">Accueil</Link>
          <ChevronRight size={14} className="text-gray-400" />
          <Link 
            to={`/products?category=${product.category}`}
            className="hover:text-indigo-600 transition-colors capitalize font-medium"
          >
            {product.category}
          </Link>
          <ChevronRight size={14} className="text-gray-400" />
          <span className="text-gray-900 font-bold truncate">{product.title}</span>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          {/* 🖼️ GALERIE D'IMAGES ENHANCED */}
          <div className="space-y-4">
            <div className="relative group">
              <div 
                className={`relative aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl border-2 border-gray-200 overflow-hidden shadow-xl ${imageCursorClass}`}
                onClick={handleImageClick}
              >
                <img
                  src={displayedImage}
                  alt={product?.title || 'Produit'}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                
                {/* BOUTON FAVORI ENHANCED */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleFavoriteToggle();
                  }}
                  className="absolute top-4 right-4 bg-white/95 backdrop-blur-md w-11 h-11 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 active:scale-90 group/fav z-20 border border-gray-200"
                >
                  <Heart
                    size={20}
                    className={`transition-all duration-200 ${
                      isInFavorites 
                        ? 'text-red-500' 
                        : 'text-gray-600 group-hover/fav:text-red-400'
                    }`}
                    strokeWidth={2}
                    fill={isInFavorites ? 'currentColor' : 'none'}
                  />
                </button>

                {/* Badges superposés ENHANCED */}
                <div className="absolute top-4 left-4 flex flex-col space-y-2 z-20">
                  {hasDiscount && (
                    <span className="bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white px-4 py-2.5 rounded-2xl text-sm font-black shadow-2xl ring-2 ring-white/50">
                      -{discountPercentage}%
                    </span>
                  )}
                  {isNewProduct && (
                    <span className="bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600 text-white px-4 py-2.5 rounded-2xl text-sm font-black shadow-2xl ring-2 ring-white/50">
                      Nouveau
                    </span>
                  )}
                  <span className={`bg-gradient-to-r ${conditionColor} text-white px-4 py-2.5 rounded-2xl text-sm font-black shadow-2xl ring-2 ring-white/50`}>
                    {conditionLabel}
                  </span>
                  {product.certified && (
                    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-xs font-black text-white shadow-2xl ring-2 ring-white/50">
                      <Shield className="w-4 h-4" />
                      Certifié HDMarket
                    </span>
                  )}
                </div>

                {/* Image Counter */}
                {galleryImages.length > 1 && (
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg z-20">
                    {selectedImage + 1} / {galleryImages.length}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleZoomButtonClick}
                  className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-md w-11 h-11 rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 active:scale-90 z-20 border border-gray-200"
                >
                  <ZoomIn size={20} className="text-gray-700" />
                </button>
              </div>
            </div>

            {/* Thumbnail Gallery - Small images below main image */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {galleryImages.map((image, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleThumbnailClick(index)}
                    className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden transition-all transform hover:scale-110 ${
                      selectedImage === index 
                        ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md scale-110' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <img src={image} alt={`${product.title} - Image ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {product.video && (
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Video className="w-4 h-4 text-indigo-500" />
                <span>Vidéo de présentation</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-gray-100 bg-black">
                <video
                  src={product.video}
                  controls
                  poster={galleryImages[0]}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            )}
          </div>

          {/* 📋 INFORMATIONS PRODUIT ENHANCED - STICKY */}
          <div className="lg:sticky lg:top-24 space-y-6 h-fit">
            <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-xl p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 leading-tight">{product.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center bg-gradient-to-r from-indigo-100 to-purple-100 px-4 py-2 rounded-full text-sm font-bold text-indigo-700 border border-indigo-200">
                  {product.category}
                </span>
                <div className="flex items-center space-x-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                  <Clock size={14} />
                  <span className="font-medium">{daysSince === 0 ? "Aujourd'hui" : daysSince === 1 ? "Hier" : `Il y a ${daysSince} jours`}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 py-5 border-y-2 border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2.5 rounded-2xl border-2 border-amber-200">
                  <Star className="w-6 h-6 text-amber-500" fill="currentColor" />
                  <span className="text-2xl font-black text-gray-900">{ratingAverage}</span>
                  <span className="text-gray-600 font-semibold">({ratingCount})</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
                  <MessageCircle size={16} className="text-blue-600" />
                  <span className="font-semibold text-gray-700">{commentCount}</span>
                  <span className="text-gray-500">commentaires</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-xl border border-purple-100">
                  <Eye size={16} className="text-purple-600" />
                  <span className="font-semibold text-gray-700">{product.views || 0}</span>
                  <span className="text-gray-500">vues</span>
                </div>
                <div className="flex items-center gap-2 bg-pink-50 px-3 py-2 rounded-xl border border-pink-100">
                  <Heart size={16} className="text-pink-500" fill="currentColor" />
                  <span className="font-semibold text-gray-700">{favoriteCount}</span>
                  <span className="text-gray-500">favoris</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {hasDiscount ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-black text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
                    <span className="text-xl sm:text-2xl text-gray-400 line-through font-bold">{Number(originalPrice).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-4 py-2 rounded-xl text-sm font-black shadow-lg">
                      Économisez {Number(originalPrice - finalPrice).toLocaleString()} FCFA
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-4xl sm:text-5xl font-black text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
              )}
            </div>

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
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <Shield className="w-4 h-4 text-emerald-500" />
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
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-3xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {product.certified ? 'Retirer la certification' : 'Certifier ce produit'}
                  </button>
                )}
              </div>
              {(certifyMessage || certifyError) && (
                <p className={`text-xs ${certifyError ? 'text-red-600' : 'text-green-600'}`}>
                  {certifyError || certifyMessage}
                </p>
              )}
            </div>

            {/* 🏪 INFORMATION VENDEUR ENHANCED */}
            {product.user && (
              <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-3xl p-6 border-2 border-indigo-200 shadow-lg">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex-shrink-0">
                    {shopLogo ? (
                      <img src={shopLogo} alt={shopName || product.user.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-lg" />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <Store className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-gray-900">
                        {isProfessional && shopIdentifier ? (
                          <Link 
                            to={buildShopPath(shopIdentifier)}
                            className="hover:text-indigo-600 transition-colors"
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
                    {(sellerCity || shopAddress) && (
                      <div className="flex items-center gap-2 text-sm text-gray-700 bg-white/60 px-3 py-1.5 rounded-xl">
                        <MapPin size={16} className="text-indigo-600" />
                        <span className="font-medium">
                          {sellerCity ? `${sellerCity}, ${sellerCountry}` : ''}
                          {shopAddress ? `${sellerCity ? ' • ' : ''}${shopAddress}` : ''}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 font-semibold flex items-center gap-2 flex-wrap">
                      <span className="bg-white/60 px-3 py-1 rounded-lg">Vendeur {isProfessional ? 'Professionnel' : 'Particulier'}</span>
                      {isProfessional && (
                        <VerifiedBadge verified={isShopVerified} />
                      )}
                    </p>
                  </div>
                  
                  {/* LIEN BOUTIQUE POUR LES PROFESSIONNELS */}
                  {isProfessional && shopIdentifier && (
                    <div className="flex w-full flex-col gap-3 sm:w-auto">
                      <Link
                        to={buildShopPath(shopIdentifier)}
                        className="flex w-full items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-3xl font-semibold hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm text-sm"
                      >
                        <Store size={18} />
                        <span>Voir la boutique</span>
                      </Link>
                      {!isOwnProduct && (
                        <button
                          type="button"
                          onClick={handleFollowToggle}
                          disabled={followLoading || !isShopVerified}
                          className={`flex w-full items-center justify-center gap-2 px-5 py-3 rounded-3xl text-sm font-semibold transition-all duration-200 active:scale-95 ${
                            isFollowingShop
                              ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } ${(!isShopVerified || followLoading) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {followLoading ? 'Traitement…' : isFollowingShop ? 'Se désabonner' : 'Suivre la boutique ✨'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {showPhone && (
                  <div className="mt-4 pt-4 border-t-2 border-indigo-200">
                    <a
                      href={`tel:${(phoneNumber || '').replace(/\s+/g, '')}`}
                      className="flex flex-wrap items-center gap-2 text-sm bg-white/80 px-4 py-3 rounded-xl hover:bg-green-50 transition-colors border border-green-200"
                    >
                      <Phone size={18} className="text-green-600" />
                      <span className="text-gray-900 font-black">{phoneNumber}</span>
                      <span className="text-xs text-gray-600 font-semibold">• Contact direct</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {!isOwnProduct && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart || inCart}
                  className={`flex items-center justify-center space-x-2 px-6 py-3.5 rounded-3xl font-semibold text-base transition-all duration-200 active:scale-95 shadow-sm ${
                    inCart 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                  }`}
                >
                  <ShoppingCart size={20} />
                  <span>{inCart ? 'Déjà au panier' : addingToCart ? 'Ajout...' : 'Ajouter au panier'}</span>
                </button>

                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsappClick}
                    className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-3xl border border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95 shadow-sm"
                  >
                    <MessageCircle size={20} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
              
              {/* Direct Checkout Link */}
              {inCart && (
                <Link
                  to="/orders/checkout"
                  className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-3xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all duration-200 active:scale-95 shadow-sm"
                >
                  <ShoppingCart size={20} />
                  <span>Passer la commande</span>
                </Link>
              )}

              {cartFeedback && (
                <div className={`rounded-2xl p-4 text-center font-semibold ${
                  cartFeedback.includes('✅') 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {cartFeedback}
                </div>
              )}

              {whatsappLink && (
                <p className="text-center text-sm text-gray-500">
                  {whatsappClicks > 0 ? `📞 Contacté ${whatsappClicks} fois via WhatsApp` : '🚀 Soyez le premier à contacter ce vendeur'}
                </p>
              )}
            </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                <Shield className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-gray-700">Paiement sécurisé</span>
              </div>
              <div className="flex items-center space-x-2 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-700">Livraison disponible</span>
              </div>
            </div>

            {/* Lien vers les messages de commande (infos avant achat) */}
            {user && (
              <Link
                to="/orders/messages"
                {...externalLinkProps}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200 transition-colors text-sm font-medium"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span>Des questions sur une commande ? Consultez vos messages avec les vendeurs</span>
              </Link>
            )}

            {/* 📱 SOCIAL MEDIA SHARE BUTTONS */}
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <Share2 size={16} className="text-indigo-600" />
                Partager ce produit
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* Facebook */}
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1877F2] text-white font-semibold text-sm hover:bg-[#166FE5] transition-all duration-200 active:scale-95 shadow-sm"
                  title="Partager sur Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="hidden sm:inline">Facebook</span>
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${product?.title || 'Produit'} - ${shareLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#20BD5A] transition-all duration-200 active:scale-95 shadow-sm"
                  title="Partager sur WhatsApp"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0088CC] text-white font-semibold text-sm hover:bg-[#007AB8] transition-all duration-200 active:scale-95 shadow-sm"
                  title="Partager sur Telegram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <span className="hidden sm:inline">Telegram</span>
                </a>

                {/* TikTok */}
                <a
                  href={`https://www.tiktok.com/share?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white font-semibold text-sm hover:bg-gray-800 transition-all duration-200 active:scale-95 shadow-sm"
                  title="Partager sur TikTok"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                  <span className="hidden sm:inline">TikTok</span>
                </a>

                {/* Twitter/X */}
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(product?.title || 'Produit')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white font-semibold text-sm hover:bg-gray-800 transition-all duration-200 active:scale-95 shadow-sm"
                  title="Partager sur X (Twitter)"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
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
                <p className="mt-2 text-sm font-semibold text-green-600">{shareFeedback}</p>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* 📖 SECTIONS DÉTAILLÉES ENHANCED */}
        <div className="mt-12 sm:mt-16">
          <div className="bg-white rounded-3xl border-2 border-gray-100 shadow-xl overflow-hidden">
            <div className="border-b-2 border-gray-100 overflow-x-auto">
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
                      className={`flex items-center gap-2 py-2.5 px-5 font-semibold text-sm rounded-3xl transition-all duration-200 active:scale-95 ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-sm'
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
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line text-base sm:text-lg">{product.description}</p>
                </div>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 px-4 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl border border-gray-100">
                  <span className="font-bold text-gray-700">Condition</span>
                  <span className="text-gray-900 font-semibold text-lg">{conditionLabel}</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 px-4 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl border border-gray-100">
                  <span className="font-bold text-gray-700">Catégorie</span>
                  <span className="text-gray-900 font-semibold text-lg capitalize">{product.category}</span>
                </div>
                {(sellerCity || product.user?.shopAddress) && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-4 px-4 bg-gradient-to-r from-gray-50 to-indigo-50 rounded-xl border border-gray-100 text-sm">
                    <span className="font-bold text-gray-700">Localisation</span>
                    <span className="text-gray-900 font-semibold text-right">
                      {sellerCity ? `${sellerCity}, ${sellerCountry}` : ''}
                      {product.user?.shopAddress ? `${sellerCity ? ' • ' : ''}${product.user.shopAddress}` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {/* SECTION NOTES ENHANCED */}
                <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-3xl p-6 sm:p-8 border-2 border-amber-200 shadow-xl">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-center lg:text-left">
                      <div className="text-5xl sm:text-6xl font-black text-gray-900 mb-2">{ratingAverage}</div>
                      <div className="flex items-center justify-center lg:justify-start gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={24}
                            className={`${
                              star <= Math.floor(ratingAverage)
                                ? 'text-amber-500 fill-amber-500'
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
                      <div className="flex flex-wrap items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => {
                              if (isOwnProduct) return;
                              handleSubmitRating(star);
                            }}
                            disabled={submittingRating || isOwnProduct}
                            className="focus:outline-none disabled:opacity-50 hover:scale-110 transition-transform"
                            title={isOwnProduct ? 'Vous ne pouvez pas noter votre propre produit.' : undefined}
                          >
                            <Star
                              size={28}
                              className={`${
                                star <= userRating
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-gray-300'
                              } ${isOwnProduct ? 'cursor-not-allowed' : 'hover:text-amber-400'} transition-colors`}
                            />
                          </button>
                        ))}
                        {submittingRating && <span className="text-sm text-gray-600 font-semibold ml-2">Envoi...</span>}
                      </div>
                      {userRating > 0 && (
                        <p className="text-sm text-green-600 font-bold mt-3 bg-green-50 px-3 py-2 rounded-xl inline-block">✓ Vous avez noté {userRating}/5</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION COMMENTAIRES ENHANCED */}
                <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-indigo-50 rounded-3xl p-6 sm:p-8 border-2 border-blue-200 shadow-lg">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <MessageCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-gray-900">Commentaires</h4>
                      <p className="text-sm text-gray-600">{comments.length} commentaire{comments.length > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  
                  {commentError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          disabled={submittingComment}
                        />
                        <button
                          type="submit"
                          disabled={!newComment.trim() || submittingComment}
                          className="px-5 py-2.5 bg-blue-600 text-white rounded-3xl font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-sm w-full sm:w-auto"
                        >
                          {submittingComment ? 'Envoi...' : 'Commenter'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Liste des commentaires avec réponses */}
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
                        <p>Aucun commentaire pour le moment.</p>
                        {!user && (
                          <p className="text-sm mt-2">
                            <button
                              onClick={() => navigate('/login')}
                              className="text-indigo-600 hover:text-indigo-700"
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
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl border-2 border-blue-200 text-center sm:text-left shadow-md">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Truck className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-lg mb-1">Options de livraison</h4>
                    <p className="text-sm text-gray-700 font-medium">Contactez le vendeur pour les détails de livraison</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 text-center sm:text-left shadow-md">
                  <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <Shield className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900 text-lg mb-1">Retour et échange</h4>
                    <p className="text-sm text-gray-700 font-medium">Politique de retour à discuter avec le vendeur</p>
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
              <h3 className="text-base font-semibold text-gray-900">Fiche produit (JPEG)</h3>
            </div>
            <div className="mt-4 relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              <img
                src={product.pdf}
                alt={`Fiche produit ${product.title || ''}`}
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
                    to={buildProductPath(image.product)}
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

            {isMobileView && relatedProducts.length > 0 && (
          <section className="mt-8 rounded-3xl border-2 border-gray-200 bg-white p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-gray-900">Produits similaires</h3>
                <p className="text-xs text-gray-600">Découvrez d'autres produits</p>
              </div>
              <Link
                to={`/products?category=${product.category}`}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Voir tout →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct._id}
                  to={buildProductPath(relatedProduct)}
                  {...externalLinkProps}
                  className="group overflow-hidden rounded-2xl border-2 border-gray-200 bg-white transition-all hover:shadow-lg hover:border-indigo-300"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    <img
                      src={relatedProduct.images?.[0] || "https://via.placeholder.com/300x300"}
                      alt={relatedProduct.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-gray-900 line-clamp-2 mb-2 min-h-[2rem] group-hover:text-indigo-600 transition-colors">
                      {relatedProduct.title}
                    </p>
                    <p className="text-sm font-black text-indigo-600">
                      {Number(relatedProduct.price).toLocaleString()} FCFA
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
                className="text-xs font-semibold text-indigo-600"
              >
                Voir tout
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-gray-900">{ratingAverage}</span>
                <span>({ratingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{commentCount} commentaires</span>
              </div>
            </div>
            {comments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {comments.slice(0, 2).map((comment) => (
                  <div key={comment._id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-gray-800">
                        {comment.user?.name || 'Utilisateur'}
                      </span>
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
        {!isMobileView && relatedProducts.length > 0 && (
          <section className="mt-16 sm:mt-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Produits similaires</h2>
                <p className="text-gray-600 text-sm">Découvrez d'autres produits de la même catégorie</p>
              </div>
              <Link
                to={`/products?category=${product.category}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
              >
                Voir tout <ChevronRight size={18} />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {relatedProducts.map((relatedProduct) => (
                <Link
                  key={relatedProduct._id}
                  to={buildProductPath(relatedProduct)}
                  {...externalLinkProps}
                  className="group block bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:shadow-2xl hover:border-indigo-300 transition-all hover:-translate-y-1"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    <img
                      src={relatedProduct.images?.[0] || "https://via.placeholder.com/300x300"}
                      alt={relatedProduct.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-indigo-600 transition-colors">
                      {relatedProduct.title}
                    </h3>
                    <p className="text-lg font-black text-indigo-600">
                      {Number(relatedProduct.price).toLocaleString()} FCFA
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {isMobileView && isReviewsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-6 sm:items-center"
          onClick={() => setIsReviewsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Avis & notes</h3>
              <button
                type="button"
                onClick={() => setIsReviewsModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-gray-900">{ratingAverage}</span>
                <span>({ratingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                <span>{commentCount} commentaires</span>
              </div>
            </div>
            <div className="mt-4 space-y-4">
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
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* IMAGE MODAL ENHANCED */}
      {/* STICKY MOBILE ACTION BAR */}
      {isMobileView && !isOwnProduct && product && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t-2 border-gray-200 shadow-2xl md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  {hasDiscount ? (
                    <>
                      <span className="text-2xl font-black text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
                      <span className="text-sm text-gray-500 line-through font-bold">{Number(originalPrice).toLocaleString()} FCFA</span>
                    </>
                  ) : (
                    <span className="text-2xl font-black text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
                  )}
                </div>
                {hasDiscount && (
                  <p className="text-xs text-red-600 font-bold">Économisez {Number(originalPrice - finalPrice).toLocaleString()} FCFA</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || inCart}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-3xl font-semibold text-sm transition-all duration-200 active:scale-95 shadow-sm ${
                    inCart 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                  }`}
                >
                  <ShoppingCart size={18} />
                  <span>{inCart ? 'Au panier' : addingToCart ? '...' : 'Ajouter'}</span>
                </button>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWhatsappClick}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 transition-all duration-200 active:scale-90 shadow-sm"
                  >
                    <MessageCircle size={20} />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm px-4 py-6"
          onClick={closeImageModal}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="max-h-[85vh] overflow-auto rounded-3xl bg-black shadow-2xl"
              onWheel={handleModalWheel}
            >
              <img
                src={displayedImage}
                alt={product?.title || 'Produit'}
                className="block max-w-none object-contain"
                style={{ width: `${modalZoom * 100}%`, height: 'auto' }}
              />
            </div>
            <button
              type="button"
              onClick={closeImageModal}
              className="absolute right-4 top-4 rounded-full bg-white/95 backdrop-blur-md w-10 h-10 flex items-center justify-center text-gray-700 shadow-md hover:bg-white transition-all duration-200 active:scale-90 z-10 border border-gray-200"
            >
              <X size={20} />
            </button>
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handleModalPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/95 backdrop-blur-md w-10 h-10 flex items-center justify-center text-gray-700 shadow-md hover:bg-white transition-all duration-200 active:scale-90 z-10 border border-gray-200"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleModalNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/95 backdrop-blur-md w-10 h-10 flex items-center justify-center text-gray-700 shadow-md hover:bg-white transition-all duration-200 active:scale-90 z-10 border border-gray-200"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                  <span>{selectedImage + 1} / {galleryImages.length}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
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
  submittingComment 
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-gray-200 overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
      {/* Commentaire principal */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-white">
              <span className="text-white text-base font-black">
                {comment.user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <span className="font-black text-gray-900 text-base">
                {comment.user?.name || 'Utilisateur'}
              </span>
              <div className="text-xs text-gray-600 font-medium mt-0.5">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
          
          {/* Bouton répondre */}
          {user && (
              <button
                onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-3xl hover:bg-gray-200 transition-all duration-200 active:scale-95 text-sm font-medium"
              >
                <Reply size={16} />
                <span>Répondre</span>
              </button>
          )}
        </div>
        
        <p className="text-gray-700 leading-relaxed text-base">{comment.message}</p>
        
        {/* Formulaire de réponse ENHANCED */}
        {replyingTo === comment._id && (
          <div className="mt-4 pl-4 border-l-4 border-indigo-400 bg-indigo-50/50 rounded-r-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <CornerDownLeft size={16} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-700">Réponse à {comment.user?.name}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Répondre à ${comment.user?.name}...`}
                className="flex-1 px-4 py-2.5 border-2 border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium"
                disabled={submittingComment}
              />
              <button
                onClick={() => onSubmitReply(comment)}
                disabled={!replyText.trim() || submittingComment}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-3xl font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-sm shadow-sm transition-all duration-200 active:scale-95"
              >
                {submittingComment ? 'Envoi...' : 'Envoyer'}
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
                className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-3xl hover:bg-gray-50 text-sm font-medium transition-all duration-200 active:scale-95"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Réponses ENHANCED */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="bg-gradient-to-br from-gray-50 to-indigo-50/30 border-t-2 border-gray-200">
          {comment.replies.map((reply) => (
            <div key={reply._id} className="p-4 sm:p-5 border-b border-gray-200 last:border-b-0">
              <div className="flex items-center gap-3 mb-2">
                <CornerDownLeft size={16} className="text-indigo-500" />
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md ring-2 ring-white">
                  <span className="text-white text-sm font-black">
                    {reply.user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <span className="font-black text-gray-900 text-sm">
                    {reply.user?.name || 'Utilisateur'}
                  </span>
                  <div className="text-xs text-gray-600 font-medium">
                    {new Date(reply.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              <p className="text-gray-700 text-sm ml-14 leading-relaxed">{reply.message}</p>
            </div>
          ))}
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
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
        >
          Voir tout <ChevronRight size={18} />
        </Link>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {relatedProducts.map((relatedProduct) => (
          <Link
            key={relatedProduct._id}
            to={buildProductPath(relatedProduct)}
            {...externalLinkProps}
            className="group block bg-white rounded-2xl border-2 border-gray-200 overflow-hidden hover:shadow-2xl hover:border-indigo-300 transition-all hover:-translate-y-1"
          >
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
              <img
                src={relatedProduct.images?.[0] || "https://via.placeholder.com/300x300"}
                alt={relatedProduct.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem] group-hover:text-indigo-600 transition-colors">
                {relatedProduct.title}
              </h3>
              <p className="text-lg font-black text-indigo-600">
                {Number(relatedProduct.price).toLocaleString()} FCFA
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
