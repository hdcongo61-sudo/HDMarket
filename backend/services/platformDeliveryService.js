import { getManyRuntimeConfigs } from './configService.js';
import { hasAnyPermission } from './rbacService.js';

const DEFAULT_MANAGER_ROLES = ['DELIVERY_MANAGER', 'ADMIN', 'FOUNDER'];
const DEFAULT_PRICE_MODE = 'HYBRID';

const normalizeRoleToken = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'delivery_manager') return 'manager';
  if (normalized === 'seller') return 'user';
  return normalized;
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'oui', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'non', 'off'].includes(normalized)) return false;
  }
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const escapeRegex = (value = '') =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getPlatformDeliveryRuntime = async () => {
  const settings = await getManyRuntimeConfigs([
    'enable_platform_delivery',
    'enable_delivery_requests',
    'delivery_manager_roles',
    'delivery_commune_filters_enabled',
    'delivery_default_price_mode',
    'delivery_price_admin_by_commune',
    'delivery_request_expire_hours',
    'delivery_max_active_requests_per_shop',
    'delivery_auto_reminder_enabled',
    'delivery_auto_reminder_hours',
    'delivery_require_invoice_attachment'
  ]);

  const managerRolesRaw = Array.isArray(settings.delivery_manager_roles)
    ? settings.delivery_manager_roles
    : DEFAULT_MANAGER_ROLES;
  const managerRoles = Array.from(
    new Set(managerRolesRaw.map((item) => normalizeRoleToken(item)).filter(Boolean))
  );

  const priceModeRaw = String(settings.delivery_default_price_mode || DEFAULT_PRICE_MODE)
    .trim()
    .toUpperCase();
  const priceMode = ['ADMIN_RULES', 'SELLER_DEFINED', 'BUYER_DEFINED', 'HYBRID'].includes(priceModeRaw)
    ? priceModeRaw
    : DEFAULT_PRICE_MODE;

  return {
    enablePlatformDelivery: toBoolean(settings.enable_platform_delivery, false),
    enableDeliveryRequests: toBoolean(settings.enable_delivery_requests, true),
    managerRoles,
    communeFiltersEnabled: toBoolean(settings.delivery_commune_filters_enabled, true),
    priceMode,
    adminPriceMap:
      settings.delivery_price_admin_by_commune &&
      typeof settings.delivery_price_admin_by_commune === 'object' &&
      !Array.isArray(settings.delivery_price_admin_by_commune)
        ? settings.delivery_price_admin_by_commune
        : {},
    requestExpireHours: Math.max(1, toNumber(settings.delivery_request_expire_hours, 24)),
    maxActiveRequestsPerShop: Math.max(1, toNumber(settings.delivery_max_active_requests_per_shop, 20)),
    autoReminderEnabled: toBoolean(settings.delivery_auto_reminder_enabled, false),
    autoReminderHours: Math.max(1, toNumber(settings.delivery_auto_reminder_hours, 4)),
    requireInvoiceAttachment: toBoolean(settings.delivery_require_invoice_attachment, false)
  };
};

export const isPlatformDeliveryEnabled = async () => {
  const runtime = await getPlatformDeliveryRuntime();
  return runtime.enablePlatformDelivery && runtime.enableDeliveryRequests;
};

export const assertPlatformDeliveryEnabled = async () => {
  const runtime = await getPlatformDeliveryRuntime();
  if (!runtime.enablePlatformDelivery || !runtime.enableDeliveryRequests) {
    const error = new Error('La livraison plateforme est désactivée.');
    error.statusCode = 403;
    throw error;
  }
  return runtime;
};

export const canManageDeliveryRequests = (user, runtime) => {
  if (!user) return false;
  if (user.role === 'founder') return true;
  if (hasAnyPermission(user, ['manage_delivery']) || user.canManageDelivery === true) return true;
  const roles = Array.isArray(runtime?.managerRoles) ? runtime.managerRoles : [];
  if (!roles.length) return false;
  return roles.includes(normalizeRoleToken(user.role));
};

const findAdminRulePrice = ({
  adminPriceMap = {},
  pickupCommuneId = '',
  dropoffCommuneId = '',
  pickupCommuneName = '',
  dropoffCommuneName = ''
}) => {
  if (!adminPriceMap || typeof adminPriceMap !== 'object') return null;

  const candidates = [
    `${pickupCommuneId}:${dropoffCommuneId}`,
    `${pickupCommuneId}->${dropoffCommuneId}`,
    `${pickupCommuneName}:${dropoffCommuneName}`,
    `${pickupCommuneName}->${dropoffCommuneName}`,
    `${pickupCommuneId}:*`,
    `${pickupCommuneName}:*`,
    `*:${dropoffCommuneId}`,
    `*:${dropoffCommuneName}`,
    `${dropoffCommuneId}`,
    `${dropoffCommuneName}`,
    'default'
  ].map((item) => String(item || '').trim()).filter(Boolean);

  for (const key of candidates) {
    if (!Object.prototype.hasOwnProperty.call(adminPriceMap, key)) continue;
    const value = toNumber(adminPriceMap[key], NaN);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
};

export const resolvePlatformDeliveryPrice = ({
  runtime,
  seller,
  order,
  pickupCommuneId,
  dropoffCommuneId,
  pickupCommuneName,
  dropoffCommuneName,
  buyerSuggestedPrice
}) => {
  const mode = String(runtime?.priceMode || DEFAULT_PRICE_MODE).toUpperCase();
  const sellerPrice = Math.max(0, toNumber(order?.deliveryFeeTotal, 0));
  const buyerPrice = Math.max(0, toNumber(buyerSuggestedPrice, 0));
  const adminRulePrice = findAdminRulePrice({
    adminPriceMap: runtime?.adminPriceMap || {},
    pickupCommuneId: String(pickupCommuneId || ''),
    dropoffCommuneId: String(dropoffCommuneId || ''),
    pickupCommuneName: String(pickupCommuneName || ''),
    dropoffCommuneName: String(dropoffCommuneName || '')
  });

  if (mode === 'ADMIN_RULES') {
    return {
      deliveryPrice: Math.max(0, Number(adminRulePrice ?? 0)),
      deliveryPriceSource: adminRulePrice !== null ? 'ADMIN_RULE' : 'SELLER'
    };
  }

  if (mode === 'SELLER_DEFINED') {
    if (seller?.freeDeliveryEnabled) {
      return { deliveryPrice: 0, deliveryPriceSource: 'SHOP_FREE' };
    }
    if (sellerPrice > 0) return { deliveryPrice: sellerPrice, deliveryPriceSource: 'SELLER' };
    if (adminRulePrice !== null) return { deliveryPrice: adminRulePrice, deliveryPriceSource: 'ADMIN_RULE' };
    return { deliveryPrice: 0, deliveryPriceSource: 'SELLER' };
  }

  if (mode === 'BUYER_DEFINED') {
    return { deliveryPrice: buyerPrice, deliveryPriceSource: 'BUYER' };
  }

  // HYBRID (recommended)
  if (seller?.freeDeliveryEnabled) {
    return { deliveryPrice: 0, deliveryPriceSource: 'SHOP_FREE' };
  }
  if (adminRulePrice !== null) {
    return { deliveryPrice: adminRulePrice, deliveryPriceSource: 'ADMIN_RULE' };
  }
  if (sellerPrice > 0) {
    return { deliveryPrice: sellerPrice, deliveryPriceSource: 'SELLER' };
  }
  return { deliveryPrice: buyerPrice, deliveryPriceSource: 'BUYER' };
};

export const buildCommuneNameRegex = (value = '') => {
  const clean = String(value || '').trim();
  if (!clean) return null;
  return new RegExp(`^${escapeRegex(clean)}$`, 'i');
};

