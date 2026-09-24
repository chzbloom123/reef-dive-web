import * as THREE from 'three';
import { createRandom } from '../random.js';
import { paint, mergeParts } from './geometry-kit.js';

// Sea anemone: a short fleshy column topped with rings of tentacles that sway in the current.
// Unlike the corals, the colors are painted right into the geometry (a red column with pale pink
// tentacles, say), because one copy needs two different colors. Each copy then only nudges the tint.

const PALETTES = [
  { column: '#c8323c', tentacle: '#f6d6de', tip: '#ff9fc0' },
  { column: '#7a3fa0', tentacle: '#e7d2f5', tip: '#c89cff' },
  { column: '#d77a2a', tentacle: '#fff0c8', tip: '#ffd36b' },
];

export function createAnemoneGeometry(variant, seed) {
  const rand = createRandom(seed);
  const pal = PALETTES[variant % PALETTES.length];
  const column = new THREE.Color(pal.column);
  const tentacle = new THREE.Color(pal.tentacle);
  const tip = new THREE.Color(pal.tip);
  const parts = [];
  const c = new THREE.Color();

  const body = new THREE.CylinderGeometry(0.15, 0.19, 0.1, 14, 1, false);
  body.translate(0, 0.05, 0);
  parts.push(paint(body, (x, y) => c.copy(column).multiplyScalar(0.6 + 4 * y).clone()));

  // Rings of tentacles: outer ones lean far out, inner ones stand up. Each one is a tapered cone
  // bent into a gentle outward curl, like a fluffy anemone rather than a spiky urchin.
  const rings = [
    { count: 26, radius: 0.13, tilt: 1.0 },
    { count: 18, radius: 0.085, tilt: 0.6 },
    { count: 10, radius: 0.04, tilt: 0.25 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const a = (i / ring.count) * Math.PI * 2 + rand.range(-0.12, 0.12);
      const len = 0.24 * rand.range(0.8, 1.15);
      const cone = new THREE.ConeGeometry(0.026, len, 5, 4, true);
      cone.translate(0, len / 2, 0);
      const pos = cone.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const t = pos.getY(k) / len;
        pos.setX(k, pos.getX(k) + 0.45 * len * t * t); // curl outward toward the tip
      }
      paint(
        cone,
        (x, y) => c.copy(tentacle).lerp(tip, THREE.MathUtils.smoothstep(y / len, 0.55, 1)).clone(),
        (x, y) => y / len, // sway weight: 0 at the root, 1 at the tip
      );
      cone.computeVertexNormals();
      cone.rotateZ(-ring.tilt * rand.range(0.8, 1.1)); // lean outward (toward +x)...
      cone.rotateY(-a); // ...then turn so "outward" points away from the center
      cone.translate(Math.cos(a) * ring.radius, 0.09, Math.sin(a) * ring.radius);
      parts.push(cone);
    }
  }
  return mergeParts(parts);
}
