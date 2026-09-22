// Pool surface: layered sine waves displace the plane; normals are rebuilt
// from finite differences so lighting follows the waves.
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
