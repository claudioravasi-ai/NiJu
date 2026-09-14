/* ============================================================
   NiJu — "Pedí y que compitan" (bolsa de demanda)
   ------------------------------------------------------------
   Al revés de siempre: el cliente dice qué quiere y hasta cuánto
   paga, y compiten por servirlo.

   Cómo funciona desde la v0.4.1 (14-09-2026):
     · Publica solo un cliente con cuenta: el pedido queda atado a
       su usuario y lo sigue en Mi cuenta → Mis pedidos.
     · Los pedidos iguales se juntan: 40 personas pidiendo lo mismo
       mueven a un proveedor que 1 sola no mueve.
     · Ofertan proveedores aprobados por el dueño (con su código), NiJu
       y cualquier cliente con la cuenta completa que lo tenga o lo
       consiga más barato: con foto real, estado del producto y
       compromiso de envío. NiJu le cobra COMISION_PARTICULAR.
     · Cada oferta nueva le llega al cliente como aviso (campanita).
     · El cliente acepta una oferta y se convierte en un pedido de
       compra "pendiente de pago", como cualquier compra de NiJu.
     · No hay seña: antes se mostraba una seña del 15% que nunca se
       cobraba. Vuelve cuando exista el cobro dentro de la app.
   Todo vive en el servidor (KV 'demanda' y 'proveedores').
   ============================================================ */
import { CONFIG } from '../config.js';
import { tokenCliente, hayCuenta } from './nube.js';
import { cabecerasAdmin, esDueno } from './sesion.js';
import { limpiar, tokens } from './normalize.js';

export const DIAS_DEFECTO = 12;
export const SENA_DEMANDA = 0;          // sin seña hasta que haya cobro real

/* Comisión que NiJu le cobra a quien vende sin ser proveedor aprobado
   (un particular, un emprendedor, un negocio). Mismo valor en el worker. */
export const COMISION_PARTICULAR = 0.04;
export const TIPOS_OFERTA = { proveedor:'Proveedor aprobado', niju:'NiJu', particular:'Vendedor con cuenta' };
export const ESTADOS_PRODUCTO = { nuevo:'Nuevo', usado:'Usado', reacondicionado:'Reacondicionado' };
export const fotoUrl = id => `${CONFIG.api}/demanda/foto/${id}`;

const CLAVE_PROVEEDOR = 'niju.proveedor';
const leerLocal = k => { try{ return localStorage.getItem(k); }catch{ return null; } };
export const codigoProveedor = () => leerLocal(CLAVE_PROVEEDOR);
export const nombreProveedor = () => leerLocal(CLAVE_PROVEEDOR + '.nombre');

async function api(ruta, { metodo = 'GET', cuerpo, comoDueno = false } = {}){
  const headers = { accept:'application/json' };
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  if (comoDueno) Object.assign(headers, cabecerasAdmin());
  if (tokenCliente()) headers.authorization = 'Bearer ' + tokenCliente();
  if (codigoProveedor()) headers['x-niju-proveedor'] = codigoProveedor();
  let r;
  try{
    r = await fetch(CONFIG.api + '/demanda' + ruta, { method:metodo, headers, cache:'no-store',
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  }catch{
    throw new Error('No pudimos hablar con el servidor de NiJu. Revisá la conexión y probá de nuevo.');
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || `El servidor respondió ${r.status}`), { status:r.status });
  return d;
}

/* ---------------- Estados ---------------- */
export const estadoDe = p => p.estado === 'abierta' && p.vence <= Date.now() ? 'vencida' : p.estado;
export const ESTADOS_PEDIDO = {
  abierta:    { texto:'Abierto, recibiendo ofertas', clase:'tag-nac' },
  adjudicada: { texto:'Aceptaste una oferta', clase:'tag-win' },
  cerrada:    { texto:'Cerrado por vos', clase:'' },
  vencida:    { texto:'Venció sin aceptar oferta', clase:'tag-warn' }
};
export const diasQueFaltan = p => Math.max(0, Math.ceil((p.vence - Date.now()) / 864e5));

/* ---------------- Pedidos ---------------- */
let cache = [];
export const estadoSyncDemanda = { remoto:false, error:null };

export async function listarPedidos(){
  const d = await api('', { comoDueno:esDueno() });
  cache = d.pedidos || [];
  estadoSyncDemanda.remoto = true; estadoSyncDemanda.error = null;
  return cache;
}

/* Compatibilidad con el Radar del Panel, que lee la bolsa. */
export const ordenes = () => cache;
export async function sincronizarDemanda(){
  try{ await listarPedidos(); }
  catch(e){ estadoSyncDemanda.remoto = false; estadoSyncDemanda.error = e.message; }
  return cache;
}

export async function misPedidos(){
  if (!hayCuenta()) return [];
  return (await api('/mias')).pedidos || [];
}

export async function publicar({ titulo, detalle, precioMax, cantidad = 1, dias = DIAS_DEFECTO, rubro }){
  return (await api('', { metodo:'POST', cuerpo:{ titulo, detalle, precioMax, cantidad, dias, rubro } })).pedido;
}

/** Oferta para todo el bloque: le llega a cada persona que pidió lo mismo. */
export function ofertar(bloque, { precio, cantidad, plazoDias, notas, estadoProducto, condicion, foto, compromisoEnvio }){
  const ids = bloque.pedidos.map(p => p.id);
  return api(`/${ids[0]}/ofertar`, { metodo:'POST', comoDueno:esDueno(),
    cuerpo:{ ids, precio, cantidad, plazoDias, notas, estadoProducto, condicion, foto, compromisoEnvio } });
}

export async function misOfertas(){
  if (!hayCuenta()) return [];
  return (await api('/mis-ofertas')).ofertas || [];
}

/** Achica la foto en el teléfono antes de subirla (JPG, lado mayor 1000 px, menos de ~430 KB). */
export function reducirFoto(archivo, lado = 1000, calidad = 0.72){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let q = calidad, datos = c.toDataURL('image/jpeg', q);
      while (datos.length > 580000 && q > 0.35){ q -= 0.1; datos = c.toDataURL('image/jpeg', q); }
      datos.length > 580000 ? reject(new Error('La foto es muy pesada. Probá con otra.')) : resolve(datos);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pudimos leer esa imagen. Probá con otra foto.')); };
    img.src = url;
  });
}

export const aceptarOferta = (pedidoId, ofertaId) => api(`/${pedidoId}/aceptar`, { metodo:'POST', cuerpo:{ ofertaId } });
export const cerrarPedido  = pedidoId => api(`/${pedidoId}/cerrar`, { metodo:'POST', cuerpo:{} });
export const marcarLeido   = pedidoId => api(`/${pedidoId}/leido`, { metodo:'POST', cuerpo:{} });

/* ---------------- Proveedores ---------------- */
export async function entrarComoProveedor(codigo){
  try{ localStorage.setItem(CLAVE_PROVEEDOR, String(codigo).trim().toUpperCase()); }catch{}
  try{
    const d = await api('/proveedor');
    try{ localStorage.setItem(CLAVE_PROVEEDOR + '.nombre', d.nombre); }catch{}
    return d.nombre;
  }catch(e){
    salirComoProveedor();
    throw e;
  }
}
export function salirComoProveedor(){
  try{ localStorage.removeItem(CLAVE_PROVEEDOR); localStorage.removeItem(CLAVE_PROVEEDOR + '.nombre'); }catch{}
}
export const puedeOfertar = () => esDueno() || !!codigoProveedor();

export const listarProveedores = async () => (await api('/proveedores', { comoDueno:true })).proveedores || [];
export const crearProveedor = datos => api('/proveedores', { metodo:'POST', cuerpo:datos, comoDueno:true });
export const bajaProveedor = id => api(`/proveedores/${id}/baja`, { metodo:'POST', cuerpo:{}, comoDueno:true });

/* ---------------- Agrupar lo que piden varios ---------------- */

/**
 * ¿Dos personas están pidiendo lo mismo?
 * La vara es más blanda que al comparar productos de una tienda:
 * "iMac 24 pulgadas M1" e "iMac 24 M1 256GB" son el mismo pedido.
 */
export function mismaIntencion(a, b){
  if (limpiar(a) === limpiar(b)) return true;
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return false;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  return comunes / Math.min(ta.size, tb.size) >= 0.5 && comunes >= 2;
}

/** Junta los pedidos abiertos que piden lo mismo. */
export function agregar(lista = cache){
  const bloques = [];
  for (const p of lista){
    if (estadoDe(p) !== 'abierta') continue;
    const b = bloques.find(x => mismaIntencion(x.titulo, p.titulo));
    if (b) b.pedidos.push(p); else bloques.push({ titulo:p.titulo, pedidos:[p] });
  }
  return bloques.map(b => {
    const precios = b.pedidos.map(p => p.precioMax);
    const vistas = new Set();
    const ofertas = b.pedidos.flatMap(p => p.ofertas || [])
      .filter(o => !vistas.has(o.id) && vistas.add(o.id))
      .sort((x, y) => x.precio - y.precio);
    const vence = Math.min(...b.pedidos.map(p => p.vence));
    return {
      ...b, ordenes:b.pedidos,
      unidades:b.pedidos.reduce((a, p) => a + p.cantidad, 0),
      personas:b.pedidos.length,
      precioMaxPromedio:Math.round(precios.reduce((a, x) => a + x, 0) / precios.length),
      precioMaxMinimo:Math.min(...precios),
      comprometido:Math.round(b.pedidos.reduce((a, p) => a + p.precioMax * p.cantidad, 0)),
      senas:0,
      vence, diasRestantes:Math.max(0, Math.ceil((vence - Date.now()) / 864e5)),
      ofertas, mejorOferta:ofertas[0] || null,
      llenable: ofertas[0] ? ofertas[0].precio <= Math.min(...precios) : false,
      imagen:b.pedidos.find(p => p.imagen)?.imagen || null,
      rubro:b.pedidos.find(p => p.rubro)?.rubro || null
    };
  }).sort((a, b) => b.comprometido - a.comprometido);
}

/** Lo que el dueño necesita saber: qué pidieron y nadie sirvió. */
export function sinSatisfacer(){
  return agregar().filter(b => !b.llenable).map(b => ({ ...b, oportunidad:b.comprometido }));
}

/** Si NiJu lo consigue a este costo por unidad, ¿cuánto deja? (solo el dueño lo ve) */
export function simularLlenado(bloque, costoUnitARS){
  const precio = bloque.precioMaxMinimo;          // hay que respetar al más exigente
  const ingreso = precio * bloque.unidades;
  const costo = costoUnitARS * bloque.unidades;
  return {
    unidades:bloque.unidades, precio, ingreso, costo,
    margen:Math.round(ingreso - costo),
    margenPct: ingreso ? Math.round((1 - costo / ingreso) * 100) : 0,
    capitalPropio:Math.round(costo)
  };
}
