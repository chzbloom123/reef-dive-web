import * as THREE from 'three';
import { waterColorGlsl } from './water-color.glsl.js';

// Three.js assembles every built-in material's shader from named snippets called "chunks".
// Its stock fog fades everything to one flat color by distance. Real water is richer: the color
// depends on which way you're looking and how deep you are, and each color channel fades at
// its own rate. So we swap in our own fog chunks once, before anything is drawn, and every
// material in the scene picks up the underwater look automatically.
//
// Notes for later milestones:
//   - Custom ShaderMaterials need `fog: true`, `THREE.UniformsLib.fog` merged into their uniforms
//     (three.js writes to those even though we don't read them), and these same chunks included.
//   - THREE.Sprite's shader lacks the variable we use here; use Points or small meshes instead.

export function installUnderwaterFog() {
  // Vertex shader: pass each point's world position along to the pixel shader.
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif
`;

  THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vec4 fogWorldPos = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    fogWorldPos = batchingMatrix * fogWorldPos;
  #endif
  #ifdef USE_INSTANCING
    fogWorldPos = instanceMatrix * fogWorldPos; // each instanced copy has its own placement
  #endif
  vFogWorldPos = (modelMatrix * fogWorldPos).xyz;
#endif
`;

  // Pixel (fragment) shader: tint the finished color toward the water.
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
  ${waterColorGlsl}
#endif
`;

  THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = applyWater(gl_FragColor.rgb, vFogWorldPos, cameraPosition) + waterDither();
#endif
`;
}
