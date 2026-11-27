import * as THREE from 'three';

// Arcade-Fahrphysik mit voller 3D-Orientierung.
// Bodenabfrage entlang der Fahrzeug-Hochachse -> Loopings und Steilkurven.
// Kennt nur die Welt-Schnittstelle world.cast(origin, dir, far, layer).

export const CAR_PARAMS = {
  maxSpeed: 62,        // m/s auf Asphalt
  accel: 34,
  brake: 60,
  reverseMax: 14,
  coast: 3.5,
  drag: 0.05,
  grip: 11,            // Seitenhaftung
  driftGrip: 2.0,
  turnRate: 2.5,       // rad/s bei niedriger Geschwindigkeit
  turnHighSpeed: 0.35,  // Anteil der Lenkung, der bei Vmax verloren geht
  driftTurn: 1.45,     // Lenk-Multiplikator beim Driften
  driftDrag: 0.25,
  gravity: 30,
  boostAccel: 70,
  boostMax: 88,
  airYaw: 1.4,
  airPitch: 1.6,
  airRight: 1.8,       // Selbstaufrichtung in der Luft
  rideHeight: 0,
  probeUp: 1.2,
  snap: 0.8,
  loopMinSpeed: 11,    // darunter fällt man kopfüber von der Bahn
  halfWidth: 1.15,
  halfLength: 2.3,
};

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const q = new THREE.Quaternion();

export class CarPhysics {
  constructor(params = {}) {
    this.p = { ...CAR_PARAMS, ...params };
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.up = WORLD_UP.clone();
    this.steer = 0;
    this.grounded = false;
    this.surface = null;
    this.speed = 0;      // Geschwindigkeit in Fahrtrichtung
    this.slip = 0;       // Seitliche Rutschgeschwindigkeit
    this.drifting = false;
    this.airTime = 0;
    this.events = [];    // { type: 'land'|'wall'|'boost', strength }
  }

  place(pos, forward) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.fwd.copy(forward).normalize();
    this.up.copy(WORLD_UP);
    this.steer = 0;
    this.speed = 0;
    this.slip = 0;
    this.grounded = true;
    this.airTime = 0;
    this.drifting = false;
  }

  right(out = new THREE.Vector3()) {
    return out.crossVectors(this.fwd, this.up).normalize();
  }

  findGround(world) {
    const P = this.p;
    if (this.grounded) {
      const origin = v1.copy(this.pos).addScaledVector(this.up, P.probeUp);
      return world.cast(origin, v2.copy(this.up).negate(), P.probeUp + P.snap, 'road');
    }
    // In der Luft: senkrecht nach unten, Reichweite abhängig von der Fallgeschwindigkeit
    const origin = v1.copy(this.pos).addScaledVector(WORLD_UP, P.probeUp);
    const reach = P.probeUp + Math.max(0.25, -this.vel.y / 60);
    const hit = world.cast(origin, v2.set(0, -1, 0), reach, 'road');
    if (hit && hit.normal.y > 0.3 && this.vel.y <= 1) return hit;
    return null;
  }

  step(dt, ctl, world) {
    const P = this.p;
    this.events.length = 0;
    const steerTarget = THREE.MathUtils.clamp(ctl.steer, -1, 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 12);

    const wasGrounded = this.grounded;
    const hit = this.findGround(world);
    this.grounded = !!hit;

    if (this.grounded) {
      const n = hit.normal;
      if (!wasGrounded) {
        const impact = -this.vel.dot(n);
        if (this.airTime > 0.15 && impact > 3) this.events.push({ type: 'land', strength: impact });
        this.airTime = 0;
      }
      this.pos.copy(hit.point);
      this.up.copy(n);
      this.fwd.addScaledVector(n, -this.fwd.dot(n)).normalize();
      const right = this.right(v3);

      let vf = this.vel.dot(this.fwd);
      let vr = this.vel.dot(right);
      const boost = !!hit.data.boost;
      this.surface = hit.data;

      // Antrieb
      if (ctl.throttle > 0 && vf < P.maxSpeed) {
        const k = THREE.MathUtils.clamp(vf / P.maxSpeed, 0, 1);
        vf += P.accel * ctl.throttle * (1 - 0.85 * k * k) * dt;
      }
      if (ctl.brake > 0) {
        if (vf > 0.5) vf -= P.brake * ctl.brake * dt;
        else if (vf > -P.reverseMax) vf -= 16 * ctl.brake * dt;
      }
      if (!(ctl.throttle > 0) && !(ctl.brake > 0)) vf -= Math.sign(vf) * Math.min(Math.abs(vf), P.coast * dt);
      vf -= vf * P.drag * dt;
      if (vf > P.maxSpeed) vf -= (vf - P.maxSpeed) * 0.9 * dt;
      if (boost) {
        if (vf < P.boostMax) vf += P.boostAccel * dt;
        if (!this.onBoost) this.events.push({ type: 'boost', strength: 1 });
      }
      this.onBoost = boost;

      // Schwerkraft entlang der Oberfläche
      vf += -P.gravity * this.fwd.y * dt;
      vr += -P.gravity * right.y * dt;

      // Drift: weniger Seitenhaftung, schärferes Einlenken
      this.drifting = !!ctl.drift && Math.abs(vf) > 12;
      const grip = this.drifting ? P.driftGrip : P.grip;
      vr *= Math.exp(-grip * dt);
      if (this.drifting) vf -= vf * P.driftDrag * dt * Math.abs(this.steer);

      // Lenken: Drehung um die Oberflächennormale
      const s = Math.abs(vf);
      let turn = P.turnRate * Math.min(1, s / 7) * (1 - P.turnHighSpeed * Math.min(1, s / P.maxSpeed));
      if (this.drifting) turn *= P.driftTurn;
      const angle = -this.steer * turn * Math.sign(vf || 1) * dt;
      this.fwd.applyQuaternion(q.setFromAxisAngle(n, angle)).normalize();

      this.vel.copy(this.fwd).multiplyScalar(vf).addScaledVector(right, vr);
      this.speed = vf;
      this.slip = Math.abs(vr);

      // Kopfüber zu langsam -> ablösen
      if (n.y < 0.2 && Math.abs(vf) < P.loopMinSpeed) {
        this.grounded = false;
        this.vel.addScaledVector(n, 2);
      }
    } else {
      this.surface = null;
      this.onBoost = false;
      this.drifting = false;
      this.airTime += dt;
      this.vel.y -= P.gravity * dt;

      // Luftsteuerung: Gieren, Nicken, langsames Aufrichten
      this.fwd.applyQuaternion(q.setFromAxisAngle(this.up, -this.steer * P.airYaw * dt));
      const pitch = ((ctl.throttle > 0 ? 1 : 0) - (ctl.brake > 0 ? 1 : 0)) * P.airPitch * dt;
      if (pitch) {
        const r = this.right(v3);
        this.fwd.applyQuaternion(q.setFromAxisAngle(r, -pitch));
        this.up.applyQuaternion(q);
      }
      this.up.lerp(WORLD_UP, 1 - Math.exp(-P.airRight * dt)).normalize();
      this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
      this.speed = this.vel.dot(this.fwd);
      this.slip = 0;
    }

    this.pos.addScaledVector(this.vel, dt);
    this.collideWalls(world);
  }

  // Seitliche und frontale Wandkollision per kurzen Strahlen
  collideWalls(world) {
    const P = this.p;
    const right = this.right(v3).clone();
    const origin = this.pos.clone().addScaledVector(this.up, 0.6);
    const probes = [
      [right, P.halfWidth],
      [right.clone().negate(), P.halfWidth],
      [this.fwd, P.halfLength],
    ];
    for (const [dir, reach] of probes) {
      const hit = world.cast(origin, dir, reach + 0.3, 'wall');
      if (!hit || hit.distance >= reach) continue;
      const n = hit.normal;
      this.pos.addScaledVector(n, reach - hit.distance);
      origin.addScaledVector(n, reach - hit.distance);
      const vn = this.vel.dot(n);
      if (vn < 0) {
        this.vel.addScaledVector(n, -vn * 1.25);
        this.vel.multiplyScalar(0.985);
        if (-vn > 2) this.events.push({ type: 'wall', strength: -vn });
      }
    }
  }
}
