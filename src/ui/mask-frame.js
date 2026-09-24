// The dive-mask lens frame: dark soft edges shaped like a mask's glass, with the nose pocket at the
// bottom center, a faint reflection along the rim, and a slight red/blue color fringe where light
// bends at the edge of the glass (chromatic aberration, like a real lens).
//
// It's one SVG image stretched over the screen. The browser composites it on top of the 3D canvas
// almost for free, which is far cheaper than doing the same with a post-processing shader.

// The glass opening, drawn in a 1600 × 900 box (stretched to any screen shape):
//   a wide rounded window whose bottom edge rises into a nose pocket at the center.
const OPENING = `
  M 175 58
  C 520 22, 1080 22, 1425 58
  C 1560 74, 1592 210, 1592 450
  C 1592 700, 1545 838, 1385 868
  C 1210 892, 1030 884, 950 866
  C 890 852, 858 812, 800 808
  C 742 812, 710 852, 650 866
  C 570 884, 390 892, 215 868
  C 55 838, 8 700, 8 450
  C 8 210, 40 74, 175 58 Z`;

export function createMaskFrame() {
  const wrapper = document.createElement('div');
  wrapper.id = 'mask-frame';
  wrapper.innerHTML = `
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="mask-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="mask-glow" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id="mask-vignette" cx="50%" cy="46%" r="62%">
          <stop offset="62%" stop-color="#021018" stop-opacity="0" />
          <stop offset="100%" stop-color="#021018" stop-opacity="0.55" />
        </radialGradient>
      </defs>
      <!-- vignette: the edges of your view are darker, as in any mask -->
      <rect x="0" y="0" width="1600" height="900" fill="url(#mask-vignette)" />
      <!-- colored fringes just inside the rim -->
      <path d="${OPENING}" fill="none" stroke="#ff4060" stroke-opacity="0.22" stroke-width="10" filter="url(#mask-glow)" transform="translate(-4 -2)" />
      <path d="${OPENING}" fill="none" stroke="#40a0ff" stroke-opacity="0.28" stroke-width="10" filter="url(#mask-glow)" transform="translate(4 2)" />
      <!-- the mask body: everything outside the glass, with a soft inner edge -->
      <path d="M -40 -40 H 1640 V 940 H -40 Z ${OPENING}" fill="#03090c" fill-rule="evenodd" filter="url(#mask-soft)" />
      <!-- a faint highlight where light catches the rim of the glass -->
      <path d="${OPENING}" fill="none" stroke="#bff6ff" stroke-opacity="0.16" stroke-width="3" filter="url(#mask-glow)" />
    </svg>`;
  return wrapper;
}
