import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderExists: vi.fn(),
  productExists: vi.fn(),
  buyForMeExists: vi.fn(),
  deliveryExists: vi.fn(),
  userFindById: vi.fn()
}));

vi.mock('../models/orderModel.js', () => ({ default: { exists: mocks.orderExists } }));
vi.mock('../models/productModel.js', () => ({ default: { exists: mocks.productExists } }));
vi.mock('../models/buyForMeOrderModel.js', () => ({ default: { exists: mocks.buyForMeExists } }));
vi.mock('../models/deliveryRequestModel.js', () => ({ default: { exists: mocks.deliveryExists } }));
vi.mock('../models/userModel.js', () => ({ default: { findById: mocks.userFindById } }));

const selectLean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

import { CONDITION_KEYS, evaluateCondition, shouldSkipStep } from './notificationConditionEvaluator.js';

describe('notificationConditionEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes exactly the condition keys the OnboardingSequence step schema allows', () => {
    expect(CONDITION_KEYS).toEqual([
      'hasPlacedOrder',
      'hasPublishedProduct',
      'hasCreatedShop',
      'hasUsedBuyForMe',
      'hasUsedDelivery',
      'hasAddedFavorite',
      'hasCompletedProfile'
    ]);
  });

  it('hasPlacedOrder queries Order.exists scoped to the customer and excludes drafts', async () => {
    mocks.orderExists.mockResolvedValue(true);
    await expect(evaluateCondition('hasPlacedOrder', 'user-1')).resolves.toBe(true);
    expect(mocks.orderExists).toHaveBeenCalledWith({ customer: 'user-1', isDraft: { $ne: true } });
  });

  it('hasPublishedProduct queries Product.exists scoped to the owner', async () => {
    mocks.productExists.mockResolvedValue(false);
    await expect(evaluateCondition('hasPublishedProduct', 'user-1')).resolves.toBe(false);
    expect(mocks.productExists).toHaveBeenCalledWith({ user: 'user-1' });
  });

  it('hasCreatedShop reads accountType off the user document', async () => {
    mocks.userFindById.mockReturnValueOnce(selectLean({ accountType: 'shop' }));
    await expect(evaluateCondition('hasCreatedShop', 'user-1')).resolves.toBe(true);

    mocks.userFindById.mockReturnValueOnce(selectLean({ accountType: 'person' }));
    await expect(evaluateCondition('hasCreatedShop', 'user-1')).resolves.toBe(false);
  });

  it('hasAddedFavorite checks the favorites array length', async () => {
    mocks.userFindById.mockReturnValueOnce(selectLean({ favorites: ['p1'] }));
    await expect(evaluateCondition('hasAddedFavorite', 'user-1')).resolves.toBe(true);

    mocks.userFindById.mockReturnValueOnce(selectLean({ favorites: [] }));
    await expect(evaluateCondition('hasAddedFavorite', 'user-1')).resolves.toBe(false);
  });

  it('an unknown condition key evaluates to false instead of throwing', async () => {
    await expect(evaluateCondition('notARealCondition', 'user-1')).resolves.toBe(false);
  });

  it('a condition function that throws resolves to false rather than rejecting', async () => {
    mocks.orderExists.mockRejectedValue(new Error('db down'));
    await expect(evaluateCondition('hasPlacedOrder', 'user-1')).resolves.toBe(false);
  });

  describe('shouldSkipStep', () => {
    it('never skips when the step has no conditions', async () => {
      await expect(shouldSkipStep('user-1', [])).resolves.toBe(false);
      expect(mocks.orderExists).not.toHaveBeenCalled();
    });

    it('skips only when every listed condition is already satisfied', async () => {
      mocks.orderExists.mockResolvedValue(true);
      mocks.productExists.mockResolvedValue(true);
      await expect(shouldSkipStep('user-1', ['hasPlacedOrder', 'hasPublishedProduct'])).resolves.toBe(true);
    });

    it('does not skip if any listed condition is not yet satisfied', async () => {
      mocks.orderExists.mockResolvedValue(true);
      mocks.productExists.mockResolvedValue(false);
      await expect(shouldSkipStep('user-1', ['hasPlacedOrder', 'hasPublishedProduct'])).resolves.toBe(false);
    });

    it('ignores unknown condition keys mixed into the list', async () => {
      mocks.orderExists.mockResolvedValue(true);
      await expect(shouldSkipStep('user-1', ['hasPlacedOrder', 'bogus'])).resolves.toBe(true);
    });
  });
});
