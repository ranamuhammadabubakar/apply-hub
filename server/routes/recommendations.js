import { Router } from 'express';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function scoreProgram(profile, inst, program) {
  let score = 0;
  const reasons = [];

  if (program.field === profile.field) {
    score += 40;
    reasons.push('Aap ki field se match');
  } else return null;

  if (profile.percentage >= program.minPercentage) {
    score += 30;
    reasons.push(`Aap ke marks (${profile.percentage}%) merit se ${profile.percentage - program.minPercentage}% zyada`);
  } else if (program.minPercentage - profile.percentage <= 5) {
    score += 10;
    reasons.push('Marks merit ke qareeb hain');
  } else return null;

  if (profile.city && inst.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 15;
    reasons.push('Aap ke shehar mein');
  }

  if (!profile.maxBudget || program.feePerYear <= profile.maxBudget) {
    score += 15;
    reasons.push('Budget mein');
  }

  return { score, reasons };
}

router.get('/', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  const profile = user.profile;
  if (!profile.percentage || profile.field === 'other') {
    return res.status(400).json({ message: 'Pehle apni profile (field aur marks) complete karein' });
  }

  const institutions = await Institution.find();
  const results = [];
  for (const inst of institutions) {
    for (const program of inst.programs) {
      const r = scoreProgram(profile, inst, program);
      if (r) {
        results.push({
          institutionId: inst._id,
          institution: inst.name,
          city: inst.city,
          type: inst.type,
          deadline: inst.deadline,
          program: program.name,
          feePerYear: program.feePerYear,
          minPercentage: program.minPercentage,
          score: r.score,
          reasons: r.reasons,
        });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  res.json({ items: results.slice(0, 30) });
});

export default router;