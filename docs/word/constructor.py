# -*- coding: utf-8 -*-
"""
Constructor de documentos Word sin dependencias.
Un .docx es un ZIP con XML adentro: acá se arma a mano para no depender
de node, pandoc ni LibreOffice, que en esta máquina no están.
"""
import zipfile, os
from xml.sax.saxutils import escape

# --- Paleta NiJu ---
AMARILLO = "FFE600"; AZUL = "3483FA"; VERDE = "00A650"; ROJO = "F23D4F"
NARANJA  = "FF7733"; TINTA = "2B2B33"; GRIS = "F1F3F6"; GRIS2 = "E4E8EE"
GRIS_TX  = "6B7280"; VIOLETA = "7C3AED"

A4_W, A4_H = 11906, 16838
MARGEN = 1134                      # 2 cm
ANCHO  = A4_W - 2 * MARGEN         # 9638

def _rpr(b=False, i=False, sz=22, color=TINTA, font="Calibri", caps=False, u=False, space=None):
    p = ['<w:rPr>', f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>']
    if b: p.append('<w:b/>')
    if i: p.append('<w:i/>')
    if u: p.append('<w:u w:val="single"/>')
    if caps: p.append('<w:caps/>')
    if space is not None: p.append(f'<w:spacing w:val="{space}"/>')
    p.append(f'<w:color w:val="{color}"/>')
    p.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    p.append('</w:rPr>')
    return "".join(p)

def run(texto, **kw):
    return f'<w:r>{_rpr(**kw)}<w:t xml:space="preserve">{escape(str(texto))}</w:t></w:r>'

def salto():
    return '<w:r><w:br/></w:r>'

def parrafo(contenido, antes=0, despues=120, jc="left", shd=None, borde=None,
            sangria=0, interlineado=276, borde_abajo=None):
    ppr = ['<w:pPr>']
    if sangria: ppr.append(f'<w:ind w:left="{sangria}"/>')
    if shd: ppr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    bordes = []
    if borde:  bordes.append(f'<w:left w:val="single" w:sz="24" w:space="8" w:color="{borde}"/>')
    if borde_abajo: bordes.append(f'<w:bottom w:val="single" w:sz="8" w:space="4" w:color="{borde_abajo}"/>')
    if bordes: ppr.append('<w:pBdr>' + "".join(bordes) + '</w:pBdr>')
    ppr.append(f'<w:spacing w:before="{antes}" w:after="{despues}" w:line="{interlineado}" w:lineRule="auto"/>')
    ppr.append(f'<w:jc w:val="{jc}"/>')
    ppr.append('</w:pPr>')
    return '<w:p>' + "".join(ppr) + (contenido or '') + '</w:p>'

def titulo(texto, nivel=1):
    tam = {0: 72, 1: 34, 2: 26, 3: 22}[nivel]
    col = {0: TINTA, 1: TINTA, 2: TINTA, 3: GRIS_TX}[nivel]
    antes = {0: 0, 1: 360, 2: 280, 3: 200}[nivel]
    return parrafo(run(texto, b=True, sz=tam, color=col, font="Calibri Light" if nivel <= 1 else "Calibri"),
                   antes=antes, despues=140)

def celda(contenido, ancho, shd=None, valign="center", margen=110, borde_izq=None):
    tcpr = [f'<w:tcW w:w="{ancho}" w:type="dxa"/>']
    if shd: tcpr.append(f'<w:shd w:val="clear" w:color="auto" w:fill="{shd}"/>')
    if borde_izq:
        tcpr.append(f'<w:tcBorders><w:left w:val="single" w:sz="24" w:space="0" w:color="{borde_izq}"/></w:tcBorders>')
    tcpr.append(f'<w:tcMar><w:top w:w="{margen}" w:type="dxa"/><w:left w:w="{margen+40}" w:type="dxa"/>'
                f'<w:bottom w:w="{margen}" w:type="dxa"/><w:right w:w="{margen+40}" w:type="dxa"/></w:tcMar>')
    tcpr.append(f'<w:vAlign w:val="{valign}"/>')
    return f'<w:tc><w:tcPr>{"".join(tcpr)}</w:tcPr>{contenido}</w:tc>'

def tabla(filas, anchos, bordes=True, color_borde=GRIS2):
    if bordes:
        b = "".join(f'<w:{x} w:val="single" w:sz="4" w:space="0" w:color="{color_borde}"/>'
                    for x in ["top","left","bottom","right","insideH","insideV"])
    else:
        b = "".join(f'<w:{x} w:val="none" w:sz="0" w:space="0" w:color="auto"/>'
                    for x in ["top","left","bottom","right","insideH","insideV"])
    grid = "".join(f'<w:gridCol w:w="{a}"/>' for a in anchos)
    return (f'<w:tbl><w:tblPr><w:tblW w:w="{sum(anchos)}" w:type="dxa"/>'
            f'<w:tblBorders>{b}</w:tblBorders>'
            f'<w:tblLayout w:type="fixed"/></w:tblPr>'
            f'<w:tblGrid>{grid}</w:tblGrid>' + "".join(filas) + '</w:tbl>')

def fila(celdas, alto=None):
    trpr = f'<w:trPr><w:trHeight w:val="{alto}"/></w:trPr>' if alto else ''
    return f'<w:tr>{trpr}{"".join(celdas)}</w:tr>'

def espacio(alto=120):
    return parrafo('', despues=alto)

def salto_pagina():
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
