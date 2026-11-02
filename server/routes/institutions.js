import { Router } from 'express';
import Institution from '../models/Institution.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Makes user text safe to use inside a regular expression
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INSTITUTION_FIELDS = [
  'name', 'type', 'sector', 'city', 'website', 'admissionUrl', 'description', 'deadline', 'lastVerifiedAt',
];
const PROGRAM_FIELDS = ['name', 'field', 'minPercentage', 'feePerYear', 'deadline'];

// Keep only the fields an admin is allowed to set
function pick(source, fields) {
  const result = {};
  for (const key of fields) {
    if (source[key] !== undefined) result[key] = source[key] === '' ? undefined : source[key];
  }
  return result;
}

function cleanInstitution(body) {
  const data = pick(body, INSTITUTION_FIELDS);
  if (Array.isArray(body.programs)) {
    data.programs = body.programs.map((p) => pick(p, PROGRAM_FIELDS));
  }
  return data;
}

router.get('/', async (req, res) => {
  try {
    const { city, type, q } = req.query;
    const filter = {};
    if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (type) filter.type = type;
    if (q) filter.name = new RegExp(escapeRegex(q), 'i');
    const items = await Institution.find(filter).sort({ name: 1 }).limit(100);
    res.json({ items });
  } catch (err) {
    console.error('Institutions list error:', err);
    res.status(500).json({ message: 'Unable to load institutions' });
  }
});

router.get('/:id', async (req, res) => {
  const item = await Institution.findById(req.params.id).catch(() => null);
  if (!item) return res.status(404).json({ message: 'Not found' });
  res.json({ item });
});

router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await Institution.create(cleanInstitution(req.body));
    res.status(201).json({ item });
  } catch (err) {
    console.error('Institution create error:', err.message);
    res.status(400).json({ message: 'Please check the institution details and try again' });
  }
});

router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const item = await Institution.findByIdAndUpdate(req.params.id, cleanInstitution(req.body), {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ item });
  } catch (err) {
    console.error('Institution update error:', err.message);
    res.status(400).json({ message: 'Please check the institution details and try again' });
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    await Institution.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Institution delete error:', err.message);
    res.status(500).json({ message: 'Unable to delete the institution' });
  }
});

export default router;