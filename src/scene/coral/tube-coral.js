import * as THREE from 'three';
import { createRandom } from '../random.js';
import { paint, mergeParts, orientAlong, segment } from './geometry-kit.js';

// Tube sponges: a cluster of hollow, open-topped tubes of different heights, leaning slightly outward.
// Each tube is an outer wall plus a darker inner wall, so you can see into the dark opening.
// About 1 unit tall; each copy is scaled.

export function createTubeCoralGeometry(seed) {
  const rand = createRandom(seed);
  const parts = [];
  const tubes = Math.round(rand.range(4, 8));
  for (let i = 0; i < tubes; i++) {
    const angle = rand.range(0, Math.PI * 2);
    const dist = i === 0 ? 0 : rand.range(0.08, 0.2);
    const base = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    const dir = new THREE.Vector3(Math.cos(angle) * dist * 1.5, 1, Math.sin(angle) * dist * 1.5).normalize();
    const height = rand.range(0.45, 1);
    const radius = rand.range(0.06, 0.1);
    const outer = orientAlong(segment(radius * 0.85, radius * 1.1, height, 10), base, dir);
    parts.push(paint(outer, (x, y) => 0.6 + 0.5 * Math.min(y / height, 1)));
    const inner = orientAlong(segment(radius * 0.7, radius * 0.92, height * 0.98, 10), base, dir);
    parts.push(paint(inner, () => 0.22));
  }
  return mergeParts(parts);
}
