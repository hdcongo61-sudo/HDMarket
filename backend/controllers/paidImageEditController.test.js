import { afterEach, describe, expect, it, vi } from 'vitest';
import ImageEditJob from '../models/imageEditJobModel.js';
import { runImageEditJob, getImageEditJob } from './paidImageEditController.js';
import { paidCheckoutFor, performImageEdit, imageEditPricing } from '../services/paidImageEditService.js';
vi.mock('../services/paidImageEditService.js', () => ({ paidCheckoutFor: vi.fn(), performImageEdit: vi.fn(async () => {}), imageEditPricing: vi.fn(async () => ({ enabled: true })), validateImageEditInput: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const req = { params: { id: '507f1f77bcf86cd799439011' }, user: { _id: 'owner' } };
const response = () => { const res = { status: vi.fn(() => res), json: vi.fn(() => res) }; return res; };
describe('image edit access and processing', () => {
  it('cannot read another seller’s job', async () => {
    const find = vi.spyOn(ImageEditJob, 'findOne').mockResolvedValue(null);
    const res = response(); await getImageEditJob(req, res, vi.fn());
    expect(find).toHaveBeenCalledWith({ _id: req.params.id, user: 'owner' });
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('does not claim an unpaid job', async () => {
    vi.spyOn(ImageEditJob, 'findOne').mockResolvedValue({ _id: req.params.id });
    paidCheckoutFor.mockResolvedValue({ paid: false });
    const claim = vi.spyOn(ImageEditJob, 'findOneAndUpdate');
    const res = response(); await runImageEditJob(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(402); expect(claim).not.toHaveBeenCalled();
  });
  it('does not run when another request already claimed the job', async () => {
    vi.spyOn(ImageEditJob, 'findOne').mockResolvedValue({ _id: req.params.id, state: 'AWAITING_PAYMENT' });
    paidCheckoutFor.mockResolvedValue({ paid: true }); imageEditPricing.mockResolvedValue({ enabled: true });
    const claim = vi.spyOn(ImageEditJob, 'findOneAndUpdate').mockResolvedValue(null);
    performImageEdit.mockClear();
    const res = response(); await runImageEditJob(req, res, vi.fn());
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ attempts: { $lt: 3 } }), expect.anything(), { new: true });
    expect(performImageEdit).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(409);
  });
});
