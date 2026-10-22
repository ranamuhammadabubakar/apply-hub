import { Router } from 'express';
import Application from '../models/Application.js';
import Institution from '../models/Institution.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, requireRole('student'), async (req, res) => {
  const { institutionId, program } = req.body;
  const inst = await Institution.findById(institutionId).catch(() => null);
  if (!inst || !inst.programs.some((p) => p.name === program)) {
    return res.status(400).json({ message: 'Invalid institution or program' });
  }
  if (inst.deadline && inst.deadline < new Date()) {
    return res.status(400).json({ message: 'Deadline guzar chuki hai' });
  }
  try {
    const app = await Application.create({ student: req.user.id, institution: institutionId, program });
    res.status(201).json({ application: app });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'Aap pehle hi apply kar chuke hain' });
    throw e;
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  const items = await Application.find({ student: req.user.id })
    .populate('institution', 'name city')
    .sort({ createdAt: -1 });
  res.json({ items });
});

router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const items = await Application.find()
    .populate('institution', 'name')
    .populate('student', 'name email')
    .sort({ createdAt: -1 });
  res.json({ items });
});

router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['submitted', 'under-review', 'accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  const item = await Application.findByIdAndUpdate(req.params.id, { status }, { new: true });
  res.json({ application: item });
});

export default router;