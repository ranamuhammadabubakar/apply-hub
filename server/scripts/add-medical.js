// Adds MBBS (Punjab public sector) to medical universities and adds three Lahore public medical colleges.
// Source: UHS admission notice and Punjab admission policy 2026-27; 2025-26 first selection list.
// Dry run (default): prints what would change. Save: node scripts/add-medical.js --save
// Never deletes anything. Existing programs, links and descriptions are kept.
import 'dotenv/config';
import mongoose from 'mongoose';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');

const ADMISSION_URL = 'http://public-mbbs.uhs.edu.pk';
const NOTE =
  'MBBS admission to Punjab public medical colleges is through UHS Lahore. The merit shown is the lowest ' +
  'closing aggregate of the 2025-26 first selection list (MDCAT 50%, FSc 40%, Matric 10%). ' +
  'Applications for 2026-27 closed on 30 October 2026.';

const MBBS = { name: 'MBBS', field: 'medical', minPercentage: 93.6, feePerYear: 50000 };

// Medical universities already imported from the HEC list
const EXISTING = [
  /^King Edward Medical University/i,
  /^Fatima Jinnah Medical University/i,
  /^Rawalpindi Medical University/i,
  /^Nishtar Medical University/i,
  /^Faisalabad Medical University/i,
];

// Public medical colleges that are not separate universities, so they are not in the HEC list
const NEW_COLLEGES = [
  { name: 'Allama Iqbal Medical College', city: 'Lahore', aliases: ['AIMC'] },
  { name: 'Services Institute of Medical Sciences', city: 'Lahore', aliases: ['SIMS'] },
  { name: 'Ameer-ud-Din Medical College', city: 'Lahore', aliases: ['AMC', 'PGMI'] },
];

function addMbbs(inst) {
  const hasMbbs = inst.programs.some((p) => p.name.toLowerCase() === 'mbbs');
  if (!hasMbbs) inst.programs.push(MBBS);
  if (!inst.admissionUrl) inst.admissionUrl = ADMISSION_URL;
  if (!inst.description) inst.description = NOTE;
  return !hasMbbs;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });

  for (const pattern of EXISTING) {
    const inst = await Institution.findOne({ name: pattern });
    if (!inst) {
      console.log(`Not found: ${pattern}`);
      continue;
    }
    const added = addMbbs(inst);
    console.log(`${inst.name}: ${added ? 'MBBS will be added' : 'already has MBBS'}`);
    if (SAVE) await inst.save();
  }

  for (const c of NEW_COLLEGES) {
    let inst = await Institution.findOne({ name: c.name });
    if (inst) {
      const added = addMbbs(inst);
      console.log(`${inst.name}: ${added ? 'MBBS will be added' : 'already has MBBS'}`);
      if (SAVE) await inst.save();
      continue;
    }
    console.log(`${c.name}: will be created with MBBS`);
    if (SAVE) {
      await Institution.create({
        name: c.name,
        aliases: c.aliases,
        type: 'medical-college',
        sector: 'public',
        city: c.city,
        province: 'Punjab',
        category: 'Medical',
        admissionUrl: ADMISSION_URL,
        description: NOTE,
        source: 'manual',
        programs: [MBBS],
      });
    }
  }

  console.log(SAVE ? 'Saved. Nothing was deleted.' : 'Dry run only. Run again with --save to write to the database.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});