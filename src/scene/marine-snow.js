import * as THREE from 'three';
import { createRandom } from './random.js';

// "Marine snow": the tiny specks of plankton and sediment drifting in all real seawater. They're what
// make water feel like a substance you're moving through instead of empty air: as you swim, nearby
// specks slide past quickly and far ones slowly (parallax), which your brain reads as motion and depth.
//
// Each speck is one point (a tiny screen-facing square drawn by the GPU). They fill a 16 m box that
// wraps around the camera, and every position is computed in the shader from its start position plus
// a slow drift over time, so the CPU does no per-speck work at all.

const BOX = 16;

export function createMarineSnow(count) {
  const rand = createRandom(707);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([rand.range(0, BOX), rand.range(0, BOX), rand.range(0, BOX)], i * 3);
    seeds[i] = rand.next();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uPixelScale;
      varying float vAlpha;
      const float BOX = ${BOX.toFixed(1)};
      void main() {
        // Slow drift with a little wobble, then wrap into the box around the camera.
        vec3 p = position + vec3(0.05, -0.03, 0.04) * uTime
               + 0.15 * vec3(sin(uTime * 0.3 + aSeed * 30.0), sin(uTime * 0.23 + aSeed * 20.0), cos(uTime * 0.27 + aSeed * 10.0));
        p = mod(p - cameraPosition + BOX * 0.5, BOX) - BOX * 0.5 + cameraPosition;
        p.y = min(p.y, -0.2); // stay in the water
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        // Fade out near the box edge (so wrapping is invisible) and right at the lens.
        vAlpha = smoothstep(BOX * 0.5, BOX * 0.3, length(p - cameraPosition)) * smoothstep(0.15, 0.6, dist);
        vAlpha *= 0.35 + 0.65 * aSeed;
        gl_PointSize = uPixelScale * (0.01 + 0.02 * aSeed) / max(dist, 0.1); // real size in meters → pixels
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0; // round speck, soft edge
        float a = (1.0 - smoothstep(0.3, 1.0, d)) * vAlpha * 0.8;
        gl_FragColor = vec4(vec3(0.85, 0.95, 0.9), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 11;

  return {
    mesh: points,
    update(time, renderer, camera) {
      material.uniforms.uTime.value = time;
      // Point sizes are in pixels. This factor converts "meters at 1 m away" to pixels for the current
      // screen height and field of view, so specks look the same size at any resolution.
      material.uniforms.uPixelScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    },
  };
}
