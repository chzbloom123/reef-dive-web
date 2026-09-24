import * as THREE from 'three';
import { createRandom } from './random.js';
import { createNoise } from './noise.js';
import { groundHeightAt } from './terrain-height.js';
import { createMatteMaterial } from './materials.js';
import { rockRadius, buildRockGeometry, toRockSpace, fromRockSpace, rockDistance } from './rock-shapes.js';

// Where the rocks go, how they're colored, and how the diver bumps off them.
//
// Layout (seen from above, shallow end at the top). The pinnacles frame a sandy channel down the
// middle, like the reference image: tall towers left and right, more of them fading into the deep.
//
//            z=+14  A              B          shallow (6 m)
//                        channel
//                   C                          middle (10 m)
//                                  D
//            z=-14  E                    F    deep edge (18 m)
//   ...plus distant towers outside the reef that show only as silhouettes in the haze.

const { fbm } = createNoise(31);

// [x, z, width, depth-of-top (m), thickness, yaw]
const PINNACLES = [
  [-6.2, 9, 3.2, 3.5, 3.8, 0.3],
  [6.6, 6, 3.4, 4.5, 3.0, 1.2],
  [-4.0, -3.5, 2.3, 4.0, 2.7, 2.1],
  [4.4, -8, 2.7, 6.0, 3.1, 0.7],
  [-6.5, -14, 3.6, 8.0, 3.2, 1.7],
  [7.2, -16, 3.2, 9.5, 3.6, 2.6],
];

// Low, wide shelves near the sides of the channel.
const LEDGES = [
  [-3.5, 12.5, 2.6, 1.0, 2.0, 0.4],
  [3.8, 11, 2.2, 0.9, 1.8, 1.9],
  [5.0, 0.5, 2.4, 1.1, 1.8, 0.2],
  [-5.5, 3, 2.0, 1.0, 2.4, 2.8],
];

const ROCK_TINTS = ['#77716a', '#6b6862', '#7d7266', '#666b6b'];

function makeRock(kind, x, z, sx, sy, sz, yaw, seed, centerY) {
  const scale = new THREE.Vector3(sx, sy, sz);
  return {
    kind,
    seed,
    yaw,
    scale,
    center: new THREE.Vector3(x, centerY, z),
    minScale: Math.min(sx, sy, sz),
    reach: Math.max(sx, sy, sz) * 2.1, // no part of the rock is farther than this from its center (base flare included)
  };
}

function layoutRocks(rand) {
  const rocks = [];
  const addPinnacle = ([x, z, w, topDepth, t, yaw], kind = 'pinnacle') => {
    // Sink the base deep enough that no lump can lift it off the sand, even on a slope.
    const ground = groundHeightAt(x, z);
    const top = -topDepth;
    const sy = (top - ground) / 1.35; // the flattened top sits ~0.75 of a radius above the center...
    rocks.push(makeRock(kind, x, z, w, sy, t, yaw, rand.range(0, 50), ground + sy * 0.6)); // ...the base ~0.4 below the sand
  };
  PINNACLES.forEach((p) => addPinnacle(p));

  for (const [x, z, w, h, t, yaw] of LEDGES) {
    rocks.push(makeRock('boulder', x, z, w, h, t, yaw, rand.range(0, 50), groundHeightAt(x, z) + h * 0.2));
  }

  // Distant towers beyond the reef: seen only as shapes in the haze, so the world doesn't end at a wall.
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * rand.range(13, 22);
    const z = rand.range(-30, 22);
    addPinnacle([x, z, rand.range(2.5, 4.5), rand.range(3, 9), rand.range(2.5, 4.5), rand.range(0, 6)]);
  }
  for (let i = 0; i < 5; i++) {
    const x = rand.range(-12, 12);
    const z = rand.range(-34, -24);
    addPinnacle([x, z, rand.range(3, 5), rand.range(10, 14), rand.range(3, 5), rand.range(0, 6)]);
  }

  // Scattered boulders, kept out of the middle of the channel so the view down the reef stays open.
  const probe = new THREE.Vector3();
  let placed = 0;
  for (let tries = 0; placed < 34 && tries < 400; tries++) {
    const x = rand.range(-8, 8);
    const z = rand.range(-16, 15);
    if (Math.abs(x) < 1.6 && rand.next() < 0.8) continue;
    const r = rand.range(0.35, 1.2);
    probe.set(x, groundHeightAt(x, z), z);
    if (rocks.some((rock) => rockDistance(rock, probe) < r + 0.3)) continue;
    const sy = r * rand.range(0.55, 0.85);
    rocks.push(makeRock('boulder', x, z, r * rand.range(0.9, 1.3), sy, r, rand.range(0, 6), rand.range(0, 50), probe.y + sy * 0.25));
    placed++;
  }
  return rocks;
}

// Paint each vertex: bare rock on the sides, algae and pink coralline crust on top,
// darker underneath and where the rock meets the sand (light can't reach into those corners).
function paintRock(rock, geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(ROCK_TINTS[Math.floor(rock.seed) % ROCK_TINTS.length]);
  const olive = new THREE.Color('#8b8d5c');
  const coralline = new THREE.Color('#c47f8a');
  const purple = new THREE.Color('#7b6b96');
  const c = new THREE.Color();
  const n = new THREE.Vector3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    local.fromBufferAttribute(pos, i);
    fromRockSpace(rock, local, world);
    // Stretching a shape changes which way its surface faces; dividing by the scale corrects the normal.
    n.fromBufferAttribute(nrm, i).divide(rock.scale).normalize();
    const up = n.y;

    const patch = fbm(world.x * 0.5 + rock.seed, world.y * 0.5, world.z * 0.5, 3);
    const speck = fbm(world.x * 9, world.y * 9, world.z * 9, 2);
    c.copy(base).multiplyScalar(1 + speck * 0.35);

    const growth = THREE.MathUtils.smoothstep(up, 0.1, 0.75) * THREE.MathUtils.smoothstep(patch, -0.35, 0.15);
    const crust = patch > 0.2 ? coralline : patch < -0.2 ? purple : olive;
    c.lerp(crust, growth * 0.6);

    const aboveSand = world.y - groundHeightAt(world.x, world.z);
    let shade = 1 - 0.55 * Math.exp(-Math.max(aboveSand, 0) * 1.3);
    shade *= 0.55 + 0.45 * THREE.MathUtils.smoothstep(up, -0.7, 0.3);
    c.multiplyScalar(shade);
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function createRockField(preset) {
  const rand = createRandom(5);
  const rocks = layoutRocks(rand);
  const group = new THREE.Group();
  const material = createMatteMaterial(preset, { vertexColors: true, roughness: 0.95 });

  // Smoothness per rock type. Towers outside the reef are only ever seen through haze, so they get less.
  const detail = preset.name === 'high' ? { pinnacle: 36, distant: 20, boulder: 12 } : { pinnacle: 22, distant: 12, boulder: 10 };
  for (const rock of rocks) {
    const far = Math.abs(rock.center.x) > 11 || rock.center.z < -20;
    const geo = buildRockGeometry(rock, rock.kind === 'pinnacle' && far ? detail.distant : detail[rock.kind]);
    paintRock(rock, geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.copy(rock.center);
    mesh.rotation.y = rock.yaw;
    mesh.scale.copy(rock.scale);
    mesh.castShadow = preset.shadows;
    mesh.receiveShadow = preset.shadows;
    group.add(mesh);
  }

  // How far outside the surface a point is, in the rock's own units (negative = inside).
  const local = new THREE.Vector3();
  const field = (rock, p) => {
    toRockSpace(rock, p, local);
    const len = Math.max(local.length(), 1e-6);
    return len - rockRadius(rock, local.x / len, local.y / len, local.z / len);
  };
  const probe = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const STEP = 0.05; // meters, for measuring the slope of the field

  return {
    group,
    rocks,

    // Push a sphere (the diver) out of any rock it overlaps. Returns true if it moved.
    //
    // We push along the surface's true outward direction (its "normal"), found by sampling the field
    // a few centimeters away in x, y and z and seeing which way it grows fastest. Pushing straight
    // away from the rock's center instead would slowly ratchet you up the side of a tall pinnacle.
    collide(position, radius) {
      let pushed = false;
      for (const rock of rocks) {
        const reach = rock.reach + radius;
        if (position.distanceToSquared(rock.center) > reach * reach) continue; // too far to touch: skip the math
        for (let iteration = 0; iteration < 3; iteration++) {
          const f = field(rock, position);
          // Quick exit: one rock unit is at least minScale meters, so this point is safely clear.
          if (f * rock.minScale >= radius) break;
          normal.set(
            field(rock, probe.copy(position).setX(position.x + STEP)) - f,
            field(rock, probe.copy(position).setY(position.y + STEP)) - f,
            field(rock, probe.copy(position).setZ(position.z + STEP)) - f,
          );
          const slope = normal.length() / STEP; // rock units per meter
          if (slope < 1e-6) break;
          const distance = f / slope; // meters outside the surface (approximately)
          if (distance >= radius) break;
          position.addScaledVector(normal.normalize(), radius - distance);
          pushed = true;
        }
      }
      return pushed;
    },

    // A point on a rock's surface in a given direction from its center (in the rock's own space),
    // plus which way the surface faces there. Used to grow coral on rocks.
    sampleSurface(rock, dir, outPosition, outNormal) {
      probe.copy(dir).normalize();
      probe.multiplyScalar(rockRadius(rock, probe.x, probe.y, probe.z));
      fromRockSpace(rock, probe, outPosition);
      const f = field(rock, outPosition);
      outNormal.set(
        field(rock, probe.copy(outPosition).setX(outPosition.x + STEP)) - f,
        field(rock, probe.copy(outPosition).setY(outPosition.y + STEP)) - f,
        field(rock, probe.copy(outPosition).setZ(outPosition.z + STEP)) - f,
      );
      outNormal.normalize();
      return outPosition;
    },

    // Distance from a point to the nearest rock surface (meters, approximate). Used to shade the sand.
    // Rocks farther than 'limit' are skipped (the answer is then just "more than limit"), which keeps
    // this fast enough to call thousands of times while placing coral and seagrass.
    distanceTo(point, limit = 6) {
      let best = limit;
      for (const rock of rocks) {
        if (point.distanceTo(rock.center) - rock.reach > best) continue;
        best = Math.min(best, rockDistance(rock, point));
      }
      return best;
    },
  };
}
