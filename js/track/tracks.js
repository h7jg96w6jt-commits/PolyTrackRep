// Streckendaten. Neue Strecke = neuer Eintrag, keine Engine-Änderung nötig.
//
// Bausteine (Groß-/Kleinschreibung beachten, Zahl = Wiederholung, z. B. S3):
//   B Start   F Ziel   S Gerade   C Checkpoint   T Boost
//   L / R  enge Kurve links/rechts       l / r  weite Kurve (2×2 Felder)
//   Q / E  Steilkurve links/rechts (2×2)  U / D  Rampe hoch/runter
//   J Sprung (3 Felder, Lücke in der Mitte)   O Looping (2 Felder)
//
// walls: 'all' | 'curves' | 'none'
// medals: Zielzeiten in Sekunden (Gold/Silber/Bronze)

export const TRACKS = [
  {
    id: 'startbahn',
    name: 'Startbahn',
    difficulty: 1,
    walls: 'all',
    code: 'B S3 C S r S3 U S2 r S2 C S T S3 D S r S4 C S l S2 F',
    medals: { gold: 16, silver: 18.5, bronze: 22 },
    env: { skyTop: '#4fa3e0', skyBottom: '#d7f1ff', fog: '#c4e7fb', sea: '#2f86b8', island: '#86c96f' },
  },
  {
    id: 'wolkenbogen',
    name: 'Wolkenbogen',
    difficulty: 2,
    walls: 'curves',
    code: 'B S2 T S3 Q S2 C S U S2 E S T S3 D S2 C S r S2 L S U S2 R S3 C T S D S2 l S F',
    medals: { gold: 24.4, silver: 27.5, bronze: 33 },
    theme: { kerbA: '#7c5cff', kerbB: '#f4f1ea', checkpoint: '#ff9f1c' },
    env: { skyTop: '#6b7fd7', skyBottom: '#ffd6e8', fog: '#f3d9ee', sea: '#4a63b5', island: '#9bd17f', sun: '#ffe2c4' },
  },
  {
    id: 'schanzenfieber',
    name: 'Schanzenfieber',
    difficulty: 2,
    walls: 'curves',
    code: 'B S2 T S2 J S2 C S r S T S J S3 E S C S T S2 J S2 U S2 R S2 C S D S l T S J S2 F',
    medals: { gold: 22.5, silver: 25.5, bronze: 31 },
    theme: { kerbA: '#16a34a', kerbB: '#fef3c7', boost: '#f472b6' },
    env: { skyTop: '#f59e0b', skyBottom: '#fde68a', fog: '#fbe3b0', sea: '#b45309', island: '#a3a35a', sun: '#ffd28a', sunIntensity: 2.0 },
  },
  {
    id: 'looping-lagune',
    name: 'Looping-Lagune',
    difficulty: 3,
    walls: 'none',
    code: 'B S T S2 O S2 C S Q S T S2 J S2 E S C T S O S U S2 R S2 C S D T S2 O S r S F',
    medals: { gold: 29.6, silver: 33.5, bronze: 40 },
    theme: { kerbA: '#06b6d4', kerbB: '#f8fafc', road: '#334155', checkpoint: '#f43f5e' },
    env: { skyTop: '#22a6b3', skyBottom: '#c8fff4', fog: '#bdf3e8', sea: '#1596a8', island: '#4ade80', sun: '#f0fff4' },
  },
  {
    id: 'gewittergrat',
    name: 'Gewittergrat',
    difficulty: 4,
    walls: 'none',
    code: 'B S T S2 J S3 R S C S L T S O S2 E S U S2 R S D S C T S J S3 Q S C S L S R T S O S r S F',
    medals: { gold: 34, silver: 38.5, bronze: 46 },
    theme: { kerbA: '#facc15', kerbB: '#1f2937', road: '#2b2f3a', boost: '#a78bfa', checkpoint: '#f97316', wall: '#94a3b8' },
    env: { skyTop: '#334155', skyBottom: '#94a3b8', fog: '#8796ab', sea: '#1e3a5f', island: '#4b6b4f', rock: '#6b7280', cloud: '#cbd5e1', sun: '#e2e8f0', sunIntensity: 1.6 },
  },
  {
    id: 'kuestenmarathon',
    name: 'Küstenmarathon',
    kind: 'long',
    difficulty: 2,
    walls: 'all',
    // generiert: node tools/generate-track.mjs flow 11 10000 (10115 m, 17 CP)
    code: 'B S2 r S Q S r S4 T S4 R S3 R S2 C S5 l r l2 S E S3 l S U S4 C S2 D S3 l r l S U S4 D S4 Q S2 C S4 r l r2 S Q S r S Q S r S C S2 E S9 E S r S T S2 l2 S U S3 l S C S6 U S4 E S2 T S6 r S E S2 C S2 T S2 l2 S4 r l S9 C S l S T S2 r2 S D S4 D S5 R S2 C S l2 r S T S19 C S2 T S6 l S E S7 L S l S C S3 R S4 E S l S6 T S2 r S3 C S l S12 r2 S7 C S2 Q S l S U S3 r2 S6 L S2 C S r S9 E S5 l S U S4 C S l S Q S r S10 D S7 C S4 l S Q S6 T S3 T S8 C S2 T S4 L S l S T S3 D S11 C S3 F',
    medals: { gold: 208, silver: 232, bronze: 275 },
    theme: { kerbA: '#0ea5e9', kerbB: '#f8fafc' },
    env: { skyTop: '#3b82f6', skyBottom: '#e0f2fe', fog: '#cfe9fb', sea: '#1d6fa5', island: '#9fd67f' },
  },
  {
    id: 'himmelsband',
    name: 'Himmelsband',
    kind: 'long',
    difficulty: 3,
    walls: 'curves',
    // generiert: node tools/generate-track.mjs stunt 23 10000 (10196 m, 16 CP)
    code: 'B S4 L S r l r S2 R S l S4 L S2 C S2 E S2 T S3 Q S2 T S4 T S J S5 C S6 l S2 T S J S5 E S5 C S2 U S4 R S L S2 T S4 T S J S5 C S3 T S J S6 L S2 T S4 T S J S5 C S r2 S4 l S Q S l r S2 L S r S C S3 R S l S2 T S J S5 U S6 C S3 L S l S6 T S J S5 T S4 r S C S r2 S2 L S5 l S Q S r S U S4 C S l2 r S T S2 r2 S2 L S3 r S2 R S l S C S3 l S2 T S J S6 r2 S3 C S l S2 R S5 R S4 Q S2 T S2 l S C S l S2 L S r2 S R S L S2 Q S3 T S J S5 C S2 D S4 T S3 T S3 U S3 r S L S R S2 C S6 E S2 T S2 r S E S4 l S C S l2 r S5 r S2 R S r l2 S2 L S2 C S2 D S4 T S6 D S3 l r S4 D S5 F',
    medals: { gold: 222, silver: 247, bronze: 292 },
    theme: { kerbA: '#e11d48', kerbB: '#fff1f2', boost: '#22d3ee', checkpoint: '#a3e635' },
    env: { skyTop: '#7c3aed', skyBottom: '#fbcfe8', fog: '#f5d0fe', sea: '#5b21b6', island: '#86efac', sun: '#ffe4f1' },
  },
  {
    id: 'sturmodyssee',
    name: 'Sturmodyssee',
    kind: 'long',
    difficulty: 4,
    walls: 'none',
    // generiert: node tools/generate-track.mjs storm 37 10000 (10205 m, 17 CP)
    code: 'B S4 T S J S6 T S J S5 C S3 T S J S4 l S2 T S J S5 C S2 U S4 T S3 E S2 L S R S r S2 T S J S5 C S2 E S l S D S4 Q S3 T S J S5 C S2 U S4 T S O S3 D S4 E S2 C S3 R S r S T S2 l S L S R S7 U S4 C S2 Q S2 Q S r S R S L S r2 S T S O S3 C S l S U S8 L S3 R S2 D S3 l S C S2 T S4 L S3 T S J S6 R S2 E S2 C S2 L S R S2 D S7 U S11 C S l r2 S8 Q S l S U S4 C S l r S2 R S2 E S2 U S4 L S R S2 D S4 C S2 E S3 T S J S6 L S2 Q S2 D S4 C S l r S U S8 T S J S6 R S2 C S5 l S5 T S J S5 T S3 C S2 E S r S T S O S2 l S2 L S4 C S3 T S J S5 T S O S3 D S4 C S2 D S5 F',
    medals: { gold: 222, silver: 248, bronze: 293 },
    theme: { kerbA: '#f59e0b', kerbB: '#111827', road: '#2b2f3a', boost: '#a78bfa', checkpoint: '#f43f5e' },
    env: { skyTop: '#1e293b', skyBottom: '#64748b', fog: '#6b7a90', sea: '#0f2a44', island: '#3f6b4f', rock: '#6b7280', cloud: '#cbd5e1', sun: '#e2e8f0', sunIntensity: 1.5 },
  },
];

export const KINDS = { sprint: 'Sprint', long: 'Langstrecke · 10 km' };

export const DIFFICULTY = ['', 'Leicht', 'Mittel', 'Schwer', 'Extrem'];
