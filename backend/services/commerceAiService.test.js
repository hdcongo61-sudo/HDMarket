import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateReport, validateShoppingIntent, selectComplementResults, sellerReply, shoppingAssistant, redactPersonalText } from './commerceAiService.js';
import { getConversationForUser } from './conversationService.js';
import { commerceGenerate } from './commerceAiProvider.js';
import Product from '../models/productModel.js';
import AiSearchOutcome from '../models/aiSearchOutcomeModel.js';
vi.mock('./conversationService.js', () => ({ getConversationForUser: vi.fn() }));
vi.mock('./commerceAiProvider.js', async original => ({ ...(await original()), commerceGenerate: vi.fn() }));
vi.mock('../utils/publicProductVisibility.js', () => ({ withVerifiedPublicProductFilter: async filter => ({ $and: [filter, { listingFeeSettled: true }] }) }));
afterEach(() => vi.restoreAllMocks());
const id = '507f1f77bcf86cd799439011';
const intent = { keywords: ['sac'], minPrice: null, maxPrice: 5000, condition: 'new', city: 'Brazzaville', followUp: '' };
const chain = value => ({ select: () => chain(value), sort: () => chain(value), limit: () => chain(value), lean: async () => value });
describe('commerce assistant grounding and access', () => {
  it('rejects invented sources in seller/founder recommendations', () => {
    expect(() => validateReport({ summary: 'Conseil', actions: [{ title: 'Modifier', detail: 'Texte', sourceId: 'other' }] }, [{ id }])).toThrow();
  });
  it('rejects malformed budgets, cities and keywords', () => {
    for (const value of [{ ...intent, maxPrice: '5000' }, { ...intent, minPrice: 10000 }, { ...intent, keywords: [{}] }, { ...intent, city: {} }]) expect(() => validateShoppingIntent(value)).toThrow();
  });
  it('drops invented and repeated complementary product IDs', () => {
    const products = selectComplementResults({ items: [{ id, reason: 'Complément' }, { id, reason: 'Encore' }, { id: 'invented', reason: 'Fake' }] }, [{ _id: id, title: 'Coque', price: 1000 }]);
    expect(products).toHaveLength(1); expect(products[0].price).toBe(1000); expect(products[0].url).toBe(`/product/${id}`);
  });
  it('denies a buyer and an unrelated admin before reading private context or calling AI', async () => {
    for (const access of [{ canAccess: true, isSeller: false }, { canAccess: false, isAdmin: true }]) {
      getConversationForUser.mockResolvedValue({ conversation: {}, access }); commerceGenerate.mockClear();
      await expect(sellerReply({ actor: 'other', user: { id: 'other' }, conversationId: id, question: 'Bonjour' })).rejects.toMatchObject({ status: 403 });
      expect(commerceGenerate).not.toHaveBeenCalled();
      expect(getConversationForUser).toHaveBeenCalledWith({ id, user: { id: 'other' }, requireMessagePermission: true });
    }
  });
  it('enforces country, published status, escaped terms and explicit budgets in catalogue retrieval', async () => {
    commerceGenerate.mockResolvedValue({ ...intent, keywords: ['sac.*'] });
    const find = vi.spyOn(Product, 'find').mockReturnValue(chain([{ _id: id, title: 'Sac', price: 3000 }]));
    vi.spyOn(AiSearchOutcome, 'create').mockResolvedValue({});
    const result = await shoppingAssistant({ actor: 'guest', input: 'sac', country: { countryId: id, code: 'CD' } });
    const query = JSON.stringify(find.mock.calls[0][0]);
    expect(query).toContain('listingFeeSettled'); expect(query).toContain('approved'); expect(query).toContain(id); expect(query).toContain('5000'); expect(query).toContain('sac\\\\.\\\\*');
    expect(result.products[0].price).toBe(3000);
  });
  it('masks common contact details in the selected reply text', () => {
    const text = redactPersonalText('email a@example.com tel +242 06 123 45 67');
    expect(text).not.toContain('example.com'); expect(text).not.toContain('123');
  });
});
