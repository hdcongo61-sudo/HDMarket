import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, trim: true, maxlength: 150, default: '' },
    message: { type: String, required: true, maxlength: 1500 },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'resolved'],
      default: 'pending'
    },
    attachments: [
      {
        filename: { type: String },
        originalName: { type: String },
        mimetype: { type: String },
        size: { type: Number },
        path: { type: String }
      }
    ],
    adminNote: { type: String, maxlength: 500, default: '' },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date }
  },
  { timestamps: true }
);

complaintSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
