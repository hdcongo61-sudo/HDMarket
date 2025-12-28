import mongoose from 'mongoose';

const conditionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const helpCenterSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'ETS HD Tech Filial',
      trim: true
    },
    conditions: {
      type: [conditionSchema],
      default: []
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export default mongoose.model('HelpCenter', helpCenterSchema);
