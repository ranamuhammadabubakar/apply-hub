// Looks at the NCEAC list page to learn how its data is stored. Writes nothing to the database.
import fs from 'fs';

const URL_LIST = 'https://nceac.org.pk/accreditation/accreditInstitutes';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const res = await fetch(URL_LIST, { headers: { 'User-Agent': 'Mozilla/5.0 ApplyHub/1.0' } });
console.log('Status:', res.status);
const html = await res.text();
fs.writeFileSync(new URL('./nceac-list.html', import.meta.url), html);

const ids = [...new Set(html.match(UUID) || [])];
console.log('Page size:', html.length, 'characters');
console.log('Table rows (<tr>):', (html.match(/<tr/gi) || []).length);
console.log('Unique ids found:', ids.length);
console.log('Mentions of "AccreditBatches":', (html.match(/AccreditBatches/g) || []).length);

for (const n of [0, 15, 200]) {
  if (!ids[n]) continue;
  const at = html.indexOf(ids[n]);
  console.log(`\n--- Around id #${n} ---`);
  console.log(html.slice(Math.max(0, at - 250), at + 80).replace(/\s+/g, ' '));
}