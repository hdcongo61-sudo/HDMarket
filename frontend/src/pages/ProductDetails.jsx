import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import CartContext from '../context/CartContext';
import useUserNotifications from '../hooks/useUserNotifications';

const emptyDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const withDefaultDistribution = (distribution = {}) => ({ ...emptyDistribution, ...distribution });

const StarIcon = ({ filled, className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M12 3.5l2.47 4.99 5.51.76-4 3.84.94 5.47L12 15.89l-4.92 2.67.94-5.47-4-3.84 5.51-.76L12 3.5z"
      strokeLinejoin="round"
    />
  </svg>
);

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { addItem, loading: cartLoading } = useContext(CartContext);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [ratingSummary, setRatingSummary] = useState(() => ({ average: 0, count: 0, distribution: withDefaultDistribution() }));
  const [ratingLoading, setRatingLoading] = useState(true);
  const [ratingError, setRatingError] = useState('');
  const [userRating, setUserRating] = useState(null);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [cartFeedback, setCartFeedback] = useState('');
  const [cartError, setCartError] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const { counts: notificationCounts } = useUserNotifications(Boolean(user));

  const formatDateTime = useCallback((value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }, []);

  const applyRatingSummary = useCallback((data) => {
    setRatingSummary({
      average: data?.average ?? 0,
      count: data?.count ?? 0,
      distribution: withDefaultDistribution(data?.distribution)
    });
  }, []);

  const refreshRatingSummary = useCallback(async () => {
    try {
      const { data } = await api.get(`/products/public/${id}/ratings`);
      applyRatingSummary(data);
      setRatingError('');
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Erreur lors du chargement des notes.';
      setRatingError(message);
    }
  }, [applyRatingSummary, id]);

  const fetchCommentsData = useCallback(async () => {
    const { data } = await api.get(`/products/public/${id}/comments`);
    return data;
  }, [id]);

  const priceDisplay = useMemo(() => {
    if (!product) return { current: '', before: '', discount: 0 };
    const current = Number(product.price).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    const hasDiscount = typeof product.discount === 'number' && product.discount > 0;
    const before = hasDiscount
      ? Number(
          (product.priceBeforeDiscount ||
            product.price / (1 - product.discount / 100)).toFixed(0)
        ).toLocaleString()
      : '';
    return {
      current,
      before,
      discount: hasDiscount ? product.discount : 0
    };
  }, [product]);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/products/public/${id}`);
        if (!active) return;
        setProduct(data);
        setError('');
      } catch (e) {
        if (!active) return;
        const message = e.response?.status === 404
          ? "L'annonce est introuvable ou n'est pas disponible."
          : e.response?.data?.message || e.message || 'Erreur lors du chargement.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchProduct();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    setCartFeedback('');
    setCartError('');
  }, [id]);

  useEffect(() => {
    let active = true;
    const loadRatings = async () => {
      try {
        setRatingLoading(true);
        const { data } = await api.get(`/products/public/${id}/ratings`);
        if (!active) return;
        applyRatingSummary(data);
        setRatingError('');
      } catch (e) {
        if (!active) return;
        const message = e.response?.data?.message || e.message || 'Erreur lors du chargement des notes.';
        setRatingError(message);
      } finally {
        if (active) setRatingLoading(false);
      }
    };
    loadRatings();
    return () => {
      active = false;
    };
  }, [applyRatingSummary, id]);

  useEffect(() => {
    let active = true;
    const loadComments = async () => {
      try {
        setCommentsLoading(true);
        const data = await fetchCommentsData();
        if (!active) return;
        setComments(data);
        setCommentsError('');
      } catch (e) {
        if (!active) return;
        const message =
          e.response?.status === 404
            ? "Impossible de récupérer les commentaires pour cette annonce."
            : e.response?.data?.message || e.message || 'Erreur lors du chargement des commentaires.';
        setCommentsError(message);
      } finally {
        if (active) setCommentsLoading(false);
      }
    };
    loadComments();
    return () => {
      active = false;
    };
  }, [fetchCommentsData]);

  useEffect(() => {
    if (!user) {
      setUserRating(null);
      setHoverRating(0);
      return;
    }
    let active = true;
    const loadUserRating = async () => {
      try {
        const { data } = await api.get(`/products/${id}/rating`);
        if (!active) return;
        setUserRating(data?.value ?? null);
      } catch (e) {
        if (!active) return;
        if (e.response?.status === 404 || e.response?.status === 403 || e.response?.status === 401) {
          setUserRating(null);
        } else {
          console.error(e);
        }
      }
    };
    loadUserRating();
    return () => {
      active = false;
    };
  }, [id, user]);

  const onSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentMessage.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      await api.post(`/products/${id}/comments`, { message: commentMessage.trim() });
      const data = await fetchCommentsData();
      setComments(data);
      setCommentsError('');
      setCommentMessage('');
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Erreur lors de l’envoi du commentaire.';
      alert(message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const onSubmitReply = async (commentId) => {
    if (!replyMessage.trim() || replySubmitting) return;
    setReplySubmitting(true);
    try {
      await api.post(`/products/${id}/comments`, { message: replyMessage.trim(), parentId: commentId });
      const data = await fetchCommentsData();
      setComments(data);
      setCommentsError('');
      setActiveReplyId(null);
      setReplyMessage('');
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Erreur lors de l’envoi de la réponse.';
      alert(message);
    } finally {
      setReplySubmitting(false);
    }
  };

  const commentTree = useMemo(() => {
    if (!Array.isArray(comments) || comments.length === 0) return [];
    const map = new Map();
    comments.forEach((comment) => {
      map.set(comment._id, { ...comment, replies: [] });
    });
    const roots = [];
    map.forEach((comment) => {
      const parentId = comment.parent?._id;
      if (parentId && map.has(parentId)) {
        map.get(parentId).replies.push(comment);
      } else {
        roots.push(comment);
      }
    });

    const sortTree = (list, depth = 0) => {
      list.sort((a, b) =>
        depth === 0
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      list.forEach((item) => sortTree(item.replies, depth + 1));
    };
    sortTree(roots);
    return roots;
  }, [comments]);

  const newCommentIds = useMemo(() => {
    const alerts = notificationCounts?.alerts || [];
    const productId = product?._id || id;
    return new Set(
      alerts
        .filter((alert) => alert.isNew && alert.product && alert.product._id === productId)
        .map((alert) => alert._id)
    );
  }, [notificationCounts, product?._id, id]);

  const toggleReply = (commentId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (activeReplyId === commentId) {
      setActiveReplyId(null);
      setReplyMessage('');
    } else {
      setActiveReplyId(commentId);
      setReplyMessage('');
    }
  };

  const renderComment = (comment, depth = 0) => {
    const isNew = newCommentIds.has(comment._id);
    return (
    <li
      key={comment._id}
      className={`space-y-2 ${
        depth > 0 ? 'pl-4 border-l border-gray-200 pt-2' : 'border rounded p-3 bg-white shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{comment.user?.name || 'Utilisateur HDMarket'}</span>
        <span className="text-xs text-gray-500">{formatDateTime(comment.createdAt)}</span>
      </div>
      {isNew && (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Nouveau</span>
      )}
      <p className="text-sm text-gray-700 whitespace-pre-line">{comment.message}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {user && (
          <button
            type="button"
            onClick={() => toggleReply(comment._id)}
            className="text-indigo-600 hover:underline"
            disabled={replySubmitting && activeReplyId === comment._id}
          >
            {activeReplyId === comment._id ? 'Annuler' : 'Répondre'}
          </button>
        )}
      </div>
      {activeReplyId === comment._id && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitReply(comment._id);
          }}
          className="space-y-2"
        >
          <textarea
            className="w-full border rounded p-2"
            rows={2}
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            maxLength={500}
            disabled={replySubmitting}
            placeholder={`Répondre à ${comment.user?.name || 'cet utilisateur'}`}
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveReplyId(null);
                setReplyMessage('');
              }}
              className="px-3 py-1 border rounded text-sm"
              disabled={replySubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-1 bg-indigo-600 text-white rounded text-sm disabled:opacity-60"
              disabled={replySubmitting || !replyMessage.trim()}
            >
              {replySubmitting ? 'Envoi…' : 'Répondre'}
            </button>
          </div>
        </form>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <ul className="space-y-2 mt-2">
          {comment.replies.map((child) => renderComment(child, depth + 1))}
        </ul>
      )}
    </li>
  );
  };

  const onSelectRating = async (value) => {
    if (ratingSaving || !user) return;
    setRatingSaving(true);
    try {
      await api.put(`/products/${id}/rating`, { value });
      setUserRating(value);
      setHoverRating(0);
      await refreshRatingSummary();
    } catch (e) {
      const message = e.response?.data?.message || e.message || 'Erreur lors de l’enregistrement de la note.';
      alert(message);
    } finally {
      setRatingSaving(false);
    }
  };

  const onRemoveRating = async () => {
    if (ratingSaving || !user) return;
    setRatingSaving(true);
    try {
      await api.delete(`/products/${id}/rating`);
      setUserRating(null);
      setHoverRating(0);
      await refreshRatingSummary();
    } catch (e) {
      if (e.response?.status !== 404) {
        const message = e.response?.data?.message || e.message || 'Erreur lors de la suppression de la note.';
        alert(message);
      } else {
        setUserRating(null);
      }
    } finally {
      setRatingSaving(false);
    }
  };

  const publishedMeta = useMemo(() => {
    if (!product?.createdAt) {
      return {
        dateLabel: '',
        sinceLabel: '',
        daysSince: null
      };
    }
    const created = new Date(product.createdAt);
    if (Number.isNaN(created.getTime())) {
      return { dateLabel: '', sinceLabel: '', daysSince: null };
    }
    const dateLabel = created.toLocaleDateString();
    const diffMs = Date.now() - created.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    let sinceLabel;
    if (days === 0) sinceLabel = "Aujourd'hui";
    else if (days === 1) sinceLabel = 'Il y a 1 jour';
    else sinceLabel = `Il y a ${days} jours`;
    return { dateLabel, sinceLabel, daysSince: days };
  }, [product?.createdAt]);

  const onAddToCart = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!product) return;
    setCartFeedback('');
    setCartError('');
    try {
      await addItem(product._id, 1);
      setCartFeedback('Article ajouté au panier.');
    } catch (e) {
      setCartError(e.response?.data?.message || e.message || 'Impossible d’ajouter cet article.');
    }
  };

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto p-4">
        <p className="text-sm text-gray-500">Chargement de l'annonce…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
        >
          ← Retour
        </button>
      </main>
    );
  }

  if (!product) return null;

  const canEdit = user?.role === 'admin' || (user && product.user && product.user._id === user.id);
  const averageLabel = ratingSummary.count ? ratingSummary.average.toFixed(1) : '0.0';
  const summaryFilledStars = Math.max(0, Math.min(5, Math.round(ratingSummary.average || 0)));
  const activeUserRating = hoverRating || userRating || 0;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-1 text-sm border rounded hover:bg-gray-100"
      >
        ← Retour
      </button>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          {product.images?.length ? (
            <>
              <img
                src={product.images[0]}
                alt={product.title}
                className="w-full h-72 object-cover rounded-md border"
                loading="lazy"
              />
              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {product.images.slice(1).map((src, idx) => (
                    <img
                      key={src || idx}
                      src={src}
                      alt={`${product.title} ${idx + 2}`}
                      className="h-20 w-24 object-cover rounded border"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-72 bg-gray-100 rounded grid place-items-center text-sm text-gray-500">
              Aucune image fournie
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
            <p className="text-gray-500 text-sm capitalize">{product.category}</p>
          </div>
          <div className="space-y-2">
            {priceDisplay.before && (
              <p className="text-sm text-gray-500 line-through">{priceDisplay.before} FCFA</p>
            )}
            <div className="flex items-center gap-3">
              <p className="text-xl font-semibold text-indigo-600">
                {priceDisplay.current ? `${priceDisplay.current} FCFA` : 'Prix non renseigné'}
              </p>
              {priceDisplay.discount ? (
                <span className="text-xs font-semibold bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  -{priceDisplay.discount}% promo
                </span>
              ) : null}
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={onAddToCart}
                disabled={cartLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              >
                Ajouter au panier
              </button>
              {!user && (
                <p className="text-xs text-gray-500">
                  <Link to="/login" className="text-indigo-600 underline">Connectez-vous</Link> pour sauvegarder vos produits.
                </p>
              )}
              {cartFeedback && <p className="text-xs text-green-600">{cartFeedback}</p>}
              {cartError && <p className="text-xs text-red-600">{cartError}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Description</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Informations vendeur</h2>
            <ul className="text-sm text-gray-700 space-y-1">
              <li><span className="font-medium">Nom :</span> {product.user?.name || 'Utilisateur HDMarket'}</li>
              {product.user?.email && (
                <li><span className="font-medium">Email :</span> {product.user.email}</li>
              )}
              {product.user?.phone && (
                <li><span className="font-medium">Téléphone :</span> {product.user.phone}</li>
              )}
            </ul>
          </div>
      <div className="space-y-1 text-xs text-gray-500">
        {publishedMeta.dateLabel && (
          <p>
            Annonce publiée le {publishedMeta.dateLabel} ({publishedMeta.sinceLabel}
            {publishedMeta.daysSince !== null && ` · ${publishedMeta.daysSince} jour${publishedMeta.daysSince > 1 ? 's' : ''}`})
          </p>
        )}
        <p>Dernière mise à jour le {new Date(product.updatedAt).toLocaleDateString()}</p>
      </div>
        </div>
      </section>
      {canEdit ? (
        <section>
      <Link
        to={`/product/${product._id}/edit`}
        className="inline-flex items-center gap-2 px-4 py-2 border rounded text-sm text-indigo-600 border-indigo-200 hover:bg-indigo-50"
      >
        Modifier cette annonce
      </Link>
    </section>
  ) : null}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Notes</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-lg font-semibold text-gray-900">{averageLabel}</span>
            <span>/5</span>
            <span>({ratingSummary.count} avis)</span>
          </div>
        </div>
        {ratingLoading ? (
          <p className="text-sm text-gray-500">Chargement des notes…</p>
        ) : ratingError ? (
          <p className="text-sm text-red-600">{ratingError}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <StarIcon
                    key={idx}
                    filled={idx < summaryFilledStars}
                    className="h-6 w-6 text-amber-400"
                  />
                ))}
              </div>
              <div className="text-sm text-gray-600">
                Moyenne de {ratingSummary.count} avis
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              {[5, 4, 3, 2, 1].map((star) => {
                const value = ratingSummary.distribution[star] || 0;
                const percentage = ratingSummary.count ? Math.round((value / ratingSummary.count) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-8 text-right">{star}★</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded">
                      <div
                        className="h-1.5 bg-amber-400 rounded"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-10 text-right">{value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="border rounded p-3 bg-slate-50">
          <p className="text-sm font-medium text-gray-700">Votre note</p>
          {user ? (
            <>
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const value = idx + 1;
                  const filled = value <= activeUserRating;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`p-1 transition-colors ${filled ? 'text-amber-400' : 'text-gray-300'} ${
                        ratingSaving ? 'cursor-not-allowed opacity-70' : 'hover:text-amber-500'
                      }`}
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                      onFocus={() => setHoverRating(value)}
                      onBlur={() => setHoverRating(0)}
                      onClick={() => onSelectRating(value)}
                      disabled={ratingSaving}
                      aria-label={`Attribuer la note ${value}`}
                    >
                      <StarIcon filled={filled} className="h-8 w-8" />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>{userRating ? `Votre note actuelle : ${userRating}/5` : 'Cliquez sur une étoile pour noter ce produit.'}</span>
                {userRating ? (
                  <button
                    type="button"
                    onClick={onRemoveRating}
                    className="text-red-500 hover:underline disabled:opacity-60"
                    disabled={ratingSaving}
                  >
                    Retirer ma note
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              <Link to="/login" className="text-indigo-600 underline">Connectez-vous</Link> pour noter ce produit.
            </p>
          )}
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Commentaires</h2>
        {user ? (
          <form onSubmit={onSubmitComment} className="space-y-3">
            <textarea
              className="w-full border rounded p-3"
              placeholder="Partagez votre avis sur cette annonce"
              value={commentMessage}
              onChange={(e) => setCommentMessage(e.target.value)}
              maxLength={500}
              rows={3}
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={commentSubmitting || !commentMessage.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              >
                {commentSubmitting ? 'Envoi...' : 'Publier le commentaire'}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">
            <Link to="/login" className="text-indigo-600 underline">Connectez-vous</Link> pour laisser un commentaire.
          </p>
        )}

        {commentsLoading ? (
          <p className="text-sm text-gray-500">Chargement des commentaires…</p>
        ) : commentsError ? (
          <p className="text-sm text-red-600">{commentsError}</p>
        ) : commentTree.length ? (
          <ul className="space-y-3">
            {commentTree.map((comment) => renderComment(comment))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Soyez le premier à commenter cette annonce.</p>
        )}
      </section>
    </main>
  );
}
