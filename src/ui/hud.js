import { createMaskFrame } from './mask-frame.js';

// The dive-mask HUD: lens frame and vignette, oxygen gauge (bottom left), depth meter (bottom right),
// and a faint center reticle. It's plain HTML and SVG over the 3D canvas, and it only touches the page
// when a displayed value actually changes; rewriting text every frame would make the browser
// re-lay-out the page 60 times a second for nothing.
//
//   oxygen gauge            depth meter
//     ___                   DEPTH: 12 m
//    /   \  OXYGEN          0 |||||||▼|||||||||| 25
//    | 78%

const DEPTH_SCALE_MAX = 25; // meters shown on the depth ruler
const ARC_FRACTION = 0.7; // the oxygen arc covers 70% of a circle (252°)
const ARC_RADIUS = 52;
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS * ARC_FRACTION;

export function createHud() {
  const root = document.createElement('div');
  root.id = 'hud';
  root.append(createMaskFrame());

  const oxygen = document.createElement('div');
  oxygen.className = 'hud-panel hud-oxygen';
  oxygen.innerHTML = `
    <svg viewBox="0 0 140 140" class="oxygen-arc" aria-hidden="true">
      <!-- rotated so the arc opens at the bottom and fills from the lower left, clockwise over the top -->
      <g transform="rotate(144 70 70)">
        <circle class="arc-track" cx="70" cy="70" r="${ARC_RADIUS}" />
        <circle class="arc-fill" cx="70" cy="70" r="${ARC_RADIUS}" />
      </g>
    </svg>
    <div class="oxygen-text">
      <span class="hud-label">Oxygen</span>
      <span class="oxygen-value">100%</span>
    </div>
    <div class="oxygen-warning">Low air: surface to refill</div>`;
  const track = oxygen.querySelector('.arc-track');
  const fill = oxygen.querySelector('.arc-fill');
  // An arc drawn with a dashed circle: one dash as long as the arc, one gap for the rest.
  // Shortening the first dash "drains" the gauge.
  track.style.strokeDasharray = `${ARC_LENGTH} 999`;
  const oxygenValue = oxygen.querySelector('.oxygen-value');
  const warning = oxygen.querySelector('.oxygen-warning');

  const depth = document.createElement('div');
  depth.className = 'hud-panel hud-depth';
  const ticks = [];
  for (let m = 0; m <= DEPTH_SCALE_MAX; m++) {
    const major = m % 5 === 0;
    ticks.push(`<line x1="${m * 8 + 10}" y1="${major ? 6 : 11}" x2="${m * 8 + 10}" y2="20" class="${major ? 'tick-major' : 'tick'}" />`);
    if (major) ticks.push(`<text x="${m * 8 + 10}" y="32" class="tick-label">${m}</text>`);
  }
  depth.innerHTML = `
    <div class="depth-readout"><span class="hud-label">Depth:</span> <span class="depth-value">0</span><span class="depth-unit">m</span></div>
    <svg viewBox="0 0 220 36" class="depth-ruler" aria-hidden="true">
      <line x1="10" y1="20" x2="${DEPTH_SCALE_MAX * 8 + 10}" y2="20" class="tick" />
      ${ticks.join('')}
      <path class="depth-pointer" d="M -5 -1 L 5 -1 L 0 6 Z" />
    </svg>`;
  const depthValue = depth.querySelector('.depth-value');
  const pointer = depth.querySelector('.depth-pointer');

  const reticle = document.createElement('div');
  reticle.className = 'hud-reticle';

  root.append(oxygen, depth, reticle);
  document.body.append(root);

  let shownOxygen = -1;
  let shownDepth = -1;
  let shownPointer = -1;
  let shownState = '';

  return {
    update({ oxygenLevel, depthMeters, time }) {
      const pct = Math.round(oxygenLevel * 100);
      if (pct !== shownOxygen) {
        shownOxygen = pct;
        oxygenValue.textContent = `${pct}%`;
        fill.style.strokeDasharray = `${ARC_LENGTH * oxygenLevel} 999`;
      }
      const state = oxygenLevel < 0.1 ? 'critical' : oxygenLevel < 0.25 ? 'low' : 'ok';
      if (state !== shownState) {
        shownState = state;
        oxygen.dataset.state = state; // CSS turns the gauge amber/red and pulses it
      }
      if (state !== 'ok') warning.style.opacity = String(0.55 + 0.45 * Math.sin(time * 4));

      const d = Math.max(0, Math.round(depthMeters));
      if (d !== shownDepth) {
        shownDepth = d;
        depthValue.textContent = String(d);
      }
      const x = Math.round((Math.min(depthMeters, DEPTH_SCALE_MAX) * 8 + 10) * 4) / 4;
      if (x !== shownPointer) {
        shownPointer = x;
        pointer.setAttribute('transform', `translate(${x} 6)`);
      }
    },
  };
}
