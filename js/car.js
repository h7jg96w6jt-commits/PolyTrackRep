import * as THREE from 'three';

// Fahrphysik (arcadig) – alle Werte in Metern und Sekunden
const P = {
  maxSpeed: 55,
  offroadMaxSpeed: 18,
  accel: 30,
  brake: 50,
  reverseMax: 12,
  coast: 4,
  grip: 9,
  offroadGrip: 5,
  turnRate: 2.3,
  gravity: 30,
  boostAccel: 55,
  boostMax: 80,
};

const UP = new THREE.Vector3(0, 1, 0);

function buildModel() {
  const car = new THREE.Group();
  const body = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: '#ff7a1a', flatShading: true, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1f2430', flatShading: true, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: '#7dd3fc', flatShading: true, roughness: 0.2 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 4.2), paint);
  chassis.position.y = 0.7;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.0), paint);
  nose.position.set(0, 0.55, -2.4);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.9), glass);
  cabin.position.set(0, 1.25, 0.3);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 0.6), dark);
  spoiler.position.set(0, 1.35, 2.0);
  for (const m of [chassis, nose, cabin, spoiler]) {
    m.castShadow = true;
    body.add(m);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.45, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-1.15, -1.4], [1.15, -1.4], [-1.15, 1.4], [1.15, 1.4]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, z);
    const w = new THREE.Mesh(wheelGeo, dark);
    w.castShadow = true;
    pivot.add(w);
    body.add(pivot);
    wheels.push({ pivot, mesh: w, front: z < 0 });
  }
  car.add(body);
  return { car, wheels };
}

export class Car {
  constructor(scene) {
    const { car, wheels } = buildModel();
    this.mesh = car;
    this.wheels = wheels;
    scene.add(car);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.steer = 0;
    this.speed = 0;
    this.grounded = false;
    this.surface = null;
    this.normal = UP.clone();
    this.visualNormal = UP.clone();
  }

  place(pos, yaw) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.steer = 0;
    this.speed = 0;
    this.normal.copy(UP);
    this.visualNormal.copy(UP);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  step(dt, ctl, track) {
    const hit = track.groundAt(this.pos);
    this.grounded = !!hit && this.pos.y <= hit.y + 0.3 && hit.y - this.pos.y < 1.3 && this.vel.y < 8;
    this.surface = this.grounded ? hit.data : null;

    const target = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
    this.steer += (target - this.steer) * Math.min(1, dt * 10);

    if (this.grounded) {
      this.pos.y = hit.y;
      const n = hit.normal;
      this.normal.copy(n);
      const f = this.forward();
      f.addScaledVector(n, -f.dot(n)).normalize();
      const r = new THREE.Vector3().crossVectors(f, n).normalize();

      let vf = this.vel.dot(f);
      let vr = this.vel.dot(r);
      const offroad = !!hit.data.offroad;
      const maxS = offroad ? P.offroadMaxSpeed : P.maxSpeed;

      if (ctl.throttle && vf < maxS) {
        const k = Math.min(Math.max(vf / maxS, 0), 1);
        vf += P.accel * (1 - k * k) * dt;
      }
      if (ctl.brake) {
        if (vf > 0.5) vf -= P.brake * dt;
        else if (vf > -P.reverseMax) vf -= 14 * dt;
      }
      if (!ctl.throttle && !ctl.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), P.coast * dt);

      vf -= vf * (offroad ? 1.2 : 0.06) * dt;
      if (vf > maxS) vf -= (vf - maxS) * (offroad ? 3 : 0.8) * dt;
      if (hit.data.type === 'boost' && vf < P.boostMax) vf += P.boostAccel * dt;

      vf += -P.gravity * f.y * dt; // Hangabtrieb
      vr *= Math.exp(-(offroad ? P.offroadGrip : P.grip) * dt);

      const s = Math.abs(vf);
      const turn = P.turnRate * Math.min(1, s / 8) * (1 - 0.4 * Math.min(1, s / P.maxSpeed));
      this.yaw -= this.steer * turn * Math.sign(vf) * dt;

      this.vel.copy(f).multiplyScalar(vf).addScaledVector(r, vr);
      this.speed = vf;
    } else {
      this.vel.y -= P.gravity * dt;
      this.yaw -= this.steer * 0.8 * dt;
      this.normal.lerp(UP, Math.min(1, dt * 2)).normalize();
      this.speed = this.vel.dot(this.forward());
    }

    this.pos.addScaledVector(this.vel, dt);
  }

  updateVisual(dt) {
    this.visualNormal.lerp(this.normal, Math.min(1, dt * 12)).normalize();
    const up = this.visualNormal;
    const f = this.forward();
    const right = new THREE.Vector3().crossVectors(f, up).normalize();
    const fwd = new THREE.Vector3().crossVectors(up, right).normalize();
    const back = fwd.negate();
    const m = new THREE.Matrix4().makeBasis(right, up, back);
    this.mesh.quaternion.setFromRotationMatrix(m);
    this.mesh.position.copy(this.pos);

    for (const w of this.wheels) {
      w.mesh.rotation.x -= (this.speed / 0.48) * dt;
      if (w.front) w.pivot.rotation.y = -this.steer * 0.45;
    }
  }
}
