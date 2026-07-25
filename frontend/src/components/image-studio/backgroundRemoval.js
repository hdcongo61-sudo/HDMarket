// Main-thread bridge to backgroundRemoval.worker.js. The worker (and its
// @huggingface/transformers import) is only fetched when a Worker is first
// instantiated, so pages that never open Image Studio never pay for it.
let worker = null;
let requestId = 0;
const pending = new Map();

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('./backgroundRemoval.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (event) => {
    const { id, status, percent, blob, error } = event.data || {};
    const entry = pending.get(id);
    if (!entry) return;
    if (status === 'downloading') {
      entry.onProgress?.(percent);
      return;
    }
    if (status === 'processing') {
      entry.onProgress?.(null);
      return;
    }
    pending.delete(id);
    if (status === 'done') entry.resolve(blob);
    else entry.reject(new Error(error || 'Le retrait du fond a échoué.'));
  };
  worker.onerror = () => {
    pending.forEach(({ reject }) => reject(new Error('Le module IA local a rencontré une erreur.')));
    pending.clear();
  };
  return worker;
};

export const removeBackgroundLocally = (blob, { onProgress } = {}) => {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, blob });
  });
};
