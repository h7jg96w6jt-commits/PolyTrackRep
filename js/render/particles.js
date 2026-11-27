import * as THREE from 'three';

// Low-Poly-Partikel als InstancedMesh-Pool (kleine Würfel, die schrumpfen).
export class Particles {
  constructor(scene, max = 300) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 0.85, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < max; i++) this.items.push({ life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size: 1, rot: 0, spin: 0 });
    this.next = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.axis = new THREE.Vector3(1, 1, 0).normalize();
    this.color = new THREE.Color();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, this.zero);
  }

  emit(pos, vel, { life = 0.6, size = 0.6, color = '#dddddd', spread = 1 } = {}) {
    const idx = this.next;
    const p = this.items[idx];
    this.next = (this.next + 1) % this.max;
    p.life = p.max = life * (0.7 + Math.random() * 0.6);
    p.pos.copy(pos);
    p.vel.copy(vel).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread * 0.6, (Math.random() - 0.5) * spread));
    p.size = size * (0.7 + Math.random() * 0.6);
    p.rot = Math.random() * 6;
    p.spin = (Math.random() - 0.5) * 8;
    this.mesh.setColorAt(idx, this.color.set(color));
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    this.items.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) {
        this.mesh.setMatrixAt(i, this.zero);
        return;
      }
      p.vel.multiplyScalar(Math.exp(-2.5 * dt));
      p.vel.y += 1.5 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.spin * dt;
      const k = p.life / p.max;
      const sz = p.size * (0.3 + 0.7 * k) * (1 + (1 - k) * 1.5);
      this.q.setFromAxisAngle(this.axis, p.rot);
      this.m.compose(p.pos, this.q, this.s.setScalar(sz));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.items[i].life = 0;
      this.mesh.setMatrixAt(i, this.zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
