// Eingabe-Abstraktion: Tastatur, Touch und Gamepad -> einheitliche Steuerwerte.
// controls: { throttle 0..1, brake 0..1, steer -1..1, drift bool }
// Ereignisse: reset, restart, pause, mute

const KEY_ACTIONS = {
  KeyW: 'throttle', ArrowUp: 'throttle',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'drift', ShiftLeft: 'drift', ShiftRight: 'drift',
};
const KEY_EVENTS = {
  KeyR: 'reset', Enter: 'restart', Backspace: 'restart',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
};

export class Input {
  constructor() {
    this.keys = { throttle: false, brake: false, left: false, right: false, drift: false };
    this.touch = { throttle: false, brake: false, left: false, right: false, drift: false };
    this.pad = { throttle: 0, brake: 0, steer: 0, drift: false };
    this.padPrev = {};
    this.handlers = {};
    this.pointerActions = new Map();
    this.pressed = false;
    this.override = null; // z. B. Autopilot

    window.addEventListener('keydown', (e) => {
      const a = KEY_ACTIONS[e.code];
      if (a) {
        this.keys[a] = true;
        this.pressed = true;
        e.preventDefault();
      }
      if (e.repeat) return;
      const ev = KEY_EVENTS[e.code];
      if (ev) {
        e.preventDefault();
        this.emit(ev);
      }
    });
    window.addEventListener('keyup', (e) => {
      const a = KEY_ACTIONS[e.code];
      if (a) this.keys[a] = false;
    });
    window.addEventListener('blur', () => this.clear());
  }

  // Touch-Buttons mit data-action binden (Steuerung oder Ereignis)
  bindTouch(root = document) {
    for (const el of root.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('pressed');
        if (action in this.touch) {
          this.pointerActions.set(e.pointerId, action);
          this.touch[action] = true;
          this.pressed = true;
        } else {
          this.emit(action);
        }
      });
      const release = (e) => {
        el.classList.remove('pressed');
        const a = this.pointerActions.get(e.pointerId);
        if (!a) return;
        this.pointerActions.delete(e.pointerId);
        if (![...this.pointerActions.values()].includes(a)) this.touch[a] = false;
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }
  }

  // Gamepad pro Frame abfragen (Standard-Mapping)
  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) {
      this.pad = { throttle: 0, brake: 0, steer: 0, drift: false };
      return;
    }
    const btn = (i) => gp.buttons[i]?.value ?? 0;
    const pressed = (i) => !!gp.buttons[i]?.pressed;
    const ax = gp.axes[0] ?? 0;
    const steer = Math.abs(ax) > 0.12 ? ax : (pressed(15) ? 1 : 0) - (pressed(14) ? 1 : 0);
    this.pad = {
      throttle: Math.max(btn(7), btn(0)),
      brake: Math.max(btn(6), btn(2)),
      steer,
      drift: pressed(1) || pressed(5) || pressed(4),
    };
    if (this.pad.throttle > 0.1 || this.pad.brake > 0.1 || Math.abs(steer) > 0.3) this.pressed = true;
    const edge = (i, ev) => {
      const now = pressed(i);
      if (now && !this.padPrev[i]) this.emit(ev);
      this.padPrev[i] = now;
    };
    edge(9, 'pause');   // Start
    edge(8, 'restart'); // Select/Back
    edge(3, 'reset');   // Y / Dreieck
  }

  get controls() {
    if (this.override) return this.override;
    const k = this.keys, t = this.touch, p = this.pad;
    const left = k.left || t.left, right = k.right || t.right;
    const digital = (right ? 1 : 0) - (left ? 1 : 0);
    return {
      throttle: Math.max(k.throttle || t.throttle ? 1 : 0, p.throttle),
      brake: Math.max(k.brake || t.brake ? 1 : 0, p.brake),
      steer: digital !== 0 ? digital : p.steer,
      drift: k.drift || t.drift || p.drift,
    };
  }

  consumePress() {
    const p = this.pressed;
    this.pressed = false;
    return p;
  }

  clear() {
    for (const k in this.keys) this.keys[k] = false;
    for (const k in this.touch) this.touch[k] = false;
    this.pointerActions.clear();
  }

  on(event, fn) {
    (this.handlers[event] ??= []).push(fn);
  }

  emit(event) {
    for (const fn of this.handlers[event] ?? []) fn();
  }
}
