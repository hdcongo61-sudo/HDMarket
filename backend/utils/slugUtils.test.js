import { describe, expect, it, vi } from 'vitest';
import { ensureDocumentSlug } from './slugUtils.js';

// Regression test for a real production incident: the comments endpoint loaded
// products with a partial projection ('_id status'), and ensureDocumentSlug
// read the blank `slug` field as "missing" and overwrote the real slug with a
// Date.now() placeholder on every product-detail view. Fixed by checking
// document.isSelected() before treating a blank field as "needs generating".
// See backend/scripts/repairTimestampSlugs.js for the data-repair counterpart.

const buildFakeModel = ({ existsResult = false, findByIdSlug } = {}) => {
  const updateOne = vi.fn().mockResolvedValue({});
  const exists = vi.fn().mockResolvedValue(existsResult);
  const findById = vi.fn(() => ({
    select: () => ({
      lean: () => Promise.resolve(findByIdSlug ? { slug: findByIdSlug } : null)
    })
  }));
  return { updateOne, exists, findById };
};

describe('ensureDocumentSlug', () => {
  it('returns the existing slug untouched without touching the DB', async () => {
    const model = buildFakeModel();
    const document = { _id: '1', slug: 'already-set', constructor: model, isSelected: () => true };
    const slug = await ensureDocumentSlug({ document, sourceValue: 'Some Title' });
    expect(slug).toBe('already-set');
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('does NOT overwrite the real slug when it was merely excluded by the query projection', async () => {
    const model = buildFakeModel({ findByIdSlug: 'real-product-slug' });
    const document = {
      _id: '1',
      slug: '', // blank because the query projected only `_id status`
      constructor: model,
      isSelected: (field) => field !== 'slug'
    };
    const slug = await ensureDocumentSlug({ document, sourceValue: 'Some Title' });
    expect(slug).toBe('real-product-slug');
    expect(document.slug).toBe('real-product-slug');
    // The bug: this used to fall through to generateUniqueSlug and stamp a
    // Date.now() placeholder over the real slug via updateOne.
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('generates and persists a slug for a document that is genuinely new', async () => {
    const model = buildFakeModel({ existsResult: false, findByIdSlug: null });
    const document = {
      _id: '1',
      slug: '',
      constructor: model,
      isSelected: (field) => field !== 'slug'
    };
    const slug = await ensureDocumentSlug({ document, sourceValue: 'Chariot De Service' });
    expect(slug).toBe('chariot-de-service');
    expect(model.updateOne).toHaveBeenCalledWith({ _id: '1' }, { $set: { slug: 'chariot-de-service' } });
  });

  it('generates a slug normally for a plain object with no isSelected (e.g. a full, unprojected doc)', async () => {
    const model = buildFakeModel({ existsResult: false });
    const document = { _id: '1', slug: '', constructor: model };
    const slug = await ensureDocumentSlug({ document, sourceValue: 'Tapis 2m30' });
    expect(slug).toBe('tapis-2m30');
  });
});
