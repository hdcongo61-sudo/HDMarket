import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Star, Eye, ShoppingCart, MessageCircle, Zap, Clock, ShieldCheck } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import FavoriteContext from '../context/FavoriteContext';
import api from '../services/api';
import { buildWhatsappLink } from '../utils/whatsapp';
import { buildProductPath, buildShopPath } from '../utils/links';
import { recordProductView } from '../utils/recentViews';
import VerifiedBadge from './VerifiedBadge';
import useDesktopExternalLink from '../hooks/useDesktopExternalLink';

/**
 * 🎨 PRODUCT CARD PREMIUM HDMarket
 * Design aligné avec la page d'accueil premium
 * Éléments visuels modernes avec dégradés et SVG
 * Interactions utilisateur optimisées
 * Mobile-first et responsive
 */

export default function ProductCard({ p, hideMobileDiscountBadge = false, productLink, onProductClick }) {
  const { user } = useContext(AuthContext);
  const { addItem, cart } = useContext(CartContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [addError, setAddError] = useState('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const inCart = Boolean(user && cart?.items?.some((item) => item.product?._id === p._id));
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  const isInFavorites = isFavorite(p._id);
  const [whatsappClicks, setWhatsappClicks] = useState(p.whatsappClicks || 0);
  const [favoriteCount, setFavoriteCount] = useState(p.favoritesCount || 0);
  const externalLinkProps = useDesktopExternalLink();
  const resolvedProductLink = productLink || buildProductPath(p);
  const handleProductClick = onProductClick || recordProductView;
  
  const whatsappLink = useMemo(
    () => buildWhatsappLink(p, p?.user?.phone || p?.contactPhone),
    [p]
  );
  // === EFFETS DE SYNCHRONISATION ===
  useEffect(() => {
    setWhatsappClicks(p.whatsappClicks || 0);
  }, [p._id, p.whatsappClicks]);

  useEffect(() => {
    setFavoriteCount(p.favoritesCount || 0);
  }, [p._id, p.favoritesCount]);

  // === LOGIQUE D'AUTHENTIFICATION ===
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const redirectToLogin = () => {
    navigate('/login', { state: { from: currentPath || '/' } });
  };
  
  const requireAuth = () => {
    if (!user) {
      redirectToLogin();
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!inCart) {
      setFeedback('');
    }
  }, [inCart]);

  // === CALCULS ET DÉRIVATIONS ===
  const hasDiscount = typeof p.discount === 'number' && p.discount > 0;
  const price = Number(p.price).toLocaleString();
  const originalPrice = hasDiscount && p.priceBeforeDiscount
    ? Number(p.priceBeforeDiscount).toLocaleString()
    : null;
  
  const ratingAverage = Number(p.ratingAverage || 0).toFixed(1);
  const ratingCount = p.ratingCount || 0;
  const commentCount = p.commentCount || 0;
  const isShopVerified = Boolean(p.user?.shopVerified ?? p.shopVerified);
  const shopLogoSrc = p.user?.shopLogo || p.shopLogo || null;

  // Calcul de la date de publication
  const { publishedLabel, daysSince, isNew } = useMemo(() => {
    if (!p?.createdAt) return { publishedLabel: '', daysSince: null, isNew: false };
    const created = new Date(p.createdAt);
    if (Number.isNaN(created.getTime())) return { publishedLabel: '', daysSince: null, isNew: false };
    
    const diffMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const isNewProduct = days <= 7; // Considéré comme nouveau pendant 7 jours
    
    if (days === 0) return { publishedLabel: "Aujourd'hui", daysSince: 0, isNew: isNewProduct };
    if (days === 1) return { publishedLabel: 'Hier', daysSince: 1, isNew: isNewProduct };
    
    return { 
      publishedLabel: `Il y a ${days}j`, 
      daysSince: days, 
      isNew: isNewProduct 
    };
  }, [p.createdAt]);

  const ownerId = p?.user?._id || p?.user;
  const isOwner = Boolean(user && ownerId && String(ownerId) === user.id);
  
  const conditionLabel = p?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionColor = p?.condition === 'new' 
    ? 'from-emerald-500 to-green-500' 
    : 'from-amber-500 to-orange-500';

  // === GESTION DES INTERACTIONS ===
  const handleFavoriteToggle = async (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!requireAuth()) return;
    try {
      const result = await toggleFavorite(p);
      if (result === true) {
        setFavoriteCount((prev) => prev + 1);
      } else if (result === false) {
        setFavoriteCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Impossible de modifier les favoris.', error);
    }
  };

  const handleAddToCart = async () => {
    if (!requireAuth() || inCart) return;
    setAdding(true);
    setAddError('');
    try {
      await addItem(p._id, 1);
      setFeedback('Ajouté au panier !');
    } catch (e) {
      setAddError(e.response?.data?.message || e.message || "Impossible d'ajouter cet article.");
    } finally {
      setAdding(false);
    }
  };

  const handleWhatsappClick = async (e) => {
    if (!requireAuth()) {
      e.preventDefault();
      return;
    }
    try {
      const target = p.slug || p._id;
      const { data } = await api.post(`/products/public/${target}/whatsapp-click`);
      setWhatsappClicks((prev) =>
        typeof data?.whatsappClicks === 'number' ? data.whatsappClicks : (prev || 0) + 1
      );
    } catch (error) {
      console.error('Impossible de comptabiliser le clic WhatsApp', error);
    }
  };

  return (
    <div className="group relative flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      
      {/* 🖼️ SECTION IMAGE AVEC BADGES */}
      <Link
        to={resolvedProductLink}
        {...externalLinkProps}
        onClick={() => handleProductClick?.(p)}
        className="relative flex h-full w-full flex-col overflow-hidden"
      >
        {/* Image du produit */}
        <div className="aspect-square bg-gray-100 flex items-center justify-center w-[300px] h-[300px] lg:w-[400px] lg:h-[400px] mx-auto">
          <img
            src={imageError ? "https://via.placeholder.com/400x400?text=HDMarket" : (p.images?.[0] || "https://via.placeholder.com/400x400")}
            alt={p.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          
          {/* Skeleton loader */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"></div>
          )}
        </div>

        {/* 🔖 BADGES SUPERPOSÉS */}
        {hasDiscount && (
          <span className="sm:hidden absolute top-3 left-3 z-20 inline-flex items-center rounded-full bg-gradient-to-r from-red-500 to-pink-500 px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
            -{p.discount}%
          </span>
        )}
        <div className="hidden sm:flex absolute top-3 left-3 flex-col space-y-2">
          {/* Badge Promotion */}
          {hasDiscount && (
            <span className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              -{p.discount}%
            </span>
          )}
          
          {/* Badge Nouveau */}
          {isNew && (
            <span className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              Nouveau
            </span>
          )}
          
          {/* Badge Condition */}
          <span className={`bg-gradient-to-r ${conditionColor} text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg`}>
            {conditionLabel}
          </span>
          {p.certified && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 shadow-sm">
              <ShieldCheck className="h-3 w-3" />
              Certifié
            </span>
          )}
        </div>

        {/* ❤️ BOUTON FAVORI */}
        <button
          type="button"
          onClick={(event) => handleFavoriteToggle(event)}
          className="absolute top-3 right-3 z-30 bg-white/90 backdrop-blur-sm p-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 group/fav"
          aria-label={isInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart
            size={20}
            className={`transition-all duration-300 ${
              isInFavorites 
                ? 'text-red-500 transform scale-110' 
                : 'text-gray-600 group-hover/fav:text-red-400'
            }`}
            strokeWidth={1.5}
            fill={isInFavorites ? 'currentColor' : 'none'}
          />
        </button>

        {/* 📊 OVERLAY STATISTIQUES */}
        <div className="hidden sm:flex absolute bottom-3 left-3 right-3 justify-between items-center text-white text-xs">
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center space-x-1">
            <Eye size={12} />
            <span>{p.views || 0}</span>
          </div>
          <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center space-x-1">
            <MessageCircle size={12} />
            <span>{commentCount}</span>
          </div>
        </div>
      </Link>

      {/* 📦 MOBILE SUMMARY */}
      <div className="sm:hidden space-y-2 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="uppercase tracking-widest">{p.condition === 'new' ? 'Neuf' : 'Occasion'}</span>
          <span>{publishedLabel}</span>
        </div>
        <div className="flex items-center justify-between text-base font-semibold text-slate-900">
          <span className="text-sm font-semibold sm:text-base">{price} FCFA</span>
          {hasDiscount && !hideMobileDiscountBadge && (
            <span className="text-xs font-semibold uppercase text-red-500">-{p.discount}%</span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500" />
            {ratingAverage}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {commentCount}
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            {whatsappClicks}
          </span>
        </div>
      </div>

      {/* 📦 INFOS PRODUIT */}
      <div className="hidden flex-1 flex-col gap-3 px-4 py-3 sm:flex">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">{p.category || 'Produit'}</p>
            <h3 className="text-base font-semibold text-slate-900 truncate">{p.title}</h3>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">
              {hasDiscount ? Number(p.priceAfterDiscount || p.price).toLocaleString() : Number(p.price).toLocaleString()}
            </p>
            {originalPrice && (
              <p className="text-xs text-slate-500 line-through">{originalPrice}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-500" />
            <span>{ratingAverage}</span>
            <span className="text-[11px] text-slate-400">({ratingCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            <span>{commentCount} commentaires</span>
          </div>
          {publishedLabel && (
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{publishedLabel}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex min-w-0 items-center gap-2">
            {isShopVerified && shopLogoSrc && (
              <img
                src={shopLogoSrc}
                alt={p.user?.shopName || 'Logo boutique'}
                className="h-5 w-5 rounded-full border border-slate-200 object-cover"
                loading="lazy"
              />
            )}
            <Link
              to={buildShopPath(p.user)}
              {...externalLinkProps}
              className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 truncate hover:text-indigo-600"
            >
              {p.user?.shopName || 'Boutique HDMarket'}
            </Link>
          </div>
          {isShopVerified && <VerifiedBadge verified className="text-[10px]" />}
        </div>

        {feedback && (
          <p className="text-xs text-emerald-600">{feedback}</p>
        )}
        {addError && (
          <p className="text-xs text-red-600">{addError}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={adding || inCart}
            className={`flex-1 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-3 py-2 text-center text-xs font-semibold text-white transition hover:opacity-90 ${
              (adding || inCart) ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {adding ? 'Ajout en cours…' : inCart ? 'Dans le panier' : 'Ajouter au panier'}
          </button>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            onClick={handleWhatsappClick}
            className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-slate-400"
          >
            Contacter via WhatsApp
          </a>
        </div>
      </div>

      {/* ✨ EFFET DE SURVOL AVANCÉ */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-200 rounded-2xl pointer-events-none transition-all duration-300"></div>
    </div>
  );
}
