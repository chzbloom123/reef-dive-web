import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Small helpers shared by the coral builders.
//
// Every coral shape is assembled from simple pieces (cylinders, spheres, strips), each given
// per-vertex colors and a "sway" value, then merged into one geometry. One geometry per variety
// means the GPU can draw every copy of it in a single instanced call.

const UP = new THREE.Vector3(0, 1, 0);

// Give a piece a per-vertex color (from a function of its local position) and a sway weight.
export function paint(geo, colorFn, swayFn = () => 0) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sway = new Float32Array(pos.count);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const value = colorFn(x, y, z);
    if (typeof value === 'number') c.setRGB(value, value, value);
    else c.copy(value);
    c.toArray(colors, i * 3);
    sway[i] = swayFn(x, y, z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
  return geo;
}

// Merge pieces into one geometry. All pieces must carry the same attributes, so we drop
// texture coordinates (unused) and make every piece indexed.
export function mergeParts(parts) {
  const cleaned = parts.map((g) => {
    if (g.attributes.uv) g.deleteAttribute('uv');
    return g.index ? g : indexed(g);
  });
  const merged = mergeGeometries(cleaned, false);
  cleaned.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

function indexed(geo) {
  const count = geo.attributes.position.count;
  geo.setIndex([...Array(count).keys()]);
  return geo;
}

// Place a piece built along +Y (base at y = 0) so it starts at 'from' and points along 'dir'.
const q = new THREE.Quaternion();
export function orientAlong(geo, from, dir) {
  q.setFromUnitVectors(UP, dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate(from.x, from.y, from.z);
  return geo;
}

// A tapered, open-ended tube segment with its base at the origin, pointing up.
export function segment(radiusBottom, radiusTop, length, sides = 6) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides, 1, true);
  geo.translate(0, length / 2, 0);
  return geo;
}

export { UP };
