// Imports NCEAC accredited computing programs (BS Computer Science, Software Engineering, AI, Data Science...).
// Step 1 (downloads, writes nothing):  node scripts/import-nceac.js
// Step 2 (save from the downloaded file): node scripts/import-nceac.js --from-file --save
// Pages already downloaded are reused, so running step 1 again is quick.
// Only adds programs that do not exist yet. Never deletes anything.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');
const FROM_FILE = process.argv.includes('--from-file');
const LIST_URL = 'https://nceac.org.pk/accreditation/accreditInstitutes';
const BATCH_URL = (id) => `https://nceac.org.pk/accreditation/AccreditBatches/${id}`;
const DATA_FILE = new URL('./nceac-programs.json', import.meta.url);
const REPORT = new URL('./nceac-report.txt', import.meta.url);
const MIN_YEAR = 2019;

const REGION_TO_PROVINCE = {
  punjab: 'Punjab',
  sindh: 'Sindh',
  'khyber pakhtunkhwa': 'Khyber Pakhtunkhwa',
  kpk: 'Khyber Pakhtunkhwa',
  fata: 'Khyber Pakhtunkhwa',
  balochistan: 'Balochistan',
  islamabad: 'Islamabad Capital Territory',
  federal: 'Islamabad Capital Territory',
  ajk: 'Azad Jammu & Kashmir',
  'azad jammu and kashmir': 'Azad Jammu & Kashmir',
  'azad jammu & kashmir': 'Azad Jammu & Kashmir',
  'gilgit baltistan': 'Gilgit Baltistan',
  'giilgit baltistan': 'Gilgit Baltistan',
};

// Campuses that stopped admissions: their programs are not added
const DISCONTINUED =
  /intake stopped|halted|suspended|up ?till? (fall |spring )?20(1\d|2[0-5])|up ?till? december 31, 20(1\d|2[0-5])|noc till 20(1\d|2[0-5])/i;

// Names the automatic matching gets wrong. ours: null means "not one of our institutions".
// campus: '$1' takes the campus from the NCEAC name.
const MANUAL_MATCHES = [
  { nceac: /^Sukkur Institute of Business Administration, Sukkur/i, ours: /^Sukkur IBA/i, campus: '' },
  { nceac: /^Sukkur Institute of Business Administration, Kandkot/i, ours: /^Sukkur IBA/i, campus: 'Kandkot' },
  { nceac: /^Gujrat Institute of Management Science/i, ours: null },
  { nceac: /^University of Lahore, Gujrat/i, ours: /^University of Lahore/i, campus: 'Gujrat' },
  { nceac: /^University of Sargodha, Faisalabad/i, ours: /^University of Sargodha/i, campus: 'Faisalabad' },
  { nceac: /^University of Sargodha, Mandi Bahauddin/i, ours: /^University of Sargodha/i, campus: 'Mandi Bahauddin' },
  { nceac: /^University of Kotli/i, ours: /^University of Kotli/i, campus: '' },
  { nceac: /^Qurtaba University/i, ours: /^Qurtaba University/i, campus: '' },
  { nceac: /^Mukabbir University/i, ours: /^Mukabbir University/i, campus: '' },
  { nceac: /^University of Sindh, Jamshoro/i, ours: /^University of Sindh/i, campus: '' },
  { nceac: /^Ghulam Ishaq Khan Institute/i, ours: /^Ghulam Ishaq Khan/i, campus: '' },
  { nceac: /^Karakurum International University/i, ours: /^Karakoram International University/i, campus: '' },
  { nceac: /^COMSATS University Islamabad\s*,\s*([A-Za-z ]+)/i, ours: /^COMSATS/i, campus: '$1' },
  { nceac: /^University of Engineering & Technology, Peshawar, (Jalozai)/i, ours: /^University of Engineering & Technology$/i, province: 'Khyber Pakhtunkhwa', campus: '$1' },
  { nceac: /^University of Engineering & Technology, Peshawar, Peshawar/i, ours: /^University of Engineering & Technology$/i, province: 'Khyber Pakhtunkhwa', campus: '' },
  { nceac: /^University of Engineering & Technology, Lahore, Lahore/i, ours: /^University of Engineering & Technology$/i, province: 'Punjab', campus: '' },
  { nceac: /^University of Engineering & Technology, Lahore, (Kala shah Kako|Narrowal)/i, ours: /^University of Engineering & Technology$/i, province: 'Punjab', campus: '$1' },
  { nceac: /^University of Turbat/i, ours: /^University of Turbat/i, campus: '' },
  { nceac: /^University of (the )?Poonch, Rawalakot/i, ours: /^University of (the )?Poonch/i, campus: '' },
  { nceac: /^University of Malakand/i, ours: /^University of Malakand/i, campus: '' },
  { nceac: /^Usman Institute of Technology \(UIT\) University/i, ours: /^Usman Institute of Technology/i, campus: '' },
  { nceac: /^Pakistan Navy Engineering College/i, ours: null },
  { nceac: /^Institute of Space Technology, KICSIT/i, ours: null },
  { nceac: /^Bahria University, BSEAS/i, ours: null },
  { nceac: /^Barret Hodgson University/i, ours: null },
  { nceac: /^Ibadat International University, Islamabad, Pakpattan/i, ours: null },
];

const ALLOWED_EXTRA_WORDS = new Set([
  'campus', 'sub', 'school', 'faculty', 'department', 'institute', 'ajk', 'aj', 'k', 'main', 'p', 'area', 'district', 'dist',
]);

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/\bmohammad\b/g, 'muhammad')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|of|and|for|in|at)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTokens = (text) => normalize(text).split(' ').filter(Boolean);
const compact = (tokens) => tokens.join('');
const titleCase = (text) => text.replace(/\b\w/g, (c) => c.toUpperCase());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// "BS Computer Science", "BSc Computer Science" and "Bachelor of Science in Computer Science" are the same program
const programCore = (name) =>
  normalize(name)
    .replace(/\b(bachelor|bachelors|science|bs|bsc|be|bse)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "Azad Jammu \\u0026 Kashmir" -> "Azad Jammu & Kashmir"; "Lahore\\r\\n" -> "Lahore"
const unescapeText = (text) =>
  String(text)
    .replace(/\\+u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\+[rnt]/g, ' ')
    .replace(/\\+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ApplyHub/1.0 (accredited programs import)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// The list page carries all institutes as data inside the page
function parseInstitutes(html) {
  const re = /\\"instituteId\\":\\"([0-9a-f-]{36})\\",\\"instituteName\\":\\"(.*?)\\",\\"instituteRegion\\":\\"(.*?)\\"/gi;
  const seen = new Map();
  for (const m of html.matchAll(re)) {
    if (!seen.has(m[1])) seen.set(m[1], { id: m[1], name: unescapeText(m[2]), region: unescapeText(m[3]) });
  }
  return [...seen.values()];
}

// Each program heading owns the tables after it, until the next heading
function parsePrograms(html) {
  const $ = cheerio.load(html);
  const programs = [];
  let current = null;

  $('h2, table').each((_, el) => {
    if (el.tagName === 'h2') {
      const name = $(el).text().replace(/\s+/g, ' ').trim();
      current = /^(bs|bsc|bachelor)/i.test(name) ? { name, text: '' } : null;
      if (current) programs.push(current);
    } else if (current) {
      current.text += ` ${$(el).text()}`;
    }
  });

  return programs.map((p) => {
    const years = (p.text.match(/20\d\d/g) || []).map(Number);
    const zeroVisit = /zero visit/i.test(p.text);
    const latest = years.length ? Math.max(...years) : null;
    return { name: p.name, latest, recent: zeroVisit || (latest !== null && latest >= MIN_YEAR) };
  });
}

function findAutomatic(row, institutions, cityWords) {
  const tokens = toTokens(row.name);
  const tokenSet = new Set(tokens);
  const tokenCompact = compact(tokens);
  const province = REGION_TO_PROVINCE[row.region.toLowerCase()];
  let best = null;
  let bestScore = -Infinity;
  let campusCity = '';

  for (const inst of institutions) {
    const dbTokens = toTokens(inst.name);
    if (dbTokens.length === 0) continue;
    const allWordsPresent = dbTokens.every((t) => tokenSet.has(t)) || tokenCompact.includes(compact(dbTokens));
    if (!allWordsPresent) continue;

    const dbSet = new Set(dbTokens);
    const ownCity = toTokens(inst.city || '');
    const ownCityCompact = compact(ownCity);
    const extras = tokens.filter(
      (t) => !dbSet.has(t) && !ownCity.includes(t) && t !== ownCityCompact && !compact(dbTokens).includes(t)
    );
    const unknownExtras = extras.filter((t) => !cityWords.has(t) && !ALLOWED_EXTRA_WORDS.has(t));
    if (unknownExtras.length > 0 && !(dbTokens.length >= 4 && unknownExtras.length <= 2)) continue;

    const sameCity = ownCity.length > 0 && (ownCity.every((t) => tokenSet.has(t)) || tokenSet.has(ownCityCompact));
    const score = dbTokens.length * 10 + (sameCity ? 5 : 0) + (province && inst.province === province ? 3 : 0) - extras.length;
    if (score > bestScore) {
      bestScore = score;
      best = inst;
      const otherCity = extras.find((t) => cityWords.has(t));
      campusCity = otherCity ? titleCase(otherCity) : '';
    }
  }
  return best ? { inst: best, campusCity } : null;
}

function findMatch(row, institutions, cityWords) {
  const manual = MANUAL_MATCHES.find((m) => m.nceac.test(row.name));
  if (manual) {
    if (!manual.ours) return null;
    const inst = institutions.find((i) => manual.ours.test(i.name) && (!manual.province || i.province === manual.province));
    if (!inst) return null;
    let campus = manual.campus || '';
    if (campus.includes('$1')) campus = (row.name.match(manual.nceac)?.[1] || '').trim();
    if (normalize(campus) === normalize(inst.city || '')) campus = '';
    return { inst, campusCity: titleCase(campus.toLowerCase()) };
  }
  return findAutomatic(row, institutions, cityWords);
}

async function download(institutions, cityWords) {
  const institutes = parseInstitutes(await getHtml(LIST_URL));
  console.log(`NCEAC list: ${institutes.length} institutes`);
  if (institutes.length === 0) throw new Error('No institutes found on the list page. The page format may have changed.');

  // Reuse program pages downloaded earlier
  const cache = new Map();
  if (fs.existsSync(DATA_FILE)) {
    const old = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const r of old.results || []) cache.set(r.nceacId || r.nceacName, r.programs);
  }

  const results = [];
  const unmatched = [];
  const discontinued = [];
  for (const row of institutes) {
    if (DISCONTINUED.test(row.name)) {
      discontinued.push(row);
      continue;
    }
    const found = findMatch(row, institutions, cityWords);
    if (!found) {
      unmatched.push(row);
      continue;
    }
    results.push({ nceacId: row.id, nceacName: row.name, institutionId: String(found.inst._id), institution: found.inst.name, campusCity: found.campusCity });
  }
  console.log(`${results.length} match our institutions, ${discontinued.length} campuses skipped (admissions stopped).`);

  let downloaded = 0;
  for (const [i, r] of results.entries()) {
    const cached = cache.get(r.nceacId) || cache.get(r.nceacName);
    if (cached) {
      r.programs = cached;
      continue;
    }
    try {
      r.programs = parsePrograms(await getHtml(BATCH_URL(r.nceacId)));
      downloaded++;
      console.log(`${i + 1}/${results.length} ${r.nceacName}: ${r.programs.length} programs (${r.programs.filter((p) => p.recent).length} recent)`);
    } catch (err) {
      r.programs = [];
      console.error(`${r.nceacName}: ${err.message}`);
    }
    await sleep(400); // be gentle with the NCEAC website
  }
  console.log(`${downloaded} new program pages downloaded, the rest reused.`);

  fs.writeFileSync(DATA_FILE, JSON.stringify({ createdAt: new Date(), results, unmatched, discontinued }, null, 2));
  return { results, unmatched, discontinued };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const institutions = await Institution.find({});
  const cityWords = new Set(institutions.flatMap((i) => [...toTokens(i.city || ''), compact(toTokens(i.city || ''))]));

  const { results, unmatched, discontinued } = FROM_FILE
    ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    : await download(institutions, cityWords);

  const byId = new Map(institutions.map((i) => [String(i._id), i]));
  const report = [];
  const changed = new Set();
  let added = 0;
  let skippedOld = 0;

  for (const r of results) {
    const inst = byId.get(r.institutionId);
    if (!inst) continue;
    const existingCores = new Set(inst.programs.map((p) => programCore(p.name)));
    const newNames = [];

    for (const p of r.programs || []) {
      if (!p.recent) {
        skippedOld++;
        continue;
      }
      const name = r.campusCity ? `${p.name} (${r.campusCity} Campus)` : p.name;
      const core = programCore(name);
      if (existingCores.has(core)) continue;
      inst.programs.push({
        name,
        field: /computer engineering/i.test(p.name) ? 'engineering' : 'cs',
        minPercentage: null,
        feePerYear: null,
        accreditedBy: 'NCEAC',
      });
      existingCores.add(core);
      newNames.push(name);
      added++;
      changed.add(inst);
    }
    report.push(`MATCHED  ${r.nceacName}  =>  ${inst.name}${newNames.length ? `, add ${newNames.join(', ')}` : ', nothing new'}`);
  }
  report.push('', '=== Skipped: admissions stopped ===');
  for (const d of discontinued || []) report.push(`STOPPED  ${d.name}`);
  report.push('', '=== Not in our database (mostly affiliated colleges) ===');
  for (const u of unmatched || []) report.push(`NO MATCH ${u.name} | ${u.region}`);

  if (SAVE) {
    for (const inst of changed) await inst.save();
  }

  fs.writeFileSync(REPORT, report.join('\n'));
  console.log(`${added} computing programs ${SAVE ? 'added' : 'would be added'} to ${changed.size} institutions. ${skippedOld} old programs skipped (no batch since ${MIN_YEAR}).`);
  console.log('Details saved to scripts/nceac-report.txt');
  console.log(SAVE ? 'Saved. Nothing was deleted.' : 'Dry run only. Check the report, then run: node scripts/import-nceac.js --from-file --save');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});