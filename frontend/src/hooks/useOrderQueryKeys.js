const sortObject = (value) => {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObject(value[key]);
      return acc;
    }, {});
};

const serializeParams = (params = {}) => {
  try {
    return JSON.stringify(sortObject(params || {}));
  } catch {
    return '';
  }
};

export const orderQueryKeys = {
  all: ['orders'],
  listRoot: (scope = 'user') => ['orders', 'list', String(scope || 'user')],
  list: (scope = 'user', params = {}) => [
    'orders',
    'list',
    String(scope || 'user'),
    serializeParams(params)
  ],
  detailRoot: (scope = 'user') => ['orders', 'detail', String(scope || 'user')],
  detail: (scope = 'user', orderId = '') => [
    'orders',
    'detail',
    String(scope || 'user'),
    String(orderId || '')
  ],
  unreadRoot: (scope = 'user') => ['orders', 'messages', 'unread', String(scope || 'user')],
  unreadByOrder: (scope = 'user', orderId = '', userId = '') => [
    'orders',
    'messages',
    'unread',
    String(scope || 'user'),
    String(orderId || ''),
    String(userId || '')
  ]
};

export default orderQueryKeys;
