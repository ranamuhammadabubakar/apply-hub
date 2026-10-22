import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    institution: { type: mongoose.Schema.Types.ObjectId, ref: 'Institution', required: true },
    program: { type: String, required: true },
    status: {
      type: String,
      enum: ['submitted', 'under-review', 'accepted', 'rejected'],
      default: 'submitted',
    },
  },
  { timestamps: true }
);

applicationSchema.index({ student: 1, institution: 1, program: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);