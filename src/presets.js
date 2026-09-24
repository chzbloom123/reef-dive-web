import { loadSetting, saveSetting } from './storage.js';

// Graphics presets: one place that decides how much work the visitor's GPU does.
// Low targets integrated Radeon graphics (30+ fps at 1080p); High targets a dedicated GPU (60 fps).
// Values for systems that don't exist yet are first guesses; Milestone 7 tunes them on real hardware.

export const PRESETS = {
  low: {
    name: 'low',
    label: 'Low',
    pixelRatioCap: 1, // never draw more pixels than the screen has (fewer = faster)
    antialias: false, // smoothing jagged edges costs fill-rate an iGPU can't spare
    viewDistance: 32, // meters of scene drawn; the water haze is nearly opaque by ~30 m anyway
    shadows: false,
    shadowMapSize: 0,
    coralDensity: 0.5, // fraction of the full coral scatter
    seagrassCount: 1500,
    fishCount: 90,
    particleCount: 600,
    bloom: false, // post-processing glow
    coralTranslucency: false, // fake light-through-coral shader trick
  },
  high: {
    name: 'high',
    label: 'High',
    pixelRatioCap: 2,
    antialias: true,
    viewDistance: 40,
    shadows: true,
    shadowMapSize: 2048,
    coralDensity: 1,
    seagrassCount: 6000,
    fishCount: 260,
    particleCount: 2500,
    bloom: true,
    coralTranslucency: true,
  },
};

// The choice is remembered in the browser (see storage.js). Low is the default.
export function loadSavedPresetName() {
  const saved = loadSetting('preset', 'low');
  return saved in PRESETS ? saved : 'low';
}

export function savePresetName(name) {
  saveSetting('preset', name);
}
