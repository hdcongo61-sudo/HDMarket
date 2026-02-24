import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    description: { type: String, default: '', trim: true },
    category: { type: String, default: 'general', trim: true, index: true },
    isSystem: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

permissionSchema.index({ category: 1, key: 1 });

export default mongoose.model('Permission', permissionSchema);
