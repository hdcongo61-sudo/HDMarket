import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

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
      staleTime: 15 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => failureCount < 1 && isRetryableClientError(error),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 0
    }
  }
});

export default queryClient;
