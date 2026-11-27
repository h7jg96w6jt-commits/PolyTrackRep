// Lokale Bestenliste (Top 5 pro Strecke) inkl. Zwischenzeiten der Bestzeit.
const KEY = 'jgtrack.records.v1';
const MAX = 5;

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export class Records {
  constructor() {
    this.data = load();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* privater Modus o. ä. */ }
  }

  list(trackId) {
    return this.data[trackId] ?? [];
  }

  best(trackId) {
    return this.list(trackId)[0] ?? null;
  }

  // Trägt eine Zeit ein; liefert Platz (1-basiert, 0 = nicht in Top 5) und ob Bestzeit
  add(trackId, time, splits) {
    const list = [...this.list(trackId)];
    const prevBest = list[0]?.time ?? null;
    const entry = { time, splits, date: new Date().toISOString() };
    list.push(entry);
    list.sort((a, b) => a.time - b.time);
    const rank = list.indexOf(entry) + 1;
    this.data[trackId] = list.slice(0, MAX);
    this.save();
    return { rank: rank <= MAX ? rank : 0, isBest: rank === 1, prevBest };
  }

  clear(trackId) {
    delete this.data[trackId];
    this.save();
  }
}

export function medalFor(time, medals) {
  if (time == null || !medals) return null;
  if (time <= medals.gold) return 'gold';
  if (time <= medals.silver) return 'silver';
  if (time <= medals.bronze) return 'bronze';
  return null;
}
