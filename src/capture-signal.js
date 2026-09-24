// In capture mode, the screenshot tool waits for this page to say "ready".
// We let the scene run for a couple of seconds first, so shaders compile, fish settle into
// their schools, and nothing is caught mid-load.

const SETTLE_SECONDS = 2;
const MIN_FRAMES = 30;

export function createCaptureSignal(enabled) {
  let elapsed = 0;
  let frames = 0;
  let done = !enabled;

  if (enabled) document.body.classList.add('capture');

  return {
    update(dt) {
      if (done) return;
      elapsed += dt;
      frames += 1;
      if (elapsed >= SETTLE_SECONDS && frames >= MIN_FRAMES) {
        done = true;
        window.__reefReady = true; // the capture script polls for this flag
      }
    },
  };
}
