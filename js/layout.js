// Strecken-Layout: wandelt einen Strecken-Code in platzierte Bausteine um.
// Reines JS ohne Three.js, damit es auch in Node getestet werden kann.

export const TILE = 20;      // Kantenlänge eines Bausteins
export const LEVEL_H = 4;    // Höhe einer Ebene
export const ROAD_W = 12;    // Fahrbahnbreite

// Richtungen als Gitter-Schritt [dx, dz]; 0 = Norden (-z)
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const PIECES = {
  B: 'start',
  S: 'straight',
  C: 'checkpoint',
  T: 'boost',
  L: 'left',
  R: 'right',
  U: 'up',
  D: 'down',
  F: 'finish',
};

// "S3" = "SSS"; Leerzeichen werden ignoriert.
export function parseTrack(code) {
  const tokens = [];
  const re = /([A-Z])(\d*)/g;
  const clean = code.toUpperCase().replace(/\s+/g, '');
  let m;
  while ((m = re.exec(clean))) {
    if (!PIECES[m[1]]) throw new Error(`Unbekannter Baustein: ${m[1]}`);
    const n = m[2] ? parseInt(m[2], 10) : 1;
    for (let i = 0; i < n; i++) tokens.push(m[1]);
  }
  return tokens;
}

export function layoutTrack(code) {
  const tokens = parseTrack(code);
  const errors = [];
  if (tokens[0] !== 'B') errors.push('Strecke muss mit B (Start) beginnen');
  if (tokens[tokens.length - 1] !== 'F') errors.push('Strecke muss mit F (Ziel) enden');

  let x = 0, z = 0, level = 0, dir = 0;
  const occupied = new Map();
  const pieces = [];

  tokens.forEach((t, i) => {
    const key = `${x},${z}`;
    if (occupied.has(key)) errors.push(`Baustein ${i} (${t}) überlappt Baustein ${occupied.get(key)} bei ${key}`);
    occupied.set(key, i);
    pieces.push({ index: i, code: t, type: PIECES[t], x, z, level, dir });

    if (t === 'L') dir = (dir + 3) % 4;
    if (t === 'R') dir = (dir + 1) % 4;
    if (t === 'U') level++;
    if (t === 'D') level--;
    if (level < 0) errors.push(`Baustein ${i} (${t}) führt unter Ebene 0`);
    x += DIRS[dir][0];
    z += DIRS[dir][1];
  });

  return { pieces, errors };
}
