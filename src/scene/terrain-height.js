import { createNoise } from './noise.js';

// The shape of the seabed as a function: give it (x, z), get back the ground height y.
// Rendering and collision both ask this one function, so what you see and what you bump into agree.
//
// Profile along the reef (z axis), matching the layout in viewpoints.js:
//   z = +14 (shallow end)  ~8 m deep
//   z =   0 (middle)       ~11 m
//   z = -14 (deep edge)    ~18 m, then the bottom falls away into the haze
// Rock pinnacles (rock-field.js) rise from this floor to within ~3.5 m of the surface.

const { fbm } = createNoise(11);

function smoothstep(a, b, t) {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
}

export function seabedDepthAt(x, z) {
  const t = Math.min(Math.max((14 - z) / 28, 0), 1);
  let depth = 8 + 6 * t + 4 * smoothstep(0.7, 1, t);
  // Past the deep edge the floor keeps falling, easing out around 26 m.
  if (z < -14) depth = 18 + 8 * (1 - Math.exp((z + 14) * 0.18));
  // Broad sandy mounds and hollows. The fine ripples are a texture on the sand, not geometry.
  depth -= fbm(x * 0.07, 0.5, z * 0.07, 3) * 1.0;
  return depth;
}

export function groundHeightAt(x, z) {
  return -seabedDepthAt(x, z);
}
