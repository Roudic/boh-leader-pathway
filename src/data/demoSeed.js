// Demo-only: builds a local copy of the seed from data/ so screens can be previewed without Firebase.
import { buildSeed } from '../lib/seedBuilder.js';
import { todayIso } from '../lib/dates.js';
import { defaultAppRole } from '../lib/access.js';

const files = import.meta.glob('../../data/*.{csv,json}', { query: '?raw', import: 'default' });

export async function buildDemoSeed() {
  const read = async (name) => {
    const loader = files[`../../data/${name}`];
    return loader ? loader() : '';
  };
  const prereqText = await read('prerequisites.json');
  if (!prereqText) throw new Error('Demo mode needs the files in data/.');
  const seed = buildSeed({
    rosterCsv: await read('roster.csv'),
    areasCsv: await read('areas.csv'),
    p5Csv: await read('p5_evaluation_items.csv'),
    prereqs: JSON.parse(prereqText),
    templateCsv: await read('areas_checklist_template.csv'),
    today: todayIso(),
  });
  seed.members = {};
  for (const [id, p] of Object.entries(seed.people)) {
    const email = demoEmail(p.name);
    seed.members[email] = { email, personId: id, role: defaultAppRole(p), isManager: !!p.isManager };
  }
  return seed;
}

export const demoEmail = (name) => `${name.split(' ')[0].toLowerCase()}@demo.local`;
