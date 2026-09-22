import { afterEach, expect, it, vi } from 'vitest';
import Order from '../models/orderModel.js';
import { quoteSponsoredCheckout } from './sponsoredPaymentService.js';

afterEach(() => vi.restoreAllMocks());
it('rejects malformed group references before they can become MongoDB query operators', async () => {
  const find = vi.spyOn(Order, 'find').mockImplementation(() => { throw new Error('Unexpected database query'); });
  for (const groupId of [{ $ne: '' }, { $regex: '.*' }, ['group'], '', '   ', 'x'.repeat(201)]) {
    await expect(quoteSponsoredCheckout({ groupId, kind: 'SPONSORSHIP_ACCEPT', userId: 'payer', amount: 2500 }))
      .rejects.toMatchObject({ status: 400 });
  }
  expect(find).not.toHaveBeenCalled();
});
