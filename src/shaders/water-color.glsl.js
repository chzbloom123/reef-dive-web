// GLSL (the language shaders are written in) shared by the underwater fog and the water backdrop.
// Sharing one function guarantees that a far-away object fades into exactly the color of the
// open water behind it, so there's never a visible seam where the scene ends.
//
// These colors are applied at the very end of each pixel's shader, after tone mapping, so they
// are ordinary screen colors (0 = black, 1 = full brightness).

import { SUN_GLSL } from '../scene/sun.js';

export const waterColorGlsl = /* glsl */ `
// Sun direction (world space), from src/scene/sun.js.
const vec3 SUN_DIR = ${SUN_GLSL};

// How fast each color channel (red, green, blue) is lost per meter of water between you and an object.
// Red goes first, then green, and blue survives longest. That's why distant coral turns blue-green.
// With these values, almost everything is gone by about 30 m.
const vec3 VIEW_EXTINCTION = vec3(0.15, 0.1, 0.088);

// The same effect on sunlight traveling down from the surface to the object:
// deeper objects are dimmer and have lost more red, even up close.
const vec3 SUNLIGHT_EXTINCTION = vec3(0.035, 0.016, 0.01);

// Color of open water seen in direction 'dir' from a viewer at 'depth' meters.
vec3 waterColor(vec3 dir, float depth) {
  vec3 horizon = vec3(0.18, 0.6, 0.7);
  vec3 above = vec3(0.68, 0.94, 0.98);
  vec3 below = vec3(0.04, 0.24, 0.34);
  vec3 c = dir.y > 0.0
    ? mix(horizon, above, pow(dir.y, 1.3))
    : mix(horizon, below, pow(-dir.y, 0.7));

  // The deeper you are, the further the surface light has traveled to reach the water around you.
  c *= exp(-vec3(0.035, 0.02, 0.014) * depth);

  // Glow around the sun: a tight hot spot plus a wide soft halo.
  float s = max(dot(dir, SUN_DIR), 0.0);
  c += vec3(0.9, 0.95, 0.85) * (pow(s, 24.0) * 0.35 + pow(s, 4.0) * 0.12) * exp(-0.06 * depth);
  return c;
}

// Blend an object's color toward the water color, per channel, based on distance and depth.
vec3 applyWater(vec3 color, vec3 worldPos, vec3 camPos) {
  vec3 toFrag = worldPos - camPos;
  float dist = length(toFrag);
  vec3 dir = toFrag / max(dist, 1e-4);

  color *= exp(-SUNLIGHT_EXTINCTION * max(-worldPos.y, 0.0));
  vec3 transmittance = exp(-VIEW_EXTINCTION * dist); // Beer–Lambert law: light fades exponentially
  return mix(waterColor(dir, max(-camPos.y, 0.0)), color, transmittance);
}

// Tiny per-pixel noise. Smooth gradients like open water otherwise show visible "bands"
// because the screen only has 256 brightness steps per channel. Noise hides the steps.
float waterDither() {
  return (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}
`;
