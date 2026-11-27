import { DIFFICULTY, KINDS } from '../track/tracks.js';
import { trackLength } from '../track/layout.js';
import { medalFor } from '../game/records.js';

export function formatTime(sec) {
  if (sec == null) return '--:--.---';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

export function formatKm(m) {
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDelta(d) {
  return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(3)}`;
}

const $ = (id) => document.getElementById(id);
const MEDAL_NAMES = { gold: 'Gold', silver: 'Silber', bronze: 'Bronze' };

// Reine Darstellung: kennt keine Spiellogik, nur Daten und Callbacks.
export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), touch: $('touch'), menu: $('menu'), pause: $('pause'), finish: $('finish'),
      track: $('hud-track'), timer: $('hud-timer'), best: $('hud-best'), cp: $('hud-cp'),
      speed: $('hud-speed'), speedBar: $('hud-speed-bar'), toast: $('toast'), countdown: $('countdown'),
      dist: $('hud-dist'), distBar: $('hud-dist-bar'),
      list: $('track-list'), mute: $('btn-mute'),
      finTrack: $('fin-track'), finTime: $('fin-time'), finNote: $('fin-note'), finMedal: $('fin-medal'), finBoard: $('fin-board'),
      next: $('btn-next'),
    };
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.last = {};
  }

  // ---------- Menü ----------
  showMenu(tracks, records, isUnlocked, onSelect) {
    const list = this.el.list;
    list.innerHTML = '';
    let lastKind = null;
    tracks.forEach((t, i) => {
      const kind = t.kind ?? 'sprint';
      if (kind !== lastKind) {
        const h = document.createElement('h3');
        h.className = 'kind';
        h.textContent = KINDS[kind] ?? kind;
        list.appendChild(h);
        lastKind = kind;
      }
      const best = records.best(t.id);
      const medal = medalFor(best?.time, t.medals);
      const unlocked = isUnlocked(i);
      const btn = document.createElement('button');
      btn.className = 'track-card';
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <div class="diff">${'●'.repeat(t.difficulty)}${'○'.repeat(4 - t.difficulty)} ${DIFFICULTY[t.difficulty]} · ${formatKm(trackLength(t.code))}</div>
        <div class="name"></div>
        <div class="best">${unlocked ? (best ? formatTime(best.time) : 'Noch keine Zeit') : '🔒 Gesperrt'}</div>
        <div class="meta">${unlocked ? (medal ? `Medaille: ${MEDAL_NAMES[medal]}` : `Gold: ${formatTime(t.medals.gold)}`) : 'Vorherige Strecke beenden'}</div>`;
      btn.querySelector('.name').textContent = t.name;
      btn.addEventListener('click', () => onSelect(i));
      list.appendChild(btn);
    });
    this.el.menu.hidden = false;
    this.el.hud.hidden = true;
    this.el.touch.hidden = true;
    this.el.pause.hidden = true;
    this.el.finish.hidden = true;
    this.countdown(null);
  }

  showRace(trackName) {
    this.el.menu.hidden = true;
    this.el.finish.hidden = true;
    this.el.pause.hidden = true;
    this.el.hud.hidden = false;
    this.el.touch.hidden = !this.isTouch;
    this.el.track.textContent = trackName;
  }

  // ---------- HUD ----------
  hud({ time, best, cp, cpTotal, speed, maxSpeed, dist = 0, length = 1 }) {
    const d = `${formatKm(dist)} / ${formatKm(length)}`;
    if (d !== this.last.d) {
      this.el.dist.textContent = this.last.d = d;
      this.el.distBar.style.width = `${Math.min(100, (dist / length) * 100)}%`;
    }
    const t = formatTime(time);
    if (t !== this.last.t) this.el.timer.textContent = this.last.t = t;
    const b = `Best ${formatTime(best)}`;
    if (b !== this.last.b) this.el.best.textContent = this.last.b = b;
    const c = `CP ${cp}/${cpTotal}`;
    if (c !== this.last.c) this.el.cp.textContent = this.last.c = c;
    const kmh = Math.round(Math.abs(speed) * 3.6);
    if (kmh !== this.last.kmh) {
      this.el.speed.textContent = this.last.kmh = kmh;
      this.el.speedBar.style.width = `${Math.min(100, (Math.abs(speed) / maxSpeed) * 100)}%`;
    }
  }

  countdown(value) {
    const el = this.el.countdown;
    if (value == null) {
      el.textContent = '';
      return;
    }
    el.textContent = value;
    el.classList.toggle('go', value === 'LOS!');
    el.classList.remove('pop');
    void el.offsetWidth; // Animation neu starten
    el.classList.add('pop');
  }

  toast(html, ms = 1400) {
    const el = this.el.toast;
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  setMuted(m) {
    this.el.mute.textContent = m ? '🔇' : '🔊';
  }

  // ---------- Pause ----------
  showPause(v) {
    this.el.pause.hidden = !v;
  }

  // ---------- Ziel ----------
  showFinish({ trackName, time, result, list, medals, hasNext }) {
    const el = this.el;
    el.finTrack.textContent = trackName;
    el.finTime.textContent = formatTime(time);
    if (result.isBest) {
      el.finNote.textContent = result.prevBest == null ? 'Erste Zeit gesetzt!' : `Neue Bestzeit! ${formatDelta(time - result.prevBest)}`;
      el.finNote.className = 'fin-note good';
    } else {
      el.finNote.textContent = `Bestzeit ${formatTime(list[0].time)} (${formatDelta(time - list[0].time)})`;
      el.finNote.className = 'fin-note';
    }
    const got = medalFor(time, medals);
    el.finMedal.innerHTML = '';
    for (const m of ['gold', 'silver', 'bronze']) {
      const span = document.createElement('span');
      const reached = got && ['gold', 'silver', 'bronze'].indexOf(got) <= ['gold', 'silver', 'bronze'].indexOf(m);
      span.className = `medal ${m}${reached && got === m ? ' got' : ''}`;
      span.textContent = `${MEDAL_NAMES[m]} ${formatTime(medals[m])}`;
      el.finMedal.appendChild(span);
    }
    el.finBoard.innerHTML = '';
    list.forEach((e, i) => {
      const li = document.createElement('li');
      if (i + 1 === result.rank) li.className = 'me';
      const d = new Date(e.date);
      li.innerHTML = `<span>${i + 1}. ${formatTime(e.time)}</span><span>${d.toLocaleDateString('de-DE')}</span>`;
      el.finBoard.appendChild(li);
    });
    el.next.hidden = !hasNext;
    el.finish.hidden = false;
    el.touch.hidden = true;
  }

  hideFinish() {
    this.el.finish.hidden = true;
    this.el.touch.hidden = !this.isTouch;
  }
}
