import fs from 'node:fs/promises';
import path from 'node:path';
import asyncHandler from 'express-async-handler';
import Complaint from '../models/complaintModel.js';
import Dispute from '../models/disputeModel.js';
import User from '../models/userModel.js';
import Order from '../models/orderModel.js';
import {
  attachmentKinds, validAttachmentFilename, canManageEvidence,
  privateUploadDirectory, legacyUploadDirectory
} from '../utils/privateAttachments.js';

export const downloadPrivateAttachment = asyncHandler(async (req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  const { kind, filename } = req.params;
  if (!attachmentKinds.has(kind) || !validAttachmentFilename(filename)) return res.status(404).end();
  const record = kind === 'complaints'
    ? await Complaint.findOne({ 'attachments.filename': filename }).lean()
    : await Dispute.findOne({ $or: [{ 'proofImages.filename': filename }, { 'sellerProofImages.filename': filename }] }).lean();
  if (!record) return res.status(404).end();
  const userId = String(req.user.id || req.user._id);
  const participants = kind === 'complaints' ? [record.user] : [record.clientId, record.sellerId];
  if (!participants.some(id => String(id) === userId)) {
    // Historical records may predate countryId. Resolve their owner's country,
    // never the request's selected country, before granting staff access.
    let countryId = record.countryId;
    if (!countryId) {
      const owner = kind === 'complaints'
        ? await User.findById(record.user).select('countryId').lean()
        : await Order.findById(record.orderId).select('countryId').lean();
      countryId = owner?.countryId;
    }
    if (!canManageEvidence(req.user, countryId)) return res.status(404).end();
  }
  const files = kind === 'complaints' ? record.attachments : [...(record.proofImages || []), ...(record.sellerProofImages || [])];
  const file = files.find(item => item.filename === filename);
  for (const directory of [privateUploadDirectory(kind), legacyUploadDirectory(kind)]) {
    const target = path.join(directory, filename);
    try {
      // Do not follow symlinks into files outside the evidence directory.
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    res.type('application/octet-stream');
    return res.download(target, file.originalName || filename, { cacheControl: false }, error => {
      if (error) next(error);
    });
  }
  return res.status(404).end();
});
