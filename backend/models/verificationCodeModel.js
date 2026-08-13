import mongoose from 'mongoose';

const verificationCodeSchema = new mongoose.Schema(
  {
    // Exactly one of email/phone is set per record — whichever channel the
    // code was issued for. Both optional at the schema level so the same
    // collection serves email codes (registration, password reset, adding
    // an email in profile) and phone codes (phone-first registration,
    // phone-based password reset).
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true
    },
    phone: {
      type: String,
      default: null,
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
      enum: ['registration', 'password_reset', 'password_change', 'profile_email_add'],
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
    // Stamped when `used` flips to true — lets a caller prove "this
    // identifier was verified a moment ago" without re-submitting (and
    // re-consuming) the one-time code a second time.
    usedAt: {
      type: Date,
      default: null
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient lookups, one set per channel.
verificationCodeSchema.index({ email: 1, code: 1, type: 1, used: 1 });
verificationCodeSchema.index({ email: 1, type: 1, expiresAt: 1 });
verificationCodeSchema.index({ phone: 1, code: 1, type: 1, used: 1 });
verificationCodeSchema.index({ phone: 1, type: 1, usedAt: 1 });

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

export default VerificationCode;
