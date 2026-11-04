// Imports undergraduate business programs (BBA, BBS, BSBA, BS Accounting & Finance) from NBEAC's list.
// Every listed school offers the program; schools whose status is "Accredited" or "Reaccreditation"
// get the "NBEAC accredited" mark.
// If NBEAC blocks the script, save the page from your browser (Ctrl + S, "Webpage, HTML Only")
// as scripts/nbeac.html and run again.
// Dry run (default): writes scripts/nbeac-report.txt. Save: node scripts/import-nbeac.js --save
// Only adds programs or the accreditation mark. Never deletes anything.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');
const URL_NBEAC = 'https://nbeac.org.pk/index.php/accredited-business-schools';
const LOCAL_FILE = new URL('./nbeac.html', import.meta.url);
const REPORT = new URL('./nbeac-report.txt', import.meta.url);

// NBEAC program codes -> program names for undergraduate students
const PROGRAM_NAMES = {
  BBA: 'BBA',
  BBS: 'BBS',
  BSBA: 'BS Business Administration',
  BSAF: 'BS Accounting & Finance',
};

// Names that the automatic matching cannot handle (spelling differences, campuses, typos)
const MANUAL_MATCHES = [
  { nbeac: /^COMSATS University Islamabad, Attock/i, ours: /^COMSATS/i, campus: 'Attock' },
  { nbeac: /^COMSATS, University Islamabad, Vehari/i, ours: /^COMSATS/i, campus: 'Vehari' },
  { nbeac: /^COMSATS, University, Abbottabad/i, ours: /^COMSATS/i, campus: 'Abbottabad' },
  { nbeac: /^COMSATS, University, Lahore/i, ours: /^COMSATS/i, campus: 'Lahore' },
  { nbeac: /SZABIST\), Karachi/i, ours: /^Shaheed Zulfikar Ali Bhutto Institute/i, campus: '' },
  { nbeac: /SZABIST\), Islamabad/i, ours: /^Shaheed Zulfikar Ali Bhutto Institute/i, campus: 'Islamabad' },
  { nbeac: /SZABIST\), Hyderabad/i, ours: /^Shaheed Zulfikar Ali Bhutto Institute/i, campus: 'Hyderabad' },
  { nbeac: /^Balochistan University of Information Technology/i, ours: /^Balochistan University of Information Technology/i, campus: '' },
  { nbeac: /^CECOS University/i, ours: /^CECOS University/i, campus: '' },
  { nbeac: /^University of Kotli/i, ours: /^University of Kotli/i, campus: '' },
  { nbeac: /^Qurtuba University/i, ours: /^Qurtaba University/i, campus: '' },
  { nbeac: /^Sukkur Institute of Business Administration/i, ours: /^Sukkur IBA/i, campus: '' },
  { nbeac: /^Institute of Management Sciences, Peshawar/i, ours: /^Institute of Management Science$/i, campus: '' },
];

const REGION_TO_PROVINCE = {
  PUNJAB: 'Punjab',
  SINDH: 'Sindh',
  KPK: 'Khyber Pakhtunkhwa',
  BALOCHISTAN: 'Balochistan',
  FEDERAL: 'Islamabad Capital Territory',
  AJK: 'Azad Jammu & Kashmir',
};

const ALLOWED_EXTRA_WORDS = new Set(['campus', 'sub', 'school', 'business', 'faculty', 'department', 'institute', 'ajk']);

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
const compact = (tokens) => tokens.join('');
const titleCase = (word) => word.charAt(0).toUpperCase() + word.slice(1);

async function getHtml() {
  if (fs.existsSync(LOCAL_FILE)) return fs.readFileSync(LOCAL_FILE, 'utf8');
  const res = await fetch(URL_NBEAC, { headers: { 'User-Agent': 'ApplyHub/1.0 (accredited programs import)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}. Save the page as scripts/nbeac.html and run again.`);
  return res.text();
}

// Rows: S.no | Institute | Department | Programs | Session | Sector | Region | Status
function parseRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr)
      .find('td')
      .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get();
    if (cells.length < 8 || !/^\d+$/.test(cells[0])) return;
    rows.push({
      institute: cells[1],
      programs: cells[3],
      region: cells[6].toUpperCase(),
      status: cells[7],
    });
  });
  return rows;
}

function undergraduatePrograms(text) {
  const codes = text.toUpperCase().match(/\b(BBA|BBS|BSBA|BSAF)\b/g) || [];
  return [...new Set(codes)].map((c) => PROGRAM_NAMES[c]);
}

// "Accredited" and "Reaccreditation" count as accredited; "Under Process" and "Expired" do not
const isCurrentlyAccredited = (status) => /accredited|reaccreditation/i.test(status) && !/expired|process/i.test(status);

function findMatch(row, institutions, cityWords) {
  const manual = MANUAL_MATCHES.find((m) => m.nbeac.test(row.institute));
  if (manual) {
    const inst = institutions.find((i) => manual.ours.test(i.name));
    return inst ? { inst, campusCity: manual.campus } : null;
  }

  const tokens = toTokens(row.institute);
  const tokenSet = new Set(tokens);
  const tokenCompact = compact(tokens);
  const province = REGION_TO_PROVINCE[row.region];
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
    const ownCityCompact = compact(ownCity); // "bahawal pur" -> "bahawalpur"
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

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  const rows = parseRows(await getHtml());
  console.log(`NBEAC page: ${rows.length} business schools`);

  const institutions = await Institution.find({});
  const cityWords = new Set(institutions.flatMap((i) => [...toTokens(i.city || ''), compact(toTokens(i.city || ''))]));
  const report = [];
  let added = 0;
  let marked = 0;
  let unmatched = 0;
  const changed = new Set();

  for (const row of rows) {
    const programs = undergraduatePrograms(row.programs);
    if (programs.length === 0) continue;

    const found = findMatch(row, institutions, cityWords);
    if (!found) {
      unmatched++;
      report.push(`NO MATCH ${row.institute} | ${row.programs} | ${row.status}`);
      continue;
    }

    const { inst, campusCity } = found;
    const accredited = isCurrentlyAccredited(row.status);
    const existing = new Map(inst.programs.map((p) => [p.name.toLowerCase(), p]));
    const newNames = [];

    for (const base of programs) {
      const name = campusCity ? `${base} (${campusCity} Campus)` : base;
      const current = existing.get(name.toLowerCase());
      if (current) {
        if (accredited && !current.accreditedBy) {
          current.accreditedBy = 'NBEAC';
          marked++;
          changed.add(inst);
        }
        continue;
      }
      const program = { name, field: 'business', minPercentage: null, feePerYear: null };
      if (accredited) {
        program.accreditedBy = 'NBEAC';
        marked++;
      }
      inst.programs.push(program);
      existing.set(name.toLowerCase(), program);
      newNames.push(name);
      added++;
      changed.add(inst);
    }

    report.push(
      `MATCHED  ${row.institute}  =>  ${inst.name} [${accredited ? 'accredited' : row.status || 'no status'}]` +
        (newNames.length ? `, add ${newNames.join(', ')}` : ', nothing new')
    );
  }

  if (SAVE) {
    for (const inst of changed) await inst.save();
  }

  fs.writeFileSync(REPORT, report.join('\n'));
  console.log(`${added} business programs ${SAVE ? 'added' : 'would be added'}, ${marked} marked as NBEAC accredited. ${unmatched} schools not matched.`);
  console.log('Details saved to scripts/nbeac-report.txt');
  console.log(SAVE ? 'Saved. Nothing was deleted.' : 'Dry run only. Run again with --save to write to the database.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});