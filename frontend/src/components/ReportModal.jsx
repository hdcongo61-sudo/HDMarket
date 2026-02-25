import React, { useId, useState } from 'react';
import { Flag, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from './modals/BaseModal';

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

  const titleId = useId();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      mobileSheet={true}
      ariaLabelledBy={titleId}
    >
      <ModalHeader
        titleId={titleId}
        title="Signaler du contenu"
        subtitle={type === 'comment' ? 'Signaler un commentaire' : 'Signaler une photo'}
        icon={<Flag className="w-5 h-5 text-red-600" />}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
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
              data-autofocus
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
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
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
        </ModalFooter>
      </form>
    </BaseModal>
  );
}
