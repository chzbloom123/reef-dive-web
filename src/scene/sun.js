import * as THREE from 'three';

// Where the sun is: the single source of truth for every lighting effect (sun light, shadows, the
// glow in the water, caustics, light shafts, the Snell's window glare). It's high in the sky and a bit
// toward the deep end (-z), so looking down the reef from the shallows you face into the light,
// like the reference image.
export const SUN_DIRECTION = new THREE.Vector3(0.12, 1, -0.4).normalize();

// The same direction written as GLSL source text, for shaders that need it as a constant.
export const SUN_GLSL = `vec3(${SUN_DIRECTION.x.toFixed(5)}, ${SUN_DIRECTION.y.toFixed(5)}, ${SUN_DIRECTION.z.toFixed(5)})`;
