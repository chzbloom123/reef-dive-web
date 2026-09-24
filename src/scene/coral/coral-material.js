import * as THREE from 'three';
import { createMatteMaterial } from '../materials.js';
import { valueNoiseGlsl } from '../../shaders/noise.glsl.js';

// Materials for everything that grows on the reef. They start as ordinary three.js materials, then we
// splice extra shader code in with onBeforeCompile (three.js hands us the shader text just before the
// GPU compiles it). Three optional extras:
//
//   maze        brain coral's meandering grooves, drawn per pixel instead of built from triangles
//   sway        swaying in the current (seagrass, anemone tentacles), done by the GPU every frame
//   translucent High only: a soft glow at the edges, faking light passing through thin living tissue

// One shared clock for every swaying thing. main.js advances it each frame.
export const reefTime = { value: 0 };

export function createCoralMaterial(preset, { maze = false, sway = 0, translucent = true, doubleSided = false } = {}) {
  const material = createMatteMaterial(preset, {
    vertexColors: true,
    roughness: 0.85,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  const glow = translucent && preset.coralTranslucency;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = reefTime;
    shader.uniforms.uSway = { value: sway };
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;

    vs = vs.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;\nvarying vec3 vCoralPos;\n' + (sway ? 'attribute float aSway;\n' : ''));
    fs = fs.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vCoralPos;\n' + (maze ? valueNoiseGlsl : ''));

    // World position of this point (after instancing), for patterns that shouldn't repeat between corals.
    vs = vs.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 coralWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        coralWorld = instanceMatrix * coralWorld;
      #endif
      vCoralPos = (modelMatrix * coralWorld).xyz;`,
    );

    if (sway) {
      // Bend in world space, after the copy is placed, so every blade leans with the same current.
      // aSway is 0 at the base and 1 at the tip; squaring it makes the bend curve like a real blade.
      vs = vs.replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 rootPos = instanceMatrix[3].xyz;
        #else
          vec3 rootPos = vec3(0.0);
        #endif
        float bend = aSway * aSway;
        float phase = dot(rootPos.xz, vec2(0.45, 0.3)); // neighbors sway slightly out of step, like a wave passing
        float surge = sin(uTime * 0.9 + phase) * 0.7 + sin(uTime * 2.3 + phase * 1.7) * 0.3;
        mvPosition.xz += vec2(0.8, 0.35) * surge * bend * uSway;
        mvPosition.y -= abs(surge) * bend * uSway * 0.35; // leaning over makes the tip dip
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    }

    if (maze) {
      // Brain coral grooves: the contour lines of a smooth noise field meander exactly like brain coral
      // valleys. 'ridge' is 0 in a groove and 1 on top of a ridge.
      fs = fs.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 mp = vCoralPos * 2.4;
        float field = reefNoise(mp) * 0.6 + reefNoise(mp * 2.3) * 0.3 + reefNoise(mp * 5.1) * 0.1;
        float contour = field * 15.0; // many closely spaced contour lines = tight winding valleys
        float toLine = abs(fract(contour) - 0.5) * 2.0;
        float ridge = smoothstep(0.0, 0.7, toLine);
        // Far away the grooves are finer than a pixel and would flicker; fade them to a flat average.
        float tooFine = smoothstep(0.15, 0.45, fwidth(contour));
        ridge = mix(ridge, 0.7, tooFine);
        diffuseColor.rgb *= mix(vec3(0.42, 0.36, 0.34), vec3(1.1), ridge); // valleys darker and warmer`,
      );
      // Bump: tilt the lighting normal along the slope of the ridge pattern, so grooves catch shadow.
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition);
          vec3 dpdy = dFdy(-vViewPosition);
          // The GPU measures slopes over 2x2 pixel blocks, so on fine grooves the bump looks blocky.
          // Only apply it when the grooves are comfortably wider than a few pixels.
          float bumpFade = 1.0 - smoothstep(0.04, 0.18, fwidth(contour));
          float dhdx = dFdx(ridge) * 0.015 * bumpFade;
          float dhdy = dFdy(ridge) * 0.015 * bumpFade;
          vec3 r1 = cross(dpdy, normal);
          vec3 r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      );
    }

    if (glow) {
      // Rim light: surfaces seen edge-on glow softly in their own color, like backlit living tissue.
      fs = fs.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * (0.1 + 0.6 * pow(1.0 - facing, 2.5));`,
      );
    }

    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };

  // three.js reuses compiled shaders between materials that look alike. Our variants differ only
  // inside onBeforeCompile, so we give each combination its own name to keep them apart.
  material.customProgramCacheKey = () => `coral:${maze}:${sway > 0}:${glow}`;
  return material;
}
