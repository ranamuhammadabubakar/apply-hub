import { Router } from 'express';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Returns the student's interests that appear in the program name
function matchInterests(interests = [], programName = '') {
  const name = programName.toLowerCase();
  return interests.filter((i) => {
    const word = i.trim().toLowerCase();
    return word.length >= 3 && name.includes(word);
  });
}

function scoreProgram(profile, inst, program) {
  // 1. Field must match
  if (program.field !== profile.field) return null;

  // 2. Skip programs whose deadline has already passed
  if (inst.deadline && new Date(inst.deadline) < new Date()) return null;

  let score = 30;
  const reasons = ['Matches your field of interest'];

  // 3. Marks: a bigger margin above the merit gives a higher score
  const margin = Math.round((profile.percentage - (program.minPercentage || 0)) * 10) / 10;
  let chance;
  if (margin >= 10) {
    score += 30;
    chance = 'Safe';
    reasons.push(`Your marks are ${margin}% above the merit`);
  } else if (margin >= 5) {
    score += 25;
    chance = 'Safe';
    reasons.push(`Your marks are ${margin}% above the merit`);
  } else if (margin >= 0) {
    score += 20;
    chance = 'Good chance';
    reasons.push('Your marks meet the merit');
  } else if (margin >= -5) {
    score += 8;
    chance = 'Reach';
    reasons.push(`Your marks are ${Math.abs(margin)}% below the merit`);
  } else {
    return null;
  }

  // 4. City
  if (profile.city && inst.city && inst.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 15;
    reasons.push('In your preferred city');
  }

  // 5. Budget: full points inside budget, a few points if slightly above
  if (!profile.maxBudget || program.feePerYear <= profile.maxBudget) {
    score += 15;
    reasons.push('Within your budget');
  } else if (program.feePerYear <= profile.maxBudget * 1.2) {
    score += 5;
    reasons.push('Slightly above your budget');
  } else {
    reasons.push('Above your budget');
  }

  // 6. Interests
  const matched = matchInterests(profile.interests, program.name);
  if (matched.length) {
    score += 10;
    reasons.push(`Matches your interest in ${matched.join(', ')}`);
  }

  return { score, reasons, chance };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('profile').lean();
    const profile = user?.profile;
    if (!profile?.percentage || profile.field === 'other') {
      return res.status(400).json({ message: 'Please complete your profile (field and marks) first' });
    }

    const institutions = await Institution.find().lean();
    const results = [];
    for (const inst of institutions) {
      for (const program of inst.programs || []) {
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
            chance: r.chance,
            reasons: r.reasons,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ items: results.slice(0, 30) });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ message: 'Unable to retrieve recommendations at this time.' });
  }
});

export default router;