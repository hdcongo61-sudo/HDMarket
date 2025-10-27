import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import FavoriteContext from '../context/FavoriteContext';
import api from '../services/api';
import { buildWhatsappLink } from '../utils/whatsapp';

export default function ProductCard({ p }) {
  const { user } = useContext(AuthContext);
  const { addItem, cart } = useContext(CartContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [addError, setAddError] = useState('');
  const inCart = Boolean(user && cart?.items?.some((item) => item.product?._id === p._id));
  const { toggleFavorite, isFavorite } = useContext(FavoriteContext);
  const isInFavorites = isFavorite(p._id);
  const [whatsappClicks, setWhatsappClicks] = useState(p.whatsappClicks || 0);
  const [favoriteCount, setFavoriteCount] = useState(p.favoritesCount || 0);
  const whatsappLink = useMemo(
    () => buildWhatsappLink(p, p?.user?.phone || p?.contactPhone),
    [p]
  );

  useEffect(() => {
    setWhatsappClicks(p.whatsappClicks || 0);
  }, [p._id, p.whatsappClicks]);

  useEffect(() => {
    setFavoriteCount(p.favoritesCount || 0);
  }, [p._id, p.favoritesCount]);

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

  const hasDiscount = typeof p.discount === 'number' && p.discount > 0;
  const price = Number(p.price).toLocaleString();
  const originalPrice =
    hasDiscount && p.priceBeforeDiscount
      ? Number(p.priceBeforeDiscount).toLocaleString()
      : null;
  const ratingAverage = Number(p.ratingAverage || 0).toFixed(1);
  const ratingCount = p.ratingCount || 0;
  const commentCount = p.commentCount || 0;
  const { publishedLabel, daysSince } = useMemo(() => {
    if (!p?.createdAt) return { publishedLabel: '', daysSince: null };
    const created = new Date(p.createdAt);
    if (Number.isNaN(created.getTime())) return { publishedLabel: '', daysSince: null };
    const diffMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (days === 0) return { publishedLabel: "Publié aujourd'hui", daysSince: 0 };
    if (days === 1) return { publishedLabel: 'Publié il y a 1 jour', daysSince: 1 };
    return { publishedLabel: `Publié il y a ${days} jours`, daysSince: days };
  }, [p.createdAt]);
  const ownerId = p?.user?._id || p?.user;
  const isOwner = Boolean(user && ownerId && String(ownerId) === user.id);
  const conditionLabel = p?.condition === 'new' ? 'Neuf' : 'Occasion';
  const conditionTone =
    p?.condition === 'new'
      ? 'bg-emerald-100 text-emerald-600'
      : 'bg-amber-100 text-amber-700';

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-lg">
      <div className="relative w-full rounded-xl bg-white border transition-transform duration-300 ease-out group-hover:scale-[1.02] flex items-center justify-center overflow-hidden min-h-[180px]">
        <img
          src={p.images?.[0] || 'https://via.placeholder.com/600x400'}
          alt={p.title}
          className="max-h-56 max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          loading="lazy"
        />
        <button
          type="button"
          onClick={async () => {
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
          }}
          className="absolute top-2 right-2 rounded-full bg-white/90 p-2 shadow-sm transition hover:text-red-500"
          aria-label={isInFavorites ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Heart
            size={18}
            className={`transition-colors ${isInFavorites ? 'text-red-500' : 'text-gray-500'}`}
            strokeWidth={1.8}
            fill={isInFavorites ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <h3 className="mt-2 font-semibold">{p.title}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="capitalize">{p.category}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${conditionTone}`}>
          {conditionLabel}
        </span>
      </div>
      {hasDiscount ? (
        <div className="mt-1 space-y-1">
          <div className="text-sm text-gray-500 line-through">{originalPrice} FCFA</div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-600">{price} FCFA</span>
            <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded">-{p.discount}%</span>
          </div>
        </div>
      ) : (
        <p className="font-bold mt-1">{price} FCFA</p>
      )}
      {publishedLabel && (
        <p className="text-xs text-gray-500 mt-1">
          {publishedLabel} {daysSince !== null && `(${daysSince} jour${daysSince > 1 ? 's' : ''})`}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="currentColor">
            <path d="M12 3.5l2.47 4.99 5.51.76-4 3.84.94 5.47L12 15.89l-4.92 2.67.94-5.47-4-3.84 5.51-.76L12 3.5z" />
          </svg>
          <span>{ratingAverage} ({ratingCount})</span>
        </span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 5h16v12H7l-3 3V5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{commentCount}</span>
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-600 flex items-center gap-1">
        <Heart size={14} className="text-pink-500" />
        <span>
          {favoriteCount} personne{favoriteCount > 1 ? 's' : ''} ont ajouté cet article
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={async () => {
            if (!requireAuth() || inCart) return;
            setAdding(true);
            setAddError('');
            try {
              await addItem(p._id, 1);
              setFeedback('Ajouté au panier');
            } catch (e) {
              setAddError(e.response?.data?.message || e.message || "Impossible d'ajouter cet article.");
            } finally {
              setAdding(false);
            }
          }}
          disabled={adding || inCart}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-white transition-colors duration-200 ease-out hover:bg-indigo-700 disabled:opacity-60"
        >
          {inCart ? 'Déjà dans le panier' : adding ? 'Ajout…' : 'Ajouter au panier'}
        </button>
        <Link
          to={`/product/${p._id}`}
          className="w-full rounded border border-indigo-600 px-3 py-2 text-center text-indigo-600 transition-colors duration-200 ease-out hover:bg-indigo-50"
        >
          Voir le détail
        </Link>
        {whatsappLink && (
          <>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded border border-green-600 px-3 py-2 text-center text-green-600 transition-colors duration-200 ease-out hover:bg-green-50"
              onClick={async (e) => {
                if (!requireAuth()) {
                  e.preventDefault();
                  return;
                }
                try {
                  const { data } = await api.post(`/products/public/${p._id}/whatsapp-click`);
                  setWhatsappClicks((prev) =>
                    typeof data?.whatsappClicks === 'number' ? data.whatsappClicks : (prev || 0) + 1
                  );
                } catch (error) {
                  console.error('Impossible de comptabiliser le clic WhatsApp', error);
                }
              }}
            >
              Contacter sur WhatsApp
            </a>
            <p className="text-[11px] text-gray-500 text-center">
              {whatsappClicks > 0
                ? `Déjà contacté ${whatsappClicks} fois via WhatsApp`
                : 'Soyez le premier à écrire sur WhatsApp'}
            </p>
          </>
        )}
        {feedback && <p className="text-xs text-green-600">{feedback}</p>}
        {addError && <p className="text-xs text-red-600">{addError}</p>}
      </div>
    </div>
  );
}
