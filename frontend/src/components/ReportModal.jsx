import React, { useState } from 'react';
import { X, Flag, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ReportModal({ isOpen, onClose, type, commentId, productId, photoUrl, productTitle }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId) {
      setError('ID du produit requis.');
      return;
    }
    if (type === 'comment' && !commentId) {
      setError('ID du commentaire requis.');
      return;
    }
    if (type === 'photo' && !photoUrl) {
      setError('URL de la photo requise.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/users/reports', {
        type,
        commentId: type === 'comment' ? commentId : null,
        productId,
        photoUrl: type === 'photo' ? photoUrl : null,
        reason: reason.trim() || undefined
      });

      showToast('Signalement envoyé avec succès. Merci pour votre vigilance.', { variant: 'success' });
      setReason('');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Erreur lors de l\'envoi du signalement.';
      setError(msg);
      showToast(msg, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Signaler du contenu</h2>
              <p className="text-xs text-gray-500">
                {type === 'comment' ? 'Signaler un commentaire' : 'Signaler une photo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {productTitle && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Produit concerné</p>
              <p className="text-sm font-semibold text-gray-900">{productTitle}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Raison du signalement <span className="text-gray-400">(optionnel)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrivez pourquoi vous signalez ce contenu..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
              rows={4}
              maxLength={500}
              disabled={submitting}
            />
            <p className="text-xs text-gray-400 mt-1">{reason.length}/500 caractères</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Envoi...' : 'Signaler'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
