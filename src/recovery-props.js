import * as THREE from '../vendor/three.module.js';

// Care stages leave visible, original equipment in the world. World coordinates
// below are local to each rescue site, in metres. The optional animal argument
// lets the tiger's dressing stay attached during its release animation.
const materials = new Map();
function material(color, roughness = .88, metalness = 0) {
  const key = `${color}:${roughness}:${metalness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
  return materials.get(key);
}
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function box(parent, size, position, mat) {
  return mesh(parent, new THREE.BoxGeometry(...size), mat, ...position);
}
function mergeGeometry(geometries) {
  const p = [], n = [];
  for (const indexed of geometries) {
    const g = indexed.index ? indexed.toNonIndexed() : indexed;
    p.push(...g.attributes.position.array); n.push(...g.attributes.normal.array);
  }
  const combined = new THREE.BufferGeometry();
  combined.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  combined.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  combined.computeBoundingSphere(); return combined;
}
function combinedBoxes(parent, entries, mat) {
  return mesh(parent, mergeGeometry(entries.map(({ size, position }) => new THREE.BoxGeometry(...size).translate(...position))), mat);
}
function basin(parent, x, z, width, depth, height, mat) {
  const wall = .055;
  const bowl = combinedBoxes(parent, [
    { size:[width, wall, depth], position:[0, wall / 2, 0] },
    { size:[width, height, wall], position:[0, height / 2, (depth - wall) / 2] },
    { size:[width, height, wall], position:[0, height / 2, -(depth - wall) / 2] },
    { size:[wall, height, depth - wall * 2], position:[(width - wall) / 2, height / 2, 0] },
    { size:[wall, height, depth - wall * 2], position:[-(width - wall) / 2, height / 2, 0] },
  ], mat);
  bowl.position.set(x, 0, z);
  return bowl;
}

export function createRecoveryProps(species, animal = null) {
  const root = new THREE.Group(); root.name = `${species} recovery equipment`;
  let sync = () => {};
  const canvas = material('#789077');
  const timber = material('#8e7952');
  const enamel = material('#c4d1c6', .48, .08);
  const waterColor = '#73b7ad';

  if (species === 'tiger') {
    const dressing = new THREE.Group(); dressing.name = 'Protective foreleg dressing';
    mesh(dressing, new THREE.CylinderGeometry(.092, .089, .19, 16), material('#eee8d4'));
    const seam = mesh(dressing, new THREE.CylinderGeometry(.093, .092, .016, 16), material('#b5c2a2'), 0, .028, 0);
    seam.castShadow = false;
    // Model leg pivots remain separate so the wrap follows the joint as it walks.
    const leg = animal?.children.find(child => child.isGroup && Math.abs(child.position.x - .24) < .01 && Math.abs(child.position.y - .86) < .01 && Math.abs(child.position.z - .5) < .01);
    if (leg) { leg.add(dressing); dressing.position.set(0, -.57, .025); }
    else { (animal || root).add(dressing); dressing.position.set(.24, .29, .525); }
    root.userData.dressing = dressing;
    sync = p => { dressing.visible = p.unlocked && p.careStep >= 2; };
  } else if (species === 'elephant') {
    const shade = new THREE.Group(); shade.name = 'Recovery shade canopy'; root.add(shade);
    combinedBoxes(shade, [-1, 1].flatMap(x => [-1, 1].map(z => ({ size:[.085, 3.58, .085], position:[x * 2.25, 1.79, z * 2.2] }))), timber);
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute([
      -2.4,3.6,-2.35, 0,4.03,-2.35, -2.4,3.6,2.35,
      0,4.03,-2.35, 0,4.03,2.35, -2.4,3.6,2.35,
      0,4.03,-2.35, 2.4,3.6,-2.35, 0,4.03,2.35,
      2.4,3.6,-2.35, 2.4,3.6,2.35, 0,4.03,2.35,
    ], 3)); roof.computeVertexNormals();
    const roofMaterial = canvas.clone(); roofMaterial.side = THREE.DoubleSide;
    mesh(shade, roof, roofMaterial);
    const station = new THREE.Group(); station.name = 'Fresh water trough'; root.add(station);
    basin(station, 2.8, .75, .9, 1.5, .48, material('#98aaa0', .62, .08));
    const water = mesh(station, new THREE.PlaneGeometry(.78, 1.38), material(waterColor, .18, .12), 2.8, .37, .75);
    water.rotation.x = -Math.PI / 2; water.castShadow = false;
    sync = p => { shade.visible = p.unlocked && p.careStep >= 1; station.visible = p.unlocked && p.careStep >= 2; };
  } else if (species === 'pangolin') {
    const carrier = new THREE.Group(); carrier.name = 'Quiet specialist carrier'; root.add(carrier);
    carrier.position.set(-2.35, .025, -.9);
    const walls = [
      { size:[1.3, .09, 1.65], position:[0, .045, 0] },
      { size:[.07, 1.05, 1.65], position:[-.615, .58, 0] },
      { size:[.07, 1.05, 1.65], position:[.615, .58, 0] },
      { size:[1.3, 1.05, .07], position:[0, .58, -.79] },
      { size:[1.42, .075, 1.75], position:[0, 1.14, 0] },
    ];
    combinedBoxes(carrier, walls, canvas);
    box(carrier, [1.11, .055, 1.43], [0, .12, 0], material('#d2c6a2'));
    // A folded privacy flap leaves the entrance visibly open toward the trail.
    box(carrier, [1.25, .16, .065], [0, 1.02, .84], material('#455f4c'));
    sync = p => { carrier.visible = p.unlocked && p.careStep >= 1; };
  } else if (species === 'turtle') {
    const tray = new THREE.Group(); tray.name = 'Marine treatment tray'; root.add(tray);
    tray.position.set(2.3, .29, 1);
    basin(tray, 0, 0, .92, .68, .12, enamel);
    const rinseMaterial = material('#929b79', .2, .1).clone();
    const rinse = mesh(tray, new THREE.PlaneGeometry(.8, .56), rinseMaterial, 0, .075, 0);
    rinse.rotation.x = -Math.PI / 2; rinse.castShadow = false;
    const supplies = combinedBoxes(tray, [
      { size:[.18, .09, .16], position:[-.19, .16, -.12] },
      { size:[.19, .025, .16], position:[.18, .135, -.12] },
    ], material('#eee8d8'));
    combinedBoxes(root, [
      { size:[.055, .29, .5], position:[1.94, .145, 1] },
      { size:[.055, .29, .5], position:[2.66, .145, 1] },
    ], timber).name = 'Treatment tray stand';
    const stand = root.getObjectByName('Treatment tray stand');
    sync = p => {
      tray.visible = stand.visible = p.unlocked && p.careStep >= 1;
      supplies.visible = p.careStep >= 2;
      rinseMaterial.color.set(p.careStep >= 2 ? waterColor : '#929b79');
    };
  } else {
    throw new Error(`Unknown recovery species: ${species}`);
  }

  root.userData.sync = progress => {
    const p = { unlocked:progress?.unlocked === true, careStep:Math.max(0, Math.min(3, Number(progress?.careStep) || 0)), rescued:progress?.rescued === true };
    sync(p);
  };
  root.userData.sync({ unlocked:false, careStep:0, rescued:false });
  return root;
}
