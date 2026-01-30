import { useState, useEffect, useRef } from 'react';
import api, { clearCache } from '../services/api';
import indexedDB, { STORES } from '../utils/indexedDB';

/**
 * Custom hook for fetching and caching data
 * @param {string} url - API endpoint URL
 * @param {object} options - Configuration options
 * @param {object} options.params - Query parameters
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * @param {number} options.refetchInterval - Auto-refetch interval in ms
 * @param {function} options.onSuccess - Success callback
 * @param {function} options.onError - Error callback
 * @param {boolean} options.skipCache - Skip cache for this request
 * @returns {object} { data, loading, error, refetch, clearCache }
 */
export function useCachedData(url, options = {}) {
  const {
    params = {},
    enabled = true,
    refetchInterval = null,
    onSuccess = null,
    onError = null,
    skipCache = false,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchData = async (force = false) => {
    if (!enabled && !force) return;

    setLoading(true);
    setError(null);

    try {
      const config = {
        params,
        ...(skipCache || force ? { skipCache: true } : {}),
      };

      const response = await api.get(url, config);
      const responseData = response.data;

      if (mountedRef.current) {
        setData(responseData);
        if (onSuccess) onSuccess(responseData);
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err.response?.data?.message || err.message || 'Une erreur est survenue';
        setError(errorMessage);
        if (onError) onError(err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    // Set up auto-refetch interval if provided
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData();
      }, refetchInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [url, JSON.stringify(params), enabled]);

  const refetch = () => {
    return fetchData(true);
  };

  const clearCacheForUrl = () => {
    clearCache(url);
  };

  return {
    data,
    loading,
    error,
    refetch,
    clearCache: clearCacheForUrl,
  };
}

/**
 * Hook for fetching paginated data with caching
 */
export function useCachedPaginatedData(url, options = {}) {
  const {
    initialPage = 1,
    pageSize = 12,
    params = {},
    enabled = true,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchPage = async (pageNum) => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(url, {
        params: {
          ...params,
          page: pageNum,
          limit: pageSize,
        },
      });

      const responseData = response.data;
      const fetchedItems = Array.isArray(responseData) 
        ? responseData 
        : responseData?.items || [];
      const pagination = responseData?.pagination || {};

      setItems(fetchedItems);
      setTotalPages(Math.max(1, Number(pagination.pages) || 1));
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Une erreur est survenue';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(page);
  }, [url, page, JSON.stringify(params), enabled]);

  const goToPage = (newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const nextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const prevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  return {
    items,
    page,
    totalPages,
    loading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refetch: () => fetchPage(page),
  };
}
