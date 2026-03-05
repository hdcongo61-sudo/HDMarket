import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isApiTimeoutError } from '../services/api';
import { createIdempotencyKey } from '../utils/idempotency';
import { verifyEventually } from '../utils/reliability';

const DEFAULT_VERIFY_DELAYS_MS = [2000, 4000, 6000];
const DEFAULT_STILL_WORKING_MS = 6000;
const DEFAULT_SLOW_MS = 11_000;

const clearTimer = (timerRef) => {
  if (!timerRef?.current) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
};

export const useReliableMutation = ({
  mutationFn,
  verifyFn = null,
  verifyDelaysMs = DEFAULT_VERIFY_DELAYS_MS,
  stillWorkingDelayMs = DEFAULT_STILL_WORKING_MS,
  slowDelayMs = DEFAULT_SLOW_MS,
  onMutate,
  onSuccess,
  onError,
  onSettled
} = {}) => {
  const [uiPhase, setUiPhase] = useState('idle'); // idle | loading | stillWorking | slow | success | error
  const stillWorkingTimerRef = useRef(null);
  const slowTimerRef = useRef(null);

  const clearUiTimers = () => {
    clearTimer(stillWorkingTimerRef);
    clearTimer(slowTimerRef);
  };

  useEffect(() => () => clearUiTimers(), []);

  const mutation = useMutation({
    mutationFn: async (variables = {}) => {
      const idempotencyKey =
        String(variables.idempotencyKey || '').trim() || createIdempotencyKey('mutation');
      try {
        const data = await mutationFn({ ...variables, idempotencyKey });
        return { data, recovered: false };
      } catch (error) {
        if (!isApiTimeoutError(error) || typeof verifyFn !== 'function') {
          throw error;
        }
        const confirmed = await verifyEventually({
          delaysMs: verifyDelaysMs,
          checkFn: () => verifyFn({ ...variables, idempotencyKey, error })
        });
        if (confirmed) {
          return { data: confirmed === true ? null : confirmed, recovered: true };
        }
        throw error;
      }
    },
    onMutate: async (variables) => {
      clearUiTimers();
      setUiPhase('loading');
      stillWorkingTimerRef.current = setTimeout(() => {
        setUiPhase((current) => (current === 'loading' ? 'stillWorking' : current));
      }, Math.max(1000, Number(stillWorkingDelayMs || DEFAULT_STILL_WORKING_MS)));
      slowTimerRef.current = setTimeout(() => {
        setUiPhase((current) =>
          current === 'loading' || current === 'stillWorking' ? 'slow' : current
        );
      }, Math.max(2000, Number(slowDelayMs || DEFAULT_SLOW_MS)));
      if (typeof onMutate === 'function') {
        return onMutate(variables);
      }
      return undefined;
    },
    onSuccess: async (result, variables, context) => {
      setUiPhase('success');
      if (typeof onSuccess === 'function') {
        await onSuccess(result, variables, context);
      }
    },
    onError: async (error, variables, context) => {
      if (isApiTimeoutError(error)) {
        setUiPhase('slow');
      } else {
        setUiPhase('error');
      }
      if (typeof onError === 'function') {
        await onError(error, variables, context);
      }
    },
    onSettled: async (data, error, variables, context) => {
      clearUiTimers();
      if (typeof onSettled === 'function') {
        await onSettled(data, error, variables, context);
      }
    }
  });

  return {
    ...mutation,
    uiPhase,
    isReliablePending: mutation.isPending,
    resetUiPhase: () => setUiPhase('idle')
  };
};

export default useReliableMutation;
