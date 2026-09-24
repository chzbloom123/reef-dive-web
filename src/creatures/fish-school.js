import * as THREE from 'three';
import { groundHeightAt } from '../scene/terrain-height.js';

// Schooling fish using "boids" (Craig Reynolds, 1986). No fish knows about the school as a whole;
// each one just follows a few local rules about its nearby neighbors, and the school's swirling
// shape emerges from that:
//
//   separation  don't bump into neighbors      (push away from the ones too close)
//   alignment   swim the way neighbors swim    (match their average velocity)
//   cohesion    don't get left behind          (drift toward their average position)
//
// Plus our own rules: stay near the school's home (which wanders slowly), keep off the sand and
// below the surface, steer around rocks, and scatter away from the diver.
//
// Each frame, per fish:  rules → acceleration → velocity (speed-limited) → position → instance matrix

const tmp = new THREE.Vector3();
const sep = new THREE.Vector3();
const ali = new THREE.Vector3();
const coh = new THREE.Vector3();
const steer = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const forward = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export function createSchool({ species, members, home, wander, rand }) {
  const fish = [];
  for (let i = 0; i < members; i++) {
    const position = home
      .clone()
      .add(new THREE.Vector3(rand.range(-1, 1), rand.range(-0.5, 0.5), rand.range(-1, 1)).multiplyScalar(species.homeRadius * 0.5));
    const heading = rand.range(0, Math.PI * 2);
    const speed = rand.range(...species.speed);
    fish.push({
      position,
      velocity: new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)).multiplyScalar(speed),
      length: rand.range(...species.length),
      phase: rand.range(0, Math.PI * 2),
      beat: species.beat * rand.range(0.85, 1.15),
    });
  }
  return { species, fish, anchor: home.clone(), home: home.clone(), wander, seed: rand.range(0, 100) };
}

export function updateSchool(school, dt, time, { rockField, diverPosition }) {
  const { species, fish } = school;
  const [minSpeed, maxSpeed] = species.speed;

  // The home point drifts in slow loops so the school tours its patch of reef.
  if (school.wander > 0) {
    const s = school.seed;
    school.home.set(
      school.anchor.x + Math.sin(time * 0.05 + s) * school.wander,
      school.anchor.y + Math.sin(time * 0.07 + s * 2) * 0.8,
      school.anchor.z + Math.sin(time * 0.043 + s * 3) * school.wander,
    );
  }

  const r2 = species.neighborRadius * species.neighborRadius;
  for (let i = 0; i < fish.length; i++) {
    const f = fish[i];
    sep.set(0, 0, 0);
    ali.set(0, 0, 0);
    coh.set(0, 0, 0);
    let neighbors = 0;
    for (let j = 0; j < fish.length; j++) {
      if (i === j) continue;
      const other = fish[j];
      const d2 = f.position.distanceToSquared(other.position);
      if (d2 > r2) continue;
      neighbors++;
      ali.add(other.velocity);
      coh.add(other.position);
      if (d2 < species.separation * species.separation) {
        tmp.subVectors(f.position, other.position).divideScalar(Math.max(d2, 0.0004));
        sep.add(tmp);
      }
    }

    steer.set(0, 0, 0);
    if (neighbors > 0) {
      ali.divideScalar(neighbors).sub(f.velocity).multiplyScalar(species.alignment);
      coh.divideScalar(neighbors).sub(f.position).multiplyScalar(species.cohesion);
      steer.add(ali).add(coh);
    }
    steer.addScaledVector(sep, 0.02);

    // Home: gentle pull, growing once the fish strays past the home radius.
    tmp.subVectors(school.home, f.position);
    const away = tmp.length();
    steer.addScaledVector(tmp, (away > species.homeRadius ? 1.2 : 0.15) / Math.max(away, 0.1));

    // Keep between the sand and the surface.
    const floor = groundHeightAt(f.position.x, f.position.z);
    if (f.position.y < floor + 0.6) steer.y += (floor + 0.6 - f.position.y) * 4;
    if (f.position.y > -1.2) steer.y -= (f.position.y + 1.2) * 4;

    // Rocks.
    tmp.set(0, 0, 0);
    rockField.addRepulsion(f.position, 1.2, tmp);
    steer.addScaledVector(tmp, 3);

    // The diver: dart away when you get close.
    tmp.subVectors(f.position, diverPosition);
    const diverDistance = tmp.length();
    if (diverDistance < 2.5) steer.addScaledVector(tmp.normalize(), (2.5 - diverDistance) * 3);

    f.velocity.addScaledVector(steer, dt);
    // Fish swim mostly level; limit how steeply they climb or dive.
    f.velocity.y = THREE.MathUtils.clamp(f.velocity.y, -0.35 * maxSpeed, 0.35 * maxSpeed);
    const speed = f.velocity.length();
    const target = THREE.MathUtils.clamp(speed, minSpeed, maxSpeed * (diverDistance < 2.5 ? 1.8 : 1));
    f.velocity.multiplyScalar(target / Math.max(speed, 1e-5));
    f.position.addScaledVector(f.velocity, dt);

    // Tail beats speed up with swimming speed.
    const effort = 0.4 + target / maxSpeed;
    f.phase += dt * f.beat * effort * Math.PI * 2;
    f.amplitude = 0.035 + 0.05 * Math.min(effort, 1.6);
  }
}

// Write each fish's position, facing and size into its instance matrix (column 3 of a 4x4 matrix is
// the position; the first three columns are the fish's right, up and forward directions, scaled).
export function writeSchool(school, mesh, swimAttr, offset) {
  for (let i = 0; i < school.fish.length; i++) {
    const f = school.fish[i];
    forward.copy(f.velocity).normalize();
    right.crossVectors(WORLD_UP, forward).normalize();
    up.crossVectors(forward, right);
    const s = f.length;
    matrix.makeBasis(right.multiplyScalar(s), up.multiplyScalar(s), forward.multiplyScalar(s));
    matrix.setPosition(f.position);
    mesh.setMatrixAt(offset + i, matrix);
    swimAttr.setXY(offset + i, f.phase, f.amplitude ?? 0.05);
  }
}
