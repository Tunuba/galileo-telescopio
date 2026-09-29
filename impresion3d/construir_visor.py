"""Crea visor.html: un solo archivo con el modelo 3D, abre con doble clic y sin internet."""
import base64
import json
import os
import re
import sys

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '.lib'))
import generar as G  # noqa: E402
from manifold3d import OpType  # noqa: E402

NOMBRES = ['WebGLRenderer', 'ACESFilmicToneMapping', 'Scene', 'Color', 'PerspectiveCamera', 'HemisphereLight',
           'DirectionalLight', 'Group', 'MeshStandardMaterial', 'BufferGeometry', 'BufferAttribute', 'Mesh',
           'Shape', 'ExtrudeGeometry', 'CanvasTexture', 'SRGBColorSpace', 'PlaneGeometry', 'MeshBasicMaterial',
           'GridHelper', 'Vector3', 'Box3', 'EdgesGeometry', 'LineSegments', 'LineBasicMaterial', 'Plane',
           'DoubleSide', 'AdditiveBlending', 'CatmullRomCurve3', 'TubeGeometry']


def normales_con_pliegue(v, t, angulo=35):
    tri = v[t]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    fu = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
    caras = np.repeat(np.arange(len(t)), 3)
    verts = t.reshape(-1)
    orden = np.argsort(verts, kind='stable')
    vs, cs = verts[orden], caras[orden]
    ini = np.searchsorted(vs, np.arange(len(v)))
    fin = np.searchsorted(vs, np.arange(len(v)), 'right')
    umbral = np.cos(np.radians(angulo))
    salida = np.empty((len(t), 3, 3), dtype=np.float32)
    for f in range(len(t)):
        for c in range(3):
            vec = cs[ini[t[f, c]]:fin[t[f, c]]]
            ok = fu[vec] @ fu[f] > umbral
            s = fn[vec][ok].sum(0)
            salida[f, c] = s / max(np.linalg.norm(s), 1e-12)
    return tri.astype(np.float32), salida


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.float32).tobytes()).decode()


def empaquetar(man, material):
    m = man.to_mesh()
    v = np.asarray(m.vert_properties)[:, :3].astype(np.float64)
    t = np.asarray(m.tri_verts).astype(np.int64)
    pos, nor = normales_con_pliegue(v, t)
    return {'material': material, 'pos': b64(pos), 'nor': b64(nor)}


def three_como_objeto():
    codigo = open(os.path.join(AQUI, '..', 'public', 'vendor', 'three.module.min.js'), encoding='utf-8').read()
    m = list(re.finditer(r'export\s*\{([^}]*)\}\s*;?', codigo))[-1]
    pares = []
    for parte in m.group(1).split(','):
        parte = parte.strip()
        if parte:
            local, _, publico = parte.partition(' as ')
            pares.append(f'{(publico or local).strip()}:{local.strip()}')
    codigo = 'const THREE=(()=>{' + codigo[:m.start()] + 'return{' + ','.join(pares) + '};' + codigo[m.end():] + '})();'
    return codigo.replace('</script', '<\\/script') + '\nconst {' + ','.join(NOMBRES) + '} = THREE;\n'


def main():
    fases, radios, holguras = G.telescopio()
    sop, (ancho, largo, alto_total), internos = G.soporte_cache()

    # Armado: la boquilla recibe la fase 1 hasta su cinturón; el embudo queda debajo del tubo.
    bajar = G.Z_CINTURON_BASE - alto_total
    montado = sop.translate((0, 0, bajar))

    cuerdas = {
        'x_poste': internos['x_poste'], 'z_bita': bajar + internos['z_bita'],
        'x_fuera': ancho / 2 - G.CANAL_HONDO / 2, 'x_dentro': G.BOLSILLO_ANCHO / 2,
        'z_borde': bajar - 0.6, 'ys': list(G.CUERDAS_Y),
    }
    tapa = G.tapa()
    tapa_armada = tapa.translate((0, 0, bajar))

    telefonos = []
    for nombre, (al, an, gr) in G.TELEFONOS.items():
        nivel = G.nivel_cuerda(an, gr)
        telefonos.append({'nombre': nombre, 'alto': al, 'ancho': an, 'grosor': gr,
                          'frente': bajar + G.frente_telefono(an),
                          'nivel': None if nivel in (None, 0.0) else bajar + nivel + G.TUNEL_ALTO / 2})

    # Cama de 256 mm: embudo y tubo en una columna, tapa al lado.
    tubo_imp = G.Manifold.batch_boolean(fases, OpType.Add).translate((-52, 95, 0))
    sop_imp = sop.translate((-52, -30, 0))
    bt_ = tapa.bounding_box()
    tapa_imp = tapa.translate((60, 0, -bt_[2]))

    extension = [0.0, G.LARGOS[0] - G.SOLAPE, G.LARGOS[0] - G.SOLAPE + G.LARGOS[1] - G.SOLAPE]
    extendido = G.LARGOS[0] + (G.LARGOS[1] - G.SOLAPE) + (G.LARGOS[2] - G.SOLAPE)
    bt, bs, bp = tubo_imp.bounding_box(), sop.bounding_box(), tapa.bounding_box()
    datos = {
        'fases': [empaquetar(f, m) for f, m in zip(fases, ['cuero', 'laton', 'cuero'])],
        'soporte_armado': empaquetar(montado, 'oscuro'),
        'cuerdas': cuerdas,
        'tapa_armada': empaquetar(tapa_armada, 'tapa'),
        'telescopio_impresion': empaquetar(tubo_imp, 'cuero'),
        'soporte_impresion': empaquetar(sop_imp, 'oscuro'),
        'tapa_impresion': empaquetar(tapa_imp, 'tapa'),
        'telefonos': telefonos,
        'extension': extension,
        'cama': {'x': 0.0, 'y': 0.0},
        'info': {
            'cerrado': round(max(G.LARGOS)),
            'extendido': round(extendido),
            'diametro': round(2 * G.RADIO_BASE),
            'holgura': round(min(holguras), 2),
            'bolsillo': f'{G.BOLSILLO_LARGO:g} × {G.BOLSILLO_ANCHO:g} mm',
            'tam_tubo': f'{bt[3] - bt[0]:.0f} × {bt[4] - bt[1]:.0f} × {bt[5] - bt[2]:.0f} mm',
            'tam_soporte': f'{bs[3] - bs[0]:.0f} × {bs[4] - bs[1]:.0f} × {bs[5] - bs[2]:.0f} mm',
            'tam_tapa': f'{bp[3] - bp[0]:.0f} × {bp[4] - bp[1]:.0f} × {bp[5] - bp[2]:.0f} mm',
        },
    }

    html = open(os.path.join(AQUI, 'visor_plantilla.html'), encoding='utf-8').read()
    html = html.replace('__THREE__', three_como_objeto()).replace('__DATOS__', json.dumps(datos))
    salida = os.path.join(AQUI, 'visor.html')
    open(salida, 'w', encoding='utf-8').write(html)
    print(salida, f'{os.path.getsize(salida) / 1e6:.1f} MB')


if __name__ == '__main__':
    main()
