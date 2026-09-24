import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise } from './noise.js';

// Every rock is a sphere that's been stretched and pushed in and out.
//
// A rock's shape is a function: for any direction from its center, how far out is the surface?
//   radius(direction) = 1 + lumps(direction) + ledges(height)
// The mesh is built by moving each point of a sphere out to that radius, and collision asks the same
// function "is the diver closer to the center than the surface is?" One function drives both,
// so you can't swim through a bump you can see, or hit an invisible one.

const { fbm } = createNoise(23);

// Radius of rock 'rock' in unit direction (x, y, z), measured in its own unstretched space.
export function rockRadius(rock, x, y, z) {
  const s = rock.seed;
  let r = 1 + 0.3 * fbm(x * 1.4 + s, y * 1.4, z * 1.4 - s, 4);
  // Craggy detail: 'ridged' noise (0.5 - |noise|) makes sharp creases instead of soft bumps.
  r += 0.1 * (0.5 - Math.abs(fbm(x * 7 + s, y * 7 - s, z * 7, 3)));
  if (rock.kind === 'pinnacle') {
    // Horizontal bands of ledges and undercuts, like layered reef limestone.
    // The ledges come and go around the tower (the noise factor) so it doesn't look turned on a lathe.
    const ledgeStrength = 0.6 + 0.8 * fbm(x * 1.2 - s, 0, z * 1.2 + s, 2);
    r += ledgeStrength * (0.1 * Math.sin(y * 9 + s * 3) + 0.05 * Math.sin(y * 17 + s));
    // Flare out at the base, where rubble and sand pile up.
    r *= 1 + 0.35 * THREE.MathUtils.smoothstep(-y, 0.5, 1);
    // Flatten the top into a platform where coral can sit.
    r *= 1 - 0.3 * THREE.MathUtils.smoothstep(y, 0.7, 1);
  }
  return r;
}

// Build the mesh geometry. 'detail' sets smoothness: triangles = 20 × (detail + 1)².
// Every rock starts as the same sphere, and building one is slow (welding thousands of corners), so we
// build one per detail level and hand out copies.
const baseSpheres = new Map();
function baseSphere(detail) {
  if (!baseSpheres.has(detail)) {
    // mergeVertices welds duplicate corners so the surface shades smoothly instead of faceted.
    baseSpheres.set(detail, mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv')));
  }
  return baseSpheres.get(detail);
}

export function buildRockGeometry(rock, detail) {
  const geo = baseSphere(detail).clone();
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    v.multiplyScalar(rockRadius(rock, v.x, v.y, v.z));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Convert a world-space point into the rock's own unstretched space (and back).
const tmp = new THREE.Vector3();
export function toRockSpace(rock, point, out) {
  out.copy(point).sub(rock.center).applyAxisAngle(THREE.Object3D.DEFAULT_UP, -rock.yaw).divide(rock.scale);
  return out;
}
export function fromRockSpace(rock, local, out) {
  return out.copy(local).multiply(rock.scale).applyAxisAngle(THREE.Object3D.DEFAULT_UP, rock.yaw).add(rock.center);
}

// Roughly how far (in meters) a world point is outside the rock's surface; negative means inside.
export function rockDistance(rock, point) {
  toRockSpace(rock, point, tmp);
  const len = tmp.length();
  if (len < 1e-6) return -rock.minScale;
  const r = rockRadius(rock, tmp.x / len, tmp.y / len, tmp.z / len);
  return (len - r) * rock.minScale;
}
