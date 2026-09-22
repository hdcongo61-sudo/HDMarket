import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import Complaint from '../models/complaintModel.js';
import Dispute from '../models/disputeModel.js';
import { downloadPrivateAttachment } from './privateAttachmentController.js';
import { blockPrivateUploads, canManageEvidence } from '../utils/privateAttachments.js';

const response = () => ({ set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), end: vi.fn(), type: vi.fn(), download: vi.fn() });
const country = 'cccccccccccccccccccccccc';
const record = { user: 'buyer', clientId: 'buyer', sellerId: 'seller', countryId: country,
  attachments: [{ filename: 'receipt.pdf', originalName: 'Reçu.pdf' }], proofImages: [{ filename: 'receipt.pdf', originalName: 'Reçu.pdf' }] };
afterEach(() => vi.restoreAllMocks());
describe('private evidence downloads', () => {
  it.each(['/complaints/receipt.pdf', '/disputes/receipt.pdf', '/%63omplaints/receipt.pdf', '/other/%2e%2e/disputes/receipt.pdf', '/complaints%2freceipt.pdf', '/COMPLAINTS/receipt.pdf'])('blocks historical public path %s', path => {
    const res = response(), next = vi.fn();
    blockPrivateUploads({ path }, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
  it('keeps public product media available', () => {
    const next = vi.fn();
    blockPrivateUploads({ path: '/products/photo.jpg' }, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });
  it.each(['buyer', 'seller'])('permits a dispute participant: %s', async id => {
    vi.spyOn(Dispute, 'findOne').mockReturnValue({ lean: async () => record });
    vi.spyOn(fs, 'lstat').mockResolvedValue({ isFile: () => true, isSymbolicLink: () => false });
    const res = response(), next = vi.fn();
    await downloadPrivateAttachment({ params: { kind: 'disputes', filename: 'receipt.pdf' }, user: { id } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.download).toHaveBeenCalledWith(expect.stringContaining('/private-uploads/disputes/receipt.pdf'), 'Reçu.pdf', { cacheControl: false }, expect.any(Function));
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({ 'Cache-Control': 'private, no-store' }));
  });
  it('denies other users and admins from another country before touching disk', async () => {
    vi.spyOn(Complaint, 'findOne').mockReturnValue({ lean: async () => record });
    const read = vi.spyOn(fs, 'lstat');
    for (const user of [{ id: 'stranger' }, { id: 'admin', role: 'admin', countryId: country, adminCountryIds: ['another-country'] }]) {
      const res = response();
      await downloadPrivateAttachment({ params: { kind: 'complaints', filename: 'receipt.pdf' }, user }, res, vi.fn());
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.download).not.toHaveBeenCalled();
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('checks both staff permission and country membership', () => {
    expect(canManageEvidence({ role: 'user', countryId: country }, country)).toBe(false);
    expect(canManageEvidence({ role: 'user', canManageComplaints: true, countryId: country }, country)).toBe(true);
    expect(canManageEvidence({ role: 'admin', adminCountryIds: [country] }, country)).toBe(true);
    expect(canManageEvidence({ role: 'admin', countryId: country }, country)).toBe(false);
    expect(canManageEvidence({ role: 'manager', countryId: country }, country)).toBe(true);
    expect(canManageEvidence({ role: 'founder' }, null)).toBe(true);
  });
  it('serves historical files through the same authorization checks', async () => {
    vi.spyOn(Complaint, 'findOne').mockReturnValue({ lean: async () => record });
    vi.spyOn(fs, 'lstat').mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }))
      .mockResolvedValue({ isFile: () => true, isSymbolicLink: () => false });
    const res = response();
    await downloadPrivateAttachment({ params: { kind: 'complaints', filename: 'receipt.pdf' }, user: { id: 'buyer' } }, res, vi.fn());
    expect(res.download.mock.calls[0][0]).toContain('/uploads/complaints/receipt.pdf');
  });
  it.each(['../secret', 'receipt%2fpdf', '.env', 'a\\secret'])('rejects unsafe filename %s', async filename => {
    const res = response();
    await downloadPrivateAttachment({ params: { kind: 'disputes', filename }, user: { id: 'buyer' } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
