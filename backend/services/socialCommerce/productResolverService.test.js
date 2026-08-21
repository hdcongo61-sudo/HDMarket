import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(),
  findById: vi.fn()
}));

vi.mock('../../models/productModel.js', () => ({
  default: { findOne: mocks.findOne, findById: mocks.findById }
}));

const selectPopulateLean = (value) => ({
  select: () => ({ populate: () => ({ lean: () => Promise.resolve(value) }) })
});

import { resolveProductFromMessage, resolveProductById } from './productResolverService.js';

const approvedProduct = {
  _id: 'prod-1',
  title: 'Table basse LED',
  status: 'approved',
  socialCode: 'HD-8F42K',
  user: { shopName: 'ETS HD Home Decor' }
};

describe('productResolverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveProductFromMessage', () => {
    it('resolves an approved product from a message containing its code', async () => {
      mocks.findOne.mockReturnValue(selectPopulateLean(approvedProduct));
      const result = await resolveProductFromMessage('prix HD-8F42K');
      expect(result).toEqual({ found: true, product: approvedProduct, shop: approvedProduct.user, socialCode: 'HD-8F42K' });
      expect(mocks.findOne).toHaveBeenCalledWith({ socialCode: 'HD-8F42K' });
    });

    it('returns PRODUCT_NOT_FOUND when the message has no code at all', async () => {
      const result = await resolveProductFromMessage('bonjour, ça va ?');
      expect(result).toEqual({ found: false, reason: 'PRODUCT_NOT_FOUND' });
      expect(mocks.findOne).not.toHaveBeenCalled();
    });

    it('returns PRODUCT_NOT_FOUND when the code does not match any product (Scenario E)', async () => {
      mocks.findOne.mockReturnValue(selectPopulateLean(null));
      const result = await resolveProductFromMessage('prix HD-XXXXX');
      expect(result.found).toBe(false);
      expect(result.reason).toBe('PRODUCT_NOT_FOUND');
    });

    it('returns PRODUCT_UNAVAILABLE for a non-approved product (deleted/pending/rejected)', async () => {
      mocks.findOne.mockReturnValue(selectPopulateLean({ ...approvedProduct, status: 'disabled' }));
      const result = await resolveProductFromMessage('prix HD-8F42K');
      expect(result.found).toBe(false);
      expect(result.reason).toBe('PRODUCT_UNAVAILABLE');
    });

    it('never surfaces a raw Mongo _id as the resolved socialCode', async () => {
      mocks.findOne.mockReturnValue(selectPopulateLean(approvedProduct));
      const result = await resolveProductFromMessage('HD-8F42K');
      expect(result.socialCode).toBe('HD-8F42K');
      expect(result.socialCode).not.toMatch(/^[a-f0-9]{24}$/i);
    });
  });

  describe('resolveProductById', () => {
    it('resolves a product by id for the conversation-context follow-up path', async () => {
      mocks.findById.mockReturnValue(selectPopulateLean(approvedProduct));
      const result = await resolveProductById('prod-1');
      expect(result.found).toBe(true);
      expect(result.product).toEqual(approvedProduct);
    });

    it('returns PRODUCT_NOT_FOUND for a falsy id', async () => {
      const result = await resolveProductById(null);
      expect(result).toEqual({ found: false, reason: 'PRODUCT_NOT_FOUND' });
    });
  });
});
