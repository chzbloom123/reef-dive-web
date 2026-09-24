import * as THREE from 'three';
import { readUrlOptions } from './url-options.js';
import { PRESETS, loadSavedPresetName, savePresetName } from './presets.js';
import { loadSetting, saveSetting } from './storage.js';
import { installUnderwaterFog } from './shaders/underwater-fog.js';
import { createRenderer, handleResize } from './scene/renderer.js';
import { applyViewpoint } from './scene/viewpoints.js';
import { createWaterBackdrop, createWaterLights } from './scene/water-optics.js';
import { groundHeightAt } from './scene/terrain-height.js';
import { createRockField } from './scene/rock-field.js';
import { createSeabed } from './scene/seabed.js';
import { createWaterSurface } from './scene/water-surface.js';
import { createReefLife } from './scene/coral/reef-life.js';
import { reefTime } from './scene/coral/coral-material.js';
import { createInput } from './diver/input.js';
import { createDiver } from './diver/diver-controller.js';
import { createStartScreen } from './ui/start-screen.js';
import { createPauseMenu } from './ui/pause-menu.js';
import { createFpsCounter } from './ui/fps-counter.js';
import { createCaptureSignal } from './capture-signal.js';

// Entry point: set everything up once, then run the render loop forever.
//
//   URL options ─┐
//   saved preset ┴─> preset ─> renderer + scene ─> every frame: update → draw
//
// The game is always in one of four states:
//   start ──click──> playing <──Esc / Resume──> paused        (capture: screenshot mode, no menus)

const options = readUrlOptions();
const presetName = options.preset ?? loadSavedPresetName();
const preset = PRESETS[presetName];
const settings = { sensitivity: loadSetting('sensitivity', 1) };

installUnderwaterFog(); // must run before the first frame compiles any shaders

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas, preset);
const scene = new THREE.Scene();

// 70° vertical field of view feels natural for a dive mask; the far limit is the preset's view distance.
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, preset.viewDistance);
handleResize(renderer, camera);

// Turning scene.fog on tells every material to include the fog chunks, which we replaced with water.
// The color and distances here are unused; our water shader has its own physics.
scene.fog = new THREE.Fog(0x000000, 1, 2);
const backdrop = createWaterBackdrop(preset.viewDistance * 0.9);
const surface = createWaterSurface(preset.viewDistance);
const rockField = createRockField(preset);
const seabed = createSeabed(preset, rockField, preset.name === 'high' ? renderer.capabilities.getMaxAnisotropy() : 1);
const reefLife = createReefLife(preset, rockField);
scene.add(backdrop.mesh, surface.mesh, createWaterLights(preset), rockField.group, seabed, reefLife.group);

applyViewpoint(camera, options.customCamera ?? options.viewpoint ?? 'vp_overview');

const input = createInput(canvas);
const diver = createDiver(camera, input, {
  groundHeightAt,
  // Check rock and coral separately; '|' (not '||') so both always run even if the first one pushed.
  collide: (position, radius) => rockField.collide(position, radius) | reefLife.collide(position, radius),
});

let state = options.capture ? 'capture' : 'start';

const startScreen = createStartScreen({ presetLabel: preset.label, onDive: () => input.lock() });
const pauseMenu = createPauseMenu({
  presetName,
  sensitivity: settings.sensitivity,
  onResume: () => input.lock(),
  onPresetChange(name) {
    // Antialiasing is fixed when the renderer is created, so the simplest honest switch is a reload.
    savePresetName(name);
    const url = new URL(window.location.href);
    url.searchParams.delete('preset'); // otherwise the address would override the saved choice
    window.location.replace(url);
  },
  onSensitivityChange(value) {
    settings.sensitivity = value;
    saveSetting('sensitivity', value);
  },
});
if (state === 'start') startScreen.show();

input.onLockChange((locked) => {
  if (locked) {
    state = 'playing';
    startScreen.hide();
    pauseMenu.hide();
  } else if (state === 'playing') {
    state = 'paused';
    pauseMenu.show();
  }
});
input.onLockError(() => {
  if (state === 'paused') pauseMenu.showResumeHint();
});

const fps = createFpsCounter(preset.label);
const capture = createCaptureSignal(options.capture);

// The Timer measures real time between frames, so motion speed doesn't depend on frame rate.
const timer = new THREE.Timer();
let firstFrame = true;

// setAnimationLoop calls this once per screen refresh (usually 60 times a second).
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // clamp so a stalled tab doesn't cause a huge jump

  // On the start screen the diver drifts gently behind the menu; paused freezes everything.
  if (state === 'playing' || state === 'start') {
    diver.update(dt, { active: state === 'playing', sensitivity: settings.sensitivity });
  }
  backdrop.update(camera);
  surface.update(timer.getElapsed(), camera);
  reefTime.value = timer.getElapsed();
  renderer.render(scene, camera);

  fps.setInfo(`depth ${diver.depth.toFixed(1)} m  ${diver.speed.toFixed(1)} m/s`);
  fps.update(dt);
  capture.update(dt);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('done');
  }
});
