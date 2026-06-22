import React, { useState, useCallback } from 'react';
import { Star } from 'lucide-react';
import api from '../services/api';

/**
 * SellerRatingQuiz — 3-dimension rating quiz shown after order delivery.
 *
 * Dimensions:
 *  1. Description accuracy (Le produit correspondait-il à la description ?)
 *  2. Communication (Le vendeur a-t-il bien communiqué ?)
 *  3. Delivery satisfaction (La livraison était-elle satisfaisante ?)
 */
export default function SellerRatingQuiz({ shopId, orderId, onSubmitted }) {
  const [overallRating, setOverallRating] = useState(0);
  const [hoverOverall, setHoverOverall] = useState(0);
  const [descriptionRating, setDescriptionRating] = useState(0);
  const [hoverDescription, setHoverDescription] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [hoverCommunication, setHoverCommunication] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [hoverDelivery, setHoverDelivery] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = overallRating > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/shops/${shopId}/reviews`, {
        shopId,
        orderId,
        rating: overallRating,
        descriptionRating: descriptionRating || null,
        communicationRating: communicationRating || null,
        deliveryRating: deliveryRating || null,
        comment: comment.trim() || undefined
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de l\'envoi de l\'avis.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, shopId, orderId, overallRating, descriptionRating, communicationRating, deliveryRating, comment, onSubmitted]);

  if (submitted) {
    return (
      <div className="rounded-2xl bg-green-50 p-4 text-center">
        <p className="text-sm font-semibold text-green-700">⭐ Merci pour votre avis !</p>
        <p className="mt-1 text-xs text-green-600">Votre évaluation aide la communauté.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">Évaluez votre expérience</h3>
      <p className="mt-0.5 text-xs text-gray-500">Votre avis aide les autres acheteurs et motive les vendeurs.</p>

      {/* Overall Rating */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-700">Note globale</p>
        <div className="mt-1 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setOverallRating(star)}
              onMouseEnter={() => setHoverOverall(star)}
              onMouseLeave={() => setHoverOverall(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={24}
                className={
                  star <= (hoverOverall || overallRating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300'
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* Description Rating */}
      <div className="mt-3">
        <p className="text-xs text-gray-600">📝 Le produit correspondait-il à la description ?</p>
        <div className="mt-1 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setDescriptionRating(star)}
              onMouseEnter={() => setHoverDescription(star)}
              onMouseLeave={() => setHoverDescription(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={18}
                className={
                  star <= (hoverDescription || descriptionRating)
                    ? 'fill-blue-400 text-blue-400'
                    : 'text-gray-200'
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* Communication Rating */}
      <div className="mt-2">
        <p className="text-xs text-gray-600">💬 Le vendeur a-t-il bien communiqué ?</p>
        <div className="mt-1 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setCommunicationRating(star)}
              onMouseEnter={() => setHoverCommunication(star)}
              onMouseLeave={() => setHoverCommunication(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={18}
                className={
                  star <= (hoverCommunication || communicationRating)
                    ? 'fill-green-400 text-green-400'
                    : 'text-gray-200'
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Rating */}
      <div className="mt-2">
        <p className="text-xs text-gray-600">🚚 La livraison était-elle satisfaisante ?</p>
        <div className="mt-1 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setDeliveryRating(star)}
              onMouseEnter={() => setHoverDelivery(star)}
              onMouseLeave={() => setHoverDelivery(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={18}
                className={
                  star <= (hoverDelivery || deliveryRating)
                    ? 'fill-orange-400 text-orange-400'
                    : 'text-gray-200'
                }
              />
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="mt-3">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Partagez votre expérience (optionnel)..."
          maxLength={500}
          rows={2}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-200"
        />
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="mt-3 w-full rounded-xl bg-gray-1000 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Envoi...' : 'Envoyer mon avis'}
      </button>
    </div>
  );
}
