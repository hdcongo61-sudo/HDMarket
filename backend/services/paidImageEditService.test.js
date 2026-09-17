vi.mock('./commerceAiProvider.js', () => ({ reserveAiUsage: vi.fn(async () => ({ _id: 'usage' })), finishAiUsage: vi.fn(async () => {}), commerceGenerate: vi.fn(), objectSchema: x => x, textSchema: {} }));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isImageEditPaid, validateImageEditInput, performImageEdit } from './paidImageEditService.js';
import ImageEditJob from '../models/imageEditJobModel.js';
vi.mock('../utils/cloudinaryUploader.js', () => ({ isCloudinaryConfigured: () => true, getCloudinaryFolder: x => x.join('/'), uploadToCloudinary: vi.fn(async () => ({ secure_url: 'https://res.cloudinary.com/result.png' })) }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const job = { _id: 'job', user: 'owner', checkoutId: 'checkout', amount: 500, currency: 'XAF', operation: 'background', sourceUrl: 'https://res.cloudinary.com/source.png', prompt: 'Fond blanc', runToken: 'unique-run' };
const checkout = { imageEditJob: 'job', user: 'owner', checkoutId: 'checkout', amount: 500, currency: 'XAF', purpose: 'IMAGE_EDIT_FUNDING', status: 'COMPLETED', paymentState: 'CONFIRMED' };
describe('paid image edits', () => {
  it('requires exact owner, job, amount, currency, purpose and verified payment', () => {
    expect(isImageEditPaid(job, checkout)).toBe(true);
    for (const changed of [{ user: 'other' }, { imageEditJob: 'other' }, { checkoutId: 'other' }, { amount: 10 }, { currency: 'USD' }, { purpose: 'CHECKOUT_FUNDING' }, { status: 'PROCESSING' }, { paymentState: 'PENDING' }]) expect(isImageEditPaid(job, { ...checkout, ...changed })).toBe(false);
    expect(isImageEditPaid(job, null)).toBe(false);
  });
  it('rejects arbitrary operations and unbounded instructions', () => {
    for (const input of [{ operation: 'other', prompt: 'hello' }, { operation: 'custom', prompt: 'a' }, { operation: 'custom', prompt: 'x'.repeat(1001) }, { operation: 'custom', prompt: {} }]) expect(() => validateImageEditInput(input)).toThrow();
    expect(validateImageEditInput({ operation: 'custom', prompt: ' Fond blanc ' }).prompt).toBe('Fond blanc');
  });
  it('persists the generated result against the unique processing claim', async () => {
    const update = vi.spyOn(ImageEditJob, 'updateOne').mockResolvedValue({});
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ b64_json: Buffer.from('image-result').toString('base64') }] }) });
    vi.stubGlobal('fetch', fetch);
    await performImageEdit(job);
    expect(fetch.mock.calls[1][0]).toBe('https://api.openai.com/v1/images/edits');
    expect(fetch.mock.calls[1][1].body.get('n')).toBe('1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ runToken: 'unique-run' }), expect.objectContaining({ $set: expect.objectContaining({ state: 'COMPLETED' }) }));
  });
  it('keeps failed edits retryable without initiating a new payment', async () => {
    const update = vi.spyOn(ImageEditJob, 'updateOne').mockResolvedValue({});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider secret')));
    await performImageEdit(job);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ runToken: 'unique-run' }), { $set: { state: 'FAILED', error: expect.not.stringContaining('provider secret') } });
  });
});
