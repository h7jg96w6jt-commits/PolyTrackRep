import * as THREE from 'three';

// Einfacher Autopilot entlang der Mittellinie.
// Dient für Menü-Demo und automatische Tests (kann jede Strecke abfahren?).
export class Autopilot {
  constructor(track) {
    this.path = track.path;
    this.i = 0;
  }

  // Nächsten Pfadpunkt neu bestimmen (z. B. nach Respawn)
  relocate(pos) {
    let best = 0, bd = Infinity;
    this.path.forEach((p, k) => {
      const d = p.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = k; }
    });
    this.i = best;
  }

  // Nächsten Pfadpunkt vorwärts suchen; liefert zurückgelegte Strecke (m)
  follow(pos) {
    const path = this.path;
    const end = Math.min(path.length, this.i + 30);
    let best = this.i, bd = Infinity;
    for (let k = this.i; k < end; k++) {
      const d = path[k].pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = k; }
    }
    this.i = best;
    return path[best].dist ?? 0;
  }

  controls(car) {
    const path = this.path;
    this.follow(car.pos);

    const speed = Math.max(0, car.speed);
    const look = Math.min(path.length - 1, this.i + Math.round(4 + speed * 0.12));
    const target = path[look].pos;
    const right = new THREE.Vector3().crossVectors(car.fwd, car.up).normalize();
    const d = target.clone().sub(car.pos);
    const x = d.dot(right), z = d.dot(car.fwd);
    const steer = THREE.MathUtils.clamp(Math.atan2(x, Math.max(0.1, z)) * 2.2, -1, 1);

    // Kurvigkeit voraus -> Zielgeschwindigkeit
    let vlim = 999;
    let needSpeed = false;
    const ahead = Math.min(path.length - 2, this.i + 6 + Math.round(speed * 0.35));
    const hd = (a, b) => Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    for (let k = this.i + 1; k < ahead && k + 4 < path.length; k++) {
      const a = path[k], b = path[k + 2], c = path[k + 4];
      if (a.loop || a.kicker || c.loop) { needSpeed = true; continue; }
      let dh = Math.abs(hd(b, c) - hd(a, b));
      if (dh > Math.PI) dh = 2 * Math.PI - dh;
      const len = path[k + 1].pos.distanceTo(path[k + 3].pos) || 1;
      const kappa = dh / len;
      vlim = Math.min(vlim, 0.9 * 2.5 / (kappa + 0.0141));
    }
    if (needSpeed) vlim = 999;

    return {
      throttle: speed < vlim ? 1 : 0,
      brake: speed > vlim + 3 ? 1 : 0,
      steer,
      drift: false,
    };
  }
}
