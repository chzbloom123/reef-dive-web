import * as THREE from 'three';
import { createRandom } from '../random.js';
import { createNoise } from '../noise.js';
import { groundHeightAt } from '../terrain-height.js';
import { createCoralMaterial } from './coral-material.js';
import { createBrainCoralGeometry } from './brain-coral.js';
import { createBranchingCoralGeometry } from './branching-coral.js';
import { createTableCoralGeometry } from './table-coral.js';
import { createTubeCoralGeometry } from './tube-coral.js';
import { createAnemoneGeometry } from './anemone.js';
import { createSeagrassGeometry } from './seagrass.js';

// Decides where every coral, anemone, and seagrass blade grows, then builds one InstancedMesh per variety.
//
//   for each species (brain, branching, table, tube, anemone):
//     repeat until the count is reached:
//       pick a spot ── on a rock's upward face (most) or on sand near rocks / in "garden" patches
//       reject it if ── too shallow, overlapping another coral, or buried in rock
//       pick a variety, size, tilt, spin, and color
//   then: one InstancedMesh per variety = one GPU draw call for all of its copies
//
// Real reefs cluster: coral crowds onto hard rock and the rubble around it, and sand in between stays
// bare or grows seagrass. The placement rules copy that pattern.

// Counts at full density (High). Low keeps a fixed subset (its coralDensity fraction) of the SAME
// placements, so both presets show the same reef; Low just has fewer pieces.
const BASE_COUNTS = { brain: 150, branching: 260, table: 70, tube: 130, anemone: 70 };
const SEAGRASS_FULL = 6000;

// Sand spots that get extra coral so the named viewpoints have a rich foreground.
const GARDENS = [
  [-2.3, 14.5],
  [2.4, 13.2],
  [0.6, 10.5],
  [4.3, 2.4],
  [-1.6, 2.5],
  [1.8, -5],
  [-2, -10],
];

// Colors (tints multiplied by each variety's built-in shading). Chosen a bit more saturated than
// real coral, because the water steals color before it reaches your eye.
const SPECIES = {
  brain: {
    varieties: (p) => [0, 1, 2].map((v) => createBrainCoralGeometry(v, p.name === 'high' ? 10 : 6)),
    material: { maze: true },
    size: [0.28, 0.75],
    minFacing: -0.05, // brain coral also encrusts steep rock faces, bulging outward
    tilt: 0.85,
    sink: 0.1,
    solid: 0.85,
    palette: ['#cfc257', '#4fb8a6', '#cc7fb3', '#dba25a', '#93bf5a', '#7fa0d8'],
  },
  branching: {
    varieties: () => [
      createBranchingCoralGeometry('staghorn', 11),
      createBranchingCoralGeometry('staghorn', 12),
      createBranchingCoralGeometry('bushy', 13),
      createBranchingCoralGeometry('bushy', 14),
    ],
    material: {},
    size: [0.55, 1.15],
    minFacing: 0.4,
    tilt: 0.3,
    sink: 0.02,
    solid: 0.45,
    palette: ['#b98ad9', '#6fa9e6', '#ea8a7a', '#ecd67c', '#de6aa0', '#8fd6d0'],
  },
  table: {
    varieties: () => [
      createTableCoralGeometry('table', 21),
      createTableCoralGeometry('table', 22),
      createTableCoralGeometry('plate', 23),
      createTableCoralGeometry('plate', 24),
    ],
    plateVarieties: [2, 3], // these grow only as shelves out of rock walls...
    standingVarieties: [0, 1], // ...and these (on stalks) only on flat tops and sand
    material: {},
    size: [0.45, 0.95],
    onSand: false, // table coral needs hard rock to anchor its stalk
    tilt: 0.15,
    sink: 0,
    solid: 0.75,
    palette: ['#d9867c', '#b89868', '#98ad62', '#c47fae', '#e0a05e', '#8fb3c9'],
  },
  tube: {
    varieties: () => [createTubeCoralGeometry(31), createTubeCoralGeometry(32), createTubeCoralGeometry(33)],
    material: { doubleSided: true },
    size: [0.25, 0.6],
    minFacing: -0.05,
    tilt: 0.7,
    sink: 0.02,
    solid: 0.35,
    palette: ['#f5c531', '#f28c3a', '#9d6ad4', '#e4e46e', '#e0578a'],
  },
  anemone: {
    varieties: () => [0, 1, 2].map((v) => createAnemoneGeometry(v, 41 + v)),
    material: { sway: 0.035, translucent: true },
    size: [0.8, 1.5],
    minFacing: 0.2,
    tilt: 0.5,
    sink: 0.03,
    solid: 0, // soft: you can brush through anemones
    palette: ['#ffffff', '#fff0f4', '#f4f0ff', '#fff6ea'],
  },
};

const REEF_BOUNDS = { minX: -10, maxX: 10, minZ: -19, maxZ: 17 };

export function createReefLife(preset, rockField) {
  const rand = createRandom(77);
  const { fbm } = createNoise(78);
  const group = new THREE.Group();
  const colliders = []; // spheres the diver can't enter: { center, radius }
  const placed = []; // everything placed so far, to avoid overlaps: { center, radius }

  const reefRocks = rockField.rocks.filter(
    (r) => r.center.x > REEF_BOUNDS.minX && r.center.x < REEF_BOUNDS.maxX && r.center.z > REEF_BOUNDS.minZ && r.center.z < REEF_BOUNDS.maxZ,
  );
  // Bigger rocks have more surface, so they should get proportionally more coral.
  const rockWeights = reefRocks.map((r) => r.scale.x * r.scale.z + r.scale.y * (r.scale.x + r.scale.z));
  const totalWeight = rockWeights.reduce((a, b) => a + b, 0);
  const pickRock = () => {
    let t = rand.next() * totalWeight;
    for (let i = 0; i < reefRocks.length; i++) {
      t -= rockWeights[i];
      if (t <= 0) return reefRocks[i];
    }
    return reefRocks[reefRocks.length - 1];
  };

  const pos = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const probe = new THREE.Vector3();

  // Chance (0..1) that coral grows on open sand at (x, z): high near rocks and in the gardens.
  const sandChance = (x, z, rockGap) => {
    let chance = 0.06 + 0.85 * Math.exp(-rockGap / 1.4);
    for (const [gx, gz] of GARDENS) chance += 0.9 * Math.exp(-((x - gx) ** 2 + (z - gz) ** 2) / 4);
    return chance;
  };

  function findSpot(species, size) {
    for (let attempt = 0; attempt < 60; attempt++) {
      let shelf = false;
      if (species.onSand === false || rand.next() < 0.62) {
        // On a rock: a random direction from its center, weighted toward the top.
        const rock = pickRock();
        const up = 1 - Math.pow(rand.next(), 1.6) * 1.25;
        const around = rand.range(0, Math.PI * 2);
        const flat = Math.sqrt(Math.max(0, 1 - up * up));
        dir.set(Math.cos(around) * flat, up, Math.sin(around) * flat);
        rockField.sampleSurface(rock, dir, pos, normal);
        if (normal.y < (species.minFacing ?? 0.5)) {
          // Too steep for this species. Plates can still grow out sideways as shelves.
          if (species !== SPECIES.table || normal.y < -0.1) continue;
          shelf = true;
          pos.addScaledVector(dir.set(normal.x, 0, normal.z).normalize(), size * 0.55);
          normal.set(0, 1, 0);
        }
      } else {
        const x = rand.range(REEF_BOUNDS.minX + 1.5, REEF_BOUNDS.maxX - 1.5);
        const z = rand.range(REEF_BOUNDS.minZ, REEF_BOUNDS.maxZ);
        pos.set(x, groundHeightAt(x, z), z);
        const gap = rockField.distanceTo(probe.set(x, pos.y + 0.2, z));
        if (gap < size * 0.3) continue; // would be buried in rock
        if (rand.next() > sandChance(x, z, gap)) continue;
        normal.set(0, 1, 0);
      }
      if (pos.y > -1.5 - size * 0.6) continue; // keep clear of the surface
      const radius = size * 0.5;
      if (placed.some((p) => p.center.distanceTo(pos) < (p.radius + radius) * 0.55)) continue;
      return { position: pos.clone(), normal: normal.clone(), shelf };
    }
    return null;
  }

  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const tiltTo = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  for (const [name, species] of Object.entries(SPECIES)) {
    const geometries = species.varieties(preset);
    const material = createCoralMaterial(preset, species.material);
    const instances = geometries.map(() => []);
    const count = BASE_COUNTS[name];

    for (let n = 0; n < count; n++) {
      const size = rand.range(...species.size);
      const spot = findSpot(species, size);
      if (!spot) continue;
      const choices = spot.shelf ? species.plateVarieties : species.standingVarieties ?? geometries.map((_, i) => i);
      const variety = choices[Math.floor(rand.next() * choices.length)];

      // Lean partway toward the surface it grows on, then spin randomly around that axis.
      tiltTo.copy(UP).lerp(spot.normal, species.tilt).normalize();
      q.setFromUnitVectors(UP, tiltTo);
      spin.setFromAxisAngle(UP, rand.range(0, Math.PI * 2));
      q.multiply(spin);
      scale.set(size * rand.range(0.9, 1.1), size * rand.range(0.85, 1.15), size * rand.range(0.9, 1.1));
      spot.position.addScaledVector(spot.normal, -species.sink * size);
      matrix.compose(spot.position, q, scale);

      color.set(species.palette[Math.floor(rand.next() * species.palette.length)]);
      color.multiplyScalar(rand.range(0.85, 1.1));
      // Every coral is placed (so the random sequence, and therefore the reef, is identical in both
      // presets), but only a coralDensity fraction of them are kept for drawing on Low.
      const kept = rand.next() < preset.coralDensity;
      if (kept) instances[variety].push({ matrix: matrix.clone(), color: color.clone() });

      placed.push({ center: spot.position.clone(), radius: size * 0.5 });
      if (kept && species.solid > 0) {
        colliders.push({ center: spot.position.clone().addScaledVector(tiltTo, size * 0.3), radius: size * species.solid * 0.5 });
      }
    }

    geometries.forEach((geometry, i) => {
      const list = instances[i];
      if (list.length === 0) return;
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((inst, k) => {
        mesh.setMatrixAt(k, inst.matrix);
        mesh.setColorAt(k, inst.color);
      });
      mesh.castShadow = preset.shadows && species.material.sway === undefined;
      mesh.receiveShadow = preset.shadows;
      mesh.computeBoundingSphere();
      group.add(mesh);
    });
  }

  group.add(createSeagrassMeadow(preset, rockField, rand, fbm));

  return {
    group,
    colliders,

    // Push a sphere (the diver) out of any coral it overlaps.
    collide(position, radius) {
      let pushed = false;
      for (const c of colliders) {
        const min = c.radius + radius;
        const d2 = position.distanceToSquared(c.center);
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-6;
        position.sub(c.center).multiplyScalar(min / d).add(c.center);
        pushed = true;
      }
      return pushed;
    },
  };
}

// Seagrass grows in patches on open sand: a noise field decides where the meadows are.
function createSeagrassMeadow(preset, rockField, rand, fbm) {
  const geometry = createSeagrassGeometry();
  const material = createCoralMaterial(preset, { sway: 0.16, translucent: false, doubleSided: true });
  const greens = ['#5c9a3c', '#7eae48', '#4b8a48', '#8cbc58', '#6a9f3a'].map((c) => new THREE.Color(c));
  const mesh = new THREE.InstancedMesh(geometry, material, SEAGRASS_FULL);
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const UP = new THREE.Vector3(0, 1, 0);

  let placed = 0;
  // Same idea as coral: place the full meadow, but Low only draws the first seagrassCount blades,
  // which are scattered evenly through it (they're in random order).
  for (let attempt = 0; placed < SEAGRASS_FULL && attempt < SEAGRASS_FULL * 30; attempt++) {
    const x = rand.range(-14, 14);
    const z = rand.range(-20, 20);
    const meadow = fbm(x * 0.13, 4.2, z * 0.13, 3) + (z > 8 && Math.abs(x) < 4 ? 0.25 : 0); // lush foreground channel
    if (meadow < 0.08 + rand.next() * 0.15) continue;
    pos.set(x, groundHeightAt(x, z) - 0.03, z);
    if (rockField.distanceTo(pos, 1) < 0.25) continue;
    const height = rand.range(0.25, 0.75) * (0.7 + meadow);
    q.setFromAxisAngle(UP, rand.range(0, Math.PI * 2));
    scale.set(rand.range(0.8, 1.4), height, 1);
    matrix.compose(pos, q, scale);
    mesh.setMatrixAt(placed, matrix);
    color.copy(greens[Math.floor(rand.next() * greens.length)]).multiplyScalar(rand.range(0.8, 1.15));
    mesh.setColorAt(placed, color);
    placed++;
  }
  mesh.count = Math.min(placed, preset.seagrassCount); // draw only this many blades
  mesh.receiveShadow = preset.shadows;
  mesh.computeBoundingSphere();
  return mesh;
}
