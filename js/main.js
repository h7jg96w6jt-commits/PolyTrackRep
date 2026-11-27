import * as THREE from 'three';
import { Input } from './input/input.js';
import { AudioManager } from './audio/audio.js';
import { UI } from './ui/ui.js';
import { Game } from './game/game.js';

// ---------- Renderer ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 2000);

// ---------- Module verdrahten ----------
const input = new Input();
input.bindTouch();
const audio = new AudioManager();
const ui = new UI();
const game = new Game({ scene, camera, ui, input, audio });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  game.chase.baseFov = w < h ? 82 : 68;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const on = (id, fn) => document.getElementById(id).addEventListener('click', () => {
  audio.unlock();
  audio.play('click');
  fn();
});
on('btn-resume', () => game.togglePause());
on('btn-restart', () => game.restart());
on('btn-menu', () => game.openMenu());
on('btn-again', () => game.restart());
on('btn-next', () => game.nextTrack());
on('btn-menu2', () => game.openMenu());
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'racing' || game.state === 'countdown')) game.togglePause();
});

game.openMenu();

// ---------- Hauptschleife ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.frame(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Für automatische Tests / Debugging
window.__jg = { game, renderer };
