import { Router } from 'express';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';
import Application from '../models/Application.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateJson } from '../utils/gemini.js';

const router = Router();

// Makes user text safe to use inside a regular expression
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const INSTITUTION_FIELDS = [
  'name', 'aliases', 'type', 'sector', 'city', 'website', 'admissionUrl', 'description', 'deadline', 'lastVerifiedAt',
];
const PROGRAM_FIELDS = ['name', 'field', 'minPercentage', 'feePerYear', 'deadline', 'accreditedBy', 'sourceUrl'];
const FIELDS = ['medical', 'engineering', 'cs', 'business', 'other'];

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
function searchFilter(q) {
  const words = String(q).trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return words.map((w) => {
    const re = new RegExp(`\\b${escapeRegex(w)}`, 'i');
    return { $or: [{ name: re }, { aliases: re }, { city: re }] };
  });
}

// ---------- AI extraction helpers ----------

const MAX_PAGE_CHARS = 30000;

// Only public web pages; never local or private network addresses
function isAllowedUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  return !(
    host === 'localhost' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '0.0.0.0' ||
    host.includes(':')
  );
}

// Download a page and turn it into readable text, keeping table rows on separate lines
async function pageToText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ApplyHub/1.0 (admission information review)' },
    });
    if (!res.ok) throw new Error(`The page returned HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.includes('html') && !type.includes('text')) {
      throw new Error('This link is not a web page (it may be a PDF). Copy the text and use "Paste text" instead.');
    }
    const $ = cheerio.load(await res.text());
    $('script, style, noscript, svg, iframe, header nav, footer').remove();
    $('br, p, div, li, tr, h1, h2, h3, h4, h5, h6').each((_, el) => $(el).append('\n'));
    $('td, th').each((_, el) => $(el).append(' | '));
    return $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  } finally {
    clearTimeout(timer);
  }
}

const EXTRACT_INSTRUCTIONS = `You extract admission information for Pakistani universities from page text.
Return only JSON in this shape:
{
  "programs": [
    { "name": string, "field": "medical" | "engineering" | "cs" | "business" | "other",
      "minPercentage": number or null, "feePerYear": number or null, "deadline": "YYYY-MM-DD" or null,
      "evidence": string }
  ],
  "institutionDeadline": "YYYY-MM-DD" or null,
  "notes": string
}
Rules:
- Include only undergraduate programs (BS, BSc, BE, BBA, BBS, MBBS, BDS, Pharm-D, DPT and similar). Skip MS, MPhil, MBA and PhD.
- Use only information written in the text. Never guess. If a value is not written, use null.
- "field": medical for MBBS, BDS, Pharm-D, DPT, nursing and allied health; engineering for engineering programs;
  cs for computer science, software engineering, IT, data science, AI and cyber security; business for BBA, BBS,
  accounting, finance and commerce; other for everything else.
- "minPercentage": only a closing merit or minimum aggregate for admission, as a percentage. A minimum eligibility
  such as "at least 60% marks in FSc" is NOT merit: use null and mention it in notes.
- "feePerYear": tuition fee in Pakistani rupees for one year. If the text gives a fee per semester, multiply by 2.
  If it gives a fee per credit hour or only a total for the whole degree, use null and mention it in notes.
- "deadline": the last date to apply for that program, if written.
- "evidence": copy the short line (under 200 characters) from the text where you found the fee, merit or deadline.
  Use an empty string if none of them were found.
- "notes": one or two short sentences about anything the admin should know.`;

const isValidDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const numberInRange = (value, min, max) => (typeof value === 'number' && value >= min && value <= max ? value : null);

// Never trust AI output blindly: check every value before it reaches the admin
function cleanExtraction(data) {
  const programs = (Array.isArray(data?.programs) ? data.programs : [])
    .slice(0, 80)
    .map((p) => ({
      name: String(p?.name || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      field: FIELDS.includes(p?.field) ? p.field : 'other',
      minPercentage: numberInRange(p?.minPercentage, 1, 100),
      feePerYear: numberInRange(p?.feePerYear, 1000, 10000000),
      deadline: isValidDate(p?.deadline) ? p.deadline : null,
      evidence: String(p?.evidence || '').slice(0, 300),
    }))
    .filter((p) => p.name.length >= 2);

  return {
    programs,
    institutionDeadline: isValidDate(data?.institutionDeadline) ? data.institutionDeadline : null,
    notes: String(data?.notes || '').slice(0, 500),
  };
}

// ---------- Routes ----------

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

// Admin only: read an admission page (or pasted text) with AI and return programs for review.
// Nothing is saved here; the admin reviews and saves through the normal update.
router.post('/:id/extract', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const inst = await Institution.findById(req.params.id).catch(() => null);
    if (!inst) return res.status(404).json({ message: 'Institution not found' });

    const { url, text } = req.body || {};
    let pageText = '';
    let sourceUrl = '';

    if (text && String(text).trim()) {
      pageText = String(text);
      sourceUrl = url && isAllowedUrl(url) ? url : '';
    } else if (url) {
      if (!isAllowedUrl(url)) return res.status(400).json({ message: 'Please enter a public web page link (http or https).' });
      try {
        pageText = await pageToText(url);
      } catch (err) {
        return res.status(422).json({
          message: `Could not read that page: ${err.message}. Open it in your browser, copy the text and use "Paste text".`,
        });
      }
      sourceUrl = url;
    } else {
      return res.status(400).json({ message: 'Please enter a link or paste the page text.' });
    }

    pageText = pageText.trim().slice(0, MAX_PAGE_CHARS);
    if (pageText.length < 50) return res.status(422).json({ message: 'The page has too little text to read.' });

    const prompt = `Institution: ${inst.name} (${inst.city})\nSource: ${sourceUrl || 'text pasted by the admin'}\n\nPage text:\n${pageText}`;
    const data = cleanExtraction(await generateJson(prompt, EXTRACT_INSTRUCTIONS));

    res.json({ sourceUrl, ...data });
  } catch (err) {
    console.error('Extraction error:', err.status || '', err.message);
    if (err.status === 429 || err.status === 503) {
      return res.status(503).json({ message: 'The AI is busy right now. Please try again in a minute.' });
    }
    res.status(500).json({ message: 'Could not extract programs from this page.' });
  }
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