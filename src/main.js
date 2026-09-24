import * as THREE from 'three';
import { readUrlOptions } from './url-options.js';
import { PRESETS, loadSavedPresetName } from './presets.js';
import { createRenderer, handleResize } from './scene/renderer.js';
import { applyViewpoint } from './scene/viewpoints.js';
import { buildHelloReef } from './scene/hello-reef.js';
import { createFpsCounter } from './ui/fps-counter.js';
import { createCaptureSignal } from './capture-signal.js';

// Entry point: set everything up once, then run the render loop forever.
//
//   URL options ─┐
//   saved preset ┴─> preset ─> renderer + scene ─> every frame: update → draw

const options = readUrlOptions();
const preset = PRESETS[options.preset ?? loadSavedPresetName()];

const renderer = createRenderer(document.getElementById('scene'), preset);
const scene = new THREE.Scene();

// 70° vertical field of view feels natural for a dive mask; the far limit matches the preset's haze.
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, preset.viewDistance + 20);
handleResize(renderer, camera);

const reef = buildHelloReef(scene);
applyViewpoint(camera, options.viewpoint ?? 'vp_overview');

const fps = createFpsCounter(preset.label);
const capture = createCaptureSignal(options.capture);

// The Timer measures real time between frames, so motion speed doesn't depend on frame rate.
const timer = new THREE.Timer();
let firstFrame = true;

// setAnimationLoop calls this once per screen refresh (usually 60 times a second).
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // clamp so a stalled tab doesn't cause a huge jump

  if (!options.viewpoint) reef.update(timer.getElapsed(), camera);
  renderer.render(scene, camera);

  fps.update(dt);
  capture.update(dt);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('done');
  }
});
