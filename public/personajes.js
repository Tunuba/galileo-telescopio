import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const materiales = new Map();

// Materiales compartidos por color: muchos personajes, pocos materiales.
export function mat(color, rugosidad = 0.8, extra = {}) {
  const clave = `${color}|${rugosidad}|${JSON.stringify(extra)}`;
  if (!materiales.has(clave)) materiales.set(clave, new THREE.MeshStandardMaterial({ color, roughness: rugosidad, ...extra }));
  return materiales.get(clave);
}

const G = {
  capsula: (r, largo) => new THREE.CapsuleGeometry(r, largo, 6, 14),
  esfera: (r, a = 20, b = 14) => new THREE.SphereGeometry(r, a, b),
};

function malla(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

/** Une varias geometrías indexadas en una sola (una sola malla = más liviano para el teléfono). */
function unir(geos) {
  let nV = 0, nI = 0;
  for (const g of geos) { nV += g.attributes.position.count; nI += g.index.count; }
  const pos = new Float32Array(nV * 3), nor = new Float32Array(nV * 3), idx = new Uint32Array(nI);
  let v = 0, i = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    for (let k = 0; k < g.index.count; k++) idx[i + k] = g.index.array[k] + v;
    v += g.attributes.position.count; i += g.index.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setIndex(new THREE.BufferAttribute(idx, 1));
  return r;
}

// Mano con palma, cuatro dedos un poco doblados y pulgar. Se crea una vez y la comparten todos.
const MANO = (() => {
  const partes = [new THREE.CapsuleGeometry(0.029, 0.035, 4, 12).scale(1.05, 1, 0.55)];
  for (let d = 0; d < 4; d++) {
    const largo = 0.034 - Math.abs(d - 1.3) * 0.005;
    partes.push(new THREE.CapsuleGeometry(0.0078, largo, 3, 8).rotateX(0.25).translate(-0.02 + d * 0.0135, -0.052 - largo / 2, 0.004));
  }
  partes.push(new THREE.CapsuleGeometry(0.0085, 0.026, 3, 8).rotateZ(0.75).translate(0.03, -0.02, 0.01));
  return unir(partes);
})();

const PIELES = [0xe0b394, 0xc8946e, 0xd9a47f, 0xb07a55, 0xeac2a4];
const PELOS = [0x2a1a0e, 0x4a2e16, 0x6b4520, 0x1a120a, 0x8a6a4a, 0xa89a88];

/**
 * Persona del Renacimiento con articulaciones (cadera, rodilla, hombro, codo).
 * tipo: 'hombre' | 'mujer' | 'nino' | 'nina'. Mira hacia +Z.
 */
export function crearPersona({ tipo = 'hombre', ropa = 0x6b2a2a, ropa2 = 0x2f3a4a, piel, pelo, sombrero = null, semilla = 1, largo = false } = {}) {
  let s = semilla;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pielM = mat(piel ?? PIELES[(r() * PIELES.length) | 0], 0.7);
  const peloM = mat(pelo ?? PELOS[(r() * PELOS.length) | 0], 0.95);
  const ropaM = mat(ropa, 0.85);
  const ropa2M = mat(ropa2, 0.85);
  const zapato = mat(0x2a1a10, 0.6);
  const media = mat(tipo === 'mujer' || tipo === 'nina' ? 0x3a2a20 : 0xe8dcc4, 0.9);
  const oscuro = mat(0x120c08, 0.5);
  const blanco = mat(0xf0ebdf, 0.7);

  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);
  const esNino = tipo === 'nino' || tipo === 'nina';
  const esMujer = tipo === 'mujer' || tipo === 'nina';

  // Piernas
  const piernas = [];
  for (const lado of [-1, 1]) {
    const cadera = new THREE.Group(); cadera.position.set(lado * 0.1, 0.95, 0);
    cadera.add(malla(G.capsula(0.062, 0.34), media, 0, -0.225, 0));
    const rodilla = new THREE.Group(); rodilla.position.y = -0.45; cadera.add(rodilla);
    rodilla.add(malla(G.capsula(0.052, 0.34), media, 0, -0.215, 0));
    const pie = malla(new THREE.BoxGeometry(0.1, 0.07, 0.22), zapato, 0, -0.46, 0.045);
    rodilla.add(pie);
    cuerpo.add(cadera);
    piernas.push({ cadera, rodilla });
  }

  // Torso y ropa
  if (esMujer || largo) {
    // Falda o túnica larga hasta el suelo (mujeres, cardenales, monjes).
    const perfil = [[0.001, 0.02], [0.33, 0.02], [0.3, 0.2], [0.22, 0.65], [0.15, 1.02], [0.13, 1.08], [0.001, 1.08]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const falda = new THREE.Mesh(new THREE.LatheGeometry(perfil, 36), ropaM);
    cuerpo.add(falda);
    if (esMujer) {
      const delantal = malla(new THREE.BoxGeometry(0.26, 0.55, 0.02), blanco, 0, 0.62, 0.2);
      delantal.rotation.x = -0.18; cuerpo.add(delantal);
    }
  } else {
    for (const lado of [-1, 1]) cuerpo.add(malla(G.esfera(0.115), ropa2M, lado * 0.09, 0.9, 0));
  }
  const torso = malla(G.capsula(0.165, 0.3), esMujer ? ropa2M : ropaM, 0, 1.24, 0);
  if (largo && !esMujer) {
    // Muceta (capa corta sobre los hombros) de los cardenales y monjes.
    const muceta = malla(new THREE.SphereGeometry(0.25, 28, 14, 0, Math.PI * 2, 0, 1.25), ropa2M, 0, 1.28, 0);
    muceta.scale.set(1.05, 0.8, 0.85); cuerpo.add(muceta);
  }
  torso.scale.set(1.12, 1, 0.78); cuerpo.add(torso);
  const cinto = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 24), mat(0x3a2412, 0.6));
  cinto.rotation.x = Math.PI / 2; cinto.scale.set(1.12, 0.8, 1); cinto.position.y = 1.07; cuerpo.add(cinto);
  if (!esMujer && !esNino) {
    for (let i = 0; i < 4; i++) cuerpo.add(malla(G.esfera(0.012, 8, 6), mat(0xd4a24c, 0.3, { metalness: 0.8 }), 0, 1.14 + i * 0.08, 0.13));
  }
  const cuello = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 20), blanco);
  cuello.rotation.x = Math.PI / 2; cuello.position.y = 1.5; cuerpo.add(cuello);
  cuerpo.add(malla(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), pielM, 0, 1.52, 0));

  // Cabeza con cara y peinado
  const cabeza = new THREE.Group(); cabeza.position.y = 1.64; cuerpo.add(cabeza);
  const craneo = malla(G.esfera(0.105, 24, 18), pielM); craneo.scale.set(0.95, 1.1, 1); cabeza.add(craneo);
  const ojos = [];
  for (const lado of [-1, 1]) {
    const ojo = new THREE.Group(); ojo.position.set(lado * 0.036, 0.015, 0.088); cabeza.add(ojo);
    ojo.add(malla(G.esfera(0.016, 10, 8), blanco));
    ojo.add(malla(G.esfera(0.009, 8, 6), oscuro, 0, 0, 0.011));
    ojos.push(ojo);
    cabeza.add(malla(new THREE.BoxGeometry(0.035, 0.008, 0.01), peloM, lado * 0.036, 0.042, 0.095));
    cabeza.add(malla(G.esfera(0.02, 8, 6), pielM, lado * 0.1, 0, 0));
  }
  const nariz = malla(new THREE.ConeGeometry(0.016, 0.045, 8), pielM, 0, -0.005, 0.108); nariz.rotation.x = Math.PI / 2; cabeza.add(nariz);
  const boca = malla(G.esfera(0.02, 10, 6), mat(0x7a3a2a, 0.6), 0, -0.052, 0.094); boca.scale.set(1.2, 0.3, 0.4); cabeza.add(boca);
  if (esMujer) {
    const moño = malla(G.esfera(0.06, 12, 10), peloM, 0, 0.03, -0.1); cabeza.add(moño);
    cabeza.add(malla(new THREE.SphereGeometry(0.112, 24, 14, 0, TAU, 0, 1.3), peloM, 0, 0.01, -0.005));
    if (sombrero === 'velo') {
      const velo = malla(new THREE.SphereGeometry(0.125, 24, 14, Math.PI * 0.2, Math.PI * 1.6, 0, 1.9), blanco);
      velo.rotation.y = Math.PI; cabeza.add(velo);
    }
  } else {
    cabeza.add(malla(new THREE.SphereGeometry(0.11, 24, 14, Math.PI / 2 + 0.7, TAU - 1.4, 0, 1.7), peloM, 0, 0.005, -0.005));
    if (!esNino && r() < 0.6) {
      const barba = malla(G.esfera(0.06, 12, 10), peloM, 0, -0.07, 0.06); barba.scale.set(1.2, 0.9, 0.7); cabeza.add(barba);
    }
    if (sombrero === 'boina') {
      const boina = malla(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 20), ropa2M, 0.02, 0.1, 0); boina.rotation.z = -0.25; cabeza.add(boina);
    } else if (sombrero === 'ala') {
      cabeza.add(malla(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 24), mat(0x2a2018, 0.9), 0, 0.075, 0));
      cabeza.add(malla(new THREE.CylinderGeometry(0.09, 0.105, 0.11, 20), mat(0x2a2018, 0.9), 0, 0.13, 0));
    } else if (sombrero === 'gorro') {
      cabeza.add(malla(new THREE.SphereGeometry(0.115, 20, 10, 0, TAU, 0, 1.2), ropa2M, 0, 0.02, 0));
    } else if (sombrero === 'birreta') {
      // Birrete de cardenal: gorro cuadrado rojo con tres crestas y una borla.
      const rojo = mat(0xa3141a, 0.7);
      const base = malla(new THREE.CylinderGeometry(0.1, 0.115, 0.1, 4), rojo, 0, 0.1, 0); base.rotation.y = Math.PI / 4; cabeza.add(base);
      for (const [x, z] of [[0.05, 0], [-0.05, 0], [0, -0.05]]) cabeza.add(malla(new THREE.BoxGeometry(0.012, 0.05, 0.09), rojo, x, 0.17, z));
      cabeza.add(malla(G.esfera(0.02, 10, 8), rojo, 0, 0.19, 0));
    } else if (sombrero === 'capucha') {
      const capucha = malla(new THREE.SphereGeometry(0.135, 20, 12, Math.PI * 0.25, Math.PI * 1.5, 0, 1.9), ropaM, 0, 0.01, -0.01);
      capucha.rotation.y = Math.PI; cabeza.add(capucha);
    }
  }

  // Brazos
  const brazos = [];
  for (const lado of [-1, 1]) {
    // Con falda o túnica, los brazos se separan un poco más para no atravesar la tela.
    const hombro = new THREE.Group(); hombro.position.set(lado * 0.2, 1.44, 0); hombro.rotation.z = lado * (esMujer || largo ? 0.2 : 0.08);
    hombro.add(malla(G.esfera(0.06, 12, 10), esMujer ? ropa2M : ropaM));
    hombro.add(malla(G.capsula(0.05, 0.22), esMujer ? ropa2M : ropaM, 0, -0.15, 0));
    const codo = new THREE.Group(); codo.position.y = -0.3; hombro.add(codo);
    codo.add(malla(G.capsula(0.043, 0.2), esMujer ? ropa2M : ropaM, 0, -0.13, 0));
    const puño = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 14), blanco); puño.rotation.x = Math.PI / 2; puño.position.y = -0.25; codo.add(puño);
    const mano = new THREE.Mesh(MANO, pielM); mano.position.set(0, -0.27, 0.005); mano.scale.set(-lado, 1, 1); codo.add(mano);
    cuerpo.add(hombro);
    brazos.push({ hombro, codo, mano });
  }

  if (esNino) raiz.scale.setScalar(tipo === 'nino' ? 0.66 : 0.63);
  cabeza.scale.setScalar(esNino ? 1.22 : 1);
  raiz.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { grupo: raiz, cuerpo, cabeza, boca, piernas, brazos, esMujer, ojos, parpadeo: 2 + r() * 3 };
}

/** Parpadeo natural cada pocos segundos. */
export function parpadear(p, t) {
  const ciclo = (t + p.parpadeo * 3.7) % p.parpadeo;
  const cerrado = ciclo < 0.12 ? 0.1 : 1;
  for (const o of p.ojos) o.scale.y = cerrado;
}

/** Ciclo de caminata: fase en radianes, fuerza 0 (quieto) a 1 (caminando). */
export function animarCaminata(p, fase, fuerza = 1, t = 0) {
  const s = Math.sin(fase), c = Math.cos(fase);
  const [izq, der] = p.piernas;
  izq.cadera.rotation.x = -s * 0.45 * fuerza;
  der.cadera.rotation.x = s * 0.45 * fuerza;
  izq.rodilla.rotation.x = Math.max(0, Math.sin(fase + 1.2)) * 0.85 * fuerza;
  der.rodilla.rotation.x = Math.max(0, Math.sin(fase + 1.2 + Math.PI)) * 0.85 * fuerza;
  const [bi, bd] = p.brazos;
  bi.hombro.rotation.x = s * 0.4 * fuerza;
  bd.hombro.rotation.x = -s * 0.4 * fuerza;
  bi.codo.rotation.x = -(0.15 + Math.max(0, s) * 0.35) * fuerza - 0.08;
  bd.codo.rotation.x = -(0.15 + Math.max(0, -s) * 0.35) * fuerza - 0.08;
  p.cuerpo.position.y = Math.abs(c) * 0.035 * fuerza + (1 - fuerza) * Math.sin(t * 1.7) * 0.004;
  p.cuerpo.rotation.y = s * 0.07 * fuerza;
  p.cuerpo.rotation.z = c * 0.02 * fuerza;
  if (p.ojos) parpadear(p, t);
}

/* ---------- Perro ---------- */

export function crearPerro(color = 0x8a5a2a) {
  const g = new THREE.Group();
  const pelaje = mat(color, 0.9), oscuro = mat(0x1a120a, 0.6);
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const tronco = malla(G.capsula(0.13, 0.4), pelaje, 0, 0.42, 0); tronco.rotation.x = Math.PI / 2; cuerpo.add(tronco);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 0.58, 0.32); cuerpo.add(cabeza);
  cabeza.add(malla(G.esfera(0.11, 14, 10), pelaje));
  const hocico = malla(G.capsula(0.055, 0.1), pelaje, 0, -0.03, 0.12); hocico.rotation.x = Math.PI / 2; cabeza.add(hocico);
  cabeza.add(malla(G.esfera(0.025, 8, 6), oscuro, 0, -0.02, 0.2));
  for (const lado of [-1, 1]) {
    const oreja = malla(G.capsula(0.03, 0.06), mat(0x5a3a1a, 0.9), lado * 0.08, 0.06, -0.02); oreja.rotation.z = lado * 0.6; cabeza.add(oreja);
    cabeza.add(malla(G.esfera(0.014, 8, 6), oscuro, lado * 0.045, 0.03, 0.09));
  }
  const cola = new THREE.Group(); cola.position.set(0, 0.5, -0.3); cuerpo.add(cola);
  const colaM = malla(G.capsula(0.025, 0.2), pelaje, 0, 0.1, -0.05); colaM.rotation.x = -0.7; cola.add(colaM);
  const patas = [];
  for (const [x, z] of [[-0.08, 0.2], [0.08, 0.2], [-0.08, -0.2], [0.08, -0.2]]) {
    const pata = new THREE.Group(); pata.position.set(x, 0.36, z); cuerpo.add(pata);
    pata.add(malla(G.capsula(0.035, 0.24), pelaje, 0, -0.17, 0));
    patas.push(pata);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    grupo: g,
    actualizar(t) {
      const f = t * 13;
      patas.forEach((p, i) => { p.rotation.x = Math.sin(f + [0, Math.PI, Math.PI, 0][i]) * 0.6; });
      cuerpo.position.y = Math.abs(Math.sin(f)) * 0.04;
      cola.rotation.z = Math.sin(t * 16) * 0.5;
      cabeza.rotation.x = Math.sin(f) * 0.08;
    },
  };
}

/** Recorre un círculo mirando hacia adelante. */
export function andarEnCirculo(p, t, radio, velocidad, desfase = 0, centro = [0, 0]) {
  const a = t * velocidad / radio + desfase;
  const dir = Math.sign(velocidad) || 1;
  p.grupo.position.set(centro[0] + Math.sin(a) * radio, 0, centro[1] - Math.cos(a) * radio);
  p.grupo.rotation.y = (dir > 0 ? Math.PI / 2 : -Math.PI / 2) - a;
  animarCaminata(p, t * Math.abs(velocidad) * 5.2 + desfase * 7, 1, t);
}

/* ---------- Caballo y carreta ---------- */

export function crearCarreta() {
  const g = new THREE.Group();
  const pelaje = mat(0x6b4226, 0.8), crin = mat(0x2a1a10, 0.95), madera = mat(0x5a3a1e, 0.85), hierro = mat(0x2a2a2a, 0.5, { metalness: 0.6 });

  const caballo = new THREE.Group(); caballo.position.z = 1.9; g.add(caballo);
  const tronco = malla(G.capsula(0.26, 0.85), pelaje, 0, 1.15, 0); tronco.rotation.x = Math.PI / 2; caballo.add(tronco);
  const cuello = new THREE.Group(); cuello.position.set(0, 1.3, 0.5); caballo.add(cuello);
  const cuelloM = malla(G.capsula(0.14, 0.45), pelaje, 0, 0.25, 0.1); cuelloM.rotation.x = 0.5; cuello.add(cuelloM);
  const crinM = malla(new THREE.BoxGeometry(0.05, 0.5, 0.12), crin, 0, 0.3, -0.02); crinM.rotation.x = 0.5; cuello.add(crinM);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 0.52, 0.3); cuello.add(cabeza);
  const cabezaM = malla(G.capsula(0.1, 0.32), pelaje, 0, -0.05, 0.12); cabezaM.rotation.x = 1.9; cabeza.add(cabezaM);
  for (const lado of [-1, 1]) {
    const oreja = malla(new THREE.ConeGeometry(0.03, 0.1, 6), pelaje, lado * 0.06, 0.09, 0); cabeza.add(oreja);
    cabeza.add(malla(G.esfera(0.018, 8, 6), crin, lado * 0.075, 0.01, 0.1));
  }
  const cola = new THREE.Group(); cola.position.set(0, 1.25, -0.68); caballo.add(cola);
  const colaM = malla(G.capsula(0.05, 0.45), crin, 0, -0.25, -0.05); colaM.rotation.x = -0.3; cola.add(colaM);
  const patas = [];
  for (const [x, z] of [[-0.15, 0.45], [0.15, 0.45], [-0.15, -0.45], [0.15, -0.45]]) {
    const muslo = new THREE.Group(); muslo.position.set(x, 1.0, z); caballo.add(muslo);
    muslo.add(malla(G.capsula(0.07, 0.35), pelaje, 0, -0.22, 0));
    const corva = new THREE.Group(); corva.position.y = -0.45; muslo.add(corva);
    corva.add(malla(G.capsula(0.045, 0.4), pelaje, 0, -0.24, 0));
    corva.add(malla(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 10), crin, 0, -0.5, 0));
    patas.push({ muslo, corva });
  }

  // Carreta
  const caja = malla(new THREE.BoxGeometry(1.2, 0.35, 1.5), madera, 0, 0.85, -0.3);
  g.add(caja);
  for (const lado of [-1, 1]) g.add(malla(new THREE.BoxGeometry(0.05, 0.05, 1.6), madera, lado * 0.35, 0.95, 1.0));
  const ruedas = [];
  for (const lado of [-1, 1]) {
    const rueda = new THREE.Group(); rueda.position.set(lado * 0.68, 0.55, -0.3); rueda.rotation.z = Math.PI / 2;
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 28), hierro); aro.rotation.y = Math.PI / 2; rueda.add(aro);
    for (let k = 0; k < 8; k++) { const rayo = malla(new THREE.BoxGeometry(0.03, 0.96, 0.03), madera); rayo.rotation.x = (k / 8) * Math.PI; rueda.add(rayo); }
    g.add(rueda); ruedas.push(rueda);
  }
  for (let k = 0; k < 5; k++) g.add(malla(G.esfera(0.12 + (k % 2) * 0.03, 10, 8), mat([0xa0582a, 0x7a8a3a, 0xc8a050][k % 3], 0.8), -0.35 + k * 0.18, 1.12, -0.5 + (k % 2) * 0.3));

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const conductor = crearPersona({ tipo: 'hombre', ropa: 0x4a5a3a, ropa2: 0x3a2a1a, sombrero: 'ala', semilla: 71 });
  conductor.grupo.position.set(0, 0.55, 0.25);
  conductor.piernas.forEach((p) => { p.cadera.rotation.x = -1.4; p.rodilla.rotation.x = 1.4; });
  conductor.brazos.forEach((b) => { b.hombro.rotation.x = -0.9; b.codo.rotation.x = -0.4; });
  g.add(conductor.grupo);

  return {
    grupo: g,
    actualizar(t, velocidad) {
      const f = t * 5.5;
      patas.forEach((p, i) => {
        const fase = f + [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][i];
        p.muslo.rotation.x = Math.sin(fase) * 0.35;
        p.corva.rotation.x = Math.max(0, Math.sin(fase + 1)) * 0.7 * (i < 2 ? -1 : 1);
      });
      tronco.position.y = 1.15 + Math.abs(Math.sin(f)) * 0.03;
      cabeza.rotation.x = Math.sin(f) * 0.12;
      cola.rotation.z = Math.sin(t * 2.3) * 0.25;
      ruedas.forEach((r) => { r.rotation.x = -t * velocidad * 2; });
      conductor.cuerpo.position.y = Math.abs(Math.sin(f * 0.5)) * 0.02;
      parpadear(conductor, t);
    },
  };
}

/* ---------- Palomas ---------- */

export function crearPalomas(n, semilla = 3) {
  let s = semilla;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const g = new THREE.Group();
  const gris = mat(0x8a8a92, 0.8, { side: THREE.DoubleSide });
  const alaGeo = new THREE.BufferGeometry();
  alaGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0, 0, -0.1, 0.35, 0, -0.02], 3));
  alaGeo.computeVertexNormals();
  const aves = [];
  for (let i = 0; i < n; i++) {
    const ave = new THREE.Group();
    const cuerpoA = malla(G.capsula(0.045, 0.14), gris); cuerpoA.rotation.x = Math.PI / 2; ave.add(cuerpoA);
    const alas = [1, -1].map((lado) => { const a = new THREE.Mesh(alaGeo, gris); a.scale.x = lado; ave.add(a); return a; });
    g.add(ave);
    aves.push({ ave, alas, radio: 10 + r() * 14, alto: 9 + r() * 7, vel: 0.25 + r() * 0.2, fase: r() * TAU });
  }
  return {
    grupo: g,
    actualizar(t) {
      for (const a of aves) {
        const ang = t * a.vel + a.fase;
        a.ave.position.set(Math.sin(ang) * a.radio, a.alto + Math.sin(t * 0.7 + a.fase) * 1.5, -Math.cos(ang) * a.radio);
        a.ave.rotation.y = Math.PI / 2 - ang;
        const aleteo = Math.sin(t * 14 + a.fase) * 0.8;
        a.alas[0].rotation.z = aleteo; a.alas[1].rotation.z = -aleteo;
      }
    },
  };
}

/* ---------- Puesto de fruta ---------- */

export function crearPuesto(toldoTex) {
  const g = new THREE.Group();
  const madera = mat(0x5a3a1e, 0.85);
  for (const [x, z] of [[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.5], [0.9, 0.5]]) g.add(malla(new THREE.BoxGeometry(0.07, 2.2, 0.07), madera, x, 1.1, z));
  g.add(malla(new THREE.BoxGeometry(2, 0.08, 1.1), madera, 0, 0.85, 0));
  const toldo = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), new THREE.MeshStandardMaterial({ map: toldoTex, side: THREE.DoubleSide, roughness: 0.9 }));
  toldo.rotation.x = -Math.PI / 2 + 0.35; toldo.position.set(0, 2.25, 0.15); g.add(toldo);
  const frutas = [0xe07a20, 0xc02a1a, 0x8ab02a, 0xe8c030];
  for (let k = 0; k < 4; k++) {
    const cesta = malla(new THREE.CylinderGeometry(0.2, 0.16, 0.14, 14), mat(0x8a6a3a, 0.9), -0.7 + k * 0.46, 0.96, 0.1);
    g.add(cesta);
    for (let j = 0; j < 7; j++) g.add(malla(G.esfera(0.05, 8, 6), mat(frutas[k], 0.6), -0.7 + k * 0.46 + Math.cos(j) * 0.1, 1.06 + (j % 2) * 0.04, 0.1 + Math.sin(j) * 0.1));
  }
  const vendedora = crearPersona({ tipo: 'mujer', ropa: 0x7a3a5a, ropa2: 0x5a4a3a, sombrero: 'velo', semilla: 41 });
  vendedora.grupo.position.set(0, 0, -0.8);
  g.add(vendedora.grupo);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    grupo: g,
    actualizar(t) {
      animarCaminata(vendedora, 0, 0, t);
      const [bi, bd] = vendedora.brazos;
      bd.hombro.rotation.x = -0.6 - Math.max(0, Math.sin(t * 1.3)) * 0.8;
      bd.codo.rotation.x = -0.5;
      bi.hombro.rotation.x = -0.3;
      vendedora.cabeza.rotation.y = Math.sin(t * 0.6) * 0.5;
    },
  };
}
