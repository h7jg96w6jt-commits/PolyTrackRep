import * as THREE from 'three';
import { TILE, LEVEL_H } from './layout.js';

// Oberflächen ("Strips") je Bausteintyp in lokalen Koordinaten.
// Einfahrt bei z = +TILE/2 in Zelle [0,0], Fahrtrichtung -z.
// Jeder Strip liefert sample(t) -> { p, up } für t in [0,1].

const H = TILE / 2;
const Y = new THREE.Vector3(0, 1, 0);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export const LOOP_RADIUS = 9;
export const LOOP_SHIFT = 6.5;
export const JUMP_HEIGHT = 3;
export const BANK_ANGLE = 0.5; // ~29°

function straight(len = TILE, z0 = H) {
  return {
    len,
    sample: (t) => ({ p: new THREE.Vector3(0, 0, z0 - len * t), up: Y.clone() }),
  };
}

// Kreisbogen um Zentrum (cx, cz), Startwinkel so, dass er bei (0, H) beginnt
function arc(radius, side, bank = 0) {
  const sx = side === 'left' ? -1 : 1;
  const cx = sx * radius, cz = H;
  const len = radius * Math.PI / 2;
  return {
    len,
    curve: true,
    sample: (t) => {
      const phi = t * Math.PI / 2;
      const p = new THREE.Vector3(cx - sx * radius * Math.cos(phi), 0, cz - radius * Math.sin(phi));
      let up = Y.clone();
      if (bank) {
        const b = bank * smooth(clamp01(t / 0.3)) * smooth(clamp01((1 - t) / 0.3));
        const inward = new THREE.Vector3(cx - p.x, 0, cz - p.z).normalize();
        up = Y.clone().multiplyScalar(Math.cos(b)).addScaledVector(inward, Math.sin(b));
        p.y = 3 * Math.sin(b); // Außenkante anheben, Innenkante bleibt über 0
      }
      return { p, up };
    },
  };
}

function ramp(dir) {
  return {
    len: TILE * 1.02,
    sample: (t) => ({ p: new THREE.Vector3(0, dir * LEVEL_H * smooth(t), H - TILE * t), up: Y.clone() }),
  };
}

function loop() {
  const R = LOOP_RADIUS, s = LOOP_SHIFT;
  const circle = 2 * Math.PI * R;
  const len = TILE * 2 + circle;
  const a = TILE / len, b = (TILE + circle) / len;
  return {
    len,
    loop: true,
    sample: (t) => {
      if (t <= a) {
        const u = t / a;
        return { p: new THREE.Vector3(-s * smooth(u), 0, H - TILE * u), up: Y.clone() };
      }
      if (t >= b) {
        const u = (t - b) / (1 - b);
        return { p: new THREE.Vector3(s * (1 - smooth(u)), 0, -H - TILE * u), up: Y.clone() };
      }
      const u = (t - a) / (b - a);
      const th = u * Math.PI * 2;
      const p = new THREE.Vector3(-s + 2 * s * smooth(u), R * (1 - Math.cos(th)), -H - R * Math.sin(th));
      const up = new THREE.Vector3(0, Math.cos(th), Math.sin(th));
      return { p, up };
    },
  };
}

function jumpKicker() {
  return {
    len: TILE,
    sample: (t) => ({ p: new THREE.Vector3(0, JUMP_HEIGHT * t * t, H - TILE * t), up: Y.clone() }),
  };
}

function jumpLanding() {
  return {
    len: TILE,
    sample: (t) => ({ p: new THREE.Vector3(0, JUMP_HEIGHT * (1 - t) * (1 - t), -H - TILE - TILE * t), up: Y.clone() }),
  };
}

export function stripsFor(type) {
  switch (type) {
    case 'left': return [{ ...arc(H, 'left'), walls: true, curveWalls: true }];
    case 'right': return [{ ...arc(H, 'right'), walls: true, curveWalls: true }];
    case 'wideLeft': return [{ ...arc(TILE * 1.5, 'left'), walls: true, curveWalls: true }];
    case 'wideRight': return [{ ...arc(TILE * 1.5, 'right'), walls: true, curveWalls: true }];
    case 'bankLeft': return [{ ...arc(TILE * 1.5, 'left', BANK_ANGLE), walls: true, curveWalls: true, bank: true, sticky: true }];
    case 'bankRight': return [{ ...arc(TILE * 1.5, 'right', BANK_ANGLE), walls: true, curveWalls: true, bank: true, sticky: true }];
    case 'up': return [{ ...ramp(1), walls: true }];
    case 'down': return [{ ...ramp(-1), walls: true }];
    case 'loop': return [{ ...loop(), walls: false, sticky: true }];
    case 'jump': return [{ ...jumpKicker(), walls: false, kicker: true }, { ...jumpLanding(), walls: false }];
    default: return [{ ...straight(), walls: true }];
  }
}

// Rahmen (Position, Tangente, Rechts, Hoch) an Stelle t eines Strips
export function frameAt(strip, t) {
  const { p, up } = strip.sample(t);
  const e = 0.002;
  const a = strip.sample(Math.max(0, t - e)).p;
  const b = strip.sample(Math.min(1, t + e)).p;
  const tan = b.sub(a).normalize();
  const right = new THREE.Vector3().crossVectors(tan, up).normalize();
  const up2 = new THREE.Vector3().crossVectors(right, tan).normalize();
  return { p, tan, right, up: up2 };
}
