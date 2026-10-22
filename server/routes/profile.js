import { Router } from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ profile: user.profile });
});

router.put('/', requireAuth, async (req, res) => {
  const { field, percentage, city, maxBudget, interests } = req.body;
  const user = await User.findById(req.user.id);
  user.profile = {
    field: field ?? user.profile.field,
    percentage: Number(percentage ?? user.profile.percentage),
    city: city ?? user.profile.city,
    maxBudget: Number(maxBudget ?? user.profile.maxBudget),
    interests: Array.isArray(interests) ? interests : user.profile.interests,
  };
  await user.save();
  res.json({ profile: user.profile });
});

export default router;