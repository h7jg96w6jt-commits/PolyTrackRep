// Prüft alle Strecken-Codes auf gültiges Layout: node tests/validate-tracks.mjs
import { layoutTrack } from '../js/track/layout.js';
import { TRACKS } from '../js/track/tracks.js';

let failed = 0;
const ids = new Set();
for (const t of TRACKS) {
  const { pieces, errors } = layoutTrack(t.code);
  if (ids.has(t.id)) errors.push(`Doppelte id ${t.id}`);
  ids.add(t.id);
  const cps = pieces.filter((p) => p.type === 'checkpoint').length;
  if (cps < 1) errors.push('Mindestens ein Checkpoint nötig');
  const m = t.medals;
  if (!(m && m.gold < m.silver && m.silver < m.bronze)) errors.push('Medaillenzeiten ungültig');
  console.log(`${errors.length ? '✗' : '✓'} ${t.name}: ${pieces.length} Bausteine, ${cps} CP`);
  for (const e of errors) console.log('   ', e);
  failed += errors.length ? 1 : 0;
}
process.exit(failed ? 1 : 0);
