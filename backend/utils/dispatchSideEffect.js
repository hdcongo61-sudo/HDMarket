import { enqueueSideEffectJob } from '../queues/sideEffectQueue.js';
import { safeAsync } from './safeAsync.js';

export const dispatchSideEffect = (name, data = {}, fallbackFn = null, options = {}) => {
  const label = options.label || `side_effect:${name}`;
  const enqueuePromise = enqueueSideEffectJob(name, data, options)
    .then((job) => {
      if (job || typeof fallbackFn !== 'function') return job;
      return safeAsync(fallbackFn, { label, fallback: null });
    })
    .catch((error) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[${label}] queue dispatch failed`, error?.message || error);
      }
      if (typeof fallbackFn === 'function') {
        return safeAsync(fallbackFn, { label, fallback: null });
      }
      return null;
    });

  return enqueuePromise;
};

export default dispatchSideEffect;
