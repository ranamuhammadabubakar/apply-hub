// Finds official YouTube campus tour videos for institutions using the YouTube Data API.
// The free quota allows about 100 searches a day, so the script works in daily batches and
// remembers which institutions were already checked.
//
// Search and preview (uses quota):   node scripts/find-tours.js --limit=90
// Save the confident matches:        node scripts/find-tours.js --from-file --save
// Only videos from the institution's own channel are saved automatically. Nothing is deleted.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import Institution from '../models/Institution.js';

const SAVE = process.argv.includes('--save');
const FROM_FILE = process.argv.includes('--from-file');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '--limit=90').split('=')[1]);
const OUTPUT = new URL('./tours.json', import.meta.url);
const REPORT = new URL('./tours-report.txt', import.meta.url);
const KEY = process.env.YOUTUBE_API_KEY;

// Words too common to identify a university on their own
const GENERIC = new Set([
  'university', 'college', 'institute', 'of', 'and', 'the', 'for', 'in', 'science', 'sciences', 'technology',
  'engineering', 'medical', 'dental', 'management', 'information', 'pakistan', 'international', 'national',
  'government', 'women', 'health', 'applied', 'emerging', 'arts', 'campus',
]);

// Extra words an official channel name may contain besides the university's own name
const OFFICIAL_EXTRA = new Set([
  'official', 'campus', 'main', 'pakistan', 'pk', 'tv', 'media', 'channel', 'the', 'of', 'and', 'university',
  'uni', 'college', 'institute', 'office', 'communications', 'communication', 'public', 'relations', 'pr',
  'admissions', 'admission', 'news', 'live', 'studio', 'videos', 'video','cell',
]);

// Titles that suggest a look at the campus
const CAMPUS_WORDS = /campus|tour|drone|aerial|documentary|introduction|walk|visit|virtual|inside/i;

const normalize = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (text) => normalize(text).split(' ').filter(Boolean);

function distinctiveWords(name) {
  return words(name).filter((w) => w.length > 2 && !GENERIC.has(w));
}

// Does this text clearly mention the institution (by short name or its distinctive words)?
function mentions(text, inst) {
  const t = normalize(text);
  const aliases = (inst.aliases || []).map((a) => normalize(a)).filter((a) => a.length >= 2);
  if (aliases.some((a) => new RegExp(`\\b${a.replace(/ /g, '\\s')}\\b`).test(t))) return true;
  const distinct = distinctiveWords(inst.name);
  return distinct.length > 0 && distinct.every((w) => t.includes(w));
}

// An official channel mentions the institution and has no other words except city and "official"-type words.
// "UET Kay Larky" is not official ("kay", "larky" are extra); "FAST NUCES, Islamabad Campus" is.
function isOfficialChannel(channel, inst, cityWords) {
  if (!mentions(channel, inst)) return false;
  const known = new Set([
    ...words(inst.name),
    ...(inst.aliases || []).flatMap((a) => words(a)),
    ...words(inst.city || ''),
  ]);
  const extra = words(channel).filter((w) => !known.has(w) && !OFFICIAL_EXTRA.has(w) && !cityWords.has(w));
  return extra.length === 0;
}

async function searchYoutube(query) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '5',
    regionCode: 'PK',
    q: query,
    key: KEY,
  }).toString();
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const err = new Error(data?.error?.message || `HTTP ${res.status}`);
    err.quota = reason === 'quotaExceeded';
    throw err;
  }
  return data.items || [];
}

function rateVideos(inst, items, cityWords) {
  return items
    .filter((item) => item.id?.videoId)
    .map((item) => {
      const title = item.snippet?.title || '';
      const channel = item.snippet?.channelTitle || '';
      const official = isOfficialChannel(channel, inst, cityWords);
      const campus = CAMPUS_WORDS.test(title);
      const titleMatch = mentions(title, inst);
      const score = (official ? 4 : 0) + (campus ? 2 : 0) + (titleMatch ? 1 : 0);
      const level = official && campus ? 'confident' : official || (campus && titleMatch) ? 'possible' : 'none';
      return { url: `https://www.youtube.com/watch?v=${item.id.videoId}`, title, channel, official, score, level };
    })
    .sort((a, b) => b.score - a.score);
}

async function searchBatch(cityWords) {
  if (!KEY) throw new Error('YOUTUBE_API_KEY is missing in server/.env');

  // Not yet checked and no video yet; institutions with programs first
  const all = await Institution.find({ tourVideoUrl: { $in: [null, ''] }, tourCheckedAt: null }, 'name city aliases programs').lean();
  all.sort((a, b) => (b.programs?.length || 0) - (a.programs?.length || 0));
  const batch = all.slice(0, LIMIT);
  console.log(`${all.length} institutions still to check. Searching ${batch.length} now.`);

  const results = [];
  for (const [i, inst] of batch.entries()) {
    try {
      const items = await searchYoutube(`${inst.name} ${inst.city} campus tour`);
      const videos = rateVideos(inst, items, cityWords);
      const best = videos[0] || null;
      results.push({ id: String(inst._id), name: inst.name, best, videos });
      console.log(`${i + 1}/${batch.length} ${inst.name}: ${best ? `${best.level} (${best.channel})` : 'nothing found'}`);
    } catch (err) {
      if (err.quota) {
        console.log('Daily YouTube quota used up. Run again tomorrow; checked institutions are remembered.');
        break;
      }
      console.error(`${inst.name}: ${err.message}`);
    }
  }

  fs.writeFileSync(OUTPUT, JSON.stringify({ createdAt: new Date(), results }, null, 2));

  // Readable report: the chosen video, then the other candidates
  const lines = [];
  for (const r of results) {
    lines.push(`${(r.best?.level || 'none').toUpperCase().padEnd(10)} ${r.name}`);
    for (const v of r.videos) {
      lines.push(`   ${v === r.best ? '>' : ' '} ${v.official ? '[official channel] ' : ''}${v.title} | ${v.channel}`);
      lines.push(`     ${v.url}`);
    }
    lines.push('');
  }
  fs.writeFileSync(REPORT, lines.join('\n'));

  const count = (level) => results.filter((r) => r.best?.level === level).length;
  console.log(`Confident: ${count('confident')}, possible: ${count('possible')}, none: ${results.length - count('confident') - count('possible')}`);
  console.log('Details saved to scripts/tours-report.txt');
  return results;
}

async function saveResults(results) {
  let saved = 0;
  for (const r of results) {
    const update = { tourCheckedAt: new Date() };
    if (r.best?.level === 'confident') {
      update.tourVideoUrl = r.best.url;
      saved++;
    }
    await Institution.updateOne({ _id: r.id, tourVideoUrl: { $in: [null, ''] } }, { $set: update });
  }
  console.log(`${saved} tour videos saved. ${results.length - saved} institutions marked as checked. Nothing was deleted.`);
  console.log('Add "possible" videos yourself from the admin panel after checking them.');
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const cities = await Institution.distinct('city');
  const cityWords = new Set(cities.flatMap((c) => words(c || '')));

  const results = FROM_FILE ? JSON.parse(fs.readFileSync(OUTPUT, 'utf8')).results : await searchBatch(cityWords);
  if (SAVE) await saveResults(results);
  else console.log('Preview only. Check the report, then run: node scripts/find-tours.js --from-file --save');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});