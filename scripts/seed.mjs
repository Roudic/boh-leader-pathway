// One-time seed: loads data/roster.csv, data/areas.csv, data/p5_evaluation_items.csv,
// and data/prerequisites.json into Firestore,
// and gives your Google email admin access.
//
// Usage:
//   npm run seed -- --key path/to/service-account.json --admin-email you@gmail.com
//   (add --force to overwrite if you've already seeded)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';
import { buildSeed } from '../src/lib/seedBuilder.js';
import { todayIso } from '../src/lib/dates.js';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
const keyPath = arg('key');
const adminEmail = arg('admin-email')?.trim().toLowerCase();
const force = args.includes('--force');

if (!keyPath || !adminEmail) {
  console.error('Usage: npm run seed -- --key path/to/service-account.json --admin-email you@gmail.com');
  process.exit(1);
}

const dataDir = resolve(import.meta.dirname, '..', 'data');
const read = (f) => readFileSync(resolve(dataDir, f), 'utf8');

const seed = buildSeed({
  rosterCsv: read('roster.csv'),
  areasCsv: read('areas.csv'),
  p5Csv: read('p5_evaluation_items.csv'),
  prereqs: JSON.parse(read('prerequisites.json')),
  today: todayIso(),
});

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(resolve(keyPath), 'utf8'))) });
const db = admin.firestore();

const existing = await db.doc('settings/rules').get();
if (existing.exists && !force) {
  console.error('Firestore already has settings/rules. This looks seeded already. Re-run with --force to overwrite seed docs.');
  process.exit(1);
}

const adminPerson = Object.entries(seed.people).find(([, p]) => p.isAdmin);
if (!adminPerson) { console.error('No admin row in roster.csv (flags column must contain "admin").'); process.exit(1); }

let count = 0;
let batch = db.batch();
const put = async (col, id, data) => {
  batch.set(db.collection(col).doc(id), data);
  if (++count % 400 === 0) { await batch.commit(); batch = db.batch(); }
};

for (const [col, docs] of Object.entries(seed)) {
  for (const [id, data] of Object.entries(docs)) await put(col, id, data);
}
await put('members', adminEmail, {
  email: adminEmail, personId: adminPerson[0], role: 'admin', isManager: true,
  createdAt: todayIso(), updatedAt: todayIso(), createdBy: 'seed',
});
await batch.commit();

console.log(`Seeded ${count} documents.`);
for (const [col, docs] of Object.entries(seed)) console.log(`  ${col}: ${Object.keys(docs).length}`);
console.log(`  members: ${adminEmail} → admin (${adminPerson[1].name})`);
console.log('Done. Sign in at your GitHub Pages URL with that Google account, then add your team in Admin → Team access.');
process.exit(0);
