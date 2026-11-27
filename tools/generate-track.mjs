// Erzeugt lange Strecken-Codes reproduzierbar aus einem Seed.
// Aufruf: node tools/generate-track.mjs <profil> <seed> <meter>
// Ausgabe: Strecken-Code für js/track/tracks.js (Bestzeiten bleiben stabil,
// weil der fertige Code gespeichert wird, nicht der Seed).
import { PIECES, PIECE_LEN, rotateCell, layoutTrack } from '../js/track/layout.js';


const str = (n) => Array(n).fill('S');

// Segmente bündeln Bausteine mit ihren Regeln (Anlauf, Auslauf, Boost)
const SEG = {
  straight: (r) => str(2 + Math.floor(r() * 4)),
  boost: () => ['S', 'T', 'S', 'S'],
  wideL: () => ['l'], wideR: () => ['r'],
  bankL: () => ['S', 'Q', 'S'], bankR: () => ['S', 'E', 'S'],
  tightL: () => ['S', 'S', 'L', 'S'], tightR: () => ['S', 'S', 'R', 'S'],
  chicane: (r) => (r() < 0.5 ? ['S', 'L', 'S', 'R', 'S'] : ['S', 'R', 'S', 'L', 'S']),
  up: () => ['S', 'U', 'S', 'S', 'S'], down: () => ['S', 'D', 'S', 'S', 'S'],
  jump: () => ['S', 'S', 'T', 'S', 'J', 'S', 'S', 'S', 'S'],
  loop: () => ['S', 'T', 'S', 'O', 'S', 'S'],
};

export const PROFILES = {
  flow: { maxLevel: 2, weights: { straight: 5, boost: 1.5, wideL: 3, wideR: 3, bankL: 1, bankR: 1, tightL: 0.6, tightR: 0.6, up: 1.2, down: 1.2 } },
  stunt: { maxLevel: 3, weights: { straight: 4, boost: 1.5, wideL: 2.5, wideR: 2.5, bankL: 1.5, bankR: 1.5, tightL: 1, tightR: 1, chicane: 0.6, up: 1.5, down: 1.5, jump: 1.6 } },
  storm: { maxLevel: 4, weights: { straight: 3, boost: 1.2, wideL: 2, wideR: 2, bankL: 1.5, bankR: 1.5, tightL: 1.4, tightR: 1.4, chicane: 1, up: 1.6, down: 1.6, jump: 1.6, loop: 1.1 } },
};

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function compress(tokens) {
  let out = '', i = 0;
  while (i < tokens.length) {
    let j = i;
    while (j < tokens.length && tokens[j] === tokens[i]) j++;
    out += (out ? ' ' : '') + tokens[i] + (j - i > 1 ? j - i : '');
    i = j;
  }
  return out;
}

export function generate(profileName, seed, targetMeters, cpEvery = 500) {
  const profile = PROFILES[profileName];
  const r = rng(seed);
  const names = Object.keys(profile.weights);
  const occupied = new Set();
  const tokens = [];
  const st = { x: 0, z: 0, dir: 0, level: 0, meters: 0, sinceCp: 0 };
  let budget = 400000;

  // Versucht Bausteine zu setzen; liefert Undo-Info oder null
  function apply(seg) {
    const save = { ...st, n: tokens.length, cells: [] };
    for (const t of seg) {
      const def = PIECES[t];
      const cells = def.cells.map((c) => {
        const [dx, dz] = rotateCell(c, st.dir);
        return `${st.x + dx},${st.z + dz}`;
      });
      if (cells.some((k) => occupied.has(k))) return undo(save), null;
      if (st.level + def.dLevel < 0 || st.level + def.dLevel > profile.maxLevel) return undo(save), null;
      for (const k of cells) { occupied.add(k); save.cells.push(k); }
      tokens.push(t);
      const [ex, ez] = rotateCell(def.exit, st.dir);
      st.x += ex; st.z += ez;
      st.dir = (st.dir + def.turn + 4) % 4;
      st.level += def.dLevel;
      st.meters += PIECE_LEN[t];
      st.sinceCp = t === 'C' ? 0 : st.sinceCp + PIECE_LEN[t];
    }
    // Die Zelle direkt voraus muss frei sein (sonst Sackgasse)
    if (occupied.has(`${st.x},${st.z}`)) return undo(save), null;
    return save;
  }
  function undo(save) {
    for (const k of save.cells) occupied.delete(k);
    tokens.length = save.n;
    Object.assign(st, { x: save.x, z: save.z, dir: save.dir, level: save.level, meters: save.meters, sinceCp: save.sinceCp });
  }

  function pick() {
    // gewichtete Reihenfolge aller Segmente
    const pool = names.map((n) => ({ n, k: Math.pow(r(), 1 / profile.weights[n]) }));
    pool.sort((a, b) => b.k - a.k);
    return pool.map((p) => p.n);
  }

  function grow() {
    if (--budget < 0) return false;
    if (st.meters >= targetMeters) {
      // Ende: zurück auf Ebene 0, dann Ziel
      if (st.level > 0) {
        const s = apply(SEG.down());
        if (s) { if (grow()) return true; undo(s); }
        return false;
      }
      const s = apply(['S', 'S', 'F', 'S']);
      if (s) { tokens.pop(); return true; }
      return false;
    }
    const order = st.sinceCp >= cpEvery ? ['cp', ...pick()] : pick();
    for (const name of order) {
      const seg = name === 'cp' ? ['S', 'C', 'S'] : SEG[name](r);
      const s = apply(seg);
      if (!s) continue;
      if (grow()) return true;
      undo(s);
      if (budget < 0) return false;
    }
    return false;
  }

  apply(['B', 'S', 'S']);
  if (!grow()) throw new Error('Kein gültiges Layout gefunden – anderen Seed probieren');
  const code = compress(tokens);
  const { errors, pieces } = layoutTrack(code);
  if (errors.length) throw new Error(errors.join('\n'));
  return { code, meters: Math.round(st.meters), pieces: pieces.length, checkpoints: tokens.filter((t) => t === 'C').length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [profile = 'flow', seed = '1', meters = '10000'] = process.argv.slice(2);
  const res = generate(profile, +seed, +meters);
  console.log(JSON.stringify(res, null, 1));
}
