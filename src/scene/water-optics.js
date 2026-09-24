import * as THREE from 'three';
import { waterColorGlsl } from '../shaders/water-color.glsl.js';

// The open water you see where there's nothing in the way: a huge ball around the camera,
// painted from the inside with the same water-color function the fog uses.

export const SUN_DIRECTION = new THREE.Vector3(0.25, 1, 0.35).normalize();

export function createWaterBackdrop(radius) {
  const material = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorldPos;
      ${waterColorGlsl}
      void main() {
        vec3 dir = normalize(vWorldPos - cameraPosition);
        gl_FragColor = vec4(waterColor(dir, max(-cameraPosition.y, 0.0)) + waterDither(), 1.0);
      }
    `,
    side: THREE.BackSide, // we're inside the ball, so draw its inner faces
    depthWrite: false,
    toneMapped: false, // waterColor already returns final screen colors
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  mesh.renderOrder = -1; // draw first; everything else paints over it
  mesh.frustumCulled = false;

  return {
    mesh,
    // The ball travels with the camera, so you can never swim up to its edge.
    update(camera) {
      mesh.position.copy(camera.position);
    },
  };
}

// Light that matches the water: a hemisphere light (bright from above, dim blue-green from below)
// for soft all-around light, plus a directional "sun" for shading and highlights.
export function createWaterLights() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#c4f2ff', '#1c4d58', 1.5));
  const sun = new THREE.DirectionalLight('#fff3d6', 2.4);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(30);
  group.add(sun);
  return group;
}
