// Adds short names (aliases) to institutions so students can search "LUMS", "FAST" or "UET Lahore".
// Dry run (default): prints what would be added. Save: node scripts/add-aliases.js --save
// Only adds aliases. It never removes an alias or changes anything else.
import 'dotenv/config';
import mongoose from 'mongoose';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');
const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'on']);

// Well-known short names that cannot be built from the first letters of the name
const KNOWN = [
  { match: /^National University of Computer & Emerging Sciences/i, aliases: ['FAST', 'FAST-NUCES', 'NUCES'] },
  { match: /^University of Engineering & Technology$/i, province: 'Punjab', aliases: ['UET', 'UET Lahore'] },
  { match: /^University of Engineering & Technology$/i, province: 'Khyber Pakhtunkhwa', aliases: ['UET', 'UET Peshawar'] },
  { match: /^University of Engineering & Technology, Taxila/i, aliases: ['UET', 'UET Taxila'] },
  { match: /^University of Engineering & Technology \(UET\), Mardan/i, aliases: ['UET Mardan'] },
  { match: /^University of the Punjab$/i, aliases: ['PU', 'Punjab University'] },
  { match: /^Government College University, Lahore/i, aliases: ['GCU', 'GC University'] },
  { match: /^Government College University, Faisalabad/i, aliases: ['GCUF'] },
  { match: /^King Edward Medical University/i, aliases: ['KEMU', 'King Edward'] },
  { match: /^Fatima Jinnah Medical University/i, aliases: ['FJMU'] },
  { match: /^Bahauddin Zakariya University/i, aliases: ['BZU'] },
  { match: /^International Islamic University/i, aliases: ['IIUI', 'IIU'] },
  { match: /^Quaid-i-Azam University/i, aliases: ['QAU'] },
  { match: /^Allama Iqbal Open University/i, aliases: ['AIOU'] },
  { match: /^COMSATS/i, aliases: ['COMSATS', 'CUI', 'CIIT'] },
  { match: /^University of Central Punjab/i, aliases: ['UCP'] },
  { match: /^University of Lahore/i, aliases: ['UOL'] },
  { match: /^Shaheed Zulfikar Ali Bhutto Institute/i, aliases: ['SZABIST'] },
  { match: /^Institute of Business Administration$/i, aliases: ['IBA', 'IBA Karachi'] },
  { match: /^Sukkur IBA/i, aliases: ['IBA Sukkur'] },
  { match: /^NED University/i, aliases: ['NED'] },
  { match: /^Mehran University of Engineering/i, aliases: ['MUET', 'Mehran'] },
  { match: /^University of Karachi/i, aliases: ['KU', 'Karachi University'] },
  { match: /^Ghulam Ishaq Khan/i, aliases: ['GIKI', 'GIK'] },
  { match: /^Pakistan Institute of Engineering & Applied Sciences/i, aliases: ['PIEAS'] },
  { match: /^Information Technology University/i, aliases: ['ITU'] },
  { match: /^University of Agriculture$/i, province: 'Punjab', aliases: ['UAF', 'Agriculture University Faisalabad'] },
  { match: /^Lahore College for Women University/i, aliases: ['LCWU'] },
  { match: /^National College of Arts/i, aliases: ['NCA'] },
  { match: /^Beaconhouse National University/i, aliases: ['BNU'] },
  { match: /^Forman Christian College/i, aliases: ['FCC', 'FCCU'] },
  { match: /^University of Veterinary & Animal Sciences/i, aliases: ['UVAS'] },
  { match: /^University of Health Sciences/i, aliases: ['UHS'] },
  { match: /^Virtual University/i, aliases: ['VU'] },
  { match: /^Riphah International University/i, aliases: ['Riphah', 'RIU'] },
  { match: /^Aga Khan University/i, aliases: ['AKU'] },
  { match: /^DOW University/i, aliases: ['DUHS', 'Dow'] },
  { match: /^Lahore School of Economics/i, aliases: ['LSE'] },
  { match: /^National Textile University/i, aliases: ['NTU'] },
  { match: /^University of Gujrat/i, aliases: ['UOG'] },
  { match: /^Islamia University/i, aliases: ['IUB'] },
  { match: /^University of Sargodha/i, aliases: ['UOS'] },
  { match: /^University of Peshawar/i, aliases: ['UOP'] },
  { match: /^Air University/i, aliases: ['AU'] },
  { match: /^Bahria University/i, aliases: ['BU', 'Bahria'] },
  { match: /^National University of Modern Languages/i, aliases: ['NUML'] },
  { match: /^Muhammad Ali Jinnah University/i, aliases: ['MAJU'] },
  { match: /^Institute of Space Technology/i, aliases: ['IST'] },
];

// "Lahore University of Management Sciences" -> "LUMS"
function acronym(name) {
  const words = name
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .split(/[^A-Za-z]+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  const letters = words.map((w) => w[0].toUpperCase()).join('');
  return letters.length >= 2 && letters.length <= 7 ? letters : null;
}

// "... (BUITEMS)" -> "BUITEMS"
function bracketNames(name) {
  return [...name.matchAll(/\(([A-Z][A-Za-z\-]{1,9})\)/g)].map((m) => m[1]);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const institutions = await Institution.find({}, 'name province aliases');

  // Short names from the well-known list are reserved for their own university
  const reserved = new Set(KNOWN.flatMap((k) => k.aliases.map((a) => a.toUpperCase())));

  // Count how many institutions would get each automatic short name
  const acronymCount = new Map();
  for (const inst of institutions) {
    const a = acronym(inst.name);
    if (a) acronymCount.set(a, (acronymCount.get(a) || 0) + 1);
  }

  let changed = 0;
  let skippedShared = 0;
  const examples = [];

  for (const inst of institutions) {
    const aliases = new Set(inst.aliases || []);
    const before = aliases.size;

    // Automatic short name only when it belongs to just this one institution
    const short = acronym(inst.name);
    if (short) {
      if (acronymCount.get(short) === 1 && !reserved.has(short)) aliases.add(short);
      else skippedShared++;
    }

    bracketNames(inst.name).forEach((a) => aliases.add(a));
    for (const k of KNOWN) {
      if (k.match.test(inst.name) && (!k.province || k.province === inst.province)) {
        k.aliases.forEach((a) => aliases.add(a));
      }
    }

    if (aliases.size > before) {
      changed++;
      if (examples.length < 15) examples.push(`${inst.name}  ->  ${[...aliases].join(', ')}`);
      if (SAVE) await Institution.updateOne({ _id: inst._id }, { $set: { aliases: [...aliases] } });
    }
  }

  console.log(examples.join('\n'));
  console.log(`${changed} institutions ${SAVE ? 'updated' : 'would get new short names'}.`);
  console.log(`${skippedShared} automatic short names were skipped because they were shared or reserved.`);
  if (!SAVE) console.log('Dry run only. Run again with --save to write to the database.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});