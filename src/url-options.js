// Reads options from the page address, e.g. ?vp=vp_overview&preset=high&capture=1
// These let the screenshot tool (and you) jump straight to a known camera view.

export function readUrlOptions() {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get('preset');
  return {
    viewpoint: params.get('vp'), // name of a camera viewpoint, or null
    preset: preset === 'low' || preset === 'high' ? preset : null,
    capture: params.get('capture') === '1', // skip menus, settle, then signal "ready"
  };
}
