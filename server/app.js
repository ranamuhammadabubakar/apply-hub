import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import institutionRoutes from './routes/institutions.js';
import recommendationRoutes from './routes/recommendations.js';
import applicationRoutes from './routes/applications.js';
import counselingRoutes from './routes/counseling.js';

let connecting = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    connecting = mongoose.connect(process.env.MONGO_URI).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  await connecting;
}

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || '*' }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    res.status(500).json({ message: 'Database connection failed' });
  }
});

app.get('/', (req, res) => res.json({ ok: true, name: 'Apply Hub API' }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/counseling', counselingRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

export default app;