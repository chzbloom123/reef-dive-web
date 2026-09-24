import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise } from '../noise.js';
import { paint, mergeParts } from './geometry-kit.js';

// Brain coral: a lumpy dome, flat underneath where it sits on rock or sand.
// The famous meandering grooves are NOT in this geometry; the coral shader draws them per pixel
// (see "maze" in coral-material.js). Carving them from triangles would take 50x the geometry.
//
// Variants: 0 = single round dome, 1 = wide low dome, 2 = two fused domes.

export function createBrainCoralGeometry(variant, detail) {
  const { fbm } = createNoise(101 + variant);
  const dome = (squash, lumpSeed, offsetX = 0, scale = 1) => {
    const geo = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.multiplyScalar(1 + 0.1 * fbm(v.x * 1.5 + lumpSeed, v.y * 1.5, v.z * 1.5, 3));
      v.y = Math.max(v.y, -0.15) * squash; // flatten the bottom
      v.multiplyScalar(scale);
      v.x += offsetX;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return paint(geo, (x, y) => 0.55 + 0.45 * THREE.MathUtils.smoothstep(y, -0.15 * squash, 0.5 * squash));
  };

  if (variant === 1) return mergeParts([dome(0.5, 3, 0, 1.1)]);
  if (variant === 2) return mergeParts([dome(0.7, 5, -0.35, 0.75), dome(0.65, 9, 0.4, 0.7)]);
  return mergeParts([dome(0.75, 1)]);
}
