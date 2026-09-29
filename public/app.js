import * as THREE from './vendor/three.module.min.js';
import { crearHistoria } from './historia.js';

const $ = (s) => document.querySelector(s);
const TAU = Math.PI * 2;
const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;
const params = new URLSearchParams(location.search);

/* ---------- Motor ---------- */

const canvas = $('#cielo');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// Calidad según el aparato: la vista previa del panel va ligera, los teléfonos en calidad media.
const esMovil = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const CALIDAD = params.has('pc') ? 'baja' : esMovil ? 'media' : 'alta';
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, { alta: 2, media: 1.5, baja: 0.75 }[CALIDAD]));
// Si el teléfono se queda sin memoria gráfica, la página se recarga sola en vez de quedarse congelada.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setTimeout(() => location.reload(), 1200); });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 3000);
camera.rotation.order = 'YXZ';
const cielo = new THREE.Group();
scene.add(cielo);
const lejano = new THREE.Group();
lejano.rotation.order = 'ZXY';
lejano.rotation.z = rad(35);
cielo.add(lejano);

const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const aniso = renderer.capabilities.getMaxAnisotropy();
function tex(url, srgb = false) {
  const t = loader.load(url);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function dir(az, el) {
  const a = rad(az), e = rad(el);
  return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a));
}

/* ---------- Materiales ---------- */

const V_PLANETA = `
varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

// Iluminación propia por cuerpo: cada planeta tiene su propio "Sol", así la Luna
// puede verse gibosa mientras Venus cambia de fase y Júpiter se ve lleno.
const F_PLANETA = `
uniform sampler2D uMap; uniform vec3 uLuz; uniform float uBump; uniform float uAmb;
uniform float uInt; uniform float uAtm; uniform vec3 uAtmColor;
varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  vec3 n = normalize(vN);
  vec3 L = normalize(uLuz);
  float dg = dot(n, L);
  vec3 nb = n;
  if (uBump > 0.0) {
    float h = dot(c, vec3(0.299, 0.587, 0.114));
    vec2 dh = vec2(dFdx(h), dFdy(h)) * uBump;
    vec3 sx = dFdx(vPos), sy = dFdy(vPos);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 g = sign(det) * (dh.x * r1 + dh.y * r2);
    nb = normalize(abs(det) * n - g);
  }
  float term = smoothstep(-0.03, 0.2, dg);
  float dif = max(dot(nb, L), 0.0);
  vec3 col = c * (uAmb + term * uInt * (0.12 + 0.88 * dif));
  float rim = pow(1.0 - max(dot(n, normalize(-vPos)), 0.0), 2.5);
  col += uAtmColor * rim * uAtm * smoothstep(-0.25, 0.35, dg);
  gl_FragColor = vec4(col, 1.0);
}`;

const iluminados = [];
function planeta(r, map, grupo, luz, { bump = 0, amb = 0.02, int = 1.3, atm = 0, atmColor = 0xffffff, seg = 96 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map }, uLuz: { value: new THREE.Vector3() }, uBump: { value: bump },
      uAmb: { value: amb }, uInt: { value: int }, uAtm: { value: atm },
      uAtmColor: { value: new THREE.Color(atmColor) },
    },
    vertexShader: V_PLANETA,
    fragmentShader: F_PLANETA,
  });
  iluminados.push({ mat, grupo, luz });
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat);
}

const haloTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,.1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
function halo(color, tam, opacidad) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: haloTex, color, transparent: true, opacity: opacidad,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.set(tam, tam, 1);
  return s;
}

function cuerpo(az, el, dist) {
  const g = new THREE.Group();
  g.position.copy(dir(az, el).multiplyScalar(dist));
  g.lookAt(0, 0, 0);
  g.userData.az = az;
  g.userData.el = el;
  cielo.add(g);
  return g;
}

/* ---------- Cielo ---------- */

// Los teléfonos usan la Vía Láctea en 4K (la de 8K agota la memoria gráfica); la historia reutiliza esta misma.
const texturaVia = tex(CALIDAD === 'alta' ? 'tex/8k_stars_milky_way.jpg' : 'tex/4k_stars_milky_way.jpg', true);

// El zoom lo controla solo la PC: se bloquea el pellizco y el doble toque del navegador (iPhone los permite igual).
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let ultimoToqueFin = 0;
document.addEventListener('touchend', (e) => { const a = Date.now(); if (a - ultimoToqueFin < 350) e.preventDefault(); ultimoToqueFin = a; }, { passive: false });

const fondo = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 128, 64),
  new THREE.MeshBasicMaterial({
    map: texturaVia,
    side: THREE.BackSide, depthWrite: false,
    color: new THREE.Color(2.6, 2.6, 2.8),
  })
);
fondo.scale.x = -1;
fondo.rotation.set(rad(58), rad(-35), rad(18));
lejano.add(fondo);

const estrellasMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute float aSize; attribute vec3 aColor; attribute float aFase;
    uniform float uTime; uniform float uPR; varying vec3 vC;
    void main() {
      float tw = 0.6 + 0.4 * sin(uTime * (1.0 + aFase * 2.5) + aFase * 40.0);
      vC = aColor * tw;
      gl_PointSize = aSize * uPR;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying vec3 vC;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vC * a * a, 1.0);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
{
  const n = 3500;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const tam = new Float32Array(n), fase = new Float32Array(n);
  const tintes = [[1, 1, 1], [1, 0.93, 0.82], [0.8, 0.87, 1], [1, 0.85, 0.7]];
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(900);
    pos.set([v.x, v.y, v.z], i * 3);
    const b = 0.45 + Math.random() * 0.55;
    const t = tintes[(Math.random() * 4) | 0];
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    tam[i] = 1.4 + Math.pow(Math.random(), 7) * 5;
    fase[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(tam, 1));
  g.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  lejano.add(new THREE.Points(g, estrellasMat));
}

/* ---------- La Luna ---------- */

const gLuna = cuerpo(0, 18, 50);
const luzLuna = new THREE.Vector3(1, 0.15, 0.55);
const luna = planeta(6, tex('tex/2k_moon.jpg'), gLuna, luzLuna, { bump: 0.7, amb: 0.035, int: 1.5, seg: 192 });
luna.rotation.y = -Math.PI / 2;
gLuna.add(luna, halo(0xfff8ea, 15, 0.12));

/* ---------- Júpiter y las Estrellas Mediceas ---------- */

function texLunaGalileana(base, manchas, semilla) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 128);
  let s = semilla;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 90; i++) {
    g.fillStyle = manchas[(r() * manchas.length) | 0];
    g.globalAlpha = 0.25 + r() * 0.5;
    g.beginPath();
    g.ellipse(r() * 256, 10 + r() * 108, 2 + r() * 14, 2 + r() * 8, r() * 3, 0, TAU);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = aniso;
  return t;
}

const gJup = cuerpo(90, 28, 45);
const luzJup = new THREE.Vector3(0.35, 0.12, 1);
const jupiter = planeta(2.4, tex('tex/2k_jupiter.jpg'), gJup, luzJup, { amb: 0.015, int: 1.35, atm: 0.25, atmColor: 0xffe6c0 });
gJup.add(jupiter, halo(0xffe2b0, 10, 0.28));

const orbitas = new THREE.Group();
orbitas.rotation.set(rad(7), 0, rad(-4));
gJup.add(orbitas);
const MEDICEAS = [
  { a: 3.8, P: 1.769, f: 0.4, r: 0.36, tex: texLunaGalileana('#e2c65a', ['#b8701f', '#f3e39a', '#4a2e10', '#d99a3a'], 11) },
  { a: 5.3, P: 3.551, f: 2.3, r: 0.31, tex: texLunaGalileana('#e6dfd2', ['#a47d5c', '#c9b8a0', '#fffaf0'], 23) },
  { a: 7.2, P: 7.155, f: 4.1, r: 0.52, tex: texLunaGalileana('#978a78', ['#5f5547', '#cfc4b2', '#7a6d5d'], 37) },
  { a: 9.8, P: 16.69, f: 5.4, r: 0.47, tex: texLunaGalileana('#5f5447', ['#3a3128', '#b9ad98', '#7d705f'], 53) },
];
for (const m of MEDICEAS) {
  m.mesh = planeta(m.r, m.tex, gJup, luzJup, { amb: 0.02, int: 1.4, seg: 48 });
  m.mesh.add(halo(0xfff4dc, m.r * 6, 0.35));
  orbitas.add(m.mesh);
}

/* ---------- Saturno ---------- */

const gSat = cuerpo(200, 34, 45);
const luzSat = new THREE.Vector3(-0.35, 0.3, 1);
const sistemaSat = new THREE.Group();
sistemaSat.rotation.set(rad(-64), rad(8), rad(-12));
gSat.add(sistemaSat, halo(0xffe6b0, 16, 0.18));
const RS = 2.5;
const saturno = planeta(RS, tex('tex/2k_saturn.jpg'), gSat, luzSat, { amb: 0.015, int: 1.35, atm: 0.2, atmColor: 0xfff0c8 });
saturno.rotation.x = Math.PI / 2;
sistemaSat.add(saturno);
{
  const ri = RS * 1.2, re = RS * 2.3;
  const g = new THREE.RingGeometry(ri, re, 256, 1);
  const p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    uv.setXY(i, (v.length() - ri) / (re - ri), 0.5);
  }
  const anillo = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    map: tex('tex/2k_saturn_ring_alpha.png', true),
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    color: new THREE.Color(0.95, 0.92, 0.85),
  }));
  sistemaSat.add(anillo);
}

/* ---------- Venus ---------- */

const gVen = cuerpo(285, 12, 45);
const luzVen = new THREE.Vector3(1, 0, 0);
const venus = planeta(1, tex('tex/2k_venus_atmosphere.jpg'), gVen, luzVen, { amb: 0.01, int: 1.55, atm: 0.9, atmColor: 0xfff3d0 });
const haloVen = halo(0xfff6dd, 5, 0.3);
gVen.add(venus, haloVen);

function faseVenus(t) {
  const th = (TAU * t) / 30 + 2.2;
  const vx = 0.723 * Math.cos(th), vy = 0.723 * Math.sin(th);
  let ex = vx - 1, ey = vy;
  const d = Math.hypot(ex, ey);
  ex /= d; ey /= d;
  const sl = Math.hypot(vx, vy), sx = -vx / sl, sy = -vy / sl;
  luzVen.set(sx * -ey + sy * ex, 0.05, -(sx * ex + sy * ey));
  const k = (1 + luzVen.z / luzVen.length()) / 2;
  const r = Math.min(2.3, 0.6 / d);
  venus.scale.setScalar(r);
  haloVen.scale.setScalar(r * 5);
  haloVen.material.opacity = 0.12 + 0.3 * k;
}

const CUERPOS = [{ g: gLuna }, { g: gJup }, { g: gSat }, { g: gVen }];

/* ---------- Universo: nebulosas, galaxias, cometa ---------- */

function lienzo(tam, dibujar) {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const g = c.getContext('2d');
  dibujar(g, tam);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function texNebulosa(colores, semilla) {
  return lienzo(512, (g, T) => {
    const r = azar(semilla);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 140; i++) {
      const a = r() * TAU, d = Math.pow(r(), 0.8) * T * 0.3;
      const x = T / 2 + Math.cos(a) * d * 1.2, y = T / 2 + Math.sin(a) * d * 0.8;
      const rr = T * (0.04 + r() * 0.16);
      const c = colores[(r() * colores.length) | 0];
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(${c},${0.05 + r() * 0.09})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 70; i++) {
      const a = r() * TAU, d = Math.pow(r(), 1.5) * T * 0.32;
      g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      g.beginPath();
      g.arc(T / 2 + Math.cos(a) * d, T / 2 + Math.sin(a) * d, 0.5 + r() * 1.4, 0, TAU);
      g.fill();
    }
  });
}

function texGalaxia(semilla, tinte) {
  return lienzo(512, (g, T) => {
    const r = azar(semilla);
    g.globalCompositeOperation = 'lighter';
    g.translate(T / 2, T / 2);
    const nucleo = g.createRadialGradient(0, 0, 0, 0, 0, T * 0.14);
    nucleo.addColorStop(0, 'rgba(255,245,225,.9)');
    nucleo.addColorStop(1, 'rgba(255,230,200,0)');
    g.fillStyle = nucleo;
    g.fillRect(-T / 2, -T / 2, T, T);
    for (let brazo = 0; brazo < 2; brazo++) {
      for (let i = 0; i < 900; i++) {
        const k = r();
        const th = k * 3.4 * Math.PI + brazo * Math.PI;
        const rad0 = T * 0.035 * Math.exp(0.32 * th) * 0.5;
        if (rad0 > T * 0.46) continue;
        const x = Math.cos(th) * rad0 + (r() - 0.5) * T * 0.05;
        const y = Math.sin(th) * rad0 + (r() - 0.5) * T * 0.05;
        const rr = 2 + r() * 7;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, `rgba(${tinte},${0.05 + r() * 0.08})`);
        gr.addColorStop(1, `rgba(${tinte},0)`);
        g.fillStyle = gr;
        g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    }
  });
}

function decorado(textura, az, el, tam, giro, opacidad, aplastar = 1) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(tam, tam * aplastar),
    new THREE.MeshBasicMaterial({ map: textura, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.position.copy(dir(az, el).multiplyScalar(800));
  m.lookAt(0, 0, 0);
  m.rotateZ(giro);
  lejano.add(m);
  return m;
}

decorado(texNebulosa(['255,70,160', '120,90,255', '255,140,90'], 5), 40, 55, 260, 0.4, 0.9);
decorado(texNebulosa(['60,200,255', '80,120,255', '160,255,220'], 9), 150, -10, 300, 1.2, 0.85);
decorado(texNebulosa(['255,90,60', '255,190,90', '200,60,140'], 13), 245, 45, 220, 2.1, 0.8);
decorado(texNebulosa(['140,110,255', '255,120,200', '90,220,255'], 21), 320, -35, 340, 0.9, 0.75);
decorado(texGalaxia(3, '200,215,255'), 120, 62, 120, 0.6, 0.95, 0.42);
decorado(texGalaxia(7, '255,225,200'), 20, -40, 90, 2.4, 0.9, 0.55);
decorado(texGalaxia(17, '220,200,255'), 265, -60, 70, 1.3, 0.85, 0.7);

const gCometa = cuerpo(330, 40, 700);
CUERPOS.push({ g: gCometa });
{
  const cola = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: lienzo(512, (g, T) => {
        const gr = g.createLinearGradient(0, 0, T, 0);
        gr.addColorStop(0, 'rgba(170,220,255,.95)');
        gr.addColorStop(0.35, 'rgba(120,180,255,.35)');
        gr.addColorStop(1, 'rgba(120,180,255,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(0, T / 2);
        g.quadraticCurveTo(T * 0.5, T * 0.05, T, T * 0.1);
        g.lineTo(T, T * 0.9);
        g.quadraticCurveTo(T * 0.5, T * 0.95, 0, T / 2);
        g.fill();
      }),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  cola.scale.set(110, 22, 1);
  cola.position.x = 55;
  const colaGrupo = new THREE.Group();
  colaGrupo.rotation.z = rad(-35);
  colaGrupo.add(cola);
  gCometa.add(colaGrupo, halo(0xdff2ff, 16, 0.9), halo(0x9fd0ff, 40, 0.35));
}

/* ---------- Estrellas fugaces ---------- */

const fugazTex = lienzo(256, (g, T) => {
  const gr = g.createLinearGradient(0, 0, T, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.85, 'rgba(210,230,255,.8)');
  gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, T / 2);
  g.lineTo(T, T * 0.3);
  g.lineTo(T, T * 0.7);
  g.fill();
});
const fugaces = [];
let proximaFugaz = 1.5;
const vF = new THREE.Vector3(), vT = new THREE.Vector3(), vZ = new THREE.Vector3(), vY = new THREE.Vector3(), mB = new THREE.Matrix4();

function lanzarFugaz() {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const p = f.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.35)).normalize();
  const t = new THREE.Vector3().randomDirection().projectOnPlane(p).normalize();
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: fugazTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(m);
  fugaces.push({ m, p, t, edad: 0, vida: 0.7 + Math.random() * 0.8, largo: 40 + Math.random() * 70, vel: 0.9 + Math.random() * 0.8 });
}

let lluviaHasta = 0, proximaLluvia = 0;
function actualizarFugaces(dt, t) {
  if (t < lluviaHasta && t > proximaLluvia) {
    lanzarFugaz();
    proximaLluvia = t + 0.08 + Math.random() * 0.12;
  }
  if (t > proximaFugaz) {
    lanzarFugaz();
    if (Math.random() < 0.25) lanzarFugaz();
    proximaFugaz = t + 1.2 + Math.random() * 3.5;
  }
  for (let i = fugaces.length - 1; i >= 0; i--) {
    const f = fugaces[i];
    f.edad += dt;
    const k = f.edad / f.vida;
    if (k >= 1) {
      scene.remove(f.m);
      f.m.geometry.dispose();
      f.m.material.dispose();
      fugaces.splice(i, 1);
      continue;
    }
    vF.copy(f.p).multiplyScalar(700).addScaledVector(f.t, (k - 0.5) * 220 * f.vel);
    vZ.copy(f.p).negate();
    vY.crossVectors(vZ, f.t);
    mB.makeBasis(f.t, vY, vZ);
    f.m.quaternion.setFromRotationMatrix(mB);
    f.m.position.copy(vF).addScaledVector(f.t, -f.largo / 2);
    f.m.scale.set(f.largo * Math.min(1, k * 4), 1.6, 1);
    f.m.material.opacity = Math.sin(Math.PI * k);
  }
}

/* ---------- Orientación del teléfono (360°) ---------- */

const eje = new THREE.Vector3(0, 0, 1);
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const q0 = new THREE.Quaternion();
const eul = new THREE.Euler();
const qSensor = new THREE.Quaternion();
let ori = null, calibrar = true;

function alOrientar(e) {
  if (e.alpha == null || e.beta == null) return;
  ori = e;
}
function anguloPantalla() {
  return rad((screen.orientation && screen.orientation.angle) || window.orientation || 0);
}
function leerSensor() {
  eul.set(rad(ori.beta), rad(ori.alpha), -rad(ori.gamma), 'YXZ');
  qSensor.setFromEuler(eul).multiply(q1).multiply(q0.setFromAxisAngle(eje, -anguloPantalla()));
}
const necesitaPermiso = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
if (!necesitaPermiso) addEventListener('deviceorientation', alOrientar);

function pedirSensor() {
  if (!necesitaPermiso) return;
  try {
    DeviceOrientationEvent.requestPermission()
      .then((r) => { if (r === 'granted') addEventListener('deviceorientation', alOrientar); })
      .catch(() => {});
  } catch {}
}

/* ---------- Control desde la PC maestra ---------- */

const ZOOM_MIN = 0.012, ZOOM_MAX = 1.6;
let yaw = 0, pitch = rad(18);
let cieloObj = 0, zoom = 1, zoomObj = 1, indice = 0;
let modo = 'libre', velocidad = 1, simT = 0, tAhora = 0;
let ultimaSeq = null, ultimaLluvia = null, estadoPendiente = null, listo = false;
const angulo = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const qDeseado = new THREE.Quaternion();
const eulCam = new THREE.Euler(0, 0, 0, 'YXZ');

const guiar = () => modo === 'guiado' || !ori;

function apuntar(i, inmediato = false) {
  indice = clamp(i, 0, CUERPOS.length - 1);
  if (guiar()) return;
  const { az } = CUERPOS[indice].g.userData;
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const destino = rad(az) - Math.atan2(f.x, -f.z);
  cieloObj = cielo.rotation.y + angulo(destino - cielo.rotation.y);
  if (inmediato) cielo.rotation.y = cieloObj;
}

function lluvia() {
  lluviaHasta = tAhora + 3.5;
}

/* ---------- Modo historia ---------- */

const veloEl = $('#velo');
const vinetaEl = $('#vineta');
// La historia (ciudad, cuarto, personajes) se arma recién cuando se usa: el cielo arranca liviano.
let historia = null;
function obtenerHistoria() {
  if (!historia) {
    historia = crearHistoria({
      velo: (color, opacidad) => { veloEl.style.background = color; veloEl.style.opacity = opacidad; },
      vineta: (opacidad) => { vinetaEl.style.opacity = opacidad; },
      calidad: CALIDAD,
      via: texturaVia,
    });
  }
  return historia;
}
let enHistoria = false, ultimaPuerta = null, ultimoSaludo = null, ultimoAbjurar = null, ultimoFinal = null;
const giroPrueba = params.has('auto') ? Number(params.get('giro')) || 0 : 0;
renderer.shadowMap.enabled = CALIDAD !== 'baja';
renderer.shadowMap.type = CALIDAD === 'alta' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

/* ---------- Mirar en 360° desde la PC: flechas del teclado o arrastrar con el mouse ---------- */

const teclas = new Set();
let mirarX = 0, mirarY = 0;
addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow')) { teclas.add(e.key); e.preventDefault(); }
  if (e.key === 'r' || e.key === 'R') { mirarX = 0; mirarY = 0; }
});
addEventListener('keyup', (e) => teclas.delete(e.key));
let arrastre = null;
canvas.addEventListener('pointerdown', (e) => { if (!ori) arrastre = { x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const k = rad(camera.fov) / innerHeight;
  mirarX += (e.clientX - arrastre.x) * k;
  mirarY = clamp(mirarY + (e.clientY - arrastre.y) * k, -1.4, 1.4);
  arrastre = { x: e.clientX, y: e.clientY };
});
addEventListener('pointerup', () => { arrastre = null; });
function mirarConTeclas(dt) {
  const v = 1.5 * dt;
  if (teclas.has('ArrowLeft')) mirarX += v;
  if (teclas.has('ArrowRight')) mirarX -= v;
  if (teclas.has('ArrowUp')) mirarY = clamp(mirarY + v * 0.7, -1.4, 1.4);
  if (teclas.has('ArrowDown')) mirarY = clamp(mirarY - v * 0.7, -1.4, 1.4);
}

function aplicarHistoria(e) {
  if (e.historia && !enHistoria) {
    obtenerHistoria();
    enHistoria = true;
    calibrar = true;
  } else if (!e.historia && enHistoria) {
    enHistoria = false;
    historia.reiniciar();
    camera.position.set(0, 0, 0);
    calibrar = true;
  }
  if (enHistoria) {
    historia.ir(e.escena);
    historia.ponerPaso(e.paso);
    historia.hablar(e.hablar);
  }
  if (historia && ultimaPuerta !== null && e.puerta !== ultimaPuerta) historia.tocarPuerta();
  if (historia && ultimoSaludo !== null && e.saludo !== ultimoSaludo) historia.saludar();
  if (historia && ultimoAbjurar !== null && e.abjurar !== ultimoAbjurar) historia.abjurar();
  if (historia && ultimoFinal !== null && e.final !== ultimoFinal) historia.final();
  ultimaPuerta = e.puerta;
  ultimoSaludo = e.saludo;
  ultimoAbjurar = e.abjurar;
  ultimoFinal = e.final;
}

function aplicarEstado(e) {
  if (!listo) { estadoPendiente = e; return; }
  aplicarHistoria(e);
  zoomObj = clamp(e.zoom, ZOOM_MIN, ZOOM_MAX);
  velocidad = e.velocidad;
  const cambioModo = e.modo !== modo;
  modo = e.modo;
  if (cambioModo && modo === 'libre') calibrar = true;
  if (e.seq !== ultimaSeq || cambioModo) {
    ultimaSeq = e.seq;
    indice = e.objetivo;
    if (abierto) apuntar(indice);
  }
  if (ultimaLluvia !== null && e.lluvia !== ultimaLluvia) lluvia();
  ultimaLluvia = e.lluvia;
  if (e.abierto && !abierto) abrir();
  if (!e.abierto && abierto) cerrar();
}

// Una pestaña en segundo plano suelta su conexión (el navegador solo permite 6 por servidor) y la retoma al volver.
let fuente = null;
function conectar() {
  if (fuente) return;
  fuente = new EventSource('/api/eventos?rol=' + (params.has('pc') ? 'pc' : 'telefono'));
  fuente.onmessage = (m) => {
    try {
      const d = JSON.parse(m.data);
      if (d.estado) aplicarEstado(d.estado);
    } catch {}
  };
}
document.addEventListener('visibilitychange', () => {
  if (params.has('auto')) return;
  if (document.hidden) { fuente?.close(); fuente = null; } else conectar();
});

/* ---------- Primer toque: sensores y pantalla completa ---------- */

const enApp = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
if (necesitaPermiso || !enApp) $('#toca').classList.add('visible');
document.addEventListener('pointerdown', () => {
  pedirSensor();
  pantallaCompleta();
  $('#toca').classList.remove('visible');
});

/* ---------- Bucle ---------- */

let abierto = false, finCierre = 0, t0 = 0, ultimo = 0, blurActual = -1, wakeLock = null;

function medir() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
}

function orientacionGuiada(t, suave, inmediato) {
  const { az, el } = CUERPOS[indice].g.userData;
  const yawObj = -(rad(az) - cielo.rotation.y);
  const k = inmediato ? 1 : suave(3);
  yaw += angulo(yawObj - yaw) * k;
  pitch += (rad(el) - pitch) * k;
  eulCam.set(pitch + mirarY + Math.sin(t * 0.6) * 0.002 * zoom, yaw + mirarX + Math.sin(t * 0.43) * 0.002 * zoom, 0);
  qDeseado.setFromEuler(eulCam);
  if (inmediato) camera.quaternion.copy(qDeseado);
  else camera.quaternion.slerp(qDeseado, suave(10));
}

function cuadro(ahora) {
  if (!abierto && ahora > finCierre) return;
  requestAnimationFrame(cuadro);
  if (CALIDAD === 'baja' && ahora - ultimo < 66) return;
  const dt = Math.min(params.has('auto') ? 0.5 : 0.05, (ahora - ultimo) / 1000 || 0);
  ultimo = ahora;
  const t = (ahora - t0) / 1000;
  tAhora = t;
  simT += dt * velocidad;
  const suave = (v) => 1 - Math.exp(-dt * v);

  mirarConTeclas(dt);
  if (enHistoria) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    if (guiar()) {
      eulCam.set(historia.mirada() + mirarY, historia.raiz.rotation.y + giroPrueba + mirarX, 0);
      qDeseado.setFromEuler(eulCam);
      camera.quaternion.slerp(qDeseado, suave(4));
    } else {
      leerSensor();
      if (calibrar) { camera.quaternion.copy(qSensor); calibrar = false; }
      camera.quaternion.slerp(qSensor, suave(5 + 17 * Math.sqrt(zoom)));
    }
    zoom = Math.exp(Math.log(zoom) + (Math.log(zoomObj) - Math.log(zoom)) * suave(5));
    camera.fov = Math.min(125, (camera.aspect < 1 ? 72 : 55) * zoom * historia.fovExtra());
    camera.updateProjectionMatrix();
    historia.actualizar(dt, t, camera, guiar());
    renderer.render(historia.escena, camera);
    desenfoqueInicial(t);
    return;
  }
  renderer.toneMapping = THREE.NoToneMapping;

  if (guiar()) {
    orientacionGuiada(t, suave, false);
  } else {
    leerSensor();
    if (calibrar) {
      camera.quaternion.copy(qSensor);
      apuntar(indice, true);
      calibrar = false;
    }
    camera.quaternion.slerp(qSensor, suave(5 + 17 * Math.sqrt(zoom)));
  }
  cielo.rotation.y += (cieloObj - cielo.rotation.y) * suave(4);
  lejano.rotation.y += dt * rad(0.5) * velocidad;

  zoom = Math.exp(Math.log(zoom) + (Math.log(zoomObj) - Math.log(zoom)) * suave(5));
  const base = camera.aspect < 1 ? 72 : 55;
  camera.fov = base * zoom;
  camera.updateProjectionMatrix();

  luna.rotation.y = -Math.PI / 2 + Math.sin(t * 0.08) * 0.12;
  luna.rotation.x = Math.sin(t * 0.06) * 0.05;
  jupiter.rotation.y += dt * 0.12 * velocidad;
  saturno.rotation.y += dt * 0.08 * velocidad;
  venus.rotation.y += dt * 0.02 * velocidad;
  const dias = simT / 3;
  for (const m of MEDICEAS) {
    const a = (TAU * dias) / m.P + m.f;
    m.mesh.position.set(m.a * Math.cos(a), 0, -m.a * Math.sin(a));
    m.mesh.rotation.y = a;
  }
  faseVenus(simT);

  camera.updateMatrixWorld();
  cielo.updateMatrixWorld(true);
  for (const { mat, grupo, luz } of iluminados) {
    mat.uniforms.uLuz.value.copy(luz).transformDirection(grupo.matrixWorld).transformDirection(camera.matrixWorldInverse);
  }
  estrellasMat.uniforms.uTime.value = t;

  actualizarFugaces(dt, t);
  renderer.render(scene, camera);
  desenfoqueInicial(t);
}

function desenfoqueInicial(t) {
  const b = Math.round(Math.max(0, 16 * (1 - t / 1.6)) * 2) / 2;
  if (b !== blurActual) {
    blurActual = b;
    canvas.style.filter = b > 0 ? `blur(${b}px)` : 'none';
  }
}

function pantallaCompleta() {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    p?.then?.(() => screen.orientation?.lock?.('portrait').catch(() => {})).catch(() => {});
  } catch {}
}

function abrir() {
  try { navigator.wakeLock?.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch {}
  medir();
  calibrar = true;
  zoom = zoomObj;
  blurActual = -1;
  const yaAnimando = performance.now() < finCierre;
  abierto = true;
  if (!yaAnimando) {
    t0 = ultimo = performance.now();
    if (guiar()) orientacionGuiada(0, null, true);
    requestAnimationFrame(cuadro);
  }
  $('#vista').classList.add('abierto');
}

function cerrar() {
  abierto = false;
  finCierre = performance.now() + 1300;
  $('#vista').classList.remove('abierto');
  try { wakeLock?.release(); } catch {}
}

addEventListener('resize', medir);
screen.orientation?.addEventListener?.('change', () => { calibrar = true; });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && abierto) {
    try { navigator.wakeLock?.request('screen').then((w) => { wakeLock = w; }).catch(() => {}); } catch {}
  }
});

manager.onLoad = () => {
  medir();
  renderer.compile(scene, camera);
  listo = true;
  if (params.has('auto')) {
    indice = Number(params.get('mira')) || 0;
    zoomObj = Number(params.get('zoom')) || 1;
    abrir();
    t0 -= (Number(params.get('t')) || 0) * 1000;
    if (params.has('historia')) {
      aplicarHistoria({ historia: true, escena: Number(params.get('historia')), paso: 0, hablar: params.has('habla'), puerta: 0, saludo: 0 });
      if (params.has('puerta')) setTimeout(() => historia.tocarPuerta(), 300);
      if (params.has('abjura')) setTimeout(() => historia.abjurar(), 300);
      if (params.has('final')) setTimeout(() => historia.final(), 300);
    }
    return;
  }
  if (estadoPendiente) aplicarEstado(estadoPendiente);
  setTimeout(() => { if (!abierto && ultimaSeq === null) abrir(); }, 4000);
};

if (!params.has('auto')) conectar();

