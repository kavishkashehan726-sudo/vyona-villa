// Liquid hover (frontend guide §3). ONE shared WebGL canvas is moved over
// whichever .ripple image is hovered and redraws it with a water-ripple
// displacement centred on the pointer. No per-image contexts.

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uCanvas;     // canvas size, px
uniform vec4 uImg;        // image rect inside canvas (x, y, w, h), px, top-left origin
uniform vec2 uTexSize;    // natural texture size
uniform vec2 uMouse;      // pointer in canvas px, top-left origin
uniform float uTime;
uniform float uStrength;

vec2 coverUv(vec2 p) {
  float ea = uImg.z / uImg.w;
  float ta = uTexSize.x / uTexSize.y;
  vec2 uv = p;
  if (ta > ea) uv.x = (p.x - 0.5) * ea / ta + 0.5;
  else uv.y = (p.y - 0.5) * ta / ea + 0.5;
  return uv;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 p = (px - uImg.xy) / uImg.zw;
  vec2 d = px - uMouse;
  float dist = length(d);
  float wave = sin(dist * 0.055 - uTime * 5.5) * exp(-dist * 0.009) * uStrength;
  vec2 dir = dist > 0.0 ? d / dist : vec2(0.0);
  vec2 off = dir * wave * 0.018;
  vec2 uv = coverUv(p + off);
  float r = texture2D(uTex, coverUv(p + off * 1.25)).r;
  vec3 col = texture2D(uTex, uv).rgb;
  col.r = mix(col.r, r, 0.6);
  col += wave * 0.06;
  gl_FragColor = vec4(col, 1.0);
}`;

const UNIFORMS = ['uTex', 'uCanvas', 'uImg', 'uTexSize', 'uMouse', 'uTime', 'uStrength'] as const;

export function initRipple() {
  const canvas = document.createElement('canvas');
  canvas.className = 'ripple-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return;
  document.body.append(canvas);
  document.documentElement.classList.add('has-ripple');

  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.remove();
    document.documentElement.classList.remove('has-ripple');
    return;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<
    (typeof UNIFORMS)[number],
    WebGLUniformLocation | null
  >;

  const textures = new Map<HTMLImageElement, WebGLTexture>();
  const tex = (img: HTMLImageElement) => {
    const hit = textures.get(img);
    if (hit) return hit;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    if (textures.size > 24) {
      const [k, v] = textures.entries().next().value!;
      gl.deleteTexture(v);
      textures.delete(k);
    }
    textures.set(img, t);
    return t;
  };

  let host: HTMLElement | null = null;
  let img: HTMLImageElement | null = null;
  let mouse = [0, 0] as [number, number];
  let strength = 0;
  let target = 0;
  let raf = 0;
  const t0 = performance.now();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const frame = () => {
    raf = 0;
    // Client navigation can remove the hovered image mid-animation.
    if (!host || !img || !host.isConnected) {
      canvas.classList.remove('is-on');
      host = null;
      return;
    }
    strength += (target - strength) * 0.08;
    const hr = host.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const w = Math.max(1, Math.round(hr.width * dpr));
    const h = Math.max(1, Math.round(hr.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${hr.width}px`;
      canvas.style.height = `${hr.height}px`;
    }
    canvas.style.transform = `translate3d(${hr.left}px, ${hr.top}px, 0)`;
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, tex(img));
    gl.uniform1i(U.uTex, 0);
    gl.uniform2f(U.uCanvas, w, h);
    gl.uniform4f(U.uImg, (ir.left - hr.left) * dpr, (ir.top - hr.top) * dpr, ir.width * dpr, ir.height * dpr);
    gl.uniform2f(U.uTexSize, img.naturalWidth, img.naturalHeight);
    gl.uniform2f(U.uMouse, mouse[0] * dpr, mouse[1] * dpr);
    gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
    gl.uniform1f(U.uStrength, strength);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (target === 0 && strength < 0.01) {
      canvas.classList.remove('is-on');
      host = null;
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const enter = (h: HTMLElement) => {
    const i = h.querySelector<HTMLImageElement>('img.ripple');
    if (!i || !i.classList.contains('is-loaded') || !i.naturalWidth) return;
    host = h;
    img = i;
    target = 1;
    frame();
    canvas.classList.add('is-on');
    kick();
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const h = (e.target as Element | null)?.closest?.<HTMLElement>('.ripple-host') ?? null;
      if (h && h !== host) enter(h);
      if (!h && host) target = 0;
      if (host) {
        const r = host.getBoundingClientRect();
        mouse = [e.clientX - r.left, e.clientY - r.top];
        kick();
      }
    },
    { passive: true },
  );
  window.addEventListener('scroll', () => host && kick(), { passive: true });
}
