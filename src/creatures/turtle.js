import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRandom } from '../scene/random.js';
import { createMatteMaterial } from '../scene/materials.js';

// A green sea turtle (~1.1 m) on a slow loop through the reef.
//
// Built from a few simple parts, each its own mesh so the flippers can rotate at the shoulder:
//
//            head
//   flipper ( shell ) flipper      front flippers: big slow "flying" strokes
//     rear  (       )  rear        rear flippers: small paddling, mostly for steering
//
// The path is a smooth closed curve (Catmull-Rom spline) through open water. Each frame the turtle
// moves a little along it, faces along it, and banks gently into turns.

// Path points through open water down the channel and back, checked to stay at least ~1 m from
// rock (the check was a small script sampling 400 points along the curve).
const PATH = [
  [1.2, -8.2, 3],
  [0.9, -9.4, -3.5],
  [0.3, -11.5, -11],
  [-1.0, -12.5, -17],
  [-1.6, -9.8, -11],
  [0.5, -6.6, -3],
  [-0.8, -6.5, 5],
  [1.5, -6.2, 12],
  [2.2, -7.2, 8],
];

const SPEED = 0.38; // m/s, an unhurried cruise

function shellGeometry() {
  const rand = createRandom(9);
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 6).deleteAttribute('normal').deleteAttribute('uv'));
  const pos = geo.attributes.position;
  // Scute centers: the plates on the shell. The shell's color is decided by how close each point
  // is to its nearest plate center versus the second nearest (a "Voronoi" pattern): near the
  // boundary between two plates means a pale seam line.
  const scutes = [];
  for (let i = 0; i < 5; i++) scutes.push(new THREE.Vector3(0, 1, (i - 2) * 0.42));
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) scutes.push(new THREE.Vector3(s * 0.62, 0.75, (i - 1.5) * 0.48));
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) scutes.push(new THREE.Vector3(s * 0.95, 0.15, (i - 3) * 0.3));
  scutes.forEach((sc) => sc.add(new THREE.Vector3(rand.range(-0.05, 0.05), 0, rand.range(-0.05, 0.05))));

  const colors = new Float32Array(pos.count * 3);
  const plate = new THREE.Color('#5b3e22');
  const plateLight = new THREE.Color('#8a6334');
  const seam = new THREE.Color('#c8b27a');
  const belly = new THREE.Color('#e3d49a');
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const top = v.y > -0.05;
    let d1 = Infinity;
    let d2 = Infinity;
    for (const sc of scutes) {
      const d = v.distanceTo(sc);
      if (d < d1) [d1, d2] = [d, d1];
      else if (d < d2) d2 = d;
    }
    if (!top) c.copy(belly);
    else if (d2 - d1 < 0.05) c.copy(seam);
    else c.copy(plate).lerp(plateLight, Math.min(1, d1 * 1.6)); // streaky plates: lighter toward their edges
    c.toArray(colors, i * 3);
    // Flatten into a shell shape: domed top, nearly flat belly, slightly pointed tail end.
    const y = v.y > 0 ? v.y * 0.38 : v.y * 0.14;
    pos.setXYZ(i, v.x * 0.46 * (1 - 0.15 * Math.max(0, -v.z)), y, v.z * 0.56);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function skinned(geo, base, spots) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(base);
  const b = new THREE.Color(spots);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const n = Math.sin(pos.getX(i) * 60) * Math.sin(pos.getZ(i) * 55) * Math.sin(pos.getY(i) * 70);
    c.copy(a).lerp(b, n > 0.25 ? 0.7 : 0).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// A flipper: a flattened, tapered paddle pointing along +x from its shoulder at the origin.
function flipperGeometry(length, width) {
  const geo = new THREE.SphereGeometry(0.5, 12, 6);
  geo.scale(length, 0.07, width);
  geo.translate(length * 0.45, 0, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) / length; // 0 at the shoulder → 1 at the tip
    pos.setZ(i, pos.getZ(i) * (1 - 0.55 * Math.max(t, 0)) - t * t * width * 0.9); // taper and sweep back
  }
  geo.computeVertexNormals();
  return skinned(geo, '#6b6a4a', '#b8b58a');
}

export function createTurtle(preset) {
  const material = createMatteMaterial(preset, { vertexColors: true, roughness: 0.6 });
  const root = new THREE.Group();
  const body = new THREE.Group(); // tilts and banks inside the root
  root.add(body);

  const shell = new THREE.Mesh(shellGeometry(), material);
  body.add(shell);

  const headGeo = new THREE.SphereGeometry(1, 14, 10);
  headGeo.scale(0.1, 0.085, 0.14);
  const head = new THREE.Mesh(skinned(headGeo, '#6e6c4c', '#c9c49a'), material);
  head.position.set(0, 0.02, 0.62);
  body.add(head);
  const neckGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.16, 10);
  neckGeo.rotateX(Math.PI / 2);
  const neck = new THREE.Mesh(skinned(neckGeo, '#6e6c4c', '#a8a47a'), material);
  neck.position.set(0, 0, 0.52);
  body.add(neck);

  const flippers = [];
  const addFlipper = (side, front) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (front ? 0.33 : 0.3), -0.03, front ? 0.28 : -0.38);
    const mesh = new THREE.Mesh(flipperGeometry(front ? 0.62 : 0.3, front ? 0.3 : 0.2), material);
    mesh.scale.x = side; // mirror for the left side
    pivot.add(mesh);
    pivot.rotation.y = side * (front ? 0.2 : 0.5); // both sweep backward; rear ones more
    body.add(pivot);
    flippers.push({ pivot, side, front, restYaw: pivot.rotation.y });
  };
  addFlipper(1, true);
  addFlipper(-1, true);
  addFlipper(1, false);
  addFlipper(-1, false);

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = preset.shadows;
  });

  const curve = new THREE.CatmullRomCurve3(
    PATH.map((p) => new THREE.Vector3(...p)),
    true, // closed loop
    'centripetal',
  );
  const length = curve.getLength();
  const pos = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const prevTangent = new THREE.Vector3(0, 0, 1);
  let bank = 0;

  return {
    object: root,
    curve,
    update(time, dt) {
      const u = (((time * SPEED) / length) % 1 + 1) % 1; // 0..1 around the loop, even if time were negative
      curve.getPointAt(u, pos);
      curve.getPointAt((u + 0.004) % 1, ahead);
      tangent.subVectors(ahead, pos).normalize();
      root.position.copy(pos);
      root.lookAt(ahead); // Object3D.lookAt points the +z axis at the target

      // Bank into turns: how fast the heading is swinging left or right.
      const turn = prevTangent.x * tangent.z - prevTangent.z * tangent.x;
      prevTangent.copy(tangent);
      const targetBank = THREE.MathUtils.clamp(turn / Math.max(dt, 1e-3), -1, 1) * 0.5;
      bank += (targetBank - bank) * Math.min(1, dt * 1.5);
      body.rotation.z = bank;

      // Strokes: a big slow down-stroke/up-stroke on the front flippers every ~2.6 s.
      const stroke = time * ((Math.PI * 2) / 2.6);
      for (const f of flippers) {
        if (f.front) {
          f.pivot.rotation.z = f.side * (Math.sin(stroke) * 0.55 - 0.1);
          f.pivot.rotation.y = f.restYaw + f.side * Math.cos(stroke) * 0.25;
        } else {
          f.pivot.rotation.z = f.side * Math.sin(stroke * 0.5 + f.side) * 0.18;
        }
      }
      body.position.y = Math.sin(stroke) * 0.03; // the body lifts slightly with each stroke
      head.rotation.y = Math.sin(time * 0.3) * 0.25; // looking around
    },
  };
}
