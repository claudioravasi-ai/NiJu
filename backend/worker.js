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
     GET  /v1/demanda              ← pedidos abiertos ("Pedí y que compitan"), sin datos del cliente
     POST /v1/demanda              ← publicar un pedido (cliente con cuenta)
     GET  /v1/demanda/mias         ← mis pedidos, con ofertas y avisos
     POST /v1/demanda/:id/ofertar  ← oferta de un proveedor aprobado (x-niju-proveedor) o de NiJu
     POST /v1/demanda/:id/aceptar  ← el cliente acepta una oferta: se crea el pedido de compra
     POST /v1/demanda/:id/cerrar · POST /v1/demanda/:id/leido
     GET  /v1/demanda/proveedor    ← valida el código de un proveedor
     GET  /v1/demanda/mis-ofertas  ← lo que ofertó un cliente como vendedor
     GET  /v1/demanda/foto/:id     ← foto de la oferta de un particular
     POST /v1/solicitudes          ← consulta de "Vendé al mundo" o presupuesto de app/web (público, 10 por IP por día)
     GET  /v1/solicitudes · POST /v1/solicitudes/:id/atendida   (solo el dueño)
     GET/POST /v1/demanda/proveedores · POST /v1/demanda/proveedores/:id/baja  (solo el dueño)
     GET  /v1/estado               ← qué tiene encendido el servidor (base, cuentas, emails)
     GET  /v1/variantes?tienda=&id=&url=   ← talles, colores y stock de un producto
     POST /v1/clientes/registro · POST /v1/clientes/entrar · GET/PUT /v1/clientes/yo
     GET/POST /v1/ordenes · GET/PUT /v1/ordenes/:id · POST /v1/ordenes/:id/responder
     GET  /v1/lotes · PUT /v1/lotes/:id    ← compras hechas en cada tienda (solo el dueño)

   Variables de entorno (Settings → Variables, como "Secret"):
     EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
     BESTBUY_KEY
     MELI_TOKEN            (token OAuth de app registrada)
     ALI_APP_KEY, ALI_APP_SECRET, ALI_TRACKING_ID
     ORIGENES              (dominios permitidos, separados por coma)
     ADMIN_TOKEN           (clave del dueño: sin esto nadie crea campañas)
     ANTHROPIC_API_KEY     (asistente: clasifica la NCM y responde preguntas.
                            Sin esta clave la app usa la búsqueda por palabras
                            y el glosario, y lo dice)

   Más endpoints:
     POST /v1/asesor       ← { accion:'clasificar', titulo, descripcion } o
                             { accion:'preguntar', pregunta, contexto, historial }
     GET  /v1/arancel.zip  ← copia del Arancel Integrado de ARCA, por si ARCA
                             no responde al navegador
   ============================================================ */

const TTL = 600;                    // 10 minutos de cache por consulta
const TIMEOUT = 8000;
const UA_NIJU = 'Mozilla/5.0 (compatible; NiJuBot/0.1; +https://niju.ar/bot)';
const UA_VISTA_PREVIA = 'WhatsApp/2.23.20.0';     // así piden las páginas para mostrar la vista previa de un link

export default {
  async fetch(req, env, ctx){
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { headers:{ ...cors, 'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS' } });
    if (url.pathname === '/v1/admin/verificar')   return verificarAdmin(req, env, cors);
    if (url.pathname.startsWith('/v1/campanias')) return campanias(req, url, env, cors);
    if (url.pathname.startsWith('/v1/promos'))    return promos(req, url, env, cors);
    if (url.pathname.startsWith('/v1/demanda'))   return demanda(req, url, env, ctx, cors);

    try{
      if (url.pathname === '/v1/estado')           return estadoServidor(env, cors);
      if (url.pathname.startsWith('/v1/clientes')) return await rutaClientes(req, url, env, cors);
      if (url.pathname.startsWith('/v1/ordenes'))  return await rutaOrdenes(req, url, env, ctx, cors);
      if (url.pathname.startsWith('/v1/lotes'))    return await rutaLotes(req, url, env, cors);
      if (url.pathname === '/v1/variantes')        return await variantes(url, env, ctx, cors);
      if (url.pathname === '/v1/tiendas')  return json({ tiendas:Object.keys(ADAPTADORES) }, cors);
      if (url.pathname.startsWith('/v1/salud/')) return salud(url.pathname.split('/').pop(), env, cors);
      if (url.pathname === '/v1/buscar')   return buscar(url, env, ctx, cors);
      if (url.pathname === '/v1/resolver') return resolver(url, env, ctx, cors);
      if (url.pathname === '/v1/asesor')   return await asesor(req, env, cors);
      if (url.pathname.startsWith('/v1/solicitudes')) return await solicitudes(req, url, env, cors);
      if (url.pathname === '/v1/arancel.zip') return await arancelZip(cors);
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
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'accept,content-type,x-niju-admin,x-niju-proveedor,authorization',
    'Cache-Control': `public, max-age=${TTL}`
  };
}

/* La copia guardada en caché trae los encabezados CORS de quien la pidió primero
   (se vio /v1/buscar respondiendo "http://localhost:8771" a la app publicada, que
   entonces no veía nada). Al devolverla se ponen los de ESTE pedido. */
function desdeCache(hit, cors){
  const r = new Response(hit.body, hit);
  for (const [k, v] of Object.entries(cors)) if (/^access-control-/i.test(k)) r.headers.set(k, v);
  return r;
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
  if (hit) return desdeCache(hit, cors);

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
  if (!env.ADMIN_TOKEN) return false;     // sin clave cargada en Cloudflare, nadie es dueño
  return igualSeguro(req.headers.get('x-niju-admin') || '', env.ADMIN_TOKEN);
}

/* Compara sin cortar en la primera letra distinta, para que el tiempo
   de respuesta no dé pistas sobre la clave. */
function igualSeguro(a, b){
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/* La puerta del dueño en la app pregunta acá antes de abrir el Panel.
   Nunca se guarda en caché: cada intento se responde en el momento. */
function verificarAdmin(req, env, cors){
  const headers = { ...cors, 'Cache-Control':'no-store', 'content-type':'application/json; charset=utf-8' };
  if (!env.ADMIN_TOKEN){
    return new Response(JSON.stringify({ ok:false, error:'falta cargar ADMIN_TOKEN en Cloudflare' }), { status:503, headers });
  }
  const ok = esDueno(req, env);
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 403, headers });
}

/* ============================================================
   ESTADO — qué tiene encendido el servidor
   La app lo pregunta al arrancar. Si no hay base de datos lo dice
   con todas las letras, en vez de hacer como que guardó un pedido.
   ============================================================ */
const sinCache = cors => ({ ...cors, 'Cache-Control':'no-store' });
const secretoSesion = env => env.SESION_SECRETO || env.ADMIN_TOKEN || '';

function estadoServidor(env, cors){
  return json({
    ok:true, version:3, promos:true,
    base: !!env.NIJU,
    asesor: !!env.ANTHROPIC_API_KEY,
    cuentas: !!(env.NIJU && secretoSesion(env)),
    emails: !!(env.RESEND_API_KEY && env.AVISOS_DESDE)
  }, sinCache(cors));
}

/* ---------- utilidades de KV y de cifrado ---------- */
async function leerKV(env, clave){
  const t = await env.NIJU.get(clave);
  return t ? JSON.parse(t) : null;
}
const grabarKV = (env, clave, valor, opciones) => env.NIJU.put(clave, JSON.stringify(valor), opciones);

async function clavesKV(env, prefijo){
  const out = [];
  let cursor;
  do{
    const r = await env.NIJU.list({ prefix:prefijo, cursor });
    out.push(...r.keys.map(k => k.name));
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}

const bytes = s => new TextEncoder().encode(s);
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const desdeB64u = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

/* ============================================================
   CUENTAS DE CLIENTES
   Para comprar hay que tener cuenta con datos de filiación y
   fiscales: NiJu compra a nombre del cliente, la tienda factura y
   despacha con esos datos, y ARCA los pide.
   La clave NUNCA se guarda: se guarda un derivado PBKDF2 con sal
   propia. La sesión es un token firmado con HMAC que vence a los
   30 días. Ocho intentos fallidos traban el email 15 minutos.
   ============================================================ */
const DIAS_SESION = 30;

async function derivarClave(clave, sal){
  const base = await crypto.subtle.importKey('raw', bytes(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:bytes(sal), iterations:100000 }, base, 256);
  return b64u(bits);
}

async function firmar(datos, env){
  const k = await crypto.subtle.importKey('raw', bytes(secretoSesion(env)), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', k, bytes(datos)));
}

async function emitirToken(email, env){
  const cuerpo = b64u(bytes(JSON.stringify({ e:email, v:Date.now() + DIAS_SESION * 864e5 })));
  return cuerpo + '.' + await firmar(cuerpo, env);
}

async function clienteDe(req, env){
  const h = req.headers.get('authorization') || '';
  const [cuerpo, firma] = (h.startsWith('Bearer ') ? h.slice(7) : '').split('.');
  if (!cuerpo || !firma || !secretoSesion(env)) return null;
  if (!igualSeguro(firma, await firmar(cuerpo, env))) return null;
  let d;
  try{ d = JSON.parse(desdeB64u(cuerpo)); }catch{ return null; }
  if (!d.e || Date.now() > d.v) return null;
  return leerKV(env, 'cliente:' + d.e);
}

function cuitValido(c){
  const s = String(c || '').replace(/\D/g, '');
  if (s.length !== 11) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((a, p, i) => a + p * +s[i], 0);
  let v = 11 - (suma % 11);
  if (v === 11) v = 0;
  return v !== 10 && v === +s[10];
}

function edad(f){
  const n = new Date(f + 'T00:00:00Z');
  if (isNaN(n)) return 0;
  const h = new Date();
  let a = h.getUTCFullYear() - n.getUTCFullYear();
  if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) a--;
  return a;
}

function limpiarPerfil(p = {}, email){
  const s = (v, n = 120) => String(v ?? '').trim().slice(0, n);
  const d = p.domicilio || {};
  return {
    nombre:s(p.nombre, 60), apellido:s(p.apellido, 60), dni:s(p.dni, 12).replace(/\D/g, ''),
    fechaNac:s(p.fechaNac, 10), telefono:s(p.telefono, 30), email,
    cuit:s(p.cuit, 13).replace(/\D/g, ''), perfilFiscal:s(p.perfilFiscal, 30), razonSocial:s(p.razonSocial, 120),
    domicilio:{ calle:s(d.calle, 80), numero:s(d.numero, 10), piso:s(d.piso, 20), localidad:s(d.localidad, 60),
                provincia:s(d.provincia, 60), cp:s(d.cp, 10).toUpperCase(), referencias:s(d.referencias, 200) },
    canales: Array.isArray(p.canales) ? p.canales.filter(x => typeof x === 'string').slice(0, 5) : ['email'],
    aceptaTerminos: p.aceptaTerminos ? (Number(p.aceptaTerminos) || Date.now()) : null,
    aceptaMarketing: !!p.aceptaMarketing
  };
}

function problemasPerfil(p){
  const f = [];
  const vacio = v => !String(v ?? '').trim();
  const d = p?.domicilio || {};
  if (vacio(p?.nombre)) f.push('nombre');
  if (vacio(p?.apellido)) f.push('apellido');
  if (!/^\d{7,8}$/.test(String(p?.dni || ''))) f.push('DNI');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p?.fechaNac || ''))) f.push('fecha de nacimiento');
  else if (edad(p.fechaNac) < 18) f.push('ser mayor de 18 años');
  if (String(p?.telefono || '').replace(/\D/g, '').length < 8) f.push('teléfono');
  if (!cuitValido(p?.cuit)) f.push('CUIT/CUIL válido');
  if (vacio(p?.perfilFiscal)) f.push('condición ante ARCA');
  for (const [k, n] of [['calle','calle'], ['numero','número'], ['localidad','localidad'], ['provincia','provincia']])
    if (vacio(d[k])) f.push(n);
  if (!/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/.test(String(d.cp || ''))) f.push('código postal');
  if (!p?.aceptaTerminos) f.push('aceptar los términos');
  return f;
}

async function rutaClientes(req, url, env, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU' }, h, 501);
  if (!secretoSesion(env)) return json({ error:'falta cargar SESION_SECRETO (o ADMIN_TOKEN) en Cloudflare' }, h, 501);
  const accion = url.pathname.split('/').filter(Boolean)[2];      // registro | entrar | yo
  const cuerpo = req.method === 'GET' ? {} : await req.json().catch(() => ({}));
  const email = String(cuerpo.email || '').trim().toLowerCase().slice(0, 120);

  if (accion === 'registro' && req.method === 'POST'){
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error:'El email no es válido.' }, h, 400);
    if (String(cuerpo.clave || '').length < 8) return json({ error:'La clave tiene que tener al menos 8 caracteres.' }, h, 400);
    if (await env.NIJU.get('cliente:' + email)) return json({ error:'Ya hay una cuenta con ese email. Entrá con tu clave.' }, h, 409);
    const perfil = limpiarPerfil(cuerpo.perfil, email);
    const faltan = problemasPerfil(perfil);
    if (faltan.length) return json({ error:'Faltan datos: ' + faltan.join(', ') + '.', faltan }, h, 400);
    const sal = crypto.randomUUID();
    await grabarKV(env, 'cliente:' + email, { email, perfil, sal, hash:await derivarClave(cuerpo.clave, sal), creado:Date.now() });
    return json({ ok:true, token:await emitirToken(email, env), perfil }, h);
  }

  if (accion === 'entrar' && req.method === 'POST'){
    const claveIntentos = 'intentos:' + email;
    const intentos = +(await env.NIJU.get(claveIntentos) || 0);
    if (intentos >= 8) return json({ error:'Demasiados intentos. Probá de nuevo en 15 minutos.' }, h, 429);
    const c = await leerKV(env, 'cliente:' + email);
    const ok = c && igualSeguro(await derivarClave(String(cuerpo.clave || ''), c.sal), c.hash);
    if (!ok){
      await env.NIJU.put(claveIntentos, String(intentos + 1), { expirationTtl:900 });
      return json({ error:'Email o clave incorrectos.' }, h, 403);
    }
    if (intentos) await env.NIJU.delete(claveIntentos);
    return json({ ok:true, token:await emitirToken(email, env), perfil:c.perfil }, h);
  }

  if (accion === 'yo'){
    const c = await clienteDe(req, env);
    if (!c) return json({ error:'La sesión venció. Volvé a entrar.' }, h, 401);
    if (req.method === 'GET') return json({ ok:true, perfil:c.perfil }, h);
    if (req.method === 'PUT'){
      const perfil = limpiarPerfil({ ...c.perfil, ...(cuerpo.perfil || {}) }, c.email);
      const faltan = problemasPerfil(perfil);
      if (faltan.length) return json({ error:'Faltan datos: ' + faltan.join(', ') + '.', faltan }, h, 400);
      await grabarKV(env, 'cliente:' + c.email, { ...c, perfil });
      return json({ ok:true, perfil }, h);
    }
  }
  return json({ error:'ruta desconocida' }, h, 404);
}

/* ============================================================
   ÓRDENES — la base de datos de las compras
   Tiene que vivir acá: si queda en el navegador del cliente, el
   dueño no la ve; si queda en el del dueño, el cliente no puede
   seguir su pedido.
   Claves: orden:<id> · cliord:<email> (índice del cliente)
   ============================================================ */
const TEXTO_RESPUESTA = {
  acepto:'El cliente aceptó el cambio',
  cancelo:'El cliente pidió cancelar',
  arrepentimiento:'El cliente usó el botón de arrepentimiento',
  consulta:'Consulta del cliente'
};

function puedeArrepentirse(o){
  if (o.estado === 'cancelada') return false;
  const entrega = (o.historia || []).filter(x => x.estado === 'entregada').at(-1)?.ts || 0;
  return Date.now() - Math.max(o.creada, entrega) <= 10 * 864e5;
}

/* Une dos listas por una clave. Lo nuevo pisa a lo viejo, pero nada
   de lo viejo se pierde: el dueño puede estar guardando una copia que
   todavía no tiene lo último que respondió el cliente. */
function unir(viejos = [], nuevos = [], clave){
  const m = new Map();
  for (const x of viejos) m.set(clave(x), x);
  for (const x of nuevos) m.set(clave(x), { ...m.get(clave(x)), ...x });
  return [...m.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

/* Crea un pedido de compra "pendiente de pago" a nombre del cliente.
   La usan el carrito (/v1/ordenes) y "Pedí y que compitan" al aceptar una oferta. */
async function nuevaOrden(env, ctx, cliente, o, nota = 'Pedido recibido. Falta acreditar el pago.'){
  const p = cliente.perfil;
  const ahora = Date.now();
  const orden = {
    ...o,
    id:'OR-' + ahora.toString(36).toUpperCase() + '-' + crypto.randomUUID().slice(0, 4).toUpperCase(),
    creada:ahora,
    cliente:{ email:cliente.email, nombre:`${p.nombre} ${p.apellido}`.trim(), dni:p.dni, cuit:p.cuit,
              telefono:p.telefono, perfilFiscal:p.perfilFiscal, razonSocial:p.razonSocial || null },
    direccion:{ ...p.domicilio },
    estado:'pendiente_pago',
    historia:[{ ts:ahora, estado:'pendiente_pago', nota }],
    avisos:[], respuestas:[]
  };
  await grabarKV(env, 'orden:' + orden.id, orden);
  const indice = (await leerKV(env, 'cliord:' + cliente.email)) || [];
  await grabarKV(env, 'cliord:' + cliente.email, [...indice, orden.id]);
  avisarPorEmail(env, ctx, orden, [{ titulo:'Recibimos tu pedido ' + orden.id,
    texto:'Te contactamos para coordinar el pago. Apenas se acredite, salimos a comprar.' }]);
  return orden;
}

async function rutaOrdenes(req, url, env, ctx, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU' }, h, 501);
  const [, , id, accion] = url.pathname.split('/').filter(Boolean);
  const dueno = esDueno(req, env);
  const cliente = dueno ? null : await clienteDe(req, env);
  if (!dueno && !cliente) return json({ error:'Entrá con tu cuenta para ver tus compras.' }, h, 401);

  if (req.method === 'GET' && !id){
    const claves = dueno ? await clavesKV(env, 'orden:')
                         : ((await leerKV(env, 'cliord:' + cliente.email)) || []).map(x => 'orden:' + x);
    const os = (await Promise.all(claves.map(k => leerKV(env, k)))).filter(Boolean);
    return json({ ordenes:os.sort((a, b) => b.creada - a.creada) }, h);
  }

  if (req.method === 'POST' && !id){
    if (!cliente) return json({ error:'La orden la crea el cliente desde su cuenta.' }, h, 403);
    const faltan = problemasPerfil(cliente.perfil);
    if (faltan.length) return json({ error:'Completá tus datos antes de comprar: ' + faltan.join(', ') + '.' }, h, 400);
    const o = (await req.json().catch(() => ({}))).orden || {};
    if (!Array.isArray(o.tramos) || !o.tramos.length || o.tramos.length > 30)
      return json({ error:'La orden no tiene productos.' }, h, 400);
    const orden = await nuevaOrden(env, ctx, cliente, o);
    return json({ ok:true, orden }, h);
  }

  const o = id ? await leerKV(env, 'orden:' + id) : null;
  if (!o || (!dueno && o.cliente?.email !== cliente.email)) return json({ error:'orden inexistente' }, h, 404);

  if (req.method === 'GET') return json({ ok:true, orden:o }, h);

  if (req.method === 'PUT'){
    if (!dueno) return json({ error:'no autorizado' }, h, 403);
    const nueva = (await req.json().catch(() => ({}))).orden || {};
    /* Lo que identifica la orden y al cliente no se reescribe desde afuera,
       y lo que dijo o leyó el cliente tampoco se pisa. */
    const avisos = unir(o.avisos, nueva.avisos, a => a.id).map(a =>
      ({ ...a, leido: a.leido || !!(o.avisos || []).find(b => b.id === a.id)?.leido }));
    const guardada = { ...nueva, id:o.id, creada:o.creada, cliente:o.cliente, avisos,
      historia:unir(o.historia, nueva.historia, x => x.ts + '|' + x.nota),
      respuestas:unir(o.respuestas, nueva.respuestas, x => x.ts + '|' + x.tipo) };
    const nuevos = avisos.filter(a => !(o.avisos || []).some(b => b.id === a.id));
    await grabarKV(env, 'orden:' + o.id, guardada);
    if (nuevos.length) avisarPorEmail(env, ctx, guardada, nuevos);
    return json({ ok:true, orden:guardada }, h);
  }

  if (req.method === 'POST' && accion === 'responder'){
    if (!cliente) return json({ error:'solo responde el cliente' }, h, 403);
    const { tipo, nota, lineaId } = await req.json().catch(() => ({}));
    if (tipo === 'leido'){
      o.avisos = (o.avisos || []).map(a => ({ ...a, leido:true }));
    } else if (TEXTO_RESPUESTA[tipo]){
      if (tipo === 'arrepentimiento' && !puedeArrepentirse(o))
        return json({ error:'El plazo de 10 días para arrepentirte ya pasó.' }, h, 400);
      const texto = String(nota || '').slice(0, 500);
      const ts = Date.now();
      o.respuestas = [...(o.respuestas || []), { ts, tipo, lineaId:lineaId || null, nota:texto, atendida:false }];
      o.historia = [...(o.historia || []), { ts, estado:o.estado, de:'cliente', nota:TEXTO_RESPUESTA[tipo] + (texto ? ': ' + texto.slice(0, 200) : '.') }];
    } else return json({ error:'respuesta desconocida' }, h, 400);
    await grabarKV(env, 'orden:' + o.id, o);
    return json({ ok:true, orden:o }, h);
  }
  return json({ error:'método no permitido' }, h, 405);
}

/* Compras hechas en cada tienda: un lote puede juntar productos de
   varios clientes. Solo las ve y las toca el dueño. */
async function rutaLotes(req, url, env, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU' }, h, 501);
  if (!esDueno(req, env)) return json({ error:'no autorizado' }, h, 403);
  const id = url.pathname.split('/').filter(Boolean)[2];
  if (req.method === 'GET'){
    const ls = (await Promise.all((await clavesKV(env, 'lote:')).map(k => leerKV(env, k)))).filter(Boolean);
    return json({ lotes:ls.sort((a, b) => b.creado - a.creado) }, h);
  }
  if (req.method === 'PUT' && id){
    const lote = (await req.json().catch(() => ({}))).lote;
    if (!lote || lote.id !== id) return json({ error:'lote inválido' }, h, 400);
    await grabarKV(env, 'lote:' + id, lote);
    return json({ ok:true, lote }, h);
  }
  return json({ error:'método no permitido' }, h, 405);
}

/* Aviso por email. Solo si se cargó RESEND_API_KEY y AVISOS_DESDE
   (un remitente de un dominio verificado en resend.com). Sin eso, el
   cliente igual ve cada novedad dentro de la app. */
function avisarPorEmail(env, ctx, orden, avisos){
  const para = orden.cliente?.email;
  if (!env.RESEND_API_KEY || !env.AVISOS_DESDE || !para || !avisos.length) return;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const bloques = avisos.map(a => {
    const u = /^https?:\/\//i.test(a.seguimiento?.url || '') ? a.seguimiento.url : '';
    return `<h3 style="margin:0 0 4px">${esc(a.titulo)}</h3><p style="margin:0 0 14px">${esc(a.texto)}</p>` +
           (u ? `<p style="margin:0 0 14px"><a href="${esc(u)}">Seguir el envío</a></p>` : '');
  }).join('');
  const pie = `Pedido ${esc(orden.id)} · NiJu` + (env.APP_URL ? ` · <a href="${esc(env.APP_URL)}#/compras">Ver mis compras</a>` : '');
  ctx.waitUntil(fetch('https://api.resend.com/emails', {
    method:'POST',
    headers:{ Authorization:'Bearer ' + env.RESEND_API_KEY, 'content-type':'application/json' },
    body:JSON.stringify({
      from:env.AVISOS_DESDE, to:[para],
      subject: avisos.length === 1 ? avisos[0].titulo : `Novedades de tu pedido ${orden.id}`,
      html:`<div style="font-family:Arial,sans-serif;font-size:15px;color:#333">${bloques}<p style="color:#999;font-size:12px">${pie}</p></div>`
    })
  }).catch(() => {}));
}

/* ============================================================
   VARIANTES — talles, colores y medidas
   La ropa y el calzado no se pueden comprar sin elegir el talle, y
   cada talle tiene su propio stock (y a veces su propio precio).
   Leemos lo mismo que muestra la ficha de la tienda:
     · VTEX    → items del producto, con stock por talle
     · Shopify → /products/<handle>.js, con disponibilidad por variante
     · Woo     → variaciones del producto (sin stock por variación)
   Devolvemos también el código de cada variante (sku): con eso el
   dueño abre el carrito de la tienda ya cargado con todo junto.
   ============================================================ */
async function variantes(url, env, ctx, cors){
  const tienda = url.searchParams.get('tienda');
  const a = ADAPTADORES[tienda];
  if (!a) return json({ error:`tienda desconocida: ${tienda}` }, cors, 400);
  if (!a.variantes) return json({ tienda, soportado:false, opciones:[], skus:[] }, cors);

  const crudo = String(url.searchParams.get('id') || '');
  const id = crudo.startsWith(tienda + '-') ? crudo.slice(tienda.length + 1) : crudo;
  const enlace = url.searchParams.get('url') || '';
  const clave = new Request(`https://cache.niju/variantes/${tienda}?id=${encodeURIComponent(id)}&u=${encodeURIComponent(enlace)}`);
  /* La simulación de compra pide "fresco": precio y stock de este momento. */
  if (!url.searchParams.get('fresco')){
    const hit = await caches.default.match(clave);
    if (hit) return desdeCache(hit, cors);
  }
  try{
    const d = await a.variantes({ id, url:enlace });
    const res = json({ tienda, plataforma:a.plataforma, host:a.host, soportado:true, leido:Date.now(),
                       skus:d.skus, opciones:sinRedundantes(d.opciones, d.skus) },
                     { ...cors, 'Cache-Control':'public, max-age=120' });
    ctx.waitUntil(caches.default.put(clave, res.clone()));
    return res;
  }catch(e){
    return json({ tienda, soportado:true, error:String(e.message || e), opciones:[], skus:[] }, sinCache(cors));
  }
}

/* Decathlon publica "Model Code" además de "Color": son la misma
   elección con dos nombres (cada código es un color). Mostrar las dos
   confunde, así que se saca la del código. */
function sinRedundantes(opciones = [], skus = []){
  const determina = (a, b) => {
    const m = new Map();
    for (const s of skus){
      const x = s.valores?.[a], y = s.valores?.[b];
      if (m.has(x) && m.get(x) !== y) return false;
      m.set(x, y);
    }
    return true;
  };
  return opciones.filter(o => {
    if (/^title$/i.test(o.nombre) || (o.valores.length === 1 && /default title/i.test(o.valores[0]))) return false;
    if (!/code|c[oó]digo|sku|\bref/i.test(o.nombre)) return true;
    return !opciones.some(y => y !== o && determina(o.nombre, y.nombre) && determina(y.nombre, o.nombre));
  });
}

const CABECERAS_CATALOGO = { accept:'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' };

async function variantesVtex(host, id){
  const d = await pedir(`https://${host}/api/catalog_system/pub/products/search?fq=productId:${encodeURIComponent(id)}`, { headers:CABECERAS_CATALOGO });
  const p = (d || [])[0];
  if (!p) throw new Error('la tienda ya no publica ese producto');
  const ordenTienda = {};
  for (const e of (p.skuSpecifications || [])) ordenTienda[e.field?.name] = (e.values || []).map(v => v.name);
  const nombres = [];
  const skus = (p.items || []).map(it => {
    const vend = it.sellers?.find(s => s.commertialOffer?.IsAvailable) || it.sellers?.[0];
    const co = vend?.commertialOffer || {};
    const valores = {};
    for (const k of (it.variations || [])){
      const v = [].concat(it[k] || [])[0];
      if (v == null) continue;
      valores[k] = String(v);
      if (!nombres.includes(k)) nombres.push(k);
    }
    const stock = Math.max(0, co.AvailableQuantity || 0);
    return { sku:String(it.itemId), seller:vend?.sellerId || '1', valores,
             precio: co.Price > 0 ? co.Price : null, stock,
             disponible: !!co.IsAvailable && stock > 0,
             imagen: it.images?.[0]?.imageUrl || null };
  });
  const opciones = nombres.map(n => {
    const orden = ordenTienda[n] || [];
    const pos = v => { const i = orden.indexOf(v); return i < 0 ? 999 : i; };
    return { nombre:n, valores:[...new Set(skus.map(s => s.valores[n]).filter(Boolean))].sort((a, b) => pos(a) - pos(b)) };
  });
  return { opciones, skus };
}

async function variantesShopify(host, enlace){
  const handle = (String(enlace).match(/\/products\/([^/?#]+)/) || [])[1];
  if (!handle) throw new Error('no vino el link del producto');
  const p = await pedir(`https://${host}/products/${handle}.js`, { headers:CABECERAS_CATALOGO });
  const nombres = (p.options || []).map(o => typeof o === 'string' ? o : o.name);
  const skus = (p.variants || []).map(v => {
    const valores = {};
    nombres.forEach((n, i) => { const x = v['option' + (i + 1)]; if (x != null) valores[n] = String(x); });
    let img = v.featured_image?.src || null;
    if (img && img.startsWith('//')) img = 'https:' + img;
    /* Shopify da el precio en centavos: 6220000 son $62.200 */
    return { sku:String(v.id), seller:null, valores, precio: v.price > 0 ? v.price / 100 : null,
             stock:null, disponible: v.available !== false, imagen:img };
  });
  const opciones = nombres.map((n, i) => ({ nombre:n,
    valores:(p.options[i]?.values || [...new Set(skus.map(s => s.valores[n]))]).map(String) }));
  return { opciones, skus };
}

async function variantesWoo(host, id){
  const p = await pedir(`https://${host}/wp-json/wc/store/products/${encodeURIComponent(id)}`, { headers:CABECERAS_CATALOGO });
  if (p.type !== 'variable'){
    return { opciones:[], skus:[{ sku:String(p.id), seller:null, valores:{}, precio:null, stock:null,
                                  disponible:p.is_in_stock !== false, imagen:null }] };
  }
  const attrs = (p.attributes || []).filter(a => a.has_variations);
  const attr = n => attrs.find(a => a.taxonomy === n || a.name === n);
  const skus = (p.variations || []).map(v => ({
    sku:String(v.id), seller:null, precio:null, stock:null, disponible:null, imagen:null,
    valores:Object.fromEntries((v.attributes || []).map(x => [
      attr(x.name)?.name || x.name,
      (attr(x.name)?.terms || []).find(t => t.slug === x.value)?.name || x.value ]))
  }));
  return { opciones:attrs.map(a => ({ nombre:a.name, valores:(a.terms || []).map(t => t.name) })), skus };
}

/* ============================================================
   PROMOCIONES: campañas por fecha y beneficios por cliente
   Las campañas las calcula la app con el calendario; acá se guarda
   solo lo que decide el dueño (aprobar, frenar, editar) y los
   beneficios que otorgó a cada cliente.
     GET /v1/promos        público: campañas y niveles, sin datos de clientes
     GET /v1/promos/yo     cliente con sesión: solo su beneficio
     GET /v1/promos/todo   dueño: todo
     PUT /v1/promos        dueño: guarda todo
   ============================================================ */
async function promos(req, url, env, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU' }, h, 501);
  const parte = url.pathname.split('/').filter(Boolean)[2] || '';
  const leer = async () => ({ campanias:{}, niveles:null, beneficios:{}, ...((await leerKV(env, 'promos')) || {}) });

  if (req.method === 'GET' && !parte){
    const d = await leer();
    return json({ campanias:d.campanias, niveles:d.niveles }, h);
  }
  if (req.method === 'GET' && parte === 'yo'){
    const cliente = await clienteDe(req, env);
    if (!cliente) return json({ error:'Entrá con tu cuenta.' }, h, 401);
    const d = await leer();
    return json({ beneficio:d.beneficios[cliente.email] || null }, h);
  }

  if (!esDueno(req, env)) return json({ error:'no autorizado' }, h, 403);
  if (req.method === 'GET' && parte === 'todo') return json(await leer(), h);
  if (req.method === 'PUT' && !parte){
    const c = await req.json().catch(() => null);
    if (!c || typeof c !== 'object') return json({ error:'datos inválidos' }, h, 400);
    const d = { campanias:c.campanias || {}, niveles:Array.isArray(c.niveles) ? c.niveles : null,
                beneficios:c.beneficios || {}, actualizado:Date.now() };
    if (JSON.stringify(d).length > 300000) return json({ error:'demasiados datos' }, h, 413);
    await grabarKV(env, 'promos', d);
    return json({ ok:true, ...d }, h);
  }
  return json({ error:'método no permitido' }, h, 405);
}

async function campanias(req, url, env, cors){
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU', campanias:[] }, cors, 501);
  const partes = url.pathname.split('/').filter(Boolean);   // v1, campanias, [id], [accion]
  const id = partes[2], accion = partes[3];

  const leer  = async () => JSON.parse(await env.NIJU.get('campanias') || '[]');
  const grabar = async (cs) => env.NIJU.put('campanias', JSON.stringify(cs));

  /* La clave de cada reserva (con la que se da el OK) y el email nunca salen del servidor. */
  const dueno = esDueno(req, env);
  const publica = c => ({ ...c, reservas:(c.reservas || []).map(({ clave, email, ...r }) => dueno ? { ...r, email } : r) });
  /* Id y clave los genera el dispositivo de quien reserva; si no son válidos, se inventan acá. */
  const idReserva = v => /^[a-z0-9-]{6,40}$/i.test(v || '') ? v : 'r' + crypto.randomUUID().slice(0, 8);
  const claveReserva = v => /^[a-z0-9-]{16,120}$/i.test(v || '') ? v : null;
  const abierta = (c, ahora = Date.now()) => c.estado === 'abierta' && c.cierra > ahora;

  if (req.method === 'GET'){
    const cs = await leer();
    /* Sin caché: con max-age=600 quien abría una campaña no la veía por 10 minutos. */
    return json({ campanias:(id ? cs.filter(c => c.id === id) : cs).map(publica) }, { ...cors, 'cache-control':'no-store' });
  }

  if (req.method === 'POST'){
    const cuerpo = await req.json().catch(() => ({}));
    const cs = await leer();

    if (accion === 'reservar'){
      const i = cs.findIndex(c => c.id === id);
      if (i < 0) return json({ error:'campaña inexistente' }, cors, 404);
      if (!abierta(cs[i])) return json({ error:'Esta compra grupal ya se cerró: no se puede sumar gente.' }, cors, 409);
      const nombre = String(cuerpo.nombre || '').slice(0, 80).trim();
      const cantidad = Math.max(1, Math.min(999, parseInt(cuerpo.cantidad) || 1));
      if (!nombre) return json({ error:'falta el nombre' }, cors, 400);
      cs[i].reservas = cs[i].reservas || [];
      cs[i].reservas.push({
        id: idReserva(cuerpo.id), clave: claveReserva(cuerpo.clave), nombre,
        email: String(cuerpo.email || '').slice(0, 120),
        cantidad, precioAlReservar: cuerpo.precioAlReservar || null,
        sena: cuerpo.sena || 0, ok:false, ts: Date.now()
      });
      await grabar(cs);
      return json({ ok:true, campania: publica(cs[i]) }, cors);
    }

    /* Cada participante da su OK con la clave de su reserva. Si todos (y son al
       menos dos) están de acuerdo, el pedido se cierra antes de los 12 días. */
    if (accion === 'acuerdo'){
      const c = cs.find(x => x.id === id);
      if (!c) return json({ error:'campaña inexistente' }, cors, 404);
      if (!abierta(c)) return json({ error:'Esta compra grupal ya se cerró.' }, cors, 409);
      const r = (c.reservas || []).find(x => x.id === cuerpo.reservaId);
      if (!r || !r.clave || r.clave !== cuerpo.clave) return json({ error:'La clave de la reserva no coincide' }, cors, 403);
      r.ok = true; r.okTs = Date.now();
      if (c.reservas.length >= 2 && c.reservas.every(x => x.ok)){ c.estado = 'acordada'; c.cerradaEn = Date.now(); }
      await grabar(cs);
      return json({ ok:true, campania:publica(c) }, cors);
    }

    /* Un cliente propone una compra grupal desde "Traelo por mí" cuando traerlo
       solo sale caro. Entra con su reserva; si ya hay una abierta del mismo link,
       se suma a esa en vez de duplicarla. Tope: 5 propuestas por IP por día. */
    if (id === 'proponer'){
      const texto = (v, n) => String(v || '').slice(0, n).trim();
      const titulo = texto(cuerpo.titulo, 160);
      const precioBase = Math.round(+cuerpo.precioBase);
      const meta = Math.max(2, Math.min(200, parseInt(cuerpo.meta) || 10));
      const tramos = (Array.isArray(cuerpo.tramos) ? cuerpo.tramos : []).slice(0, 8)
        .map(t => ({ desde:Math.max(1, parseInt(t.desde) || 1), precio:Math.round(+t.precio) || 0, desc:Math.max(0, Math.min(90, parseInt(t.desc) || 0)) }))
        .filter(t => t.precio > 0);
      const r0 = (Array.isArray(cuerpo.reservas) && cuerpo.reservas[0]) || {};
      const nombre = texto(r0.nombre, 80);
      if (!titulo || !(precioBase > 0) || !tramos.length || !nombre) return json({ error:'faltan datos de la compra grupal' }, cors, 400);
      const url = /^https?:\/\//i.test(cuerpo.itemRef || '') ? texto(cuerpo.itemRef, 600) : null;
      const ahora = Date.now();
      const reserva = { id:idReserva(r0.id), clave:claveReserva(r0.clave), nombre, email:texto(r0.email, 120),
        cantidad:Math.max(1, Math.min(999, parseInt(r0.cantidad) || 1)), precioAlReservar:tramos[0].precio, sena:0, ok:false, ts:ahora };
      const existente = url && cs.find(c => c.itemRef === url && abierta(c, ahora));
      if (existente){
        existente.reservas = existente.reservas || [];
        existente.reservas.push(reserva);
        await grabar(cs);
        return json({ ok:true, campania:publica(existente), existente:true }, cors);
      }
      const limite = `limite-camp:${new Date().toISOString().slice(0, 10)}:${req.headers.get('cf-connecting-ip') || 'sin-ip'}`;
      const usadas = +(await env.NIJU.get(limite) || 0);
      if (usadas >= 5) return json({ error:'Llegaste al límite de compras grupales propuestas de hoy. Probá mañana.' }, cors, 429);
      await env.NIJU.put(limite, String(usadas + 1), { expirationTtl:90000 });
      const c = { id:'cg-' + crypto.randomUUID().slice(0, 8), tipo:'grupal', origen:'cliente', titulo,
        imagen:/^https:\/\//i.test(cuerpo.imagen || '') ? texto(cuerpo.imagen, 600) : null, itemRef:url, familiaId:null,
        precioBase, meta, tramos, creada:ahora, cierra:ahora + 12 * 864e5, estado:'abierta', notas:texto(cuerpo.notas, 400), reservas:[reserva] };
      cs.push(c);
      await grabar(cs);
      return json({ ok:true, campania:c }, cors);
    }

    // crear una campaña desde el Panel es cosa del dueño
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
/* ============================================================
   "PEDÍ Y QUE COMPITAN" — bolsa de demanda
   · Publica solo un cliente con cuenta: el pedido queda atado a su email.
   · Ofertan solo proveedores aprobados por el dueño (con su código) y NiJu.
   · Cada oferta le deja un aviso al cliente (campanita).
   · El cliente acepta una oferta y se crea su pedido de compra.
   · Sin seña: no se muestra lo que todavía no se puede cobrar.
   KV: 'demanda' (pedidos) y 'proveedores' (aprobados, código con HMAC).
   ============================================================ */
const MAX_PEDIDOS = 500;
const COMISION_PARTICULAR = 0.04;     // la cobra NiJu al que vende sin ser proveedor. Mismo valor en js/engine/demanda.js
const ESTADOS_PRODUCTO = ['nuevo', 'usado', 'reacondicionado'];
const ofertaPublica = ({ id, proveedor, precio, cantidad, plazoDias, notas, ts, tipo, estadoProducto, condicion, foto }) =>
  ({ id, proveedor, precio, cantidad, plazoDias, notas, ts, tipo:tipo || 'proveedor',
     estadoProducto:estadoProducto || null, condicion:condicion || '', foto:!!foto });

const pedidoPublico = o => ({
  id:o.id, titulo:o.titulo, detalle:o.detalle || '', rubro:o.rubro || null, imagen:o.imagen || null,
  precioMax:o.precioMax, cantidad:o.cantidad, autor:o.autor || 'Cliente', creada:o.creada, vence:o.vence,
  estado:o.estado || 'abierta',
  ofertas:(o.ofertas || []).map(ofertaPublica)
});

async function demanda(req, url, env, ctx, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU', pedidos:[] }, h, 501);
  try{
    const [, , id, accion, sub] = url.pathname.split('/').filter(Boolean);
    const dueno = esDueno(req, env);
    const texto = (v, n) => String(v ?? '').trim().slice(0, n);
    const cuerpo = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const leer = async () => (await leerKV(env, 'demanda')) || [];
    const grabar = os => grabarKV(env, 'demanda', os.slice(-MAX_PEDIDOS));
    const abierta = o => (o.estado || 'abierta') === 'abierta' && o.vence > Date.now();

    const proveedorDe = async () => {
      const codigo = texto(req.headers.get('x-niju-proveedor'), 40).toUpperCase();
      if (!codigo || !secretoSesion(env)) return null;
      const hash = await firmar('proveedor:' + codigo, env);
      return ((await leerKV(env, 'proveedores')) || []).find(p => p.activo && igualSeguro(p.hash, hash)) || null;
    };

    /* ---- Proveedores (solo el dueño) ---- */
    if (id === 'proveedores'){
      if (!dueno) return json({ error:'no autorizado' }, h, 403);
      if (!secretoSesion(env)) return json({ error:'falta cargar SESION_SECRETO en Cloudflare' }, h, 503);
      const provs = (await leerKV(env, 'proveedores')) || [];
      if (req.method === 'GET') return json({ proveedores:provs.map(({ hash, ...p }) => p) }, h);
      if (req.method === 'POST' && !accion){
        const nombre = texto(cuerpo.nombre, 80);
        if (!nombre) return json({ error:'Poné el nombre del proveedor.' }, h, 400);
        const codigo = 'P-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
        const p = { id:'pv-' + crypto.randomUUID().slice(0, 8), nombre, contacto:texto(cuerpo.contacto, 120),
                    activo:true, creado:Date.now(), hash:await firmar('proveedor:' + codigo, env) };
        await grabarKV(env, 'proveedores', [...provs, p]);
        const { hash, ...publico } = p;
        return json({ ok:true, proveedor:publico, codigo }, h);
      }
      if (req.method === 'POST' && sub === 'baja'){
        const p = provs.find(x => x.id === accion);
        if (!p) return json({ error:'proveedor inexistente' }, h, 404);
        p.activo = false; p.baja = Date.now();
        await grabarKV(env, 'proveedores', provs);
        return json({ ok:true }, h);
      }
      return json({ error:'método no permitido' }, h, 405);
    }

    if (id === 'proveedor' && req.method === 'GET'){
      const p = await proveedorDe();
      return p ? json({ ok:true, nombre:p.nombre }, h)
               : json({ error:'Ese código de proveedor no es válido o fue dado de baja.' }, h, 403);
    }

    /* ---- Mis pedidos ---- */
    if (id === 'mias' && req.method === 'GET'){
      const cliente = await clienteDe(req, env);
      if (!cliente) return json({ error:'Entrá con tu cuenta para ver tus pedidos.' }, h, 401);
      const os = (await leer()).filter(o => o.clienteEmail === cliente.email).sort((a, b) => b.creada - a.creada);
      return json({ pedidos:os.map(o => ({ ...pedidoPublico(o), avisos:o.avisos || [],
        ofertaAceptada:o.ofertaAceptada || null, ordenId:o.ordenId || null })) }, h);
    }

/* ---- Foto de una oferta ---- */
    if (id === 'foto' && req.method === 'GET'){
      const guardada = await env.NIJU.get('foto:' + texto(accion, 20));
      const m = guardada && guardada.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!m) return json({ error:'foto inexistente' }, h, 404);
      const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      return new Response(bin, { headers:{ ...cors, 'content-type':m[1], 'Cache-Control':'public, max-age=86400' } });
    }

    /* ---- Mis ofertas como vendedor ---- */
    if (id === 'mis-ofertas' && req.method === 'GET'){
      const cliente = await clienteDe(req, env);
      if (!cliente) return json({ error:'Entrá con tu cuenta para ver tus ofertas.' }, h, 401);
      const ahora = Date.now();
      const ofertas = (await leer()).flatMap(o => (o.ofertas || [])
        .filter(of => of.vendedorEmail === cliente.email)
        .map(of => ({
          ...ofertaPublica(of), pedidoId:o.id, titulo:o.titulo, cantidad:Math.min(of.cantidad, o.cantidad), comisionPct:of.comisionPct,
          estado: o.ofertaAceptada === of.id ? 'aceptada' : o.estado === 'adjudicada' ? 'otra'
                : o.estado === 'cerrada' ? 'cerrada' : o.vence <= ahora ? 'vencida' : 'abierta',
          ordenId: o.ofertaAceptada === of.id ? o.ordenId : null
        }))).sort((a, b) => b.ts - a.ts);
      return json({ ofertas }, h);
    }

    /* ---- Listado ---- */
    if (req.method === 'GET'){
      const os = await leer();
      const lista = dueno ? os : os.map(pedidoPublico);
      return json({ pedidos:id ? lista.filter(o => o.id === id) : lista }, h);
    }

    if (req.method !== 'POST') return json({ error:'método no permitido' }, h, 405);

    /* ---- Publicar ---- */
    if (!id){
      const cliente = await clienteDe(req, env);
      if (!cliente) return json({ error:'Para publicar un pedido entrá con tu cuenta: así te avisamos cuando llegan ofertas.' }, h, 401);
      const titulo = texto(cuerpo.titulo, 140);
      const precioMax = Math.round(+cuerpo.precioMax || 0);
      if (!titulo) return json({ error:'Decinos qué buscás.' }, h, 400);
      if (precioMax <= 0) return json({ error:'Poné hasta cuánto pagás por unidad.' }, h, 400);
      const dias = Math.min(60, Math.max(1, parseInt(cuerpo.dias) || 12));
      const o = {
        id:'od-' + crypto.randomUUID().slice(0, 8), titulo, detalle:texto(cuerpo.detalle, 600), rubro:texto(cuerpo.rubro, 30) || null,
        precioMax, cantidad:Math.min(1000, Math.max(1, parseInt(cuerpo.cantidad) || 1)),
        autor:texto(cliente.perfil?.nombre, 60) || 'Cliente', clienteEmail:cliente.email,
        creada:Date.now(), vence:Date.now() + dias * 864e5, estado:'abierta', ofertas:[], avisos:[]
      };
      const os = await leer();
      os.push(o);
      await grabar(os);
      return json({ ok:true, pedido:pedidoPublico(o) }, h);
    }

    const os = await leer();
    const o = os.find(x => x.id === id);
    if (!o) return json({ error:'Ese pedido no existe.' }, h, 404);

    /* ---- Ofertar ----
       Ofertan NiJu (el dueño), los proveedores aprobados (con su código) y cualquier
       cliente con la cuenta completa: un particular, un emprendedor o un negocio que lo
       tiene o sabe dónde conseguirlo más barato. Al que no es proveedor se le pide foto
       real, estado del producto y compromiso de envío, y NiJu le cobra una comisión. */
    if (accion === 'ofertar'){
      let prov = dueno ? { id:'niju', nombre:'NiJu', tipo:'niju' } : await proveedorDe();
      if (prov && !prov.tipo) prov = { id:prov.id, nombre:prov.nombre, tipo:'proveedor' };
      let vendedor = null;
      if (!prov){
        vendedor = await clienteDe(req, env);
        if (!vendedor) return json({ error:'Para ofertar entrá con tu cuenta (o con tu código de proveedor).' }, h, 401);
        const faltan = problemasPerfil(vendedor.perfil);
        if (faltan.length) return json({ error:'Completá tus datos antes de vender: ' + faltan.join(', ') + '.' }, h, 400);
        const ap = String(vendedor.perfil.apellido || '').trim();
        prov = { id:'cli-' + (await firmar('vendedor:' + vendedor.email, env)).slice(0, 10),
                 nombre:`${vendedor.perfil.nombre}${ap ? ' ' + ap[0] + '.' : ''}`, tipo:'particular' };
      }
      const precio = Math.round(+cuerpo.precio || 0);
      if (precio <= 0) return json({ error:'Poné tu precio por unidad.' }, h, 400);
      const estadoProducto = ESTADOS_PRODUCTO.includes(cuerpo.estadoProducto) ? cuerpo.estadoProducto : null;
      const foto = String(cuerpo.foto || '');
      if (vendedor){
        if (!estadoProducto) return json({ error:'Decinos si es nuevo, usado o reacondicionado.' }, h, 400);
        if (foto.length > 600000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(foto))
          return json({ error:'Subí una foto real del producto (JPG, PNG o WebP, hasta 450 KB).' }, h, 400);
        if (!cuerpo.compromisoEnvio) return json({ error:'Tenés que comprometerte a enviarlo a cada comprador.' }, h, 400);
      }
      const ids = [...new Set([id, ...(Array.isArray(cuerpo.ids) ? cuerpo.ids.slice(0, 50).map(x => texto(x, 20)) : [])])];
      const oferta = { id:crypto.randomUUID().slice(0, 8), proveedorId:prov.id, proveedor:prov.nombre, tipo:prov.tipo, precio,
        cantidad:Math.max(1, parseInt(cuerpo.cantidad) || 1), plazoDias:Math.max(0, parseInt(cuerpo.plazoDias) || 0) || null,
        notas:texto(cuerpo.notas, 300), estadoProducto, condicion:texto(cuerpo.condicion, 300), foto:!!vendedor, ts:Date.now(),
        comisionPct:vendedor ? COMISION_PARTICULAR : null, vendedorEmail:vendedor ? vendedor.email : null };
      let ofertados = 0;
      for (const x of os){
        if (!ids.includes(x.id) || !abierta(x)) continue;
        if (vendedor && x.clienteEmail === vendedor.email) continue;        // nadie se oferta a sí mismo
        x.ofertas = [...(x.ofertas || []), oferta];
        x.avisos = [...(x.avisos || []), { id:'a-' + crypto.randomUUID().slice(0, 8), ts:Date.now(), leido:false,
          titulo:`Nueva oferta por "${x.titulo}"`,
          texto:`${prov.nombre} lo consigue a $ ${precio.toLocaleString('es-AR')} por unidad${oferta.plazoDias ? `, en ${oferta.plazoDias} días` : ''}.` }];
        ofertados++;
      }
      if (!ofertados) return json({ error:'Ese pedido ya no recibe ofertas (o es tuyo).' }, h, 400);
      if (vendedor) await env.NIJU.put('foto:' + oferta.id, foto, { expirationTtl:90 * 86400 });
      await grabar(os);
      return json({ ok:true, ofertados }, h);
    }

    /* ---- Acciones del cliente ---- */
    const cliente = await clienteDe(req, env);
    const esSuyo = !!cliente && o.clienteEmail === cliente.email;

    if (accion === 'leido'){
      if (!esSuyo) return json({ error:'no autorizado' }, h, 403);
      o.avisos = (o.avisos || []).map(a => ({ ...a, leido:true }));
      await grabar(os);
      return json({ ok:true }, h);
    }

    if (accion === 'cerrar'){
      if (!esSuyo && !dueno) return json({ error:'no autorizado' }, h, 403);
      if (abierta(o)){ o.estado = 'cerrada'; o.cerrada = Date.now(); await grabar(os); }
      return json({ ok:true, pedido:pedidoPublico(o) }, h);
    }

    if (accion === 'aceptar'){
      if (!esSuyo) return json({ error:'Solo quien publicó el pedido puede aceptar una oferta.' }, h, 403);
      if (!abierta(o)) return json({ error:'Este pedido ya no está abierto.' }, h, 400);
      const of = (o.ofertas || []).find(x => x.id === texto(cuerpo.ofertaId, 20));
      if (!of) return json({ error:'Esa oferta no existe.' }, h, 404);
      const faltan = problemasPerfil(cliente.perfil);
      if (faltan.length) return json({ error:'Completá tus datos antes de comprar: ' + faltan.join(', ') + '.' }, h, 400);
      const cant = Math.min(o.cantidad, of.cantidad);
      const orden = await nuevaOrden(env, ctx, cliente, {
        modalidad:'directo', entrega:'envio', costoEntrega:0, envioTiendas:0, pago:'transfer', comprobante:null, tolerancia:0.05,
        totalARS:of.precio * cant,
        origen:{ tipo:'demanda', pedidoId:o.id, ofertaId:of.id,
                 vendedor:of.tipo === 'particular' ? { email:of.vendedorEmail, comisionPct:of.comisionPct } : null },
        tramos:[{ id:'t-' + crypto.randomUUID().slice(0, 8), tiendaId:'proveedor-' + of.proveedorId, tienda:of.proveedor,
          tipo:'nacional', propio:of.proveedorId === 'niju', estado:'pendiente', envios:[],
          lineas:[{ id:'l-' + crypto.randomUUID().slice(0, 8), ofertaId:of.id, titulo:o.titulo, cant, precioAcordado:of.precio,
            moneda:'ARS', url:null, imagen:o.imagen || null, variante:null, estado:'pendiente', precioReal:null, loteId:null, nota:of.notas || '' }] }]
      }, `Aceptaste la oferta de ${of.proveedor} en "Pedí y que compitan". Falta acreditar el pago.`);
      o.estado = 'adjudicada'; o.ofertaAceptada = of.id; o.ordenId = orden.id; o.adjudicada = Date.now();
      await grabar(os);
      return json({ ok:true, orden, pedido:pedidoPublico(o) }, h);
    }

    return json({ error:'acción desconocida' }, h, 400);
  }catch(e){
    return json({ error:String(e.message || e) }, h, 500);
  }
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
  [/tiendamia\./i,            'tiendamia',  'Tiendamia',     'USD', 'internacional'],
  [/(^|\.)amazon\./i,         'amazon',     'Amazon',        'USD', 'internacional'],
  [/(^|\.)ebay\./i,           'ebay',       'eBay',          'USD', 'internacional'],
  [/aliexpress\./i,           'aliexpress', 'AliExpress',    'USD', 'internacional'],
  [/alibaba\./i,              'alibaba',    'Alibaba',       'USD', 'internacional'],
  [/made-in-china\./i,        'madeinchina', 'Made-in-China', 'USD', 'internacional'],
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

/* ============================================================
   Asesor de importación — Claude, por HTTP directo
   El worker se pega a mano en el panel de Cloudflare (sin npm),
   así que no puede usar el SDK: se llama a la API con fetch.
   ============================================================ */
const ARANCEL_ZIP = 'https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/archivos/arancel.zip';
const MODELO_ASESOR = 'claude-opus-5';
const CONSULTAS_POR_DIA = 40;           // por IP: el asistente cuesta plata por consulta

async function arancelZip(cors){
  const r = await fetch(ARANCEL_ZIP, { cf:{ cacheTtl:21600, cacheEverything:true } });
  return new Response(r.body, { status:r.status,
    headers:{ ...cors, 'content-type':'application/zip', 'Cache-Control':'public, max-age=21600' } });
}

/* Lo que el asistente puede citar. Es el mismo contenido que
   js/data/normas-importacion.js: si cambia una norma, cambiar los dos. */
const NORMAS_ASESOR = `Normas vigentes consultadas el 14-09-2026:
- Pequeño envío por courier o Correo Argentino (RG 5608; Decreto 604/2026 y RG 5884/2026): hasta 5 envíos por persona por año, hasta 3 unidades de la misma especie, hasta 50 kg por paquete, hasta US$ 3.000 por envío, sin fin comercial. Hasta US$ 400 FOB exento de derecho de importación y tasa de estadística; paga IVA e impuestos internos. Sobre el excedente paga derecho y tasa. Con el cupo anual agotado paga los tributos del régimen general sobre todo el valor. Si no cumple algún límite, va exclusivamente por importación general con despachante.
- Derecho de importación: depende de la posición NCM; sale del Arancel Integrado de ARCA.
- Tasa de estadística: 3% con tope (US$ 180 hasta US$ 10.000 de valor en aduana), prorrogada hasta el 31/12/2027 (Decreto 1140/2024; dato de fuente del sector, confirmar en Boletín Oficial).
- IVA: 21% general, 10,5% reducida (Ley de IVA art. 28), sobre valor en aduana + derecho + tasa.
- Percepción de IVA (RG 2937 art. 7): 20% (10% si el bien va al 10,5%); no aplica a uso o consumo particular de personas humanas ni a bienes de uso.
- Percepción de Ganancias (RG 2281 art. 5): 6% general, 11% si es para uso o consumo particular del importador.
- Percepción de Ingresos Brutos: depende de la provincia; la app no la tiene confirmada.
- Importación general: requiere CUIT, inscripción en el Registro de Importadores y despachante matriculado.
- Honorario de despachante: no hay tarifa oficial; el CDA sugirió en 2016 un mínimo de US$ 200 por operación.`;

const SISTEMA_PREGUNTAS = `Sos el asistente de NiJu, una app argentina que compara precios de tiendas del país y del exterior y hace la compra por el cliente ("compra asistida" y "Traelo por mí", que trae productos de cualquier tienda del mundo). Hablás en castellano rioplatense, de vos, claro y breve: hasta 120 palabras, salvo que te pidan detalle.

Ayudás con: precios, envíos y sus etapas, impuestos y trámites de importación, la condición del cliente ante ARCA y cómo usar la app.

Cómo responder:
- Si te saludan o escriben algo que no es una pregunta, saludá y ofrecé ayuda con dos o tres ejemplos concretos de lo que te pueden preguntar.
- Para los números del caso del cliente usá solo el bloque CONTEXTO. Si un dato no está, decí cuál falta y cómo conseguirlo, sin estimarlo.
- Para normas, usá solo la lista de NORMAS. Si la respuesta depende de una norma que no está ahí, decí que conviene confirmarlo con un despachante o un contador, sin dar una cifra.
- Si piden cómo subvaluar, dividir envíos para esquivar límites o declarar como uso personal algo que es para vender, explicá que no se puede y qué riesgo tiene.
- Si la consulta es sobre un pedido, un pago o un reclamo concreto, pedí que la escriban al equipo desde Mensajes.
- Si la pregunta no tiene que ver con compras, envíos o impuestos, decilo en una frase.
- Nunca digas que vas a averiguar y responder después: respondé ahora con lo que sabés o decí qué falta.

NORMAS
${NORMAS_ASESOR}`;

const SISTEMA_CLASIFICAR = `Sos clasificador arancelario para importaciones a Argentina. Recibís el título y, a veces, la descripción de un producto tal como aparece en una tienda (puede estar en inglés o chino traducido). Devolvé la posición de la Nomenclatura Común del Mercosur (NCM) más probable, a 8 dígitos con el formato 0000.00.00.

- Clasificá por lo que el producto es y su función principal, según las Reglas Generales de Interpretación del Sistema Armonizado.
- Si el título no alcanza para decidir entre posiciones (material, uso, potencia, si es parte o accesorio), bajá la confianza, poné las otras posiciones en alternativas explicando cuándo corresponde cada una, y listá el dato que falta.
- No incluyas alícuotas: la app las toma del Arancel Integrado de ARCA.
- En descripcion y motivo escribí en castellano simple, para alguien que no sabe de aduana.`;

const ESQUEMA_CLASIFICAR = {
  type:'object', additionalProperties:false,
  required:['ncm', 'descripcion', 'confianza', 'motivo', 'alternativas', 'datosQueFaltan', 'ivaReducidoPosible'],
  properties:{
    ncm:{ type:'string' },
    descripcion:{ type:'string' },
    confianza:{ type:'string', enum:['alta', 'media', 'baja'] },
    motivo:{ type:'string' },
    alternativas:{ type:'array', items:{ type:'object', additionalProperties:false, required:['ncm', 'cuando'],
      properties:{ ncm:{ type:'string' }, cuando:{ type:'string' } } } },
    datosQueFaltan:{ type:'array', items:{ type:'string' } },
    ivaReducidoPosible:{ type:'boolean' }
  }
};

async function asesor(req, env, cors){
  const sinCache = { ...cors, 'Cache-Control':'no-store' };
  if (req.method !== 'POST') return json({ ok:false, error:'Usá POST.' }, sinCache, 405);
  if (!env.ANTHROPIC_API_KEY) return json({ ok:false, sinClave:true, error:'El asistente todavía no está encendido en el servidor.' }, sinCache);

  let b;
  try{ b = await req.json(); }catch{ return json({ ok:false, error:'Pedido inválido.' }, sinCache, 400); }
  const corto = (s, n) => String(s ?? '').slice(0, n);

  if (env.NIJU){
    const clave = `asesor:${new Date().toISOString().slice(0, 10)}:${req.headers.get('cf-connecting-ip') || 'sin-ip'}`;
    const usadas = +(await env.NIJU.get(clave) || 0);
    if (usadas >= CONSULTAS_POR_DIA)
      return json({ ok:false, error:'Llegaste al límite de consultas al asistente por hoy. Mañana se renueva; si es urgente, escribinos por Mensajes.' }, sinCache, 429);
    await env.NIJU.put(clave, String(usadas + 1), { expirationTtl:90000 });
  }

  try{
    if (b.accion === 'clasificar'){
      const producto = [`Título: ${corto(b.titulo, 400)}`, b.marca && `Marca: ${corto(b.marca, 80)}`,
        b.tienda && `Tienda: ${corto(b.tienda, 80)}`, b.descripcion && `Descripción: ${corto(b.descripcion, 3000)}`].filter(Boolean).join('\n');
      const texto = await llamarClaude(env, {
        system:SISTEMA_CLASIFICAR,
        output_config:{ effort:'medium', format:{ type:'json_schema', schema:ESQUEMA_CLASIFICAR } },
        messages:[{ role:'user', content:producto }]
      });
      return json({ ok:true, clasificacion:JSON.parse(texto) }, sinCache);
    }

    if (b.accion === 'preguntar'){
      const pregunta = corto(b.pregunta, 1500).trim();
      if (!pregunta) return json({ ok:false, error:'Escribí tu pregunta.' }, sinCache, 400);

      /* Historial corto, alternado y empezando por el cliente. */
      const historial = (Array.isArray(b.historial) ? b.historial : []).slice(-8)
        .map(m => ({ role:m.rol === 'niju' ? 'assistant' : 'user', content:corto(m.texto, 1500) }))
        .filter(m => m.content.trim());
      while (historial.length && historial[0].role !== 'user') historial.shift();

      const contexto = b.contexto ? corto(JSON.stringify(b.contexto), 12000) : 'Sin datos de una compra: es una consulta general.';
      const texto = await llamarClaude(env, {
        system:`${SISTEMA_PREGUNTAS}\n\nCONTEXTO\n${contexto}`,
        output_config:{ effort:'low' },
        messages:[...historial, { role:'user', content:pregunta }]
      });
      return json({ ok:true, respuesta:texto.trim() }, sinCache);
    }

    return json({ ok:false, error:'Acción desconocida.' }, sinCache, 400);
  }catch(e){
    return json({ ok:false, error:'El asistente no pudo responder en este momento. Probá de nuevo en un rato.', detalle:String(e.message || e) }, sinCache, 502);
  }
}

async function llamarClaude(env, cuerpo){
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-api-key':env.ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01',
      'anthropic-beta':'server-side-fallback-2026-07-01'
    },
    body:JSON.stringify({ model:MODELO_ASESOR, max_tokens:16000, fallbacks:'default', ...cuerpo })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || `API ${r.status}`);
  if (d.stop_reason === 'refusal') throw new Error('consulta rechazada por el modelo');
  const texto = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  if (!texto) throw new Error('respuesta vacía');
  return texto;
}

/* ============================================================
   SOLICITUDES — "Vendé al mundo" y "Apps y webs a medida"
   Las manda cualquiera (con límite por IP); las lee solo el dueño.
   ============================================================ */
async function solicitudes(req, url, env, cors){
  const h = sinCache(cors);
  if (!env.NIJU) return json({ error:'falta crear el almacén KV y enlazarlo como NIJU' }, h, 501);
  const [, , id, accion] = url.pathname.split('/').filter(Boolean);
  const dueno = esDueno(req, env);

  if (req.method === 'GET'){
    if (!dueno) return json({ error:'no autorizado' }, h, 403);
    const claves = await clavesKV(env, 'solicitud:');
    const lista = (await Promise.all(claves.map(k => leerKV(env, k)))).filter(Boolean).sort((a, b) => b.creada - a.creada);
    return json({ solicitudes:lista }, h);
  }
  if (req.method !== 'POST') return json({ error:'método no permitido' }, h, 405);

  if (id){
    if (accion !== 'atendida' || !dueno) return json({ error:'no autorizado' }, h, 403);
    const s = await leerKV(env, 'solicitud:' + id);
    if (!s) return json({ error:'solicitud inexistente' }, h, 404);
    s.atendida = Date.now();
    await grabarKV(env, 'solicitud:' + id, s);
    return json({ ok:true }, h);
  }

  const limite = `limite-sol:${new Date().toISOString().slice(0, 10)}:${req.headers.get('cf-connecting-ip') || 'sin-ip'}`;
  const usadas = +(await env.NIJU.get(limite) || 0);
  if (usadas >= 10) return json({ error:'Llegaste al límite de solicitudes de hoy. Probá mañana.' }, h, 429);
  await env.NIJU.put(limite, String(usadas + 1), { expirationTtl:90000 });

  const cuerpo = await req.json().catch(() => ({}));
  if (!['exportar', 'desarrollo'].includes(cuerpo.tipo)) return json({ error:'tipo de solicitud desconocido' }, h, 400);
  const crudo = JSON.stringify(cuerpo.datos || {});
  if (crudo.length > 12000) return json({ error:'La solicitud es demasiado larga.' }, h, 400);
  const datos = JSON.parse(crudo);
  if (!String(datos.nombre || '').trim() || !String(datos.contacto || '').trim())
    return json({ error:'Poné tu nombre y un teléfono o email.' }, h, 400);
  const cliente = await clienteDe(req, env);
  const s = { id:'SOL-' + Date.now().toString(36).toUpperCase(), tipo:cuerpo.tipo, datos, creada:Date.now(),
              cliente:cliente ? cliente.email : null, atendida:null };
  await grabarKV(env, 'solicitud:' + s.id, s);
  return json({ ok:true, id:s.id }, h);
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
  if (hit) return desdeCache(hit, cors);

  const tienda = reconocerTienda(u.hostname);
  /* Primero como NiJu; si la tienda no entrega la ficha, como la pide WhatsApp
     para armar la vista previa de un link (Amazon así da nombre y foto). */
  let datos = null, v = null, bloqueado = false, detalle = '';
  for (const ua of [UA_NIJU, UA_VISTA_PREVIA]){
    try{
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT);
      const r = await fetch(u.href, { signal:ctrl.signal, redirect:'follow', headers:{
        'user-agent':ua, 'accept':'text/html,application/xhtml+xml', 'accept-language':'es-AR,es;q=0.9,en;q=0.8'
      }});
      clearTimeout(t);
      if (r.status === 403 || r.status === 429 || r.status === 503 || r.status === 500){ bloqueado = true; continue; }
      if (!r.ok){ detalle = 'la tienda respondió ' + r.status; continue; }
      const d = extraer((await r.text()).slice(0, 900000), u, tienda);
      const vd = verificar(d, tienda);
      /* Se queda con la lectura más completa: con precio > solo con nombre > nada */
      const nota = x => x ? (x.ok ? 2 : x.confianza === 'parcial' ? 1 : 0) : -1;
      if (nota(vd) > nota(v)){ datos = d; v = vd; }
      if (v.ok) break;
    }catch(e){ detalle = String(e.message || e); }
  }

  if (!datos){
    return json(bloqueado
      ? { ok:false, tienda, url:u.href, bloqueado:true,
          error:`${tienda.nombre} no deja que un programa lea sus páginas.`,
          sugerencia:'Copiá el título y el precio a mano: te cotizamos igual, con impuestos y gestión incluidos.' }
      : { ok:false, tienda, url:u.href,
          error:'No pudimos leer esa página automáticamente.', detalle,
          sugerencia:'Cargá los datos a mano: con el título, el precio y la moneda alcanza para cotizarte la compra.' }, cors);
  }
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
      out.pesoKg = out.pesoKg ?? medida(nodo.weight, aKg);
      if (!out.medidasCm){
        const m = ['depth', 'width', 'height'].map(k => medida(nodo[k], aCm));
        if (m.every(v => v > 0)) out.medidasCm = m;
      }
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

  /* Peso y medidas del bulto, si la ficha los escribe (Made-in-China: "Gross Weight",
     "Package Size"). Sirven para el flete y el transporte hasta la casa. */
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  if (out.pesoKg == null){
    const m = texto.match(/(?:gross weight|package weight|shipping weight|peso bruto|peso del paquete|peso)\s*[:：]?\s*([\d.,]+)\s*(kgs?|g|lbs?)\b/i);
    if (m) out.pesoKg = aKg(num(m[1]), m[2]);
  }
  if (!out.medidasCm){
    const m = texto.match(/(?:package size|packing size|dimensions?|tamaño del paquete|medidas|dimensiones)\s*[:：(]?\s*(?:[a-z*×]+\)?\s*[:：]?\s*)?([\d.,]+)\s*[x×*]\s*([\d.,]+)\s*[x×*]\s*([\d.,]+)\s*(cm|mm|m|in|inch(?:es)?)\b/i);
    if (m){ const v = [m[1], m[2], m[3]].map(x => aCm(num(x), m[4])); if (v.every(x => x > 0)) out.medidasCm = v; }
  }
  if (!(out.pesoKg > 0 && out.pesoKg < 30000)) out.pesoKg = null;
  if (out.medidasCm && !out.medidasCm.every(x => x > 0 && x < 2000)) out.medidasCm = null;

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

/* Unidades de schema.org (unitCode) o escritas: KGM/kg, GRM/g, LBR/lb · CMT/cm, MMT/mm, MTR/m, INH/in. */
function aKg(v, u = 'kg'){
  if (!(v > 0)) return null;
  const x = String(u).toLowerCase();
  return Math.round((/^(grm|g)$/.test(x) ? v / 1000 : /^(lbr|lbs?)$/.test(x) ? v * 0.45359237 : v) * 100) / 100;
}
function aCm(v, u = 'cm'){
  if (!(v > 0)) return null;
  const x = String(u).toLowerCase();
  return Math.round((/^(mmt|mm)$/.test(x) ? v / 10 : /^(mtr|m)$/.test(x) ? v * 100 : /^(inh|in|inch|inches)$/.test(x) ? v * 2.54 : v) * 10) / 10;
}
function medida(n, conv){
  if (n == null) return null;
  if (typeof n === 'object') return conv(num(n.value), n.unitCode || n.unitText || undefined);
  const m = String(n).match(/([\d.,]+)\s*([a-z]+)?/i);
  return m ? conv(num(m[1]), m[2] || undefined) : null;
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
  salomon:    shopify('salomon',    'www.salomonstore.com.ar', [3,8]),

  /* ---------- Marcas deportivas y de moda (sumadas el 14-09-2026) ----------
     Probadas una por una: responden con precio y stock sin clave.
     Nike, Adidas y Mishka bloquean (403); Zara, New Balance, Under Armour,
     Dexter, Stockcenter, Merrell y The North Face no tienen catálogo abierto.
     Rapsodia se descartó: su GraphQL devuelve el catálogo de Caro Cuore. */
  asics:  vtex('asics', 'www.asics.com.ar', [3,7]),
  fila:   vtex('fila', 'tienda.fila.com.ar', [3,7]),
  levis:  vtex('levis', 'www.levi.com.ar', [3,7]),
  lecoq:  woo('lecoq', 'lecoqsportif.com.ar', [3,8]),
  kosiuko: magento('kosiuko', 'www.kosiuko.com', [3,8]),

  /* ---------- Made-in-China: mayorista chino, precios FOB ----------
     Sin API pública: se lee la página de búsqueda en español. Cada producto
     trae rango de precio FOB en dólares y pedido mínimo (MOQ). Es precio de
     fábrica puesto en el puerto chino: sin flete ni impuestos, que la app
     suma con el desglose de importación. ---------------------------- */
  madeinchina: {
    modo:'catalogo-publico', plataforma:'html',
    async buscar({ q, limite, desde = 0 }){
      if (desde > 0) return [];      // la búsqueda pública no pagina de forma estable
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT);
      let html;
      try{
        const r = await fetch(`https://es.made-in-china.com/productSearch?keyword=${encodeURIComponent(q)}`, { signal:ctrl.signal, headers:{
          'user-agent':'Mozilla/5.0 (compatible; NiJuBot/0.1; +https://niju.ar/bot)',
          'accept':'text/html', 'accept-language':'es-AR,es;q=0.9' } });
        if (!r.ok) throw new Error(`HTTP ${r.status} en made-in-china.com`);
        html = await r.text();
      } finally { clearTimeout(t); }

      const numero = s => parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
      const out = [];
      for (const b of html.split('<div class="list-node ').slice(1)){
        const titulo = limpiarTexto((b.match(/<h2 class="product-name"[^>]*title="([^"]+)"/) || [])[1]);
        const url = (b.match(/<h2 class="product-name"[\s\S]*?href="([^"]+)"/) || [])[1];
        const precio = b.match(/class="price">US\$\s*<span>([\d.,]+)<\/span>(?:\s*-\s*<span>([\d.,]+)<\/span>)?/);
        if (!titulo || !url || !precio) continue;
        const min = numero(precio[1]), max = precio[2] ? numero(precio[2]) : min;
        if (!(min > 0)) continue;
        const moq = limpiarTexto((b.match(/<div class="info">([^<]+)<span class="price_hint">\s*\(MOQ\)/) || [])[1]);
        const pdid = (b.match(/pdid:([A-Za-z0-9]+)/) || [])[1] || url.split('_').pop();
        out.push(oferta({
          id:`madeinchina-${pdid}`, tiendaId:'madeinchina', titulo,
          precio:min, precioLista:null, moneda:'USD', envio:0, entregaDias:[20,50],
          stock:1, reputacion:4, url,
          imagen:(b.match(/data-original="(https:\/\/image\.made-in-china\.com\/[^"]+)"/) || [])[1] || null,
          vendedor:limpiarTexto((b.match(/class="compnay-name J-compnay-name"[^>]*>\s*<span>([^<]+)/) || [])[1]) || 'Made-in-China',
          tags:['mayorista', 'precio FOB'],
          specs:{ 'Precio FOB': max > min ? `US$ ${min} a ${max} por unidad` : `US$ ${min} por unidad`, ...(moq ? { 'Pedido mínimo': moq } : {}) }
        }));
        if (out.length >= limite) break;
      }
      return out;
    }
  },

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
    modo:'catalogo-publico', plataforma:'woo', host,
    variantes: ({ id:producto }) => variantesWoo(host, producto),
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
    modo:'catalogo-publico', plataforma:'shopify', host,
    variantes: ({ url }) => variantesShopify(host, url),
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

/* ------------------------------------------------------------------
   Conector genérico de Magento 2 (Adobe Commerce).
   Usa el GraphQL público de la tienda, el mismo que usa su web.
   Magento no publica el stock por esta vía: muestra lo que la tienda
   deja a la venta. El link del producto es url_key + url_suffix.
   ------------------------------------------------------------------ */
function magento(id, host, entregaDias){
  return {
    modo:'catalogo-publico', plataforma:'magento', host,
    async buscar({ q, limite, desde = 0 }){
      const porPagina = Math.min(limite, 24);
      const pagina = Math.floor(desde / porPagina) + 1;
      const consulta = `{products(search:${JSON.stringify(q)},pageSize:${porPagina},currentPage:${pagina}){items{` +
        'name sku url_key url_suffix price_range{minimum_price{final_price{value currency} regular_price{value}}} small_image{url}}}}';
      const d = await pedir(`https://${host}/graphql?query=${encodeURIComponent(consulta)}`,
        { headers:{ 'accept':'application/json', 'user-agent':'NiJu/0.1 (+contacto@niju.ar)' } });
      const out = [];
      for (const p of (d?.data?.products?.items || [])){
        const mp = p.price_range?.minimum_price;
        const precio = mp?.final_price?.value;
        if (!(precio > 0) || !p.url_key) continue;
        const lista = mp?.regular_price?.value;
        const listaCreible = lista > precio && lista <= precio * 3;
        out.push(oferta({
          id:`${id}-${p.sku}`, tiendaId:id,
          titulo:String(p.name || '').trim(), marca:'',
          precio, precioLista: listaCreible ? lista : null,
          moneda:mp.final_price.currency || 'ARS', envio:0, entregaDias,
          cuotas:0, cuotaValor:null, stock:5, reputacion:4.1,
          url:`https://${host}/${p.url_key}${p.url_suffix ?? '.html'}`,
          imagen:(p.small_image?.url || '').split('?')[0] || null, vendedor:id
        }));
      }
      return out;
    }
  };
}

function vtex(id, host, entregaDias){
  return {
    modo:'catalogo-publico', plataforma:'vtex', host,
    variantes: ({ id:producto }) => variantesVtex(host, producto),
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
