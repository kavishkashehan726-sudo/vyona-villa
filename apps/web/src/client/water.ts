// Pool water shaders (frontend guide §1: "custom GLSL water").

// Layered sine waves displace the plane; normals are rebuilt from finite
// differences so lighting follows the waves.
export const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;

float wave(vec2 p) {
  return sin(p.x * 1.7 + uTime * 1.3) * 0.030
       + sin(p.y * 2.4 - uTime * 1.6) * 0.022
       + sin((p.x + p.y) * 3.3 + uTime * 2.2) * 0.010;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  float h = wave(pos.xy);
  pos.z += h;
  float e = 0.05;
  float hx = wave(pos.xy + vec2(e, 0.0)) - h;
  float hy = wave(pos.xy + vec2(0.0, e)) - h;
  vec3 n = normalize(vec3(-hx / e, -hy / e, 1.0));
  vNormalW = normalize(mat3(modelMatrix) * n);
  vec4 w = modelMatrix * vec4(pos, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

// Depth tint (shallow at the edges), animated caustics, fresnel sky
// reflection and a sun glint. uGlow lights it up on hover.
export const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uGlow;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDir;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormalW;

float caustic(vec2 p) {
  float c = 0.0;
  vec2 q = p;
  for (int i = 0; i < 3; i++) {
    q += vec2(sin(q.y * 1.7 + uTime * 0.7), cos(q.x * 1.9 - uTime * 0.6)) * 0.4;
    c += 0.45 / (1.0 + 14.0 * abs(sin(q.x * 2.2) + sin(q.y * 2.0)));
  }
  return c;
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = mix(0.03, 1.0, pow(1.0 - max(dot(N, V), 0.0), 4.0));

  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  vec3 base = mix(uShallow, uDeep, smoothstep(0.0, 0.22, edge));
  base += caustic(vWorld.xz * 1.5) * 0.22 * vec3(0.9, 1.0, 0.95);

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0) * 1.6;

  vec3 col = mix(base, uSky, fres * 0.7) + spec * uSun;
  col += uGlow * vec3(0.66, 0.55, 0.37) * 0.4;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
