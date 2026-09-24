import * as THREE from 'three';
import { createMatteMaterial } from '../scene/materials.js';

// Fish material: an ordinary lit material plus a vertex-shader "wiggle", a sine wave that travels
// from head to tail, bending the body side to side. No skeleton or animation files are needed:
//
//   sideways shift = sin(swimPhase − wave × z) × amplitude × (small at the head, large at the tail)
//
// swimPhase advances every frame on the CPU at the fish's tail-beat rate (faster when it's swimming
// harder) and is handed to the GPU per fish in the 'aSwim' attribute: (phase, amplitude).

export function createFishMaterial(preset) {
  const material = createMatteMaterial(preset, { vertexColors: true, roughness: 0.45, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aSwim;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float along = clamp(0.5 - transformed.z, 0.0, 1.4); // 0 at the nose, 1 at the tail stem
        float bend = 0.12 + along * along;                     // the head barely moves; the tail sweeps
        transformed.x += sin(aSwim.x - transformed.z * 5.0) * aSwim.y * bend;`,
      );
    // The body normals should bend too; for a thin wiggle, tilting them by the same curve is plenty.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `#include <beginnormal_vertex>
      objectNormal.x -= cos(aSwim.x - position.z * 5.0) * aSwim.y * 5.0 * (0.12 + pow(clamp(0.5 - position.z, 0.0, 1.4), 2.0)) * objectNormal.z;`,
    );
  };
  material.customProgramCacheKey = () => 'fish';
  return material;
}
