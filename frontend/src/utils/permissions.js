export const normalizePermissions = (permissions) =>
  Array.isArray(permissions)
    ? permissions.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'founder') return true;
  const target = String(permission || '').trim();
  if (!target) return false;
  const perms = new Set(normalizePermissions(user.permissions));
  return perms.has(target);
};

export const hasAnyPermission = (user, permissions = []) => {
  const list = Array.isArray(permissions) ? permissions : [permissions];
  return list.some((permission) => hasPermission(user, permission));
};
