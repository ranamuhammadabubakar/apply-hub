import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    field: { type: String, enum: ['medical', 'engineering', 'cs', 'business', 'other'], default: 'other' },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    city: { type: String, default: '' },
    maxBudget: { type: Number, default: 0 },
    interests: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['student', 'institute', 'admin'], default: 'student' },
    profile: { type: profileSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);