import { Router } from 'express';
import Institution from '../models/Institution.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  const { city, type, q } = req.query;
  const filter = {};
  if (city) filter.city = new RegExp(`^${city}$`, 'i');
  if (type) filter.type = type;
  if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const items = await Institution.find(filter).sort({ name: 1 }).limit(100);
  res.json({ items });
});

router.get('/:id', async (req, res) => {
  const item = await Institution.findById(req.params.id).catch(() => null);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json({ item });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const item = await Institution.create(req.body);
  res.status(201).json({ item });
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const item = await Institution.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ item });
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await Institution.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;