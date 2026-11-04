import { Router } from 'express';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const isKnown = (value) => value !== null && value !== undefined;

// Programs from another field that still suit a student of this field
const RELATED_FIELDS = {
  cs: {
    field: 'engineering',
    label: 'computing',
    keywords: /software|computer|data|artificial intelligence|\bai\b|cyber|information|telecommunication/i,
  },
};

// How well the program's field fits the student: 'exact', 'related', 'open' or null
function fieldFit(profileField, program) {
  if (profileField === 'other') return 'open'; // student has not chosen a field yet
  if (program.field === profileField) return 'exact';
  const related = RELATED_FIELDS[profileField];
  if (related && program.field === related.field && related.keywords.test(program.name)) return 'related';
  return null;
}

// Returns the student's interests that appear in the program name
function matchInterests(interests = [], programName = '') {
  const name = programName.toLowerCase();
  return interests.filter((i) => {
    const word = i.trim().toLowerCase();
    return word.length >= 3 && name.includes(word);
  });
}

function scoreProgram(profile, inst, program) {
  // 1. Field must match, be closely related, or the student is open to all fields
  const fit = fieldFit(profile.field, program);
  if (!fit) return null;

  // 2. Skip programs whose deadline has already passed
  const deadline = program.deadline || inst.deadline;
  if (deadline && new Date(deadline) < new Date()) return null;

  let score;
  const reasons = [];
  if (fit === 'exact') {
    score = 30;
    reasons.push('Matches your field of interest');
  } else if (fit === 'related') {
    score = 25;
    reasons.push(`Related to your field (${RELATED_FIELDS[profile.field].label})`);
  } else {
    score = 20;
    reasons.push('You are open to all fields');
  }

  // 3. Marks: a bigger margin above the merit gives a higher score
  let chance;
  if (!isKnown(program.minPercentage)) {
    score += 12;
    chance = 'Check merit';
    reasons.push('Merit not published yet, check the official website');
  } else {
    const margin = Math.round((profile.percentage - program.minPercentage) * 10) / 10;
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
  }

  // 4. City
  if (profile.city && inst.city && inst.city.toLowerCase() === profile.city.toLowerCase()) {
    score += 15;
    reasons.push('In your preferred city');
  }

  // 5. Budget: full points inside budget, a few points if slightly above
  if (!isKnown(program.feePerYear)) {
    reasons.push('Fee not published yet');
  } else if (!profile.maxBudget || program.feePerYear <= profile.maxBudget) {
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

  // 7. Accreditation
  if (program.accreditedBy) {
    score += 3;
    reasons.push(`${program.accreditedBy} accredited program`);
  }

  return { score: Math.min(score, 100), reasons, chance };
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('profile').lean();
    const profile = user?.profile;
    if (!profile?.percentage) {
      return res.status(400).json({ message: 'Please add your marks to your profile first' });
    }

    // Only institutions with a program the student could be interested in
    let filter;
    if (profile.field === 'other') {
      filter = { 'programs.0': { $exists: true } };
    } else {
      const fields = [profile.field];
      if (RELATED_FIELDS[profile.field]) fields.push(RELATED_FIELDS[profile.field].field);
      filter = { 'programs.field': { $in: fields } };
    }
    const institutions = await Institution.find(filter).lean();

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
            sector: inst.sector,
            admissionUrl: inst.admissionUrl,
            website: inst.website,
            deadline: program.deadline || inst.deadline,
            program: program.name,
            field: program.field,
            feePerYear: isKnown(program.feePerYear) ? program.feePerYear : null,
            minPercentage: isKnown(program.minPercentage) ? program.minPercentage : null,
            accreditedBy: program.accreditedBy || null,
            score: r.score,
            chance: r.chance,
            reasons: r.reasons,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    res.json({ items: results.slice(0, 30), total: results.length, profileField: profile.field });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ message: 'Unable to retrieve recommendations at this time.' });
  }
});

export default router;