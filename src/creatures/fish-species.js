import * as THREE from 'three';
import { createFishGeometry } from './fish-geometry.js';

// The fish of this reef, matching the reference image. Each entry is a shape, a paint job, and a
// personality: how big, how fast, how tightly it schools, and where it likes to be.
//
// Paint functions receive (color, u, side, y, part, across):
//   u      0 at the nose → 1 at the tail stem (fins go a little past 1)
//   side   -1 belly … +1 back (how far round the body)
//   part   'body' | 'tail' | 'fin'
//   across -1 … +1 left/right; near ±1 is the flank, where eyes and stripes go

const hex = (c, value) => c.set(value);
const eye = (u, side, across) => u > 0.1 && u < 0.17 && side > 0.05 && side < 0.45 && Math.abs(across) > 0.55;

export const SPECIES = {
  // Blue-green chromis: small, fast, in big tight schools. Countershaded: dark back, pale belly.
  chromis: {
    share: 0.55,
    schools: 3,
    length: [0.1, 0.14],
    speed: [0.5, 1.4],
    neighborRadius: 0.9,
    separation: 0.22,
    cohesion: 1.0,
    alignment: 1.6,
    homeRadius: 3.5,
    beat: 5,
    shape: {
      height: 0.3,
      width: 0.12,
      tailLength: 0.28,
      tailSpread: 0.36,
      forked: true,
      dorsal: 0.05,
      paint(c, u, side, y, part, across) {
        if (eye(u, side, across)) return hex(c, '#101418');
        if (part !== 'body') return hex(c, '#4fb3c4');
        return c.set('#dff4f2').lerp(new THREE.Color('#2f9fb8'), THREE.MathUtils.smoothstep(side, -0.3, 0.5));
      },
    },
  },
  // Yellow tang: a bright yellow disc.
  yellowTang: {
    share: 0.14,
    schools: 2,
    length: [0.22, 0.3],
    speed: [0.25, 0.8],
    neighborRadius: 1.6,
    separation: 0.45,
    cohesion: 0.6,
    alignment: 0.8,
    homeRadius: 4,
    beat: 3,
    shape: {
      height: 0.8,
      width: 0.14,
      tailLength: 0.2,
      tailSpread: 0.36,
      dorsal: 0.14,
      paint(c, u, side, y, part, across) {
        if (eye(u, side, across)) return hex(c, '#161410');
        if (part === 'tail' && u > 1.2) return hex(c, '#ffe45c');
        const shade = 0.85 + 0.15 * side;
        return c.set('#ffd21a').multiplyScalar(shade);
      },
    },
  },
  // Blue tang: royal blue with a black swoosh and a yellow tail.
  blueTang: {
    share: 0.13,
    schools: 2,
    length: [0.24, 0.32],
    speed: [0.3, 0.9],
    neighborRadius: 1.6,
    separation: 0.45,
    cohesion: 0.6,
    alignment: 0.9,
    homeRadius: 4,
    beat: 3,
    shape: {
      height: 0.62,
      width: 0.14,
      tailLength: 0.22,
      tailSpread: 0.38,
      forked: true,
      dorsal: 0.1,
      paint(c, u, side, y, part, across) {
        if (eye(u, side, across)) return hex(c, '#0b0b12');
        if (part === 'tail') return hex(c, '#ffd52a');
        if (part === 'fin') return hex(c, '#10132a');
        // The "palette" mark: a dark band sweeping from behind the eye along the upper flank.
        const band = Math.abs(side - (0.35 - 0.25 * Math.sin(u * Math.PI))) < 0.2 && u > 0.2 && u < 0.92;
        if (band) return hex(c, '#0c0f22');
        return c.set('#1f4fe0').multiplyScalar(0.8 + 0.25 * side);
      },
    },
  },
  // Clownfish: orange with white bands edged in black. They don't school; each stays by its anemone.
  clownfish: {
    share: 0.1,
    schools: 0, // one "school" per anemone, created from the anemone list
    length: [0.13, 0.17],
    speed: [0.05, 0.35],
    neighborRadius: 0.5,
    separation: 0.12,
    cohesion: 0,
    alignment: 0,
    homeRadius: 0.35,
    beat: 4,
    shape: {
      height: 0.42,
      width: 0.18,
      tailLength: 0.2,
      tailSpread: 0.3,
      dorsal: 0.08,
      paint(c, u, side, y, part, across) {
        if (eye(u, side, across)) return hex(c, '#0a0a0a');
        if (part !== 'body') return u > 1.22 || part === 'fin' ? hex(c, '#161010') : hex(c, '#ff7a1a');
        for (const b of [0.22, 0.52, 0.86]) {
          const d = Math.abs(u - b);
          if (d < 0.05) return hex(c, '#fbfbf5');
          if (d < 0.07) return hex(c, '#141010');
        }
        return hex(c, '#ff7417');
      },
    },
  },
};

export function buildSpeciesGeometry(species) {
  return createFishGeometry(species.shape);
}
