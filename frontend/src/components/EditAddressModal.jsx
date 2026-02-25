import React, { useEffect, useId, useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import BaseModal, { ModalBody, ModalFooter, ModalHeader } from './modals/BaseModal';

export default function EditAddressModal({ isOpen, onClose, order, onSave }) {
  const { cities } = useAppSettings();
  const cityOptions = Array.isArray(cities) && cities.length
    ? cities.map((item) => item.name).filter(Boolean)
    : ['Brazzaville', 'Pointe-Noire', 'Ouesso', 'Oyo'];
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState(cityOptions[0] || 'Brazzaville');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      setDeliveryAddress(order.deliveryAddress || '');
      setDeliveryCity(order.deliveryCity || cityOptions[0] || 'Brazzaville');
      setError('');
    }
  }, [cityOptions, isOpen, order]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 4) {
      setError('L\'adresse doit contenir au moins 4 caractères.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        deliveryAddress: deliveryAddress.trim(),
        deliveryCity
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de modifier l\'adresse.');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = order && order.status !== 'delivering' && order.status !== 'delivered' && order.status !== 'cancelled';
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
        title="Modifier l'adresse de livraison"
        icon={<MapPin className="w-5 h-5" />}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-4">
          {!canEdit && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Modification impossible
                </p>
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  L'adresse ne peut être modifiée que pour les commandes en attente ou confirmées, avant l'expédition.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {canEdit && (
            <>
              {/* Current Address Info */}
              {order && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Adresse actuelle
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {order.deliveryAddress}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {order.deliveryCity}
                  </p>
                </div>
              )}

              {/* Address Input */}
              <div>
                <label htmlFor="deliveryAddress" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Nouvelle adresse de livraison *
                </label>
                <textarea
                  data-autofocus
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Entrez la nouvelle adresse complète..."
                  rows={3}
                  required
                  minLength={4}
                  maxLength={300}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum 4 caractères, maximum 300 caractères
                </p>
              </div>

              {/* City Select */}
              <div>
                <label htmlFor="deliveryCity" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Ville *
                </label>
                <select
                  id="deliveryCity"
                  value={deliveryCity}
                  onChange={(e) => setDeliveryCity(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-neutral-500 focus:border-neutral-500 transition-all"
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Message */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/20 border border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-800 dark:text-neutral-300">
                  <span className="font-semibold">Note :</span> La modification de l'adresse sera notifiée aux vendeurs concernés.
                </p>
              </div>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            {canEdit && (
              <button
                type="submit"
                disabled={loading || !deliveryAddress.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-600 text-white font-semibold hover:bg-neutral-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
          </div>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}
