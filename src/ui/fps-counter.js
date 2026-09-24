// On-screen frame counter. F3 shows/hides it.
// It averages over half a second, because a single frame's time jumps around too much to read.

export function createFpsCounter(presetLabel) {
  const el = document.createElement('div');
  el.id = 'fps';
  document.body.appendChild(el);

  let frames = 0;
  let elapsed = 0;
  let worstMs = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'F3') {
      event.preventDefault(); // F3 is "find next" in browsers; we claim it
      el.classList.toggle('hidden');
    }
  });

  el.textContent = `-- fps\n${presetLabel}`;

  return {
    // Called once per frame with the seconds since the previous frame.
    update(dt) {
      frames += 1;
      elapsed += dt;
      worstMs = Math.max(worstMs, dt * 1000);
      if (elapsed >= 0.5) {
        const fps = frames / elapsed;
        const avgMs = (elapsed / frames) * 1000;
        el.textContent = `${fps.toFixed(0)} fps  ${avgMs.toFixed(1)} ms (worst ${worstMs.toFixed(0)})\n${presetLabel}`;
        frames = 0;
        elapsed = 0;
        worstMs = 0;
      }
    },
  };
}
