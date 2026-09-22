// Reusing a list never reuses payment, receipt, contact or delivery data.
export const shoppingDraftFrom = (source = {}) => ({
  storeType: source.storeType || 'SUPERMARKET', preferredStore: source.preferredStore || '',
  authorizationMode: source.authorizationMode === 'ITEM_ESTIMATES' ? 'ITEM_ESTIMATES' : 'SHOPPING_BUDGET',
  shoppingBudget: String(source.shoppingBudget || source.estimatedShoppingValue || source.pricing?.shoppingBudget || source.maxShoppingBudget || ''),
  items: (Array.isArray(source.items) ? source.items : []).filter(item => item.status !== 'CANCELED').slice(0, 30).map(item => ({
    name: String(item.name || ''), quantity: String(item.quantity || 1), estimatedUnitPrice: String(item.estimatedUnitPrice || ''), note: String(item.note || '')
  }))
});
