import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';

export default function ProductCard({ p }) {
  const { user } = useContext(AuthContext);
  const { addItem, cart } = useContext(CartContext);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [addError, setAddError] = useState('');
  const inCart = Boolean(user && cart?.items?.some((item) => item.product?._id === p._id));

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

  return (
    <div className="border rounded p-3 flex flex-col">
      <div className="relative w-full overflow-hidden rounded aspect-[4/3] bg-gray-100">
        <img
          src={p.images?.[0] || 'https://via.placeholder.com/600x400'}
          alt={p.title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <h3 className="mt-2 font-semibold">{p.title}</h3>
      <p className="text-sm text-gray-600">{p.category}</p>
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
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={async () => {
            if (!user) {
              navigate('/login');
              return;
            }
            if (inCart) return;
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
          className="w-full bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
        >
          {inCart ? 'Déjà dans le panier' : adding ? 'Ajout…' : 'Ajouter au panier'}
        </button>
        <Link
          to={`/product/${p._id}`}
          className="w-full border border-indigo-600 text-indigo-600 px-3 py-2 rounded text-center hover:bg-indigo-50"
        >
          Voir le détail
        </Link>
        {feedback && <p className="text-xs text-green-600">{feedback}</p>}
        {addError && <p className="text-xs text-red-600">{addError}</p>}
      </div>
    </div>
  );
}
