import * as THREE from 'three';
import { createRandom } from '../random.js';
import { paint, mergeParts, segment } from './geometry-kit.js';

// Table and plate coral: a thin, wavy-edged disc.
//   'table'  sits on a short stalk, flat on top, like a garden table.
//   'plate'  has no stalk and a wavier rim; these grow as shelves out of rock walls.
//
// Built by hand as a grid in polar coordinates (rings × angles): a top surface, a bottom surface,
// and a rim strip joining them. Radius is 1; each copy is scaled to size.

const RINGS = 8;
const ANGLES = 36;

export function createTableCoralGeometry(style, seed) {
  const rand = createRandom(seed);
  const p1 = rand.range(0, 6);
  const p2 = rand.range(0, 6);
  const lobes = style === 'plate' ? 5 : 3;
  const edge = (a) => 1 + 0.12 * Math.sin(lobes * a + p1) + 0.07 * Math.sin(7 * a + p2);
  const bowl = style === 'plate' ? 0.12 : 0.05; // how much the rim lifts
  const ripple = style === 'plate' ? 0.07 : 0.03;
  const lift = style === 'table' ? 0.32 : 0;
  const thickness = 0.09;

  const surfaceY = (r, a) => lift + bowl * r * r + ripple * Math.sin(5 * a + p1) * r * r;

  const positions = [];
  const indices = [];
  const ringIndex = (layer, ring, angle) => layer * (RINGS + 1) * ANGLES + ring * ANGLES + (angle % ANGLES);
  for (const layer of [0, 1]) {
    for (let ring = 0; ring <= RINGS; ring++) {
      for (let j = 0; j < ANGLES; j++) {
        const a = (j / ANGLES) * Math.PI * 2;
        const r = (ring / RINGS) * edge(a);
        const y = surfaceY(r, a) - (layer === 1 ? thickness * (1 - 0.6 * (ring / RINGS)) : 0);
        positions.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
    }
  }
  for (let ring = 0; ring < RINGS; ring++) {
    for (let j = 0; j < ANGLES; j++) {
      const a = ringIndex(0, ring, j);
      const b = ringIndex(0, ring, j + 1);
      const c = ringIndex(0, ring + 1, j);
      const d = ringIndex(0, ring + 1, j + 1);
      indices.push(a, b, c, b, d, c); // top faces up
      const e = ringIndex(1, ring, j);
      const f = ringIndex(1, ring, j + 1);
      const g = ringIndex(1, ring + 1, j);
      const h = ringIndex(1, ring + 1, j + 1);
      indices.push(e, g, f, f, g, h); // bottom faces down (opposite winding)
    }
  }
  for (let j = 0; j < ANGLES; j++) {
    const t0 = ringIndex(0, RINGS, j);
    const t1 = ringIndex(0, RINGS, j + 1);
    const b0 = ringIndex(1, RINGS, j);
    const b1 = ringIndex(1, RINGS, j + 1);
    indices.push(t0, t1, b0, t1, b1, b0); // rim
  }

  const disc = new THREE.BufferGeometry();
  disc.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  disc.setIndex(indices);
  disc.computeVertexNormals();
  // Faint radial ridges on top, a pale growing rim, a shaded underside.
  paint(disc, (x, y, z) => {
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const top = y > surfaceY(r, a) - thickness * 0.5;
    if (!top) return 0.4;
    return 0.72 + 0.1 * Math.sin(a * 60) + 0.35 * THREE.MathUtils.smoothstep(r, 0.8, 1.05);
  });

  const parts = [disc];
  if (lift > 0) parts.push(paint(segment(0.12, 0.08, lift, 8), () => 0.55));
  return mergeParts(parts);
}
