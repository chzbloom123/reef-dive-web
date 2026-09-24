import * as THREE from 'three';
import { createRandom } from './random.js';
import { SUN_DIRECTION } from './sun.js';

// Light shafts ("god rays"): long, soft, glowing strips hanging down from the surface along the
// sunlight direction. Real ones are sunlight scattering off particles in the water; rendering that
// properly (volumetric lighting) is expensive, so these are fakes:
//
//   - each shaft is one flat strip, always turned to face the camera around its own long axis
//   - it's drawn "additively" (its color is added to what's behind, so overlaps glow brighter)
//   - it fades at its edges, fades out with depth, and slowly flickers like light through moving waves
//   - the shafts live in a 40 m tile that follows the diver, so there are always some around you
//
// All of that happens in the vertex and fragment shaders; the CPU only updates the time.

const TILE = 30;

export function createLightShafts(count) {
  const rand = createRandom(606);
  const strip = new THREE.PlaneGeometry(1, 1, 1, 8);
  strip.translate(0, -0.5, 0); // y from 0 (top, at the surface) down to -1

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = strip.index;
  geometry.setAttribute('position', strip.attributes.position);
  geometry.setAttribute('uv', strip.attributes.uv);
  // Per shaft: x and z within the tile, width, and a random seed for its flicker.
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    data.set([rand.range(0, TILE), rand.range(0, TILE), rand.range(0.6, 2.6), rand.next()], i * 4);
  }
  geometry.setAttribute('aShaft', new THREE.InstancedBufferAttribute(data, 4));
  geometry.instanceCount = count;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSun: { value: SUN_DIRECTION.clone() },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aShaft;
      uniform vec3 uSun;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      const float TILE = ${TILE.toFixed(1)};
      const float LENGTH = 24.0;
      void main() {
        // Wrap this shaft's spot in the tile around the camera, so shafts are always nearby.
        vec2 rel = mod(aShaft.xy - cameraPosition.xz + TILE * 0.5, TILE) - TILE * 0.5;
        vec3 top = vec3(cameraPosition.x + rel.x, 0.0, cameraPosition.z + rel.y);
        vec3 down = -uSun;
        // Turn the strip to face the camera around its own axis ("cylindrical billboard").
        vec3 side = normalize(cross(down, normalize(cameraPosition - top)));
        float along = -position.y;                      // 0 at the surface … 1 at the far end
        float width = aShaft.z * (1.0 + along * 0.8);   // shafts spread out as they descend
        vec3 world = top + down * (along * LENGTH) + side * (position.x * width);

        float dist = length(world - cameraPosition);
        // Fade far shafts (the water haze) and very near ones (a flat strip right in your face looks fake).
        vFade = smoothstep(34.0, 10.0, dist) * smoothstep(1.0, 4.0, dist);
        vUv = vec2(uv.x, along);
        vSeed = aShaft.w;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying float vSeed;
      varying float vFade;
      void main() {
        float across = pow(1.0 - abs(vUv.x * 2.0 - 1.0), 1.8);           // soft edges
        float along = smoothstep(0.0, 0.04, vUv.y) * pow(1.0 - vUv.y, 0.9); // bright near the top, reaching down
        float flicker = 0.55 + 0.45 * sin(uTime * 0.6 + vSeed * 40.0) * sin(uTime * 0.23 + vSeed * 17.0);
        float strength = across * along * flicker * vFade * 0.3;
        gl_FragColor = vec4(vec3(0.72, 0.95, 1.0) * strength, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending, // add light rather than cover what's behind
    depthWrite: false, // shafts don't hide each other
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // positions are computed in the shader, so three.js can't know the bounds
  mesh.renderOrder = 10; // after solid objects

  return {
    mesh,
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}
