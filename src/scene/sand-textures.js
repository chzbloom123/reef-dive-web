import * as THREE from 'three';
import { createNoise } from './noise.js';
import { createRandom } from './random.js';

// Two small images generated in code instead of downloaded:
//   color map:  grainy sand with faint light/dark ripple crests
//   normal map: stores which way each pixel "faces", so flat triangles light up as if rippled.
// A normal map fakes bumpy detail for almost no cost: the shape stays flat, only the lighting changes.
//
// Both tile seamlessly: every wave and noise pattern repeats exactly across the image, so copies
// placed edge to edge line up.

const SIZE = 256;
// Ripple crests per tile, across (u) and along (v). Whole numbers, so the waves line up at the tile edges.
const RIPPLES_U = 2;
const RIPPLES_V = 7;

export function createSandTextures(maxAnisotropy) {
  const { fbm } = createNoise(47);
  const rand = createRandom(47);
  const height = new Float32Array(SIZE * SIZE);
  const color = new Uint8Array(SIZE * SIZE * 4);
  const normal = new Uint8Array(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      // Ripples: parallel waves, bent by noise so they wander like real sand ripples.
      const warp = fbm(u * 4, v * 4, 0.5, 3, 4);
      const phase = u * RIPPLES_U + v * RIPPLES_V + warp * 1.2;
      const ripple = Math.pow(0.5 + 0.5 * Math.sin(phase * Math.PI * 2), 1.6);
      height[y * SIZE + x] = ripple;

      const blotch = fbm(u * 8, v * 8, 3.7, 3, 8);
      const grain = rand.next() * 0.12; // per-pixel sparkle of individual grains
      const shade = 0.82 + blotch * 0.12 + ripple * 0.08 + grain;
      const i = (y * SIZE + x) * 4;
      color[i] = Math.min(255, 236 * shade);
      color[i + 1] = Math.min(255, 220 * shade);
      color[i + 2] = Math.min(255, 182 * shade);
      color[i + 3] = 255;
    }
  }

  // Normal from the slope of the height map (difference between neighbors, wrapping at the edges).
  const strength = 2.2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const h = (xx, yy) => height[((yy + SIZE) % SIZE) * SIZE + ((xx + SIZE) % SIZE)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      normal[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      normal[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      normal[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal[i + 3] = 255;
    }
  }

  const make = (data, colorSpace) => {
    const tex = new THREE.DataTexture(data, SIZE, SIZE);
    tex.colorSpace = colorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // Mipmaps are pre-shrunk copies used for distant sand, so far-away ripples blend smoothly instead of shimmering.
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = maxAnisotropy; // keeps sand sharp at grazing angles (High preset)
    tex.needsUpdate = true;
    return tex;
  };

  return {
    map: make(color, THREE.SRGBColorSpace),
    normalMap: make(normal, THREE.NoColorSpace),
  };
}
