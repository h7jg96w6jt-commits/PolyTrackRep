import * as THREE from 'three';
import { TILE, LEVEL_H, ROAD_W, layoutTrack } from './layout.js';

const HALF = TILE / 2;
const ROAD_HALF = ROAD_W / 2;
const KERB = 1;
const THICK = 1.2;

const COLORS = {
  road: new THREE.Color('#3b4150'),
  kerbA: new THREE.Color('#ff5a3c'),
  kerbB: new THREE.Color('#f4f1ea'),
  boost: new THREE.Color('#22d3ee'),
  start: new THREE.Color('#4ade80'),
  side: new THREE.Color('#2a2e38'),
};

const smooth = (t) => t * t * (3 - 2 * t);

// Mittellinie eines Bausteins in lokalen Koordinaten.
// Einfahrt bei z = +HALF, Fahrtrichtung -z.
function centerline(type, t) {
  switch (type) {
    case 'left': {
      const a = -t * Math.PI / 2;
      return new THREE.Vector3(-HALF + HALF * Math.cos(a), 0, HALF + HALF * Math.sin(a));
    }
    case 'right': {
      const a = -t * Math.PI / 2;
      return new THREE.Vector3(HALF - HALF * Math.cos(a), 0, HALF + HALF * Math.sin(a));
    }
    case 'up':
      return new THREE.Vector3(0, LEVEL_H * smooth(t), HALF - TILE * t);
    case 'down':
      return new THREE.Vector3(0, -LEVEL_H * smooth(t), HALF - TILE * t);
    default:
      return new THREE.Vector3(0, 0, HALF - TILE * t);
  }
}

function buildPieceGeometry(type) {
  const segs = type === 'left' || type === 'right' ? 12 : type === 'up' || type === 'down' ? 16 : 8;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = centerline(type, t);
    const a = centerline(type, Math.max(0, t - 0.01));
    const b = centerline(type, Math.min(1, t + 0.01));
    const tan = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
    const right = new THREE.Vector3(-tan.z, 0, tan.x);
    pts.push({ p, right });
  }

  const pos = [];
  const col = [];
  const at = (s, o, dy = 0) => {
    const v = s.p.clone().addScaledVector(s.right, o);
    v.y += dy;
    return v;
  };
  const quad = (a, b, c, d, color) => {
    // a-b vorne (links->rechts), c-d hinten
    for (const v of [a, b, c, b, d, c]) {
      pos.push(v.x, v.y, v.z);
      col.push(color.r, color.g, color.b);
    }
  };

  const mainColor = type === 'boost' ? COLORS.boost : COLORS.road;
  const strips = [
    [-ROAD_HALF, -ROAD_HALF + KERB, 'kerb'],
    [-ROAD_HALF + KERB, ROAD_HALF - KERB, 'main'],
    [ROAD_HALF - KERB, ROAD_HALF, 'kerb'],
  ];

  for (let i = 0; i < segs; i++) {
    const s0 = pts[i], s1 = pts[i + 1];
    for (const [a, b, kind] of strips) {
      let c = mainColor;
      if (kind === 'kerb') c = i % 2 ? COLORS.kerbA : COLORS.kerbB;
      if (kind === 'main' && (type === 'start' || type === 'finish') && i === segs / 2) c = type === 'start' ? COLORS.start : COLORS.kerbB;
      quad(at(s0, a), at(s0, b), at(s1, a), at(s1, b), c);
    }
    // Seitenwände und Unterseite
    quad(at(s0, -ROAD_HALF), at(s0, -ROAD_HALF, -THICK), at(s1, -ROAD_HALF), at(s1, -ROAD_HALF, -THICK), COLORS.side);
    quad(at(s0, ROAD_HALF, -THICK), at(s0, ROAD_HALF), at(s1, ROAD_HALF, -THICK), at(s1, ROAD_HALF), COLORS.side);
    quad(at(s0, ROAD_HALF, -THICK), at(s0, -ROAD_HALF, -THICK), at(s1, ROAD_HALF, -THICK), at(s1, -ROAD_HALF, -THICK), COLORS.side);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildArch(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });
  const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(sx * (ROAD_HALF + 0.8), 4, 0);
    post.castShadow = true;
    group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 2.4, 0.9, 0.9), mat);
  bar.position.y = 8;
  bar.castShadow = true;
  group.add(bar);
  group.userData.material = mat;
  return group;
}

export class Track {
  constructor(scene, code) {
    const { pieces, errors } = layoutTrack(code);
    if (errors.length) throw new Error(errors.join('\n'));

    this.group = new THREE.Group();
    this.surfaces = [];
    this.checkpoints = [];
    this.pieces = pieces;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 60;

    const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide });
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#59606f', flatShading: true, roughness: 0.9 });
    const geoCache = {};

    for (const p of pieces) {
      const geo = geoCache[p.type] ??= buildPieceGeometry(p.type);
      const mesh = new THREE.Mesh(geo, roadMat);
      mesh.position.set(p.x * TILE, p.level * LEVEL_H, p.z * TILE);
      mesh.rotation.y = -p.dir * Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { type: p.type };
      this.group.add(mesh);
      this.surfaces.push(mesh);

      p.center = mesh.position.clone();
      p.yaw = mesh.rotation.y;

      // Stützpfeiler unter erhöhten Bausteinen
      const topY = p.level * LEVEL_H + (p.type === 'up' ? LEVEL_H / 2 : p.type === 'down' ? -LEVEL_H / 2 : 0);
      if (topY > 0.5) {
        const h = topY - THICK + 1;
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.5, h, 2.5), pillarMat);
        pillar.position.set(p.center.x, h / 2 - 1, p.center.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.group.add(pillar);
      }

      if (p.type === 'checkpoint' || p.type === 'finish' || p.type === 'start') {
        const color = p.type === 'checkpoint' ? '#facc15' : p.type === 'finish' ? '#f4f1ea' : '#4ade80';
        const arch = buildArch(color);
        arch.position.copy(p.center);
        arch.rotation.y = p.yaw;
        this.group.add(arch);
        p.arch = arch;
        if (p.type === 'checkpoint') this.checkpoints.push(p);
        if (p.type === 'finish') this.finish = p;
        if (p.type === 'start') this.start = p;
      }
    }

    this.addGround();
    this.addScenery();
    scene.add(this.group);
  }

  addGround() {
    const geo = new THREE.PlaneGeometry(3000, 3000);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: '#7cc26b', roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.y = -1;
    ground.receiveShadow = true;
    ground.userData = { type: 'grass', offroad: true };
    this.group.add(ground);
    this.surfaces.push(ground);
  }

  addScenery() {
    // Deterministischer Zufall, damit die Strecke immer gleich aussieht
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const occupied = new Set(this.pieces.map((p) => `${p.x},${p.z}`));
    const xs = this.pieces.map((p) => p.x), zs = this.pieces.map((p) => p.z);
    const minX = Math.min(...xs) - 6, maxX = Math.max(...xs) + 6;
    const minZ = Math.min(...zs) - 6, maxZ = Math.max(...zs) + 6;

    const spots = [];
    for (let i = 0; i < 600 && spots.length < 220; i++) {
      const x = minX * TILE + rnd() * (maxX - minX) * TILE;
      const z = minZ * TILE + rnd() * (maxZ - minZ) * TILE;
      const cx = Math.round(x / TILE), cz = Math.round(z / TILE);
      let near = false;
      for (let dx = -1; dx <= 1 && !near; dx++)
        for (let dz = -1; dz <= 1 && !near; dz++)
          if (occupied.has(`${cx + dx},${cz + dz}`)) near = true;
      if (!near) spots.push({ x, z, s: 0.7 + rnd() * 0.9, r: rnd() * Math.PI * 2, rock: rnd() < 0.2 });
    }

    const trees = spots.filter((s) => !s.rock);
    const rocks = spots.filter((s) => s.rock);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 6, 6), new THREE.MeshStandardMaterial({ color: '#2f8f5b', flatShading: true }), trees.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.5, 2, 5), new THREE.MeshStandardMaterial({ color: '#8b5a3c', flatShading: true }), trees.length);
    const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.6, 0), new THREE.MeshStandardMaterial({ color: '#a3a8b4', flatShading: true }), rocks.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();

    trees.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r);
      sc.setScalar(t.s);
      m.compose(v.set(t.x, -1 + 1 * t.s, t.z), q, sc);
      trunk.setMatrixAt(i, m);
      m.compose(v.set(t.x, -1 + 5 * t.s, t.z), q, sc);
      crown.setMatrixAt(i, m);
    });
    rocks.forEach((t, i) => {
      q.setFromEuler(new THREE.Euler(t.r, t.r * 2, 0));
      sc.set(t.s, t.s * 0.6, t.s);
      m.compose(v.set(t.x, -1, t.z), q, sc);
      rock.setMatrixAt(i, m);
    });
    for (const im of [crown, trunk, rock]) {
      im.castShadow = true;
      this.group.add(im);
    }
  }

  // Liefert die Oberfläche unter einer Position oder null.
  groundAt(pos) {
    this.raycaster.set(new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), new THREE.Vector3(0, -1, 0));
    const hit = this.raycaster.intersectObjects(this.surfaces, false)[0];
    if (!hit) return null;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (normal.y < 0) normal.negate();
    return { y: hit.point.y, normal, data: hit.object.userData };
  }

  // Hat die Position die Torlinie (Mitte des Bausteins) in Fahrtrichtung überquert?
  static crossed(piece, pos) {
    const dx = pos.x - piece.center.x, dz = pos.z - piece.center.z;
    const inside = Math.abs(dx) < HALF && Math.abs(dz) < HALF && Math.abs(pos.y - piece.center.y) < LEVEL_H;
    const along = -Math.sin(piece.yaw) * dx - Math.cos(piece.yaw) * dz;
    return inside && along >= 0;
  }
}
