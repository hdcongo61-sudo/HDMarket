import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Hook to fetch and use network phone numbers
 * @returns {Object} { networks, loading, error, refresh }
 */
export function useNetworks() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNetworks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/settings/networks', { skipCache: true });
      const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setNetworks(list);
    } catch (err) {
      console.error('Failed to fetch networks:', err);
      setError(err.response?.data?.message || 'Erreur lors du chargement des réseaux.');
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworks();
  }, []);

  return {
    networks,
    loading,
    error,
    refresh: fetchNetworks
  };
}

/**
 * Get the first active network phone number
 * @param {Array} networks - Array of network objects
 * @returns {string|null} Phone number or null
 */
export function getFirstNetworkPhone(networks) {
  if (!Array.isArray(networks) || networks.length === 0) return null;
  const active = networks.filter((n) => n.isActive);
  if (active.length === 0) return null;
  return active[0].phoneNumber || null;
}

/**
 * Get network phone number by name
 * @param {Array} networks - Array of network objects
 * @param {string} name - Network name (e.g., 'MTN', 'Airtel')
 * @returns {string|null} Phone number or null
 */
export function getNetworkPhoneByName(networks, name) {
  if (!Array.isArray(networks) || !name) return null;
  const network = networks.find((n) => n.isActive && n.name?.toLowerCase() === name?.toLowerCase());
  return network?.phoneNumber || null;
}

/**
 * Format networks for display (e.g., "MTN: +242 06 000 00 00")
 * @param {Array} networks - Array of network objects
 * @returns {Array} Array of formatted strings
 */
export function formatNetworksForDisplay(networks) {
  if (!Array.isArray(networks)) return [];
  return networks
    .filter((n) => n.isActive)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((n) => ({
      name: n.name,
      phoneNumber: n.phoneNumber,
      display: `${n.name}: ${n.phoneNumber}`
    }));
}
