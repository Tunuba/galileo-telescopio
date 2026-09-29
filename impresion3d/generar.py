"""Genera los STL del telescopio de Galileo para impresora Bambu Lab.

Uso:  python generar.py
Medidas en milímetros.
"""
import os
import struct
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.lib'))
from manifold3d import CrossSection, Manifold, OpType  # noqa: E402

SEG = 180
SALIDA = os.path.dirname(os.path.abspath(__file__))

# ---------- Teléfonos de referencia (con funda): alto x ancho x grosor ----------
TELEFONOS = {
    'Tu teléfono (medida aprox.)': (180.0, 75.0, 5.0),
    'Honor Magic 5 Lite + funda': (166.0, 78.5, 11.5),
    'iPhone 15 + funda': (151.0, 75.5, 11.0),
    'iPhone 15 Pro Max + funda': (164.5, 81.0, 12.0),
    'Galaxy S24 Ultra + funda gruesa': (167.0, 83.5, 13.0),
    'Teléfono grande + funda': (190.0, 88.0, 12.0),
}

# ---------- Telescopio de 3 fases (cónico, se imprime encajado) ----------
PARED = 2.0
CONO = 0.0164          # cuánto se reduce el radio por cada mm de altura
LARGOS = [110.0, 115.0, 120.0]
SOLAPE = 20.0          # mm que quedan encajados al extender cada fase
RADIO_BASE = 30.0      # radio exterior inferior de la fase 1 (tubo de 60 mm)
CHAFLAN = 0.6          # evita que las fases se peguen en la primera capa

# ---------- Fase 4: embudo trapecio universal ----------
# El bolsillo es holgado: la pantalla se apoya en un asiento en V y la espalda del teléfono
# sobresale por detrás. Así las cuerdas que cruzan la espalda siempre lo aprietan, sea grande o chico.
BOLSILLO_ANCHO = 92.0  # teléfonos de 70 a 92 mm de ancho
BOLSILLO_LARGO = 200.0 # hasta 200 mm de alto
LABIO_LADO = 12.0      # ancho del asiento a 45° (ventana de 68 mm)
MURO = 2.4
EMBUDO_ALTO = 74.0     # paredes a ~43°: se imprime sin soportes
COLLAR_ALTO = 12.0
AJUSTE_COLLAR = 0.15
Z_CINTURON_BASE = 14.0

# Cuerdas o elásticos (los pone el usuario): se amarran en una bita a cada lado,
# bajan por un canal exterior, doblan por una muesca del borde y cruzan la espalda del teléfono.
CUERDAS_Y = (-70.0, 70.0)    # una cerca de la parte de abajo del teléfono y otra cerca de la de arriba
# Alturas por donde puede cruzar la cuerda: 0 = por el borde (teléfonos que sobresalen);
# las otras son túneles hacia el asiento para teléfonos delgados que quedan metidos en el marco.
NIVELES_CUERDA = (0.0, 4.5, 8.5)
TUNEL_ALTO = 2.5
CANAL_ANCHO = 12.0           # entra cuerda o elástico de hasta ~10 mm
CANAL_HONDO = 1.2
BITA_HUECO = (22.0, 4.5, 5.0)  # largo (Y), alto (Z) y fondo (X) del hueco donde se amarra
BITA_POSTE = 6.0               # ancho del poste: la cuerda pasa por detrás (3.4 mm de espacio)
BITA_Z = 5.0

# Tapa trasera a presión: ganchitos triangulares que traban en ranuras del marco.
TAPA_FONDO = 13.0      # espacio para la espalda del teléfono que sobresale
TAPA_PLACA = 2.0
TAPA_FALDA = 1.6
TAPA_HOLGURA = 0.25
TAPA_SUBE = 4.6        # cuánto sube la falda sobre el marco
GANCHO_ALTO = 1.0      # cuánto se mete el ganchito en la ranura
ENGANCHE_Z = 1.2       # piso plano de la ranura: ahí traba el ganchito
GANCHOS_Y = (-40.0, 0.0, 40.0)
GANCHO_LARGO = 12.0


def revolver(perfil):
    return Manifold.revolve(CrossSection([perfil]), SEG)


def poligono(puntos):
    p = np.asarray(puntos, dtype=float)
    area = 0.5 * np.sum(p[:, 0] * np.roll(p[:, 1], -1) - np.roll(p[:, 0], -1) * p[:, 1])
    return CrossSection([p[::-1].tolist() if area < 0 else p.tolist()])


def cinturon(r_pared, z0, alto, saliente):
    zm = z0 + alto / 2
    r0 = r_pared(z0) - 0.3
    return revolver([
        (r0, z0),
        (r_pared(z0) + 0.2, z0),
        (r_pared(zm) + saliente, zm),
        (r_pared(z0 + alto) + 0.2, z0 + alto),
        (r0, z0 + alto),
    ])


def fase(a, largo, z_cinturon_min):
    exterior = lambda z: a - CONO * z
    interior = lambda z: a - PARED - CONO * z
    c = CHAFLAN
    cuerpo = revolver([
        (interior(0) + c, 0),
        (exterior(0) - c, 0),
        (exterior(c), c),
        (exterior(largo), largo),
        (interior(largo), largo),
        (interior(c), c),
    ])
    return cuerpo + cinturon(exterior, z_cinturon_min, largo - z_cinturon_min, 1.8)


def telescopio():
    radios = [RADIO_BASE]
    for k in range(2):
        radios.append(radios[k] - PARED - CONO * LARGOS[k] + CONO * SOLAPE)

    f1 = fase(radios[0], LARGOS[0], LARGOS[0] - 7)
    f1 = f1 + cinturon(lambda z: radios[0] - CONO * z, Z_CINTURON_BASE, 7, 1.8)
    piezas = [f1]
    for k in (1, 2):
        piezas.append(fase(radios[k], LARGOS[k], LARGOS[k - 1] + 1.0))

    a3 = radios[2]
    r_boca = a3 - PARED - CONO * LARGOS[2]
    piezas[2] = piezas[2] + revolver([
        (r_boca - 3.0, LARGOS[2] - 3),
        (r_boca + 0.2, LARGOS[2] - 6),
        (r_boca + 0.2, LARGOS[2]),
        (r_boca - 3.0, LARGOS[2]),
    ])
    holguras = [radios[k] - PARED - radios[k + 1] for k in range(2)]
    return piezas, radios, holguras


def losa_redondeada(ancho, largo, radio, z, alto=0.01):
    esquinas = [
        Manifold.cylinder(alto, radio, radio, 48).translate((sx * (ancho / 2 - radio), sy * (largo / 2 - radio), z))
        for sx in (-1, 1) for sy in (-1, 1)
    ]
    return Manifold.batch_hull(esquinas)


def losa_circular(radio, z, alto=0.01):
    return Manifold.cylinder(alto, radio, radio, SEG).translate((0, 0, z))


def soporte():
    """Fase 4: marco universal + asiento en V + embudo trapecio + boquilla del tubo.

    La pantalla mira hacia el tubo (el ojo está en la punta). El teléfono se apoya por la pantalla
    en el asiento a 45° y su espalda sobresale; las cuerdas cruzan la espalda y lo aprietan.
    Se imprime tal cual: el borde trasero sobre la cama, todo sube sin soportes.
    """
    bw, bl = BOLSILLO_ANCHO, BOLSILLO_LARGO
    r_ext = 8.0
    r_int = r_ext - MURO

    ancho, largo = bw + 2 * MURO, bl + 2 * MURO
    z_asiento = 0.0                             # el asiento en V empieza en el mismo borde trasero
    z0 = z_asiento + LABIO_LADO                 # ventana hacia el embudo
    z1 = z0 + EMBUDO_ALTO
    r_boca = RADIO_BASE + AJUSTE_COLLAR
    r_collar = r_boca + 2.4
    vw, vl = bw - 2 * LABIO_LADO, bl - 2 * LABIO_LADO

    marco = losa_redondeada(ancho, largo, r_ext, 0, z0)
    hueco = Manifold.batch_hull([losa_redondeada(bw, bl, r_int, -0.1, 0.12),
                                 losa_redondeada(vw, vl, 3.0, z0 - 0.01, 0.02)])
    pieza = marco - hueco

    embudo = (Manifold.batch_hull([losa_redondeada(ancho, largo, r_ext, z0), losa_circular(r_collar, z1)])
              - Manifold.batch_hull([losa_redondeada(vw, vl, 3.0, z0 - 0.02), losa_circular(r_boca, z1 + 0.02)]))
    collar = (Manifold.cylinder(COLLAR_ALTO, r_collar, r_collar, SEG)
              - Manifold.cylinder(COLLAR_ALTO + 0.1, r_boca, r_boca, SEG).translate((0, 0, -0.05))).translate((0, 0, z1))
    pieza = pieza + embudo + collar

    hl, ha, hf = BITA_HUECO
    for y in CUERDAS_Y:
        # Bita: hueco en el costado con un poste vertical adentro para amarrar la cuerda.
        hueco_bita = Manifold.cube((hf + 1, hl, ha)).translate((ancho / 2 - hf, y - hl / 2, BITA_Z))
        # Canal exterior desde la bita hasta el borde trasero.
        canal = Manifold.cube((CANAL_HONDO + 1, CANAL_ANCHO, BITA_Z + 0.1)).translate((ancho / 2 - CANAL_HONDO, y - CANAL_ANCHO / 2, -0.1))
        # Muesca en el borde trasero: la cuerda dobla hacia la espalda del teléfono sin resbalarse.
        muesca = Manifold.cube((MURO + 2, CANAL_ANCHO, CANAL_HONDO + 0.1)).translate((bw / 2 - 1, y - CANAL_ANCHO / 2, -0.1))
        quitar = hueco_bita + canal + muesca
        # Túneles a distintas alturas: van del canal exterior hasta el asiento inclinado.
        for z in NIVELES_CUERDA[1:]:
            quitar = quitar + Manifold.cube((MURO + z + TUNEL_ALTO + 3, CANAL_ANCHO, TUNEL_ALTO)).translate(
                (bw / 2 - z - TUNEL_ALTO - 1, y - CANAL_ANCHO / 2, z))
        # Poste: franja de la piel exterior que queda en medio del hueco, unida arriba y abajo.
        poste = Manifold.cube((1.6, BITA_POSTE, ha + 0.2)).translate((ancho / 2 - 1.6, y - BITA_POSTE / 2, BITA_Z - 0.1))
        pieza = pieza - quitar - quitar.mirror((1, 0, 0))
        pieza = pieza + poste + poste.mirror((1, 0, 0))

    # Ranuras de enganche para la tapa: piso plano (traba) y techo en rampa de 45° (sin soportes).
    for ranura in ranuras_enganche(ancho, largo, GANCHO_ALTO, 0.0):
        pieza = pieza - ranura

    internos = {'z_asiento': z_asiento, 'z0': z0, 'x_poste': ancho / 2 - 2.5, 'z_bita': BITA_Z + ha / 2}
    return pieza, (ancho, largo, z1 + COLLAR_ALTO), internos


def cuña(x_cara, largo, hondo, z_piso, z_techo, hacia_x=-1, a_lo_largo='y', centro=0.0):
    """Prisma triangular pegado a una cara: base plana en z_piso y rampa de 45° hasta z_techo."""
    alto_plano = max(0.01, z_techo - z_piso - hondo)
    plano = Manifold.cube((hondo + 0.1, largo, alto_plano)).translate((0, -largo / 2, z_piso))
    filo = Manifold.cube((0.1, largo, z_techo - z_piso)).translate((hondo, -largo / 2, z_piso))
    p = Manifold.batch_hull([plano, filo]).translate((-hondo - 0.05 + 0.1, 0, 0))
    if hacia_x > 0:
        p = p.mirror((1, 0, 0))
    p = p.translate((x_cara, 0, 0))
    if a_lo_largo == 'x':
        p = p.rotate((0, 0, 90))
    return p.translate((0, centro, 0) if a_lo_largo == 'y' else (centro, 0, 0))


def ranuras_enganche(ancho, largo, hondo, extra):
    """Huecos en las caras exteriores del marco (lados largos y extremos)."""
    z_piso, z_techo = ENGANCHE_Z, ENGANCHE_Z + 2.0 + hondo
    res = []
    for y in GANCHOS_Y:
        base = cuña(ancho / 2 + 0.05, GANCHO_LARGO + 1 + extra, hondo, z_piso, z_techo)
        base = base.translate((0, y, 0))
        res += [base, base.mirror((1, 0, 0))]
    extremo = cuña(largo / 2 + 0.05, 20 + 1 + extra, hondo, z_piso, z_techo).rotate((0, 0, 90))
    res += [extremo, extremo.mirror((0, 1, 0))]
    return res


def tapa():
    """Tapa trasera: bandeja con falda que abraza el marco y ganchitos que traban con un clic.

    Coordenadas de armado (z=0 es el borde trasero del marco). Se imprime con la placa sobre la cama:
    basta subirla TAPA_FONDO + TAPA_PLACA.
    """
    ancho, largo = BOLSILLO_ANCHO + 2 * MURO, BOLSILLO_LARGO + 2 * MURO
    r = 8.0 + TAPA_HOLGURA + TAPA_FALDA
    ai, li = ancho + 2 * TAPA_HOLGURA, largo + 2 * TAPA_HOLGURA
    ae, le = ai + 2 * TAPA_FALDA, li + 2 * TAPA_FALDA
    z_bajo = -TAPA_FONDO - TAPA_PLACA
    alto = TAPA_SUBE - z_bajo
    caja = losa_redondeada(ae, le, r, z_bajo, alto)
    hueco = losa_redondeada(ai, li, 8.0 + TAPA_HOLGURA, -TAPA_FONDO, alto + 1)
    pieza = caja - hueco

    # Recortes de la falda donde bajan las cuerdas.
    for y in CUERDAS_Y:
        corte = Manifold.cube((TAPA_FALDA + TAPA_HOLGURA + 2, CANAL_ANCHO + 2, TAPA_SUBE + 3)).translate(
            (ai / 2 - 1, y - CANAL_ANCHO / 2 - 1, -1.5))
        pieza = pieza - corte - corte.mirror((1, 0, 0))

    # Ganchitos: cara plana abajo (traba contra el piso de la ranura), rampa arriba (entra empujando).
    g = GANCHO_ALTO - 0.1
    z_piso, z_techo = ENGANCHE_Z + 0.15, ENGANCHE_Z + 0.15 + 1.6 + g
    for y in GANCHOS_Y:
        gancho = cuña(ai / 2 + 0.05, GANCHO_LARGO, g, z_piso, z_techo).translate((0, y, 0))
        pieza = pieza + gancho + gancho.mirror((1, 0, 0))
    extremo = cuña(li / 2 + 0.05, 20, g, z_piso, z_techo).rotate((0, 0, 90))
    pieza = pieza + extremo + extremo.mirror((0, 1, 0))

    # Ranuras de alivio a los lados de cada ganchito para que la falda flexione.
    for y in GANCHOS_Y:
        for dy in (-GANCHO_LARGO / 2 - 1.5, GANCHO_LARGO / 2 + 0.5):
            alivio = Manifold.cube((TAPA_FALDA + 2, 1.0, 8)).translate((ai / 2 - 0.5, y + dy, TAPA_SUBE - 8 + 0.01))
            pieza = pieza - alivio - alivio.mirror((1, 0, 0))
    for dx in (-10 - 1.5, 10 + 0.5):
        alivio = Manifold.cube((1.0, TAPA_FALDA + 2, 8)).translate((dx, li / 2 - 0.5, TAPA_SUBE - 8 + 0.01))
        pieza = pieza - alivio - alivio.mirror((0, 1, 0))
    return pieza


def frente_telefono(ancho_tel):
    """Altura a la que queda la pantalla: los angostos bajan más en el asiento en V."""
    _, _, i = soporte_cache()
    return i['z_asiento'] + (BOLSILLO_ANCHO - ancho_tel) / 2


def nivel_cuerda(ancho_tel, grosor_tel):
    """Nivel por donde pasar la cuerda: debe quedar detrás de la espalda y sin tapar la pantalla.

    Devuelve la altura del nivel (0 = borde) o None si ninguno sirve.
    """
    frente = frente_telefono(ancho_tel)
    espalda = frente - grosor_tel
    if espalda < -0.5:
        return 0.0
    for z in NIVELES_CUERDA[1:]:
        if espalda < z - 0.3 and z + TUNEL_ALTO < frente - 0.3:
            return z
    return None


_CACHE = {}


def soporte_cache():
    if 'sop' not in _CACHE:
        _CACHE['sop'] = soporte()
    return _CACHE['sop']


def guardar_stl(manifold, nombre):
    m = manifold.to_mesh()
    v = np.asarray(m.vert_properties)[:, :3].astype(np.float32)
    t = np.asarray(m.tri_verts)
    tri = v[t]
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    ruta = os.path.join(SALIDA, nombre)
    with open(ruta, 'wb') as f:
        f.write(b'Galileo Telescopio'.ljust(80, b' '))
        f.write(struct.pack('<I', len(t)))
        datos = np.zeros(len(t), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('a', '<u2')])
        datos['n'] = n
        datos['v'] = tri
        f.write(datos.tobytes())
    return ruta, len(t)


def info(manifold):
    b = manifold.bounding_box()
    return f'{b[3] - b[0]:.1f} x {b[4] - b[1]:.1f} x {b[5] - b[2]:.1f} mm, volumen {manifold.volume() / 1000:.1f} cm3'


if __name__ == '__main__':
    fases, radios, holguras = telescopio()
    for i, (a, b) in enumerate(zip(fases, fases[1:])):
        print(f'Choque entre fase {i + 1} y {i + 2}: {(a ^ b).volume():.4f} mm3')
    tele = Manifold.batch_boolean(fases, OpType.Add)
    _, n1 = guardar_stl(tele, '1_telescopio_3_fases_imprimir_junto.stl')
    print('Telescopio:', info(tele), f'| {n1} triangulos')
    print('Holgura entre fases:', [round(h, 2) for h in holguras])

    for viejo in ('2_soporte_honor_magic5lite.stl', '2_fase4_embudo_telefono_magic5lite.stl', '3_cinchos_x2.stl'):
        if os.path.exists(os.path.join(SALIDA, viejo)):
            os.remove(os.path.join(SALIDA, viejo))

    sop, dims, internos = soporte_cache()
    _, n2 = guardar_stl(sop, '2_fase4_embudo_universal.stl')
    print('Fase 4 embudo:', info(sop), f'| {n2} triangulos')

    tp = tapa()
    b = tp.bounding_box()
    tp_imp = tp.translate((0, 0, -b[2]))
    _, n3 = guardar_stl(tp_imp, '3_tapa_trasera_a_presion.stl')
    print('Tapa:', info(tp_imp), f'| {n3} triangulos')
    print('Choque tapa-embudo (debe ser 0):', round((tp ^ sop).volume(), 4), 'mm3')

    # Comprobaciones por teléfono: cabe, se apoya, la cuerda lo aprieta y la tapa cierra.
    for nombre, (al, an, gr) in TELEFONOS.items():
        espalda = frente_telefono(an) - gr
        cabe = al <= BOLSILLO_LARGO and an <= BOLSILLO_ANCHO
        asiento = an > BOLSILLO_ANCHO - 2 * LABIO_LADO
        nivel = nivel_cuerda(an, gr)
        texto = 'ninguno' if nivel is None else ('borde' if nivel == 0 else f'túnel a {nivel:g} mm')
        print(f'  {nombre}: cabe={cabe} se_apoya={asiento} cuerda_por={texto} '
              f'tapa_cierra={-espalda < TAPA_FONDO - 0.5}')
