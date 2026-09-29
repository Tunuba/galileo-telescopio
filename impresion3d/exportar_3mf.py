"""Arma un .3mf para Bambu Studio con cada pieza como objeto separado, acomodado en la cama de la A2L."""
import os
import sys
import zipfile

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(AQUI, '.lib'))
import generar as G  # noqa: E402

CAMA = (330.0, 320.0)  # Bambu Lab A2L


def malla_xml(man, id_obj, nombre, dx=0.0, dy=0.0):
    m = man.translate((dx, dy, 0)).to_mesh()
    v = np.asarray(m.vert_properties)[:, :3]
    t = np.asarray(m.tri_verts)
    verts = '\n'.join(f'<vertex x="{a:.4f}" y="{b:.4f}" z="{c:.4f}"/>' for a, b, c in v)
    tris = '\n'.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a, b, c in t)
    return (f'<object id="{id_obj}" name="{nombre}" type="model"><mesh><vertices>\n{verts}\n</vertices>'
            f'<triangles>\n{tris}\n</triangles></mesh></object>')


def a_la_cama(man, cx, cy):
    b = man.bounding_box()
    return man.translate((cx - (b[0] + b[3]) / 2, cy - (b[1] + b[4]) / 2, -b[2]))


def main():
    fases, _, _ = G.telescopio()
    sop, _, _ = G.soporte_cache()
    tapa = G.tapa()

    # Distribución en la placa de 330 x 320: embudo a la izquierda, tapa al centro, tubo a la derecha.
    tubo_centro = (285.0, 160.0)
    b = G.Manifold.batch_boolean(fases, G.OpType.Add).bounding_box()
    dx, dy = tubo_centro[0] - (b[0] + b[3]) / 2, tubo_centro[1] - (b[1] + b[4]) / 2
    embudo = a_la_cama(sop, 60.0, 160.0)
    tapa_c = a_la_cama(tapa, 170.0, 160.0)

    objetos = [
        malla_xml(fases[0], 1, 'Fase 1 (tubo grande)', dx, dy),
        malla_xml(fases[1], 2, 'Fase 2 (tubo medio)', dx, dy),
        malla_xml(fases[2], 3, 'Fase 3 (tubo punta)', dx, dy),
        ('<object id="4" name="Tubo telescopico - 3 fases impresas encajadas" type="model"><components>'
         '<component objectid="1"/><component objectid="2"/><component objectid="3"/></components></object>'),
        malla_xml(embudo, 5, 'Fase 4 - embudo del telefono'),
        malla_xml(tapa_c, 6, 'Tapa trasera a presion'),
    ]
    modelo = ('<?xml version="1.0" encoding="UTF-8"?>\n'
              '<model unit="millimeter" xml:lang="es-ES" '
              'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n'
              '<metadata name="Title">Telescopio de Galileo</metadata>\n'
              '<resources>\n' + '\n'.join(objetos) + '\n</resources>\n'
              '<build><item objectid="4"/><item objectid="5"/><item objectid="6"/></build>\n</model>\n')
    tipos = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
             '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" '
            'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')

    salida = os.path.join(AQUI, 'telescopio_galileo_A2L.3mf')
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', tipos)
        z.writestr('_rels/.rels', rels)
        z.writestr('3D/3dmodel.model', modelo)
    print(salida, f'{os.path.getsize(salida) / 1e6:.1f} MB')

    carpeta = os.path.join(AQUI, 'PARA_IMPRIMIR')
    os.makedirs(carpeta, exist_ok=True)
    tubo_c = G.Manifold.batch_boolean(fases, G.OpType.Add).translate((dx, dy, 0))
    juntas = G.Manifold.batch_boolean([tubo_c, embudo, tapa_c], G.OpType.Add)
    G.guardar_stl(juntas, os.path.join(carpeta, 'Telescopio_Galileo_3_piezas_juntas.stl'))

    for nombre, m in [('tubo', tubo_c), ('embudo', embudo), ('tapa', tapa_c)]:
        bb = m.bounding_box()
        dentro = bb[0] >= 0 and bb[1] >= 0 and bb[3] <= CAMA[0] and bb[4] <= CAMA[1]
        print(f'  {nombre}: x {bb[0]:.0f}-{bb[3]:.0f}  y {bb[1]:.0f}-{bb[4]:.0f}  alto {bb[5]:.0f} mm  dentro_de_la_cama={dentro}')


if __name__ == '__main__':
    main()
