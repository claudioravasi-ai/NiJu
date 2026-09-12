# -*- coding: utf-8 -*-
import zipfile, os
from constructor import A4_W, A4_H, MARGEN
import contenido

CUERPO = "".join(contenido.D)

DOC = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>{CUERPO}
<w:sectPr>
<w:pgSz w:w="{A4_W}" w:h="{A4_H}"/>
<w:pgMar w:top="{MARGEN}" w:right="{MARGEN}" w:bottom="{MARGEN}" w:left="{MARGEN}" w:header="708" w:footer="708" w:gutter="0"/>
</w:sectPr>
</w:body></w:document>'''

CT = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''

RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''

DOC_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
<w:color w:val="2B2B33"/><w:sz w:val="22"/><w:szCs w:val="22"/>
<w:lang w:val="es-AR"/>
</w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
<w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>'''

CORE = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>NiJu - Que hace la aplicacion</dc:title>
<dc:subject>Guia explicada punto por punto</dc:subject>
<dc:creator>NiJu</dc:creator>
<cp:lastModifiedBy>NiJu</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-09-12T12:00:00Z</dcterms:created>
</cp:coreProperties>'''

APP = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>NiJu</Application><Company>NiJu</Company>
</Properties>'''

salida = "NiJu - Que hace la app.docx"
if os.path.exists(salida): os.remove(salida)
with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("[Content_Types].xml", CT)
    z.writestr("_rels/.rels", RELS)
    z.writestr("word/document.xml", DOC)
    z.writestr("word/_rels/document.xml.rels", DOC_RELS)
    z.writestr("word/styles.xml", STYLES)
    z.writestr("docProps/core.xml", CORE)
    z.writestr("docProps/app.xml", APP)

print(f"{salida} — {os.path.getsize(salida)/1024:.0f} KB")

# Verificación: el XML tiene que ser válido
import xml.dom.minidom
xml.dom.minidom.parseString(DOC)
print("XML del documento: válido")
with zipfile.ZipFile(salida) as z:
    print("Archivos en el .docx:", len(z.namelist()))
    mal = z.testzip()
    print("ZIP:", "íntegro" if mal is None else f"dañado en {mal}")
