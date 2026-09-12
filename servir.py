#!/usr/bin/env python3
"""
Servidor de desarrollo de NiJu.

Igual que `python3 -m http.server`, pero le dice al navegador que NO guarde
nada en cache. Sin esto, al editar un archivo el navegador sigue mostrando la
versión vieja y uno se vuelve loco buscando un error que ya arregló.
"""
import http.server, socketserver, sys, webbrowser, threading, os, re, io, pathlib

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

RAIZ = pathlib.Path(__file__).parent

def version():
    """Sello que cambia cada vez que tocás un archivo."""
    t = 0
    for base, _, files in os.walk(RAIZ):
        if '/.' in base: continue
        for f in files:
            if f.endswith(('.js', '.css')):
                t = max(t, os.path.getmtime(os.path.join(base, f)))
    return str(int(t))

RX_IMPORT = re.compile(rb"""(from\s*|import\s*\(\s*)(['"])(\.[^'"]+?\.js)(['"])""")
RX_ASSET  = re.compile(rb"""(href|src)=(["'])(\.[^"']+?\.(?:css|js))(?:\?v=[^"']*)?(["'])""")

class SinCache(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        """A los .js y al index les pega el sello de versión en cada import,
        para que el navegador nunca sirva una versión vieja."""
        ruta = self.translate_path(self.path.split('?')[0])
        if os.path.isfile(ruta) and ruta.endswith(('.js', '.html')):
            v = version().encode()
            datos = open(ruta, 'rb').read()
            if ruta.endswith('.js'):
                datos = RX_IMPORT.sub(rb"\1\2\3?v=" + v + rb"\4", datos)
            else:
                datos = RX_ASSET.sub(rb"\1=\2\3?v=" + v + rb"\4", datos)
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript; charset=utf-8' if ruta.endswith('.js') else 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(datos)))
            self.end_headers()
            return io.BytesIO(datos)
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, formato, *args):
        if '404' in str(args):           # solo mostramos lo que falla
            super().log_message(formato, *args)

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PUERTO), SinCache) as srv:
    print(f'NiJu andando en http://localhost:{PUERTO}   (Ctrl+C para cortar)')
    threading.Timer(1.0, lambda: webbrowser.open(f'http://localhost:{PUERTO}')).start()
    srv.serve_forever()
