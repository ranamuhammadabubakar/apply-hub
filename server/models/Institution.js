import mongoose from 'mongoose';

const programSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  field: { type: String, enum: ['medical', 'engineering', 'cs', 'business', 'other'], required: true },
  minPercentage: { type: Number, min: 0, max: 100, default: null }, // null means not published yet
  feePerYear: { type: Number, min: 0, default: null }, // null means not published yet
  deadline: Date, // optional; when empty the institution deadline is used
  accreditedBy: { type: String, enum: ['PEC', 'NCEAC', 'PMDC', 'NBEAC'] }, // accreditation council, if known
  sourceUrl: { type: String, trim: true }, // page the fee, merit or deadline was taken from
});

const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    aliases: { type: [String], default: [] }, // short names students search for, e.g. "LUMS", "FAST"
    type: { type: String, enum: ['university', 'medical-college', 'school', 'academy'], default: 'university' },
    sector: { type: String, enum: ['public', 'private'], default: 'private' },
    city: { type: String, required: true, trim: true },
    province: { type: String, trim: true },
    category: { type: String, trim: true }, // HEC category, e.g. "Engineering & Technology"
    website: { type: String, trim: true },
    admissionUrl: { type: String, trim: true }, // official admission portal
    tourVideoUrl: { type: String, trim: true }, // official YouTube campus tour video
    tourCheckedAt: Date, // when the tour video search last ran for this institution
    description: { type: String, trim: true },
    deadline: Date,
    lastVerifiedAt: Date, // when an admin last checked this data against the official source
    hecUrl: { type: String, trim: true, unique: true, sparse: true }, // HEC page this record came from
    source: { type: String, enum: ['manual', 'hec'], default: 'manual' },
    programs: [programSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Institution', institutionSchema);