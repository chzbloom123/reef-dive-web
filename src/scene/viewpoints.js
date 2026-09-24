// Named camera viewpoints, shared with the Godot twin so both builds can be compared shot-for-shot.
//
// World conventions (same as Godot's defaults, so numbers copy straight across):
//   - 1 unit = 1 meter, Y points up.
//   - The water surface is at y = 0, so depth = -y.
//   - The reef is about a basketball court: x from -7.5 to 7.5, z from -14 to 14.
//     The shallow end is at z = +14; the deep edge drops away past z = -14.
//
// This file is plain data (no Three.js import) so the Node capture script can read it too.
// Positions are provisional until the seabed exists (Milestone 2).

export const VIEWPOINTS = {
  vp_overview: {
    position: [0, -6, 16],
    target: [0, -10, -4],
  },
  vp_coral_closeup: {
    position: [2, -9, 3],
    target: [3.5, -10.5, 0.5],
  },
  vp_looking_up: {
    position: [0, -12, 0],
    target: [0.8, 0, -3],
  },
  vp_deep_edge: {
    position: [0, -12, -11],
    target: [0, -17, -24],
  },
};

export const VIEWPOINT_NAMES = Object.keys(VIEWPOINTS);

export function applyViewpoint(camera, name) {
  const vp = VIEWPOINTS[name];
  if (!vp) return false;
  camera.position.set(...vp.position);
  camera.lookAt(...vp.target);
  return true;
}
