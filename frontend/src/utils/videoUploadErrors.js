const ACCEPTED_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
const ACCEPTED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export const getVideoFilesUploadProgress = (files, loaded, total) => {
  const sizes = files.map((file) => Math.max(0, Number(file?.size || 0)));
  const filesTotal = sizes.reduce((sum, size) => sum + size, 0);
  if (!filesTotal) return sizes.map(() => 0);

  const requestTotal = Math.max(0, Number(total || 0));
  const requestLoaded = Math.max(0, Number(loaded || 0));
  const requestRatio = requestTotal
    ? Math.min(1, requestLoaded / requestTotal)
    : Math.min(1, requestLoaded / filesTotal);
  const estimatedFilesLoaded = requestRatio * filesTotal;
  let offset = 0;

  return sizes.map((size) => {
    const progress = size
      ? Math.min(100, Math.max(0, Math.round(((estimatedFilesLoaded - offset) / size) * 100)))
      : 0;
    offset += size;
    return progress;
  });
};

export const getVideoFileValidationError = (file) => {
  if (!file) return 'Sélectionnez une vidéo.';
  const extension = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const type = String(file.type || '').split(';')[0].trim().toLowerCase();
  if (!ACCEPTED_VIDEO_EXTENSIONS.has(extension) || (type && !ACCEPTED_VIDEO_TYPES.has(type))) {
    return `${file.name || 'Ce fichier'} n’est pas au format MP4, MOV ou WEBM.`;
  }
  if (!Number(file.size || 0)) {
    return `${file.name || 'Cette vidéo'} est vide ou inaccessible.`;
  }
  return '';
};

export const getVideoUploadErrorMessage = (
  error,
  fallback = 'Téléversement impossible. Réessayez dans quelques instants.'
) => {
  const serverMessage = String(error?.response?.data?.message || '').trim();
  if (serverMessage) return serverMessage;

  const code = String(error?.code || error?.response?.data?.code || '').toUpperCase();
  const rawMessage = String(error?.message || '').toLowerCase();
  const status = Number(error?.response?.status || 0);

  if (status === 413 || code === 'LIMIT_FILE_SIZE' || rawMessage.includes('file too large')) {
    return 'La vidéo est trop volumineuse pour être envoyée. Compressez-la puis réessayez.';
  }
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || rawMessage.includes('timeout')) {
    return 'L’envoi a pris trop de temps. Vérifiez votre connexion puis réessayez.';
  }
  if (!error?.response) {
    return 'La connexion a été interrompue pendant l’envoi. Votre vidéo n’a pas été publiée.';
  }
  return fallback;
};
