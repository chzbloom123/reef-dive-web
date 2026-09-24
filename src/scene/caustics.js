import * as THREE from 'three';
import { SUN_DIRECTION } from './sun.js';
import { createRandom } from './random.js';

// Caustics: the bright, wobbling net of light on a shallow seabed. Real caustics come from surface
// waves focusing sunlight like thousands of moving lenses. Simulating that is expensive, so we fake it:
//
//   1. Take each point's world position and slide it along the sun's direction onto a flat plane,
//      so the pattern falls across surfaces the way sunlight does (and stretches down steep walls).
//   2. Draw a "cellular" pattern there: scatter moving points and light up the borders between
//      their cells. Cell borders look strikingly like caustic lines. Two layers crossing (High)
//      look even more like it.
//   3. Add it as extra sunlight: only on surfaces facing the sun, strongest in the shallows, fading
//      with depth and distance.
//
// Instead of writing new materials, we patch this into the existing ones (rock, sand, coral, fish, turtle).
//
// Two versions:
//   High: the cell pattern is computed live per pixel, two layers deep (rich, but ~18 cell checks per pixel).
//   Low:  the pattern is baked ONCE into a small tiling image at load time; each pixel then just reads
//         two sliding copies of it and combines them. Two texture reads instead of 18 cell checks,
//         and it still shimmers because the two copies drift in different directions.

export const causticUniforms = {
  uCausticTime: { value: 0 },
  uCausticSun: { value: new THREE.Vector3() }, // sun direction in camera space, updated each frame
  uCausticMap: { value: null }, // Low only: the baked pattern
};

// Bake a tiling caustic-net image on the CPU: the same "borders between cells" idea as the shader,
// with the cell grid wrapping around so the image repeats seamlessly.
function bakeCausticTexture() {
  const SIZE = 256;
  const CELLS = 8;
  const rand = createRandom(808);
  const points = [];
  for (let i = 0; i < CELLS * CELLS; i++) points.push([rand.next(), rand.next()]);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * CELLS;
      const v = (y / SIZE) * CELLS;
      const cx = Math.floor(u);
      const cy = Math.floor(v);
      let d1 = 9;
      let d2 = 9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox;
          const gy = cy + oy;
          const [px, py] = points[((gy + CELLS) % CELLS) * CELLS + ((gx + CELLS) % CELLS)];
          const d = Math.hypot(gx + 0.1 + px * 0.8 - u, gy + 0.1 + py * 0.8 - v);
          if (d < d1) [d1, d2] = [d, d1];
          else if (d < d2) d2 = d;
        }
      }
      const t = Math.min(Math.max((d2 - d1) / 0.22, 0), 1);
      const line = 1 - t * t * (3 - 2 * t);
      const i = (y * SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(line * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, SIZE, SIZE);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

const causticGlsl = (layers) => /* glsl */ `
uniform float uCausticTime;
uniform vec3 uCausticSun;
${layers === 1 ? 'uniform sampler2D uCausticMap;' : ''}

// Pseudo-random 2D point per grid cell (a "hash without sine", after Dave Hoskins, MIT license).
vec2 causticHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Brightness 0..1: high along the borders between cells of wandering points.
float causticLayer(vec2 uv, float t) {
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 h = causticHash(cell + g);
      vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * h);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return 1.0 - smoothstep(0.0, 0.2, d2 - d1);
}

float causticAt(vec3 wp) {
  // Slide the point along the sunlight direction to the plane y = 0.
  vec2 uv = (wp.xz - wp.y * vec2(${(SUN_DIRECTION.x / SUN_DIRECTION.y).toFixed(4)}, ${(SUN_DIRECTION.z / SUN_DIRECTION.y).toFixed(4)})) * 1.25;
  // Wobble the lookup position so the cell borders bend into wavy lines instead of straight-edged tiles.
  uv += 0.22 * sin(uv.yx * 2.7 + uCausticTime * vec2(0.7, 0.9));
  ${
    layers > 1
      ? `float c = causticLayer(uv, uCausticTime * 0.9);
  c = c * 0.45 + c * causticLayer(uv * 1.37 + 5.7, uCausticTime * 1.15) * 0.9;`
      : `vec2 tuv = uv / 8.0; // the baked tile holds 8 x 8 cells
  float a = texture2D(uCausticMap, tuv + uCausticTime * vec2(0.011, 0.007)).r;
  float b = texture2D(uCausticMap, tuv * 1.27 + vec2(0.37, 0.61) - uCausticTime * vec2(0.008, 0.012)).r;
  float c = a * b * 1.3 + max(a, b) * 0.3; // brightest where the two drifting nets cross`
  }
  return c;
}
`;

const applyGlsl = /* glsl */ `
#ifdef USE_FOG
{
  float causticDepth = max(-vFogWorldPos.y, 0.0);
  float causticFade = exp(-causticDepth * 0.07) * smoothstep(28.0, 6.0, length(vFogWorldPos - cameraPosition));
  float facingSun = max(dot(normal, uCausticSun), 0.0);
  reflectedLight.directDiffuse += diffuseColor.rgb * causticAt(vFogWorldPos) * facingSun * causticFade * 2.2;
}
#endif
`;

// Add caustics to every lit material in the scene (built-in materials only; our custom shaders for
// water and backdrop don't have lighting to add to).
export function installCaustics(root, preset) {
  const layers = preset.causticLayers;
  if (layers === 1 && !causticUniforms.uCausticMap.value) causticUniforms.uCausticMap.value = bakeCausticTexture();
  const patched = new Set();
  root.traverse((object) => {
    const material = object.material;
    if (!material || patched.has(material) || material.isShaderMaterial) return;
    patched.add(material);
    const previous = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      previous?.call(material, shader, renderer); // keep any earlier patch (coral sway, fish wiggle...)
      shader.uniforms.uCausticTime = causticUniforms.uCausticTime;
      shader.uniforms.uCausticSun = causticUniforms.uCausticSun;
      shader.uniforms.uCausticMap = causticUniforms.uCausticMap;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${causticGlsl(layers)}`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${applyGlsl}`);
    };
    material.customProgramCacheKey = () => `${previousKey()}|caustics${layers}`;
    material.needsUpdate = true;
  });
}

export function updateCaustics(time, camera) {
  causticUniforms.uCausticTime.value = time;
  camera.updateMatrixWorld(); // make sure the camera-space conversion uses this frame's camera
  causticUniforms.uCausticSun.value.copy(SUN_DIRECTION).transformDirection(camera.matrixWorldInverse);
}
