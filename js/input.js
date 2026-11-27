// Tastatur- und Touch-Steuerung
export class Input {
  constructor() {
    this.state = { throttle: false, brake: false, left: false, right: false };
    this.handlers = { reset: [], restart: [] };
    this.touchActive = new Map(); // pointerId -> action
    this.pressed = false;

    const keys = {
      KeyW: 'throttle', ArrowUp: 'throttle',
      KeyS: 'brake', ArrowDown: 'brake',
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
    };

    window.addEventListener('keydown', (e) => {
      if (keys[e.code]) {
        this.state[keys[e.code]] = true;
        this.pressed = true;
        e.preventDefault();
      }
      if (e.repeat) return;
      if (e.code === 'KeyR') this.emit('reset');
      if (e.code === 'Enter') this.emit('restart');
    });
    window.addEventListener('keyup', (e) => {
      if (keys[e.code]) this.state[keys[e.code]] = false;
    });
    window.addEventListener('blur', () => this.clear());

    this.bindTouchButtons();
  }

  bindTouchButtons() {
    for (const el of document.querySelectorAll('[data-action]')) {
      const action = el.dataset.action;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('pressed');
        if (action in this.state) {
          this.touchActive.set(e.pointerId, action);
          this.state[action] = true;
          this.pressed = true;
        } else {
          this.emit(action);
        }
      });
      const release = (e) => {
        el.classList.remove('pressed');
        const a = this.touchActive.get(e.pointerId);
        if (a) {
          this.touchActive.delete(e.pointerId);
          if (![...this.touchActive.values()].includes(a)) this.state[a] = false;
        }
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('lostpointercapture', release);
    }
  }

  clear() {
    for (const k in this.state) this.state[k] = false;
    this.touchActive.clear();
  }

  on(event, fn) {
    this.handlers[event].push(fn);
  }

  emit(event) {
    for (const fn of this.handlers[event] ?? []) fn();
  }

  // true, wenn seit dem letzten Aufruf eine Fahrtaste gedrückt wurde
  consumePress() {
    const p = this.pressed;
    this.pressed = false;
    return p;
  }

  get any() {
    const s = this.state;
    return s.throttle || s.brake || s.left || s.right;
  }
}
