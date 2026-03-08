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
        icon={<Flag className="w-5 h-5 text-red-600 dark:text-red-400" />}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          {productTitle && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="mb-1 text-xs text-gray-500 dark:text-slate-400">Produit concerné</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{productTitle}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-200">
              Raison du signalement <span className="text-gray-400 dark:text-slate-500">(optionnel)</span>
            </label>
            <textarea
              data-autofocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Décrivez pourquoi vous signalez ce contenu..."
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
              rows={4}
              maxLength={500}
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{reason.length}/500 caractères</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-900/20">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-300" />
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
