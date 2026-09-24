import * as THREE from 'three';
import { createRandom } from '../random.js';
import { paint, mergeParts, orientAlong, segment, UP } from './geometry-kit.js';

// Branching coral, grown like a tree: each branch splits into 2–3 thinner, shorter branches that
// angle away from their parent but keep reaching upward toward the light. This is "recursion": the
// grow() function calls itself for each child, stopping after a few generations.
//
//            \ | /  \ /          tips: pale, where new growth happens
//             \|/    |
//              \    /
//               \  /             each generation ~75% as long and ~70% as thick
//                \/
//
// Styles: 'staghorn' = long antler-like branches; 'bushy' = a tight rounded clump of short fingers.

const STYLES = {
  staghorn: { trunks: [4, 6], length: 0.34, radius: 0.045, depth: 2, spread: 0.55, turn: [0.35, 0.8], upward: 0.35 },
  bushy: { trunks: [8, 11], length: 0.2, radius: 0.05, depth: 2, spread: 0.9, turn: [0.3, 0.7], upward: 0.5 },
};

export function createBranchingCoralGeometry(style, seed) {
  const s = STYLES[style];
  const rand = createRandom(seed);
  const parts = [];
  const tipSides = style === 'bushy' ? 5 : 6;

  function grow(start, dir, length, radius, generation, maxGen) {
    const end = start.clone().addScaledVector(dir, length);
    const shade = 0.75 + 0.35 * (generation / maxGen); // paler toward the tips
    // Extend each segment slightly past its end so joints overlap instead of showing gaps.
    const piece = orientAlong(segment(radius, radius * 0.78, length + radius * 0.6, 6), start, dir);
    parts.push(paint(piece, () => shade));

    if (generation >= maxGen) {
      const tip = new THREE.SphereGeometry(radius * 0.85, tipSides, 3);
      tip.translate(end.x, end.y, end.z);
      parts.push(paint(tip, () => 1.2));
      return;
    }
    const children = rand.next() < 0.6 ? 2 : 3;
    for (let i = 0; i < children; i++) {
      // Tilt away from the parent by a random angle around a random axis, then bias upward.
      const axis = new THREE.Vector3(rand.range(-1, 1), 0, rand.range(-1, 1)).cross(dir).normalize();
      const childDir = dir.clone().applyAxisAngle(axis, rand.range(...s.turn)).addScaledVector(UP, s.upward).normalize();
      grow(end, childDir, length * rand.range(0.68, 0.85), radius * 0.7, generation + 1, maxGen);
    }
  }

  const trunks = Math.round(rand.range(...s.trunks));
  for (let i = 0; i < trunks; i++) {
    const angle = (i / trunks) * Math.PI * 2 + rand.range(-0.3, 0.3);
    const dir = new THREE.Vector3(Math.cos(angle) * s.spread, 1, Math.sin(angle) * s.spread).normalize();
    grow(new THREE.Vector3(0, -0.02, 0), dir, s.length * rand.range(0.8, 1.2), s.radius * rand.range(0.85, 1.15), 0, s.depth);
  }
  return mergeParts(parts);
}
