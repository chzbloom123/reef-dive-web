// Graphics presets: one place that decides how much work the visitor's GPU does.
// Low targets integrated Radeon graphics (30+ fps at 1080p); High targets a dedicated GPU (60 fps).
// Values for systems that don't exist yet are first guesses; Milestone 7 tunes them on real hardware.

export const PRESETS = {
  low: {
    name: 'low',
    label: 'Low',
    pixelRatioCap: 1, // never draw more pixels than the screen has (fewer = faster)
    antialias: false, // smoothing jagged edges costs fill-rate an iGPU can't spare
    viewDistance: 30, // meters until the water haze hides everything
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
    viewDistance: 38,
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

const STORAGE_KEY = 'reefDive.preset';

// The browser remembers the choice in localStorage (a small per-site key/value store).
// Some privacy modes block it, so every access is wrapped in try/catch and we fall back to Low.
export function loadSavedPresetName() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved in PRESETS) return saved;
  } catch {
    // storage unavailable; use the default
  }
  return 'low';
}

export function savePresetName(name) {
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // not fatal: the choice just won't be remembered next visit
  }
}
