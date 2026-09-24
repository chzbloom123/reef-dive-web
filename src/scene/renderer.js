import * as THREE from 'three';

// The renderer turns the scene description (objects, lights, camera) into pixels on the canvas
// using WebGL, the browser's built-in interface to the graphics chip.
export function createRenderer(canvas, preset) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: preset.antialias, // can only be chosen at creation time, so switching presets reloads the page
    powerPreference: 'high-performance', // asks laptops with two GPUs to use the stronger one
  });

  // Pixel ratio = how many drawn pixels per screen pixel. High-DPI screens report 1.5–2,
  // which would make an iGPU draw 2–4x the pixels, so each preset caps it.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // Tone mapping squeezes bright sunlight into the screen's range without harsh clipping.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = preset.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap; // filtered (soft-edged) shadows; softness comes from shadow.radius

  return renderer;
}

// Keep the drawing size and camera shape in step with the browser window.
export function handleResize(renderer, camera) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });
}
