import * as THREE from 'three';
import { Track } from '../track/track.js';
import { Environment } from '../track/environment.js';
import { TRACKS } from '../track/tracks.js';
import { CarPhysics } from '../vehicle/car-physics.js';
import { CarModel } from '../vehicle/car-model.js';
import { ChaseCamera } from '../render/camera.js';
import { Particles } from '../render/particles.js';
import { Records } from './records.js';
import { Autopilot } from './autopilot.js';
import { formatDelta } from '../ui/ui.js';

export const STEP = 1 / 120;      // feste Physik-Schrittweite
const FALL_Y = -25;               // darunter: Absturz -> Respawn
const BEAT = 0.7;                 // Countdown-Takt in Sekunden

// Spielzustand: menu | countdown | racing | paused | finished
export class Game {
  constructor({ scene, camera, ui, input, audio }) {
    Object.assign(this, { scene, camera, ui, input, audio });
    this.records = new Records();
    this.physics = new CarPhysics();
    this.chase = new ChaseCamera(camera);
    this.particles = new Particles(scene);
    this.state = 'menu';
    this.trackIndex = -1;
    this.acc = 0;
    this.autoDrive = false; // Tests: Autopilot fährt auch im Rennen
    this.tmp = new THREE.Vector3();

    input.on('restart', () => {
      if (this.state !== 'menu') this.restart();
    });
    input.on('reset', () => {
      if (this.state === 'racing') this.respawn();
    });
    input.on('pause', () => this.togglePause());
    input.on('mute', () => {
      this.audio.setMuted(!this.audio.muted);
      this.ui.setMuted(this.audio.muted);
    });
    ui.setMuted(audio.muted);
  }

  get def() {
    return TRACKS[this.trackIndex];
  }

  isUnlocked(i) {
    return i === 0 || !!this.records.best(TRACKS[i - 1].id);
  }

  loadTrack(index) {
    if (index === this.trackIndex) return;
    this.track?.dispose(this.scene);
    this.env?.dispose(this.scene);
    this.model?.dispose(this.scene);
    this.trackIndex = index;
    this.track = new Track(this.scene, this.def);
    this.env = new Environment(this.scene, this.track, this.def.env);
    this.model = new CarModel(this.scene);
    this.autopilot = new Autopilot(this.track);
    this.chase.world = this.track;
  }

  // ---------- Ablauf ----------
  openMenu() {
    this.state = 'menu';
    this.loadTrack(this.trackIndex < 0 ? 0 : this.trackIndex);
    this.placeAtStart();
    this.ui.showMenu(TRACKS, this.records, (i) => this.isUnlocked(i), (i) => this.startRace(i));
  }

  startRace(index) {
    this.audio.unlock();
    this.audio.play('click');
    this.loadTrack(index);
    this.ui.showRace(this.def.name);
    this.restart();
  }

  placeAtStart() {
    const s = this.track.spawnFor(this.track.start);
    this.physics.place(s.pos, s.forward);
    this.autopilot.relocate(s.pos);
    this.model.sync(this.physics, 0, true);
    this.chase.snap(this.physics);
    this.particles.clear();
  }

  restart() {
    document.activeElement?.blur?.();
    this.state = 'countdown';
    this.countdownT = 0;
    this.countdownBeat = -1;
    this.steps = 0;
    this.nextCp = 0;
    this.respawnPiece = this.track.start;
    this.splits = [];
    for (const cp of this.track.checkpoints) this.track.setCheckpointPassed(cp, false);
    this.placeAtStart();
    this.ui.showPause(false);
    this.ui.hideFinish();
    this.input.clear();
    this.input.consumePress();
  }

  respawn() {
    const s = this.track.spawnFor(this.respawnPiece);
    this.physics.place(s.pos, s.forward);
    this.autopilot.relocate(s.pos);
    this.model.sync(this.physics, 0, true);
    this.chase.snap(this.physics);
    this.audio.play('respawn');
  }

  togglePause() {
    if (this.state === 'racing' || this.state === 'countdown') {
      this.pausedFrom = this.state;
      this.state = 'paused';
      this.ui.showPause(true);
      this.input.clear();
    } else if (this.state === 'paused') {
      this.state = this.pausedFrom;
      this.ui.showPause(false);
    }
  }

  finish() {
    this.state = 'finished';
    const time = this.steps * STEP;
    const result = this.records.add(this.def.id, time, this.splits);
    this.audio.play('finish');
    if (result.isBest && result.prevBest != null) this.audio.play('record');
    this.ui.showFinish({
      trackName: this.def.name,
      time,
      result,
      list: this.records.list(this.def.id),
      medals: this.def.medals,
      hasNext: this.trackIndex + 1 < TRACKS.length,
    });
    this.lastResult = { time, ...result };
  }

  nextTrack() {
    if (this.trackIndex + 1 < TRACKS.length) this.startRace(this.trackIndex + 1);
  }

  // ---------- Simulation ----------
  step(dt) {
    const car = this.physics;
    let ctl;
    if (this.state === 'racing') {
      ctl = this.autoDrive ? this.autopilot.controls(car) : this.input.controls;
    } else if (this.state === 'menu' || this.state === 'finished') {
      ctl = this.autopilot.controls(car);
      if (this.state === 'finished') ctl = { ...ctl, throttle: 0, brake: 0.6 };
    } else {
      return;
    }
    this.ctl = ctl;
    car.step(dt, ctl, this.track);
    this.handleEvents();

    if (this.state === 'racing') {
      this.steps++;
      const cp = this.track.checkpoints[this.nextCp];
      if (cp && this.track.crossed(cp, car.pos)) this.passCheckpoint(cp);
      else if (!cp && this.track.crossed(this.track.finish, car.pos)) this.finish();
    }
    if (this.state === 'menu' && this.track.crossed(this.track.finish, car.pos)) this.placeAtStart();

    if (car.pos.y < FALL_Y) {
      if (this.state === 'racing') this.respawn();
      else if (this.state === 'menu') this.placeAtStart();
    }
  }

  passCheckpoint(cp) {
    const time = this.steps * STEP;
    this.splits.push(time);
    this.track.setCheckpointPassed(cp, true);
    this.respawnPiece = cp;
    this.audio.play('checkpoint');
    const best = this.records.best(this.def.id);
    const ref = best?.splits?.[this.nextCp];
    if (ref != null) {
      const d = time - ref;
      this.ui.toast(`<span class="${d <= 0 ? 'good' : 'bad'}">${formatDelta(d)}</span>`);
    } else {
      this.ui.toast(`Checkpoint ${this.nextCp + 1}`);
    }
    this.nextCp++;
  }

  handleEvents() {
    const car = this.physics;
    for (const e of car.events) {
      if (e.type === 'land') {
        this.audio.play('land', { strength: e.strength });
        this.chase.bump(e.strength * 0.6);
        for (let i = 0; i < 10; i++) this.particles.emit(car.pos, this.tmp.set(0, 2, 0), { color: '#d6d3d1', size: 0.7, spread: 6, life: 0.5 });
      } else if (e.type === 'wall') {
        this.audio.play('impact', { strength: e.strength });
        this.chase.bump(e.strength);
        for (let i = 0; i < 6; i++) this.particles.emit(car.pos, this.tmp.set(0, 3, 0), { color: '#fbbf24', size: 0.3, spread: 8, life: 0.35 });
      } else if (e.type === 'boost') {
        this.audio.play('boost');
      }
    }
  }

  // ---------- Pro Frame ----------
  frame(dt) {
    this.input.poll();
    if (this.state === 'countdown') this.updateCountdown(dt);
    if (this.state !== 'paused') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 24) {
        this.step(STEP);
        this.acc -= STEP;
        n++;
      }
      if (n === 24) this.acc = 0;
    }
    this.updateVisuals(dt);
  }

  updateCountdown(dt) {
    // Neustart sofort fahrbereit: Countdown läuft in Echtzeit
    this.countdownT += dt;
    const beat = Math.floor(this.countdownT / BEAT);
    if (beat !== this.countdownBeat) {
      this.countdownBeat = beat;
      if (beat < 3) {
        this.ui.countdown(String(3 - beat));
        this.audio.play('beep', { freq: 660 });
      } else {
        this.ui.countdown('LOS!');
        this.audio.play('go');
        this.state = 'racing';
        this.acc = 0;
        setTimeout(() => this.state !== 'countdown' && this.ui.countdown(null), 700);
      }
    }
  }

  updateVisuals(dt) {
    const car = this.physics;
    const live = this.state !== 'paused';
    if (live) {
      this.model.sync(car, dt);
      this.chase.update(car, dt, this.track);
      this.emitDriveParticles();
      this.particles.update(dt);
    }
    this.env.update(car.pos);

    const racingUi = this.state !== 'menu';
    if (racingUi) {
      const best = this.records.best(this.def.id);
      this.ui.hud({
        time: (this.steps ?? 0) * STEP,
        best: best?.time ?? null,
        cp: this.nextCp ?? 0,
        cpTotal: this.track.checkpoints.length,
        speed: car.speed,
        maxSpeed: car.p.maxSpeed,
      });
    }
    const ctl = this.ctl ?? { throttle: 0 };
    this.audio.update({
      speedRatio: car.speed / car.p.maxSpeed,
      throttle: this.state === 'countdown' ? this.input.controls.throttle : ctl.throttle,
      slip: car.drifting ? Math.max(car.slip, 8) : car.slip,
      grounded: car.grounded,
      active: this.state === 'racing' || this.state === 'countdown' || this.state === 'finished',
    });
  }

  emitDriveParticles() {
    const car = this.physics;
    if (!car.grounded) return;
    const back = this.tmp.copy(car.fwd).multiplyScalar(-2);
    if (car.drifting || car.slip > 5) {
      for (const i of [2, 3]) {
        if (Math.random() < 0.6) this.particles.emit(this.model.wheelWorld(i), back, { color: '#e7e5e4', size: 0.8, spread: 1.5, life: 0.7 });
      }
    }
    if (car.surface?.boost) {
      this.particles.emit(this.model.wheelWorld(2 + Math.floor(Math.random() * 2)), back.clone().multiplyScalar(4), { color: '#22d3ee', size: 0.35, spread: 2, life: 0.4 });
    }
  }
}
