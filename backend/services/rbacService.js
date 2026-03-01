const PERMISSIONS = Object.freeze({
  VIEW_ADMIN_DASHBOARD: 'view_admin_dashboard',
  MANAGE_USERS: 'manage_users',
  MANAGE_ORDERS: 'manage_orders',
  MANAGE_SELLERS: 'manage_sellers',
  MANAGE_SETTINGS: 'manage_settings',
  ACCESS_FOUNDER_ANALYTICS: 'access_founder_analytics',
  EDIT_USER_PROFILE: 'edit_user_profile',
  ASSIGN_ROLES: 'assign_roles',
  REVOKE_ROLES: 'revoke_roles',
  FORCE_LOGOUT: 'force_logout',
  VIEW_LOGS: 'view_logs',
  LOCK_ACCOUNTS: 'lock_accounts',
  RESET_PASSWORDS: 'reset_passwords',
  MANAGE_PERMISSIONS: 'manage_permissions',
  FOUNDER_OVERRIDE: 'founder_override',
  READ_FEEDBACK: 'read_feedback',
  VERIFY_PAYMENTS: 'verify_payments',
  MANAGE_BOOSTS: 'manage_boosts',
  MANAGE_COMPLAINTS: 'manage_complaints',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_DELIVERY: 'manage_delivery',
  MANAGE_CHAT_TEMPLATES: 'manage_chat_templates',
  MANAGE_HELP_CENTER: 'manage_help_center',
  COURIER_VIEW_ASSIGNMENTS: 'courier_view_assignments',
  COURIER_ACCEPT_ASSIGNMENT: 'courier_accept_assignment',
  COURIER_UPDATE_STATUS: 'courier_update_status',
  COURIER_UPLOAD_PROOF: 'courier_upload_proof'
});

const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

const normalizeRole = (role = 'user') => {
  const normalized = String(role || 'user').trim().toLowerCase();
  if (normalized === 'seller' || normalized === 'vendeur' || normalized === 'boutique_owner') {
    return 'seller';
  }
  if (normalized === 'founder') return 'founder';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'manager') return 'manager';
  if (normalized === 'delivery_agent' || normalized === 'delivery-agent' || normalized === 'courier') {
    return 'delivery_agent';
  }
  return 'user';
};

const ROLE_PERMISSION_MAP = Object.freeze({
  founder: ALL_PERMISSIONS,
  admin: [
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.MANAGE_SELLERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_LOGS,
    PERMISSIONS.LOCK_ACCOUNTS,
    PERMISSIONS.RESET_PASSWORDS,
    PERMISSIONS.MANAGE_PERMISSIONS,
    PERMISSIONS.READ_FEEDBACK,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.MANAGE_BOOSTS,
    PERMISSIONS.MANAGE_COMPLAINTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_DELIVERY,
    PERMISSIONS.MANAGE_CHAT_TEMPLATES,
    PERMISSIONS.MANAGE_HELP_CENTER
  ],
  manager: [
    PERMISSIONS.VIEW_ADMIN_DASHBOARD,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.MANAGE_COMPLAINTS,
    PERMISSIONS.MANAGE_PRODUCTS,
    PERMISSIONS.MANAGE_DELIVERY,
    PERMISSIONS.READ_FEEDBACK,
    PERMISSIONS.VERIFY_PAYMENTS,
    PERMISSIONS.MANAGE_BOOSTS,
    PERMISSIONS.MANAGE_CHAT_TEMPLATES,
    PERMISSIONS.MANAGE_HELP_CENTER
  ],
  delivery_agent: [
    PERMISSIONS.COURIER_VIEW_ASSIGNMENTS,
    PERMISSIONS.COURIER_ACCEPT_ASSIGNMENT,
    PERMISSIONS.COURIER_UPDATE_STATUS,
    PERMISSIONS.COURIER_UPLOAD_PROOF
  ],
  seller: [PERMISSIONS.EDIT_USER_PROFILE],
  user: [PERMISSIONS.EDIT_USER_PROFILE]
});

const LEGACY_FLAG_TO_PERMISSION = Object.freeze({
  canReadFeedback: PERMISSIONS.READ_FEEDBACK,
  canVerifyPayments: PERMISSIONS.VERIFY_PAYMENTS,
  canManageBoosts: PERMISSIONS.MANAGE_BOOSTS,
  canManageComplaints: PERMISSIONS.MANAGE_COMPLAINTS,
  canManageProducts: PERMISSIONS.MANAGE_PRODUCTS,
  canManageDelivery: PERMISSIONS.MANAGE_DELIVERY,
  canManageChatTemplates: PERMISSIONS.MANAGE_CHAT_TEMPLATES,
  canManageHelpCenter: PERMISSIONS.MANAGE_HELP_CENTER
});

const toPermissionSet = (permissions = []) =>
  new Set(
    (Array.isArray(permissions) ? permissions : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  );

export const getRolePermissions = (role = 'user') => {
  const normalizedRole = normalizeRole(role);
  return Array.from(ROLE_PERMISSION_MAP[normalizedRole] || ROLE_PERMISSION_MAP.user);
};

export const resolvePermissionsForUser = (user = {}) => {
  const role = normalizeRole(user.role);
  const merged = toPermissionSet(getRolePermissions(role));
  for (const permission of toPermissionSet(user.permissions)) {
    merged.add(permission);
  }
  for (const [legacyFlag, permission] of Object.entries(LEGACY_FLAG_TO_PERMISSION)) {
    if (user?.[legacyFlag] === true) merged.add(permission);
  }
  if (role === 'founder') {
    for (const permission of ALL_PERMISSIONS) merged.add(permission);
  }
  return Array.from(merged);
};

export const hasPermission = (user = {}, permission = '') => {
  const targetPermission = String(permission || '').trim();
  if (!targetPermission) return false;
  const role = normalizeRole(user.role);
  if (role === 'founder') return true;
  const permissions = toPermissionSet(resolvePermissionsForUser(user));
  return permissions.has(targetPermission);
};

export const hasAnyPermission = (user = {}, required = []) => {
  const list = Array.isArray(required) ? required : [required];
  return list.some((permission) => hasPermission(user, permission));
};

export const isFounderRole = (role = '') => normalizeRole(role) === 'founder';
export const isAdminFamilyRole = (role = '') => {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'manager' || normalized === 'founder';
};

export const ensureSingleFounder = (currentFounders = 0) => Number(currentFounders || 0) <= 1;

export { PERMISSIONS, ALL_PERMISSIONS, LEGACY_FLAG_TO_PERMISSION, normalizeRole };
