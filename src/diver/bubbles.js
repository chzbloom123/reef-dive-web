import * as THREE from 'three';

// Exhaled bubbles from the diver's regulator. Every breath out releases a burst that wobbles up
// past your mask and pops at the surface.
//
// A fixed pool of bubbles is reused: when one pops it goes back to the pool for the next breath.
// That avoids creating and throwing away objects every second, which makes the browser pause now and
// then to clean up memory ("garbage collection") and would cause stutters.
//
// Drawn as points with a shader that paints a bright rim and a clear middle: a bubble is mostly a
// thin reflective shell, so its edge catches light and its center shows the water behind.

export function createBubbles(capacity) {
  const positions = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const bubbles = [];
  for (let i = 0; i < capacity; i++) {
    bubbles.push({ alive: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), size: 0, age: 0, wobble: 0 });
  }
  const geometry = new THREE.BufferGeometry();
  const positionAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttr);
  geometry.setAttribute('aSize', sizeAttr);

  const material = new THREE.ShaderMaterial({
    uniforms: { uPixelScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uPixelScale;
      varying float vAlpha;
      void main() {
        vec4 mv = viewMatrix * vec4(position, 1.0);
        float dist = max(-mv.z, 0.05);
        gl_PointSize = aSize > 0.0 ? uPixelScale * aSize / dist : 0.0;
        vAlpha = smoothstep(0.08, 0.3, dist) * smoothstep(20.0, 6.0, dist);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p) * 2.0;
        if (d > 1.0) discard;
        float rim = smoothstep(0.6, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
        float glint = 1.0 - smoothstep(0.0, 0.18, length(p - vec2(-0.18, 0.18))); // a highlight, lit from above
        float a = (rim * 0.75 + glint * 0.9 + 0.06) * vAlpha;
        gl_FragColor = vec4(vec3(0.9, 0.98, 1.0), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 12;

  let wasExhaling = false;
  let burstLeft = 0;
  let emitTimer = 0;
  const mouth = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();

  function emit(camera) {
    const b = bubbles.find((x) => !x.alive);
    if (!b) return;
    // The regulator is just below your mouth; bubbles spill out to the right of your mask, as with a real regulator.
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    mouth.copy(camera.position).addScaledVector(forward, 0.35).addScaledVector(right, 0.12);
    mouth.y -= 0.3;
    b.alive = true;
    b.position.copy(mouth).add(new THREE.Vector3((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08));
    b.velocity.set((Math.random() - 0.3) * 0.25, 0.4 + Math.random() * 0.4, (Math.random() - 0.5) * 0.15).addScaledVector(right, 0.15);
    b.size = 0.008 + Math.random() * 0.02;
    b.age = 0;
    b.wobble = Math.random() * 10;
  }

  return {
    mesh: points,
    // breath: -1..1 from the diver (below zero = breathing out). active: false on menus / capture.
    update(dt, { breath, camera, renderer, active }) {
      material.uniforms.uPixelScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

      const exhaling = breath < 0;
      if (active && exhaling && !wasExhaling) burstLeft = 14 + Math.floor(Math.random() * 8);
      wasExhaling = exhaling;
      emitTimer -= dt;
      while (burstLeft > 0 && emitTimer <= 0) {
        emit(camera);
        burstLeft--;
        emitTimer += 0.045;
      }
      if (emitTimer < 0) emitTimer = 0;

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        if (b.alive) {
          b.age += dt;
          // Buoyancy keeps pushing up, water drag caps the speed, and bubbles grow as the pressure
          // drops on the way up (Boyle's law: halve the depth pressure → double the volume).
          b.velocity.y += 1.2 * dt;
          b.velocity.multiplyScalar(Math.exp(-1.2 * dt));
          b.position.addScaledVector(b.velocity, dt);
          b.position.x += Math.sin(b.age * 9 + b.wobble) * 0.12 * dt;
          b.position.z += Math.cos(b.age * 7 + b.wobble) * 0.12 * dt;
          b.size *= 1 + 0.02 * dt;
          if (b.position.y > -0.05 || b.age > 25) b.alive = false; // pop at the surface
        }
        positions[i * 3] = b.position.x;
        positions[i * 3 + 1] = b.position.y;
        positions[i * 3 + 2] = b.position.z;
        sizes[i] = b.alive ? b.size : 0;
      }
      positionAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    },
  };
}
