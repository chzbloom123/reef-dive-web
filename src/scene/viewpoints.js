// Named camera viewpoints, shared with the Godot twin so both builds can be compared shot-for-shot.
//
// World conventions (same as Godot's defaults, so numbers copy straight across):
//   - 1 unit = 1 meter, Y points up.
//   - The water surface is at y = 0, so depth = -y.
//   - The reef is about a basketball court: x from -7.5 to 7.5, z from -14 to 14.
//     The seabed is ~8 m deep at the shallow end (z = +14) and ~18 m at the deep edge (z = -14),
//     where it drops away into the haze (see terrain-height.js). Rock pinnacles rise to ~3.5 m.
//
// This file is plain data (no Three.js import) so the Node capture script can read it too.

export const VIEWPOINTS = {
  vp_overview: {
    position: [0, -6, 17],
    target: [0, -9.5, -6],
  },
  vp_coral_closeup: {
    position: [-1.5, -6.3, 15.1], // a coral-covered ledge at the shallow end
    target: [-3.3, -7.5, 12.6],
  },
  vp_looking_up: {
    position: [0, -9, -2],
    target: [0.8, 0, -5],
  },
  vp_deep_edge: {
    position: [0, -12, -11],
    target: [0, -17, -24],
  },
};

export const VIEWPOINT_NAMES = Object.keys(VIEWPOINTS);

// Accepts a viewpoint name, or a { position, target } object.
export function applyViewpoint(camera, nameOrView) {
  const vp = typeof nameOrView === 'string' ? VIEWPOINTS[nameOrView] : nameOrView;
  if (!vp) return false;
  camera.position.set(...vp.position);
  camera.lookAt(...vp.target);
  return true;
}
