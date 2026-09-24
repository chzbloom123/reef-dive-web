// Reads options from the page address, e.g. ?vp=vp_overview&preset=high&capture=1
// Debug extra: ?cam=x,y,z,tx,ty,tz puts the camera anywhere (position, then the point it looks at).
// These let the screenshot tool (and you) jump straight to a known camera view.

export function readUrlOptions() {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get('preset');
  const cam = params.get('cam')?.split(',').map(Number);
  return {
    viewpoint: params.get('vp'), // name of a camera viewpoint, or null
    preset: preset === 'low' || preset === 'high' ? preset : null,
    capture: params.get('capture') === '1', // skip menus, settle, then signal "ready"
    customCamera: cam?.length === 6 && cam.every(Number.isFinite) ? { position: cam.slice(0, 3), target: cam.slice(3) } : null,
  };
}
