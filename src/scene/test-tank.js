import * as THREE from 'three';
import { createRandom } from './random.js';
import { groundHeightAt } from './terrain-height.js';

// Milestone 1 stand-in scenery: a sandy slope, some lumpy blobs, and three "color posts".
// It's here so you have something to swim past and can watch how water eats color.
// Milestones 2–3 replace it with the real seabed and coral.

const POST_COLORS = ['#ff2a2a', '#ff8c1a', '#ffe135', '#35d35a', '#2f7bff', '#ffffff'];

export function buildTestTank(scene) {
  const rand = createRandom(7);

  // Sand: a grid of points whose heights come from the terrain function.
  const floorGeo = new THREE.PlaneGeometry(70, 90, 70, 90);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(0, 0, -8);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeightAt(pos.getX(i), pos.getZ(i)));
  }
  floorGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#e3d3a8', roughness: 1 })));

  // Lumpy blobs resting on the sand.
  const palette = ['#e0795e', '#f2c14e', '#8e6bbf', '#3fb8a0', '#d9577a', '#6d6a60'];
  for (let i = 0; i < 45; i++) {
    const radius = rand.range(0.4, 1.4);
    const geo = new THREE.IcosahedronGeometry(radius, 3);
    // Lump amount comes from each corner's position so shared corners move together (no seams).
    const p = geo.attributes.position;
    const seed = rand.range(0, 100);
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v);
      const y = p.getY(v);
      const z = p.getZ(v);
      const s = 1 + Math.sin(x * 5 + seed) * Math.sin(y * 6 - seed) * Math.sin(z * 4 + seed * 0.5) * 0.25;
      p.setXYZ(v, x * s, y * s * 0.8, z * s);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: rand.pick(palette), roughness: 0.85, flatShading: true }),
    );
    const x = rand.range(-9, 9);
    const z = rand.range(-16, 14);
    mesh.position.set(x, groundHeightAt(x, z) + radius * 0.3, z);
    scene.add(mesh);
  }

  // Color posts: stacks of colored bands every meter from the seabed up to 2 m below the surface.
  // All bands are ONE InstancedMesh: the GPU gets one cube shape plus a list of positions and
  // colors, and draws every copy in a single call. That's far cheaper than hundreds of separate cubes.
  const postSpots = [
    [-3, 9],
    [4, -1],
    [-4, -9],
  ];
  const bands = [];
  for (const [x, z] of postSpots) {
    const bottom = groundHeightAt(x, z);
    for (let y = bottom + 0.5, i = 0; y < -2; y += 1, i++) bands.push({ x, y, z, color: POST_COLORS[i % POST_COLORS.length] });
  }
  const bandMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.5, 0.9, 0.5),
    new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    bands.length,
  );
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  bands.forEach((band, i) => {
    bandMesh.setMatrixAt(i, matrix.makeTranslation(band.x, band.y, band.z));
    bandMesh.setColorAt(i, color.set(band.color));
  });
  scene.add(bandMesh);
}
