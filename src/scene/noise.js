import { createRandom } from './random.js';

// "Gradient noise" (Ken Perlin's improved noise): a smooth random-looking field.
// Unlike Math.random(), nearby inputs give nearby outputs, so it makes natural shapes such as
// rolling sand, lumpy rock, and blotchy algae. Almost every procedural asset in this project starts here.
//
// Layering several copies at doubling frequency and halving strength ("fractal" noise, fbm) adds
// detail at every scale, like a coastline that stays wiggly however closely you zoom in.

export function createNoise(seed = 1) {
  const rand = createRandom(seed);
  const table = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand.next() * (i + 1));
    [table[i], table[j]] = [table[j], table[i]];
  }
  const perm = new Uint16Array(512);
  for (let i = 0; i < 512; i++) perm[i] = table[i & 255];

  // This function runs millions of times while the reef is generated, so it's written for speed:
  // no helper functions created per call, and plain arithmetic instead of array lookups where possible.
  function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  }

  // Returns roughly -1..1. With 'period' set, the pattern repeats every 'period' units
  // (used to make textures that tile without visible seams).
  function noise3(x, y, z, period = 256) {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    let X0, Y0, Z0, X1, Y1, Z1;
    if (period === 256) {
      X0 = fx & 255;
      Y0 = fy & 255;
      Z0 = fz & 255;
      X1 = (fx + 1) & 255;
      Y1 = (fy + 1) & 255;
      Z1 = (fz + 1) & 255;
    } else {
      X0 = (((fx % period) + period) % period) & 255;
      Y0 = (((fy % period) + period) % period) & 255;
      Z0 = (((fz % period) + period) % period) & 255;
      X1 = (((fx + 1) % period) + period) % period & 255;
      Y1 = (((fy + 1) % period) + period) % period & 255;
      Z1 = (((fz + 1) % period) + period) % period & 255;
    }
    x -= fx;
    y -= fy;
    z -= fz;
    const u = x * x * x * (x * (x * 6 - 15) + 10); // smooth "fade" curve
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);

    const A0 = perm[X0] + Y0;
    const A1 = perm[X1] + Y0;
    const B0 = perm[X0] + Y1;
    const B1 = perm[X1] + Y1;
    const g000 = grad(perm[perm[A0] + Z0], x, y, z);
    const g100 = grad(perm[perm[A1] + Z0], x - 1, y, z);
    const g010 = grad(perm[perm[B0] + Z0], x, y - 1, z);
    const g110 = grad(perm[perm[B1] + Z0], x - 1, y - 1, z);
    const g001 = grad(perm[perm[A0] + Z1], x, y, z - 1);
    const g101 = grad(perm[perm[A1] + Z1], x - 1, y, z - 1);
    const g011 = grad(perm[perm[B0] + Z1], x, y - 1, z - 1);
    const g111 = grad(perm[perm[B1] + Z1], x - 1, y - 1, z - 1);

    const x00 = g000 + u * (g100 - g000);
    const x10 = g010 + u * (g110 - g010);
    const x01 = g001 + u * (g101 - g001);
    const x11 = g011 + u * (g111 - g011);
    const y0 = x00 + v * (x10 - x00);
    const y1 = x01 + v * (x11 - x01);
    return y0 + w * (y1 - y0);
  }

  // Fractal noise: 'octaves' layers, each twice as detailed and half as strong. Returns roughly -1..1.
  function fbm(x, y, z, octaves = 4, period = 256) {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise3(x * freq, y * freq, z * freq, period === 256 ? 256 : period * freq); // tiling textures scale the period with each layer
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { noise3, fbm };
}
