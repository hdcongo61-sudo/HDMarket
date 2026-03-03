export const normalizeMediaUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}/${raw.replace(/^\/+/, '')}`;
};

export const resolveUserProfileImage = (user = {}) =>
  normalizeMediaUrl(
    user?.profileImage ||
      user?.avatar ||
      user?.photoUrl ||
      user?.shopLogo ||
      ''
  );

