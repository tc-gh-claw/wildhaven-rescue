import * as THREE from '../vendor/three.module.js';

// All character geometry is original, built locally, and uses metre-scale proportions.
const mats = new Map();
function material(color, roughness = .86, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return mats.get(key);
}
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const unitY = new THREE.Vector3(0, 1, 0);

// Consolidate static pieces within a single articulated group. Per-vertex colours
// preserve each material's linear colour while equivalent shaders share one draw.
// Animated meshes and instanced scales are deliberately kept separate.
function batchStaticMeshes(parent, excluded = []) {
  const excludedSet = new Set(excluded), batches = new Map();
  for (const child of parent.children) {
    if (!child.isMesh || child.isInstancedMesh || excludedSet.has(child) || Array.isArray(child.material)) continue;
    const m = child.material;
    if (!m.isMeshStandardMaterial || m.transparent) continue;
    const key = [m.map?.uuid || '', m.roughness, m.metalness, m.side, m.opacity].join(':');
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  for (const meshes of batches.values()) {
    if (meshes.length < 2) continue;
    const vertexCount = meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0);
    const indexCount = meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count), 0);
    const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2), colours = new Float32Array(vertexCount * 3);
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let vertexOffset = 0, indexOffset = 0;
    for (const mesh of meshes) {
      mesh.updateMatrix(); normalMatrix.getNormalMatrix(mesh.matrix);
      const { position, normal: sourceNormal, uv } = mesh.geometry.attributes;
      const colour = mesh.material.color;
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrix);
        normal.fromBufferAttribute(sourceNormal, i).applyNormalMatrix(normalMatrix);
        const offset = (vertexOffset + i) * 3;
        positions.set([point.x, point.y, point.z], offset);
        normals.set([normal.x, normal.y, normal.z], offset);
        colours.set([colour.r, colour.g, colour.b], offset);
        if (uv) uvs.set([uv.getX(i), uv.getY(i)], (vertexOffset + i) * 2);
      }
      const sourceIndex = mesh.geometry.index;
      const count = sourceIndex?.count || position.count;
      for (let i = 0; i < count; i++) indices[indexOffset++] = vertexOffset + (sourceIndex ? sourceIndex.getX(i) : i);
      vertexOffset += position.count;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const batchMaterial = meshes[0].material.clone();
    batchMaterial.color.setHex(0xffffff); batchMaterial.vertexColors = true;
    const merged = new THREE.Mesh(geometry, batchMaterial);
    merged.name = 'Static detail batch'; merged.castShadow = true; merged.receiveShadow = true;
    for (const mesh of meshes) parent.remove(mesh);
    parent.add(merged);
  }
}
function ellipsoid(parent, position, scale, color, rotation = null) {
  const mesh = new THREE.Mesh(sphereGeo, typeof color === 'object' ? color : material(color));
  mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function box(parent, position, scale, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material(color));
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function segment(parent, a, b, radius, color, endRadius = radius) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(endRadius, radius, av.distanceTo(bv), 12), typeof color === 'object' ? color : material(color));
  mesh.position.copy(av).add(bv).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(unitY, bv.sub(av).normalize());
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function tube(parent, points, radius, color, taper = 1, radialSegments = 9) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const segments = Math.max(16, points.length * 6);
  const geo = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
  const pos = geo.attributes.position;
  for (let i = 0; i <= segments; i++) {
    const center = curve.getPointAt(i / segments);
    const s = 1 + (taper - 1) * i / segments;
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * (radialSegments + 1) + j;
      pos.setXYZ(k, center.x + (pos.getX(k) - center.x) * s,
        center.y + (pos.getY(k) - center.y) * s, center.z + (pos.getZ(k) - center.z) * s);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, typeof color === 'object' ? color : material(color));
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function eyes(parent, y, z, spacing, size, iris = '#402c16') {
  [-1, 1].forEach(side => {
    ellipsoid(parent, [side * spacing, y, z], [size * 1.35, size, size * .8], '#24221c');
    ellipsoid(parent, [side * spacing, y, z + size * .6], [size * .75, size * .7, size * .45], iris);
    ellipsoid(parent, [side * spacing, y, z + size * .93], [size * .25, size * .64, size * .19], '#111612');
    ellipsoid(parent, [side * spacing - size * .2, y + size * .25, z + size * 1.1], [size * .15, size * .16, size * .1], '#eeeee2');
  });
}
function makeTexture(type) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (type === 'tiger') {
    ctx.fillStyle = '#be6e26'; ctx.fillRect(0, 0, 512, 256);
    const glow = ctx.createLinearGradient(0, 0, 0, 256);
    glow.addColorStop(0, '#d89138'); glow.addColorStop(.6, '#c97a2c'); glow.addColorStop(1, '#e4b77a');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#25251e';
    for (let i = 0; i < 15; i++) {
      const x = i * 35 + 6;
      ctx.beginPath(); ctx.moveTo(x, -2); ctx.bezierCurveTo(x + 18, 70, x - 24, 112, x + 5, 221);
      ctx.bezierCurveTo(x - 8, 150, x - 11, 110, x - 8, 72); ctx.lineTo(x - 13, -2); ctx.fill();
      if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(x - 4, 85); ctx.lineTo(x + 13, 128); ctx.lineTo(x + 20, 173); ctx.lineTo(x + 6, 139); ctx.closePath(); ctx.fill(); }
    }
  } else {
    ctx.fillStyle = '#777970'; ctx.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1800; i++) {
      const x = (i * 71.79) % 512, y = (i * 31.21) % 256;
      ctx.fillStyle = i % 3 ? 'rgba(39,45,39,.12)' : 'rgba(205,202,178,.12)';
      ctx.fillRect(x, y, 1.5 + i % 4, .8 + i % 2);
    }
    ctx.strokeStyle = 'rgba(49,53,48,.15)'; ctx.lineWidth = 1;
    for (let y = 8; y < 256; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x < 512; x += 16) ctx.lineTo(x, y + Math.sin(x * .08 + y) * 3); ctx.stroke(); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: texture, roughness: .95 });
}

export function createRanger() {
  const root = new THREE.Group(); root.name = 'Field ranger';
  const torso = new THREE.Group(); root.add(torso);
  ellipsoid(torso, [0, 1.23, 0], [.23, .31, .135], '#9caa78');
  box(torso, [0, 1.14, .098], [.35, .24, .055], '#87986a');
  box(torso, [-.115, 1.31, .143], [.105, .11, .025], '#b1bc8e');
  box(torso, [.115, 1.31, .143], [.105, .11, .025], '#b1bc8e');
  box(torso, [0, .99, 0], [.34, .055, .24], '#473e2b');
  box(torso, [0, 1, .132], [.05, .044, .016], '#b6ab77');
  ellipsoid(torso, [0, .93, 0], [.18, .14, .12], '#575c41');
  segment(torso, [0, 1.48, 0], [0, 1.56, 0], .064, '#a87c58');
  ellipsoid(torso, [0, 1.66, .015], [.105, .137, .103], '#bd916b');
  ellipsoid(torso, [0, 1.718, -.014], [.107, .09, .1], '#453e30');
  ellipsoid(torso, [0, 1.646, .104], [.021, .035, .025], '#b1845e');
  [-1, 1].forEach(side => {
    ellipsoid(torso, [side * .105, 1.66, .005], [.023, .039, .024], '#b98b64');
    ellipsoid(torso, [side * .039, 1.681, .101], [.013, .008, .006], '#292e25');
  });
  // Ranger hat has a broad, thin brim; head remains normal human scale.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.175, .175, .016, 28), material('#72764c'));
  brim.position.set(0, 1.754, 0); brim.castShadow = true; torso.add(brim);
  ellipsoid(torso, [0, 1.778, -.005], [.116, .067, .11], '#81845b');
  box(torso, [0, 1.26, -.173], [.29, .35, .16], '#445c4a');
  [-1, 1].forEach(s => { segment(torso, [s * .13, 1.46, .08], [s * .13, 1.08, .115], .022, '#3e5140'); });
  box(torso, [0, 1.28, -.26], [.14, .1, .024], '#c2b48b');
  box(torso, [0, 1.28, -.277], [.062, .017, .006], '#47684e');
  box(torso, [0, 1.28, -.277], [.017, .062, .006], '#47684e');
  const arms = [], legs = [];
  [-1, 1].forEach(s => {
    const arm = new THREE.Group(); arm.position.set(s * .225, 1.42, 0); torso.add(arm); arms.push(arm);
    ellipsoid(arm, [s * .018, -.115, 0], [.075, .16, .075], '#98a577');
    segment(arm, [s * .021, -.23, .005], [s * .025, -.43, .03], .047, '#b98b64', .04);
    ellipsoid(arm, [s * .025, -.47, .04], [.041, .066, .038], '#b98b64');
    const leg = new THREE.Group(); leg.position.set(s * .103, .94, 0); root.add(leg); legs.push(leg);
    ellipsoid(leg, [0, -.22, 0], [.09, .25, .095], '#666a49');
    segment(leg, [0, -.4, .007], [0, -.72, .008], .062, '#666a49', .052);
    ellipsoid(leg, [0, -.83, .045], [.073, .105, .134], '#413c2c');
    box(leg, [0, -.914, .049], [.145, .04, .23], '#2d3028');
  });
  batchStaticMeshes(torso);
  [...arms, ...legs].forEach(group => batchStaticMeshes(group));
  root.userData.animate = (time, movingSpeed = 0) => {
    const amount = Math.min(1, movingSpeed / 3);
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(time * 9 + i * Math.PI) * .65 * amount; });
    arms.forEach((arm, i) => { arm.rotation.x = Math.sin(time * 9 + i * Math.PI + Math.PI) * .45 * amount; });
    torso.position.y = Math.abs(Math.sin(time * 9)) * .025 * amount;
  };
  return root;
}

function createTiger() {
  const root = new THREE.Group(); root.name = 'Tiger';
  const fur = makeTexture('tiger');
  const body = ellipsoid(root, [0, .89, -.04], [.36, .43, .8], fur);
  ellipsoid(root, [0, .69, .04], [.28, .21, .65], '#e7d7ad');
  ellipsoid(root, [0, 1, .53], [.33, .43, .4], fur);
  const head = new THREE.Group(); head.position.set(0, 1.1, .87); root.add(head);
  ellipsoid(head, [0, 0, 0], [.245, .24, .255], fur);
  ellipsoid(head, [0, -.12, .13], [.211, .117, .18], '#ddcba6');
  [-1, 1].forEach(s => {
    ellipsoid(head, [s * .195, .175, -.065], [.092, .105, .06], '#282820', [0, 0, s * -.18]);
    ellipsoid(head, [s * .194, .18, -.011], [.048, .059, .012], '#ddcba6');
    ellipsoid(head, [s * .107, -.06, .228], [.115, .082, .1], '#e9dbc0');
    ellipsoid(head, [s * .172, .056, .185], [.052, .039, .037], '#1c2420');
    ellipsoid(head, [s * .173, .057, .216], [.031, .025, .012], '#bca557');
    ellipsoid(head, [s * .173, .057, .227], [.009, .022, .005], '#14231a');
    ellipsoid(head, [s * .168, .065, .231], [.005, .006, .003], '#f6e9c1');
    for (let k = 0; k < 3; k++) tube(head, [[s * .07, -.077 - k * .022, .307], [s * .2, -.055 - k * .026, .316], [s * .34, -.065 - k * .032, .3]], .002, '#d8d2ba', .4, 4);
    tube(head, [[s * .05, .09, .24], [s * .14, .11, .217], [s * .21, .083, .16]], .012, '#eee1bd', .6);
  });
  ellipsoid(head, [0, -.041, .304], [.069, .039, .032], '#594030');
  segment(head, [0, -.06, .319], [0, -.115, .316], .008, '#302d23');
  const legs = [];
  [-1, 1].forEach(s => [-1, 1].forEach(front => {
    const z = front > 0 ? .5 : -.57;
    const pivot = new THREE.Group(); pivot.position.set(s * .24, .86, z); root.add(pivot); legs.push(pivot);
    ellipsoid(pivot, [0, -.17, front > 0 ? -.015 : -.055], [.14, .29, .18], fur);
    segment(pivot, [0, -.33, 0], [0, -.66, .025], .086, fur, .069);
    ellipsoid(pivot, [0, -.754, .09], [.115, .085, .174], fur);
    for (let j = 0; j < 3; j++) segment(pivot, [(j - 1) * .045, -.77, .22], [(j - 1) * .045, -.788, .238], .004, '#383628');
  }));
  const tail = new THREE.Group(); tail.position.set(0, .96, -.72); root.add(tail);
  tube(tail, [[0, 0, 0], [.08, -.06, -.3], [.16, -.3, -.62], [.35, -.46, -.85], [.46, -.36, -.9]], .065, fur, .53);
  batchStaticMeshes(root, [body]);
  batchStaticMeshes(head);
  legs.forEach(group => batchStaticMeshes(group));
  root.userData.animate = (t, rescued = false) => {
    body.scale.y = .43 * (1 + Math.sin(t * 1.8) * .015);
    head.rotation.y = Math.sin(t * .6) * .06;
    tail.rotation.z = Math.sin(t * 1.3) * .14;
    legs.forEach((leg, i) => { leg.rotation.x = rescued ? Math.sin(t * 2 + i % 2 * Math.PI) * .065 : 0; });
  };
  return root;
}

function createElephant() {
  const root = new THREE.Group(); root.name = 'Asian elephant';
  const skin = makeTexture('elephant');
  const body = ellipsoid(root, [0, 1.88, -.22], [.83, .98, 1.32], skin);
  ellipsoid(root, [0, 2.14, .65], [.7, .83, .68], skin);
  const head = new THREE.Group(); head.position.set(0, 2.18, 1.03); root.add(head);
  ellipsoid(head, [0, .06, 0], [.52, .63, .52], skin);
  // Two forehead domes and relatively small ears distinguish the Asian elephant.
  ellipsoid(head, [-.2, .46, .03], [.28, .28, .3], skin);
  ellipsoid(head, [.2, .46, .03], [.28, .28, .3], skin);
  const ears = [];
  [-1, 1].forEach(s => {
    const ear = new THREE.Group(); ear.position.set(s * .43, .08, -.02); head.add(ear); ears.push(ear);
    ellipsoid(ear, [s * .3, -.06, -.035], [.43, .64, .075], skin, [0, s * .18, s * -.18]);
    ellipsoid(ear, [s * .33, -.09, .031], [.31, .45, .025], '#827e70', [0, s * .18, s * -.18]);
    ellipsoid(head, [s * .397, .035, .35], [.068, .048, .035], '#4f5148');
    ellipsoid(head, [s * .406, .039, .378], [.031, .024, .012], '#171e18');
    ellipsoid(head, [s * .402, .047, .39], [.008, .006, .003], '#bfc5ad');
    tube(head, [[s * .24, -.28, .33], [s * .26, -.46, .58], [s * .28, -.44, .86], [s * .3, -.35, 1.03]], .075, '#d7c9a1', .05);
  });
  const trunk = new THREE.Group(); trunk.position.set(0, -.04, .4); head.add(trunk);
  tube(trunk, [[0, 0, 0], [0, -.4, .17], [0, -.93, .24], [0, -1.42, .42], [.07, -1.61, .61], [.11, -1.52, .78]], .22, skin, .29, 14);
  for (let i = 1; i < 10; i++) {
    const y = -.11 - i * .12, z = .1 + i * .025;
    tube(trunk, [[-.12 + i * .006, y, z + .16], [0, y - .015, z + .18], [.12 - i * .006, y, z + .16]], .006, '#61675e', 1, 5);
  }
  const legs = [];
  [-1, 1].forEach(s => [-1, 1].forEach(f => {
    const leg = new THREE.Group(); leg.position.set(s * .5, 1.55, f > 0 ? .66 : -1); root.add(leg); legs.push(leg);
    segment(leg, [0, -.11, 0], [0, -1.23, .035], .245, skin, .2);
    ellipsoid(leg, [0, -1.3, .08], [.26, .25, .3], skin);
    for (let i = -1; i <= 1; i++) ellipsoid(leg, [i * .115, -1.44, .335 - Math.abs(i) * .04], [.055, .074, .028], '#bbb49b');
  }));
  tube(root, [[0, 2.01, -1.46], [0, 1.59, -1.65], [.04, .99, -1.74], [.12, .76, -1.74]], .045, skin, .5);
  ellipsoid(root, [.12, .74, -1.74], [.055, .16, .055], '#4b5148');
  batchStaticMeshes(root, [body]);
  batchStaticMeshes(head);
  batchStaticMeshes(trunk);
  [...ears, ...legs].forEach(group => batchStaticMeshes(group));
  root.userData.animate = (t, rescued = false) => {
    body.scale.y = .98 * (1 + Math.sin(t * 1.1) * .009);
    ears.forEach((ear, i) => { ear.rotation.y = Math.sin(t * 1.1) * .09 * (i ? 1 : -1); });
    trunk.rotation.z = Math.sin(t * .85) * (rescued ? .09 : .035);
  };
  return root;
}

function scaleGeometry() {
  const vertices = new Float32Array([
    -.035, 0, .044, -.058, 0, -.006, 0, .004, -.079, .058, 0, -.006, .035, 0, .044, 0, .026, .004
  ]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  g.setIndex([5,1,0,5,2,1,5,3,2,5,4,3,5,0,4]); g.computeVertexNormals(); return g;
}
function createPangolin() {
  const root = new THREE.Group(); root.name = 'Sunda pangolin';
  ellipsoid(root, [0, .3, -.04], [.22, .22, .41], '#60543c');
  ellipsoid(root, [0, .25, .35], [.12, .12, .2], '#927b53');
  segment(root, [0, .26, .39], [0, .17, .63], .09, '#9d8458', .025);
  ellipsoid(root, [0, .17, .638], [.028, .021, .023], '#3b3528');
  eyes(root, .285, .457, .085, .015, '#4a3e25');
  [-1, 1].forEach(s => {
    ellipsoid(root, [s * .112, .31, .325], [.021, .031, .023], '#88754e');
    [.2, -.26].forEach(z => {
      ellipsoid(root, [s * .165, .155, z], [.066, .13, .085], '#7b6848', [0, 0, s * -.25]);
      ellipsoid(root, [s * .186, .057, z + .04], [.075, .038, .092], '#87734f');
      for (let i = -1; i <= 1; i++) segment(root, [s * .186 + i * .028, .05, z + .105], [s * .186 + i * .029, .024, z + .16], .01, '#d0bc86', .002);
    });
  });
  tube(root, [[0, .28, -.34], [0, .24, -.57], [.04, .14, -.8], [.12, .07, -1.02]], .15, '#66583b', .07);
  const transforms = [], dummy = new THREE.Object3D();
  for (let row = 0; row < 9; row++) {
    const z = -.37 + row * .085;
    const cross = Math.sqrt(Math.max(.1, 1 - ((z + .04) / .44) ** 2));
    for (let col = 0; col < 9; col++) {
      const theta = (col - 4) * .32 + (row % 2) * .07;
      const x = .225 * Math.sin(theta) * cross;
      const y = .3 + .225 * Math.cos(theta) * cross;
      dummy.position.set(x, y, z);
      const normal = new THREE.Vector3(x / (.225 ** 2), (y - .3) / (.225 ** 2), (z + .04) / (.44 ** 2)).normalize();
      dummy.quaternion.setFromUnitVectors(unitY, normal); dummy.scale.setScalar(.85 + cross * .18); dummy.updateMatrix(); transforms.push(dummy.matrix.clone());
    }
  }
  for (let row = 0; row < 6; row++) {
    const z = -.48 - row * .078, w = .13 * (1 - row / 7), y = .25 - row * .031;
    for (let col = -2; col <= 2; col++) {
      const angle = col * .56;
      dummy.position.set(row * row * .002 + Math.sin(angle) * w, y + Math.cos(angle) * w, z);
      dummy.quaternion.setFromUnitVectors(unitY, new THREE.Vector3(Math.sin(angle), Math.cos(angle), -.2).normalize());
      dummy.scale.setScalar(.9 - row * .1); dummy.updateMatrix(); transforms.push(dummy.matrix.clone());
    }
  }
  const plates = new THREE.InstancedMesh(scaleGeometry(), material('#88724a'), transforms.length);
  transforms.forEach((matrix, i) => { plates.setMatrixAt(i, matrix); plates.setColorAt(i, new THREE.Color().setHSL(.105, .23, .28 + (i % 5) * .028)); });
  plates.castShadow = true; plates.receiveShadow = true; root.add(plates);
  batchStaticMeshes(root);
  root.userData.animate = (t, rescued = false) => { plates.position.y = Math.sin(t * 1.7) * .004; };
  return root;
}

function createTurtle() {
  const root = new THREE.Group(); root.name = 'Hawksbill turtle';
  ellipsoid(root, [0, .13, 0], [.39, .11, .51], '#c5b277');
  ellipsoid(root, [0, .16, -.025], [.4, .184, .53], '#443e26');
  const shellHeight = (x, z) => .164 + .188 * Math.sqrt(Math.max(0, 1 - (x / .405) ** 2 - ((z + .025) / .535) ** 2));
  function scute(cx, cz, rx, rz, shade) {
    const vertices = [cx, shellHeight(cx, cz) + .005, cz];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const x = cx + Math.cos(a) * rx, z = cz + Math.sin(a) * rz;
      vertices.push(x, shellHeight(x, z) + .006, z);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const indices = []; for (let i = 0; i < 6; i++) indices.push(0, (i + 1) % 6 + 1, i + 1);
    g.setIndex(indices); g.computeVertexNormals(); const m = new THREE.Mesh(g, material(shade)); m.castShadow = true; m.receiveShadow = true; root.add(m);
    const vein = [[cx - rx * .55, shellHeight(cx - rx * .55, cz) + .008, cz], [cx, shellHeight(cx, cz) + .009, cz], [cx + rx * .6, shellHeight(cx + rx * .6, cz) + .009, cz]];
    tube(root, vein, .002, '#b29a4c', 1, 4);
  }
  for (let i = 0; i < 4; i++) scute(0, -.34 + i * .213, .135, .115, i % 2 ? '#967b37' : '#ad8940');
  [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) scute(s * .233, -.25 + i * .225, .115, .12, i % 2 ? '#78622c' : '#997b36'); });
  const rim = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; rim.push([Math.cos(a) * .395, .155, Math.sin(a) * .525 - .025]); }
  tube(root, rim, .015, '#b49b55', 1, 6);
  ellipsoid(root, [0, .15, .49], [.092, .071, .17], '#b49c61');
  ellipsoid(root, [0, .15, .65], [.091, .067, .106], '#b49c61');
  ellipsoid(root, [0, .133, .736], [.05, .048, .048], '#a48b4e');
  eyes(root, .183, .706, .068, .018, '#322e1d');
  const flippers = [];
  [-1, 1].forEach(s => {
    const flipper = new THREE.Group(); flipper.position.set(s * .29, .105, .28); root.add(flipper); flippers.push(flipper);
    ellipsoid(flipper, [s * .18, 0, .01], [.27, .025, .09], '#a48b4e', [0, s * .45, 0]);
    ellipsoid(flipper, [s * .33, 0, -.095], [.19, .022, .07], '#ac9559', [0, s * .8, 0]);
    for (let i = 0; i < 5; i++) ellipsoid(flipper, [s * (.08 + i * .06), .024, .02 - i * .023], [.025, .003, .028], '#605636');
    ellipsoid(root, [s * .34, .08, -.38], [.14, .024, .105], '#a68e50', [0, s * -.5, 0]);
  });
  segment(root, [0, .11, -.48], [0, .07, -.62], .025, '#a58d54', .004);
  batchStaticMeshes(root);
  flippers.forEach(group => batchStaticMeshes(group));
  root.userData.animate = (t, rescued = false) => {
    flippers.forEach((f, i) => { f.rotation.z = Math.sin(t * (rescued ? 2.5 : .8)) * (rescued ? .22 : .045) * (i ? 1 : -1); });
  };
  return root;
}

export function createAnimal(species) {
  const constructors = { tiger: createTiger, elephant: createElephant, pangolin: createPangolin, turtle: createTurtle };
  if (!constructors[species]) throw new Error(`Unknown animal: ${species}`);
  return constructors[species]();
}

export function createCage(width = 4, depth = 4, height = 3) {
  const root = new THREE.Group(); root.name = 'Poacher holding cage';
  const iron = '#555e58', rusty = '#71614a';
  box(root, [0, .035, 0], [width + .18, .07, depth + .18], '#5b5140');
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) segment(root, [x, .06, z], [x, height, z], .055, iron);
  for (const y of [.12, height * .45, height]) {
    segment(root, [-width / 2, y, -depth / 2], [width / 2, y, -depth / 2], .038, iron);
    for (const x of [-width / 2, width / 2]) segment(root, [x, y, -depth / 2], [x, y, depth / 2], .038, iron);
    if (y !== height * .45) segment(root, [-width / 2, y, depth / 2], [width / 2, y, depth / 2], .038, iron);
  }
  const nx = Math.round(width / .34), nz = Math.round(depth / .34);
  for (let i = 1; i < nx; i++) segment(root, [-width / 2 + width * i / nx, .1, -depth / 2], [-width / 2 + width * i / nx, height, -depth / 2], .024, iron);
  for (let i = 1; i < nz; i++) for (const x of [-width / 2, width / 2]) segment(root, [x, .1, -depth / 2 + depth * i / nz], [x, height, -depth / 2 + depth * i / nz], .024, iron);
  for (let i = 1; i < nx; i++) segment(root, [-width / 2 + width * i / nx, height, -depth / 2], [-width / 2 + width * i / nx, height, depth / 2], .02, iron);
  const door = new THREE.Group(); door.position.set(-width / 2, 0, depth / 2); root.add(door);
  for (const y of [.12, height * .45, height - .05]) segment(door, [0, y, 0], [width, y, 0], .035, rusty);
  for (let i = 0; i <= nx; i++) segment(door, [width * i / nx, .12, 0], [width * i / nx, height - .05, 0], .026, iron);
  box(door, [width - .16, height * .43, .046], [.19, .22, .08], '#8e7950');
  batchStaticMeshes(root);
  batchStaticMeshes(door);
  root.userData.door = door;
  root.userData.open = progress => { door.rotation.y = -Math.max(0, Math.min(1, progress)) * Math.PI * .6; };
  return root;
}
