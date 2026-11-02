import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const sign = (user, expiresIn = '7d') =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, profile: u.profile });

// Demo student used by visitors who want to try the site without registering
const DEMO_EMAIL = 'demo.student@applyhub.test';
const DEMO_PROFILE = {
  field: 'cs',
  percentage: 90,
  city: 'Lahore',
  maxBudget: 300000,
  interests: ['Computer', 'Software', 'Data'],
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Name, email and password (min 6 chars) required' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: 'student' });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Unable to register right now' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      return res.status(401).json({ message: 'Wrong email or password' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Unable to log in right now' });
  }
});

// One-click demo login: creates the demo student if needed and resets its profile
router.post('/demo', async (req, res) => {
  try {
    if (process.env.DEMO_ENABLED === 'false') {
      return res.status(403).json({ message: 'Demo login is turned off' });
    }

    let user = await User.findOne({ email: DEMO_EMAIL });
    if (!user) {
      // Random password that nobody knows, so the account can only be used through this route
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name: 'Demo Student',
        email: DEMO_EMAIL,
        password: await bcrypt.hash(randomPassword, 10),
        role: 'student',
        profile: DEMO_PROFILE,
      });
    } else {
      user.profile = DEMO_PROFILE;
      await user.save();
    }

    res.json({ token: sign(user, '2h'), user: publicUser(user) });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ message: 'Demo login is not available right now' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ message: 'Unable to load user' });
  }
});

export default router;