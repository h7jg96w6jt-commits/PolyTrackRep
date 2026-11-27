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
];

export const DIFFICULTY = ['', 'Leicht', 'Mittel', 'Schwer', 'Extrem'];
