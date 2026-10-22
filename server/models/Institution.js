import mongoose from 'mongoose';

const programSchema = new mongoose.Schema({
  name: { type: String, required: true },
  field: { type: String, enum: ['medical', 'engineering', 'cs', 'business', 'other'], required: true },
  minPercentage: { type: Number, default: 0 },
  feePerYear: { type: Number, default: 0 },
});

const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['university', 'medical-college', 'school', 'academy'], default: 'university' },
    city: { type: String, required: true },
    website: String,
    description: String,
    deadline: Date,
    programs: [programSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Institution', institutionSchema);