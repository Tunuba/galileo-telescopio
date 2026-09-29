const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PUBLIC = path.join(__dirname, 'public');
const MAESTRO = path.join(__dirname, 'maestro');
const KEY = path.join(__dirname, 'cert', 'key.pem');
const CERT = path.join(__dirname, 'cert', 'cert.pem');
const HTTP_PORT = 9610;
const HTTPS_PORT = 9643;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

/* ---------- Estado compartido ---------- */

const estado = {
  abierto: true, zoom: 1, objetivo: 0, seq: 0, modo: 'libre', velocidad: 1, lluvia: 0,
  historia: false, escena: 0, paso: 0, puerta: 0, saludo: 0, hablar: false, abjurar: 0, final: 0,
};
const ULTIMA_ESCENA = 6;
const telefonos = new Set();
const vistas = new Set();
const maestros = new Set();

function enviar(conjunto, datos) {
  const s = `data: ${JSON.stringify(datos)}\n\n`;
  for (const r of conjunto) {
    if (r.destroyed || r.writableEnded) { conjunto.delete(r); continue; }
    try { r.write(s); } catch { conjunto.delete(r); }
  }
}

// Un error de una conexión (un teléfono que se desconecta de golpe) nunca debe tumbar el servidor.
process.on('uncaughtException', (e) => console.error('Error atrapado:', e.message));
process.on('unhandledRejection', (e) => console.error('Promesa atrapada:', e));
function difundir() {
  enviar(telefonos, { estado });
  enviar(vistas, { estado });
  enviar(maestros, { estado, conectados: telefonos.size });
}
setInterval(() => {
  for (const c of [telefonos, vistas, maestros]) {
    for (const r of c) {
      try { r.write(': ping\n\n'); } catch { c.delete(r); }
    }
  }
}, 15000);

function aplicarControl(c) {
  if (typeof c.zoom === 'number' && isFinite(c.zoom)) estado.zoom = Math.min(1.6, Math.max(0.012, c.zoom));
  if (Number.isInteger(c.objetivo) && c.objetivo >= 0 && c.objetivo <= 4) { estado.objetivo = c.objetivo; estado.seq++; }
  if (c.modo === 'libre' || c.modo === 'guiado') estado.modo = c.modo;
  if (typeof c.abierto === 'boolean') estado.abierto = c.abierto;
  if (typeof c.velocidad === 'number' && isFinite(c.velocidad)) estado.velocidad = Math.min(20, Math.max(0, c.velocidad));
  if (c.lluvia === true) estado.lluvia++;
  if (typeof c.historia === 'boolean') estado.historia = c.historia;
  if (Number.isInteger(c.escena) && c.escena >= 0 && c.escena <= ULTIMA_ESCENA && c.escena !== estado.escena) {
    estado.escena = c.escena;
    estado.paso = 0;
    estado.hablar = false;
  }
  if (typeof c.paso === 'number' && isFinite(c.paso)) estado.paso = Math.min(160, Math.max(-60, c.paso));
  if (c.puerta === true) estado.puerta++;
  if (c.saludo === true) estado.saludo++;
  if (c.abjurar === true) estado.abjurar++;
  if (c.final === true) estado.final++;
  if (typeof c.hablar === 'boolean') estado.hablar = c.hablar;
}

/* ---------- HTTP ---------- */

function esLocal(req) {
  const a = req.socket.remoteAddress || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

function servirArchivo(res, base, ruta) {
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.normalize(path.join(base, ruta));
  if (!archivo.startsWith(base)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(archivo, (err, datos) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('No encontrado');
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(datos);
  });
}

function atender(req, res) {
  const url = new URL(req.url, 'http://x');
  const ruta = decodeURIComponent(url.pathname);

  if (ruta === '/api/eventos') {
    const rol = url.searchParams.get('rol');
    const conjunto = rol === 'maestro' && esLocal(req) ? maestros : rol === 'pc' ? vistas : telefonos;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    conjunto.add(res);
    req.socket.setKeepAlive(true, 10000);
    req.on('close', () => { conjunto.delete(res); difundir(); });
    res.on('error', () => conjunto.delete(res));
    difundir();
    return;
  }

  if (ruta === '/api/control') {
    if (!esLocal(req) || req.method !== 'POST') {
      res.writeHead(403);
      return res.end();
    }
    let cuerpo = '';
    req.on('data', (d) => { cuerpo += d; if (cuerpo.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { aplicarControl(JSON.parse(cuerpo)); } catch {}
      difundir();
      res.writeHead(204);
      res.end();
    });
    return;
  }

  if (ruta === '/maestro' || ruta.startsWith('/maestro/')) {
    if (!esLocal(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Solo desde la PC');
    }
    if (ruta === '/maestro') {
      res.writeHead(302, { Location: '/maestro/' });
      return res.end();
    }
    return servirArchivo(res, MAESTRO, ruta.slice('/maestro'.length));
  }

  servirArchivo(res, PUBLIC, ruta);
}

/* ---------- Certificado y arranque ---------- */

function ips() {
  return Object.entries(os.networkInterfaces())
    .filter(([nombre]) => !/vEthernet|VirtualBox|VMware|WSL/i.test(nombre))
    .flatMap(([, lista]) => lista)
    .filter((i) => i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254'))
    .map((i) => i.address);
}

function asegurarCertificado() {
  if (fs.existsSync(KEY) && fs.existsSync(CERT)) return true;
  fs.mkdirSync(path.dirname(KEY), { recursive: true });
  const san = ['DNS:localhost', 'IP:127.0.0.1', 'IP:192.168.137.1', ...ips().map((ip) => 'IP:' + ip)].join(',');
  const candidatos = [
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
  ];
  for (const bin of candidatos) {
    try {
      execFileSync(
        bin,
        ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', KEY, '-out', CERT,
          '-days', '825', '-subj', '/CN=Galileo', '-addext', 'subjectAltName=' + san],
        { stdio: 'ignore', env: { ...process.env, MSYS2_ARG_CONV_EXCL: '*' } }
      );
      return true;
    } catch {}
  }
  return false;
}

function blindar(servidor) {
  servidor.on('clientError', (err, socket) => { try { socket.destroy(); } catch {} });
  servidor.keepAliveTimeout = 65000;
  servidor.requestTimeout = 0;
  return servidor;
}

blindar(http.createServer(atender)).listen(HTTP_PORT, '0.0.0.0');
const conHttps = asegurarCertificado();
if (conHttps) {
  blindar(https.createServer({ key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) }, atender)).listen(HTTPS_PORT, '0.0.0.0');
}

console.log('\n  EL MENSAJERO SIDERAL - servidor encendido\n');
console.log(`  Panel maestro (solo en esta PC): http://127.0.0.1:${HTTP_PORT}/maestro/\n`);
for (const ip of ips()) {
  if (conHttps) console.log(`  Telefonos: https://${ip}:${HTTPS_PORT}`);
}
console.log('');
