// Decides how much the device can take (frontend guide: "GPU check + mobile fallback").
// Low-end or reduced-motion devices get the photo slider instead of WebGL,
// and no ripple shader or custom cursor.
// Override for testing with ?lite=1 or ?full=1.

export type Capability = {
  reduced: boolean;
  fine: boolean;
  webgl: boolean;
  renderer: string;
  low: boolean;
  ripple: boolean;
  cursor: boolean;
};

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

let cached: Capability | null = null;

export function getCap(): Capability {
  if (cached) return cached;
  const mm = (q: string) => window.matchMedia(q).matches;
  const reduced = mm('(prefers-reduced-motion: reduce)');
  const fine = mm('(hover: hover) and (pointer: fine)');

  let webgl = false;
  let renderer = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      webgl = true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl = false;
  }

  const nav = navigator as Nav;
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 4;
  const software = /swiftshader|llvmpipe|software|basic render|mesa offscreen/i.test(renderer);
  const saveData = nav.connection?.saveData === true;

  let low = !webgl || software || memory < 4 || cores < 4 || reduced || saveData || window.innerWidth < 340;

  const q = new URLSearchParams(location.search);
  if (q.has('lite')) low = true;
  if (q.has('full') && webgl) low = false;

  cached = {
    reduced,
    fine,
    webgl,
    renderer,
    low,
    ripple: webgl && fine && !low,
    cursor: fine && !reduced && !low,
  };
  return cached;
}
