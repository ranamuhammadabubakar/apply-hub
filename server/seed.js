import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Institution from './models/Institution.js';
import User from './models/User.js';

const nextMonth = new Date(Date.now() + 30 * 24 * 3600 * 1000);

const institutions = [
  {
    name: 'Demo University of Technology', type: 'university', city: 'Lahore', website: 'https://example.com',
    description: 'Sample data. Real data will come later from scraping or the admin panel.', deadline: nextMonth,
    programs: [
      { name: 'BS Computer Science', field: 'cs', minPercentage: 70, feePerYear: 250000 },
      { name: 'BS Software Engineering', field: 'engineering', minPercentage: 72, feePerYear: 260000 },
      { name: 'BBA', field: 'business', minPercentage: 60, feePerYear: 220000 },
    ],
  },
  {
    name: 'Demo Medical College', type: 'medical-college', city: 'Lahore', deadline: nextMonth,
    description: 'Sample medical college.',
    programs: [{ name: 'MBBS', field: 'medical', minPercentage: 85, feePerYear: 900000 }],
  },
  {
    name: 'Demo Engineering University', type: 'university', city: 'Islamabad', deadline: nextMonth,
    description: 'Sample engineering university.',
    programs: [
      { name: 'BS Electrical Engineering', field: 'engineering', minPercentage: 75, feePerYear: 300000 },
      { name: 'BS Computer Science', field: 'cs', minPercentage: 78, feePerYear: 310000 },
    ],
  },
  {
    name: 'Demo City Academy', type: 'academy', city: 'Karachi', deadline: nextMonth,
    description: 'Sample academy.',
    programs: [{ name: 'MDCAT Prep', field: 'medical', minPercentage: 60, feePerYear: 80000 }],
  },
];

await mongoose.connect(process.env.MONGO_URI);
await Institution.deleteMany({});
await Institution.insertMany(institutions);

const adminEmail = 'admin@applyhub.test';
if (!(await User.findOne({ email: adminEmail }))) {
  await User.create({
    name: 'Admin',
    email: adminEmail,
    password: await bcrypt.hash('Admin@12345', 10),
    role: 'admin',
  });
}
console.log('Seed done');
await mongoose.disconnect();