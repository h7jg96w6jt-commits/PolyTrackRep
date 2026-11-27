// Strecken-Code → Bausteine auf einem Gitter.
// Reines JS ohne Three.js, damit Strecken in Node validiert werden können.

export const TILE = 20;      // Kantenlänge einer Gitterzelle (m)
export const LEVEL_H = 4;    // Höhe einer Ebene (m)
export const ROAD_W = 12;    // Fahrbahnbreite (m)

// Richtung als Gitterschritt [dx, dz]; 0 = Norden (-z), 1 = Osten, 2 = Süden, 3 = Westen
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Lokale Koordinaten eines Bausteins: Einfahrt in Zelle [0,0], Fahrtrichtung -z.
// cells: belegte Zellen, exit: Zelle nach dem Baustein, turn: Richtungsänderung, dLevel: Ebenenwechsel.
const ONE = [[0, 0]];
const WIDE_L = [[0, 0], [0, -1], [-1, 0], [-1, -1]];
const WIDE_R = [[0, 0], [0, -1], [1, 0], [1, -1]];

export const PIECES = {
  B: { type: 'start', cells: ONE, exit: [0, -1], turn: 0, dLevel: 0, name: 'Start' },
  F: { type: 'finish', cells: ONE, exit: [0, -1], turn: 0, dLevel: 0, name: 'Ziel' },
  S: { type: 'straight', cells: ONE, exit: [0, -1], turn: 0, dLevel: 0, name: 'Gerade' },
  C: { type: 'checkpoint', cells: ONE, exit: [0, -1], turn: 0, dLevel: 0, name: 'Checkpoint' },
  T: { type: 'boost', cells: ONE, exit: [0, -1], turn: 0, dLevel: 0, name: 'Boost' },
  L: { type: 'left', cells: ONE, exit: [-1, 0], turn: -1, dLevel: 0, name: 'Kurve links (eng)' },
  R: { type: 'right', cells: ONE, exit: [1, 0], turn: 1, dLevel: 0, name: 'Kurve rechts (eng)' },
  l: { type: 'wideLeft', cells: WIDE_L, exit: [-2, -1], turn: -1, dLevel: 0, name: 'Kurve links (weit)' },
  r: { type: 'wideRight', cells: WIDE_R, exit: [2, -1], turn: 1, dLevel: 0, name: 'Kurve rechts (weit)' },
  Q: { type: 'bankLeft', cells: WIDE_L, exit: [-2, -1], turn: -1, dLevel: 0, name: 'Steilkurve links' },
  E: { type: 'bankRight', cells: WIDE_R, exit: [2, -1], turn: 1, dLevel: 0, name: 'Steilkurve rechts' },
  U: { type: 'up', cells: ONE, exit: [0, -1], turn: 0, dLevel: 1, name: 'Rampe hoch' },
  D: { type: 'down', cells: ONE, exit: [0, -1], turn: 0, dLevel: -1, name: 'Rampe runter' },
  J: { type: 'jump', cells: [[0, 0], [0, -1], [0, -2]], exit: [0, -3], turn: 0, dLevel: 0, name: 'Sprung' },
  O: { type: 'loop', cells: [[0, 0], [0, -1]], exit: [0, -2], turn: 0, dLevel: 0, name: 'Looping' },
};

// Länge der Mittellinie je Baustein (m)
export const PIECE_LEN = { B: 20, F: 20, S: 20, C: 20, T: 20, L: 15.7, R: 15.7, l: 47.1, r: 47.1, Q: 47.1, E: 47.1, U: 20.4, D: 20.4, J: 60, O: 96.5 };

export function trackLength(code) {
  return parseTrack(code).reduce((sum, t) => sum + PIECE_LEN[t], 0);
}

// Lokalen Gitter-Versatz in Weltrichtung drehen (gleiche Drehung wie die Meshes: -dir * 90°)
export function rotateCell([x, z], dir) {
  const a = -dir * Math.PI / 2;
  const c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return [x * c + z * s, -x * s + z * c];
}

// "S3" = "SSS"; Leerzeichen werden ignoriert; Groß-/Kleinschreibung ist relevant.
export function parseTrack(code) {
  const tokens = [];
  const re = /([A-Za-z])(\d*)/g;
  const clean = code.replace(/\s+/g, '');
  if (/[^A-Za-z0-9]/.test(clean)) throw new Error('Ungültiges Zeichen im Strecken-Code');
  let m;
  while ((m = re.exec(clean))) {
    if (!PIECES[m[1]]) throw new Error(`Unbekannter Baustein: ${m[1]}`);
    const n = m[2] ? parseInt(m[2], 10) : 1;
    for (let i = 0; i < n; i++) tokens.push(m[1]);
  }
  return tokens;
}

export function layoutTrack(code) {
  const errors = [];
  let tokens = [];
  try {
    tokens = parseTrack(code);
  } catch (e) {
    return { pieces: [], errors: [e.message] };
  }
  if (tokens[0] !== 'B') errors.push('Strecke muss mit B (Start) beginnen');
  if (tokens[tokens.length - 1] !== 'F') errors.push('Strecke muss mit F (Ziel) enden');
  if (tokens.filter((t) => t === 'B').length !== 1) errors.push('Genau ein Start (B) erlaubt');
  if (tokens.filter((t) => t === 'F').length !== 1) errors.push('Genau ein Ziel (F) erlaubt');

  let x = 0, z = 0, level = 0, dir = 0;
  const occupied = new Map();
  const pieces = [];

  tokens.forEach((t, i) => {
    const def = PIECES[t];
    const cells = def.cells.map((c) => {
      const [dx, dz] = rotateCell(c, dir);
      return [x + dx, z + dz];
    });
    for (const [cx, cz] of cells) {
      const key = `${cx},${cz}`;
      if (occupied.has(key)) errors.push(`Baustein ${i} (${t}) überlappt Baustein ${occupied.get(key)} bei ${key}`);
      occupied.set(key, i);
    }
    pieces.push({ index: i, code: t, type: def.type, x, z, level, dir, cells });

    const [ex, ez] = rotateCell(def.exit, dir);
    x += ex;
    z += ez;
    dir = (dir + def.turn + 4) % 4;
    level += def.dLevel;
    if (level < 0) errors.push(`Baustein ${i} (${t}) führt unter Ebene 0`);
  });

  return { pieces, errors };
}
