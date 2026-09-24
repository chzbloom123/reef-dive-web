import * as THREE from 'three';
import { createRandom } from './random.js';

// Milestone 0 placeholder: just enough reef to prove the pipeline (code → build → browser → Vercel).
// Milestones 1–3 replace this with the real water, seabed, and procedural coral.

const WATER_COLOR = new THREE.Color('#0f6f86');

export function buildHelloReef(scene) {
  const rand = createRandom(7);

  // Fog makes far things fade into the water color, which is most of what makes water read as water.
  scene.background = WATER_COLOR;
  scene.fog = new THREE.FogExp2(WATER_COLOR, 0.055);

  // Two lights: a hemisphere light (bright from above, dim blue from below) for soft ambient,
  // and a directional "sun" for highlights and shading.
  scene.add(new THREE.HemisphereLight('#bff4ff', '#1d4a55', 1.6));
  const sun = new THREE.DirectionalLight('#fff4d8', 2.2);
  sun.position.set(4, 20, 6);
  scene.add(sun);

  // Sand floor: a flat grid of vertices nudged up and down to make gentle dunes.
  const floorGeo = new THREE.PlaneGeometry(80, 80, 80, 80);
  floorGeo.rotateX(-Math.PI / 2);
  const pos = floorGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, -12 + Math.sin(x * 0.3) * 0.4 + Math.cos(z * 0.25 + x * 0.1) * 0.5);
  }
  floorGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#d9c9a0', roughness: 1 })));

  // A handful of lumpy blobs standing in for coral and rock.
  const palette = ['#e0795e', '#f2c14e', '#8e6bbf', '#3fb8a0', '#d9577a', '#6d6a60'];
  for (let i = 0; i < 40; i++) {
    const geo = new THREE.IcosahedronGeometry(rand.range(0.4, 1.4), 3);
    // The lump amount is computed from each vertex's position, not rolled randomly per vertex:
    // corners shared by several triangles are stored as separate copies, and they must all move
    // together or the surface tears open at the seams.
    const p = geo.attributes.position;
    const seed = rand.range(0, 100);
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v);
      const y = p.getY(v);
      const z = p.getZ(v);
      const s = 1 + Math.sin(x * 5 + seed) * Math.sin(y * 6 - seed) * Math.sin(z * 4 + seed * 0.5) * 0.25;
      p.setXYZ(v, p.getX(v) * s, p.getY(v) * s * 0.8, p.getZ(v) * s);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: rand.pick(palette), roughness: 0.85, flatShading: true }),
    );
    mesh.position.set(rand.range(-10, 10), -11.6, rand.range(-14, 10));
    scene.add(mesh);
  }

  // The water surface seen from below: a bright sheet overhead.
  const surface = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ color: '#9ce8f5', side: THREE.DoubleSide, fog: true }),
  );
  surface.rotation.x = Math.PI / 2;
  scene.add(surface);

  return {
    // A slow bob so the page feels alive.
    update(time, camera) {
      camera.position.y = -6 + Math.sin(time * 0.5) * 0.15;
    },
  };
}
