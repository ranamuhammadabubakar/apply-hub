import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Trim, remove empty and duplicate items, max 10 interests of 30 characters each
function cleanInterests(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const value = String(item).trim().slice(0, 30);
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result.slice(0, 10);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ profile: user.profile });
  } catch (err) {
    console.error('Profile load error:', err);
    res.status(500).json({ message: 'Unable to load profile' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const { field, percentage, city, maxBudget, interests } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profile = {
      field: field ?? user.profile.field,
      percentage: Number(percentage ?? user.profile.percentage),
      city: city ?? user.profile.city,
      maxBudget: Number(maxBudget ?? user.profile.maxBudget),
      interests: Array.isArray(interests) ? cleanInterests(interests) : user.profile.interests,
    };
    await user.save();
    res.json({ profile: user.profile });
  } catch (err) {
    console.error('Profile save error:', err);
    res.status(400).json({ message: 'Unable to save profile. Please check your details.' });
  }
});

export default router;