import * as THREE from 'three';

// The underside of the sea surface.
//
// The surface is a single flat square; all the waves live in its pixel shader. For each pixel we
// work out the wave slope there, then bend the view ray the way light really bends between water and air:
//
//            sky                  from below, light from the whole sky squeezes into a cone
//      \  |  /   (refracted)      about 97° wide overhead: "Snell's window". Outside that cone
//   ~~~~\~|~/~~~~~ surface ~~~~    the surface acts as a mirror (total internal reflection),
//        \|/                      showing the dark water below.
//        eye
//
// Waves bend the edge of that window and scatter the sun into a bright rippling pattern.
// Everything is computed per pixel from a formula, so there's no texture to download.

export function createWaterSurface(halfSize) {
  const material = new THREE.ShaderMaterial({
    // three.js writes fog values into every fog-enabled material, so the uniforms must exist.
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec3 transformed = position; // name expected by the fog chunk
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      // Brings in waterColor(), SUN_DIR and the fog. Fog is always on in this scene.
      #include <fog_pars_fragment>

      // One travelling sine wave: returns its slope (how steep it is) in x and z.
      vec2 wave(vec2 p, vec2 dir, float wavelength, float speed, float height) {
        float k = 6.2831853 / wavelength;
        return dir * height * k * cos(k * (dot(dir, p) - speed * uTime));
      }

      void main() {
        vec3 toSurface = vWorld - cameraPosition;
        float dist = length(toSurface);
        vec3 view = toSurface / dist;
        float depth = max(-cameraPosition.y, 0.0);

        // Big swells plus small chop. Small waves fade out with distance, where they'd only shimmer.
        vec2 p = vWorld.xz;
        float near = smoothstep(28.0, 6.0, dist);
        vec2 slope = wave(p, normalize(vec2(1.0, 0.3)), 7.0, 1.3, 0.10)
                   + wave(p, normalize(vec2(-0.4, 1.0)), 4.3, 1.0, 0.06)
                   + wave(p, normalize(vec2(0.7, -0.8)), 2.1, 0.8, 0.03)
                   + near * wave(p, normalize(vec2(-0.9, -0.2)), 1.3, 0.6, 0.015)
                   + near * wave(p, normalize(vec2(0.2, -1.0)), 0.8, 0.5, 0.008)
                   + near * wave(p, normalize(vec2(-0.6, 0.7)), 0.55, 0.45, 0.005);
        vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y)); // surface normal, pointing up into the air

        // Bend the ray out through the surface (water index 1.333 → air 1.0).
        vec3 outRay = refract(view, -n, 1.333);
        vec3 mirrored = waterColor(reflect(view, -n), depth) * 0.9;

        vec3 color;
        if (dot(outRay, outRay) < 1e-4) {
          color = mirrored; // too shallow an angle: the light reflects back down
        } else {
          vec3 sky = mix(vec3(0.82, 0.95, 0.98), vec3(0.6, 0.86, 0.97), outRay.y);
          float sun = max(dot(outRay, SUN_DIR), 0.0);
          sky += vec3(1.0, 0.97, 0.88) * (pow(sun, 300.0) * 2.0 + pow(sun, 24.0) * 0.45);
          // Near the window's rim, more light reflects than passes through (the Fresnel effect).
          color = mix(mirrored, sky, smoothstep(0.0, 0.3, outRay.y));
        }

        // Flat patches between waves look bright; steep wave flanks show as darker lines.
        color *= 0.8 + 0.35 * smoothstep(0.22, 0.02, length(slope));

        gl_FragColor = vec4(color, 1.0);
        #include <fog_fragment>
      }
    `,
    fog: true,
    side: THREE.DoubleSide,
    toneMapped: false, // colors above are already final screen colors, like the water backdrop
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(halfSize * 2, halfSize * 2), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(time, camera) {
      material.uniforms.uTime.value = time;
      // Slide the sheet along with the diver so its edge is never in view.
      // The waves use world position, so they stay put while the sheet moves.
      mesh.position.set(camera.position.x, 0, camera.position.z);
    },
  };
}
