import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConversationForUser } from './conversationService.js';
import Conversation from '../models/conversationModel.js';
import ShopAssistant from '../models/shopAssistantModel.js';
afterEach(() => vi.restoreAllMocks());
const buyer = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const seller = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const stranger = 'cccccccccccccccccccccccc';
describe('order conversation access', () => {
  const setup = (assignment = null) => {
    vi.spyOn(Conversation, 'findById').mockResolvedValue({ buyerId: buyer, sellerId: seller });
    return vi.spyOn(ShopAssistant, 'findOne').mockReturnValue({ select: () => ({ lean: async () => assignment }) });
  };
  it('denies unrelated accounts', async () => {
    setup();
    await expect(getConversationForUser({ id: 'conversation', user: { id: stranger } })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('allows buyer and seller', async () => {
    setup();
    for (const id of [buyer, seller]) expect((await getConversationForUser({ id: 'conversation', user: { id } })).access.canAccess).toBe(true);
  });
  it('requires active reply permission for assistant writes', async () => {
    const find = setup();
    await expect(getConversationForUser({ id: 'conversation', user: { id: stranger }, requireMessagePermission: true })).rejects.toMatchObject({ statusCode: 403 });
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', permissions: { $in: ['respond_to_buyer_messages'] } }));
  });
});
