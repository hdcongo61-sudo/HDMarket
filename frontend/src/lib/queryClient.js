import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

const QUERY_RETRY_DELAY_MS = 2000;

const isRetryableClientError = (error) => {
  const status = Number(error?.response?.status || 0);
  if ([401, 403, 404, 409, 422].includes(status)) return false;
  return status >= 500 || status === 429 || status === 0 || Boolean(error?.isTimeout);
};

const getSafeErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.userMessage ||
  (error?.isTimeout
    ? 'Le serveur met trop de temps à répondre. Réessayez.'
    : 'Une erreur est survenue. Veuillez réessayer.');

const dispatchGlobalQueryError = (error, type) => {
  if (typeof window === 'undefined') return;
  const message = getSafeErrorMessage(error);
  const requestId =
    error?.requestId ||
    error?.response?.data?.requestId ||
    error?.response?.headers?.['x-request-id'] ||
    '';
  window.dispatchEvent(
    new CustomEvent('hdmarket:query-error', {
      detail: {
        message,
        code: type === 'mutation' ? 'MUTATION_ERROR' : 'QUERY_ERROR',
        requestId
      }
    })
  );
};

const flattenQueryKey = (queryKey = []) => {
  if (!Array.isArray(queryKey)) return [];
  return queryKey.flatMap((part) => {
    if (Array.isArray(part)) return flattenQueryKey(part);
    if (part && typeof part === 'object') {
      return Object.entries(part).flatMap(([key, value]) => [String(key), String(value)]);
    }
    return [String(part)];
  });
};

const getQueryScope = (query) =>
  flattenQueryKey(query?.queryKey || [])
    .join(':')
    .toLowerCase();

const resolveStaleTime = (query) => {
  const scope = getQueryScope(query);
  if (scope.includes('categorie') || scope.includes('category') || scope.includes('cities')) {
    return 30 * 60 * 1000;
  }
  if (scope.includes('product') || scope.includes('shop') || scope.includes('home')) {
    return 5 * 60 * 1000;
  }
  if (scope.includes('notification') || scope.includes('task')) {
    return 30 * 1000;
  }
  if (scope.includes('order') || scope.includes('delivery') || scope.includes('cart')) {
    return 60 * 1000;
  }
  return 45 * 1000;
};

const resolveGcTime = (query) => {
  const staleTime = resolveStaleTime(query);
  return Math.max(10 * 60 * 1000, staleTime * 3);
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error?.name === 'CanceledError') return;
      dispatchGlobalQueryError(error, 'query');
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error?.name === 'CanceledError') return;
      dispatchGlobalQueryError(error, 'mutation');
    }
  }),
  defaultOptions: {
    queries: {
      staleTime: resolveStaleTime,
      gcTime: resolveGcTime,
      retry: (failureCount, error) => failureCount < 1 && isRetryableClientError(error),
      retryDelay: () => QUERY_RETRY_DELAY_MS,
      networkMode: 'online',
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 0
    }
  }
});

export default queryClient;
