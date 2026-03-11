import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../components/ui/alert-dialog';
import { bindAppDialogBridge } from '../utils/appDialog';

const AlertDialogContext = createContext({
  alert: async () => {},
  confirm: async () => false
});

const normalizePayload = (input, fallback = {}) => {
  if (typeof input === 'string') {
    return {
      ...fallback,
      title: fallback.title || 'Confirmation',
      description: input
    };
  }
  return {
    ...fallback,
    ...(input && typeof input === 'object' ? input : {})
  };
};

export function AlertDialogProvider({ children }) {
  const queueRef = useRef([]);
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState(null);

  const closeCurrent = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setDialogState(null);
    const nextTask = queueRef.current.shift();
    if (nextTask) {
      setDialogState(nextTask.state);
      resolverRef.current = nextTask.resolve;
    }
  }, []);

  const enqueueDialog = useCallback(
    (state) =>
      new Promise((resolve) => {
        if (!dialogState && !resolverRef.current) {
          setDialogState(state);
          resolverRef.current = resolve;
          return;
        }
        queueRef.current.push({ state, resolve });
      }),
    [dialogState]
  );

  const alert = useCallback(
    async (input, options = {}) => {
      const payload = normalizePayload(input, options);
      await enqueueDialog({
        mode: 'alert',
        title: payload.title || 'Information',
        description: payload.description || '',
        confirmText: payload.confirmText || 'OK',
        tone: payload.tone || 'default'
      });
      return true;
    },
    [enqueueDialog]
  );

  const confirm = useCallback(
    async (input, options = {}) => {
      const payload = normalizePayload(input, options);
      const result = await enqueueDialog({
        mode: 'confirm',
        title: payload.title || 'Confirmation',
        description: payload.description || '',
        confirmText: payload.confirmText || 'Confirmer',
        cancelText: payload.cancelText || 'Annuler',
        tone: payload.tone || 'default'
      });
      return Boolean(result);
    },
    [enqueueDialog]
  );

  useEffect(() => {
    const unbind = bindAppDialogBridge({
      alert,
      confirm
    });
    return () => {
      unbind?.();
    };
  }, [alert, confirm]);

  const value = useMemo(
    () => ({
      alert,
      confirm
    }),
    [alert, confirm]
  );

  const isOpen = Boolean(dialogState);
  const isDestructive = dialogState?.tone === 'destructive';

  return (
    <AlertDialogContext.Provider value={value}>
      {children}
      <AlertDialog
        open={isOpen}
        onOpenChange={(next) => {
          if (!next && dialogState) {
            closeCurrent(false);
          }
        }}
      >
        <AlertDialogContent className="glass-card border border-white/20 bg-white/95 p-5 dark:border-white/10 dark:bg-slate-950/95">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogState?.title || 'Confirmation'}</AlertDialogTitle>
            {dialogState?.description ? (
              <AlertDialogDescription>{dialogState.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {dialogState?.mode === 'confirm' ? (
              <AlertDialogCancel onClick={() => closeCurrent(false)}>
                {dialogState?.cancelText || 'Annuler'}
              </AlertDialogCancel>
            ) : null}
            <AlertDialogAction
              className={
                isDestructive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
              }
              onClick={() => closeCurrent(true)}
            >
              {dialogState?.confirmText || 'OK'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AlertDialogContext.Provider>
  );
}

export function useAppAlertDialog() {
  return useContext(AlertDialogContext);
}

