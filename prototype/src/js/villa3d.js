// Interactive 3D villa (frontend guide §1). A stylised model of the grounds,
// built in code so the prototype needs no .glb file. In the production build
// this is replaced by the client's Draco-compressed model (see README).
//
// - OrbitControls with the guide's limits: polar π/4 to π/2.1, distance 8 to 25, no pan.
// - Raycast hover: the zone glows and a label follows it.
// - Click: the camera glides to the zone and an info card opens.
// - Custom GLSL water on the pool.
// - Low-power devices get a swipeable photo sequence instead.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';
import waterVert from './water.vert.glsl';
import waterFrag from './water.frag.glsl';
import { setPhoto } from './images.js';
import { $, $$ } from './ui.js';

const C = {
  lawn: 0x7d8a5a,
  lawnDark: 0x6a7a4b,
  sand: 0xe2d6bf,
  lime: 0xf3eee4,
  teak: 0x9c7250,
  teakDark: 0x7a5638,
  roof: 0x6d5444,
  stone: 0xe9e1d2,
  leaf: 0x566b3d,
  leafLight: 0x6f8449,
  trunk: 0x8a7258,
  glass: 0x3a3f2e,
  cushion: 0xf6f1e7,
  bronze: 0xa88b5e,
};

const ZONES = [
  {
    id: 'house', name: 'The rooms', eyebrow: 'Main house',
    text: 'Seven rooms open onto a shaded verandah, each named for an element. Teak floors, high ceilings and ceiling fans turning slowly.',
    photo: 'hero-house', target: [-1, 1.4, -5.2], az: 0.35, anchor: [-1, 4.6, -5.4],
  },
  {
    id: 'pool', name: 'The pool', eyebrow: 'Heart of the garden',
    text: 'A long pool framed by palms and a teak deck. Loungers in the sun, a shade sail for midday, and the first light of the morning across the water.',
    photo: 'pool-long', target: [0, 0.2, 1.4], az: 0.2, anchor: [0, 0.9, 1.4],
  },
  {
    id: 'cottage', name: 'Pool cottage', eyebrow: 'Upstairs rooms',
    text: 'Our two-storey cottage looks straight down onto the pool, with a balcony for watching the sun go down behind the palms.',
    photo: 'hero-pool-cottage', target: [7, 1.6, 0.6], az: 0.95, anchor: [7, 5.3, 0.6],
  },
  {
    id: 'terrace', name: 'Breakfast terrace', eyebrow: 'Mornings',
    text: 'Fresh fruit, eggs any way, hoppers and Ceylon tea, served under the pergola whenever you wake up.',
    photo: 'breakfast-terrace', target: [-7, 0.8, 1.6], az: -0.6, anchor: [-7, 3.1, 1.6],
  },
  {
    id: 'garden', name: 'Garden deck', eyebrow: 'Quiet corners',
    text: 'A timber deck under the big trees at the edge of the garden. Bring a book, or just listen to the birds.',
    photo: 'garden-deck', target: [-2.6, 0.6, 7.2], az: -0.15, anchor: [-2.6, 2.6, 7.2],
  },
];

const HOME = { target: new THREE.Vector3(0, 0.6, 0), r: 21, polar: 0.98, az: 0.62 };

/* ------------------------------------------------------------- geometry */

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function hipRoof(w, d, h) {
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.max(hw - hd, 0.001);
  const v = [
    [-hw, 0, hd], [hw, 0, hd], [r, h, 0], [-hw, 0, hd], [r, h, 0], [-r, h, 0], // front
    [hw, 0, -hd], [-hw, 0, -hd], [-r, h, 0], [hw, 0, -hd], [-r, h, 0], [r, h, 0], // back
    [hw, 0, hd], [hw, 0, -hd], [r, h, 0], // right
    [-hw, 0, -hd], [-hw, 0, hd], [-r, h, 0], // left
  ].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function building(w, h, d, { floors = 1, roofH = 1.6 } = {}) {
  const g = new THREE.Group();
  const wall = std(C.lime);
  const glass = std(C.glass, { roughness: 0.4 });
  const wood = std(C.teakDark);
  g.add(box(w, h, d, wall, 0, h / 2, 0));
  // Windows and doors on the front and sides, one row per floor.
  const fh = h / floors;
  for (let f = 0; f < floors; f++) {
    const cy = f * fh + fh * 0.5;
    const n = Math.max(2, Math.round(w / 1.6));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      const door = f === 0 && i % 2 === 1;
      g.add(box(0.7, door ? fh * 0.72 : fh * 0.42, 0.06, door ? wood : glass, x, door ? fh * 0.36 + f * fh : cy + 0.1, d / 2 + 0.03));
    }
    g.add(box(0.06, fh * 0.42, 0.7, glass, w / 2 + 0.03, cy + 0.1, 0));
    g.add(box(0.06, fh * 0.42, 0.7, glass, -w / 2 - 0.03, cy + 0.1, 0));
    if (f > 0) g.add(box(w + 0.3, 0.12, 0.9, std(C.teak), 0, f * fh, d / 2 + 0.4));
  }
  const roof = new THREE.Mesh(hipRoof(w + 1.2, d + 1.2, roofH), std(C.roof, { roughness: 0.75, side: THREE.DoubleSide }));
  roof.position.y = h;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

function palm(h, lean, rng) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.25, h * 0.45, 0),
    new THREE.Vector3(lean, h, 0),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.11, 6), std(C.trunk));
  trunk.castShadow = true;
  g.add(trunk);

  const len = 2.1;
  const leaf = new THREE.PlaneGeometry(len, 0.55, 8, 1);
  leaf.rotateX(-Math.PI / 2);
  leaf.translate(len / 2, 0, 0);
  const p = leaf.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) / len;
    p.setZ(i, p.getZ(i) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)));
    p.setY(i, -t * t * 1.1 + t * 0.35);
  }
  leaf.computeVertexNormals();
  const top = curve.getPoint(1);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(leaf, std(i % 2 ? C.leaf : C.leafLight, { side: THREE.DoubleSide }));
    m.position.copy(top);
    m.rotation.y = (i / n) * Math.PI * 2 + rng() * 0.4;
    m.rotation.z = 0.25 - rng() * 0.3;
    m.castShadow = true;
    m.userData.sway = rng() * Math.PI * 2;
    g.add(m);
  }
  return g;
}

function shrub(r, color) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), std(color, { flatShading: true }));
  m.scale.y = 0.75;
  m.castShadow = m.receiveShadow = true;
  return m;
}

function tree(rng) {
  const g = new THREE.Group();
  g.add(box(0.28, 2.2, 0.28, std(C.trunk), 0, 1.1, 0));
  for (let i = 0; i < 4; i++) {
    const s = shrub(1.1 + rng() * 0.5, i % 2 ? C.leaf : C.lawnDark);
    s.position.set((rng() - 0.5) * 1.6, 2.6 + rng() * 0.8, (rng() - 0.5) * 1.6);
    g.add(s);
  }
  return g;
}

function lounger(mat) {
  const g = new THREE.Group();
  g.add(box(0.7, 0.18, 1.8, std(C.teak), 0, 0.22, 0));
  g.add(box(0.62, 0.1, 1.2, mat, 0, 0.36, 0.25));
  const back = box(0.62, 0.1, 0.7, mat, 0, 0.55, -0.62);
  back.rotation.x = -0.7;
  g.add(back);
  return g;
}

/* ---------------------------------------------------------------- scene */

function buildScene(scene, rng, lowGpu) {
  const zoneMeshes = new Map(ZONES.map((z) => [z.id, []]));
  const addTo = (zoneId, obj) => {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.userData.zone = zoneId;
        zoneMeshes.get(zoneId).push(o);
      }
    });
    scene.add(obj);
    return obj;
  };

  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), std(C.lawn));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sand paths
  const path = std(C.sand);
  const p1 = box(1.4, 0.03, 12, path, 3.2, 0.015, 8);
  const p2 = box(10, 0.03, 1.2, path, -4, 0.015, -1.6);
  scene.add(p1, p2);

  // Pool: deck, stone coping, water
  const deck = addTo('pool', box(11.5, 0.12, 6.4, std(C.teak), 0, 0.06, 1.8));
  deck.castShadow = false;
  const stone = std(C.stone);
  addTo('pool', box(8, 0.2, 0.4, stone, 0, 0.14, -0.3));
  addTo('pool', box(8, 0.2, 0.4, stone, 0, 0.14, 3.1));
  addTo('pool', box(0.4, 0.2, 3.8, stone, -3.8, 0.14, 1.4));
  addTo('pool', box(0.4, 0.2, 3.8, stone, 3.8, 0.14, 1.4));
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: waterVert,
    fragmentShader: waterFrag,
    uniforms: {
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uDeep: { value: new THREE.Color(0x1f6f73) },
      uShallow: { value: new THREE.Color(0x6fc2bb) },
      uSky: { value: new THREE.Color(0xdfe9e4) },
      uSun: { value: new THREE.Color(0xfff3dc) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
    },
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3, lowGpu ? 40 : 90, lowGpu ? 18 : 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.16, 1.4);
  addTo('pool', water);

  const cushion = std(C.cushion);
  [-2.7, -1.6, 1.6, 2.7].forEach((x) => {
    const l = lounger(cushion);
    l.position.set(x, 0.1, 4.2);
    l.rotation.y = Math.PI;
    addTo('pool', l);
  });
  // Shade sail over the deep end
  const sail = new THREE.BufferGeometry();
  sail.setAttribute('position', new THREE.Float32BufferAttribute([-4.8, 3.2, 4.8, -1.4, 3.6, 5, -4.4, 2.8, 0.6], 3));
  sail.computeVertexNormals();
  const sailMesh = new THREE.Mesh(sail, std(C.cushion, { side: THREE.DoubleSide, roughness: 1 }));
  sailMesh.castShadow = true;
  addTo('pool', sailMesh);
  [[-4.8, 4.8], [-1.4, 5], [-4.4, 0.6]].forEach(([x, z]) => addTo('pool', box(0.08, 3.4, 0.08, std(C.teakDark), x, 1.7, z)));

  // Main house with a verandah
  const house = building(9, 3.1, 4.4);
  house.position.set(-1, 0, -5.4);
  addTo('house', house);
  const verandah = box(10, 0.14, 1.6, std(C.teak), -1, 0.07, -2.4);
  addTo('house', verandah);
  for (let i = 0; i < 6; i++) addTo('house', box(0.16, 3.1, 0.16, std(C.lime), -5.4 + i * 1.76, 1.55, -1.75));
  const swing = box(1.2, 0.1, 0.45, std(C.teakDark), 1.8, 0.8, -2.2);
  addTo('house', swing);

  // Two-storey pool cottage
  const cottage = building(3.6, 4.4, 3.2, { floors: 2, roofH: 1.3 });
  cottage.position.set(7, 0, 0.6);
  cottage.rotation.y = -Math.PI / 2;
  addTo('cottage', cottage);

  // Breakfast terrace with a pergola
  const terrace = new THREE.Group();
  terrace.add(box(4, 0.14, 4, std(C.teak), 0, 0.07, 0));
  const post = std(C.lime);
  [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]].forEach(([x, z]) => terrace.add(box(0.16, 2.6, 0.16, post, x, 1.3, z)));
  for (let i = 0; i < 7; i++) terrace.add(box(0.1, 0.1, 4.2, std(C.teakDark), -1.8 + i * 0.6, 2.62, 0));
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 20), std(C.teakDark));
  table.position.y = 0.8;
  table.castShadow = true;
  terrace.add(table, box(0.12, 0.72, 0.12, std(C.teakDark), 0, 0.4, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    terrace.add(box(0.45, 0.5, 0.45, std(C.cushion), Math.cos(a) * 1.15, 0.3, Math.sin(a) * 1.15));
  }
  terrace.position.set(-7, 0, 1.6);
  addTo('terrace', terrace);

  // Garden deck under the big trees
  const gdeck = new THREE.Group();
  gdeck.add(box(3.4, 0.16, 2.6, std(C.teak), 0, 0.08, 0));
  gdeck.add(box(1.4, 0.07, 0.8, std(C.teakDark), 0, 0.75, 0), box(0.1, 0.65, 0.1, std(C.teakDark), 0, 0.42, 0));
  [-0.9, 0.9].forEach((x) => gdeck.add(box(0.5, 0.45, 0.5, std(C.cushion), x, 0.36, 0)));
  gdeck.position.set(-2.6, 0, 7.2);
  addTo('garden', gdeck);
  [[-5.2, 8.6], [-0.2, 9.4], [-4.4, 5.2]].forEach(([x, z]) => {
    const t = tree(rng);
    t.position.set(x, 0, z);
    addTo('garden', t);
  });

  // Palms and planting (decor, not interactive)
  const palms = [];
  [[-4.6, -0.8, 6.2], [4.6, 4.8, 5.6], [-3.6, 4.6, 6.8], [5.4, -3.2, 7.2], [-9.2, -2.4, 6.6], [9.8, 4.2, 5.8],
    [-10.6, 5.4, 7], [2.4, -9, 7.4], [-6, -9.2, 6.4], [10.4, -5.4, 6.2], [0.6, 7.2, 5.4], [-9.4, 9.6, 6]].forEach(([x, z, h]) => {
    const p = palm(h, (rng() - 0.5) * 1.4, rng);
    p.position.set(x, 0, z);
    p.rotation.y = rng() * Math.PI * 2;
    scene.add(p);
    palms.push(p);
  });
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 11 + rng() * 7;
    const s = shrub(0.5 + rng() * 0.9, rng() > 0.5 ? C.leaf : C.lawnDark);
    s.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
    scene.add(s);
  }
  [[-6, -3.4], [4, -3.3], [-2.8, -8.4], [6.2, 4.4], [-8.6, 4.2]].forEach(([x, z]) => {
    const s = shrub(0.55, C.leafLight);
    s.position.set(x, 0.35, z);
    scene.add(s);
  });

  // Hover rings on the ground, one per zone
  const rings = new Map();
  ZONES.forEach((z) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.78, 48),
      new THREE.MeshBasicMaterial({ color: C.bronze, transparent: true, opacity: 0, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(z.target[0], 0.2, z.target[2]);
    ring.scale.setScalar(z.id === 'house' ? 3.2 : z.id === 'pool' ? 2.8 : 1.6);
    scene.add(ring);
    rings.set(z.id, ring);
  });

  return { zoneMeshes, rings, water, palms };
}

/* ------------------------------------------------------------ fallback */

const SLIDES = [
  ['hero-pool-aerial', 'The pool from above'],
  ['pool-long', 'The pool'],
  ['hero-house', 'The main house'],
  ['hero-pool-cottage', 'The pool cottage'],
  ['breakfast-terrace', 'Breakfast terrace'],
  ['garden-deck', 'Garden deck'],
];

function initFallback(stage) {
  stage.hidden = true;
  $('.villa3d .section-head__aside').textContent = 'Swipe through the grounds, from the pool to the garden.';
  const wrap = $('[data-villa3d-fallback]');
  const slider = $('[data-slider]');
  const count = $('[data-slider-count]');
  wrap.hidden = false;
  slider.innerHTML = SLIDES.map(([, cap], i) => `<figure><img alt="${cap}"><figcaption>${i + 1} · ${cap}</figcaption></figure>`).join('');
  $$('img', slider).forEach((img, i) => setPhoto(img, SLIDES[i][0]));
  const figs = $$('figure', slider);
  const current = () => {
    const x = slider.scrollLeft + slider.clientWidth / 2;
    return figs.reduce((best, f, i) => (Math.abs(f.offsetLeft + f.clientWidth / 2 - x) < Math.abs(figs[best].offsetLeft + figs[best].clientWidth / 2 - x) ? i : best), 0);
  };
  const go = (d) => {
    const i = Math.max(0, Math.min(figs.length - 1, current() + d));
    slider.scrollTo({ left: figs[i].offsetLeft - (slider.clientWidth - figs[i].clientWidth) / 2, behavior: 'smooth' });
  };
  slider.addEventListener('scroll', () => (count.textContent = `${current() + 1} / ${figs.length}`), { passive: true });
  slider.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  });
  $('[data-slider-prev]').addEventListener('click', () => go(-1));
  $('[data-slider-next]').addEventListener('click', () => go(1));
  count.textContent = `1 / ${figs.length}`;
}

/* ------------------------------------------------------------------ main */

function start(stage, cap) {
  const canvas = $('canvas', stage);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    initFallback(stage);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6ded1);
  scene.fog = new THREE.Fog(0xe6ded1, 34, 62);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  const sph = (target, r, polar, az) =>
    new THREE.Vector3().setFromSpherical(new THREE.Spherical(r, polar, az)).add(target);
  camera.position.copy(sph(HOME.target, HOME.r, HOME.polar, HOME.az));

  scene.add(new THREE.HemisphereLight(0xfdf6ea, 0x5d6644, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.4);
  sun.position.set(12, 18, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(window.innerWidth < 900 ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 50 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const { zoneMeshes, rings, water, palms } = buildScene(scene, rng, window.innerWidth < 700);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 8;
  controls.maxDistance = 25;
  controls.rotateSpeed = 0.6;
  controls.autoRotate = !cap.reduced;
  controls.autoRotateSpeed = 0.35;
  // Don't hijack page scrolling: zoom only once the visitor engages the scene.
  controls.enableZoom = false;
  stage.addEventListener('pointerdown', () => (controls.enableZoom = true), true);
  stage.addEventListener('pointerleave', () => (controls.enableZoom = false));
  controls.update();

  const tag = $('[data-villa3d-tag]', stage);
  const card = $('[data-villa3d-card]', stage);
  const zoneList = $('[data-villa3d-zones]', stage);
  zoneList.innerHTML = ZONES.map((z) => `<li><button type="button" data-zone="${z.id}" aria-pressed="false">${z.name}</button></li>`).join('');

  const hits = [...zoneMeshes.values()].flat();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;
  let selected = null;
  let idleTimer = 0;

  const glow = (id, on) => {
    if (!id) return;
    zoneMeshes.get(id).forEach((m) => {
      if (m.material.emissive) {
        m.material.emissive.setHex(C.bronze);
        m.material.emissiveIntensity = on ? 0.28 : 0;
      }
    });
    if (id === 'pool') water.material.uniforms.uGlow.value = on ? 1 : 0;
  };

  const pickAt = (x, y) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.zone : null;
  };

  const setHover = (id) => {
    if (id === hovered) return;
    if (hovered !== selected) glow(hovered, false);
    hovered = id;
    if (id) glow(id, true);
    canvas.style.cursor = id ? 'pointer' : '';
    tag.hidden = !id;
    if (id) tag.textContent = `✨ ${ZONES.find((z) => z.id === id).name} · Tap to inspect`;
  };

  const fly = (target, r, polar, az, onDone) => {
    const to = sph(target, r, polar, az);
    gsap.to(camera.position, { x: to.x, y: to.y, z: to.z, duration: cap.reduced ? 0 : 1.6, ease: 'power3.inOut', onComplete: onDone });
    gsap.to(controls.target, { x: target.x, y: target.y, z: target.z, duration: cap.reduced ? 0 : 1.6, ease: 'power3.inOut' });
  };

  const select = (id) => {
    const z = ZONES.find((q) => q.id === id);
    if (!z) return;
    if (selected && selected !== id) glow(selected, false);
    selected = id;
    glow(id, true);
    controls.autoRotate = false;
    clearTimeout(idleTimer);
    const target = new THREE.Vector3(...z.target);
    const narrow = stage.clientWidth < 700;
    fly(target, narrow ? 13 : 10, 1.05, z.az);
    $('.eyebrow', card).textContent = z.eyebrow;
    $('h3', card).textContent = z.name;
    $('.villa3d__card-text', card).textContent = z.text;
    const img = $('img', card);
    img.alt = z.name;
    setPhoto(img, z.photo, { eager: true });
    card.hidden = false;
    $$('button', zoneList).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.zone === id)));
  };

  const home = () => {
    glow(selected, false);
    selected = null;
    card.hidden = true;
    $$('button', zoneList).forEach((b) => b.setAttribute('aria-pressed', 'false'));
    fly(HOME.target, HOME.r, HOME.polar, HOME.az, () => {
      if (!cap.reduced) controls.autoRotate = true;
    });
  };

  zoneList.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zone]');
    if (b) select(b.dataset.zone);
  });
  zoneList.addEventListener('pointerover', (e) => setHover(e.target.closest('[data-zone]')?.dataset.zone || null));
  zoneList.addEventListener('pointerleave', () => setHover(null));
  $('[data-villa3d-close]', card).addEventListener('click', home);
  stage.addEventListener('keydown', (e) => e.key === 'Escape' && selected && home());

  let pendingMove = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') pendingMove = [e.clientX, e.clientY];
  });
  canvas.addEventListener('pointerleave', () => {
    pendingMove = null;
    setHover(null);
  });
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = [e.clientX, e.clientY];
    controls.autoRotate = false;
    clearTimeout(idleTimer);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) {
      const id = pickAt(e.clientX, e.clientY);
      if (id) select(id);
    }
    down = null;
    if (!selected && !cap.reduced) idleTimer = setTimeout(() => (controls.autoRotate = true), 5000);
  });

  const resize = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 48 : 38;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  const anchor = new THREE.Vector3();
  const clock = new THREE.Clock();
  const loading = $('[data-villa3d-loading]', stage);
  let first = true;

  const tick = () => {
    const t = clock.getElapsedTime();
    if (pendingMove) {
      setHover(pickAt(...pendingMove));
      pendingMove = null;
    }
    water.material.uniforms.uTime.value = t;
    rings.forEach((ring, id) => {
      const on = id === hovered || id === selected;
      ring.material.opacity += ((on ? 0.55 + Math.sin(t * 3) * 0.2 : 0) - ring.material.opacity) * 0.12;
    });
    if (!cap.reduced) {
      palms.forEach((p) =>
        p.children.forEach((c, i) => {
          if (i) c.rotation.x = Math.sin(t * 0.9 + c.userData.sway) * 0.05;
        })
      );
    }
    if (hovered) {
      anchor.set(...ZONES.find((z) => z.id === hovered).anchor).project(camera);
      const x = (anchor.x * 0.5 + 0.5) * stage.clientWidth;
      const y = (-anchor.y * 0.5 + 0.5) * stage.clientHeight;
      tag.style.setProperty('--x', `${x}px`);
      tag.style.setProperty('--y', `${y}px`);
    }
    controls.update();
    renderer.render(scene, camera);
    if (first) {
      first = false;
      loading.classList.add('is-done');
      stage.dataset.ready = 'true';
    }
  };

  // Render only while the stage is on screen.
  new IntersectionObserver(([e]) => renderer.setAnimationLoop(e.isIntersecting ? tick : null)).observe(stage);
}

export function initVilla(cap) {
  const stage = $('[data-villa3d]');
  if (!stage) return;
  if (cap.low) {
    initFallback(stage);
    return;
  }
  if (!('IntersectionObserver' in window)) return start(stage, cap);
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      start(stage, cap);
    },
    { rootMargin: '500px 0px' }
  );
  io.observe(stage);
}
