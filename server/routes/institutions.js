import { Router } from 'express';
import Institution from '../models/Institution.js';
import Application from '../models/Application.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Makes user text safe to use inside a regular expression
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INSTITUTION_FIELDS = [
  'name', 'aliases', 'type', 'sector', 'city', 'website', 'admissionUrl', 'description', 'deadline', 'lastVerifiedAt',
];
const PROGRAM_FIELDS = ['name', 'field', 'minPercentage', 'feePerYear', 'deadline', 'accreditedBy'];

// Keep only the fields an admin is allowed to set; an empty value clears the field
function pick(source, fields) {
  const result = {};
  for (const key of fields) {
    if (source[key] !== undefined) result[key] = source[key] === '' ? null : source[key];
  }
  return result;
}

function cleanInstitution(body) {
  const data = pick(body, INSTITUTION_FIELDS);
  if (Array.isArray(body.programs)) {
    data.programs = body.programs.map((p) => pick(p, PROGRAM_FIELDS));
  }
  if (Array.isArray(data.aliases)) {
    data.aliases = [...new Set(data.aliases.map((a) => String(a).trim()).filter(Boolean))].slice(0, 15);
  }
  return data;
}

// Each word must match the start of a word in the name, a short name or the city.
// "uet lahore" finds UET Lahore; "lums" finds LUMS.
function searchFilter(q) {
  const words = String(q).trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return words.map((w) => {
    const re = new RegExp(`\\b${escapeRegex(w)}`, 'i');
    return { $or: [{ name: re }, { aliases: re }, { city: re }] };
  });
}

// List with search, filters and pagination
router.get('/', async (req, res) => {
  try {
    const { city, type, q, province, sector } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));

    const filter = {};
    if (city) filter.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (province) filter.province = new RegExp(`^${escapeRegex(province)}$`, 'i');
    if (sector === 'public' || sector === 'private') filter.sector = sector;
    if (type) filter.type = type;
    if (q && q.trim()) filter.$and = searchFilter(q);

    const [items, total] = await Promise.all([
      Institution.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
      Institution.countDocuments(filter),
    ]);

    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error('Institutions list error:', err);
    res.status(500).json({ message: 'Unable to load institutions' });
  }
});

// Number of institutions in each province, for the homepage
// (must stay above '/:id', otherwise "stats" would be treated as an id)
router.get('/stats', async (req, res) => {
  try {
    const rows = await Institution.aggregate([
      { $group: { _id: '$province', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    const byProvince = rows.filter((r) => r._id).map((r) => ({ province: r._id, count: r.count }));
    res.json({ total, byProvince });
  } catch (err) {
    console.error('Institution stats error:', err);
    res.status(500).json({ message: 'Unable to load statistics' });
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
    const item = await Institution.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    // Remove applications that point to this institution, so no empty records are left
    const { deletedCount } = await Application.deleteMany({ institution: req.params.id });
    res.json({ ok: true, deletedApplications: deletedCount });
  } catch (err) {
    console.error('Institution delete error:', err.message);
    res.status(500).json({ message: 'Unable to delete the institution' });
  }
});

export default router;