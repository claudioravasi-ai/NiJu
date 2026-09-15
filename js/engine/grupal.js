/* ============================================================
   NiJu — Compra grupal y preventa (punto 5)
   ------------------------------------------------------------
   Compra grupal: cuanta más gente se suma, más barato sale para
   todos. Resuelve tres problemas de una: baja el flete por kilo,
   alcanza el mínimo que pide el proveedor, y hace que cada uno
   invite a otros para que el precio baje. El marketing lo hacen
   los clientes.

   Preventa: no se compra una sola unidad hasta tener las reservas.
   Capital de trabajo casi cero y riesgo casi cero.
   ============================================================ */
import { store } from '../state.js';
import { uid } from '../util.js';
import { CONFIG } from '../config.js';
import { cabecerasAdmin } from './sesion.js';
import { mismaIntencion } from './demanda.js';

export const SENA_PCT = 0.30;     // seña para reservar en preventa
/* 12 días (pedido de Claudio, 15-09-2026). Si todos los que reservaron dan el
   OK antes, el pedido se cierra y se hace ese mismo día. */
export const DIAS_CAMPANIA = 12;
export const MIN_PERSONAS_ACUERDO = 2;

/* ------------------------------------------------------------------
   Cada reserva lleva una clave que queda SOLO en el dispositivo de quien
   reservó: con ella da el OK. El servidor nunca la devuelve en la lista.
   ------------------------------------------------------------------ */
const CLAVE_MIAS = 'niju.misReservas';
const leerMias = () => { try{ return JSON.parse(localStorage.getItem(CLAVE_MIAS) || '{}'); }catch{ return {}; } };
function nuevaReservaPropia(){
  const r = { id:'r' + uid(), clave:uid() + uid() + uid() };
  try{ localStorage.setItem(CLAVE_MIAS, JSON.stringify({ ...leerMias(), [r.id]:r.clave })); }catch{}
  return r;
}
export const esMia = reserva => !!leerMias()[reserva?.id];

/**
 * Escalones a partir del cálculo real: para cada total de unidades, lo que
 * sale por unidad con el mismo motor de "Traelo por mí". El precio nunca
 * sube cuando se suma gente (si el cálculo diera más, queda el anterior).
 */
export function tramosDesdeCurva(curva){
  let piso = Infinity;
  const base = curva[0]?.precio || 0;
  return curva.filter(p => p.precio > 0).map(p => {
    piso = Math.min(piso, Math.round(p.precio / 100) * 100);
    return { desde:p.unidades, precio:piso, desc:base ? Math.max(0, Math.round((1 - piso / base) * 100)) : 0 };
  }).filter((t, i, a) => i === 0 || t.desde > a[i - 1].desde);
}

/**
 * Tramos: a partir de N unidades, el precio unitario baja para TODOS.
 * Se arman solos a partir del precio base y del mínimo del proveedor.
 */
export function armarTramos(precioBase, meta){
  const escalones = [
    { desde:1,                       desc:0    },
    { desde:Math.ceil(meta * 0.35),  desc:0.07 },
    { desde:Math.ceil(meta * 0.60),  desc:0.13 },
    { desde:meta,                    desc:0.20 },
    { desde:Math.ceil(meta * 1.6),   desc:0.26 }
  ];
  return escalones.map(e => ({ desde:e.desde, precio:Math.round(precioBase * (1 - e.desc) / 100) * 100, desc:Math.round(e.desc * 100) }));
}

/* ------------------------------------------------------------------
   Las campañas viven en el servidor cuando hay backend, y en el
   navegador cuando no lo hay. `remoto` dice cuál de las dos cosas
   está pasando, para poder avisarlo en pantalla sin mentir.
   ------------------------------------------------------------------ */
export const estadoSync = { remoto:false, error:null, ultima:null };

async function api(ruta, opciones){
  /* no-store: el servidor viejo manda max-age=600 y, recién abierta una campaña,
     el navegador mostraba la lista guardada de antes, sin ella. */
  const r = await fetch(CONFIG.api + ruta, {
    cache:'no-store',
    ...opciones,
    headers:{ 'content-type':'application/json', accept:'application/json', ...cabecerasAdmin() }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

/** Trae las campañas del servidor. Si no puede, sigue con las locales. */
export async function sincronizar(){
  try{
    const d = await api('/campanias');
    store.set('campaniasGrupales', d.campanias || []);
    estadoSync.remoto = true; estadoSync.error = null; estadoSync.ultima = Date.now();
  }catch(e){
    estadoSync.remoto = false;
    estadoSync.error = String(e.message || e);
  }
  return campanias();
}

export async function crearCampania({ tipo = 'grupal', titulo, imagen, familiaId, itemRef, precioBase, meta, dias = DIAS_CAMPANIA, notas }){
  const c = {
    id:'cg-' + uid(), tipo, titulo, imagen: imagen || null, familiaId: familiaId || null, itemRef: itemRef || null,
    precioBase, meta, tramos: armarTramos(precioBase, meta),
    creada: Date.now(), cierra: Date.now() + dias * 864e5,
    reservas: [], estado:'abierta', notas: notas || ''
  };
  try{
    const d = await api('/campanias', { method:'POST', body:JSON.stringify(c) });
    estadoSync.remoto = true;
    await sincronizar();
    return d.campania || c;
  }catch(e){
    estadoSync.remoto = false; estadoSync.error = String(e.message || e);
    store.push('campaniasGrupales', c);
    return c;
  }
}

export const campanias = () => store.get('campaniasGrupales') || [];

/* ------------------------------------------------------------------
   Desde "Traelo por mí": cuando traerlo solo sale caro, el producto
   viaja a Compra grupal ya calculado, para no buscarlo de nuevo.
   Vive en la pestaña (sessionStorage) y vence en un día.
   ------------------------------------------------------------------ */
const CLAVE_PENDIENTE = 'niju.grupalPendiente';
export function guardarPendiente(p){
  try{ sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify({ ...p, ts:Date.now() })); }catch{}
}
export function pendiente(){
  try{
    const p = JSON.parse(sessionStorage.getItem(CLAVE_PENDIENTE) || 'null');
    return p && Date.now() - p.ts < 864e5 ? p : null;
  }catch{ return null; }
}
export function olvidarPendiente(){
  try{ sessionStorage.removeItem(CLAVE_PENDIENTE); }catch{}
}

/** Escalones desde lo que sale traerlo solo hasta lo estimado para la meta. */
export function tramosEstimados(precioSolo, precioGrupo, meta){
  const piso = Math.min(precioGrupo, precioSolo);
  const precio = f => Math.round((precioSolo - (precioSolo - piso) * f) / 100) * 100;
  return [{ desde:1, f:0 }, { desde:Math.max(2, Math.ceil(meta * 0.35)), f:0.4 }, { desde:Math.max(3, Math.ceil(meta * 0.6)), f:0.7 }, { desde:meta, f:1 }]
    .filter((t, i, a) => i === 0 || t.desde > a[i - 1].desde)
    .map(t => ({ desde:t.desde, precio:precio(t.f), desc:Math.round((1 - precio(t.f) / precioSolo) * 100) }));
}

/** ¿Ya hay una campaña abierta de este producto? Por link, o por nombre parecido. */
export function campaniaPara({ titulo, url }){
  return campanias().find(c => ['abierta', 'alcanzada'].includes(estadoCampania(c).estado) &&
    ((url && c.itemRef === url) || (titulo && mismaIntencion(c.titulo, titulo))));
}

/** Un cliente abre una compra grupal con su reserva adentro. */
export async function proponerCampania({ titulo, imagen, itemRef, precioSolo, precioGrupo, meta, curva, nombre, email, cantidad, notas }){
  const tramos = curva?.length ? tramosDesdeCurva(curva) : tramosEstimados(precioSolo, precioGrupo, meta);
  const propia = nuevaReservaPropia();
  const c = {
    id:'cg-' + uid(), tipo:'grupal', origen:'cliente', titulo, imagen:imagen || null, itemRef:itemRef || null, familiaId:null,
    precioBase:precioSolo, meta, tramos, creada:Date.now(), cierra:Date.now() + DIAS_CAMPANIA * 864e5, estado:'abierta', notas:notas || '',
    reservas:[{ ...propia, nombre, email:email || null, cantidad, precioAlReservar:tramos[0].precio, sena:0, ok:false, ts:Date.now() }]
  };
  try{
    const d = await api('/campanias/proponer', { method:'POST', body:JSON.stringify(c) });
    estadoSync.remoto = true;
    await sincronizar();
    return d.campania || c;
  }catch(e){
    if (/límite/i.test(e.message || '')) throw e;
    estadoSync.remoto = false; estadoSync.error = String(e.message || e);
    store.push('campaniasGrupales', c);
    return c;
  }
}

export function unidadesReservadas(c){
  return (c.reservas || []).reduce((a, r) => a + r.cantidad, 0);
}

/** El precio que rige AHORA, según cuánta gente se sumó. */
export function tramoActual(c){
  const n = unidadesReservadas(c);
  let actual = c.tramos[0];
  for (const t of c.tramos) if (n >= t.desde) actual = t;
  return actual;
}

/** Cuánto falta para que baje el precio otra vez. El gancho de la viralidad. */
export function siguienteTramo(c){
  const n = unidadesReservadas(c);
  const sig = c.tramos.find(t => n < t.desde);
  if (!sig) return null;
  return { ...sig, faltan: sig.desde - n, ahorroExtra: tramoActual(c).precio - sig.precio };
}

/** ¿Todos los que reservaron dieron el OK? Hacen falta al menos dos personas. */
export function acuerdoCampania(c){
  const rs = c.reservas || [];
  const conOk = rs.filter(r => r.ok).length;
  return { personas:rs.length, conOk, pct:rs.length ? Math.round(conOk / rs.length * 100) : 0,
    todos:rs.length >= MIN_PERSONAS_ACUERDO && conOk === rs.length };
}

/** Un renglón por día desde que abrió: unidades pedidas y personas, acumuladas. */
export function avancePorDia(c){
  const inicio = new Date(c.creada); inicio.setHours(0, 0, 0, 0);
  const fin = Math.min(Date.now(), c.cerradaEn || c.cierra);
  const dias = Math.max(1, Math.min(DIAS_CAMPANIA, Math.floor((fin - inicio) / 864e5) + 1));
  const rs = (c.reservas || []).slice().sort((a, b) => a.ts - b.ts);
  return Array.from({ length:dias }, (_, i) => {
    const hasta = inicio.getTime() + (i + 1) * 864e5;
    const antes = inicio.getTime() + i * 864e5;
    const hechas = rs.filter(r => r.ts < hasta);
    const nuevas = hechas.filter(r => r.ts >= antes);
    return { dia:i + 1, fecha:antes, unidades:hechas.reduce((a, r) => a + r.cantidad, 0), personas:hechas.length,
      nuevasPersonas:nuevas.length, nuevasUnidades:nuevas.reduce((a, r) => a + r.cantidad, 0),
      ok:hechas.filter(r => r.ok && (r.okTs || 0) < hasta).length };
  });
}

export function estadoCampania(c){
  const n = unidadesReservadas(c);
  const t = tramoActual(c);
  const sig = siguienteTramo(c);
  const acuerdo = acuerdoCampania(c);
  const acordada = c.estado === 'acordada' || (c.estado === 'abierta' && acuerdo.todos);
  const diasRestantes = acordada ? 0 : Math.max(0, Math.ceil((c.cierra - Date.now()) / 864e5));
  const vencida = !acordada && Date.now() > c.cierra;
  const alcanzada = n >= c.meta;
  const dia = Math.min(DIAS_CAMPANIA, Math.max(1, Math.ceil((Math.min(Date.now(), c.cerradaEn || Date.now()) - c.creada) / 864e5)));

  return {
    reservadas:n, meta:c.meta, avance:Math.min(100, Math.round(n / c.meta * 100)),
    precio:t.precio, descuento:t.desc, tramo:t, siguiente:sig, acuerdo, acordada, dia,
    diasRestantes, vencida, alcanzada,
    ahorroTotal: (c.precioBase - t.precio) * n,
    estado: c.estado === 'cerrada' ? 'cerrada'
          : acordada ? 'lista-para-comprar'
          : vencida ? (alcanzada ? 'lista-para-comprar' : 'no-alcanzo')
          : alcanzada ? 'alcanzada' : 'abierta',
    mensaje: c.estado === 'cerrada' ? 'Campaña cerrada.'
      : acordada ? `Las ${acuerdo.personas} personas dieron el OK: el pedido se cerró antes de los ${DIAS_CAMPANIA} días y se hace ya, a ${plataTxt(t.precio)} por unidad.`
      : vencida && !alcanzada ? 'No se llegó al mínimo. Se devuelve el 100% de las señas.'
      : vencida && alcanzada ? 'Se llegó al mínimo. Compramos y despachamos.'
      : sig ? `Con ${sig.desde} unidades en total baja a ${plataTxt(sig.precio)} por unidad, para todos: faltan ${sig.faltan}.`
      : '¡Precio mínimo alcanzado!'
  };
}
const plataTxt = v => `$ ${Math.round(v).toLocaleString('es-AR')}`;

export async function reservar(campaniaId, { nombre, cantidad = 1, email }){
  const c0 = campanias().find(c => c.id === campaniaId);
  const precio = c0 ? tramoActual(c0).precio : 0;
  const sena = c0 && c0.tipo === 'preventa' ? Math.round(precio * cantidad * SENA_PCT) : 0;
  const propia = nuevaReservaPropia();

  try{
    await api(`/campanias/${campaniaId}/reservar`, {
      method:'POST',
      body:JSON.stringify({ ...propia, nombre, email: email || null, cantidad, precioAlReservar:precio, sena })
    });
    estadoSync.remoto = true;
    await sincronizar();
  }catch(e){
    if (/cerr/i.test(e.message || '')) throw e;
    estadoSync.remoto = false; estadoSync.error = String(e.message || e);
    const cs = campanias().map(c => c.id !== campaniaId ? c : ({
      ...c, reservas:[...(c.reservas || []), { ...propia, nombre, email:email || null, cantidad, precioAlReservar:precio, sena, ok:false, ts:Date.now() }]
    }));
    store.set('campaniasGrupales', cs);
  }
  return campanias().find(c => c.id === campaniaId);
}

/** Quien reservó da su OK con la clave que quedó en su dispositivo. */
export async function darOk(campaniaId, reservaId){
  const clave = leerMias()[reservaId];
  if (!clave) throw new Error('Esa reserva no se hizo desde este dispositivo');
  const marcar = c => {
    const reservas = (c.reservas || []).map(r => r.id === reservaId ? { ...r, ok:true, okTs:Date.now() } : r);
    const listo = acuerdoCampania({ reservas }).todos;
    return { ...c, reservas, ...(listo && c.estado === 'abierta' ? { estado:'acordada', cerradaEn:Date.now() } : {}) };
  };
  try{
    await api(`/campanias/${campaniaId}/acuerdo`, { method:'POST', body:JSON.stringify({ reservaId, clave }) });
    estadoSync.remoto = true;
    await sincronizar();
  }catch(e){
    if (/cerr|clave|inexistente/i.test(e.message || '')) throw e;
    estadoSync.remoto = false; estadoSync.error = String(e.message || e);
    store.set('campaniasGrupales', campanias().map(c => c.id === campaniaId ? marcar(c) : c));
  }
  return campanias().find(c => c.id === campaniaId);
}

/** Lo que gana NiJu con la campaña, ya considerando la baja de precio. */
export function resultadoCampania(c, costoUnitARS){
  const e = estadoCampania(c);
  const ingreso = e.precio * e.reservadas;
  const costo   = costoUnitARS * e.reservadas;
  return {
    unidades:e.reservadas, precio:e.precio,
    ingreso, costo, margen:Math.round(ingreso - costo),
    margenPct: ingreso ? Math.round((1 - costo / ingreso) * 100) : 0,
    capitalNecesario: c.tipo === 'preventa'
      ? Math.max(0, Math.round(costo - (c.reservas || []).reduce((a,r) => a + r.sena, 0)))
      : costo
  };
}
