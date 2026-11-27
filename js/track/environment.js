import * as THREE from 'three';
import { SEA_LEVEL } from './track.js';

export const ENV_DEFAULT = {
  skyTop: '#4fa3e0', skyBottom: '#cfeefe', fog: '#bfe6fb',
  sea: '#2f86b8', island: '#7cc26b', rock: '#a3a8b4', cloud: '#ffffff',
  sun: '#fff4dc', sunIntensity: 2.2, hemiSky: '#e8f6ff', hemiGround: '#8aa39a',
};

// Seeded Zufall für reproduzierbare Kulissen
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export class Environment {
  constructor(scene, track, theme = {}) {
    this.t = { ...ENV_DEFAULT, ...theme };
    this.group = new THREE.Group();
    this.disposables = [];
    const t = this.t;

    scene.fog = new THREE.Fog(t.fog, 180, 700);
    scene.background = new THREE.Color(t.fog);

    this.addSky();
    this.addSea();
    this.addLights();

    const b = track.bounds;
    const center = b.getCenter(new THREE.Vector3());
    const size = b.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) / 2 + 60;
    const rnd = rng(track.def.code.length * 7919 + 17);
    this.addIslands(center, radius, rnd);
    this.addClouds(center, radius, rnd);

    scene.add(this.group);
  }

  track(obj) {
    this.disposables.push(obj);
    return obj;
  }

  addSky() {
    const geo = this.track(new THREE.SphereGeometry(900, 24, 12));
    const mat = this.track(new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(this.t.skyTop) }, bottom: { value: new THREE.Color(this.t.skyBottom) } },
      vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.5, h)), 1.0); }',
    }));
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -1;
    this.group.add(this.sky);
  }

  addSea() {
    const geo = this.track(new THREE.PlaneGeometry(2400, 2400, 48, 48));
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const rnd = rng(42);
    for (let i = 0; i < pos.count; i++) pos.setY(i, (rnd() - 0.5) * 2.5);
    geo.computeVertexNormals();
    const mat = this.track(new THREE.MeshStandardMaterial({ color: this.t.sea, flatShading: true, roughness: 0.35, metalness: 0.1 }));
    this.sea = new THREE.Mesh(geo, mat);
    this.sea.position.y = SEA_LEVEL;
    this.sea.receiveShadow = true;
    this.group.add(this.sea);
  }

  addLights() {
    const t = this.t;
    this.hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, 1.0);
    this.sun = new THREE.DirectionalLight(t.sun, t.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 320 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.4;
    this.sunOffset = new THREE.Vector3(70, 120, 45);
    this.group.add(this.hemi, this.sun, this.sun.target);
  }

  addIslands(center, radius, rnd) {
    const islandMat = this.track(new THREE.MeshStandardMaterial({ color: this.t.island, flatShading: true, roughness: 1 }));
    const rockMat = this.track(new THREE.MeshStandardMaterial({ color: this.t.rock, flatShading: true, roughness: 1 }));
    const treeMat = this.track(new THREE.MeshStandardMaterial({ color: '#2f8f5b', flatShading: true }));
    const islandGeo = this.track(new THREE.CylinderGeometry(1, 1.25, 1, 7));
    const peakGeo = this.track(new THREE.ConeGeometry(1, 1, 6));
    const treeGeo = this.track(new THREE.ConeGeometry(1.8, 5, 6));

    const count = 26;
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = radius * (0.9 + rnd() * 1.6);
      const x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d;
      const r = 14 + rnd() * 40;
      const isl = new THREE.Mesh(islandGeo, islandMat);
      isl.scale.set(r, 4 + rnd() * 6, r);
      isl.position.set(x, SEA_LEVEL + 1, z);
      isl.rotation.y = rnd() * 6;
      isl.receiveShadow = true;
      this.group.add(isl);
      if (rnd() < 0.6) {
        const peak = new THREE.Mesh(peakGeo, rockMat);
        const h = 20 + rnd() * 70;
        peak.scale.set(r * 0.7, h, r * 0.7);
        peak.position.set(x, SEA_LEVEL + 4 + h / 2, z);
        peak.rotation.y = rnd() * 6;
        this.group.add(peak);
      } else {
        for (let k = 0; k < 6; k++) {
          const tr = new THREE.Mesh(treeGeo, treeMat);
          const ta = rnd() * Math.PI * 2, td = rnd() * r * 0.7;
          tr.position.set(x + Math.cos(ta) * td, SEA_LEVEL + 7, z + Math.sin(ta) * td);
          this.group.add(tr);
        }
      }
    }
  }

  addClouds(center, radius, rnd) {
    const mat = this.track(new THREE.MeshStandardMaterial({ color: this.t.cloud, flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    const geo = this.track(new THREE.IcosahedronGeometry(1, 0));
    const puffs = [];
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const d = radius * (0.4 + rnd() * 1.8);
      const cx = center.x + Math.cos(a) * d, cz = center.z + Math.sin(a) * d;
      const cy = -40 + rnd() * 110;
      const n = 3 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const s = 5 + rnd() * 7;
        puffs.push({ x: cx + (k - n / 2) * s * 1.1, y: cy + rnd() * 3, z: cz + (rnd() - 0.5) * s, s });
      }
    }
    const im = new THREE.InstancedMesh(geo, mat, puffs.length);
    const m = new THREE.Matrix4();
    puffs.forEach((p, i) => {
      m.makeScale(p.s, p.s * 0.7, p.s).setPosition(p.x, p.y, p.z);
      im.setMatrixAt(i, m);
    });
    this.clouds = im;
    this.group.add(im);
  }

  update(focus) {
    this.sun.position.copy(focus).add(this.sunOffset);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(focus);
  }

  dispose(scene) {
    scene.remove(this.group);
    for (const d of this.disposables) d.dispose();
  }
}
