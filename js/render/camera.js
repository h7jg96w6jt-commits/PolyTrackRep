import * as THREE from 'three';

// Verfolgerkamera: folgt Position und Hochachse des Autos (auch im Looping),
// Sichtfeld wächst mit der Geschwindigkeit, Wackeln bei Aufprall.
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, -1);
    this.shake = 0;
    this.baseFov = 68;
    this.distance = 11;
    this.height = 4.2;
  }

  targets(car, outPos, outLook) {
    outPos.copy(car.pos).addScaledVector(this.fwd, -this.distance).addScaledVector(this.up, this.height);
    outLook.copy(car.pos).addScaledVector(this.fwd, 6).addScaledVector(this.up, 1.4);
  }

  snap(car) {
    this.fwd.copy(car.fwd);
    this.up.copy(car.up);
    this.targets(car, this.pos, this.look);
    if (this.world) this.avoid(car, this.world);
    this.apply(0);
  }

  update(car, dt, world) {
    // Blickrichtung folgt eher der Bewegungsrichtung (Drift sichtbar)
    const moveDir = car.vel.lengthSq() > 25 ? car.vel.clone().normalize() : car.fwd;
    const desiredFwd = car.fwd.clone().lerp(moveDir, 0.35).normalize();
    this.fwd.lerp(desiredFwd, 1 - Math.exp(-5 * dt)).normalize();
    this.up.lerp(car.grounded ? car.up : new THREE.Vector3(0, 1, 0), 1 - Math.exp(-4 * dt)).normalize();

    const tp = new THREE.Vector3(), tl = new THREE.Vector3();
    this.targets(car, tp, tl);
    this.pos.lerp(tp, 1 - Math.exp(-9 * dt));
    this.look.lerp(tl, 1 - Math.exp(-14 * dt));
    if (world) this.avoid(car, world);

    const speedK = Math.min(1.4, Math.max(0, car.speed) / 62);
    const fov = this.baseFov + speedK * 16;
    this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
    this.shake *= Math.exp(-6 * dt);
    this.apply(dt);
  }

  // Kamera vor die Fahrbahn ziehen, falls sie dahinter liegt (z. B. im Looping)
  avoid(car, world) {
    const origin = car.pos.clone().addScaledVector(car.up, 1.5);
    const dir = this.pos.clone().sub(origin);
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.divideScalar(dist);
    const hit = world.cast(origin, dir, dist, 'road');
    if (hit) this.pos.copy(origin).addScaledVector(dir, Math.max(0.5, hit.distance - 0.6));
  }

  apply() {
    const c = this.camera;
    c.position.copy(this.pos);
    if (this.shake > 0.01) {
      c.position.x += (Math.random() - 0.5) * this.shake;
      c.position.y += (Math.random() - 0.5) * this.shake;
    }
    c.up.copy(this.up);
    c.lookAt(this.look);
  }

  bump(strength) {
    this.shake = Math.min(1.2, this.shake + strength / 30);
  }
}
