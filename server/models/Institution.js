import mongoose from 'mongoose';

const programSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  field: { type: String, enum: ['medical', 'engineering', 'cs', 'business', 'other'], required: true },
  minPercentage: { type: Number, min: 0, max: 100, default: 0 },
  feePerYear: { type: Number, min: 0, default: 0 },
  deadline: Date, // optional; when empty the institution deadline is used
});

const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['university', 'medical-college', 'school', 'academy'], default: 'university' },
    sector: { type: String, enum: ['public', 'private'], default: 'private' },
    city: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    admissionUrl: { type: String, trim: true }, // official admission portal
    description: { type: String, trim: true },
    deadline: Date,
    lastVerifiedAt: Date, // when an admin last checked this data against the official source
    programs: [programSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Institution', institutionSchema);