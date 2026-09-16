// Shared worker: the model downloads only when a seller requests background removal.
let worker = null;
let requestId = 0;
const pending = new Map();

const finish = (id, error, blob) => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  entry.cleanup();
  if (error) entry.reject(error);
  else entry.resolve(blob);
};

const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL('./backgroundRemoval.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data = {} }) => {
    const { id, status, percent, blob, error } = data;
    const entry = pending.get(id);
    if (!entry) return;
    if (status === 'downloading') entry.onProgress?.(percent);
    else if (status === 'processing') entry.onProgress?.(null);
    else if (status === 'done' && blob instanceof Blob) finish(id, null, blob);
    else finish(id, new Error(error || 'Le retrait du fond a échoué.'));
  };
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    [...pending.keys()].forEach(id => finish(id, new Error('Le module de détourage a rencontré une erreur. Réessayez.')));
  };
  return worker;
};

export const removeBackgroundLocally = (blob, { onProgress, signal } = {}) => {
  if (signal?.aborted) return Promise.reject(new DOMException('Traitement annulé.', 'AbortError'));
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    const cancel = () => {
      finish(id, new DOMException('Traitement annulé.', 'AbortError'));
      if (!pending.size) { worker?.terminate(); worker = null; }
    };
    pending.set(id, { resolve, reject, onProgress, cleanup: () => signal?.removeEventListener('abort', cancel) });
    signal?.addEventListener('abort', cancel, { once: true });
    try { getWorker().postMessage({ id, blob }); }
    catch (error) { finish(id, error); }
  });
};
