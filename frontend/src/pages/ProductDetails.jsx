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
  ChevronRight,
  ZoomIn,
  Phone,
  Reply,
  CornerDownLeft,
  Video
} from "lucide-react";
import AuthContext from "../context/AuthContext";
import CartContext from "../context/CartContext";
import FavoriteContext from "../context/FavoriteContext";
import api from "../services/api";
import { buildWhatsappLink } from "../utils/whatsapp";
import { buildProductShareUrl, buildProductPath, buildShopPath } from "../utils/links";
import VerifiedBadge from "../components/VerifiedBadge";
import useDesktopExternalLink from "../hooks/useDesktopExternalLink";

export default function ProductDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const authContextValue = useContext(AuthContext);
  const user = authContextValue?.user;
  const { addItem, cart } = useContext(CartContext);
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartFeedback, setCartFeedback] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoomImage, setZoomImage] = useState(false);
  const [whatsappClicks, setWhatsappClicks] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
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

  // 🔄 CHARGEMENT DES DONNÉES
  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");
        let data;
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
        await Promise.all([
          loadComments(),
          loadUserRating()
        ]);
        
        // Charger les produits similaires
        if (data.category) {
          try {
            const relatedResponse = await api.get(`/products/public?category=${data.category}&limit=4`);
            setRelatedProducts(relatedResponse.data?.items || []);
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

  // 💬 CHARGEMENT DES COMMENTAIRES
  const loadComments = async () => {
    try {
      const { data } = await api.get(`/products/public/${slug}/comments`);
      // Organiser les commentaires en threads (commentaires parents et réponses)
      const organizedComments = organizeComments(Array.isArray(data) ? data : []);
      setComments(organizedComments);
    } catch (error) {
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
      commentMap.set(comment._id, { ...comment, replies: [] });
    });

    // Organiser en hiérarchie
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment._id);
      if (comment.parent) {
        const parent = commentMap.get(comment.parent);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        roots.push(commentWithReplies);
      }
    });

    return roots;
  };

  // ⭐ CHARGEMENT DE LA NOTE UTILISATEUR
  const loadUserRating = async () => {
    if (!user) return;
    
    try {
      const { data } = await api.get(`/products/${slug}/rating`);
      setUserRating(data?.value || 0);
      setRating(data?.value || 0);
    } catch (error) {
      console.error("Erreur chargement note utilisateur:", error);
      setUserRating(0);
      setRating(0);
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
        product: product?._id,
        message: newComment.trim()
      };

      const response = await api.post(`/products/${slug}/comments`, commentData);
      
      setNewComment("");
      await loadComments();
      
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
        product: product?._id,
        message: replyText.trim(),
        parent: parentComment._id  // Référence au commentaire parent
      };

      const response = await api.post(`/products/${slug}/comments`, replyData);
      
      setReplyText("");
      setReplyingTo(null);
      await loadComments();
      
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
        value: newRating
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
      alert("Erreur lors de l'ajout de la note");
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
    <div className="min-h-screen bg-gray-50">
      {/* 🎯 NAVIGATION */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Retour</span>
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 🍞 BREADCRUMB */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-500 mb-8">
          <Link to="/" className="hover:text-indigo-600 transition-colors">Accueil</Link>
          <ChevronRight size={16} />
          <Link 
            to={`/products?category=${product.category}`}
            className="hover:text-indigo-600 transition-colors capitalize"
          >
            {product.category}
          </Link>
          <ChevronRight size={16} />
          <span className="text-gray-900 font-medium truncate">{product.title}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* 🖼️ GALERIE D'IMAGES AVEC BOUTON FAVORI */}
          <div className="space-y-4">
            <div className="relative">
              <div 
                className={`relative aspect-square bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-${zoomImage ? 'zoom-out' : 'zoom-in'}`}
                onClick={() => setZoomImage(!zoomImage)}
              >
                <img
                  src={displayedImage}
                  alt={product?.title || 'Produit'}
                  className={`w-full h-full object-cover transition-transform duration-500 ${
                    zoomImage ? 'scale-150' : 'scale-100'
                  }`}
                />
                
                {/* BOUTON FAVORI EN HAUT À DROITE */}
                <button
                  onClick={handleFavoriteToggle}
                  className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 group"
                >
                  <Heart
                    size={24}
                    className={`transition-all duration-300 ${
                      isInFavorites 
                        ? 'text-red-500 transform scale-110' 
                        : 'text-gray-600 group-hover:text-red-400'
                    }`}
                    strokeWidth={1.5}
                    fill={isInFavorites ? 'currentColor' : 'none'}
                  />
                </button>

                {/* Badges superposés */}
                <div className="absolute top-4 left-4 flex flex-col space-y-2">
                  {hasDiscount && (
                    <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg">
                      -{discountPercentage}%
                    </span>
                  )}
                  {isNewProduct && (
                    <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg">
                      Nouveau
                    </span>
                  )}
                  <span className={`bg-gradient-to-r ${conditionColor} text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg`}>
                    {conditionLabel}
                  </span>
                </div>

                <button className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg hover:shadow-xl transition-all">
                  <ZoomIn size={20} className="text-gray-700" />
                </button>
              </div>
            </div>

            {galleryImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {galleryImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square rounded-xl border-2 overflow-hidden transition-all ${
                      selectedImage === index 
                        ? 'border-indigo-500 ring-2 ring-indigo-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img src={image} alt="" className="w-full h-full object-cover" />
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

          {/* 📋 INFORMATIONS PRODUIT */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">{product.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700">
                  {product.category}
                </span>
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <Clock size={14} />
                  <span>{daysSince === 0 ? "Aujourd'hui" : daysSince === 1 ? "Hier" : `Il y a ${daysSince} jours`}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 py-4 border-y border-gray-200">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-amber-50 px-3 py-2 rounded-2xl">
                  <Star className="w-5 h-5 text-amber-400" fill="currentColor" />
                  <span className="font-bold text-gray-900">{ratingAverage}</span>
                  <span className="text-gray-500">({ratingCount})</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <MessageCircle size={16} />
                  <span>{commentCount} commentaires</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye size={16} />
                  <span>{product.views || 0} vues</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart size={16} className="text-pink-500" />
                  <span>{favoriteCount} favoris</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {hasDiscount ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
                    <span className="text-lg text-gray-500 line-through">{Number(originalPrice).toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-sm font-semibold">
                      Économisez {Number(originalPrice - finalPrice).toLocaleString()} FCFA
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-3xl font-bold text-gray-900">{Number(finalPrice).toLocaleString()} FCFA</span>
              )}
            </div>

            {/* 🏪 INFORMATION VENDEUR AVEC LIEN BOUTIQUE */}
            {product.user && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex-shrink-0">
                    {shopLogo ? (
                      <img src={shopLogo} alt={shopName || product.user.name} className="w-12 h-12 rounded-2xl object-cover border border-gray-200" />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
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
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin size={14} />
                        <span>
                          {sellerCity ? `${sellerCity}, ${sellerCountry}` : ''}
                          {shopAddress ? `${sellerCity ? ' • ' : ''}${shopAddress}` : ''}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>Vendeur {isProfessional ? 'Professionnel' : 'Particulier'}</span>
                      {isProfessional && (
                        <VerifiedBadge verified={isShopVerified} />
                      )}
                    </p>
                  </div>
                  
                  {/* LIEN BOUTIQUE POUR LES PROFESSIONNELS */}
                  {isProfessional && shopIdentifier && (
                    <Link
                      to={buildShopPath(shopIdentifier)}
                      className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-semibold"
                    >
                      <Store size={16} />
                      <span>Voir la boutique</span>
                    </Link>
                  )}
                </div>
                {showPhone && (
                  <div className="mt-3 pt-3 border-t border-indigo-100">
                    <a
                      href={`tel:${(phoneNumber || '').replace(/\s+/g, '')}`}
                      className="flex flex-wrap items-center gap-2 text-sm text-gray-700 hover:text-green-600 transition-colors"
                    >
                      <Phone size={16} className="text-green-600" />
                      <span className="text-gray-900 font-semibold">{phoneNumber}</span>
                      <span className="text-xs text-gray-500">• Contact direct</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {!isOwnProduct && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart || inCart}
                  className={`flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl font-semibold transition-all ${
                    inCart 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg transform hover:-translate-y-0.5'
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
                    className="flex items-center justify-center space-x-2 px-6 py-4 rounded-2xl border border-green-600 text-green-600 font-semibold hover:bg-green-50 transition-all"
                  >
                    <MessageCircle size={20} />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Shield className="w-5 h-5 text-green-500" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Truck className="w-5 h-5 text-blue-500" />
                <span>Livraison disponible</span>
              </div>
            </div>
          </div>
        </div>

        {/* 📖 SECTIONS DÉTAILLÉES */}
        <div className="mt-12">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex flex-wrap gap-4 sm:gap-8 min-w-full">
              {[
                { id: 'description', label: 'Description' },
                { id: 'specifications', label: 'Spécifications' },
                { id: 'reviews', label: `Avis et Commentaires (${commentCount})` },
                { id: 'shipping', label: 'Livraison' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="py-8">
            {activeTab === 'description' && (
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {activeTab === 'specifications' && (
              <div className="grid gap-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100">
                  <span className="font-medium text-gray-600">Condition</span>
                  <span className="text-gray-900">{conditionLabel}</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100">
                  <span className="font-medium text-gray-600">Catégorie</span>
                  <span className="text-gray-900 capitalize">{product.category}</span>
                </div>
                {(sellerCity || product.user?.shopAddress) && (
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-gray-100 text-sm">
                    <span className="font-medium text-gray-600">Localisation</span>
                    <span className="text-gray-900 text-right">
                      {sellerCity ? `${sellerCity}, ${sellerCountry}` : ''}
                      {product.user?.shopAddress ? `${sellerCity ? ' • ' : ''}${product.user.shopAddress}` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-8">
                {/* SECTION NOTES */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-gray-900">{ratingAverage}</div>
                      <div className="flex items-center justify-center mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={20}
                            className={`${
                              star <= Math.floor(ratingAverage)
                                ? 'text-amber-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {ratingCount} avis • {commentCount} commentaires
                      </div>
                    </div>
                    
                    <div className="flex-1 w-full max-w-md">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {userRating > 0 ? 'Votre note' : 'Notez ce produit'}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleSubmitRating(star)}
                            disabled={submittingRating}
                            className="focus:outline-none disabled:opacity-50"
                          >
                            <Star
                              size={24}
                              className={`${
                                star <= userRating
                                  ? 'text-amber-400 fill-current'
                                  : 'text-gray-300'
                              } hover:text-amber-400 transition-colors`}
                            />
                          </button>
                        ))}
                        {submittingRating && <span className="text-sm text-gray-500 ml-2">Envoi...</span>}
                      </div>
                      {userRating > 0 && (
                        <p className="text-sm text-green-600 mt-2">✓ Vous avez noté {userRating}/5</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION COMMENTAIRES AVEC RÉPONSES */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 border border-blue-100">
                  <h4 className="font-semibold text-gray-900 mb-4">Commentaires ({comments.length})</h4>
                  
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
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center p-4 bg-blue-50 rounded-2xl text-center sm:text-left">
                  <Truck className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Options de livraison</h4>
                    <p className="text-sm text-gray-600">Contactez le vendeur pour les détails de livraison</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center p-4 bg-green-50 rounded-2xl text-center sm:text-left">
                  <Shield className="w-6 h-6 text-green-600" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Retour et échange</h4>
                    <p className="text-sm text-gray-600">Politique de retour à discuter avec le vendeur</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 🎯 PRODUITS SIMILAIRES */}
        {relatedProducts.length > 0 && (
          <RelatedProducts relatedProducts={relatedProducts} product={product} />
        )}
      </main>
    </div>
  );
}

// COMPOSANT THREAD DE COMMENTAIRE AVEC RÉPONSES
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
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Commentaire principal */}
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {comment.user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-900">
                {comment.user?.name || 'Utilisateur'}
              </span>
              <div className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
          
          {/* Bouton répondre */}
          {user && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment._id ? null : comment._id)}
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Reply size={14} />
              <span>Répondre</span>
            </button>
          )}
        </div>
        
        <p className="text-gray-700">{comment.message}</p>
        
        {/* Formulaire de réponse */}
        {replyingTo === comment._id && (
          <div className="mt-3 pl-4 border-l-2 border-indigo-200">
            <div className="flex items-center gap-2 mb-2">
              <CornerDownLeft size={14} className="text-indigo-500" />
              <span className="text-sm text-gray-600">Réponse à {comment.user?.name}</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Répondre à ${comment.user?.name}...`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                disabled={submittingComment}
              />
              <button
                onClick={() => onSubmitReply(comment)}
                disabled={!replyText.trim() || submittingComment}
                className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm w-full sm:w-auto"
              >
                {submittingComment ? '...' : 'Envoyer'}
              </button>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
                className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm w-full sm:w-auto"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Réponses */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="bg-gray-50 border-t border-gray-200">
          {comment.replies.map((reply) => (
            <div key={reply._id} className="p-4 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center space-x-2 mb-2">
                <CornerDownLeft size={14} className="text-gray-400" />
                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">
                    {reply.user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-900 text-sm">
                    {reply.user?.name || 'Utilisateur'}
                  </span>
                  <div className="text-xs text-gray-500">
                    {new Date(reply.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              <p className="text-gray-700 text-sm ml-8">{reply.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// COMPOSANT PRODUITS SIMILAIRES
function RelatedProducts({ relatedProducts, product }) {
  const externalLinkProps = useDesktopExternalLink();
  return (
    <section className="mt-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Produits similaires</h2>
        <Link
          to={`/products?category=${product.category}`}
          className="text-indigo-600 hover:text-indigo-700 font-semibold"
        >
          Voir tout
        </Link>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {relatedProducts.map((relatedProduct) => (
          <Link
            key={relatedProduct._id}
            to={buildProductPath(relatedProduct)}
            {...externalLinkProps}
            className="block bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <div className="aspect-square bg-gray-100">
              <img
                src={relatedProduct.images?.[0] || "https://via.placeholder.com/300x300"}
                alt={relatedProduct.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 mb-2">
                {relatedProduct.title}
              </h3>
              <p className="text-lg font-bold text-indigo-600">
                {Number(relatedProduct.price).toLocaleString()} FCFA
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
