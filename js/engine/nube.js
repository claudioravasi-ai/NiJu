/* ============================================================
   NiJu — La base de datos compartida
   ------------------------------------------------------------
   Cuentas de clientes, órdenes y compras viven en el servidor
   (Cloudflare KV). Es la única forma de que el dueño vea lo que
   pidió cada cliente y de que el cliente siga su pedido desde
   cualquier teléfono.

   Si el servidor todavía no tiene base (falta crear el KV o volver
   a subir el worker), la app lo dice y guarda en este dispositivo,
   marcado como tal. Si lo que falta es conexión, NO guarda en
   local: un pedido que el dueño nunca ve es peor que un error.
   ============================================================ */
import { CONFIG } from '../config.js';
import { cabecerasAdmin } from './sesion.js';
import { store } from '../state.js';

const CLAVE_SESION = 'niju.cliente';

export class ErrorNube extends Error{
  constructor(tipo, mensaje, status = 0){ super(mensaje); this.tipo = tipo; this.status = status; }
}

export function tokenCliente(){ try{ return localStorage.getItem(CLAVE_SESION) || null; }catch{ return null; } }
function guardarToken(t){ try{ t ? localStorage.setItem(CLAVE_SESION, t) : localStorage.removeItem(CLAVE_SESION); }catch{} }
export const hayCuenta = () => !!tokenCliente();

export async function llamar(ruta, { metodo = 'GET', cuerpo, comoDueno = false, anonimo = false, tiempo = 15000 } = {}){
  const headers = { accept:'application/json' };
  if (cuerpo !== undefined) headers['content-type'] = 'application/json';
  if (comoDueno) Object.assign(headers, cabecerasAdmin());
  else if (!anonimo && tokenCliente()) headers.authorization = 'Bearer ' + tokenCliente();

  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), tiempo);
  let r;
  try{
    r = await fetch(CONFIG.api + ruta, { method:metodo, headers, cache:'no-store', signal:ctrl.signal,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  }catch{
    throw new ErrorNube('sin-conexion', 'No pudimos hablar con el servidor de NiJu. Revisá la conexión y probá de nuevo.');
  }finally{ clearTimeout(reloj); }

  const d = await r.json().catch(() => ({}));
  if (!r.ok){
    const tipo = r.status === 401 ? 'sin-sesion' : r.status === 501 ? 'sin-base' : r.status === 404 ? 'no-existe' : 'error';
    if (tipo === 'sin-sesion' && !comoDueno) salirCliente();
    throw new ErrorNube(tipo, d.error || `El servidor respondió ${r.status}`, r.status);
  }
  return d;
}

/* ---------------- ¿Hay base de datos? ---------------- */
let pedidoEstado = null;
export function estadoServidor(forzar = false){
  if (!pedidoEstado || forzar){
    pedidoEstado = llamar('/estado', { anonimo:true, tiempo:7000 })
      .catch(e => ({ ok:false, base:false, cuentas:false, motivo:e.tipo }));
  }
  return pedidoEstado;
}

/** 'nube' (base compartida), 'local' (servidor sin base) o 'sin-conexion'. */
export async function modo(){
  let e = await estadoServidor();
  if (e.motivo === 'sin-conexion') e = await estadoServidor(true);
  if (e.motivo === 'sin-conexion') return 'sin-conexion';
  return e.base && e.cuentas ? 'nube' : 'local';
}

export async function modoOError(){
  const m = await modo();
  if (m === 'sin-conexion') throw new ErrorNube('sin-conexion', 'No hay conexión con el servidor de NiJu. Probá de nuevo en un momento.');
  return m;
}

/* ---------------- Cuentas ---------------- */
export async function registrar({ email, clave, perfil }){
  const d = await llamar('/clientes/registro', { metodo:'POST', cuerpo:{ email, clave, perfil }, anonimo:true });
  guardarToken(d.token);
  store.set('usuario', d.perfil);
  return d.perfil;
}

export async function entrarCliente(email, clave){
  const d = await llamar('/clientes/entrar', { metodo:'POST', cuerpo:{ email, clave }, anonimo:true });
  guardarToken(d.token);
  store.set('usuario', d.perfil);
  return d.perfil;
}

export async function refrescarPerfil(){
  if (!tokenCliente()) return null;
  try{
    const d = await llamar('/clientes/yo');
    store.set('usuario', d.perfil);
    return d.perfil;
  }catch{ return null; }
}

export async function guardarPerfilNube(perfil){
  const d = await llamar('/clientes/yo', { metodo:'PUT', cuerpo:{ perfil } });
  store.set('usuario', d.perfil);
  return d.perfil;
}

export function salirCliente(){
  guardarToken(null);
  store.set('usuario', null);
}

/* ---------------- Talles, colores y stock ---------------- */
const cacheVariantes = new Map();

export function variantesDe(oferta, { fresco = false } = {}){
  const clave = oferta.tiendaId + '|' + oferta.id;
  const guardado = cacheVariantes.get(clave);
  if (!fresco && guardado && Date.now() - guardado.ts < 120000) return guardado.pedido;
  const qs = new URLSearchParams({ tienda:oferta.tiendaId, id:oferta.id, url:oferta.url || '' });
  if (fresco) qs.set('fresco', '1');
  const pedido = llamar('/variantes?' + qs, { anonimo:true, tiempo:10000 });
  cacheVariantes.set(clave, { ts:Date.now(), pedido });
  pedido.catch(() => cacheVariantes.delete(clave));
  return pedido;
}
