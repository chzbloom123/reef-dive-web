import * as THREE from 'three';
import { paint } from './geometry-kit.js';

// One seagrass blade: a narrow strip, 1 unit tall, tapering and curving slightly toward the tip.
// Thousands of copies of this one strip make a meadow (instancing), each with its own height,
// direction, and shade of green. The shader bends them in the current (sway = 0 at root, 1 at tip).

export function createSeagrassGeometry() {
  const geo = new THREE.PlaneGeometry(0.035, 1, 1, 5);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - 0.65 * y)); // taper
    pos.setZ(i, 0.12 * y * y); // natural curve
  }
  geo.deleteAttribute('uv');
  geo.computeVertexNormals();
  return paint(
    geo,
    (x, y) => 0.45 + 0.7 * y, // dark at the root, bright at the tip
    (x, y) => y,
  );
}
