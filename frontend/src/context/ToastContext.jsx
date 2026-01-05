import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext({ showToast: () => {} });

const VARIANT_STYLES = {
  success: 'border-green-200 bg-white text-green-700',
  error: 'border-red-200 bg-white text-red-700',
  info: 'border-indigo-200 bg-white text-indigo-700'
};

const VARIANT_ICON_BG = {
  success: 'bg-green-100 text-green-600',
  error: 'bg-red-100 text-red-600',
  info: 'bg-indigo-100 text-indigo-600'
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

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
    const handleNetworkError = (event) => {
      const message =
        event?.detail?.message ||
        'Il semble que vous soyez hors ligne. Connectez-vous à Internet pour continuer.';
      showToast(message, { variant: 'error' });
    };
    window.addEventListener('hdmarket:network-error', handleNetworkError);
    return () => {
      window.removeEventListener('hdmarket:network-error', handleNetworkError);
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
