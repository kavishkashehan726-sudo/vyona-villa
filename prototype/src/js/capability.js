// Decides how much the device can take (frontend guide: "GPU check + mobile fallback").
// Low-end or reduced-motion devices get the photo slider instead of WebGL,
// and no ripple shader or custom cursor.
// Override for testing with ?lite=1 or ?full=1.

export function detect() {
  const mm = (q) => window.matchMedia(q).matches;
  const reduced = mm('(prefers-reduced-motion: reduce)');
  const fine = mm('(hover: hover) and (pointer: fine)');

  let webgl = false;
  let renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      webgl = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl = false;
  }

  const memory = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  const software = /swiftshader|llvmpipe|software|basic render|mesa offscreen/i.test(renderer);
  const saveData = navigator.connection?.saveData === true;

  let low = !webgl || software || memory < 4 || cores < 4 || reduced || saveData || window.innerWidth < 340;

  const q = new URLSearchParams(location.search);
  if (q.has('lite')) low = true;
  if (q.has('full') && webgl) low = false;

  return {
    reduced,
    fine,
    webgl,
    renderer,
    low,
    ripple: webgl && fine && !low,
    cursor: fine && !reduced && !low,
  };
}
