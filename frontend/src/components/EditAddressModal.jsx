import React, { useState, useEffect } from 'react';
import { X, MapPin, AlertCircle } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Modifier l'adresse de livraison
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Entrez la nouvelle adresse complète..."
                  rows={3}
                  required
                  minLength={4}
                  maxLength={300}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info Message */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <span className="font-semibold">Note :</span> La modification de l'adresse sera notifiée aux vendeurs concernés.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
