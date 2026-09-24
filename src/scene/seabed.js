import * as THREE from 'three';
import { groundHeightAt } from './terrain-height.js';
import { createSandTextures } from './sand-textures.js';
import { createNoise } from './noise.js';
import { createMatteMaterial } from './materials.js';

// The sandy floor: a grid of points lifted to the terrain height, wrapped in the sand textures,
// and tinted per point: pale in open sand, darker in hollows and around rock bases.

const WIDTH = 90;
const LENGTH = 110;
const CENTER_Z = -8;
const TILE_METERS = 4; // the ripple texture repeats every 4 m

export function createSeabed(preset, rockField, maxAnisotropy) {
  const { fbm } = createNoise(59);
  const perMeter = preset.name === 'high' ? 1.5 : 1;
  const geo = new THREE.PlaneGeometry(WIDTH, LENGTH, Math.round(WIDTH * perMeter), Math.round(LENGTH * perMeter));
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, CENTER_Z);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#ffffff');
  const dark = new THREE.Color('#9c8f76');
  const c = new THREE.Color();
  const p = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    // Contact shadow: sand right next to rock gets less light from the sky. This fakes the soft
    // darkening a real renderer would compute with ambient occlusion, but costs nothing per frame.
    p.set(x, y + 0.3, z);
    const d = rockField.distanceTo(p);
    const contact = Math.exp(-Math.max(d, 0) * 0.9);
    const patches = 0.5 + 0.5 * fbm(x * 0.12, 1.3, z * 0.12, 3);
    c.copy(sand).lerp(dark, Math.min(1, contact * 0.75 + patches * 0.3));
    c.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Scale the texture coordinates so one texture tile covers TILE_METERS of sand.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * WIDTH) / TILE_METERS, (uv.getY(i) * LENGTH) / TILE_METERS);
  }

  const { map, normalMap } = createSandTextures(maxAnisotropy);
  const material = createMatteMaterial(preset, {
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    vertexColors: true,
    roughness: 1,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = preset.shadows;
  return mesh;
}
