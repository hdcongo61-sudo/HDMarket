import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext({ showToast: () => {} });

const VARIANT_STYLES = {
  success: 'border-green-200 bg-white text-green-700',
  error: 'border-red-200 bg-white text-red-700',
  info: 'border-neutral-200 bg-white text-neutral-700'
};

const VARIANT_ICON_BG = {
  success: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
  info: 'bg-neutral-100 text-neutral-800'
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const lastGlobalErrorToastRef = useRef({ key: '', at: 0 });

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message, options = {}) => {
      if (!message) return;
      const normalized =
        typeof options === 'string'
          ? { variant: options }
          : Array.isArray(options)
          ? {}
          : options;

      const { variant = 'success', duration = 4000 } = normalized;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setToasts((prev) => [...prev, { id, message, variant }]);

      if (Number.isFinite(duration) && duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const contextValue = useMemo(
    () => ({
      showToast
    }),
    [showToast]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleGlobalError = (event) => {
      const message = String(
        event?.detail?.message || 'Une erreur est survenue. Veuillez réessayer.'
      ).trim();
      if (!message) return;
      const code = String(event?.detail?.code || 'GLOBAL_ERROR');
      const requestId = String(event?.detail?.requestId || '').trim();
      const throttleKey = `${code}:${message}`;
      const now = Date.now();
      const previous = lastGlobalErrorToastRef.current;
      if (previous.key === throttleKey && now - previous.at < 6000) {
        return;
      }
      lastGlobalErrorToastRef.current = { key: throttleKey, at: now };
      const suffix = requestId ? ` (ref: ${requestId.slice(0, 12)})` : '';
      showToast(`${message}${suffix}`, { variant: 'error' });
    };

    window.addEventListener('hdmarket:api-error', handleGlobalError);
    window.addEventListener('hdmarket:query-error', handleGlobalError);
    window.addEventListener('hdmarket:ui-error', handleGlobalError);
    return () => {
      window.removeEventListener('hdmarket:api-error', handleGlobalError);
      window.removeEventListener('hdmarket:query-error', handleGlobalError);
      window.removeEventListener('hdmarket:ui-error', handleGlobalError);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-24 right-4 z-[1050] flex flex-col gap-3">
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.success;
          const iconStyle = VARIANT_ICON_BG[toast.variant] || VARIANT_ICON_BG.success;
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all ${style}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${iconStyle}`}>
                <span className="text-sm font-semibold">!</span>
              </div>
              <div className="flex-1 text-sm leading-relaxed">{toast.message}</div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="ml-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
              >
                Fermer
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur de ToastProvider.');
  }
  return context;
};
