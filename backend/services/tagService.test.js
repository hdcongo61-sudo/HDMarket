import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { normalizeEntityType } from '../constants/tagConstants.js';
import Tag from '../models/tagModel.js';
import { parseTagIds, validateTagSelection } from './tagService.js';

describe('universal tag helpers', () => {
  it('normalizes future module entity types consistently', () => {
    expect(normalizeEntityType('Help Article')).toBe('help_article');
    expect(normalizeEntityType('blog-post')).toBe('blog_post');
    expect(normalizeEntityType('../../unsafe')).toBe('unsafe');
  });

  it('parses JSON, comma-separated and object tag identifiers without duplicates', () => {
    const first = new mongoose.Types.ObjectId().toString();
    const second = new mongoose.Types.ObjectId().toString();
    expect(parseTagIds(JSON.stringify([first, second, first]))).toEqual([first, second]);
    expect(parseTagIds(`${first}, ${second}`)).toEqual([first, second]);
    expect(parseTagIds([{ _id: first }, { _id: second }])).toEqual([first, second]);
  });

  it('exposes only active public tags inside their campaign window', () => {
    const active = new Tag({
      name: 'Weekend Deals',
      slug: 'weekend-deals',
      normalizedName: 'weekend deals',
      type: 'campaign',
      visibility: 'public',
      status: 'active',
      campaignStartsAt: new Date('2026-08-01T00:00:00Z'),
      campaignEndsAt: new Date('2026-08-10T00:00:00Z')
    });
    expect(active.isPubliclyAvailable(new Date('2026-08-03T00:00:00Z'))).toBe(true);
    expect(active.isPubliclyAvailable(new Date('2026-08-11T00:00:00Z'))).toBe(false);
    active.visibility = 'hidden';
    expect(active.isPubliclyAvailable(new Date('2026-08-03T00:00:00Z'))).toBe(false);
  });

  it('rejects more than ten manual product tags before querying the database', async () => {
    const ids = Array.from({ length: 11 }, () => new mongoose.Types.ObjectId().toString());
    await expect(validateTagSelection(ids)).rejects.toMatchObject({ code: 'MANUAL_TAG_LIMIT' });
  });
});
