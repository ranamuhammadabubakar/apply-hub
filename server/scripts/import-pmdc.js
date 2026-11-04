// Imports PMDC recognised medical and dental colleges with MBBS / BDS programs.
// If PMDC blocks the script, save each page from your browser (Ctrl + S, "Webpage, HTML Only")
// into the scripts folder with the file name shown below, and run the script again.
// Dry run (default): prints a summary and writes scripts/pmdc-report.txt.
// Save:              node scripts/import-pmdc.js --save
// Optional:          --remove-duplicate-mbbs removes the MBBS that add-medical.js put on four
//                    universities whose MBBS is taught at a separate PMDC college (listed below).
// Apart from that option, nothing is deleted. Existing programs, links and descriptions are kept.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');
const REMOVE_DUPLICATE_MBBS = process.argv.includes('--remove-duplicate-mbbs');
const REPORT = new URL('./pmdc-report.txt', import.meta.url);

const LISTS = [
  { file: 'pmdc-public-medical.html', url: 'https://pmdc.pk/Colleges/PublicMedicalColleges', sector: 'public', program: 'MBBS' },
  { file: 'pmdc-private-medical.html', url: 'https://pmdc.pk/Colleges/PrivateMedicalColleges', sector: 'private', program: 'MBBS' },
  { file: 'pmdc-public-dental.html', url: 'https://pmdc.pk/Colleges/PublicDentalColleges', sector: 'public', program: 'BDS' },
  { file: 'pmdc-private-dental.html', url: 'https://pmdc.pk/Colleges/PrivateDentalColleges', sector: 'private', program: 'BDS' },
];

// Universities that got MBBS from add-medical.js, while PMDC lists their MBBS under a separate college
const UNIVERSITIES_WITH_SEPARATE_MBBS_COLLEGE = [
  /^Fatima Jinnah Medical University/i,
  /^Rawalpindi Medical University/i,
  /^Nishtar Medical University/i,
  /^Faisalabad Medical University/i,
];

const UHS_PUBLIC_MBBS = 'http://public-mbbs.uhs.edu.pk';
const UHS_SITE = 'https://www.uhs.edu.pk';
const PUNJAB_PRIVATE_MBBS_DEADLINE = '2026-11-06'; // UHS central admission, session 2026-27
// Punjab public MBBS: lowest closing aggregate of the 2025-26 first list, and the 2026-27 open merit fee
const PUNJAB_PUBLIC_MBBS = { minPercentage: 93.6, feePerYear: 50000 };
// Public colleges in Punjab whose admission is not through UHS
const NOT_THROUGH_UHS = /army medical college/i;

const PROVINCES = {
  AJK: 'Azad Jammu & Kashmir',
  BALOCHISTAN: 'Balochistan',
  KPK: 'Khyber Pakhtunkhwa',
  PUNJAB: 'Punjab',
  SINDH: 'Sindh',
  ISLAMABAD: 'Islamabad Capital Territory',
  'GILGIT-BALTISTAN': 'Gilgit Baltistan',
};

// "Dental Section, Bolan Medical College" -> parent "Bolan Medical College"
const DENTAL_PART = /^(dental section|dental college|dental department|college of dentistry|institute of dentistry|faculty of dentistry|school of dentistry)\s*,\s*(.+)$/i;

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(the|of|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "Lahore Cantt" -> "Lahore", "Mirpur-AJ&K" -> "Mirpur", "Peshawar." -> "Peshawar"
const cleanCity = (city) =>
  String(city || '')
    .split('-')[0]
    .replace(/\s*Cantt\.?$/i, '')
    .replace(/\.+$/, '')
    .trim();

// Name used for matching: without the city at the end
function matchKey(name, city) {
  let key = normalize(name);
  const cityKey = normalize(cleanCity(city));
  if (cityKey && key.endsWith(` ${cityKey}`)) key = key.slice(0, -cityKey.length - 1).trim();
  return key;
}

async function getHtml(list) {
  const local = new URL(`./${list.file}`, import.meta.url);
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const res = await fetch(list.url, { headers: { 'User-Agent': 'ApplyHub/1.0 (recognised colleges import)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}. Save the page as scripts/${list.file} and run again.`);
  return res.text();
}

// Read the table rows: Province | College Name | City | Seat Allocation | Note
function parseList(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $('table tr').each((_, tr) => {
    const cells = $(tr)
      .find('td')
      .map((__, td) => $(td).text().replace(/\s+/g, ' ').trim())
      .get();
    if (cells.length < 3 || !cells[1]) return;
    rows.push({ region: cells[0].toUpperCase(), name: cells[1], city: cells[2], seats: cells[3] || '', note: cells[4] || '' });
  });
  return rows;
}

function provinceFor(row) {
  if (/islamabad/i.test(cleanCity(row.city))) return 'Islamabad Capital Territory';
  return PROVINCES[row.region] || row.region;
}

function throughUhs(list, province, name) {
  return province === 'Punjab' && !NOT_THROUGH_UHS.test(name);
}

function programFor(list, province, name) {
  const program = { name: list.program, field: 'medical', minPercentage: null, feePerYear: null, accreditedBy: 'PMDC' };
  if (list.program === 'MBBS' && throughUhs(list, province, name)) {
    if (list.sector === 'public') Object.assign(program, PUNJAB_PUBLIC_MBBS);
    else program.deadline = PUNJAB_PRIVATE_MBBS_DEADLINE;
  }
  return program;
}

function admissionUrlFor(list, province, name) {
  if (!throughUhs(list, province, name)) return undefined;
  return list.sector === 'public' && list.program === 'MBBS' ? UHS_PUBLIC_MBBS : UHS_SITE;
}

function descriptionFor(list, row, province, name) {
  const parts = [`PMDC recognised ${list.sector} ${list.program === 'MBBS' ? 'medical' : 'dental'} college.`];
  if (row.seats) parts.push(`${list.program} seats: ${row.seats}.`);
  if (throughUhs(list, province, name)) parts.push('Admission is through UHS Lahore central admissions.');
  if (list.program === 'MBBS' && list.sector === 'public' && throughUhs(list, province, name)) {
    parts.push('Merit shown is the lowest closing aggregate of the 2025-26 first list (MDCAT 50%, FSc 40%, Matric 10%). 2026-27 applications closed on 30 October 2026.');
  }
  if (row.note) parts.push(row.note);
  return parts.join(' ');
}

async function removeDuplicateMbbs(report) {
  let removed = 0;
  for (const pattern of UNIVERSITIES_WITH_SEPARATE_MBBS_COLLEGE) {
    const inst = await Institution.findOne({ name: pattern });
    if (!inst) continue;
    const before = inst.programs.length;
    inst.programs = inst.programs.filter((p) => p.name.toLowerCase() !== 'mbbs');
    if (inst.programs.length < before) {
      removed++;
      report.push(`REMOVE   MBBS from ${inst.name} (taught at its PMDC college instead)`);
      if (SAVE) await inst.save();
    }
  }
  return removed;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const report = [];

  let removed = 0;
  if (REMOVE_DUPLICATE_MBBS) removed = await removeDuplicateMbbs(report);

  const all = await Institution.find({});
  const index = new Map();
  const addToIndex = (key, inst) => {
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(inst);
  };
  all.forEach((inst) => addToIndex(matchKey(inst.name, inst.city), inst));

  let created = 0;
  let programsAdded = 0;
  let alreadyThere = 0;

  // Find an institution with this name in this city, whether it is saved or planned in this run
  const findByName = (name, city) => {
    const cityKey = normalize(cleanCity(city));
    const candidates = index.get(matchKey(name, city)) || [];
    return candidates.find((c) => !c.city || normalize(cleanCity(c.city)) === cityKey) || null;
  };

  for (const list of LISTS) {
    let rows;
    try {
      rows = parseList(await getHtml(list));
    } catch (err) {
      console.error(`${list.file}: ${err.message}`);
      continue;
    }
    console.log(`${list.file}: ${rows.length} colleges`);
    report.push(`\n=== ${list.file} ===`);

    for (const row of rows) {
      const province = provinceFor(row);
      const city = cleanCity(row.city);

      // A dental section belongs to its parent college or university
      const dental = list.program === 'BDS' ? row.name.match(DENTAL_PART) : null;
      const name = dental ? dental[2].trim() : row.name;
      const program = programFor(list, province, name);

      const existing = findByName(name, city);
      if (existing) {
        const has = existing.programs.some((p) => p.name.toLowerCase() === program.name.toLowerCase());
        if (has) {
          alreadyThere++;
          report.push(`EXISTS   ${row.name} (${city}) = ${existing.name}, already has ${program.name}`);
          continue;
        }
        existing.programs.push(program);
        if (!existing.admissionUrl && admissionUrlFor(list, province, name)) existing.admissionUrl = admissionUrlFor(list, province, name);
        if (!existing.description) existing.description = descriptionFor(list, row, province, name);
        programsAdded++;
        report.push(`ADD TO   ${row.name} (${city}) -> ${existing.name}, add ${program.name}`);
        if (SAVE && existing.save) await existing.save();
        continue;
      }

      created++;
      programsAdded++;
      report.push(`NEW      ${name} (${city}, ${province}) with ${program.name}`);
      const data = {
        name,
        type: 'medical-college',
        sector: list.sector,
        city,
        province,
        category: 'Medical',
        admissionUrl: admissionUrlFor(list, province, name),
        description: descriptionFor(list, row, province, name),
        source: 'manual',
        programs: [program],
      };
      const inst = SAVE ? await Institution.create(data) : data;
      addToIndex(matchKey(name, city), inst);
    }
  }

  fs.writeFileSync(REPORT, report.join('\n'));
  if (REMOVE_DUPLICATE_MBBS) console.log(`${removed} duplicate MBBS ${SAVE ? 'removed' : 'would be removed'} from universities.`);
  console.log(`${created} colleges ${SAVE ? 'created' : 'would be created'}, ${programsAdded} programs ${SAVE ? 'added' : 'would be added'}, ${alreadyThere} already existed.`);
  console.log('Details saved to scripts/pmdc-report.txt');
  console.log(SAVE ? 'Saved.' : 'Dry run only. Run again with --save to write to the database.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});