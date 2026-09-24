// The shape of the seabed as a function: give it (x, z), get back the ground height y.
// Rendering and collision both ask this one function, so what you see and what you bump into agree.
//
// Profile along the reef (z axis), matching the layout in viewpoints.js:
//   z = +14 (shallow end)  ~6 m deep
//   z =   0 (middle)       ~10 m
//   z = -14 (deep edge)    ~18 m, then the bottom falls away into the haze
// Milestone 2 adds rocky outcrops that rise to within ~3 m of the surface.

function smoothstep(a, b, t) {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
}

export function seabedDepthAt(x, z) {
  const t = Math.min(Math.max((14 - z) / 28, 0), 1);
  let depth = 6 + 8 * t + 4 * smoothstep(0.7, 1, t);
  if (z < -14) depth = 18 + Math.min((-14 - z) * 1.1, 10);
  // Gentle sand ripples so the floor isn't a perfect ramp.
  depth += Math.sin(x * 0.45 + z * 0.12) * 0.25 + Math.sin(z * 0.6 - x * 0.2) * 0.15;
  return depth;
}

export function groundHeightAt(x, z) {
  return -seabedDepthAt(x, z);
}
