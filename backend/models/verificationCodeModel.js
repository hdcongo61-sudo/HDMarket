import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['registration', 'password_reset', 'password_change'],
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 } // Auto-delete expired documents
    },
    used: {
      type: Boolean,
      default: false,
      index: true
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5
    }
  },
  { timestamps: true }
);

// Compound index for efficient lookups
verificationCodeSchema.index({ email: 1, code: 1, type: 1, used: 1 });
verificationCodeSchema.index({ email: 1, type: 1, expiresAt: 1 });

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

export default VerificationCode;
