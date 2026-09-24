// Small wrapper around localStorage (the browser's per-site key/value store) for remembering settings.
// Some privacy modes block storage entirely, so every access is guarded and falls back to a default.

const PREFIX = 'reefDive.';

export function loadSetting(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveSetting(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // not fatal: the setting just won't be remembered next visit
  }
}
