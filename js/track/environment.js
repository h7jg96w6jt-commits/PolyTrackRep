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
    const rnd = rng(track.def.code.length * 7919 + 17);
    // Fläche um die Strecke (mit Rand), Anzahl skaliert mit der Fläche
    const area = { minX: b.min.x - 350, maxX: b.max.x + 350, minZ: b.min.z - 350, maxZ: b.max.z + 350 };
    const size = (area.maxX - area.minX) * (area.maxZ - area.minZ);
    // Prüft, ob ein Kreis die Fahrbahn berührt (über die Zellen der Strecke)
    const TILE = 20;
    this.clear = (x, z, r) => {
      const c0x = Math.floor((x - r) / TILE), c1x = Math.ceil((x + r) / TILE);
      const c0z = Math.floor((z - r) / TILE), c1z = Math.ceil((z + r) / TILE);
      for (let cx = c0x; cx <= c1x; cx++)
        for (let cz = c0z; cz <= c1z; cz++) if (track.cellMap.has(`${cx},${cz}`)) return false;
      return true;
    };
    this.addIslands(area, Math.round(Math.min(160, Math.max(26, size / 70000))), rnd);
    this.addClouds(area, Math.round(Math.min(140, Math.max(40, size / 50000))), rnd);

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

  addIslands(area, count, rnd) {
    const mats = {
      island: this.track(new THREE.MeshStandardMaterial({ color: this.t.island, flatShading: true, roughness: 1 })),
      rock: this.track(new THREE.MeshStandardMaterial({ color: this.t.rock, flatShading: true, roughness: 1 })),
      tree: this.track(new THREE.MeshStandardMaterial({ color: '#2f8f5b', flatShading: true })),
    };
    const geos = {
      island: this.track(new THREE.CylinderGeometry(1, 1.25, 1, 7)),
      rock: this.track(new THREE.ConeGeometry(1, 1, 6)),
      tree: this.track(new THREE.ConeGeometry(1.8, 5, 6)),
    };
    const items = { island: [], rock: [], tree: [] };
    for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
      const x = area.minX + rnd() * (area.maxX - area.minX);
      const z = area.minZ + rnd() * (area.maxZ - area.minZ);
      const r = 14 + rnd() * 40;
      const peak = rnd() < 0.55;
      // Berge dürfen die Fahrbahn nicht durchstoßen, flache Inseln liegen tief genug
      if (peak && !this.clear(x, z, r * 0.8 + 10)) continue;
      i++;
      items.island.push({ x, y: SEA_LEVEL + 1, z, sx: r, sy: 4 + rnd() * 6, sz: r, ry: rnd() * 6 });
      if (peak) {
        const h = 20 + rnd() * 70;
        items.rock.push({ x, y: SEA_LEVEL + 4 + h / 2, z, sx: r * 0.7, sy: h, sz: r * 0.7, ry: rnd() * 6 });
      } else {
        for (let k = 0; k < 6; k++) {
          const ta = rnd() * Math.PI * 2, td = rnd() * r * 0.7;
          items.tree.push({ x: x + Math.cos(ta) * td, y: SEA_LEVEL + 7, z: z + Math.sin(ta) * td, sx: 1, sy: 1, sz: 1, ry: 0 });
        }
      }
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const k of Object.keys(items)) {
      if (!items[k].length) continue;
      const im = new THREE.InstancedMesh(geos[k], mats[k], items[k].length);
      items[k].forEach((it, i) => {
        m.compose(v.set(it.x, it.y, it.z), q.setFromAxisAngle(up, it.ry), sc.set(it.sx, it.sy, it.sz));
        im.setMatrixAt(i, m);
      });
      im.receiveShadow = k === 'island';
      this.group.add(im);
    }
  }

  addClouds(area, count, rnd) {
    const mat = this.track(new THREE.MeshStandardMaterial({ color: this.t.cloud, flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 }));
    const geo = this.track(new THREE.IcosahedronGeometry(1, 0));
    const puffs = [];
    for (let i = 0, tries = 0; i < count && tries < count * 6; tries++) {
      const cx = area.minX + rnd() * (area.maxX - area.minX);
      const cz = area.minZ + rnd() * (area.maxZ - area.minZ);
      const cy = -40 + rnd() * 110;
      // Wolken in Fahrbahnhöhe nur abseits der Strecke
      if (cy > -15 && cy < 35 && !this.clear(cx, cz, 40)) continue;
      i++;
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
    // Meer wandert in groben Schritten mit (Raster bleibt ruhig)
    this.sea.position.x = Math.round(focus.x / 50) * 50;
    this.sea.position.z = Math.round(focus.z / 50) * 50;
  }

  dispose(scene) {
    scene.remove(this.group);
    for (const d of this.disposables) d.dispose();
  }
}
