import asyncHandler from 'express-async-handler';
import Complaint from '../models/complaintModel.js';
import { createNotification } from '../utils/notificationService.js';

const ALLOWED_STATUSES = new Set(['pending', 'in_review', 'resolved']);

export const createComplaint = asyncHandler(async (req, res) => {
  const subject = (req.body.subject || '').toString().trim();
  const message = (req.body.message || '').toString().trim();
  if (!message) {
    return res.status(400).json({ message: 'Veuillez préciser votre réclamation.' });
  }
  const attachments = (req.files || []).map((file) => ({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: `uploads/complaints/${file.filename}`
  }));

  const complaint = await Complaint.create({
    user: req.user.id,
    subject,
    message,
    attachments
  });
  res.status(201).json(complaint);
});

export const listComplaintsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  const { status } = req.query;
  if (status && ALLOWED_STATUSES.has(status)) {
    filter.status = status;
  }
  const complaints = await Complaint.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email phone')
    .populate('handledBy', 'name email')
    .lean();
  res.json(complaints);
});

export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({ message: 'Statut de réclamation invalide.' });
  }
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) {
    return res.status(404).json({ message: 'Réclamation introuvable.' });
  }
  complaint.status = status;
  if (typeof note === 'string') {
    complaint.adminNote = note.trim();
  }
  complaint.handledBy = req.user.id;
  complaint.handledAt = new Date();
  await complaint.save();
  res.json({
    id: complaint._id,
    status: complaint.status,
    handledAt: complaint.handledAt
  });

  if (complaint.status === 'resolved') {
    await createNotification({
      userId: complaint.user,
      actorId: req.user.id,
      type: 'complaint_resolved',
      metadata: {
        complaintId: complaint._id,
        subject: complaint.subject || ''
      }
    });
  }
});

export const getUserComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .lean();
  res.json(complaints);
});
