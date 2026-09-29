import * as THREE from './vendor/three.module.min.js';
import { crearPersona, animarCaminata, andarEnCirculo, crearCarreta, crearPalomas, crearPuesto, crearPerro, parpadear } from './personajes.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const suaveEntre = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const ESCENAS = ['Espacio', 'La Tierra', 'Florencia 1610', 'Hacia la casa de Galileo', 'El cuarto de Galileo', 'Roma 1633: el juicio', 'Arcetri 1638: sus últimos libros'];

function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function lienzo(w, h, dibujar, repetir = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function ruido(g, w, h, n, colores, alfa, r) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colores[(r() * colores.length) | 0];
    g.globalAlpha = alfa * (0.4 + r() * 0.6);
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
  }
  g.globalAlpha = 1;
}

/* ---------- Texturas pintadas ---------- */

const puntoTex = lienzo(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
});

/**
 * Fachada con ventanas en arco. Devuelve el color (mapa) y un mapa de luz con solo las ventanas
 * encendidas, para que brillen de verdad al atardecer (emissiveMap).
 */
function fachada(base, contraventana, semilla, encendidas = 0.4) {
  const r = azar(semilla);
  const ventanas = [];
  for (let piso = 0; piso < 2; piso++) for (let c = 0; c < 3; c++) ventanas.push({ x: 30 + c * 80, y: 22 + piso * 128, luz: r() < encendidas, tono: r() });
  const arco = (g, x, y) => { g.beginPath(); g.moveTo(x, y + 64); g.lineTo(x, y + 18); g.arc(x + 20, y + 18, 20, Math.PI, 0); g.lineTo(x + 40, y + 64); };
  const mapa = lienzo(256, 384, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    ruido(g, w, h, 5000, ['#000', '#fff', '#6b4a2a'], 0.06, r);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 118, w, 6); g.fillRect(0, 246, w, 6); g.fillRect(0, 0, w, 10);
    for (const v of ventanas) {
      g.fillStyle = contraventana; g.fillRect(v.x - 12, v.y, 12, 64); g.fillRect(v.x + 40, v.y, 12, 64);
      if (v.luz) {
        const gr = g.createLinearGradient(0, v.y, 0, v.y + 64);
        gr.addColorStop(0, '#ffd890'); gr.addColorStop(1, '#e89a40');
        g.fillStyle = gr;
      } else g.fillStyle = '#1d1510';
      arco(g, v.x, v.y); g.fill();
      if (v.luz) { g.fillStyle = 'rgba(60,30,10,.55)'; g.fillRect(v.x + 18, v.y + 4, 4, 60); g.fillRect(v.x, v.y + 34, 40, 3); }
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 4; arco(g, v.x, v.y); g.stroke();
    }
    g.fillStyle = '#3a2616';
    g.beginPath(); g.moveTo(98, h); g.lineTo(98, 300); g.arc(128, 300, 30, Math.PI, 0); g.lineTo(158, h); g.fill();
    g.strokeStyle = '#d8ccb0'; g.lineWidth = 6; g.stroke();
  });
  const luz = lienzo(256, 384, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (const v of ventanas) {
      if (!v.luz) continue;
      const k = 0.7 + v.tono * 0.3;
      const gr = g.createRadialGradient(v.x + 20, v.y + 40, 2, v.x + 20, v.y + 36, 42);
      gr.addColorStop(0, `rgba(255,${190 + v.tono * 40 | 0},110,${k})`); gr.addColorStop(1, `rgba(255,150,60,${k * 0.55})`);
      g.fillStyle = gr; arco(g, v.x, v.y); g.fill();
      g.fillStyle = '#000'; g.fillRect(v.x + 18, v.y + 4, 4, 60); g.fillRect(v.x, v.y + 34, 40, 3);
    }
  });
  return { mapa, luz };
}

function materialFachada(f, repX = 1, repY = 1) {
  const mapa = f.mapa.clone(), luz = f.luz.clone();
  for (const t of [mapa, luz]) { t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY); }
  return new THREE.MeshStandardMaterial({ map: mapa, emissiveMap: luz, emissive: 0xffb866, emissiveIntensity: 1.6, roughness: 0.9 });
}

const adoquines = lienzo(256, 256, (g, w, h) => {
  const r = azar(4);
  g.fillStyle = '#6d6259'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const tono = 120 + r() * 50;
    g.fillStyle = `rgb(${tono},${tono * 0.92},${tono * 0.82})`;
    g.beginPath(); g.ellipse(x * 32 + 16 + (y % 2) * 16, y * 32 + 16, 13, 12, 0, 0, TAU); g.fill();
  }
}, true);
adoquines.repeat.set(260, 260);

const piedra = lienzo(256, 256, (g, w, h) => {
  const r = azar(9);
  g.fillStyle = '#6e5c48'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const t = 110 + r() * 60;
    g.fillStyle = `rgb(${t},${t * 0.88},${t * 0.72})`;
    g.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28);
  }
  ruido(g, w, h, 3000, ['#000', '#fff'], 0.08, r);
}, true);

const madera = lienzo(256, 256, (g, w, h) => {
  const r = azar(12);
  for (let i = 0; i < 8; i++) {
    const t = 70 + r() * 35;
    g.fillStyle = `rgb(${t + 40},${t + 12},${t - 20})`;
    g.fillRect(i * 32, 0, 31, h);
    g.strokeStyle = 'rgba(0,0,0,.25)';
    for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(i * 32 + r() * 30, 0); g.bezierCurveTo(i * 32 + r() * 30, 80, i * 32 + r() * 30, 170, i * 32 + r() * 30, h); g.stroke(); }
  }
}, true);

const yeso = lienzo(256, 256, (g, w, h) => {
  const r = azar(21);
  g.fillStyle = '#b89c78'; g.fillRect(0, 0, w, h);
  ruido(g, w, h, 9000, ['#7a5d3c', '#e8d4b0', '#5a4028'], 0.12, r);
  for (let i = 0; i < 14; i++) {
    const t = 100 + r() * 40;
    g.fillStyle = `rgba(${t},${t * 0.85},${t * 0.7},.7)`;
    g.fillRect(r() * w, r() * h, 30 + r() * 30, 14 + r() * 8);
  }
}, true);

const cieloNoche = lienzo(512, 512, (g, w, h) => {
  const r = azar(33);
  const f = g.createLinearGradient(0, 0, 0, h);
  f.addColorStop(0, '#030615'); f.addColorStop(1, '#16204a');
  g.fillStyle = f; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,240,${r()})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  const l = g.createRadialGradient(360, 150, 5, 370, 155, 60);
  l.addColorStop(0, '#f6f2e4'); l.addColorStop(1, '#9d998c');
  g.fillStyle = l; g.beginPath(); g.arc(370, 150, 55, 0, TAU); g.fill();
  g.fillStyle = 'rgba(3,6,21,.92)'; g.beginPath(); g.arc(345, 150, 55, 0, TAU); g.fill();
  g.fillStyle = '#ffe9c4'; g.beginPath(); g.arc(150, 330, 7, 0, TAU); g.fill();
  for (const dx of [-38, -20, 22, 44]) { g.fillStyle = '#fff'; g.fillRect(150 + dx, 329, 3, 3); }
});

const mapaCielo = lienzo(256, 256, (g, w, h) => {
  g.fillStyle = '#e4d3a8'; g.fillRect(0, 0, w, h);
  ruido(g, w, h, 4000, ['#a8894f', '#fff6dc'], 0.15, azar(5));
  g.strokeStyle = '#5a3e20'; g.lineWidth = 2;
  for (const rr of [30, 55, 78, 100]) { g.beginPath(); g.arc(128, 128, rr, 0, TAU); g.stroke(); }
  g.fillStyle = '#c9772b'; g.beginPath(); g.arc(128, 128, 14, 0, TAU); g.fill();
  for (const [rr, a] of [[30, 1], [55, 2.5], [78, 4], [100, 5.5]]) { g.fillStyle = '#3d2a14'; g.beginPath(); g.arc(128 + rr * Math.cos(a), 128 + rr * Math.sin(a), 5, 0, TAU); g.fill(); }
  g.strokeStyle = '#7a5530'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
});

const tejado = new THREE.MeshStandardMaterial({ color: 0xa9502b, roughness: 0.85 });
const madOscura = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.8 });
const madClara = new THREE.MeshStandardMaterial({ map: madera, roughness: 0.75 });
const laton = new THREE.MeshStandardMaterial({ color: 0xd4a24c, roughness: 0.3, metalness: 0.85 });
const cuero = new THREE.MeshStandardMaterial({ color: 0x6b3219, roughness: 0.6 });
const piedraMat = new THREE.MeshStandardMaterial({ map: piedra, roughness: 0.9 });

function caja(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cil(rA, rB, h, mat, seg = 16) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rA, rB, h, seg), mat);
}
function esfera(r, mat, seg = 20) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), mat);
}
function halo(color, tam, opacidad) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puntoTex, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.set(tam, tam, 1);
  return s;
}

function campoEstrellas(n, radio, tam, semilla) {
  const r = azar(semilla);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  const tintes = [[1, 1, 1], [1, 0.9, 0.78], [0.78, 0.86, 1], [1, 0.82, 0.7]];
  for (let i = 0; i < n; i++) {
    v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(radio * (0.85 + r() * 0.15));
    pos.set([v.x, v.y, v.z], i * 3);
    const b = 0.35 + r() * 0.65, t = tintes[(r() * 4) | 0];
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({
    size: tam, sizeAttenuation: false, map: puntoTex, vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

/* ---------- Personajes ---------- */

const PIEL = new THREE.MeshStandardMaterial({ color: 0xd9a98a, roughness: 0.7 });

/** Mueve los vértices de una geometría y recalcula la iluminación. */
function deformar(geo, fn) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  return geo;
}

function perfilSuave(puntos, pasos = 6) {
  const curva = new THREE.SplineCurve(puntos.map(([x, y]) => new THREE.Vector2(x, y)));
  return curva.getPoints(puntos.length * pasos);
}

function crearGalileo(calidad = 'alta', { viejo = false, conAnteojo = !viejo } = {}) {
  const g = new THREE.Group();
  // El brillo aterciopelado de la tela (sheen) es caro: solo en la PC.
  const Tela = calidad === 'alta' ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const brillo = (color) => (calidad === 'alta' ? { sheen: 0.75, sheenRoughness: 0.65, sheenColor: new THREE.Color(color) } : {});
  const tela = new Tela({ color: 0x1c1a22, roughness: 0.88, ...brillo(0x5a5470) });
  const abrigo = new Tela({ color: 0x2e2233, roughness: 0.85, side: THREE.DoubleSide, ...brillo(0x8a6a90) });
  const piel = new THREE.MeshStandardMaterial({ color: 0xd6a283, roughness: 0.62 });
  const blanco = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.55 });
  const canas = new THREE.MeshStandardMaterial({ color: viejo ? 0xe2ddd4 : 0xa08a70, roughness: 0.95 });
  const oscuro = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.45 });
  const labio = new THREE.MeshStandardMaterial({ color: 0xa8625a, roughness: 0.6 });

  const cuerpo = new THREE.Group();
  g.add(cuerpo);

  // Túnica larga con pliegues de tela reales (más hondos cerca del suelo).
  const perfilTunica = perfilSuave([[0.001, 0], [0.34, 0], [0.335, 0.06], [0.3, 0.4], [0.27, 0.72], [0.245, 1.0], [0.225, 1.2], [0.2, 1.33], [0.13, 1.43], [0.001, 1.45]]);
  const tunicaGeo = deformar(new THREE.LatheGeometry(perfilTunica, 128), (v) => {
    const r = Math.hypot(v.x, v.z);
    if (r < 0.01) return;
    const a = Math.atan2(v.x, v.z);
    const pliegue = 0.014 * Math.pow(Math.max(0, 1 - v.y / 1.3), 1.3) * (Math.sin(a * 17) + 0.4 * Math.sin(a * 31 + 1.3));
    const k = (r + pliegue) / r;
    v.x *= k; v.z *= k;
  });
  cuerpo.add(new THREE.Mesh(tunicaGeo, tela));

  // Sobretodo abierto por delante, un poco más ancho que la túnica.
  const perfilAbrigo = perfilSuave([[0.36, 0.12], [0.33, 0.45], [0.3, 0.8], [0.27, 1.1], [0.25, 1.28], [0.2, 1.4]]);
  const abrigoGeo = deformar(new THREE.LatheGeometry(perfilAbrigo, 110, 0.42, TAU - 0.84), (v) => {
    const a = Math.atan2(v.x, v.z), r = Math.hypot(v.x, v.z);
    const k = (r + 0.012 * Math.sin(a * 11) * Math.max(0, 1 - v.y / 1.4)) / r;
    v.x *= k; v.z *= k;
  });
  cuerpo.add(new THREE.Mesh(abrigoGeo, abrigo));
  // Solapas del abrigo
  for (const s of [-1, 1]) {
    const solapa = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 1.05, 6, 16), abrigo);
    solapa.position.set(s * 0.12, 0.8, 0.26); solapa.rotation.set(-0.08, 0, s * 0.06); cuerpo.add(solapa);
  }
  const hombros = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 24), abrigo);
  hombros.scale.set(1.3, 0.55, 0.85); hombros.position.y = 1.34; cuerpo.add(hombros);

  // Gorguera plisada: cientos de pliegues blancos.
  // Abierta por delante: la barba cae por la abertura sin atravesarla.
  const ABERTURA = 1.45;
  const gorgueraGeo = deformar(new THREE.TorusGeometry(0.125, 0.042, 18, 200, TAU - ABERTURA), (v) => {
    const th = Math.atan2(v.y, v.x);
    const cx = Math.cos(th) * 0.125, cy = Math.sin(th) * 0.125;
    const k = 1 + 0.38 * Math.sin(th * 38);
    v.x = cx + (v.x - cx) * k; v.y = cy + (v.y - cy) * k; v.z *= k;
  });
  const gorguera = new THREE.Mesh(gorgueraGeo, blanco);
  gorguera.rotation.set(Math.PI / 2, 0, Math.PI / 2 + ABERTURA / 2); gorguera.position.y = 1.46; cuerpo.add(gorguera);

  const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.016, 12, 96), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.55 }));
  cinto.rotation.x = Math.PI / 2; cinto.position.y = 0.98; cuerpo.add(cinto);
  const hebilla = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 24), laton); hebilla.position.set(0, 0.98, 0.252); cuerpo.add(hebilla);
  for (let i = 0; i < 7; i++) {
    const boton = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), laton);
    const y = 1.03 + i * 0.055;
    const radio = y < 1.2 ? 0.245 - (y - 1.0) * 0.1 : y < 1.33 ? 0.225 - (y - 1.2) * 0.19 : 0.2 - (y - 1.33) * 0.7;
    boton.position.set(0, y, radio + 0.008); cuerpo.add(boton);
  }
  for (const s of [-1, 1]) {
    const zapato = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.14, 8, 24), oscuro);
    zapato.rotation.x = Math.PI / 2; zapato.scale.x = 0.9; zapato.position.set(s * 0.1, 0.045, 0.25); cuerpo.add(zapato);
  }

  // ---- Cabeza ----
  const cabeza = new THREE.Group();
  cabeza.position.y = 1.6;
  cuerpo.add(cabeza);
  const craneo = new THREE.Mesh(deformar(new THREE.SphereGeometry(0.115, 64, 48), (v) => {
    if (v.y < -0.03) v.z *= 0.92 + 0.08 * (1 + v.y / 0.115);
    if (v.z > 0 && Math.abs(v.y - 0.035) < 0.02) v.z += 0.004 * (1 - Math.abs(v.x) / 0.115);
  }), piel);
  craneo.scale.y = 1.12; cabeza.add(craneo);
  for (const s of [-1, 1]) {
    const oreja = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 16), piel);
    oreja.scale.set(0.4, 1, 0.7); oreja.position.set(s * 0.112, 0.0, -0.01); cabeza.add(oreja);
  }
  // Pelo canoso con mechones, largo por detrás; la frente despejada como en sus retratos.
  const peloGeo = deformar(new THREE.SphereGeometry(0.128, 72, 36, Math.PI / 2 + 0.9, TAU - 1.8, 0.5, 1.55), (v) => {
    const a = Math.atan2(v.x, v.z);
    const k = 1 + 0.07 * Math.sin(a * 23 + v.y * 60) + 0.04 * Math.sin(a * 51);
    v.x *= k; v.z *= k;
  });
  const pelo = new THREE.Mesh(peloGeo, canas); pelo.scale.y = 1.12; cabeza.add(pelo);
  const nuca = new THREE.Mesh(deformar(new THREE.CapsuleGeometry(0.075, 0.1, 12, 32), (v) => { v.x *= 1 + 0.06 * Math.sin(v.y * 90); }), canas);
  nuca.position.set(0, -0.09, -0.07); nuca.scale.set(1.2, 1, 0.7); cabeza.add(nuca);

  // Barba en punta con mechones.
  const perfilBarba = perfilSuave([[0.001, -0.2], [0.02, -0.17], [0.05, -0.1], [0.075, -0.03], [0.085, 0.02], [0.08, 0.05], [0.001, 0.06]]);
  const barbaGeo = deformar(new THREE.LatheGeometry(perfilBarba, 64), (v) => {
    const a = Math.atan2(v.x, v.z);
    const k = 1 + 0.12 * Math.sin(a * 19 + v.y * 70);
    v.x *= k; v.z *= k * 0.75;
  });
  const barba = new THREE.Mesh(barbaGeo, canas); barba.position.set(0, -0.15, 0.1); barba.rotation.x = -0.4; barba.scale.set(0.85, 0.9, 0.9); cabeza.add(barba);
  // Bigote caído en dos mitades.
  for (const s of [-1, 1]) {
    const mitad = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 12, 32, Math.PI * 0.7), canas);
    mitad.position.set(s * 0.024, -0.048, 0.106); mitad.rotation.set(0.2, s < 0 ? Math.PI : 0, s < 0 ? -0.4 : 0.4 - Math.PI * 0.15);
    cabeza.add(mitad);
  }
  // Ojos con párpados, cejas pobladas, nariz y labios.
  const ojos = [];
  for (const s of [-1, 1]) {
    const cuenca = new THREE.Group(); cuenca.position.set(s * 0.04, 0.02, 0.092); cabeza.add(cuenca);
    const ojo = new THREE.Group(); cuenca.add(ojo);
    ojo.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 24, 16), blanco));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.3 })); iris.position.z = 0.011; ojo.add(iris);
    const pupila = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 16, 10), oscuro); pupila.position.z = 0.0185; ojo.add(pupila);
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); brillo.position.set(0.004, 0.004, 0.021); ojo.add(brillo);
    const parpado = new THREE.Mesh(new THREE.SphereGeometry(0.0195, 24, 12, 0, TAU, 0, Math.PI * 0.42), piel);
    parpado.rotation.x = 0.35; cuenca.add(parpado);
    ojos.push(ojo);
    const ceja = new THREE.Mesh(deformar(new THREE.CapsuleGeometry(0.008, 0.035, 6, 16), (v) => { v.x += 0.002 * Math.sin(v.y * 400); }), canas);
    ceja.rotation.z = Math.PI / 2 - s * 0.2; ceja.position.set(s * 0.042, 0.047, 0.1); cabeza.add(ceja);
    const mejilla = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd08a72, roughness: 0.8, transparent: true, opacity: 0.45 }));
    mejilla.position.set(s * 0.058, -0.022, 0.08); cabeza.add(mejilla);
  }
  const nariz = new THREE.Mesh(deformar(new THREE.SphereGeometry(0.02, 32, 24), (v) => {
    v.z *= 1.4; v.y *= 1.6; if (v.y > 0) v.z *= 1 - v.y * 12;
  }), piel);
  nariz.position.set(0, -0.005, 0.11); cabeza.add(nariz);
  const boca = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 16), oscuro); boca.scale.set(1, 0.2, 0.4); boca.position.set(0, -0.072, 0.108); cabeza.add(boca);
  const labioInf = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.03, 6, 16), labio);
  labioInf.rotation.z = Math.PI / 2; labioInf.position.set(0, -0.08, 0.108); cabeza.add(labioInf);

  // ---- Brazos con mangas anchas y manos con dedos ----
  const brazos = {};
  const perfilManga = perfilSuave([[0.064, 0], [0.066, -0.1], [0.07, -0.2], [0.077, -0.28], [0.08, -0.3]]);
  for (const [nombre, s] of [['der', -1], ['izq', 1]]) {
    const hombro = new THREE.Group();
    hombro.position.set(s * 0.235, 1.36, 0);
    hombro.rotation.z = s * 0.1;
    cuerpo.add(hombro);
    hombro.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 32, 24), abrigo));
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.34, 40), abrigo); sup.position.y = -0.17; hombro.add(sup);
    const codo = new THREE.Group(); codo.position.y = -0.34; hombro.add(codo);
    codo.add(new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 16), abrigo));
    codo.add(new THREE.Mesh(new THREE.LatheGeometry(perfilManga, 48), abrigo));
    const puño = new THREE.Mesh(deformar(new THREE.TorusGeometry(0.046, 0.011, 10, 80), (v) => {
      const th = Math.atan2(v.y, v.x); const k = 1 + 0.15 * Math.sin(th * 22);
      const cx = Math.cos(th) * 0.046, cy = Math.sin(th) * 0.046; v.x = cx + (v.x - cx) * k; v.y = cy + (v.y - cy) * k; v.z *= k;
    }), blanco);
    puño.rotation.x = Math.PI / 2; puño.position.y = -0.29; codo.add(puño);
    const mano = new THREE.Group(); mano.position.y = -0.33; codo.add(mano);
    const palma = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.045, 8, 20), piel); palma.scale.z = 0.55; mano.add(palma);
    const dedos = [];
    for (let d = 0; d < 4; d++) {
      const dedo = new THREE.Group(); dedo.position.set(-0.022 + d * 0.0145, -0.05, 0); mano.add(dedo);
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.038 - Math.abs(d - 1.5) * 0.006, 6, 12), piel); f.position.y = -0.022; dedo.add(f);
      dedos.push(dedo);
    }
    const pulgar = new THREE.Group(); pulgar.position.set(s * -0.03, -0.015, 0.012); pulgar.rotation.z = s * -0.7; mano.add(pulgar);
    const pm = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 6, 12), piel); pm.position.y = -0.018; pulgar.add(pm);
    brazos[nombre] = { hombro, codo, mano: palma, dedos };
  }
  // Su anteojo en la mano izquierda, con dedos cerrados alrededor.
  if (conAnteojo) {
    const anteojo = new THREE.Group(); anteojo.position.set(0, -0.36, 0.03); anteojo.rotation.z = Math.PI / 2 - 0.3; brazos.izq.codo.add(anteojo);
    anteojo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.36, 40), cuero));
    for (const y of [-0.17, -0.06, 0.08, 0.17]) { const aro = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.005, 8, 40), laton); aro.rotation.x = Math.PI / 2; aro.position.y = y; anteojo.add(aro); }
    brazos.izq.dedos.forEach((d) => { d.rotation.x = 1.3; });
    brazos.izq.codo.rotation.x = -0.9;
  }
  brazos.der.dedos.forEach((d, i) => { d.rotation.x = 0.15 + i * 0.05; });

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { grupo: g, cuerpo, cabeza, boca, brazos, ojos, parpadeo: 3.3 };
}


/* ---------- Inventos de Galileo ---------- */

function pedestal(grupo) {
  const p = new THREE.Group();
  p.add(caja(0.55, 1.0, 0.55, piedraMat, 0, 0.5, 0));
  p.add(caja(0.7, 0.08, 0.7, piedraMat, 0, 1.04, 0));
  grupo.position.y = 1.08;
  p.add(grupo);
  return p;
}

function pendulo() {
  const g = new THREE.Group();
  g.add(caja(0.04, 0.8, 0.04, madOscura, -0.25, 0.4, 0), caja(0.04, 0.8, 0.04, madOscura, 0.25, 0.4, 0), caja(0.56, 0.04, 0.04, madOscura, 0, 0.8, 0));
  const brazo = new THREE.Group(); brazo.position.y = 0.78;
  const hilo = cil(0.004, 0.004, 0.6, laton, 6); hilo.position.y = -0.3; brazo.add(hilo);
  const bola = esfera(0.06, laton); bola.position.y = -0.62; brazo.add(bola);
  g.add(brazo);
  return { grupo: g, actualizar: (t) => { brazo.rotation.z = 0.45 * Math.sin(t * 2.4); } };
}

function balanza() {
  const g = new THREE.Group();
  g.add(cil(0.12, 0.14, 0.04, madOscura), caja(0.03, 0.7, 0.03, laton, 0, 0.36, 0));
  const astil = new THREE.Group(); astil.position.y = 0.7;
  astil.add(caja(0.7, 0.02, 0.02, laton));
  const platos = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group(); p.position.x = s * 0.33;
    const h = cil(0.003, 0.003, 0.3, laton, 4); h.position.y = -0.15; p.add(h);
    const pl = cil(0.09, 0.07, 0.015, laton, 20); pl.position.y = -0.3; p.add(pl);
    astil.add(p); platos.push(p);
  }
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 20), new THREE.MeshStandardMaterial({ color: 0x7fb8e0, transparent: true, opacity: 0.45, roughness: 0.1 }));
  agua.position.set(0.33, 0.1, 0); g.add(agua);
  g.add(astil);
  return {
    grupo: g, actualizar: (t) => {
      astil.rotation.z = 0.12 * Math.sin(t * 1.1);
      for (const p of platos) p.rotation.z = -astil.rotation.z;
    },
  };
}

function compas() {
  const g = new THREE.Group();
  g.add(caja(0.5, 0.04, 0.35, madOscura, 0, 0.02, 0));
  const eje = new THREE.Group(); eje.position.set(0, 0.06, 0.12); eje.rotation.x = -0.9; g.add(eje);
  eje.add(cil(0.035, 0.035, 0.03, laton, 16));
  const piernas = [];
  for (const s of [-1, 1]) {
    const p = new THREE.Group();
    const barra = caja(0.035, 0.42, 0.012, laton); barra.position.y = 0.21; p.add(barra);
    eje.add(p); piernas.push([p, s]);
  }
  return { grupo: g, actualizar: (t) => { const a = 0.25 + 0.35 * (1 + Math.sin(t * 0.9)); for (const [p, s] of piernas) p.rotation.z = s * a; } };
}

function anteojoTripode() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const pata = cil(0.012, 0.015, 0.75, madOscura, 6);
    pata.position.set(Math.cos(a) * 0.14, 0.35, Math.sin(a) * 0.14);
    pata.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(pata);
  }
  const cabezal = new THREE.Group(); cabezal.position.y = 0.72; g.add(cabezal);
  const tubo = new THREE.Group(); cabezal.add(tubo);
  const t1 = cil(0.045, 0.05, 0.6, cuero, 20); t1.rotation.x = Math.PI / 2; tubo.add(t1);
  for (const z of [-0.28, 0, 0.28]) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 20), laton); a.position.z = z; tubo.add(a); }
  tubo.rotation.x = 0.6;
  return { grupo: g, actualizar: (t) => { cabezal.rotation.y = Math.sin(t * 0.3) * 0.8; } };
}

function esferaArmilar() {
  const g = new THREE.Group();
  g.add(cil(0.1, 0.12, 0.05, madOscura), caja(0.03, 0.25, 0.03, laton, 0, 0.14, 0));
  const centro = new THREE.Group(); centro.position.y = 0.48; g.add(centro);
  centro.add(esfera(0.05, new THREE.MeshStandardMaterial({ color: 0x3f6fb0, roughness: 0.6 })));
  const anillos = [];
  for (const [r, rx, rz] of [[0.2, 0, 0], [0.2, Math.PI / 2, 0], [0.18, 0.4, 0.4], [0.22, Math.PI / 2, 0.41]]) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 48), laton);
    a.rotation.set(rx, 0, rz); centro.add(a); anillos.push(a);
  }
  return { grupo: g, actualizar: (t) => { centro.rotation.y = t * 0.4; anillos[2].rotation.y = t * 0.7; } };
}

/* ---------- Motor de la historia ---------- */

export function crearHistoria({ velo, vineta = () => {}, calidad = 'alta', via = null }) {
  const sombras = calidad !== 'baja';
  const tamSombra = calidad === 'alta' ? 2048 : 1024;
  const texViaCompartida = via || new THREE.TextureLoader().load('tex/4k_stars_milky_way.jpg');
  texViaCompartida.colorSpace = THREE.SRGBColorSpace;
  const escena = new THREE.Scene();
  const raiz = new THREE.Group();
  escena.add(raiz);
  const cargador = new THREE.TextureLoader();
  const esc = [];

  /* 0 · Espacio profundo: una estrella se acerca */
  {
    const g = new THREE.Group();
    const fondoVia = new THREE.Mesh(new THREE.SphereGeometry(950, 64, 32), new THREE.MeshBasicMaterial({ map: texViaCompartida, side: THREE.BackSide, depthWrite: false, color: new THREE.Color(1.8, 1.8, 2) }));
    fondoVia.scale.x = -1; fondoVia.rotation.set(1.0, -0.6, 0.3);
    g.add(fondoVia, campoEstrellas(3500, 900, 2.2, 1));

    // Nebulosas pintadas a mano (capas de nubes de color).
    const nebulosa = (colores, semilla) => lienzo(512, 512, (c, w, h) => {
      const r = azar(semilla);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 160; i++) {
        const a = r() * TAU, d = Math.pow(r(), 0.8) * w * 0.3;
        const x = w / 2 + Math.cos(a) * d * 1.3, y = h / 2 + Math.sin(a) * d * 0.7, rr = w * (0.05 + r() * 0.15);
        const col = colores[(r() * colores.length) | 0];
        const gr = c.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, `rgba(${col},${0.05 + r() * 0.08})`); gr.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = gr; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    });
    for (const [x, y, z, cols, s, sem] of [
      [-320, 150, -520, ['255,70,160', '120,90,255', '255,140,90'], 520, 5],
      [380, -140, -460, ['60,200,255', '80,120,255', '160,255,220'], 560, 9],
      [-260, -240, 260, ['140,110,255', '255,120,200'], 600, 13],
      [240, 260, -120, ['255,90,60', '255,190,90'], 480, 21],
    ]) {
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulosa(cols, sem), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95 }));
      n.scale.set(s, s * 0.7, 1); n.position.set(x, y, z); g.add(n);
    }

    // Polvo cercano: al avanzar pasa a los lados y da sensación de viaje.
    {
      const n = 1800, pos = new Float32Array(n * 3), r = azar(88);
      for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 140, (r() - 0.5) * 90, 20 - r() * 520], i * 3);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, map: puntoTex, color: 0xaecbff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    }

    // La estrella: núcleo, corona y rayos que giran.
    const rayosTex = lienzo(512, 512, (c, w) => {
      c.translate(w / 2, w / 2); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) {
        c.rotate(TAU / 12);
        const gr = c.createLinearGradient(0, 0, w / 2, 0);
        gr.addColorStop(0, 'rgba(255,240,210,.9)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
        c.fillStyle = gr; c.beginPath(); c.moveTo(0, -3 - (i % 2) * 3); c.lineTo(w / 2, 0); c.lineTo(0, 3 + (i % 2) * 3); c.fill();
      }
    });
    const sol = new THREE.Group(); sol.position.set(0, 20, -620);
    const rayos = new THREE.Sprite(new THREE.SpriteMaterial({ map: rayosTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
    rayos.scale.set(260, 260, 1);
    const corona = halo(0xffc070, 190, 0.5);
    sol.add(esfera(9, new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), 32), halo(0xfff0c8, 70, 0.95), corona, halo(0xff9a50, 460, 0.18), rayos);
    g.add(sol);

    // Paso junto a Júpiter y sus cuatro lunas (los descubrimientos de Galileo).
    const luzEstrella = new THREE.DirectionalLight(0xfff0dc, 2.8); luzEstrella.position.set(-0.7, 0.25, 0.55); g.add(luzEstrella);
    g.add(new THREE.AmbientLight(0x334466, 0.12));
    const jup = cargador.load('tex/2k_jupiter.jpg'); jup.colorSpace = THREE.SRGBColorSpace;
    const sistemaJ = new THREE.Group(); sistemaJ.position.set(55, -12, -230); g.add(sistemaJ);
    const jupiter = esfera(16, new THREE.MeshStandardMaterial({ map: jup, roughness: 0.9 }), 64); sistemaJ.add(jupiter);
    const lunasJ = [[26, 0.9, 1.4, 0xe8cf6a], [34, 0.8, 0.9, 0xd9d2c4], [44, 1.2, 0.55, 0x9d907f], [56, 1.1, 0.3, 0x6f6456]].map(([d, rr, v, c], i) => {
      const m = esfera(rr, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }), 24); sistemaJ.add(m);
      return { m, d, v, f: i * 1.7 };
    });

    esc.push({ grupo: g, fondo: new THREE.Color(0x000000), entrada: 'fundido', ruta: [V(0, 0, 0), V(0, 3, -420), 30], limites: [-60, 160], mirada: 0.03,
      actualizar: (t) => {
        corona.material.opacity = 0.45 + 0.1 * Math.sin(t * 2.3);
        rayos.material.rotation = t * 0.04;
        jupiter.rotation.y = t * 0.15;
        for (const l of lunasJ) { const a = t * l.v * 0.3 + l.f; l.m.position.set(Math.cos(a) * l.d, Math.sin(a) * l.d * 0.08, Math.sin(a) * l.d); }
      } });
  }

  /* 1 · La Tierra */
  {
    const g = new THREE.Group();
    g.add(campoEstrellas(4000, 900, 2, 2));
    const sol = new THREE.DirectionalLight(0xfff4e0, 3.2); sol.position.set(60, 20, 30); g.add(sol);
    g.add(new THREE.AmbientLight(0x223355, 0.25));
    const inclinacion = new THREE.Group(); inclinacion.position.set(0, 0, -40); inclinacion.rotation.x = THREE.MathUtils.degToRad(43.7); g.add(inclinacion);
    const giro = new THREE.Group(); inclinacion.add(giro);
    const dia = cargador.load('tex/2k_earth_daymap.jpg'); dia.colorSpace = THREE.SRGBColorSpace; dia.anisotropy = 8;
    const nubes = cargador.load('tex/2k_earth_clouds.jpg'); nubes.anisotropy = 8;
    giro.add(new THREE.Mesh(new THREE.SphereGeometry(6, 96, 48), new THREE.MeshStandardMaterial({ map: dia, roughness: 0.8 })));
    const capaNubes = new THREE.Mesh(new THREE.SphereGeometry(6.06, 96, 48), new THREE.MeshStandardMaterial({ alphaMap: nubes, color: 0xffffff, transparent: true, depthWrite: false }));
    giro.add(capaNubes);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(6.35, 64, 32), new THREE.ShaderMaterial({
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.); vP=p.xyz; gl_Position=projectionMatrix*p; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vP; void main(){ float r=pow(1.0-abs(dot(vN,normalize(-vP))),2.2); gl_FragColor=vec4(0.35,0.62,1.0,1.0)*r*1.4; }',
      side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    atm.position.copy(inclinacion.position); g.add(atm);
    const luna = cargador.load('tex/2k_moon.jpg'); luna.colorSpace = THREE.SRGBColorSpace;
    const lunaM = esfera(1.6, new THREE.MeshStandardMaterial({ map: luna, roughness: 1 }), 48); lunaM.position.set(16, 4, -70); g.add(lunaM);
    // Italia mirando a la cámara al final del acercamiento (longitud 11°E).
    const giroFinal = -Math.PI / 2 - THREE.MathUtils.degToRad(11);
    esc.push({ grupo: g, fondo: new THREE.Color(0x000000), entrada: 'salto', ruta: [V(0, 0, 0), V(0, 0, -27), 20], limites: [-20, 6], mirada: 0,
      actualizar: (t, te) => {
        giro.rotation.y = giroFinal - 1.4 * (1 - suaveEntre(clamp(te / 20, 0, 1)));
        capaNubes.rotation.y = t * 0.01;
      } });
  }

  /* 2 y 3 · Florencia, 1610 */
  const ciudad = new THREE.Group();
  const actualizaciones = [];
  {
    const g = ciudad;
    const cieloMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `varying vec3 vP; void main(){ float h=normalize(vP).y;
        vec3 arriba=vec3(0.10,0.16,0.38), medio=vec3(0.55,0.42,0.55), horizonte=vec3(1.0,0.62,0.32);
        vec3 c = h>0.25 ? mix(medio, arriba, clamp((h-0.25)/0.6,0.,1.)) : mix(horizonte, medio, clamp(h/0.25,0.,1.));
        if (h<0.0) c=horizonte*0.6; gl_FragColor=vec4(c,1.0); }`,
    });
    g.add(new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), cieloMat));
    const solPoniente = halo(0xffc070, 160, 0.9); solPoniente.position.set(-420, 40, 380); g.add(solPoniente);
    g.add(new THREE.HemisphereLight(0xffd8b0, 0x3a2a20, 1.4));
    const luzSol = new THREE.DirectionalLight(0xffb070, 2.4); luzSol.position.set(-60, 26, 45); g.add(luzSol, luzSol.target);
    luzSol.castShadow = sombras;
    luzSol.shadow.mapSize.set(tamSombra, tamSombra);
    Object.assign(luzSol.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 5, far: 180 });
    luzSol.shadow.bias = -0.0006; luzSol.shadow.normalBias = 0.04;

    const suelo = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ map: adoquines, roughness: 0.95 }));
    suelo.rotation.x = -Math.PI / 2; g.add(suelo);

    const r = azar(77);
    const colores = ['#d9a86a', '#c8834f', '#e2c48f', '#b86b44', '#d7b48a', '#c99a62'];
    const cortinas = ['#3f5a3a', '#6b3a22', '#4a4a3a'];
    const texturas = colores.map((c, i) => fachada(c, cortinas[i % 3], 100 + i));
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * TAU + r() * 0.08;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.22) continue;
      if (Math.abs(Math.atan2(Math.sin(a + 2.0), Math.cos(a + 2.0))) < 0.3) continue;
      const d = 17 + r() * 16, w = 6 + r() * 5, h = 8 + r() * 8, p = 6 + r() * 3;
      const mat = materialFachada(texturas[i % texturas.length], Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 9)));
      const casa = new THREE.Group();
      casa.add(caja(w, h, p, mat, 0, h / 2, 0));
      const techo = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, p) / 2 * 1.02, 2.2, 4), tejado);
      techo.rotation.y = Math.PI / 4; techo.scale.set(w / Math.hypot(w, p) * 1.41, 1, p / Math.hypot(w, p) * 1.41); techo.position.y = h + 1.1; casa.add(techo);
      // Chimenea, alero y jardineras con flores en las ventanas.
      casa.add(caja(0.7, 2.2, 0.7, piedraMat, w * 0.25, h + 1.6, -p * 0.15));
      casa.add(caja(w + 0.4, 0.25, p + 0.4, madOscura, 0, h + 0.05, 0));
      if (r() < 0.65) {
        const alto = h * 0.36 + 0.3;
        for (const x of [-w * 0.28, w * 0.28]) {
          casa.add(caja(1.5, 0.28, 0.35, madOscura, x, alto, p / 2 + 0.18));
          for (let f = 0; f < 5; f++) {
            const flor = esfera(0.13, new THREE.MeshStandardMaterial({ color: [0xc0302a, 0xe0a030, 0xd05080, 0x3a7a2a][(f + i) % 4], roughness: 0.8 }), 8);
            flor.position.set(x - 0.55 + f * 0.27, alto + 0.22, p / 2 + 0.2); casa.add(flor);
          }
        }
      }
      casa.position.set(Math.sin(a) * d, 0, -Math.cos(a) * d);
      casa.rotation.y = -a;
      g.add(casa);
    }
    // Duomo
    const duomo = new THREE.Group(); duomo.position.set(50, 0, -70);
    duomo.add(caja(30, 18, 60, new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 }), 0, 9, 25));
    duomo.add(cil(16, 16, 12, new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.8 }), 8).translateY(24));
    const cupula = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 12, 0, TAU, 0, Math.PI / 2), tejado); cupula.scale.y = 1.35; cupula.position.y = 30; duomo.add(cupula);
    for (let k = 0; k < 8; k++) { const nerv = caja(0.8, 22, 0.8, new THREE.MeshStandardMaterial({ color: 0xf2eee4 })); const a = k / 8 * TAU; nerv.position.set(Math.sin(a) * 11, 40, Math.cos(a) * 11); nerv.rotation.set(Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55); duomo.add(nerv); }
    duomo.add(cil(1.8, 2.2, 6, new THREE.MeshStandardMaterial({ color: 0xf2eee4 })).translateY(54));
    g.add(duomo);
    // Campanario de rayas
    const rayas = lienzo(64, 256, (c, w, h) => { const cs = ['#efe9dc', '#3f6a4c', '#efe9dc', '#c98a86']; for (let y = 0; y < 16; y++) { c.fillStyle = cs[y % 4]; c.fillRect(0, y * 16, w, 16); } });
    const camp = caja(7, 60, 7, new THREE.MeshStandardMaterial({ map: rayas, roughness: 0.8 }), 30, 30, -60); g.add(camp);
    g.add(new THREE.Mesh(new THREE.ConeGeometry(5.5, 5, 4), tejado).translateX(30).translateY(62.5).translateZ(-60));
    // Palazzo Vecchio
    const palacio = new THREE.Group(); palacio.position.set(-45, 0, -52);
    palacio.add(caja(22, 26, 22, piedraMat, 0, 13, 0));
    palacio.add(caja(5, 30, 5, piedraMat, 0, 41, -4));
    for (let k = 0; k < 8; k++) palacio.add(caja(1.6, 2, 1.6, piedraMat, (k % 4) * 3 - 4.5, 27, k < 4 ? -11 : 11));
    palacio.add(caja(7, 3, 7, piedraMat, 0, 57, -4));
    // Estandartes rojos con el lirio de Florencia.
    const lirio = lienzo(128, 256, (c, w, h) => {
      c.fillStyle = '#b3201c'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2ead8';
      c.beginPath(); c.ellipse(64, 110, 12, 40, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(36, 118, 10, 30, -0.7, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(92, 118, 10, 30, 0.7, 0, TAU); c.fill();
      c.fillRect(34, 150, 60, 10);
      c.fillStyle = '#d4a24c'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10);
    });
    for (const x of [-7, 0, 7]) {
      const estandarte = new THREE.Mesh(new THREE.PlaneGeometry(3, 7), new THREE.MeshStandardMaterial({ map: lirio, side: THREE.DoubleSide, roughness: 0.9 }));
      estandarte.position.set(x, 18, 11.1); palacio.add(estandarte);
    }
    g.add(palacio);

    // Galería de arcos (loggia) mirando a la plaza.
    const loggia = new THREE.Group();
    const piedraClara = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.8 });
    for (let k = 0; k < 4; k++) {
      const x = -7.5 + k * 5;
      loggia.add(cil(0.35, 0.4, 6, piedraClara, 16).translateX(x).translateY(3));
      if (k < 3) {
        const arco = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.35, 10, 24, Math.PI), piedraClara);
        arco.position.set(x + 2.5, 6, 0); loggia.add(arco);
      }
    }
    loggia.add(caja(16, 2.2, 5, piedraClara, 0, 9.6, -2), caja(16.4, 0.4, 5.4, tejado, 0, 10.9, -2), caja(15.5, 8.5, 0.4, piedraMat, 0, 4.2, -4.3));
    loggia.position.set(Math.sin(-2.0) * 19, 0, -Math.cos(-2.0) * 19); loggia.rotation.y = 2.0;
    g.add(loggia);
    // Colinas y cipreses
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      const col = esfera(60 + r() * 50, new THREE.MeshStandardMaterial({ color: 0x5d6b4a, roughness: 1 }), 16);
      col.scale.y = 0.35; col.position.set(Math.sin(a) * 330, -8, -Math.cos(a) * 330); g.add(col);
    }
    const ciprésMat = new THREE.MeshStandardMaterial({ color: 0x24361f, roughness: 1 });
    for (let i = 0; i < 40; i++) {
      const a = r() * TAU, d = 60 + r() * 180;
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.2, 9 + r() * 6, 8), ciprésMat);
      c.position.set(Math.sin(a) * d, 5, -Math.cos(a) * d); g.add(c);
    }
    g.fog = new THREE.Fog(0xd29a72, 60, 420);

    // Nubes de atardecer.
    const nubeTex = lienzo(256, 128, (c, w, h) => {
      const rr = azar(55);
      for (let i = 0; i < 26; i++) {
        const x = 30 + rr() * (w - 60), y = 50 + rr() * 40, rad = 18 + rr() * 30;
        const gr = c.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    });
    const nubes = [];
    for (let i = 0; i < 12; i++) {
      const color = [0xffc9a8, 0xf7b2b8, 0xffe0c0][i % 3];
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: nubeTex, color, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
      const a = r() * TAU, d = 260 + r() * 200;
      n.position.set(Math.sin(a) * d, 70 + r() * 90, -Math.cos(a) * d); n.scale.set(160 + r() * 120, 60 + r() * 40, 1);
      g.add(n); nubes.push({ n, a, d, v: 0.004 + r() * 0.004 });
    }
    actualizaciones.push((t) => { for (const c of nubes) { const a = c.a + t * c.v; c.n.position.x = Math.sin(a) * c.d; c.n.position.z = -Math.cos(a) * c.d; } });

    // Antorchas encendidas alrededor de la plaza.
    const llamas = [];
    for (const a of [1.25, -1.3, 2.25, -2.6, 0.55, -0.45]) {
      const antorcha = new THREE.Group(); antorcha.position.set(Math.sin(a) * 13.6, 0, -Math.cos(a) * 13.6);
      antorcha.add(cil(0.06, 0.09, 2.6, madOscura, 8).translateY(1.3));
      antorcha.add(cil(0.16, 0.1, 0.3, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.6 }), 10).translateY(2.7));
      const fuego = halo(0xffa040, 0.9, 1); fuego.position.y = 3.0; antorcha.add(fuego);
      const brillo = halo(0xff7a20, 3.2, 0.35); brillo.position.y = 3.0; antorcha.add(brillo);
      g.add(antorcha); llamas.push({ fuego, brillo, f: a * 7 });
    }
    actualizaciones.push((t) => {
      for (const l of llamas) {
        const k = 0.85 + 0.15 * Math.sin(t * 11 + l.f) + 0.08 * Math.sin(t * 23 + l.f);
        l.fuego.scale.set(0.8 * k, 1.1 * k, 1); l.brillo.material.opacity = 0.3 * k;
      }
    });

    // Casa de Galileo, al frente
    const casaG = new THREE.Group(); casaG.position.set(0, 0, -26);
    const matG = materialFachada(fachada('#e0b77e', '#3f5a3a', 999, 1));
    casaG.add(caja(10, 12, 8, matG, 0, 6, 0));
    const techoG = new THREE.Mesh(new THREE.ConeGeometry(6.6, 2.6, 4), tejado); techoG.rotation.y = Math.PI / 4; techoG.scale.set(1.05, 1, 0.85); techoG.position.y = 13.3; casaG.add(techoG);
    // Halo cálido y su anteojo asomando por la ventana central del piso de arriba.
    const brilloV = halo(0xffb050, 3.2, 0.45); brilloV.position.set(0.08, 10.0, 4.35); casaG.add(brilloV);
    const miniTel = cil(0.06, 0.08, 1.3, cuero, 12); miniTel.rotation.set(0.95, 0, 0.25); miniTel.position.set(0.25, 10.1, 4.55); casaG.add(miniTel);
    g.add(casaG);

    const pos = (a, d) => [Math.sin(a) * d, -Math.cos(a) * d];

    // Niños: dos se persiguen, uno salta y dos se pasan una pelota.
    const ninos = [
      crearPersona({ tipo: 'nino', ropa: 0x8a2f2f, ropa2: 0x4a3a2a, sombrero: 'gorro', semilla: 10 }),
      crearPersona({ tipo: 'nina', ropa: 0x2f5a8a, ropa2: 0xe8dcc4, semilla: 11 }),
      crearPersona({ tipo: 'nino', ropa: 0x6a8a2f, ropa2: 0x3a2a1a, semilla: 12 }),
      crearPersona({ tipo: 'nina', ropa: 0x8a6a2f, ropa2: 0xd8c8a8, semilla: 13 }),
      crearPersona({ tipo: 'nino', ropa: 0x5a2f8a, ropa2: 0x2a2a3a, sombrero: 'boina', semilla: 14 }),
    ];
    ninos.forEach((n) => g.add(n.grupo));
    const pelota = esfera(0.11, new THREE.MeshStandardMaterial({ color: 0xc03a2a, roughness: 0.6 })); g.add(pelota);
    actualizaciones.push((t) => {
      andarEnCirculo(ninos[0], t, 7.5, 2.3, 0.9);
      andarEnCirculo(ninos[1], t, 7.5, 2.3, 0.35);
      const saltarin = ninos[2]; const [sx, sz] = pos(-1.1, 6.5);
      const salto = Math.max(0, Math.sin(t * 4));
      saltarin.grupo.position.set(sx, salto * 0.4, sz); saltarin.grupo.rotation.y = 1.1 + Math.PI;
      animarCaminata(saltarin, 0, 0, t);
      saltarin.brazos.forEach((b, i) => { b.hombro.rotation.z = (i ? 1 : -1) * (0.3 + salto * 2.2); });
      saltarin.piernas.forEach((p) => { p.rodilla.rotation.x = (1 - salto) * 0.5; p.cadera.rotation.x = -(1 - salto) * 0.25; });
      const [ax, az] = pos(2.1, 7), [bx, bz] = pos(2.75, 7.4);
      ninos[3].grupo.position.set(ax, 0, az); ninos[4].grupo.position.set(bx, 0, bz);
      ninos[3].grupo.rotation.y = Math.atan2(bx - ax, bz - az);
      ninos[4].grupo.rotation.y = Math.atan2(ax - bx, az - bz);
      const f = (t * 0.55) % 2, k = f < 1 ? f : 2 - f;
      pelota.position.set(ax + (bx - ax) * k, 0.75 + Math.sin(Math.PI * k) * 1.5, az + (bz - az) * k);
      animarCaminata(ninos[3], 0, 0, t); animarCaminata(ninos[4], 0, 0, t);
      ninos[3].brazos.forEach((b) => { b.hombro.rotation.x = -1.3 * Math.max(0, 1 - k * 2); });
      ninos[4].brazos.forEach((b) => { b.hombro.rotation.x = -1.3 * Math.max(0, k * 2 - 1); });
    });

    // Gente paseando por la plaza.
    const paseantes = [
      [{ tipo: 'hombre', ropa: 0x3a4a6a, ropa2: 0x2a2a2a, sombrero: 'ala' }, 10.5, 1.1, 0],
      [{ tipo: 'mujer', ropa: 0x7a2a3a, ropa2: 0x4a3a2a, sombrero: 'velo' }, 10.5, 1.1, 0.12],
      [{ tipo: 'hombre', ropa: 0x6a4a2a, ropa2: 0x3a2a1a, sombrero: 'boina' }, 11.5, -1.0, 2.1],
      [{ tipo: 'mujer', ropa: 0x2a5a4a, ropa2: 0xd8c8a8 }, 9.5, -0.9, 3.6],
      [{ tipo: 'hombre', ropa: 0x5a2a2a, ropa2: 0x1f1f24, sombrero: 'ala' }, 12.2, 1.25, 4.4],
      [{ tipo: 'mujer', ropa: 0x4a3a6a, ropa2: 0x6a5a4a, sombrero: 'velo' }, 11, 0.95, 5.3],
    ].map(([op, radio, vel, desf], i) => {
      const p = crearPersona({ ...op, semilla: 30 + i }); g.add(p.grupo);
      return { p, radio, vel, desf };
    });
    actualizaciones.push((t) => { for (const w of paseantes) andarEnCirculo(w.p, t, w.radio, w.vel, w.desf); });

    // Puesto de fruta con su vendedora.
    const toldo = lienzo(128, 128, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#efe4c8' : '#a8322a'; c.fillRect(i * 16, 0, 16, h); } });
    const puesto = crearPuesto(toldo);
    const [px, pz] = pos(-0.8, 13); puesto.grupo.position.set(px, 0, pz); puesto.grupo.rotation.y = 0.8 + Math.PI;
    g.add(puesto.grupo); actualizaciones.push((t) => puesto.actualizar(t));

    // Carreta tirada por un caballo dando la vuelta a la plaza.
    const carreta = crearCarreta(); g.add(carreta.grupo);
    actualizaciones.push((t) => {
      const radio = 15.4, a = t * 1.5 / radio + 2.4;
      carreta.grupo.position.set(Math.sin(a) * radio, 0, -Math.cos(a) * radio);
      carreta.grupo.rotation.y = Math.PI / 2 - a;
      carreta.actualizar(t, 1.5);
    });

    // Palomas volando en círculos.
    const palomas = crearPalomas(10); g.add(palomas.grupo);
    actualizaciones.push((t) => palomas.actualizar(t));

    // Un perro corre detrás de los niños.
    const perro = crearPerro(); g.add(perro.grupo);
    actualizaciones.push((t) => {
      const a = t * 2.4 / 7.9 + 0.1;
      perro.grupo.position.set(Math.sin(a) * 7.9, 0, -Math.cos(a) * 7.9);
      perro.grupo.rotation.y = Math.PI / 2 - a;
      perro.actualizar(t);
    });

    // Todo proyecta y recibe sombra del sol poniente, menos el cielo y lo que está muy lejos.
    g.traverse((o) => {
      if (!o.isMesh) return;
      const lejos = o.position.length() > 120 || o.material === cieloMat;
      o.receiveShadow = !lejos;
      if (!lejos && o !== suelo) o.castShadow = true;
    });
    suelo.receiveShadow = true;

    // Inventos en pedestales alrededor
    const inventos = [[pendulo(), 1.6], [balanza(), -1.6], [compas(), 2.6], [anteojoTripode(), -2.5], [esferaArmilar(), 3.14]];
    for (const [inv, a] of inventos) {
      const p = pedestal(inv.grupo);
      p.position.set(Math.sin(a) * 4.2, 0, -Math.cos(a) * 4.2);
      p.rotation.y = -a;
      const brillo = halo(0xffd9a0, 1.6, 0.35); brillo.position.y = 1.6; p.add(brillo);
      g.add(p);
      actualizaciones.push(inv.actualizar);
    }
  }
  const actualizarCiudad = (t) => actualizaciones.forEach((f) => f(t));
  esc.push({ grupo: ciudad, fondo: new THREE.Color(0xd29a72), niebla: ciudad.fog, entrada: 'salto', ruta: [V(0, 1.6, 0), V(0, 1.6, -1.5), 24], limites: [-4, 10], mirada: 0.02, actualizar: actualizarCiudad });
  esc.push({ grupo: ciudad, fondo: new THREE.Color(0xd29a72), niebla: ciudad.fog, entrada: 'continuo', ruta: [null, V(0, 6.5, -16.5), 10], limites: [-6, 4], mirada: 0.2, actualizar: actualizarCiudad });

  /* 4 · El cuarto de Galileo */
  const cuarto = { fase: 'espera', tf: 0, tg: 0, saludo: 0, hablar: false };
  let galileo;
  {
    const g = new THREE.Group();
    const pared = new THREE.MeshStandardMaterial({ map: yeso, roughness: 0.95 });
    const piso = new THREE.MeshStandardMaterial({ map: madera.clone(), roughness: 0.8 });
    piso.map.needsUpdate = true; piso.map.wrapS = piso.map.wrapT = THREE.RepeatWrapping; piso.map.repeat.set(3, 3);
    g.add(caja(6.4, 0.1, 6.4, piso, 0, -0.05, 0));
    g.add(caja(6.4, 0.1, 6.4, madOscura, 0, 3.25, 0));
    for (let i = -2; i <= 2; i++) g.add(caja(0.2, 0.22, 6.4, madOscura, i * 1.3, 3.1, 0));
    g.add(caja(0.1, 3.2, 6.4, pared, -3.2, 1.6, 0), caja(0.1, 3.2, 6.4, pared, 3.2, 1.6, 0), caja(6.4, 3.2, 0.1, pared, 0, 1.6, 3.2));
    // Pared de la puerta, con hueco
    g.add(caja(2.65, 3.2, 0.1, pared, -1.875, 1.6, -3.2), caja(2.65, 3.2, 0.1, pared, 1.875, 1.6, -3.2), caja(1.1, 1.0, 0.1, pared, 0, 2.7, -3.2));
    g.add(caja(0.12, 2.3, 0.2, madOscura, -0.6, 1.1, -3.2), caja(0.12, 2.3, 0.2, madOscura, 0.6, 1.1, -3.2), caja(1.32, 0.12, 0.2, madOscura, 0, 2.26, -3.2));
    const bisagra = new THREE.Group(); bisagra.position.set(-0.55, 0, -3.18); g.add(bisagra);
    const hoja = caja(1.1, 2.2, 0.07, madClara, 0.55, 1.1, 0); bisagra.add(hoja);
    for (const y of [0.5, 1.7]) bisagra.add(caja(0.9, 0.08, 0.09, madOscura, 0.55, y, 0.01));
    const pomo = esfera(0.035, laton, 10); pomo.position.set(0.95, 1.05, 0.06); bisagra.add(pomo);
    // Pasillo detrás de la puerta
    g.add(caja(1.6, 0.1, 5, madOscura, 0, -0.05, -5.7), caja(0.1, 3, 5, pared, -0.8, 1.5, -5.7), caja(0.1, 3, 5, pared, 0.8, 1.5, -5.7), caja(1.6, 3, 0.1, pared, 0, 1.5, -8.2), caja(1.6, 0.1, 5, madOscura, 0, 3, -5.7));
    const luzPasillo = new THREE.PointLight(0xffb060, 0, 6); luzPasillo.position.set(0, 2.4, -6); g.add(luzPasillo);
    // Ventana con el cielo de 1610 (Luna y Júpiter con sus lunas)
    g.add(caja(0.12, 1.4, 1.6, madOscura, -3.14, 1.8, 0.4));
    const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.2), new THREE.MeshBasicMaterial({ map: cieloNoche }));
    vidrio.rotation.y = Math.PI / 2; vidrio.position.set(-3.07, 1.8, 0.4); g.add(vidrio);
    const luzLuna = new THREE.DirectionalLight(0x8fa8ff, 0.5); luzLuna.position.set(-5, 3, 0.4); g.add(luzLuna);
    const tel = anteojoTripode(); tel.grupo.position.set(-2.5, 0.35, 0.4); tel.grupo.scale.setScalar(1.3); g.add(tel.grupo);
    g.add(caja(0.9, 0.35, 0.9, madOscura, -2.5, 0.17, 0.4));
    // Escritorio con libros, vela y el globo
    const mesa = new THREE.Group(); mesa.position.set(2.3, 0, -0.4); g.add(mesa);
    mesa.add(caja(1.1, 0.06, 2, madClara, 0, 0.8, 0));
    for (const [x, z] of [[-0.5, -0.9], [0.5, -0.9], [-0.5, 0.9], [0.5, 0.9]]) mesa.add(caja(0.07, 0.8, 0.07, madOscura, x, 0.4, z));
    const rl = azar(8);
    for (let i = 0; i < 7; i++) mesa.add(caja(0.3, 0.05 + rl() * 0.05, 0.22, new THREE.MeshStandardMaterial({ color: [0x6b2a1a, 0x2a3f5a, 0x4a3a1a, 0x3a5a2a][i % 4] }), -0.25 + rl() * 0.1, 0.86 + i * 0.07, 0.6));
    const papel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ map: mapaCielo })); papel.rotation.x = -Math.PI / 2; papel.rotation.z = 0.2; papel.position.set(0.05, 0.835, -0.1); mesa.add(papel);
    mesa.add(cil(0.03, 0.035, 0.18, new THREE.MeshStandardMaterial({ color: 0xf0e8d0 }), 10).translateY(0.92).translateZ(-0.6));
    const llama = halo(0xffb040, 0.14, 1); llama.position.set(0, 1.04, -0.6); mesa.add(llama);
    const vela = new THREE.PointLight(0xffa050, 4, 7, 1.6); vela.position.set(0, 1.1, -0.6); mesa.add(vela);
    const globo = new THREE.Group(); globo.position.set(2.5, 0, 2.2); g.add(globo);
    globo.add(cil(0.2, 0.25, 0.05, madOscura), caja(0.04, 0.7, 0.04, madOscura, 0, 0.35, 0));
    const tierraMini = cargador.load('tex/2k_earth_daymap.jpg'); tierraMini.colorSpace = THREE.SRGBColorSpace;
    const bola = esfera(0.25, new THREE.MeshStandardMaterial({ map: tierraMini, roughness: 0.7 }), 32); bola.position.y = 0.95; globo.add(bola);
    const mapaPared = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshStandardMaterial({ map: mapaCielo })); mapaPared.position.set(0, 1.9, 3.14); mapaPared.rotation.y = Math.PI; g.add(mapaPared);
    // Estante con libros
    const estante = new THREE.Group(); estante.position.set(3.05, 0, 2.0); estante.rotation.y = -Math.PI / 2; g.add(estante);
    for (let k = 0; k < 4; k++) estante.add(caja(1.6, 0.05, 0.3, madOscura, 0, 0.5 + k * 0.5, 0));
    for (let k = 0; k < 4; k++) for (let i = 0; i < 9; i++) estante.add(caja(0.12, 0.3 + rl() * 0.12, 0.24, new THREE.MeshStandardMaterial({ color: [0x6b2a1a, 0x2a3f5a, 0x5a4a1a, 0x3a5a2a, 0x4a2a3a][(i + k) % 5] }), -0.7 + i * 0.16, 0.7 + k * 0.5, 0));
    // Péndulo colgando del techo
    const penduloCuarto = new THREE.Group(); penduloCuarto.position.set(-1.5, 3.0, -1.8); g.add(penduloCuarto);
    const hiloC = cil(0.004, 0.004, 1.6, laton, 4); hiloC.position.y = -0.8; penduloCuarto.add(hiloC);
    const bolaC = esfera(0.07, laton); bolaC.position.y = -1.65; penduloCuarto.add(bolaC);
    g.add(new THREE.AmbientLight(0xffd0a0, 0.3));

    // La vela proyecta la sombra de Galileo sobre la pared de la puerta.
    const focoVela = new THREE.SpotLight(0xffa860, 14, 9, 1.1, 0.6, 1.4);
    focoVela.position.set(2.3, 1.15, -1.0);
    focoVela.target.position.set(-0.3, 1.2, -3.2);
    focoVela.castShadow = sombras; focoVela.shadow.mapSize.set(tamSombra / 2, tamSombra / 2); focoVela.shadow.bias = -0.0008;
    g.add(focoVela, focoVela.target);

    // Chimenea encendida detrás de ti.
    const chimenea = new THREE.Group(); chimenea.position.set(-1.7, 0, 3.05); chimenea.rotation.y = Math.PI; g.add(chimenea);
    chimenea.add(caja(1.6, 1.2, 0.5, piedraMat, 0, 0.6, 0), caja(1.9, 0.18, 0.62, madOscura, 0, 1.28, 0), caja(1.1, 1.8, 0.4, piedraMat, 0, 2.3, 0.05));
    chimenea.add(caja(0.95, 0.75, 0.3, new THREE.MeshBasicMaterial({ color: 0x0a0503 }), 0, 0.45, 0.12));
    for (let k = 0; k < 3; k++) { const lena = cil(0.06, 0.06, 0.7, madOscura, 10); lena.rotation.z = Math.PI / 2; lena.rotation.y = (k - 1) * 0.4; lena.position.set(0, 0.16 + (k % 2) * 0.06, 0.3); chimenea.add(lena); }
    const llamasCh = [];
    for (let k = 0; k < 5; k++) { const l = halo([0xffb040, 0xff7a20, 0xffd060][k % 3], 0.5, 0.9); l.position.set(-0.3 + k * 0.15, 0.35, 0.32); chimenea.add(l); llamasCh.push(l); }
    const fuego = new THREE.PointLight(0xff7a30, 5, 6, 1.5); fuego.position.set(0, 0.6, 0.8); chimenea.add(fuego);

    // Alfombra, silla y un banco junto a la mesa.
    const alfombraTex = lienzo(256, 256, (c, w, h) => {
      c.fillStyle = '#6a1e1a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d4a24c'; c.lineWidth = 8; c.strokeRect(14, 14, w - 28, h - 28);
      c.strokeStyle = '#2a3a5a'; c.lineWidth = 5; c.strokeRect(30, 30, w - 60, h - 60);
      c.fillStyle = '#d4a24c'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(128, 128, 20 + i * 18, 0, TAU); c.strokeStyle = i % 2 ? '#d4a24c' : '#2a3a5a'; c.stroke(); }
      ruido(c, w, h, 3000, ['#000', '#fff'], 0.08, azar(4));
    });
    const alfombra = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), new THREE.MeshStandardMaterial({ map: alfombraTex, roughness: 1 }));
    alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(0, 0.006, 0.2); alfombra.receiveShadow = true; g.add(alfombra);
    const silla = new THREE.Group(); silla.position.set(1.55, 0, -0.3); silla.rotation.y = -Math.PI / 2; g.add(silla);
    silla.add(caja(0.5, 0.06, 0.5, madClara, 0, 0.48, 0), caja(0.5, 0.6, 0.05, madClara, 0, 0.8, -0.23));
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) silla.add(caja(0.05, 0.48, 0.05, madOscura, x, 0.24, z));

    // Rayo de luna que entra por la ventana.
    const rayoTex = lienzo(64, 256, (c, w, h) => {
      const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(170,190,255,.35)'); gr.addColorStop(1, 'rgba(170,190,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    const rayo = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2), new THREE.MeshBasicMaterial({ map: rayoTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    rayo.position.set(-2.2, 1.1, 0.4); rayo.rotation.set(0, Math.PI / 2, 0.75); g.add(rayo);

    // Polvo flotando en el aire, iluminado por la vela.
    const polvoN = 260, polvoPos = new Float32Array(polvoN * 3), rp = azar(61);
    for (let i = 0; i < polvoN; i++) polvoPos.set([(rp() - 0.5) * 5.5, rp() * 3, (rp() - 0.5) * 5.5], i * 3);
    const polvoGeo = new THREE.BufferGeometry(); polvoGeo.setAttribute('position', new THREE.BufferAttribute(polvoPos, 3));
    const polvo = new THREE.Points(polvoGeo, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, map: puntoTex, color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(polvo);

    g.traverse((o) => { if (o.isMesh && !(o.material && o.material.blending === THREE.AdditiveBlending)) { o.receiveShadow = true; o.castShadow = true; } });
    const efectosCuarto = (t) => {
      llamasCh.forEach((l, k) => { const f = 0.8 + 0.25 * Math.sin(t * (9 + k) + k) + 0.1 * Math.sin(t * 23 + k * 2); l.scale.set(0.45 * f, 0.7 * f, 1); });
      fuego.intensity = 4.5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 17) * 0.5;
      focoVela.intensity = 13 + Math.sin(t * 13) * 1.2;
      polvo.rotation.y = t * 0.01; polvo.position.y = Math.sin(t * 0.2) * 0.1;
    };

    galileo = crearGalileo(calidad);
    galileo.grupo.visible = false;
    g.add(galileo.grupo);

    const reiniciar = () => {
      cuarto.fase = 'espera'; cuarto.tf = 0; cuarto.tg = 0; cuarto.saludo = 0;
      bisagra.rotation.y = 0; galileo.grupo.visible = false; luzPasillo.intensity = 0;
    };
    esc.push({
      grupo: g, fondo: new THREE.Color(0x0b0704), entrada: 'destello', ruta: [V(0, 1.6, 1.4), V(0, 1.6, 1.0), 8], limites: [-1.2, 1.6], mirada: 0,
      entrar: reiniciar,
      actualizar: (t, te, dt, sacudida) => {
        vela.intensity = 3.6 + Math.sin(t * 13) * 0.4 + Math.sin(t * 29) * 0.3;
        llama.scale.set(0.12 + Math.sin(t * 17) * 0.01, 0.2 + Math.sin(t * 11) * 0.03, 1);
        penduloCuarto.rotation.z = 0.25 * Math.sin(t * 1.3);
        bola.rotation.y = t * 0.2;
        tel.actualizar(t * 0.3);
        cuarto.tf += dt;
        if (cuarto.fase === 'golpes') {
          const golpe = [0, 0.55, 1.1].some((s) => cuarto.tf > s && cuarto.tf < s + 0.14);
          bisagra.rotation.y = golpe ? 0.025 * Math.sin(cuarto.tf * 90) : 0;
          if (golpe) sacudida.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, 0);
          if (cuarto.tf > 2.0) { cuarto.fase = 'abre'; cuarto.tf = 0; cuarto.tg = 0; galileo.grupo.visible = true; }
        }
        if (cuarto.fase === 'abre' || cuarto.fase === 'dentro') {
          bisagra.rotation.y = -1.85 * suaveEntre(clamp(cuarto.tf / 1.6, 0, 1));
          luzPasillo.intensity = 5 * clamp(cuarto.tf / 1.2, 0, 1);
          if (cuarto.tf > 0.7) cuarto.tg += dt;
        }
        // Galileo: camina hasta quedar frente a ti, luego respira, mira y saluda.
        efectosCuarto(t);
        const G = galileo;
        parpadear(G, t);
        const k = clamp(cuarto.tg / 3.6, 0, 1);
        G.grupo.position.set(0, 0, -6.4 + 5.1 * suaveEntre(k));
        const andando = cuarto.fase !== 'espera' && k > 0 && k < 1;
        if (cuarto.fase === 'abre' && k >= 1) { cuarto.fase = 'dentro'; cuarto.saludo = 2.6; }
        G.cuerpo.position.y = andando ? Math.abs(Math.sin(cuarto.tg * 5.5)) * 0.035 : Math.sin(t * 1.6) * 0.004;
        G.cuerpo.rotation.z = andando ? Math.sin(cuarto.tg * 5.5) * 0.03 : 0;
        G.brazos.izq.hombro.rotation.x = andando ? Math.sin(cuarto.tg * 5.5) * 0.3 : 0;
        cuarto.saludo = Math.max(0, cuarto.saludo - dt);
        const der = G.brazos.der;
        const alzar = cuarto.saludo > 0 ? Math.min(1, cuarto.saludo * 3, (2.6 - cuarto.saludo) * 3) : 0;
        const gesto = cuarto.hablar && cuarto.saludo <= 0 ? 0.35 + 0.25 * Math.sin(t * 2.3) : 0;
        der.hombro.rotation.x = andando ? -Math.sin(cuarto.tg * 5.5) * 0.3 : -gesto;
        der.hombro.rotation.z = -0.1 - alzar * 2.3;
        der.codo.rotation.z = alzar ? Math.sin(t * 9) * 0.45 * alzar : 0;
        der.codo.rotation.x = -gesto * 1.4;
        G.boca.scale.y = cuarto.hablar ? 0.2 + 0.9 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.3)) : 0.2;
        G.cabeza.rotation.x = cuarto.hablar ? Math.sin(t * 2.1) * 0.06 : 0;
        G.cabeza.rotation.y = Math.sin(t * 0.5) * 0.12;
      },
    });
  }

  /* 5 · Roma, 1633: el juicio ante la Inquisición */
  const juicio = { fase: 'de pie', tf: 0 };
  {
    const g = new THREE.Group();
    const marmol = lienzo(256, 256, (c, w, h) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#d8d0c0' : '#5a2a24'; c.fillRect(x * 64, y * 64, 64, 64); }
      ruido(c, w, h, 6000, ['#000', '#fff'], 0.07, azar(3));
    }, true);
    marmol.repeat.set(6, 5);
    const sueloJ = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), new THREE.MeshStandardMaterial({ map: marmol, roughness: 0.3, metalness: 0.05 }));
    sueloJ.rotation.x = -Math.PI / 2; g.add(sueloJ);
    const damasco = lienzo(128, 128, (c, w, h) => {
      c.fillStyle = '#5e1414'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(212,162,76,.35)'; c.lineWidth = 3;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(64, 64, 14 + i * 12, 24 + i * 14, 0, 0, TAU); c.stroke(); }
    }, true);
    damasco.repeat.set(8, 4);
    const paredJ = new THREE.MeshStandardMaterial({ map: damasco, roughness: 0.9 });
    const oro = new THREE.MeshStandardMaterial({ color: 0xc89a3c, roughness: 0.35, metalness: 0.8 });
    const terciopelo = new THREE.MeshStandardMaterial({ color: 0x7a1010, roughness: 0.95 });
    g.add(caja(0.3, 9, 15, paredJ, -9, 4.5, 0), caja(0.3, 9, 15, paredJ, 9, 4.5, 0), caja(18, 9, 0.3, paredJ, 0, 4.5, -7.5), caja(18, 9, 0.3, paredJ, 0, 4.5, 7.5));
    g.add(caja(18, 0.35, 0.5, oro, 0, 6.2, -7.3), caja(0.5, 0.35, 15, oro, -8.8, 6.2, 0), caja(0.5, 0.35, 15, oro, 8.8, 6.2, 0));
    // Bóveda de cañón con nervios.
    const boveda = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 15, 40, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0xd9ccb0, roughness: 0.9, side: THREE.DoubleSide }));
    boveda.rotation.x = Math.PI / 2; boveda.scale.set(1, 1, 0.45); boveda.position.y = 9; g.add(boveda);
    for (let z = -6; z <= 6; z += 3) {
      const nervio = new THREE.Mesh(new THREE.TorusGeometry(9, 0.18, 8, 40, Math.PI), oro);
      nervio.scale.y = 0.45; nervio.position.set(0, 9, z); g.add(nervio);
    }
    // Ventanales altos a la izquierda, con rayos de luz.
    const ventanal = new THREE.MeshBasicMaterial({ color: 0xbfd0ff });
    const rayoTexJ = lienzo(64, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(190,210,255,.28)'); gr.addColorStop(1, 'rgba(190,210,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
    for (const z of [-4, 0, 4]) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.4), ventanal); v.rotation.y = Math.PI / 2; v.position.set(-8.83, 5.2, z); g.add(v);
      const rayoJ = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9), new THREE.MeshBasicMaterial({ map: rayoTexJ, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      rayoJ.position.set(-5.5, 3.2, z); rayoJ.rotation.set(0, Math.PI / 2, -0.75); g.add(rayoJ);
    }
    // Estrado, mesa del tribunal y sillas altas.
    g.add(caja(14, 0.5, 3.5, madOscura, 0, 0.25, -5.6), caja(14, 0.25, 0.6, madOscura, 0, 0.125, -3.6));
    g.add(caja(11, 0.9, 1.3, terciopelo, 0, 0.95, -5.2), caja(11.2, 0.12, 1.4, oro, 0, 1.42, -5.2), caja(11.2, 0.95, 0.05, terciopelo, 0, 0.97, -4.52));
    const cardenales = [];
    for (let k = 0; k < 7; k++) {
      const x = -4.5 + k * 1.5;
      g.add(caja(0.8, 2.2, 0.15, terciopelo, x, 1.6, -6.7), caja(0.9, 0.12, 0.2, oro, x, 2.72, -6.7));
      const c = crearPersona({ tipo: 'hombre', largo: true, ropa: 0xa3141a, ropa2: 0xb81c22, sombrero: 'birreta', piel: 0xe0b394, semilla: 120 + k });
      const dePie = k === 3;
      c.grupo.position.set(x, dePie ? 0.5 : 0.08, dePie ? -4.95 : -5.95);
      if (dePie) {
        // La sentencia, sostenida con las dos manos por sus bordes.
        const sentencia = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.46), new THREE.MeshStandardMaterial({ color: 0xefe4c8, side: THREE.DoubleSide, roughness: 0.9 }));
        sentencia.position.set(0, 1.05, 0.5); sentencia.rotation.x = -0.3; c.cuerpo.add(sentencia);
        const sello = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshStandardMaterial({ color: 0x8a1010, roughness: 0.5 }));
        sello.position.set(0, 0.88, 0.556); sello.rotation.x = -0.3; c.cuerpo.add(sello);
      }
      g.add(c.grupo); cardenales.push({ c, dePie, f: k * 1.3 });
    }
    // Candelabros sobre la mesa.
    for (const x of [-3.5, 0.75, 3.5]) {
      const cand = new THREE.Group(); cand.position.set(x, 1.48, -5.2); g.add(cand);
      cand.add(cil(0.06, 0.12, 0.5, laton, 12).translateY(0.25), caja(0.5, 0.04, 0.04, laton, 0, 0.5, 0));
      for (const dx of [-0.22, 0, 0.22]) {
        cand.add(cil(0.025, 0.025, 0.2, new THREE.MeshStandardMaterial({ color: 0xf0e8d0 }), 8).translateX(dx).translateY(0.62));
        const l = halo(0xffb040, 0.16, 1); l.position.set(dx, 0.76, 0); cand.add(l);
      }
    }
    const luzMesa = new THREE.PointLight(0xffa860, 6, 14, 1.4); luzMesa.position.set(0, 2.5, -4.6); g.add(luzMesa);
    // Tapiz con el modelo antiguo: la Tierra en el centro de todo.
    const tapiz = lienzo(256, 256, (c, w, h) => {
      c.fillStyle = '#3a2410'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d4a24c'; c.lineWidth = 3;
      for (const rr of [30, 50, 70, 90, 110]) { c.beginPath(); c.arc(128, 128, rr, 0, TAU); c.stroke(); }
      c.fillStyle = '#3f6fb0'; c.beginPath(); c.arc(128, 128, 16, 0, TAU); c.fill();
      c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(128 + 70, 128, 9, 0, TAU); c.fill();
      c.fillStyle = '#ddd'; c.beginPath(); c.arc(128 - 30, 128, 6, 0, TAU); c.fill();
      c.strokeStyle = '#d4a24c'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    });
    const tapizM = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshStandardMaterial({ map: tapiz, roughness: 0.95 }));
    tapizM.position.set(0, 4.6, -7.3); g.add(tapizM);
    // Guardias con alabarda y monjes mirando desde los bancos.
    for (const s of [-1, 1]) {
      const guardia = crearPersona({ tipo: 'hombre', ropa: 0x2a3a6a, ropa2: 0xc8a040, sombrero: 'gorro', semilla: 140 + s });
      guardia.grupo.position.set(s * 5.6, 0, -2.8); guardia.grupo.rotation.y = -s * 0.5;
      const alabarda = new THREE.Group(); alabarda.position.set(0.28, 0, 0.12);
      alabarda.add(cil(0.02, 0.02, 2.6, madOscura, 8).translateY(1.3), caja(0.03, 0.35, 0.18, new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.9, roughness: 0.3 }), 0, 2.55, 0.08));
      guardia.grupo.add(alabarda);
      guardia.brazos[1].hombro.rotation.x = -0.5;
      g.add(guardia.grupo);
    }
    const monjes = [];
    for (let k = 0; k < 6; k++) {
      const s = k < 3 ? -1 : 1, z = -0.5 + (k % 3) * 1.6;
      g.add(caja(0.5, 0.45, 1.5, madOscura, s * 6.6, 0.22, z));
      const m = crearPersona({ tipo: 'hombre', largo: true, ropa: 0x4a3a2a, ropa2: 0x5a4632, sombrero: 'capucha', semilla: 160 + k });
      m.grupo.position.set(s * 6.6, -0.4, z); m.grupo.rotation.y = -s * Math.PI / 2;
      g.add(m.grupo); monjes.push(m);
    }
    // Galileo, anciano, frente al tribunal; delante, el atril con la Biblia abierta.
    const G2 = crearGalileo(calidad, { viejo: true });
    G2.grupo.position.set(0, 0, -2.2); G2.grupo.rotation.y = Math.PI; g.add(G2.grupo);
    const atril = new THREE.Group(); atril.position.set(0, 0, -2.85); g.add(atril);
    atril.add(caja(0.08, 0.75, 0.08, madOscura, 0, 0.37, 0), caja(0.55, 0.04, 0.4, madOscura, 0, 0.77, 0));
    const libroAbierto = new THREE.Group(); libroAbierto.position.set(0, 0.8, 0); libroAbierto.rotation.x = 0.35; atril.add(libroAbierto);
    for (const s of [-1, 1]) { const hoja = caja(0.2, 0.012, 0.28, new THREE.MeshStandardMaterial({ color: 0xefe6cf }), s * 0.1, 0.01, 0); hoja.rotation.z = -s * 0.08; libroAbierto.add(hoja); }
    libroAbierto.add(caja(0.44, 0.02, 0.3, new THREE.MeshStandardMaterial({ color: 0x3a1a10 }), 0, -0.006, 0));
    const focoGalileo = new THREE.SpotLight(0xffe0b0, 9, 12, 0.35, 0.5, 1.2); focoGalileo.position.set(0, 7.5, 0.5); focoGalileo.target = G2.grupo;
    focoGalileo.castShadow = sombras; focoGalileo.shadow.mapSize.set(tamSombra / 2, tamSombra / 2);
    g.add(focoGalileo);
    g.add(new THREE.AmbientLight(0x8a6a5a, 0.35));
    const luzVentanas = new THREE.DirectionalLight(0xa8bcff, 1.1); luzVentanas.position.set(-8, 7, 1); g.add(luzVentanas);
    g.traverse((o) => { if (o.isMesh && !(o.material && o.material.blending === THREE.AdditiveBlending)) { o.receiveShadow = true; o.castShadow = true; } });

    esc.push({
      grupo: g, fondo: new THREE.Color(0x100606), entrada: 'fundido', ruta: [V(0, 1.65, 4.2), V(0.4, 1.65, 1.2), 18], limites: [-3, 3], mirada: 0.06,
      entrar: () => { juicio.fase = 'de pie'; juicio.tf = 0; G2.cuerpo.position.y = 0; G2.cuerpo.rotation.x = 0; G2.cabeza.rotation.x = 0; G2.brazos.der.hombro.rotation.x = 0; G2.brazos.der.codo.rotation.x = 0; },
      actualizar: (t, te, dt) => {
        for (const { c, dePie, f } of cardenales) {
          animarCaminata(c, 0, 0, t + f);
          if (dePie) {
            // Brazo hacia abajo y adelante, antebrazo horizontal: las manos quedan en las esquinas de arriba del papel.
            c.brazos.forEach((b, i) => {
              const lado = i === 0 ? -1 : 1;
              b.hombro.rotation.x = -0.75 + Math.sin(t * 0.7) * 0.02;
              b.hombro.rotation.z = lado * 0.02;
              b.codo.rotation.x = -0.9;
              b.codo.rotation.z = 0;
            });
            c.boca.scale.y = juicio.fase === 'de pie' ? 0.3 + 0.9 * Math.abs(Math.sin(t * 8) * Math.sin(t * 2.7)) : 0.3;
          } else c.cabeza.rotation.y = Math.sin(t * 0.3 + f) * 0.25;
        }
        for (const m of monjes) animarCaminata(m, 0, 0, t);
        parpadear(G2, t);
        if (juicio.fase === 'arrodillando') {
          juicio.tf += dt;
          const k = suaveEntre(clamp(juicio.tf / 1.8, 0, 1));
          G2.cuerpo.position.y = -0.46 * k;
          G2.cuerpo.rotation.x = 0.12 * k;
          G2.cabeza.rotation.x = 0.35 * k;
          G2.brazos.der.hombro.rotation.x = -0.95 * k;
          G2.brazos.der.codo.rotation.x = -0.25 * k;
        } else {
          G2.cuerpo.position.y = Math.sin(t * 1.4) * 0.004;
        }
      },
    });
  }

  /* 6 · Arcetri, 1638: escribe sus últimos libros; al final subimos a las estrellas */
  const arcetri = { final: false, tf: 0 };
  {
    const g = new THREE.Group();
    // Afuera: noche, colinas, las luces lejanas de Florencia y el cielo que él mismo observó.
    g.add(campoEstrellas(3000, 800, 2, 7));
    const viaA = new THREE.Mesh(new THREE.SphereGeometry(850, 48, 24), new THREE.MeshBasicMaterial({ map: texViaCompartida, side: THREE.BackSide, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.5) }));
    viaA.scale.x = -1; viaA.rotation.set(0.4, 0.8, 0); g.add(viaA);
    const jupA = halo(0xffe6c0, 14, 1); jupA.position.set(0, 380, -140); g.add(jupA);
    for (const dx of [-26, -14, 12, 30]) { const l = halo(0xffffff, 4, 0.95); l.position.set(dx, 381, -140); g.add(l); }
    const campo = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x18220f, roughness: 1 }));
    campo.rotation.x = -Math.PI / 2; campo.position.y = -0.02; g.add(campo);
    const ra = azar(99);
    for (let i = 0; i < 26; i++) {
      const a = ra() * TAU, d = 28 + ra() * 60;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.9, 7 + ra() * 5, 8), new THREE.MeshStandardMaterial({ color: 0x0e1a0c, roughness: 1 }));
      c.position.set(Math.sin(a) * d, 4, -Math.cos(a) * d); g.add(c);
    }
    {
      const n = 500, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = -0.6 + ra() * 1.2 + Math.PI, d = 160 + ra() * 120; pos.set([Math.sin(a) * d, 1 + ra() * 6, -Math.cos(a) * d], i * 3); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, map: puntoTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    }
    // El estudio de la villa.
    const paredA = new THREE.MeshStandardMaterial({ map: yeso, roughness: 0.95 });
    const pisoA = new THREE.MeshStandardMaterial({ map: madera.clone(), roughness: 0.8 });
    pisoA.map.needsUpdate = true; pisoA.map.wrapS = pisoA.map.wrapT = THREE.RepeatWrapping; pisoA.map.repeat.set(2, 2);
    g.add(caja(5, 0.1, 5, pisoA, 0, -0.05, 0));
    g.add(caja(0.12, 3, 5, paredA, -2.5, 1.5, 0), caja(0.12, 3, 5, paredA, 2.5, 1.5, 0), caja(5, 3, 0.12, paredA, 0, 1.5, 2.5));
    g.add(caja(1.9, 3, 0.12, paredA, -1.55, 1.5, -2.5), caja(1.9, 3, 0.12, paredA, 1.55, 1.5, -2.5), caja(1.2, 0.9, 0.12, paredA, 0, 0.45, -2.5), caja(1.2, 0.7, 0.12, paredA, 0, 2.65, -2.5));
    g.add(caja(1.3, 0.1, 0.25, madOscura, 0, 0.92, -2.45));
    const techoA = caja(5.2, 0.14, 5.2, madOscura, 0, 3.05, 0); g.add(techoA);
    // Escritorio: tapa el cuerpo sentado de Galileo.
    g.add(caja(1.9, 0.07, 0.95, madClara, 0, 0.8, -0.9), caja(1.9, 0.72, 0.05, madOscura, 0, 0.42, -0.44));
    const G3 = crearGalileo(calidad, { viejo: true });
    G3.grupo.position.set(0, -0.3, -1.38); g.add(G3.grupo);
    const pluma = new THREE.Group(); pluma.position.set(0, -0.36, 0.03); G3.brazos.der.codo.add(pluma);
    pluma.add(cil(0.004, 0.003, 0.2, madOscura, 6).translateY(0.1));
    const pluMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, side: THREE.DoubleSide });
    const pluM = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.16), pluMat); pluM.position.y = 0.2; pluM.rotation.z = 0.2; pluma.add(pluM);
    const hojas = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshStandardMaterial({ color: 0xefe4c8 })); hojas.rotation.x = -Math.PI / 2; hojas.position.set(-0.05, 0.842, -0.8); g.add(hojas);
    g.add(cil(0.035, 0.04, 0.06, new THREE.MeshStandardMaterial({ color: 0x1a1a24 }), 10).translateX(0.35).translateY(0.87).translateZ(-0.7));
    g.add(cil(0.03, 0.035, 0.16, new THREE.MeshStandardMaterial({ color: 0xf0e8d0 }), 10).translateX(-0.6).translateY(0.92).translateZ(-0.75));
    const llamaA = halo(0xffb040, 0.14, 1); llamaA.position.set(-0.6, 1.05, -0.75); g.add(llamaA);
    const velaA = new THREE.PointLight(0xffa050, 4.5, 7, 1.5); velaA.position.set(-0.6, 1.15, -0.75); g.add(velaA);
    const telA = anteojoTripode(); telA.grupo.position.set(1.5, 0, -2.0); telA.grupo.scale.setScalar(1.3); g.add(telA.grupo);
    // Libros que va escribiendo: aparecen uno a uno sobre la mesa y el estante.
    const estanteA = new THREE.Group(); estanteA.position.set(-2.35, 0, 0.3); estanteA.rotation.y = Math.PI / 2; g.add(estanteA);
    for (let k = 0; k < 3; k++) estanteA.add(caja(1.6, 0.05, 0.3, madOscura, 0, 0.8 + k * 0.55, 0));
    const libros = [];
    const coloresL = [0x6b2a1a, 0x2a3f5a, 0x5a4a1a, 0x3a5a2a, 0x4a2a3a];
    for (let i = 0; i < 16; i++) {
      const enMesa = i < 6;
      const libro = caja(enMesa ? 0.26 : 0.1, enMesa ? 0.05 : 0.3, enMesa ? 0.2 : 0.22, new THREE.MeshStandardMaterial({ color: coloresL[i % 5], roughness: 0.7 }));
      if (enMesa) libro.position.set(0.62, 0.86 + i * 0.055, -0.95);
      else { const j = i - 6; libro.position.set(-0.65 + (j % 5) * 0.13, 0.98 + Math.floor(j / 5) * 0.55, 0); }
      (enMesa ? g : estanteA).add(libro);
      libro.scale.setScalar(0.001);
      libros.push(libro);
    }
    g.add(new THREE.AmbientLight(0x8090c0, 0.18));
    const lunaA = new THREE.DirectionalLight(0x9fb4ff, 0.7); lunaA.position.set(0, 4, -6); g.add(lunaA);
    g.traverse((o) => { if (o.isMesh && !(o.material && o.material.blending === THREE.AdditiveBlending)) { o.receiveShadow = true; o.castShadow = o !== campo; } });

    const subida = () => suaveEntre(clamp(arcetri.tf / 14, 0, 1));
    esc.push({
      grupo: g, fondo: new THREE.Color(0x02030a), entrada: 'fundido', ruta: [V(0, 1.55, 2.2), V(0, 1.5, 1.0), 20], limites: [-1, 1.2],
      mirada: () => -0.12 + subida() * 1.35,
      extra: () => V(0, subida() * 40, subida() * 4),
      entrar: () => { arcetri.final = false; arcetri.tf = 0; techoA.visible = true; libros.forEach((l) => l.scale.setScalar(0.001)); },
      actualizar: (t, te, dt) => {
        if (arcetri.final) arcetri.tf += dt;
        techoA.visible = subida() < 0.03;
        velaA.intensity = 4.2 + Math.sin(t * 13) * 0.4 + Math.sin(t * 27) * 0.25;
        llamaA.scale.set(0.12 + Math.sin(t * 17) * 0.01, 0.2 + Math.sin(t * 11) * 0.03, 1);
        const der = G3.brazos.der, izq = G3.brazos.izq;
        // Codos pegados al cuerpo y antebrazos sobre la mesa: la mano derecha escribe, la izquierda sujeta la hoja.
        der.hombro.rotation.x = -0.55 + Math.sin(t * 5.5) * 0.03;
        der.hombro.rotation.z = 0.22;
        der.codo.rotation.x = -1.05 + Math.sin(t * 7.3) * 0.05;
        der.codo.rotation.z = 0.25 + Math.sin(t * 9.1) * 0.05;
        izq.hombro.rotation.x = -0.5; izq.hombro.rotation.z = -0.24;
        izq.codo.rotation.x = -1.1; izq.codo.rotation.z = -0.35;
        G3.cabeza.rotation.x = 0.38 + Math.sin(t * 0.45) * 0.03;
        G3.cabeza.rotation.y = Math.sin(t * 0.3) * 0.06;
        parpadear(G3, t);
        libros.forEach((l, i) => { l.scale.setScalar(Math.max(0.001, suaveEntre(clamp((te - 2 - i * 1.5) / 0.8, 0, 1)))); });
      },
    });
  }

  // ---------- Saltos, fundidos y cámara ----------

  // Estelas del salto: cabeza blanca y cola azul que se desvanece.
  const N = 600;
  const lineasPos = new Float32Array(N * 6), lineasCol = new Float32Array(N * 6);
  const lineasBase = Array.from({ length: N }, () => ({ a: Math.random() * TAU, r: 1.5 + Math.pow(Math.random(), 0.7) * 40, z: -260 + Math.random() * 280 }));
  const lineasGeo = new THREE.BufferGeometry();
  lineasGeo.setAttribute('position', new THREE.BufferAttribute(lineasPos, 3));
  lineasGeo.setAttribute('color', new THREE.BufferAttribute(lineasCol, 3));
  const lineas = new THREE.LineSegments(lineasGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  lineas.frustumCulled = false;
  escena.add(lineas);

  let actual = -1, te = 0, trans = null, paso = 0, pasoObj = 0, guiado = false;
  let intensidad = 0, fov = 1, oscuridadBordes = 0;
  const local = new THREE.Vector3(), desde = new THREE.Vector3(), sacudida = new THREE.Vector3();
  let camaraRef = null, porAlinear = false;

  const lento = (x) => x * x * (3 - 2 * x);
  const salida = (x) => 1 - Math.pow(1 - x, 3);
  const entrada = (x) => x * x * x;

  function alinear() {
    if (guiado || !camaraRef) { raiz.rotation.y = 0; return; }
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camaraRef.quaternion);
    raiz.rotation.y = Math.atan2(-f.x, -f.z);
  }

  function activar(i) {
    esc.forEach((e) => { e.grupo.visible = false; });
    const e = esc[i];
    raiz.remove(...raiz.children);
    raiz.add(e.grupo);
    e.grupo.visible = true;
    escena.background = e.fondo;
    escena.fog = e.niebla || null;
    actual = i; te = 0; paso = pasoObj = 0;
    desde.copy(e.ruta[0] || local);
    e.entrar?.();
    porAlinear = true;
  }

  // Duraciones: [ida hasta el cambio de escena, vuelta después del cambio]
  const TIEMPOS = { salto: [2.8, 1.9], fundido: [1.1, 1.4], destello: [0.9, 1.8] };
  const COLOR = { salto: '#ffffff', fundido: '#000000', destello: '#ffe2b0' };

  function ir(i) {
    if (i === actual && !trans) return;
    if (actual < 0) {
      activar(i);
      trans = { tipo: 'fundido', t: TIEMPOS.fundido[0], destino: i, hecho: true };
      velo('#000000', 1);
      return;
    }
    if (trans && !trans.hecho) { trans.destino = i; return; }
    const e = esc[i];
    if (e.grupo === esc[actual].grupo) {
      desde.copy(local); actual = i; te = 0; paso = pasoObj = 0;
      return;
    }
    trans = { tipo: e.entrada, t: 0, destino: i, hecho: false };
  }

  // Velo, estelas, campo de visión, bordes oscuros y empuje de cámara en cada instante.
  function efectosTransicion(dt) {
    let int = 0, f = 1, bordes = 0, empuje = 0;
    if (!trans) return { int, f, bordes, empuje };
    trans.t += dt;
    const [ida, vuelta] = TIEMPOS[trans.tipo];
    const t = trans.t;
    if (trans.tipo === 'salto') {
      if (t < 0.8) {
        const k = lento(t / 0.8);
        int = 0.12 * k; f = 1 - 0.08 * k; bordes = 0.45 * k; empuje = -1.2 * k;
        velo(COLOR.salto, 0);
      } else if (t < ida) {
        const u = (t - 0.8) / (ida - 0.8);
        int = 0.12 + 0.88 * Math.pow(u, 2.2);
        f = 0.92 + 0.58 * entrada(u);
        bordes = 0.45 + 0.4 * u;
        empuje = -1.2 + 90 * entrada(u);
        velo(COLOR.salto, u > 0.7 ? lento((u - 0.7) / 0.3) : 0);
      } else {
        const v = clamp((t - ida) / vuelta, 0, 1);
        int = 1 - salida(clamp(v / 0.6, 0, 1));
        f = 1 + 0.5 * Math.exp(-5 * v) * Math.cos(6 * v);
        bordes = 0.85 * (1 - lento(v));
        empuje = -7 * Math.pow(1 - salida(v), 2);
        velo(COLOR.salto, 1 - salida(clamp(v / 0.85, 0, 1)));
      }
    } else if (t < ida) {
      const k = trans.tipo === 'destello' ? Math.pow(t / ida, 2) : lento(t / ida);
      velo(COLOR[trans.tipo], k);
      f = trans.tipo === 'destello' ? 1 - 0.12 * k : 1;
      empuje = trans.tipo === 'destello' ? 1.5 * k : 0;
      bordes = 0.3 * k;
    } else {
      const v = clamp((t - ida) / vuelta, 0, 1);
      velo(COLOR[trans.tipo], 1 - (trans.tipo === 'destello' ? salida(v) : lento(v)));
      bordes = 0.3 * (1 - lento(v));
    }
    if (!trans.hecho && t >= ida) { trans.hecho = true; activar(trans.destino); }
    if (t >= ida + vuelta) { trans = null; velo('#000000', 0); }
    return { int, f, bordes, empuje };
  }

  function actualizar(dt, t, camara, esGuiado) {
    camaraRef = camara; guiado = esGuiado;
    if (actual < 0) return;
    if (porAlinear) { alinear(); porAlinear = false; }
    te += dt;

    const fx = efectosTransicion(dt);
    const e = esc[actual];
    const k = Math.min(1, dt * 8);
    intensidad += (fx.int - intensidad) * k;
    fov += (fx.f - fov) * k;
    oscuridadBordes += (fx.bordes - oscuridadBordes) * k;
    vineta(oscuridadBordes);

    const [, hasta, dur] = e.ruta;
    local.lerpVectors(desde, hasta, suaveEntre(clamp(te / dur, 0, 1)));
    paso += (clamp(pasoObj, ...e.limites) - paso) * Math.min(1, dt * 1.6);
    local.z -= paso + fx.empuje;
    if (e.extra) local.add(e.extra(te));
    sacudida.multiplyScalar(0.8);
    e.actualizar?.(t, te, dt, sacudida);
    camara.position.copy(local).add(sacudida).applyAxisAngle(THREE.Object3D.DEFAULT_UP, raiz.rotation.y);

    lineas.material.opacity = Math.min(1, intensidad * 1.2);
    lineas.visible = intensidad > 0.01;
    if (lineas.visible) {
      lineas.position.copy(camara.position);
      lineas.rotation.y = raiz.rotation.y;
      const largo = 0.5 + 55 * intensidad * intensidad;
      const b = 0.6 + 0.4 * intensidad;
      lineasBase.forEach((l, i) => {
        l.z += dt * (20 + 320 * intensidad);
        if (l.z > 20) l.z -= 280;
        const x = Math.cos(l.a) * l.r, y = Math.sin(l.a) * l.r;
        lineasPos.set([x, y, l.z, x, y, l.z - largo], i * 6);
        lineasCol.set([b, b, b, 0.05, 0.12, 0.35], i * 6);
      });
      lineasGeo.attributes.position.needsUpdate = true;
      lineasGeo.attributes.color.needsUpdate = true;
    }
  }

  return {
    escena, raiz,
    ir,
    actualizar,
    mirada: () => {
      if (actual < 0) return 0;
      const m = esc[actual].mirada;
      return typeof m === 'function' ? m(te) : m;
    },
    abjurar: () => { if (juicio.fase === 'de pie') { juicio.fase = 'arrodillando'; juicio.tf = 0; } },
    final: () => { arcetri.final = true; },
    fovExtra: () => fov,
    ponerPaso: (m) => { pasoObj = m; },
    tocarPuerta: () => { if (esc[actual]?.entrar && cuarto.fase === 'espera') { cuarto.fase = 'golpes'; cuarto.tf = 0; } },
    saludar: () => { if (cuarto.fase === 'dentro') cuarto.saludo = 2.6; },
    hablar: (on) => { cuarto.hablar = on; },
    reiniciar: () => { actual = -1; trans = null; intensidad = 0; fov = 1; oscuridadBordes = 0; velo('#000000', 0); vineta(0); },
  };
}

