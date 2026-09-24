import * as THREE from 'three';
import { createRandom } from '../scene/random.js';
import { SPECIES, buildSpeciesGeometry } from './fish-species.js';
import { createFishMaterial } from './fish-material.js';
import { createSchool, updateSchool, writeSchool } from './fish-school.js';
import { createTurtle } from './turtle.js';

// Everything that swims: schools of fish plus the sea turtle.
//
// Each species is ONE InstancedMesh holding all its fish across all its schools, so the whole fish
// population costs four draw calls. Every frame the schools are simulated on the CPU (cheap: a few
// hundred fish), then their positions are copied into the instance matrices for the GPU.

// Where each school hangs out (it wanders around this point). Chosen in open water near the viewpoints.
const SCHOOL_HOMES = {
  chromis: [
    [-0.5, -5.5, 7],
    [-1.5, -8.5, -5],
    [1.5, -10, -13],
  ],
  yellowTang: [
    [1.5, -7, 11],
    [-1.5, -8.5, 1],
  ],
  blueTang: [
    [-1, -6.5, 9.5],
    [2, -9, -6],
  ],
};

export function createSeaLife(preset, { rockField, reefLife }) {
  const rand = createRandom(303);
  const group = new THREE.Group();
  const material = createFishMaterial(preset);
  const populations = [];

  for (const [name, species] of Object.entries(SPECIES)) {
    const total = Math.max(2, Math.round(preset.fishCount * species.share));
    const schools = [];
    if (name === 'clownfish') {
      // Pairs of clownfish, each pair living in one anemone.
      const homes = reefLife.anemones.slice(0, Math.ceil(total / 2));
      for (const anemone of homes) {
        schools.push(createSchool({ species, members: 2, home: anemone.clone().add(new THREE.Vector3(0, 0.2, 0)), wander: 0, rand }));
      }
    } else {
      const homes = SCHOOL_HOMES[name];
      for (let i = 0; i < species.schools; i++) {
        const members = Math.round(total / species.schools);
        schools.push(createSchool({ species, members, home: new THREE.Vector3(...homes[i % homes.length]), wander: 3.5, rand }));
      }
    }
    const count = schools.reduce((n, s) => n + s.fish.length, 0);
    if (count === 0) continue;

    const mesh = new THREE.InstancedMesh(buildSpeciesGeometry(species), material, count);
    const swim = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2);
    swim.setUsage(THREE.DynamicDrawUsage); // tells WebGL this data changes every frame
    mesh.geometry.setAttribute('aSwim', swim);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; // fish move, so a bounding box computed once would go stale
    group.add(mesh);
    populations.push({ mesh, swim, schools });
  }

  const turtle = createTurtle(preset);
  group.add(turtle.object);

  return {
    group,
    turtle,
    update(dt, time, diverPosition) {
      const step = Math.min(dt, 0.05); // big frame hitches would make the flocking jump
      for (const pop of populations) {
        let offset = 0;
        for (const school of pop.schools) {
          updateSchool(school, step, time, { rockField, diverPosition });
          writeSchool(school, pop.mesh, pop.swim, offset);
          offset += school.fish.length;
        }
        pop.mesh.instanceMatrix.needsUpdate = true;
        pop.swim.needsUpdate = true;
      }
      turtle.update(time, dt);
    },
  };
}
