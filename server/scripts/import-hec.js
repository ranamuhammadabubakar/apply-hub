// Imports the HEC list of recognised universities into the institutions collection.
// Dry run (default): scrapes HEC and saves the data to scripts/hec-universities.json for review.
// Scrape and save:     node scripts/import-hec.js --save
// Save from the file:  node scripts/import-hec.js --from-file --save
// This script never deletes anything and never changes programs or admission details.
import 'dotenv/config';
import fs from 'fs';
import mongoose from 'mongoose';
import * as cheerio from 'cheerio';
import Institution from '../models/Institution.js';

const LIST_URL = 'https://www.hec.gov.pk/english/universities/Pages/Recognised.aspx';
const DETAIL_PATH = /\/english\/universities\/Pages\/(KPK|Sindh|Punjab|Islamabad|Balochistan|AJK|Gilgit(%20| )Baltistan)\//i;
const DELAY_MS = 1500; // be polite to the HEC server
const SAVE = process.argv.includes('--save');
const FROM_FILE = process.argv.includes('--from-file');
const OUTPUT = new URL('./hec-universities.json', import.meta.url);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ApplyHub/1.0 (university directory import)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Collect the links to each university's HEC page from the list page
async function getDetailLinks() {
  const $ = cheerio.load(await getHtml(LIST_URL));
  const links = new Set();
  $('a[href]').each((_, el) => {
    let url;
    try {
      url = new URL($(el).attr('href'), LIST_URL);
    } catch {
      return;
    }
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (DETAIL_PATH.test(url.pathname) && url.pathname.toLowerCase().endsWith('.aspx')) {
      links.add(url.href);
    }
  });
  return [...links];
}

// Read name, sector, city, province, category and website from a university's HEC page
function parseDetail(html, hecUrl) {
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ');
  const pick = (re) => (text.match(re)?.[1] || '').trim();

  let website = '';
  $('a[href]').each((_, el) => {
    if (website) return;
    const href = $(el).attr('href') || '';
    const external = /^https?:\/\//i.test(href);
    const ignored = /hec\.gov\.pk|google\.|microsoft|mozilla|facebook|twitter|youtube|linkedin|instagram/i.test(href);
    if (external && !ignored) website = href;
  });

  return {
    name: $('title').text().replace(/\s+/g, ' ').trim().replace(/^Universities\s*/i, '').trim(),
    sector: pick(/Sector:\s*(Public|Private)/i).toLowerCase(),
    city: pick(/City:\s*(.+?)\s*Province:/i),
    province: pick(/Province:\s*(.+?)\s*Recognised University:/i),
    category: pick(/University Category\s*(.+?)\s*Campuses/i),
    website,
    hecUrl,
  };
}

async function scrapeHec() {
  const links = await getDetailLinks();
  console.log(`Found ${links.length} universities on the HEC list`);
  if (links.length === 0) throw new Error('No university links found. The HEC page layout may have changed.');

  const items = [];
  const failed = [];
  for (const [i, url] of links.entries()) {
    try {
      const item = parseDetail(await getHtml(url), url);
      if (item.name) items.push(item);
      console.log(`${i + 1}/${links.length} ${item.name} (${item.city || 'city not found'})`);
    } catch (err) {
      failed.push(url);
      console.error(`${i + 1}/${links.length} FAILED ${url}: ${err.message}`);
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUTPUT, JSON.stringify({ importedAt: new Date(), count: items.length, failed, items }, null, 2));
  console.log(`Saved ${items.length} universities to scripts/hec-universities.json (${failed.length} failed)`);
  return items;
}

async function saveToDatabase(items) {
  console.log('Connecting to the database...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log(`Connected. Saving ${items.length} universities...`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const [i, item] of items.entries()) {
    try {
      const data = {
        name: item.name,
        city: item.city || item.province || 'Unknown',
        province: item.province,
        category: item.category,
        hecUrl: item.hecUrl,
        source: 'hec',
      };
      if (item.sector === 'public' || item.sector === 'private') data.sector = item.sector;
      if (item.website) data.website = item.website;

      // Match an earlier import first, then a manually added institution with the same name
      const existing =
        (await Institution.findOne({ hecUrl: item.hecUrl })) ||
        (await Institution.findOne({ hecUrl: { $exists: false }, name: new RegExp(`^${escapeRegex(item.name)}$`, 'i') }));

      if (existing) {
        if (existing.source === 'manual') {
          // Keep the admin's own name, city and website; only link it to HEC
          existing.set({ hecUrl: item.hecUrl, province: item.province, category: item.category });
        } else {
          existing.set(data);
        }
        await existing.save();
        updated++;
      } else {
        await Institution.create({ ...data, type: 'university', programs: [] });
        created++;
      }
    } catch (err) {
      failed++;
      console.error(`Could not save "${item.name}": ${err.message}`);
    }

    if ((i + 1) % 25 === 0 || i + 1 === items.length) {
      console.log(`Progress: ${i + 1}/${items.length} (created ${created}, updated ${updated}, failed ${failed})`);
    }
  }

  console.log(`Database: ${created} created, ${updated} updated, ${failed} failed. Nothing was deleted.`);
  await mongoose.disconnect();
}

async function main() {
  let items;
  if (FROM_FILE) {
    const file = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    items = file.items;
    console.log(`Loaded ${items.length} universities from scripts/hec-universities.json`);
  } else {
    items = await scrapeHec();
  }

  if (SAVE) await saveToDatabase(items);
  else console.log('Dry run only. Check the file, then run again with --save to write to the database.');
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});