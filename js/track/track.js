import * as THREE from 'three';
import { TILE, LEVEL_H, ROAD_W, layoutTrack } from './layout.js';
import { stripsFor, frameAt } from './geometry.js';

const HALF_W = ROAD_W / 2;
const KERB = 1;
const THICK = 1.2;
const WALL_H = 1.1;
const WALL_T = 0.5;
export const SEA_LEVEL = -60;

const DEFAULT_THEME = {
  road: '#3b4150', kerbA: '#ff5a3c', kerbB: '#f4f1ea', side: '#262a33',
  wall: '#e8e4da', boost: '#22d3ee', checkpoint: '#facc15', start: '#4ade80', pillar: '#59606f',
};

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  for (let x = 0; x < 16; x++)
    for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Baut Fahrbahn- und Wandgeometrie eines Strips (nicht indiziert, Vertex-Farben)
function buildStrip(strip, theme, type, wallsOn) {
  const segs = Math.max(4, Math.round(strip.len / (strip.loop ? 1.2 : 2.5)));
  const frames = [];
  for (let i = 0; i <= segs; i++) frames.push(frameAt(strip, i / segs));

  const road = { pos: [], col: [] };
  const wall = { pos: [], col: [] };
  const at = (f, o, dy = 0) => f.p.clone().addScaledVector(f.right, o).addScaledVector(f.up, dy);
  const quad = (buf, a, b, c, d, color) => {
    for (const v of [a, b, c, b, d, c]) {
      buf.pos.push(v.x, v.y, v.z);
      buf.col.push(color.r, color.g, color.b);
    }
  };

  const C = {};
  for (const k in theme) C[k] = new THREE.Color(theme[k]);
  const main = type === 'boost' ? C.boost : C.road;

  for (let i = 0; i < segs; i++) {
    const f0 = frames[i], f1 = frames[i + 1];
    const kerb = i % 2 ? C.kerbA : C.kerbB;
    quad(road, at(f0, -HALF_W), at(f0, -HALF_W + KERB), at(f1, -HALF_W), at(f1, -HALF_W + KERB), kerb);
    // Boost: Pfeilmuster durch abwechselnde Helligkeit
    const mc = type === 'boost' && i % 2 ? C.boost.clone().multiplyScalar(0.7) : main;
    quad(road, at(f0, -HALF_W + KERB), at(f0, HALF_W - KERB), at(f1, -HALF_W + KERB), at(f1, HALF_W - KERB), mc);
    quad(road, at(f0, HALF_W - KERB), at(f0, HALF_W), at(f1, HALF_W - KERB), at(f1, HALF_W), kerb);
    // Seiten und Unterseite
    quad(road, at(f0, -HALF_W), at(f0, -HALF_W, -THICK), at(f1, -HALF_W), at(f1, -HALF_W, -THICK), C.side);
    quad(road, at(f0, HALF_W, -THICK), at(f0, HALF_W), at(f1, HALF_W, -THICK), at(f1, HALF_W), C.side);
    quad(road, at(f0, HALF_W, -THICK), at(f0, -HALF_W, -THICK), at(f1, HALF_W, -THICK), at(f1, -HALF_W, -THICK), C.side);

    if (wallsOn) {
      for (const s of [-1, 1]) {
        const o = s * HALF_W, oo = s * (HALF_W + WALL_T);
        const wc = i % 2 ? C.wall : C.wall.clone().multiplyScalar(0.85);
        quad(wall, at(f0, o), at(f0, o, WALL_H), at(f1, o), at(f1, o, WALL_H), wc);
        quad(wall, at(f0, o, WALL_H), at(f0, oo, WALL_H), at(f1, o, WALL_H), at(f1, oo, WALL_H), wc);
        quad(wall, at(f0, oo, WALL_H), at(f0, oo, -THICK), at(f1, oo, WALL_H), at(f1, oo, -THICK), C.side);
      }
    }
  }

  const toGeo = (buf) => {
    if (!buf.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  return { road: toGeo(road), wall: toGeo(wall), frames };
}

function buildArch(material, barMaterial) {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, material);
    post.position.set(sx * (HALF_W + 1), 4, 0);
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 2.8, 1.2, 0.9), barMaterial ?? material);
  bar.position.y = 8;
  bar.castShadow = true;
  group.add(bar);
  return group;
}

export class Track {
  constructor(scene, def) {
    const { pieces, errors } = layoutTrack(def.code);
    if (errors.length) throw new Error(errors.join('\n'));

    this.def = def;
    this.theme = { ...DEFAULT_THEME, ...(def.theme ?? {}) };
    this.pieces = pieces;
    this.group = new THREE.Group();
    this.cellMap = new Map(); // "x,z" -> { road: Mesh[], wall: Mesh[] }
    this.checkpoints = [];
    this.path = [];
    this.raycaster = new THREE.Raycaster();
    this.materials = [];

    const roadMat = this.mat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide }));
    const wallMat = this.mat(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }));
    const pillarSpots = [];
    const wallMode = def.walls ?? 'curves';

    for (const p of pieces) {
      const g = new THREE.Group();
      g.position.set(p.x * TILE, p.level * LEVEL_H, p.z * TILE);
      g.rotation.y = -p.dir * Math.PI / 2;
      g.updateMatrixWorld(true);
      this.group.add(g);
      p.group = g;
      p.center = g.position.clone();
      p.forward = new THREE.Vector3(0, 0, -1).applyQuaternion(g.quaternion);

      const strips = stripsFor(p.type);
      p.strips = strips;
      const meshes = { road: [], wall: [] };
      strips.forEach((strip, si) => {
        const wallsOn = wallMode === 'all' ? strip.walls : wallMode === 'curves' ? !!strip.curveWalls : false;
        const geo = buildStrip(strip, this.theme, p.type, wallsOn);
        const road = new THREE.Mesh(geo.road, roadMat);
        road.castShadow = true;
        road.receiveShadow = true;
        road.userData = { type: p.type, boost: p.type === 'boost', piece: p.index };
        g.add(road);
        meshes.road.push(road);
        if (geo.wall) {
          const wall = new THREE.Mesh(geo.wall, wallMat);
          wall.castShadow = true;
          wall.receiveShadow = true;
          wall.userData = { wall: true };
          g.add(wall);
          meshes.wall.push(wall);
        }

        // Ideallinie (Mittellinie) in Weltkoordinaten
        const n = Math.max(2, Math.round(strip.len / 2));
        for (let i = 0; i < n; i++) {
          const f = frameAt(strip, i / n);
          this.path.push({
            pos: f.p.clone().applyMatrix4(g.matrixWorld),
            up: f.up.clone().transformDirection(g.matrixWorld),
            piece: p.index,
            loop: !!strip.loop,
            kicker: !!strip.kicker && i > n * 0.5,
            strip: si,
          });
        }

        // Stützpfeiler
        const ts = strip.loop ? [0.06, 0.94] : [0.5];
        for (const t of ts) {
          const f = frameAt(strip, t);
          if (f.up.y < 0.9) continue;
          const w = f.p.clone().applyMatrix4(g.matrixWorld);
          pillarSpots.push(w);
        }
      });

      for (const [cx, cz] of p.cells) {
        const key = `${cx},${cz}`;
        if (!this.cellMap.has(key)) this.cellMap.set(key, { road: [], wall: [] });
        const cell = this.cellMap.get(key);
        cell.road.push(...meshes.road);
        cell.wall.push(...meshes.wall);
      }

      if (p.type === 'start' || p.type === 'checkpoint' || p.type === 'finish') {
        const color = p.type === 'checkpoint' ? this.theme.checkpoint : p.type === 'start' ? this.theme.start : '#f4f1ea';
        const mat = this.mat(new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, emissive: color, emissiveIntensity: 0.15 }));
        const bar = p.type === 'finish' ? this.mat(new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.6 })) : null;
        const arch = buildArch(mat, bar);
        g.add(arch);
        p.arch = arch;
        p.archMat = mat;
        if (p.type === 'checkpoint') this.checkpoints.push(p);
        if (p.type === 'start') this.start = p;
        if (p.type === 'finish') this.finish = p;
      }
    }

    this.addPillars(pillarSpots);
    this.group.updateMatrixWorld(true);
    scene.add(this.group);

    // Bounding-Box für Kulisse
    const box = new THREE.Box3().setFromObject(this.group);
    this.bounds = box;
    this.lowestY = 0;
  }

  mat(m) {
    this.materials.push(m);
    return m;
  }

  addPillars(spots) {
    if (!spots.length) return;
    const geo = new THREE.BoxGeometry(2.4, 1, 2.4);
    geo.translate(0, -0.5, 0);
    const mat = this.mat(new THREE.MeshStandardMaterial({ color: this.theme.pillar, flatShading: true, roughness: 0.9 }));
    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach((s, i) => {
      const top = s.y - THICK;
      const h = top - SEA_LEVEL;
      m.makeScale(1, h, 1).setPosition(s.x, top, s.z);
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    this.group.add(im);
    this.pillars = im;
  }

  // Meshes aus der Zelle der Position und den Nachbarzellen
  candidates(pos, layer) {
    const cx = Math.round(pos.x / TILE), cz = Math.round(pos.z / TILE);
    const out = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const c = this.cellMap.get(`${cx + dx},${cz + dz}`);
        if (c) for (const m of c[layer]) out.add(m);
      }
    return [...out];
  }

  // Raycast gegen Fahrbahn ('road') oder Wände ('wall')
  cast(origin, dir, far, layer = 'road') {
    const list = this.candidates(origin, layer);
    if (!list.length) return null;
    this.raycaster.set(origin, dir);
    this.raycaster.far = far;
    const hit = this.raycaster.intersectObjects(list, false)[0];
    if (!hit) return null;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.dot(dir) > 0) normal.negate();
    return { point: hit.point, normal, distance: hit.distance, data: hit.object.userData };
  }

  spawnFor(piece) {
    const pos = piece.center.clone();
    if (piece.type === 'start') pos.addScaledVector(piece.forward, -5);
    return { pos, forward: piece.forward.clone() };
  }

  // Hat die Position die Torlinie in der Mitte des Bausteins in Fahrtrichtung überquert?
  crossed(piece, pos) {
    const d = pos.clone().sub(piece.center);
    if (Math.abs(d.x) > TILE / 2 + 1 || Math.abs(d.z) > TILE / 2 + 1 || Math.abs(d.y) > 6) return false;
    return d.dot(piece.forward) >= 0;
  }

  setCheckpointPassed(piece, passed) {
    piece.archMat?.color.set(passed ? this.theme.start : this.theme.checkpoint);
    piece.archMat?.emissive.set(passed ? this.theme.start : this.theme.checkpoint);
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
    for (const m of this.materials) {
      m.map?.dispose();
      m.dispose();
    }
  }
}
