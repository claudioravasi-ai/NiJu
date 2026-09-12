/* ============================================================
   NiJu — Backend (Cloudflare Worker)
   ------------------------------------------------------------
   Un solo archivo. Se pega en el panel de Cloudflare Workers y
   queda andando: NO hace falta tener node instalado.

   Qué resuelve:
     · Llama a las APIs de cada tienda (el navegador no puede: CORS).
     · Guarda las claves donde no las ve nadie.
     · Normaliza todo al contrato `Oferta` de la PWA.
     · Cachea para no reventar los límites de cada API.

   Endpoints:
     GET /v1/buscar?tienda=ebay&q=iphone&rubro=celulares&limite=24
     GET /v1/resolver?url=https://...   ← trae CUALQUIER producto por su link
     GET /v1/salud/:tienda
     GET /v1/tiendas
     GET  /v1/campanias            ← compra grupal y preventa, compartidas
     POST /v1/campanias            ← crear
     POST /v1/campanias/:id/reservar
     GET  /v1/demanda              ← bolsa de demanda
     POST /v1/demanda              ← publicar una demanda
     POST /v1/demanda/:id/ofertar  ← un proveedor se ofrece a llenarla

   Variables de entorno (Settings → Variables, como "Secret"):
     EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
     BESTBUY_KEY
     MELI_TOKEN            (token OAuth de app registrada)
     ALI_APP_KEY, ALI_APP_SECRET, ALI_TRACKING_ID
     ORIGENES              (dominios permitidos, separados por coma)
     ADMIN_TOKEN           (clave del dueño: sin esto nadie crea campañas)
   ============================================================ */

const TTL = 600;                    // 10 minutos de cache por consulta
const TIMEOUT = 8000;

export default {
  async fetch(req, env, ctx){
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { headers:{ ...cors, 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' } });
    if (url.pathname.startsWith('/v1/campanias')) return campanias(req, url, env, cors);
    if (url.pathname.startsWith('/v1/demanda'))   return demanda(req, url, env, cors);

    try{
      if (url.pathname === '/v1/tiendas')  return json({ tiendas:Object.keys(ADAPTADORES) }, cors);
      if (url.pathname.startsWith('/v1/salud/')) return salud(url.pathname.split('/').pop(), env, cors);
      if (url.pathname === '/v1/buscar')   return buscar(url, env, ctx, cors);
      if (url.pathname === '/v1/resolver') return resolver(url, env, ctx, cors);
      return json({ error:'ruta desconocida' }, cors, 404);
    }catch(e){
      return json({ error:String(e.message || e) }, cors, 500);
    }
  }
};

/* ------------------------------------------------------------------ */

function corsHeaders(req, env){
  const permitidos = (env.ORIGENES || '*').split(',').map(s => s.trim());
  const origen = req.headers.get('Origin') || '';
  const ok = permitidos.includes('*') || permitidos.includes(origen);
  return {
    'Access-Control-Allow-Origin': ok ? (origen || '*') : 'null',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'accept,content-type,x-niju-admin',
    'Cache-Control': `public, max-age=${TTL}`
  };
}

const json = (d, headers = {}, status = 200) =>
  new Response(JSON.stringify(d), { status, headers:{ ...headers, 'content-type':'application/json; charset=utf-8' } });

async function pedir(url, opts = {}){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try{
    const r = await fetch(url, { ...opts, signal:ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function buscar(url, env, ctx, cors){
  const tienda = url.searchParams.get('tienda');
  const q      = (url.searchParams.get('q') || '').trim();
  const rubro  = url.searchParams.get('rubro') || '';
  const limite = Math.min(50, +(url.searchParams.get('limite') || 24));
  const desde  = Math.max(0, +(url.searchParams.get('desde') || 0));

  const adaptador = ADAPTADORES[tienda];
  if (!adaptador) return json({ error:`tienda desconocida: ${tienda}`, ofertas:[] }, cors, 400);

  // Cache por consulta exacta
  const clave = new Request(`https://cache.niju/${tienda}?q=${encodeURIComponent(q)}&r=${rubro}&l=${limite}&d=${desde}`);
  const cache = caches.default;
  const hit = await cache.match(clave);
  if (hit) return hit;

  let ofertas = [];
  let error = null;
  let descartadas = 0;
  try{
    const crudas = await adaptador.buscar({ q, rubro, limite, desde, env });
    if (q){
      ofertas = crudas.filter(o => tieneQueVer(q, o.titulo, o.marca));
      descartadas = crudas.length - ofertas.length;
    } else {
      ofertas = crudas;
    }
  }catch(e){ error = String(e.message || e); }

  const res = json({ tienda, consulta:q, desde, total:ofertas.length, descartadas,
                     hayMas: ofertas.length >= limite * 0.6, error, ofertas }, cors);
  if (!error) ctx.waitUntil(cache.put(clave, res.clone()));
  return res;
}

/* ============================================================
   CAMPAÑAS — compra grupal y preventa
   Tienen que vivir en el servidor: si las reservas quedan en el
   navegador de cada uno, nadie ve lo que reservó el otro y la
   compra grupal no existe.
   Guardadas en Cloudflare KV (ver DESPLIEGUE.md para crearlo).
   ============================================================ */
/* Solo el dueño. La clave viaja en una cabecera y la valida el
   servidor: esconder botones en el navegador no protege nada. */
function esDueno(req, env){
  if (!env.ADMIN_TOKEN) return true;      // sin clave configurada, todo abierto (modo prueba)
  return req.headers.get('x-niju-admin') === env.ADMIN_TOKEN;
}

async function campanias(req, url, env, cors){
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU', campanias:[] }, cors, 501);
  const partes = url.pathname.split('/').filter(Boolean);   // v1, campanias, [id], [accion]
  const id = partes[2], accion = partes[3];

  const leer  = async () => JSON.parse(await env.NIJU.get('campanias') || '[]');
  const grabar = async (cs) => env.NIJU.put('campanias', JSON.stringify(cs));

  if (req.method === 'GET'){
    const cs = await leer();
    return json({ campanias: id ? cs.filter(c => c.id === id) : cs }, cors);
  }

  if (req.method === 'POST'){
    const cuerpo = await req.json().catch(() => ({}));
    const cs = await leer();

    if (accion === 'reservar'){
      const i = cs.findIndex(c => c.id === id);
      if (i < 0) return json({ error:'campaña inexistente' }, cors, 404);
      const nombre = String(cuerpo.nombre || '').slice(0, 80).trim();
      const cantidad = Math.max(1, Math.min(999, parseInt(cuerpo.cantidad) || 1));
      if (!nombre) return json({ error:'falta el nombre' }, cors, 400);
      cs[i].reservas = cs[i].reservas || [];
      cs[i].reservas.push({
        id: crypto.randomUUID().slice(0, 8), nombre,
        email: String(cuerpo.email || '').slice(0, 120),
        cantidad, precioAlReservar: cuerpo.precioAlReservar || null,
        sena: cuerpo.sena || 0, ts: Date.now()
      });
      await grabar(cs);
      return json({ ok:true, campania: cs[i] }, cors);
    }

    // crear una campaña es cosa del dueño
    if (!esDueno(req, env)) return json({ error:'no autorizado' }, cors, 403);
    const c = {
      ...cuerpo,
      id: cuerpo.id || 'cg-' + crypto.randomUUID().slice(0, 8),
      creada: Date.now(), reservas: [], estado:'abierta'
    };
    cs.push(c);
    await grabar(cs);
    return json({ ok:true, campania:c }, cors);
  }

  return json({ error:'método no permitido' }, cors, 405);
}

/* ============================================================
   BOLSA DE DEMANDA
   Acá la demanda es lo que cotiza. Tiene que ser compartida por
   definición: una demanda que solo ve quien la publicó no sirve
   para nada.
   ============================================================ */
async function demanda(req, url, env, cors){
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU', ordenes:[] }, cors, 501);
  const partes = url.pathname.split('/').filter(Boolean);   // v1, demanda, [id], [accion]
  const id = partes[2], accion = partes[3];

  const leer   = async () => JSON.parse(await env.NIJU.get('demanda') || '[]');
  const grabar = async (os) => env.NIJU.put('demanda', JSON.stringify(os));

  if (req.method === 'GET'){
    const os = await leer();
    return json({ ordenes: id ? os.filter(o => o.id === id) : os }, cors);
  }

  if (req.method === 'POST'){
    const cuerpo = await req.json().catch(() => ({}));
    const os = await leer();

    if (accion === 'ofertar'){
      const i = os.findIndex(o => o.id === id);
      if (i < 0) return json({ error:'orden inexistente' }, cors, 404);
      const proveedor = String(cuerpo.proveedor || '').slice(0, 80).trim();
      const precio = Math.max(1, parseInt(cuerpo.precio) || 0);
      if (!proveedor || !precio) return json({ error:'falta proveedor o precio' }, cors, 400);
      os[i].ofertas = os[i].ofertas || [];
      os[i].ofertas.push({
        id: crypto.randomUUID().slice(0, 8), proveedor, precio,
        cantidad: Math.max(1, parseInt(cuerpo.cantidad) || 1),
        plazoDias: cuerpo.plazoDias || null,
        notas: String(cuerpo.notas || '').slice(0, 300), ts: Date.now()
      });
      await grabar(os);
      return json({ ok:true, orden: os[i] }, cors);
    }

    const titulo = String(cuerpo.titulo || '').slice(0, 140).trim();
    if (!titulo) return json({ error:'falta el título de la demanda' }, cors, 400);
    const o = {
      ...cuerpo, titulo,
      id: cuerpo.id || 'od-' + crypto.randomUUID().slice(0, 8),
      creada: Date.now(), ofertas: [], estado:'abierta'
    };
    os.push(o);
    await grabar(os);
    return json({ ok:true, orden:o }, cors);
  }

  return json({ error:'método no permitido' }, cors, 405);
}

/* ============================================================
   RESOLVER — "traelo por mí"
   El cliente pega el link de un producto de cualquier tienda del
   mundo y devolvemos qué es, cuánto sale y con qué foto. Leemos
   los mismos datos que usa WhatsApp o Facebook para armar la vista
   previa de un enlace: JSON-LD (schema.org) y Open Graph.
   ============================================================ */

const TIENDAS_CONOCIDAS = [
  [/(^|\.)mercadolibre\./i,   'meli',       'Mercado Libre', 'ARS', 'nacional'],
  [/(^|\.)amazon\./i,         'amazon',     'Amazon',        'USD', 'internacional'],
  [/(^|\.)ebay\./i,           'ebay',       'eBay',          'USD', 'internacional'],
  [/aliexpress\./i,           'aliexpress', 'AliExpress',    'USD', 'internacional'],
  [/alibaba\./i,              'alibaba',    'Alibaba',       'USD', 'internacional'],
  [/1688\.com/i,              '1688',       '1688.com',      'CNY', 'internacional'],
  [/temu\./i,                 'temu',       'Temu',          'USD', 'internacional'],
  [/shein\./i,                'shein',      'SHEIN',         'USD', 'internacional'],
  [/walmart\./i,              'walmart',    'Walmart',       'USD', 'internacional'],
  [/bestbuy\./i,              'bestbuy',    'Best Buy',      'USD', 'internacional'],
  [/etsy\./i,                 'etsy',       'Etsy',          'USD', 'internacional'],
  [/dhgate\./i,               'dhgate',     'DHgate',        'USD', 'internacional'],
  [/jumbo\.com\.ar/i,         'jumbo',      'Jumbo',         'ARS', 'nacional'],
  [/easy\.com\.ar/i,          'easy',       'Easy',          'ARS', 'nacional'],
  [/carrefour\.com\.ar/i,     'carrefour',  'Carrefour',     'ARS', 'nacional'],
  [/coto(digital)?\./i,       'coto',       'Coto Digital',  'ARS', 'nacional'],
  [/laanonima|anonimaonline/i,'anonima',    'La Anónima',    'ARS', 'nacional'],
  [/fravega\./i,              'fravega',    'Frávega',       'ARS', 'nacional'],
  [/tiendanube|mitiendanube/i,'tiendanube', 'Tiendanube',    'ARS', 'nacional'],
  [/instagram\./i,            'instagram',  'Instagram',     'ARS', 'social'],
  [/tiktok\./i,               'tiktokshop', 'TikTok',        'USD', 'social'],
  [/facebook\./i,             'fbmarket',   'Facebook',      'ARS', 'social']
];

function reconocerTienda(host){
  for (const [rx, id, nombre, moneda, tipo] of TIENDAS_CONOCIDAS){
    if (rx.test(host)) return { id, nombre, moneda, tipo };
  }
  const limpio = host.replace(/^www\./, '');
  return { id:'externa', nombre:limpio, moneda:null, tipo:/\.ar$/.test(limpio) ? 'nacional' : 'internacional' };
}

async function resolver(url, env, ctx, cors){
  const destino = url.searchParams.get('url');
  if (!destino) return json({ error:'falta el parámetro url' }, cors, 400);

  let u;
  try{ u = new URL(destino); }catch{ return json({ error:'el link no es válido' }, cors, 400); }
  if (!/^https?:$/.test(u.protocol)) return json({ error:'solo http o https' }, cors, 400);

  const clave = new Request('https://cache.niju/resolver?u=' + encodeURIComponent(u.href));
  const cache = caches.default;
  const hit = await cache.match(clave);
  if (hit) return hit;

  const tienda = reconocerTienda(u.hostname);
  let html = '';
  try{
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    const r = await fetch(u.href, { signal:ctrl.signal, redirect:'follow', headers:{
      'user-agent':'Mozilla/5.0 (compatible; NiJuBot/0.1; +https://niju.ar/bot)',
      'accept':'text/html,application/xhtml+xml',
      'accept-language':'es-AR,es;q=0.9,en;q=0.8'
    }});
    clearTimeout(t);
    if (r.status === 403 || r.status === 429 || r.status === 503 || r.status === 500){
      return json({ ok:false, tienda, url:u.href, bloqueado:true,
        error:`${tienda.nombre} no deja que un programa lea sus páginas.`,
        sugerencia:'Copiá el título y el precio a mano: te cotizamos igual, con impuestos y gestión incluidos.' }, cors);
    }
    if (!r.ok) throw new Error('la tienda respondió ' + r.status);
    html = (await r.text()).slice(0, 900000);
  }catch(e){
    return json({ ok:false, tienda, url:u.href,
      error:'No pudimos leer esa página automáticamente.',
      detalle:String(e.message || e),
      sugerencia:'Cargá los datos a mano: con el título, el precio y la moneda alcanza para cotizarte la compra.' }, cors);
  }

  const datos = extraer(html, u, tienda);
  const v = verificar(datos, tienda);
  const res = json({ ok:v.ok, confianza: datos.aviso ? 'revisar' : v.confianza, tienda, ...datos, url:u.href,
                     error:v.ok ? null : v.error, sugerencia:v.ok ? null : v.sugerencia }, cors);
  if (v.ok) ctx.waitUntil(cache.put(clave, res.clone()));
  return res;
}

/* Basura típica de una página que NO es la ficha de un producto.
   Sin este control devolvemos el precio de la portada como si fuera
   el del producto, y eso es mentirle al cliente. */
const BASURA = [
  /product not available/i, /no est[áa] disponible/i, /page not found/i, /p[áa]gina no encontrada/i,
  /^404/, /acceso denegado/i, /access denied/i, /robot check/i, /captcha/i, /are you a human/i,
  /explore the latest/i, /online shopping/i, /compras? online/i, /^(inicio|home)$/i,
  /iniciar sesi[óo]n/i, /sign in/i, /carrito/i, /just a moment/i
];

function verificar(d, tienda){
  const t = (d.titulo || '').trim();

  if (!t || t.length < 12)
    return { ok:false, confianza:'nula',
      error:'No encontramos la ficha del producto en ese link.',
      sugerencia:'Fijate que sea el link del producto y no el de una búsqueda o una categoría. O cargalo a mano.' };

  if (BASURA.some(rx => rx.test(t)) || t.toLowerCase() === (tienda.nombre || '').toLowerCase())
    return { ok:false, confianza:'nula',
      error:'Ese link nos devolvió una página general, no un producto.',
      sugerencia:'Abrí el producto en la tienda y copiá el link de esa ficha. O cargalo a mano.' };

  if (d.precio == null || d.precio <= 0)
    return { ok:false, confianza:'parcial',
      error:'Leímos el producto pero la tienda no publica el precio de forma legible.',
      sugerencia:'Copiá el precio que ves en pantalla y te cotizamos igual.' };

  const confianza = d.fuente === 'schema.org' && d.imagen ? 'alta'
                  : d.imagen ? 'media' : 'baja';
  return { ok:true, confianza };
}

function extraer(html, u, tienda){
  const out = { titulo:null, precio:null, moneda:null, imagen:null, marca:null,
                descripcion:null, fuente:null, candidatos:[], aviso:null };
  const anotar = (v, de) => { const n = num(v); if (n && n > 0) out.candidatos.push({ valor:n, de }); };

  /* 1) JSON-LD (schema.org Product) — lo más confiable */
  const bloques = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of bloques){
    let d; try{ d = JSON.parse(b[1].trim()); }catch{ continue; }
    for (const nodo of aplanar(d)){
      const tipo = [].concat(nodo['@type'] || []).join(' ');
      if (!/product/i.test(tipo)) continue;
      out.titulo = out.titulo || limpiarTexto(nodo.name);
      out.marca  = out.marca  || limpiarTexto(nodo.brand?.name || nodo.brand);
      out.descripcion = out.descripcion || limpiarTexto(nodo.description);
      const img = [].concat(nodo.image || [])[0];
      out.imagen = out.imagen || (typeof img === 'string' ? img : img?.url) || null;
      const of = [].concat(nodo.offers || [])[0];
      if (of){
        anotar(of.price, 'schema.org');
        anotar(of.lowPrice, 'schema.org (mínimo)');
        anotar(of.highPrice, 'schema.org (máximo)');
        out.precio = out.precio ?? num(of.price ?? of.lowPrice ?? of.highPrice);
        out.moneda = out.moneda || (of.priceCurrency || '').toUpperCase() || null;
      }
      if (out.titulo) out.fuente = 'schema.org';
    }
  }

  /* 2) Open Graph / meta — la vista previa de siempre */
  const meta = (prop) => {
    const rx = new RegExp('<meta[^>]+(?:property|name|itemprop)=["\']' + prop + '["\'][^>]*>', 'i');
    const m = html.match(rx);
    if (!m) return null;
    const c = m[0].match(/content=["\']([^"\']*)["\']/i);
    return c ? limpiarTexto(c[1]) : null;
  };

  out.titulo = out.titulo || meta('og:title') || meta('twitter:title') || limpiarTexto((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  out.imagen = out.imagen || meta('og:image') || meta('twitter:image') || meta('image');
  out.descripcion = out.descripcion || meta('og:description') || meta('description');
  out.marca  = out.marca  || meta('product:brand') || meta('brand');
  anotar(meta('product:price:amount'), 'etiqueta de la página');
  anotar(meta('og:price:amount'), 'etiqueta de la página');
  anotar(meta('price'), 'etiqueta de la página');
  if (out.precio == null) out.precio = num(meta('product:price:amount') || meta('og:price:amount') || meta('price'));
  out.moneda = out.moneda || (meta('product:price:currency') || meta('og:price:currency') || '').toUpperCase() || null;
  if (!out.fuente && out.titulo) out.fuente = 'open graph';

  /* 3) Últimos recursos */
  for (const m of html.matchAll(/"(?:price|salePrice|currentPrice)"\s*:\s*"?([\d.,]+)"?/gi)) anotar(m[1], 'código de la página');
  if (out.precio == null && out.candidatos.length) out.precio = out.candidatos[0].valor;

  /* --- ¿Nos habrán dado el precio de UNA CUOTA? ---
     Una cuota siempre es una fracción exacta del total: si entre dos
     precios de la página hay una relación de 3, 6, 12 o 18 veces, lo
     más probable es que el chico sea la cuota y el grande el total.
     Publicar la cuota como si fuera el precio es engañar al cliente. */
  const vs = [...new Set(out.candidatos.map(c => c.valor))].sort((a,b) => a - b);
  for (let i = 0; i < vs.length; i++){
    for (let j = i + 1; j < vs.length; j++){
      const razon = vs[j] / vs[i];
      const entero = Math.round(razon);
      if (entero >= 2 && entero <= 24 && Math.abs(razon - entero) < 0.04){
        if (out.precio === vs[i]){
          out.precio = vs[j];
          out.aviso = `La página mostraba ${vs[i]} y ${vs[j]}: ${vs[i]} parece ser el valor de una de ${entero} cuotas, así que tomamos ${vs[j]} como precio total. Verificalo antes de confirmar.`;
        }
      }
    }
  }
  if (!out.aviso && vs.length > 1 && vs[vs.length-1] / vs[0] > 1.15){
    out.aviso = `Encontramos más de un precio en esa página (${vs.join(' y ')}). Tomamos ${out.precio}. Si no es ese, corregilo abajo.`;
  }
  if (!out.moneda) out.moneda = tienda.moneda || null;
  if (out.imagen && out.imagen.startsWith('//')) out.imagen = u.protocol + out.imagen;
  if (out.imagen && out.imagen.startsWith('/'))  out.imagen = u.origin + out.imagen;

  return out;
}

function* aplanar(d){
  if (Array.isArray(d)){ for (const x of d) yield* aplanar(x); return; }
  if (d && typeof d === 'object'){
    yield d;
    if (d['@graph']) yield* aplanar(d['@graph']);
  }
}

const limpiarTexto = t => typeof t === 'string'
  ? t.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'")
     .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
     .replace(/\s+/g,' ').trim().slice(0, 300)
  : null;

function num(v){
  if (v == null) return null;
  const s = String(v).replace(/[^\d.,]/g,'');
  if (!s) return null;
  // 1.234,56 (es) vs 1,234.56 (en)
  const normal = s.lastIndexOf(',') > s.lastIndexOf('.')
    ? s.replace(/\./g,'').replace(',','.')
    : s.replace(/,/g,'');
  const n = parseFloat(normal);
  return isFinite(n) ? n : null;
}

async function salud(tienda, env, cors){
  const a = ADAPTADORES[tienda];
  if (!a) return json({ ok:false, error:'tienda desconocida' }, cors, 404);
  try{
    const r = await a.buscar({ q:'test', limite:1, env });
    return json({ ok:true, modo:a.modo, muestra:r.length }, cors);
  }catch(e){ return json({ ok:false, modo:a.modo, error:String(e.message || e) }, cors); }
}

/* ================== ¿ESTE RESULTADO TIENE QUE VER? ==================
   Varias tiendas buscan por pedazos de palabra: pedirle «imac» a
   Carrefour devuelve un secamanos «por aproxIMACión» y medias
   «cliMACool». Si no filtramos acá, esa basura viaja hasta el cliente.
   Pedimos que las palabras de la búsqueda aparezcan como PALABRAS,
   no como pedacitos adentro de otra.
   ==================================================================== */
const sinAcentos = t => (t || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function palabras(t){
  return sinAcentos(t).replace(/[^a-z0-9\s.]/g, ' ').split(/\s+/).filter(Boolean);
}

function tieneQueVer(consulta, titulo, marca = ''){
  const q = palabras(consulta).filter(w => w.length >= 3);
  if (!q.length) return true;
  const texto = new Set([...palabras(titulo), ...palabras(marca)]);
  let aciertos = 0;
  for (const w of q){
    let ok = texto.has(w);
    if (!ok){
      // aceptamos plural/singular y variantes largas: "notebook"/"notebooks"
      for (const x of texto){
        if (x.length >= 4 && (x.startsWith(w) || w.startsWith(x))){ ok = true; break; }
      }
    }
    if (ok) aciertos++;
  }
  return aciertos / q.length >= 0.5;
}

/* ================== NORMALIZACIÓN AL CONTRATO ================== */

function oferta(o){
  return {
    id: o.id, tiendaId: o.tiendaId, productoId: o.productoId || null,
    titulo: o.titulo, marca: o.marca || '', modelo: o.modelo || '',
    precio: Number(o.precio) || 0, precioLista: o.precioLista || null,
    moneda: o.moneda, envio: Number(o.envio) || 0,
    descuento: o.precioLista ? Math.round((1 - o.precio / o.precioLista) * 100) : 0,
    entregaDias: o.entregaDias || [7, 20], stock: o.stock ?? 1,
    cuotas: o.cuotas || 0, cuotaValor: o.cuotaValor ?? null, reputacion: o.reputacion ?? 4,
    vendidos: o.vendidos || 0, url: o.url, rubro: o.rubro || '',
    pesoKg: o.pesoKg || 1, specs: o.specs || {}, tags: o.tags || [],
    imagen: o.imagen || null, vendedor: o.vendedor || '', demo:false
  };
}

/* ================== ADAPTADORES POR TIENDA ================== */

const ADAPTADORES = {

  /* ---------- eBay: Browse API. La más fácil de arrancar. ---------- */
  ebay: {
    modo:'api',
    async buscar({ q, limite, env }){
      const token = await tokenEbay(env);
      const u = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=${limite}&filter=buyingOptions:{FIXED_PRICE}`;
      const d = await pedir(u, { headers:{
        Authorization:`Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID':'EBAY_US',
        'X-EBAY-C-ENDUSERCTX':'contextualLocation=country=AR'
      }});
      return (d.itemSummaries || []).map(it => oferta({
        id:`ebay-${it.itemId}`, tiendaId:'ebay',
        titulo:it.title, marca:it.brand || '',
        precio:+(it.price?.value || 0), moneda:it.price?.currency || 'USD',
        envio:+(it.shippingOptions?.[0]?.shippingCost?.value || 0),
        entregaDias:[10, 28], stock:1, reputacion:+(it.seller?.feedbackPercentage || 95) / 20,
        vendidos:0, url:it.itemAffiliateWebUrl || it.itemWebUrl,
        imagen:it.image?.imageUrl, vendedor:it.seller?.username || 'eBay'
      }));
    }
  },

  /* ---------- Best Buy: key gratuita, catálogo limpio ---------- */
  bestbuy: {
    modo:'api',
    async buscar({ q, limite, env }){
      if (!env.BESTBUY_KEY) throw new Error('falta BESTBUY_KEY');
      const u = `https://api.bestbuy.com/v1/products((search=${encodeURIComponent(q)}))?format=json&show=sku,name,salePrice,regularPrice,manufacturer,url,image,shippingCost,onlineAvailability&pageSize=${limite}&apiKey=${env.BESTBUY_KEY}`;
      const d = await pedir(u);
      return (d.products || []).map(p => oferta({
        id:`bestbuy-${p.sku}`, tiendaId:'bestbuy',
        titulo:p.name, marca:p.manufacturer || '',
        precio:p.salePrice, precioLista:p.regularPrice > p.salePrice ? p.regularPrice : null,
        moneda:'USD', envio:+(p.shippingCost || 0), entregaDias:[14, 30],
        stock:p.onlineAvailability ? 5 : 0, reputacion:4.4,
        url:p.url, imagen:p.image, vendedor:'Best Buy'
      }));
    }
  },

  /* ---------- Mercado Libre: exige token OAuth de app registrada ---------- */
  meli: {
    modo:'api',
    async buscar({ q, limite, env }){
      const token = await tokenMeli(env);
      const u = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=${limite}`;
      const d = await pedir(u, { headers:{ Authorization:`Bearer ${token}` } });
      return (d.results || []).map(it => oferta({
        id:`meli-${it.id}`, tiendaId:'meli',
        titulo:it.title, marca:(it.attributes || []).find(a => a.id === 'BRAND')?.value_name || '',
        modelo:(it.attributes || []).find(a => a.id === 'MODEL')?.value_name || '',
        precio:it.price, precioLista:it.original_price || null, moneda:it.currency_id,
        envio:it.shipping?.free_shipping ? 0 : 4800,
        entregaDias:[2, 6], stock:it.available_quantity,
        /* solo contamos cuotas SIN interés: publicar "12 cuotas" cuando
           tienen recargo es hacerle creer al cliente algo que no es */
        cuotas: (it.installments && (it.installments.rate || 0) === 0) ? (it.installments.quantity || 0) : 0,
        cuotaValor: (it.installments && (it.installments.rate || 0) === 0) ? (it.installments.amount || null) : null,
        reputacion:4.5, vendidos:it.sold_quantity || 0,
        url:it.permalink, imagen:it.thumbnail?.replace('-I.jpg','-O.jpg'),
        vendedor:it.seller?.nickname || 'Mercado Libre'
      }));
    }
  },

  /* ---------- AliExpress: API de afiliados (firma MD5) ---------- */
  aliexpress: {
    modo:'afiliado',
    async buscar({ q, limite, env }){
      if (!env.ALI_APP_KEY) throw new Error('falta ALI_APP_KEY (portals.aliexpress.com)');
      const params = {
        app_key: env.ALI_APP_KEY,
        method: 'aliexpress.affiliate.product.query',
        sign_method: 'md5',
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        format: 'json', v: '2.0',
        keywords: q, page_size: String(limite), page_no: '1',
        target_currency: 'USD', target_language: 'ES', ship_to_country: 'AR',
        tracking_id: env.ALI_TRACKING_ID || 'niju'
      };
      params.sign = await firmaMD5(params, env.ALI_APP_SECRET);
      const u = 'https://api-sg.aliexpress.com/sync?' + new URLSearchParams(params);
      const d = await pedir(u);
      const items = d?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || [];
      return items.map(p => oferta({
        id:`ali-${p.product_id}`, tiendaId:'aliexpress',
        titulo:p.product_title, marca:'',
        precio:+p.target_sale_price, precioLista:+p.target_original_price || null,
        moneda:'USD', envio:0, entregaDias:[12, 35], stock:5,
        reputacion:+(p.evaluate_rate || '90%').replace('%','') / 20,
        vendidos:+(p.lastest_volume || 0),
        url:p.promotion_link || p.product_detail_url, imagen:p.product_main_image_url,
        vendedor:p.shop_name || 'AliExpress'
      }));
    }
  },

  /* ---------- VTEX: la plataforma de medio retail argentino ----------
     Jumbo, Easy, Carrefour, Vea, Disco y otros corren sobre VTEX y
     exponen su catálogo público. Es la misma API que usa el sitio de
     la tienda para mostrarte los precios. Ver docs/LEGAL.md antes de
     habilitarlas: revisar términos y respetar la frecuencia.        */
  jumbo:     vtex('jumbo', 'www.jumbo.com.ar', [1,3]),
  easy:      vtex('easy', 'www.easy.com.ar', [2,6]),
  carrefour: vtex('carrefour', 'www.carrefour.com.ar', [1,4]),
  vea:       vtex('vea', 'www.vea.com.ar', [1,3]),
  disco:     vtex('disco', 'www.disco.com.ar', [1,3]),
  farmacity: vtex('farmacity', 'www.farmacity.com', [1,3]),
  fravega:   vtex('fravega',   'www.fravega.com',      [2,6]),
  cetrogar:  vtex('cetrogar',  'www.cetrogar.com.ar',  [3,8]),
  masonline: vtex('masonline', 'www.masonline.com.ar', [1,4]),
  sportotal: vtex('sportotal', 'www.sportotal.com.ar', [3,7]),

  c47street:  vtex('c47street', 'www.47street.com.ar', [3,7]),
  mimo:       vtex('mimo', 'www.mimo.com.ar', [3,7]),
  topper:     vtex('topper', 'www.topper.com.ar', [3,7]),
  portsaid:   vtex('portsaid', 'www.portsaid.com.ar', [3,7]),
  desiderata: vtex('desiderata', 'www.desiderata.com.ar', [3,7]),
  tascani:    vtex('tascani', 'www.tascani.com.ar', [3,7]),
  legacy:     vtex('legacy', 'www.legacy.com.ar', [3,7]),
  sportline:  vtex('sportline', 'www.sportline.com.ar', [3,7]),
  cebra:      vtex('cebra', 'www.cebra.com.ar', [2,6]),
  juleriaque: vtex('juleriaque', 'www.juleriaque.com.ar', [2,6]),
  puppis:     vtex('puppis', 'www.puppis.com.ar', [2,5]),

  /* ---------- Tiendas sobre WooCommerce ---------- */
  cuspide: woo('cuspide', 'www.cuspide.com', [3,8]),

  /* ---------- Tiendas sobre Shopify ----------
     Decathlon, Reebok, Timberland y muchas marcas corren sobre
     Shopify, que expone el mismo buscador que usa su propia web.
     Trae título, precio, foto y disponibilidad. ---------------- */
  decathlon:  shopify('decathlon',  'decathlon.com.ar',      [2,6]),
  reebok:     shopify('reebok',     'www.reebok.com.ar',     [3,7]),
  timberland: shopify('timberland', 'www.timberland.com.ar', [3,7]),
  ansilta:    shopify('ansilta',    'www.ansilta.com.ar',    [3,8]),

  /* ---------- Coto: no usa VTEX, usa Endeca (plataforma vieja de Oracle).
     Devuelve JSON con foto real y precio. Dos trampas que hay que
     conocer:
       · sku.activePrice    = lo que se paga
       · sku.referencePrice = el precio POR UNIDAD DE MEDIDA (por litro,
         por kilo). Tomarlo por error muestra un 33% menos.
     ---------------------------------------------------------------- */
  coto: {
    modo:'catalogo-publico',
    async buscar({ q, limite, desde = 0 }){
      const u = `https://www.coto.com.ar/sitios/cdigi/browse?Ntt=${encodeURIComponent(q)}` +
                `&format=json&Nrpp=${Math.min(limite, 24)}&No=${desde}`;
      const d = await pedir(u, { headers:{ 'accept':'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' } });

      /* Los productos están enterrados en la estructura de Endeca:
         los buscamos en lugar de suponer en qué rama vienen. */
      const fichas = [];
      (function cavar(o, prof){
        if (prof > 12 || !o) return;
        if (Array.isArray(o)){ for (const x of o.slice(0, 40)) cavar(x, prof + 1); return; }
        if (typeof o === 'object'){
          if (Array.isArray(o.records) && o.records.length && o.attributes?.['product.displayName']) fichas.push(o);
          for (const v of Object.values(o)) cavar(v, prof + 1);
        }
      })(d, 0);

      const uno = (v) => Array.isArray(v) ? v[0] : v;
      const out = [];
      const vistos = new Set();

      for (const f of fichas){
        const sku = (f.records || [])[0];
        const a = { ...(f.attributes || {}), ...((sku && sku.attributes) || {}) };
        const titulo = uno(a['product.displayName']);
        const precio = parseFloat(uno(a['sku.activePrice']) || 0);
        if (!titulo || !(precio > 0)) continue;

        const id = uno(a['product.repositoryId']) || titulo;
        if (vistos.has(id)) continue;
        vistos.add(id);

        const estado = f.detailsAction?.recordState || '';
        const url = estado ? 'https://www.coto.com.ar' + estado.replace(/\?format=json.*$/, '') : 'https://www.coto.com.ar/';

        out.push(oferta({
          id:`coto-${id}`, tiendaId:'coto',
          titulo, marca: uno(a['product.brand']) || '',
          precio, precioLista:null, moneda:'ARS', envio:0, entregaDias:[1,4],
          cuotas:0, cuotaValor:null, stock:5, reputacion:4.0,
          url,
          imagen: uno(a['product.largeImage.url']) || uno(a['product.mediumImage.url']) || null,
          vendedor:'Coto',
          rubro: uno(a['product.LDEPAR']) || ''
        }));
        if (out.length >= limite) break;
      }
      return out;
    }
  }
};

/* ------------------------------------------------------------------
   Conector genérico de WooCommerce.
   Usa la Store API (/wp-json/wc/store/products), que viene abierta por
   defecto. Ojo con el precio: viene en la unidad menor (centavos), así
   que 2690000 con currency_minor_unit=2 son $26.900, no 2,7 millones.
   ------------------------------------------------------------------ */
function woo(id, host, entregaDias){
  return {
    modo:'catalogo-publico',
    async buscar({ q, limite, desde = 0 }){
      const porPagina = Math.min(limite, 20);
      const pagina = Math.floor(desde / porPagina) + 1;
      const u = `https://${host}/wp-json/wc/store/products?search=${encodeURIComponent(q)}` +
                `&per_page=${porPagina}&page=${pagina}`;
      const d = await pedir(u, { headers:{ 'accept':'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' } });
      if (!Array.isArray(d)) return [];
      const out = [];

      for (const p of d){
        const pr = p.prices || {};
        const divisor = Math.pow(10, pr.currency_minor_unit ?? 2);
        const precio = parseFloat(pr.price ?? 0) / divisor;
        if (!(precio > 0)) continue;
        if (p.is_in_stock === false) continue;

        const regular = parseFloat(pr.regular_price ?? 0) / divisor;
        const listaCreible = regular > precio && regular <= precio * 3;

        out.push(oferta({
          id:`${id}-${p.id}`, tiendaId:id,
          titulo: String(p.name || '').replace(/<[^>]*>/g, '').trim(),
          marca: '', precio, precioLista: listaCreible ? regular : null,
          moneda:'ARS', envio:0, entregaDias,
          cuotas:0, cuotaValor:null, stock:5, reputacion:4.1,
          url: p.permalink || `https://${host}`,
          imagen: (p.images || [])[0]?.src || null, vendedor:id
        }));
      }
      return out;
    }
  };
}

/* ------------------------------------------------------------------
   Conector genérico de Shopify.
   Usa /search/suggest.json, que es el mismo buscador que usa la web
   de la tienda. Devuelve precio en pesos como texto ("67500.00"),
   así que hay que convertirlo con cuidado.
   ------------------------------------------------------------------ */
function shopify(id, host, entregaDias){
  return {
    modo:'catalogo-publico',
    async buscar({ q, limite, desde = 0 }){
      /* El buscador rápido de Shopify devuelve hasta 10 y no pagina.
         Para ver más hay que entrar a la tienda: preferimos decirlo
         antes que fingir que hay más páginas. */
      if (desde > 0) return [];
      const u = `https://${host}/search/suggest.json?q=${encodeURIComponent(q)}` +
                `&resources%5Btype%5D=product&resources%5Blimit%5D=10`;
      const d = await pedir(u, { headers:{ 'accept':'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' } });
      const items = d?.resources?.results?.products || [];
      const out = [];

      for (const p of items){
        const precio = parseFloat(p.price ?? p.price_min ?? 0);
        if (!(precio > 0)) continue;
        if (p.available === false) continue;        // sin stock no se publica

        /* El precio tachado solo si es creíble, igual que en VTEX */
        const lista = parseFloat(p.compare_at_price_min ?? p.compare_at_price_max ?? 0);
        const listaCreible = lista > precio && lista <= precio * 3;

        /* La foto puede venir como texto o como objeto */
        const img = typeof p.image === 'string' ? p.image
                  : (p.image?.url || p.featured_image?.url || p.featured_image || null);

        out.push(oferta({
          id:`${id}-${p.id}`, tiendaId:id,
          titulo:p.title, marca:p.vendor || '',
          precio, precioLista: listaCreible ? lista : null,
          moneda:'ARS', envio:0, entregaDias,
          cuotas:0, cuotaValor:null,     // Shopify no publica los planes de cuotas
          stock:5, reputacion:4.2,
          url: p.url ? `https://${host}${String(p.url).split('?')[0]}` : `https://${host}`,
          imagen: img, vendedor:id
        }));
      }
      return out;
    }
  };
}

function vtex(id, host, entregaDias){
  return {
    modo:'catalogo-publico',
    async buscar({ q, limite, desde = 0 }){
      const u = `https://${host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}` +
                `&_from=${desde}&_to=${desde + limite - 1}`;
      const d = await pedir(u, { headers:{ 'accept':'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' } });
      const out = [];
      for (const p of (d || [])){
        const item = p.items?.[0];
        const vendedor = item?.sellers?.find(s => s.commertialOffer?.IsAvailable) || item?.sellers?.[0];
        const oferta1 = vendedor?.commertialOffer;
        if (!oferta1) continue;

        /* Sin stock no se publica. Un producto que la tienda ya no tiene
           termina en un enlace que dice "el producto no existe", y eso al
           cliente le hace perder el viaje. */
        if (oferta1.IsAvailable === false) continue;
        if (!(oferta1.AvailableQuantity > 0)) continue;
        if (!(oferta1.Price > 0)) continue;

        /* VTEX a veces manda un ListPrice disparatado (vimos $611.570 para
           un aceite de $7.400). Si el "precio tachado" no es creíble, se
           descarta: mejor sin descuento que con un descuento inventado. */
        const lista = oferta1.ListPrice;
        const listaCreible = lista > oferta1.Price && lista <= oferta1.Price * 3;

        /* Las cuotas NO se inventan: salen de lo que publica la tienda.
           Solo cuentan las que no tienen interés y multiplican de vuelta
           al precio total. */
        const planes = (oferta1.Installments || []).filter(i =>
          (i.InterestRate || 0) === 0 &&
          (i.NumberOfInstallments || 0) > 1 &&
          Math.abs((i.TotalValuePlusInterestRate || 0) - oferta1.Price) < 1);
        const mejor = planes.sort((a, b) => b.NumberOfInstallments - a.NumberOfInstallments)[0];

        out.push(oferta({
          id:`${id}-${p.productId}`, tiendaId:id,
          titulo:p.productName, marca:p.brand || '',
          precio:oferta1.Price,
          precioLista: listaCreible ? lista : null,
          moneda:'ARS', envio:0, entregaDias,
          cuotas: mejor ? mejor.NumberOfInstallments : 0,
          cuotaValor: mejor ? Math.round(mejor.Value * 100) / 100 : null,
          stock:Math.min(oferta1.AvailableQuantity || 0, 99),
          reputacion:4.1,
          url: p.link || `https://${host}/${p.linkText}/p`,
          imagen:item?.images?.[0]?.imageUrl, vendedor:vendedor?.sellerName || id
        }));
      }
      return out;
    }
  };
}

/* ================== AUXILIARES ================== */

/* Mercado Libre entrega tokens que vencen a las 6 horas. Pegarlo a mano
   significaría volver a pegarlo tres veces por día: lo pedimos solos con
   el App ID y el Secret, y lo renovamos cuando se vence. */
let cacheTokenMeli = { valor:null, vence:0 };
async function tokenMeli(env){
  if (cacheTokenMeli.valor && Date.now() < cacheTokenMeli.vence) return cacheTokenMeli.valor;

  // Si cargaste un token a mano, lo respetamos (para probar rápido)
  if (env.MELI_TOKEN) return env.MELI_TOKEN;

  if (!env.MELI_APP_ID || !env.MELI_SECRET)
    throw new Error('faltan MELI_APP_ID y MELI_SECRET (developers.mercadolibre.com.ar)');

  const cuerpo = new URLSearchParams({
    grant_type:'client_credentials',
    client_id: env.MELI_APP_ID,
    client_secret: env.MELI_SECRET
  });
  const r = await fetch('https://api.mercadolibre.com/oauth/token', {
    method:'POST',
    headers:{ 'content-type':'application/x-www-form-urlencoded', accept:'application/json' },
    body: cuerpo
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token)
    throw new Error(`Mercado Libre rechazó las credenciales (${r.status}): ${d.message || d.error || 'sin detalle'}`);

  cacheTokenMeli = { valor:d.access_token, vence:Date.now() + ((d.expires_in || 21600) - 300) * 1000 };
  return d.access_token;
}

let cacheTokenEbay = { valor:null, vence:0 };
async function tokenEbay(env){
  if (cacheTokenEbay.valor && Date.now() < cacheTokenEbay.vence) return cacheTokenEbay.valor;
  if (!env.EBAY_CLIENT_ID) throw new Error('falta EBAY_CLIENT_ID');
  const basic = btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`);
  const r = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method:'POST',
    headers:{ Authorization:`Basic ${basic}`, 'content-type':'application/x-www-form-urlencoded' },
    body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'
  });
  if (!r.ok) throw new Error('eBay OAuth ' + r.status);
  const d = await r.json();
  cacheTokenEbay = { valor:d.access_token, vence:Date.now() + (d.expires_in - 120) * 1000 };
  return d.access_token;
}

/* MD5 para la firma de AliExpress (Workers no trae MD5 nativo) */
async function firmaMD5(params, secret){
  const orden = Object.keys(params).filter(k => k !== 'sign').sort();
  const base = secret + orden.map(k => k + params[k]).join('') + secret;
  return md5(base).toUpperCase();
}

function md5(s){
  /* Implementación compacta de MD5 (RFC 1321) */
  const rl = (n, c) => (n << c) | (n >>> (32 - c));
  const au = (x, y) => { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); };
  const cmn = (q, a, b, x, s, t) => au(rl(au(au(a, q), au(x, t)), s), b);
  const ff = (a,b,c,d,x,s,t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a,b,c,d,x,s,t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a,b,c,d,x,s,t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a,b,c,d,x,s,t) => cmn(c ^ (b | ~d), a, b, x, s, t);

  const bytes = new TextEncoder().encode(s);
  const n = ((bytes.length + 8) >> 6) + 1, blocks = new Array(n * 16).fill(0);
  for (let i = 0; i < bytes.length; i++) blocks[i >> 2] |= bytes[i] << ((i % 4) * 8);
  blocks[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  blocks[n * 16 - 2] = bytes.length * 8;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const K = [-680876936,-389564586,606105819,-1044525330,-176418897,1200080426,-1473231341,-45705983,
             1770035416,-1958414417,-42063,-1990404162,1804603682,-40341101,-1502002290,1236535329,
             -165796510,-1069501632,643717713,-373897302,-701558691,38016083,-660478335,-405537848,
             568446438,-1019803690,-187363961,1163531501,-1444681467,-51403784,1735328473,-1926607734,
             -378558,-2022574463,1839030562,-35309556,-1530992060,1272893353,-155497632,-1094730640,
             681279174,-358537222,-722521979,76029189,-640364487,-421815835,530742520,-995338651,
             -198630844,1126891415,-1416354905,-57434055,1700485571,-1894986606,-1051523,-2054922799,
             1873313359,-30611744,-1560198380,1309151649,-145523070,-1120210379,718787259,-343485551];
  const S = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21];

  for (let i = 0; i < blocks.length; i += 16){
    const [oa, ob, oc, od] = [a, b, c, d];
    for (let j = 0; j < 64; j++){
      let f, g;
      if (j < 16){ f = ff; g = j; }
      else if (j < 32){ f = gg; g = (5 * j + 1) % 16; }
      else if (j < 48){ f = hh; g = (3 * j + 5) % 16; }
      else { f = ii; g = (7 * j) % 16; }
      const s = S[(j >> 4) * 4 + (j % 4)];
      const t = f(a, b, c, d, blocks[i + g], s, K[j]);
      a = d; d = c; c = b; b = t;
    }
    a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
  }
  const hex = n => { let o = ''; for (let i = 0; i < 4; i++) o += ((n >> (i * 8 + 4)) & 0x0F).toString(16) + ((n >> (i * 8)) & 0x0F).toString(16); return o; };
  return hex(a) + hex(b) + hex(c) + hex(d);
}
