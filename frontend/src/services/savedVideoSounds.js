export const SAVED_SOUNDS_CHANGED = 'hdmarket:saved-video-sounds';
const rank = (a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed;

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HDMarketVideoSounds', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('users');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function access(userId, update) {
  if (!userId) return [];
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('users', update ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('users');
      const request = store.get(String(userId));
      let entries = [];
      request.onsuccess = () => {
        entries = request.result || [];
        if (update) { entries = update(entries); store.put(entries, String(userId)); }
      };
      transaction.oncomplete = () => resolve(entries.filter(item => item.file).sort(rank));
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Stockage indisponible.'));
    });
  } finally { db.close(); }
}

export const listSavedVideoSounds = userId => access(userId);

export async function rememberVideoSound(userId, file) {
  if (!userId || !file || file.size > 20 * 1024 * 1024) return;
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const id = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  await access(userId, entries => {
    const previous = entries.find(item => item.id === id);
    const next = entries.filter(item => item.id !== id);
    next.push({ id, name: file.name, file, uses: (previous?.uses || 0) + 1, lastUsed: Date.now() });
    next.sort(rank);
    // Retain usage metadata for evicted tracks, but at most four audio blobs.
    return next.slice(0, 500).map((item, index) => index < 4 ? item : { ...item, file: null });
  });
  window.dispatchEvent(new Event(SAVED_SOUNDS_CHANGED));
}

export async function removeSavedVideoSound(userId, id) {
  await access(userId, entries => entries.filter(item => item.id !== id));
  window.dispatchEvent(new Event(SAVED_SOUNDS_CHANGED));
}
