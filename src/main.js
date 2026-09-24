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
import { createSeaLife } from './creatures/sea-life.js';
import { installCaustics, updateCaustics } from './scene/caustics.js';
import { createLightShafts } from './scene/light-shafts.js';
import { createMarineSnow } from './scene/marine-snow.js';
import { createBubbles } from './diver/bubbles.js';
import { createOxygen } from './diver/oxygen.js';
import { createHud } from './ui/hud.js';
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
const seaLife = createSeaLife(preset, { rockField, reefLife });
scene.add(backdrop.mesh, surface.mesh, createWaterLights(preset), rockField.group, seabed, reefLife.group, seaLife.group);

// Atmosphere: caustic light on every lit surface, light shafts, drifting specks, and your bubbles.
installCaustics(scene, preset);
const shafts = createLightShafts(preset.lightShafts);
const snow = createMarineSnow(preset.particleCount);
const bubbles = createBubbles(preset.bubbleCount);
scene.add(shafts.mesh, snow.mesh, bubbles.mesh);

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

const oxygen = createOxygen();
const hud = createHud();
const fps = createFpsCounter(preset.label);
const capture = createCaptureSignal(options.capture);

// The Timer measures real time between frames, so motion speed doesn't depend on frame rate.
const timer = new THREE.Timer();
let firstFrame = true;

// setAnimationLoop calls this once per screen refresh (usually 60 times a second).
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  // Clamp so a stalled tab doesn't cause a huge jump. The very first frame's timestamp can be a hair
  // earlier than the moment the timer started, giving a tiny negative time, hence the max(0, ...).
  const dt = THREE.MathUtils.clamp(timer.getDelta(), 0, 0.1);
  const time = Math.max(0, timer.getElapsed());

  // On the start screen the diver drifts gently behind the menu; paused freezes everything.
  if (state === 'playing' || state === 'start') {
    diver.update(dt, { active: state === 'playing', sensitivity: settings.sensitivity });
  }
  backdrop.update(camera);
  surface.update(time, camera);
  reefTime.value = time;
  if (state === 'playing') oxygen.update(dt, diver.depth, input.isDown('ShiftLeft') || input.isDown('ShiftRight'));
  hud.update({ oxygenLevel: oxygen.level, depthMeters: diver.depth, time });
  if (state !== 'paused') {
    seaLife.update(dt, time, camera.position);
    bubbles.update(dt, { breath: diver.breath, camera, renderer, active: state === 'playing' });
  }
  updateCaustics(time, camera);
  shafts.update(time);
  snow.update(time, renderer, camera);
  renderer.render(scene, camera);

  fps.setInfo(`depth ${diver.depth.toFixed(1)} m  ${diver.speed.toFixed(1)} m/s`);
  fps.update(dt);
  capture.update(dt);

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loading').classList.add('done');
  }
});
