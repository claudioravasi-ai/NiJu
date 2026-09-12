# -*- coding: utf-8 -*-
"""Piezas visuales del documento: barras, fichas, comparaciones."""
from constructor import *

def bloque_numerado(n, titulo_txt, color=AZUL):
    """Número grande en un cuadro de color + título al lado."""
    return tabla([fila([
        celda(parrafo(run(str(n), b=True, sz=40, color="FFFFFF"), despues=0, jc="center"),
              800, shd=color, margen=90),
        celda(parrafo(run(titulo_txt, b=True, sz=28, color=TINTA), despues=0), ANCHO-800, margen=110)
    ], alto=620)], [800, ANCHO-800], bordes=False)

def recuadro(texto, titulo_txt=None, color=AZUL, fondo=GRIS):
    """Caja con barra de color a la izquierda, para ejemplos y advertencias."""
    contenido = []
    if titulo_txt:
        contenido.append(parrafo(run(titulo_txt.upper(), b=True, sz=17, color=color, space=30),
                                 despues=70))
    for t in (texto if isinstance(texto, list) else [texto]):
        contenido.append(parrafo(run(t, sz=21, color=TINTA), despues=60))
    return tabla([fila([celda("".join(contenido), ANCHO, shd=fondo, margen=160, borde_izq=color)])],
                 [ANCHO], bordes=False)

def _celda_span(contenido, ancho, span, shd=None, margen=60, jc=None):
    tcpr = [f'<w:tcW w:w="{ancho}" w:type="dxa"/>']
    if span > 1: tcpr.append(f'<w:gridSpan w:val="{span}"/>')
    if shd: tcpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    tcpr.append(f'<w:tcMar><w:top w:w="{margen}" w:type="dxa"/><w:left w:w="{margen+40}" w:type="dxa"/>'
                f'<w:bottom w:w="{margen}" w:type="dxa"/><w:right w:w="{margen+40}" w:type="dxa"/></w:tcMar>')
    tcpr.append('<w:vAlign w:val="center"/>')
    return f'<w:tc><w:tcPr>{"".join(tcpr)}</w:tcPr>{contenido}</w:tc>'

# La zona de la barra se divide en 20 columnitas: así Word respeta
# exactamente la proporción, sin importar cómo ajuste la tabla.
TRAMOS = 20
A_ETQ, A_TRAMO, A_VAL = 2700, 250, 1938

def barra(etiqueta, valor_txt, proporcion, color=AZUL, nota=None, destacar=False):
    lleno = max(1, min(TRAMOS, round(proporcion * TRAMOS)))
    vacio = TRAMOS - lleno
    etq = parrafo(run(etiqueta, b=destacar, sz=20, color=TINTA), despues=0)
    if nota:
        etq += parrafo(run(nota, sz=16, color=GRIS_TX), despues=0)
    celdas = [_celda_span(etq, A_ETQ, 1),
              _celda_span(parrafo('', despues=0), A_TRAMO*lleno, lleno, shd=color, margen=30)]
    if vacio:
        celdas.append(_celda_span(parrafo('', despues=0), A_TRAMO*vacio, vacio, shd="F1F3F6", margen=30))
    celdas.append(_celda_span(parrafo(run(valor_txt, b=True, sz=20,
                                          color=color if destacar else TINTA), despues=0, jc="right"),
                              A_VAL, 1))
    return fila(celdas, alto=380)

def grafico_barras(datos, titulo_txt=None, color=AZUL, color_destacado=VERDE):
    """datos = [(etiqueta, valor_num, texto_valor, nota, destacar), ...]"""
    maximo = max(d[1] for d in datos) or 1
    filas = []
    if titulo_txt:
        filas.append(fila([_celda_span(
            parrafo(run(titulo_txt.upper(), b=True, sz=17, color=GRIS_TX, space=30), despues=0),
            ANCHO, TRAMOS + 2, margen=40)]))
    for etq, val, txt, nota, dest in datos:
        filas.append(barra(etq, txt, val / maximo, color_destacado if dest else color, nota, dest))
    anchos = [A_ETQ] + [A_TRAMO] * TRAMOS + [A_VAL]
    return tabla(filas, anchos, bordes=False)

def tabla_datos(encabezados, filas_datos, anchos, resaltar=None):
    """Tabla con encabezado oscuro y filas alternadas."""
    fs = [fila([celda(parrafo(run(h, b=True, sz=18, color="FFFFFF", space=20), despues=0), a, shd=TINTA)
                for h, a in zip(encabezados, anchos)], alto=440)]
    for i, f in enumerate(filas_datos):
        es = (resaltar is not None and i == resaltar)
        fondo = "E8F7EF" if es else ("FFFFFF" if i % 2 == 0 else GRIS)
        fs.append(fila([celda(parrafo(run(c, b=(es or j == 0), sz=19,
                                          color=VERDE if (es and j == len(f)-1) else TINTA), despues=0), a, shd=fondo)
                        for j, (c, a) in enumerate(zip(f, anchos))], alto=380))
    return tabla(fs, anchos)

def escalera(pasos, color=AZUL):
    """Una secuencia de pasos numerados, en columnas."""
    n = len(pasos)
    a = ANCHO // n
    celdas = []
    for i, (t, d) in enumerate(pasos):
        cont = (parrafo(run(str(i+1), b=True, sz=30, color=color), despues=40) +
                parrafo(run(t, b=True, sz=19, color=TINTA), despues=40) +
                parrafo(run(d, sz=17, color=GRIS_TX), despues=0))
        celdas.append(celda(cont, a, shd=GRIS, margen=140))
    return tabla([fila(celdas)], [a]*n, bordes=False)

def fichas(items, columnas=3):
    """Cuadrícula de fichas cortas."""
    a = ANCHO // columnas
    filas_out = []
    for i in range(0, len(items), columnas):
        grupo = items[i:i+columnas]
        celdas = []
        for t, d, col in grupo:
            cont = (parrafo(run(t, b=True, sz=20, color=col), despues=50) +
                    parrafo(run(d, sz=17, color=GRIS_TX), despues=0))
            celdas.append(celda(cont, a, shd="FFFFFF", margen=130, borde_izq=col))
        while len(celdas) < columnas:
            celdas.append(celda(parrafo('', despues=0), a))
        filas_out.append(fila(celdas))
    return tabla(filas_out, [a]*columnas, bordes=False)
