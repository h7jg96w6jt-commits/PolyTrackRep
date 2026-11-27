import * as THREE from 'three';

// Low-Poly-Fahrzeugmodell; folgt dem Physikzustand geglättet.
export class CarModel {
  constructor(scene, colors = {}) {
    const c = { paint: '#ff7a1a', trim: '#1f2430', glass: '#7dd3fc', light: '#fff7cc', ...colors };
    this.root = new THREE.Group();
    const body = new THREE.Group();
    this.materials = [];
    const mat = (o) => {
      const m = new THREE.MeshStandardMaterial({ flatShading: true, ...o });
      this.materials.push(m);
      return m;
    };
    const paint = mat({ color: c.paint, roughness: 0.45, metalness: 0.1 });
    const trim = mat({ color: c.trim, roughness: 0.5 });
    const glass = mat({ color: c.glass, roughness: 0.15 });
    const light = mat({ color: c.light, emissive: c.light, emissiveIntensity: 0.8 });
    const tail = mat({ color: '#ff3355', emissive: '#ff3355', emissiveIntensity: 0.6 });

    const add = (geo, m, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      body.add(mesh);
      return mesh;
    };
    // Keilförmige Karosserie
    const shape = new THREE.Shape();
    shape.moveTo(-2.3, 0.35); shape.lineTo(2.2, 0.35); shape.lineTo(2.2, 0.95);
    shape.lineTo(-1.2, 1.0); shape.lineTo(-2.3, 0.65); shape.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.1, bevelEnabled: false });
    bodyGeo.translate(0, 0, -1.05);
    bodyGeo.rotateY(-Math.PI / 2); // flache Nase nach vorn (-z)
    add(bodyGeo, paint, 0, 0, 0);
    add(new THREE.BoxGeometry(1.7, 0.5, 1.7), glass, 0, 1.2, 0.35);
    add(new THREE.BoxGeometry(2.4, 0.12, 0.55), trim, 0, 1.45, 1.95);
    add(new THREE.BoxGeometry(0.15, 0.4, 0.15), trim, -0.8, 1.2, 1.95);
    add(new THREE.BoxGeometry(0.15, 0.4, 0.15), trim, 0.8, 1.2, 1.95);
    add(new THREE.BoxGeometry(0.5, 0.15, 0.1), light, -0.7, 0.62, -2.31);
    add(new THREE.BoxGeometry(0.5, 0.15, 0.1), light, 0.7, 0.62, -2.31);
    add(new THREE.BoxGeometry(0.6, 0.15, 0.1), tail, -0.65, 0.8, 2.21);
    add(new THREE.BoxGeometry(0.6, 0.15, 0.1), tail, 0.65, 0.8, 2.21);

    const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.42, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    for (const [x, z] of [[-1.12, -1.45], [1.12, -1.45], [-1.12, 1.45], [1.12, 1.45]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.46, z);
      const w = new THREE.Mesh(wheelGeo, trim);
      w.castShadow = true;
      pivot.add(w);
      body.add(pivot);
      this.wheels.push({ pivot, mesh: w, front: z < 0, local: new THREE.Vector3(x, 0.05, z) });
    }
    this.root.add(body);
    scene.add(this.root);
    this.targetQ = new THREE.Quaternion();
    this.m = new THREE.Matrix4();
  }

  sync(car, dt, snap = false) {
    const right = new THREE.Vector3().crossVectors(car.fwd, car.up).normalize();
    const back = car.fwd.clone().negate();
    this.m.makeBasis(right, car.up, back);
    this.targetQ.setFromRotationMatrix(this.m);
    if (snap) this.root.quaternion.copy(this.targetQ);
    else this.root.quaternion.slerp(this.targetQ, 1 - Math.exp(-18 * dt));
    this.root.position.copy(car.pos);
    for (const w of this.wheels) {
      w.mesh.rotation.x -= (car.speed / 0.46) * dt;
      if (w.front) w.pivot.rotation.y = -car.steer * 0.42;
    }
  }

  // Weltposition eines Rads (für Partikel)
  wheelWorld(i, out = new THREE.Vector3()) {
    return out.copy(this.wheels[i].local).applyMatrix4(this.root.matrixWorld);
  }

  dispose(scene) {
    scene.remove(this.root);
    this.root.traverse((o) => o.geometry?.dispose());
    for (const m of this.materials) m.dispose();
  }
}
