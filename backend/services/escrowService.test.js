import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  findById: vi.fn(),
  config: vi.fn(),
  auditCreate: vi.fn(),
  settlement: vi.fn(),
  notification: vi.fn(),
  invalidate: vi.fn()
}));

vi.mock('../models/orderModel.js', () => ({
  default: {
    findOneAndUpdate: mocks.findOneAndUpdate,
    findById: mocks.findById,
    find: vi.fn()
  }
}));
vi.mock('../models/escrowAuditLogModel.js', () => ({
  default: { create: mocks.auditCreate, find: vi.fn() }
}));
vi.mock('./configService.js', () => ({ getManyRuntimeConfigs: mocks.config }));
vi.mock('./sellerSettlementService.js', () => ({ ensureSellerSettlementForOrder: mocks.settlement }));
vi.mock('../utils/notificationService.js', () => ({ createNotification: mocks.notification }));
vi.mock('../utils/cache.js', () => ({
  invalidateAdminCache: mocks.invalidate,
  invalidateSellerCache: mocks.invalidate,
  invalidateUserCache: mocks.invalidate
}));

import { getEscrowSettings, releaseEscrowForOrder } from './escrowService.js';

describe('escrow settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.settlement.mockResolvedValue({});
    mocks.notification.mockResolvedValue({});
    mocks.invalidate.mockResolvedValue(undefined);
  });

  it('uses the safe three-hour defaults', async () => {
    await expect(getEscrowSettings()).resolves.toMatchObject({
      autoReleaseDelayMinutes: 180,
      disputeEnabled: true,
      maximumDisputeTimeMinutes: 180,
      minimumDepositPercent: 50
    });
  });

  it('releases only confirmation-ready orders and creates the seller settlement', async () => {
    const order = {
      _id: 'order-1',
      customer: 'buyer-1',
      items: [{ snapshot: { shopId: 'seller-1' } }],
      escrowAmount: 7000,
      escrowStatus: 'RELEASED'
    };
    mocks.findOneAndUpdate.mockResolvedValue(order);
    const released = await releaseEscrowForOrder({
      order: order._id,
      actor: 'buyer-1',
      actorRole: 'buyer',
      reason: 'BUYER_CONFIRMED'
    });
    expect(released).toBe(order);
    expect(mocks.findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: 'order-1',
      escrowStatus: { $in: ['DELIVERED', 'WAITING_BUYER_CONFIRMATION'] },
      disputeOpened: { $ne: true }
    });
    expect(mocks.settlement).toHaveBeenCalledWith(order);
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: 'BUYER_CONFIRMED' }));
  });

  it('allows an admin seller-favor resolution to release an escrow on hold', async () => {
    mocks.findOneAndUpdate.mockResolvedValue({
      _id: 'order-2',
      customer: 'buyer-2',
      items: [],
      escrowStatus: 'RELEASED'
    });
    await releaseEscrowForOrder({ order: 'order-2', reason: 'DISPUTE_RESOLVED_SELLER' });
    expect(mocks.findOneAndUpdate.mock.calls[0][0].escrowStatus.$in).toContain('ON_HOLD');
  });
});
