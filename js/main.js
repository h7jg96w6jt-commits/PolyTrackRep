import * as THREE from 'three';
import { Track } from './track.js';
import { Car } from './car.js';
import { Input } from './input.js';
import { TRACKS } from './tracks.js';

const STEP = 1 / 120; // feste Physik-Schrittweite -> reproduzierbare Zeiten
const FALL_LIMIT = -20;

// ---------- Hilfsfunktionen ----------
export function formatTime(sec) {
  if (sec == null) return '--:--.---';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

const storage = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* z. B. privater Modus */ }
  },
};

// ---------- Szene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fd8f5');
scene.fog = new THREE.Fog('#9fd8f5', 150, 520);

const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1200);

scene.add(new THREE.HemisphereLight('#e8f6ff', '#5b7a4a', 1.1));
const sun = new THREE.DirectionalLight('#fff4dc', 2.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 300 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 80 : 65;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Spiel ----------
const trackInfo = TRACKS[0];
const track = new Track(scene, trackInfo.code);
const car = new Car(scene);
const input = new Input();
const bestKey = `jgtrack.best.${trackInfo.id}`;

const hud = {
  time: document.getElementById('time'),
  best: document.getElementById('best'),
  cp: document.getElementById('cp'),
  speed: document.getElementById('speed'),
  hint: document.getElementById('hint'),
  finish: document.getElementById('finish'),
  finishTime: document.getElementById('finish-time'),
  finishNote: document.getElementById('finish-note'),
  trackName: document.getElementById('track-name'),
};
hud.trackName.textContent = trackInfo.name;

const game = {
  state: 'ready', // ready | running | finished
  steps: 0,
  nextCp: 0,
  respawn: null,
  best: storage.get(bestKey),
};

const noInput = { throttle: false, brake: true, left: false, right: false };

function setArchColor(piece, color) {
  piece.arch?.userData.material.color.set(color);
}

function restart() {
  game.state = 'ready';
  game.steps = 0;
  game.nextCp = 0;
  game.respawn = track.start;
  input.consumePress();
  for (const cp of track.checkpoints) setArchColor(cp, '#facc15');
  car.place(track.start.center, track.start.yaw);
  snapCamera();
  hud.finish.hidden = true;
  hud.hint.hidden = false;
  updateHud();
}

function resetToCheckpoint() {
  if (game.state === 'finished') return;
  car.place(game.respawn.center, game.respawn.yaw);
  snapCamera();
}

function finish() {
  game.state = 'finished';
  const time = game.steps * STEP;
  const isBest = game.best == null || time < game.best;
  if (isBest) {
    game.best = time;
    storage.set(bestKey, time);
  }
  hud.finishTime.textContent = formatTime(time);
  hud.finishNote.textContent = isBest ? 'Neue Bestzeit!' : `Bestzeit: ${formatTime(game.best)}`;
  hud.finish.hidden = false;
  updateHud();
}

function step(dt) {
  if ((input.consumePress() || input.any) && game.state === 'ready') {
    game.state = 'running';
    hud.hint.hidden = true;
  }

  car.step(dt, game.state === 'finished' ? noInput : input.state, track);

  if (game.state === 'running') {
    game.steps++;
    const cp = track.checkpoints[game.nextCp];
    if (cp && Track.crossed(cp, car.pos)) {
      game.nextCp++;
      game.respawn = cp;
      setArchColor(cp, '#4ade80');
    }
    if (!cp && Track.crossed(track.finish, car.pos)) finish();
  }

  if (car.pos.y < FALL_LIMIT) resetToCheckpoint();
}

// ---------- Kamera ----------
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();

function cameraTarget(outPos, outLook) {
  const f = car.forward();
  outPos.copy(car.pos).addScaledVector(f, -13).add(new THREE.Vector3(0, 5.5, 0));
  outLook.copy(car.pos).addScaledVector(f, 5).add(new THREE.Vector3(0, 1.5, 0));
}

function snapCamera() {
  cameraTarget(camPos, camLook);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
function updateCamera(dt) {
  cameraTarget(tmpPos, tmpLook);
  camPos.lerp(tmpPos, 1 - Math.exp(-6 * dt));
  camLook.lerp(tmpLook, 1 - Math.exp(-10 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  sun.position.copy(car.pos).add(new THREE.Vector3(60, 100, 40));
  sun.target.position.copy(car.pos);
}

// ---------- HUD ----------
function updateHud() {
  hud.time.textContent = formatTime(game.steps * STEP);
  hud.best.textContent = `Best ${formatTime(game.best)}`;
  hud.cp.textContent = `CP ${game.nextCp}/${track.checkpoints.length}`;
  hud.speed.textContent = `${Math.round(Math.abs(car.speed) * 3.6)} km/h`;
}

// ---------- Loop ----------
input.on('reset', resetToCheckpoint);
input.on('restart', restart);
document.getElementById('again').addEventListener('click', restart);

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  car.updateVisual(dt);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

restart();
requestAnimationFrame(frame);

// Für Tests / Debugging
window.__game = { game, car, track, input };
