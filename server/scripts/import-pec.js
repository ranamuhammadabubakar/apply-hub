// Reads PEC's list of accredited engineering programs and matches each institution to our database.
// First save the PEC pages from your browser (Ctrl + S, "Webpage, HTML Only") as:
//   scripts/pec-level-2.html and scripts/pec-level-1.html
// Dry run (default): writes scripts/pec-programs.json for review. Nothing is saved.
// Save:              node scripts/import-pec.js --from-file --save
// Saving only adds programs that do not exist yet. It never deletes or changes existing programs.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';

const PAGE_FILES = ['pec-level-2.html', 'pec-level-1.html'];
const MIN_RECENT_YEAR = 2019; // ignore programs whose last accredited batch is older than this
const SAVE = process.argv.includes('--save');
const FROM_FILE = process.argv.includes('--from-file');
const OUTPUT = new URL('./pec-programs.json', import.meta.url);

const REGION_TO_PROVINCE = {
  ISLAMABAD: 'Islamabad Capital Territory',
  PUNJAB: 'Punjab',
  'KHYBER-PAKHTUNKHWA': 'Khyber Pakhtunkhwa',
  'KHYBER PAKHTUNKHWA': 'Khyber Pakhtunkhwa',
  SINDH: 'Sindh',
  BALOCHISTAN: 'Balochistan',
  'AJ&K': 'Azad Jammu & Kashmir',
  AJK: 'Azad Jammu & Kashmir',
  'GILGIT-BALTISTAN': 'Gilgit Baltistan',
};

// Extra words in a PEC name that do not change which university it is
const ALLOWED_EXTRA_WORDS = new Set([
  'campus', 'sub', 'school', 'faculty', 'department', 'institute', 'engineering',
  'civil', 'environmental', 'chemical', 'materials', 'electrical', 'mechanical', 'aeronautical',
]);

// "Muhammad Ali Jinnah University (MAJU), Karachi" -> "muhammad ali jinnah university karachi"
const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/\bmohammad\b/g, 'muhammad')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|of|and|for|in|at)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTokens = (text) => normalize(text).split(' ').filter(Boolean);

// Join split spellings, e.g. "zia ud din" -> "ziauddin", so they match "Ziauddin"
const compact = (tokens) => tokens.join('');

// Keep only the institution's main name: drop " – School of ..." and anything in brackets
function mainName(fullName) {
  return fullName
    .split(/\s[–—]\s|\s-\s/)[0]
    .split(/[([]/)[0]
    .replace(/[,\s]+$/, '')
    .trim();
}

// "B.Sc. Electrical Engineering – From Intake of Batch 2019 to 2021." -> "BSc Electrical Engineering"
function cleanProgramName(text) {
  return text
    .split(/\s[–—-]\s/)[0]
    .replace(/B\.\s?Sc\.?/gi, 'BSc')
    .replace(/B\.\s?E\.?\s/gi, 'BE ')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim();
}

function isRecent(text) {
  if (/onward/i.test(text)) return true;
  const years = (text.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  return years.length === 0 || Math.max(...years) >= MIN_RECENT_YEAR;
}

// Read one PEC page into [{ region, institution, campus, programs: [] }]
function parsePage(html) {
  const $ = cheerio.load(html);
  const entries = [];
  let region = '';

  $('h1, h2, h3, h4, h5, h6, ol').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'ol') {
      const match = $(el).text().match(/REGION:\s*(.+)/i);
      if (match) region = match[1].trim().toUpperCase();
      return;
    }
    if ($(el).parents('li').length > 0) return; // only top-level lists hold institutions

    $(el)
      .children('li')
      .each((__, li) => {
        const fullName = $(li).clone().children('ol, ul').remove().end().text().replace(/\s+/g, ' ').trim();
        if (!fullName) return;

        const campusMatch = fullName.match(/\(([^()]*campus[^()]*)\)/i);

        const programs = [];
        $(li)
          .children('ol, ul')
          .children('li')
          .each((___, p) => {
            const text = $(p).text().replace(/\s+/g, ' ').trim();
            if (!text || !isRecent(text)) return;
            const name = cleanProgramName(text);
            if (name && !programs.includes(name)) programs.push(name);
          });

        if (programs.length) {
          entries.push({
            region,
            institution: mainName(fullName),
            fullName,
            campus: campusMatch ? campusMatch[1].trim() : '',
            programs,
          });
        }
      });
  });

  return entries;
}

// Find the best matching institution in our database, or null when unsure
function findMatch(entry, institutions, cityWords) {
  const pecTokens = toTokens(entry.institution);
  const pecSet = new Set(pecTokens);
  const pecCompact = compact(pecTokens);
  const province = REGION_TO_PROVINCE[entry.region];

  let best = null;
  let bestScore = -Infinity;

  for (const inst of institutions) {
    const dbTokens = toTokens(inst.name);
    if (dbTokens.length === 0) continue;

    // Every word of our university's name must appear in the PEC name
    const allWordsPresent = dbTokens.every((t) => pecSet.has(t)) || pecCompact.includes(compact(dbTokens));
    if (!allWordsPresent) continue;

    // Extra words in the PEC name must only be a city or a word like "Campus"
    const dbSet = new Set(dbTokens);
    const ownCity = toTokens(inst.city || '');
    const extras = pecTokens.filter((t) => !dbSet.has(t) && !ownCity.includes(t) && !compact(dbTokens).includes(t));
    const unknownExtras = extras.filter((t) => !cityWords.has(t) && !ALLOWED_EXTRA_WORDS.has(t));
    const longName = dbTokens.length >= 4;
    if (unknownExtras.length > 0 && !(longName && unknownExtras.length <= 2)) continue;

    const sameCity = ownCity.length > 0 && ownCity.every((t) => pecSet.has(t));
    const score = dbTokens.length * 10 + (sameCity ? 5 : 0) + (province && inst.province === province ? 3 : 0) - extras.length;
    if (score > bestScore) {
      bestScore = score;
      best = inst;
    }
  }

  return best;
}

async function buildReport() {
  const entries = [];
  for (const file of PAGE_FILES) {
    const path = new URL(`./${file}`, import.meta.url);
    if (!fs.existsSync(path)) {
      console.log(`Skipped ${file} (file not found in scripts folder)`);
      continue;
    }
    const found = parsePage(fs.readFileSync(path, 'utf8'));
    console.log(`${file}: ${found.length} institutions with recent programs`);
    entries.push(...found);
  }
  if (entries.length === 0) {
    throw new Error('No programs found. Save the PEC pages as HTML into the scripts folder first.');
  }

  const institutions = await Institution.find({}, 'name city province').lean();
  const cityWords = new Set(institutions.flatMap((i) => toTokens(i.city || '')));

  const matched = [];
  const unmatched = [];

  for (const entry of entries) {
    const inst = findMatch(entry, institutions, cityWords);
    const programs = entry.programs.map((p) => (entry.campus ? `${p} (${entry.campus})` : p));
    if (inst) {
      matched.push({ pecName: entry.institution, institutionId: String(inst._id), institutionName: inst.name, programs });
    } else {
      unmatched.push({ pecName: entry.fullName, region: entry.region, programs });
    }
  }

  const programCount = matched.reduce((sum, m) => sum + m.programs.length, 0);
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify({ createdAt: new Date(), matchedCount: matched.length, unmatchedCount: unmatched.length, programCount, matched, unmatched }, null, 2)
  );
  console.log(`Matched ${matched.length} institutions (${programCount} programs). Not matched: ${unmatched.length}.`);
  console.log('Details saved to scripts/pec-programs.json');
  return matched;
}

async function saveToDatabase(matched) {
  let added = 0;
  let skipped = 0;

  for (const m of matched) {
    const inst = await Institution.findById(m.institutionId);
    if (!inst) continue;
    const existing = new Set(inst.programs.map((p) => p.name.toLowerCase()));

    for (const name of m.programs) {
      if (existing.has(name.toLowerCase())) {
        skipped++;
        continue;
      }
      inst.programs.push({ name, field: 'engineering', minPercentage: null, feePerYear: null, accreditedBy: 'PEC' });
      existing.add(name.toLowerCase());
      added++;
    }
    await inst.save();
  }

  console.log(`Database: ${added} programs added, ${skipped} already existed. Nothing was deleted.`);
}

async function main() {
  console.log('Connecting to the database...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  let matched;
  if (FROM_FILE) {
    matched = JSON.parse(fs.readFileSync(OUTPUT, 'utf8')).matched;
    console.log(`Loaded ${matched.length} matched institutions from scripts/pec-programs.json`);
  } else {
    matched = await buildReport();
  }

  if (SAVE) await saveToDatabase(matched);
  else console.log('Dry run only. Nothing was saved.');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Import failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});