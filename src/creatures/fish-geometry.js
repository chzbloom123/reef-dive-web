import * as THREE from 'three';

// Builds a fish shape from a few numbers, with its colors painted onto the vertices.
//
// The body is a stretched tube: at each step along its length we draw an oval cross-section whose
// height and width follow the species' profile (a tall disc for a tang, a slim torpedo for a chromis).
// A tail fin and a dorsal fin are thin fans stuck on the back and top.
//
//   side view:          ___ dorsal fin
//                  .--'''   '''--.___
//   head (+z) --> (  o              ___>< tail (-z)
//                  '--...     ...--'
//
// The fish is 1 unit long (head at z = +0.5) and faces +z. Each instance is scaled to real size.
// The vertex shader (fish-material.js) makes it swim by bending it side to side (x).

const ALONG = 14; // cross-sections along the body
const AROUND = 12; // points around each cross-section

// paint(u, side, y, part) → THREE.Color. u: 0 = nose, 1 = tail base; side: -1..1 (belly..back); part: 'body'|'tail'|'fin'
export function createFishGeometry({ height, width, tailLength = 0.28, tailSpread = 0.34, forked = false, dorsal = 0.12, paint }) {
  const positions = [];
  const colors = [];
  const indices = [];
  const c = new THREE.Color();

  // Body profile: fish are rounder toward the head and pinch to a narrow tail stem.
  const profile = (u) => Math.pow(Math.sin(Math.PI * Math.min(u * 0.92 + 0.04, 1)), 0.75) * (1 - 0.6 * u * u);

  for (let i = 0; i <= ALONG; i++) {
    const u = i / ALONG;
    const z = 0.5 - u;
    const h = height * 0.5 * Math.max(profile(u), 0.06);
    const w = width * 0.5 * Math.max(profile(u), 0.06);
    for (let j = 0; j < AROUND; j++) {
      const a = (j / AROUND) * Math.PI * 2;
      const y = Math.sin(a) * h;
      positions.push(Math.cos(a) * w, y, z);
      paint(c, u, Math.sin(a), y, 'body', Math.cos(a));
      colors.push(c.r, c.g, c.b);
    }
  }
  const ring = (i, j) => i * AROUND + (j % AROUND);
  for (let i = 0; i < ALONG; i++) {
    for (let j = 0; j < AROUND; j++) {
      indices.push(ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j));
    }
  }
  // Close the nose with a cap.
  const noseIndex = positions.length / 3;
  positions.push(0, 0, 0.51);
  paint(c, 0, 0, 0, 'body', 0);
  colors.push(c.r, c.g, c.b);
  for (let j = 0; j < AROUND; j++) indices.push(noseIndex, ring(0, j + 1), ring(0, j));

  // A thin fan of triangles in the x = 0 plane (seen from both sides thanks to a double-sided material).
  const fan = (points, part) => {
    const start = positions.length / 3;
    for (const [y, z, u] of points) {
      positions.push(0, y, z);
      paint(c, u, 0, y, part, 0);
      colors.push(c.r, c.g, c.b);
    }
    for (let k = 1; k < points.length - 1; k++) indices.push(start, start + k, start + k + 1);
  };

  // Tail fin, rooted at the narrow stem.
  const root = -0.5;
  const tip = root - tailLength;
  const notch = forked ? root - tailLength * 0.55 : tip;
  fan(
    [
      [0, root + 0.02, 1],
      [tailSpread * 0.5, tip, 1.3],
      [0, notch, 1.2],
      [-tailSpread * 0.5, tip, 1.3],
    ],
    'tail',
  );
  // Dorsal fin along the back.
  if (dorsal > 0) {
    const pts = [[height * 0.3, 0.1, 0.4]];
    for (let k = 0; k <= 6; k++) {
      const u = 0.25 + (k / 6) * 0.55;
      const top = height * 0.5 * profile(u) + dorsal * Math.sin((k / 6) * Math.PI * 0.9 + 0.2);
      pts.push([top, 0.5 - u, u]);
    }
    pts.push([height * 0.5 * profile(0.82) * 0.8, 0.5 - 0.82, 0.82]);
    fan(pts, 'fin');
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
