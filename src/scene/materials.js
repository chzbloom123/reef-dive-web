import * as THREE from 'three';

// Picks the lighting model for matte surfaces (rock, sand, coral) by preset.
//
// "Standard" is physically based: it computes realistic shine and roughness per pixel.
// "Lambert" is the classic simpler model, matte light only. On rough underwater surfaces the two
// look almost identical, but Lambert does noticeably less math per pixel, which matters on
// integrated graphics where the number of pixels, not the number of triangles, is the bottleneck.
export function createMatteMaterial(preset, params) {
  if (preset.name === 'high') return new THREE.MeshStandardMaterial({ roughness: 1, ...params });
  const { roughness, metalness, ...rest } = params; // Lambert has no roughness/metalness settings
  return new THREE.MeshLambertMaterial(rest);
}
