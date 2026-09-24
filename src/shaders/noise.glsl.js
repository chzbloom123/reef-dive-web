// Smooth 3D "value noise" for shaders, the GPU cousin of src/scene/noise.js.
// Each whole-number grid corner gets a pseudo-random value from a hash (a scrambling formula),
// and points in between blend smoothly between the eight surrounding corners.

export const valueNoiseGlsl = /* glsl */ `
float reefHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float reefNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(reefHash(i), reefHash(i + vec3(1, 0, 0)), f.x),
        mix(reefHash(i + vec3(0, 1, 0)), reefHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(reefHash(i + vec3(0, 0, 1)), reefHash(i + vec3(1, 0, 1)), f.x),
        mix(reefHash(i + vec3(0, 1, 1)), reefHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
`;
