/* ============================================================
   NiJu — Bolsa de demanda
   ------------------------------------------------------------
   Da vuelta el comercio: en vez de que la oferta espere al
   cliente, es la demanda la que sale a buscar, con plata puesta.

   El cliente publica: "quiero esto, pago hasta tanto, espero
   hasta tal día". La app junta a todos los que pidieron lo mismo
   y publica UNA orden agregada. Compiten por llenarla las tiendas
   con stock parado, los importadores, los mayoristas y NiJu.

   Lo que no se llena es la mejor información del negocio: es
   demanda real, con nombre y apellido, que nadie está sirviendo.
   ============================================================ */
import { store } from '../state.js';
import { uid } from '../util.js';
import { CONFIG } from '../config.js';
import { cabecerasAdmin } from './sesion.js';
import { similitud, limpiar, tokens } from './normalize.js';

export const SENA_DEMANDA = 0.15;      // lo que deja el que pide
export const DIAS_DEFECTO = 12;

export const estadoSyncDemanda = { remoto:false, error:null };

async function api(ruta, opciones){
  const r = await fetch(CONFIG.api + ruta, {
    ...opciones, headers:{ 'content-type':'application/json', accept:'application/json', ...cabecerasAdmin() }
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

export const ordenes = () => store.get('ordenesDemanda') || [];

export async function sincronizarDemanda(){
  try{
    const d = await api('/demanda');
    store.set('ordenesDemanda', d.ordenes || []);
    estadoSyncDemanda.remoto = true; estadoSyncDemanda.error = null;
  }catch(e){
    estadoSyncDemanda.remoto = false; estadoSyncDemanda.error = String(e.message || e);
  }
  return ordenes();
}

/** Publicar una demanda. Esto no es una consulta: es un compromiso. */
export async function publicar({ titulo, detalle, precioMax, cantidad = 1, dias = DIAS_DEFECTO, autor, email, rubro, imagen }){
  const o = {
    id:'od-' + uid(), titulo:titulo.trim(), detalle:detalle || '', rubro:rubro || null, imagen:imagen || null,
    precioMax:Math.round(precioMax), cantidad:Math.max(1, cantidad),
    autor:autor || 'Anónimo', email:email || null,
    sena: Math.round(precioMax * cantidad * SENA_DEMANDA),
    creada:Date.now(), vence:Date.now() + dias * 864e5,
    ofertas:[], estado:'abierta'
  };
  try{
    const d = await api('/demanda', { method:'POST', body:JSON.stringify(o) });
    estadoSyncDemanda.remoto = true;
    await sincronizarDemanda();
    return d.orden || o;
  }catch(e){
    estadoSyncDemanda.remoto = false; estadoSyncDemanda.error = String(e.message || e);
    store.push('ordenesDemanda', o);
    return o;
  }
}

/** Un proveedor se ofrece a llenar la orden. */
export async function ofertar(ordenId, { proveedor, precio, cantidad, plazoDias, notas }){
  const of = { id:uid(), proveedor, precio:Math.round(precio), cantidad:Math.max(1, cantidad),
               plazoDias:plazoDias || null, notas:notas || '', ts:Date.now() };
  try{
    await api(`/demanda/${ordenId}/ofertar`, { method:'POST', body:JSON.stringify(of) });
    await sincronizarDemanda();
  }catch(e){
    estadoSyncDemanda.remoto = false; estadoSyncDemanda.error = String(e.message || e);
    store.set('ordenesDemanda', ordenes().map(o =>
      o.id !== ordenId ? o : { ...o, ofertas:[...(o.ofertas || []), of] }));
  }
  return ordenes().find(o => o.id === ordenId);
}

/**
 * ¿Dos personas están pidiendo lo mismo?
 * Acá la vara tiene que ser MÁS BLANDA que al comparar productos de una
 * tienda: uno escribe "iMac 24 pulgadas M1" y el otro "iMac 24 M1 256GB",
 * y están pidiendo la misma máquina. Si no los juntamos, la bolsa no
 * sirve para nada: el valor está justo en sumar la demanda.
 */
export function mismaIntencion(a, b){
  if (limpiar(a) === limpiar(b)) return true;
  const ta = new Set(tokens(a)), tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return false;
  let comunes = 0;
  for (const t of ta) if (tb.has(t)) comunes++;
  const chico = Math.min(ta.size, tb.size);
  return comunes / chico >= 0.5 && comunes >= 2;
}

/**
 * Junta órdenes que piden lo mismo. Acá está el valor: una persona
 * pidiendo no mueve a nadie; 140 pidiendo lo mismo mueven a todos.
 */
export function agregar(lista = ordenes()){
  const bloques = [];
  for (const o of lista){
    if (o.estado === 'cerrada') continue;
    const destino = bloques.find(b => mismaIntencion(b.titulo, o.titulo));
    if (destino) destino.ordenes.push(o);
    else bloques.push({ titulo:o.titulo, imagen:o.imagen, rubro:o.rubro, ordenes:[o] });
  }
  return bloques.map(b => {
    const unidades = b.ordenes.reduce((a,o) => a + o.cantidad, 0);
    const precios  = b.ordenes.map(o => o.precioMax);
    const comprometido = b.ordenes.reduce((a,o) => a + o.precioMax * o.cantidad, 0);
    const senas = b.ordenes.reduce((a,o) => a + o.sena, 0);
    const vence = Math.min(...b.ordenes.map(o => o.vence));
    const todasLasOfertas = b.ordenes.flatMap(o => (o.ofertas || []).map(x => ({ ...x, ordenId:o.id })));
    const mejor = todasLasOfertas.slice().sort((a,b2) => a.precio - b2.precio)[0] || null;

    return {
      ...b, unidades, personas:b.ordenes.length,
      precioMaxPromedio: Math.round(precios.reduce((a,p) => a + p, 0) / precios.length),
      precioMaxMinimo: Math.min(...precios),
      comprometido: Math.round(comprometido),
      senas: Math.round(senas),
      vence, diasRestantes: Math.max(0, Math.ceil((vence - Date.now()) / 864e5)),
      ofertas: todasLasOfertas.sort((a,b2) => a.precio - b2.precio),
      mejorOferta: mejor,
      llenable: mejor ? mejor.precio <= Math.min(...precios) : false,
      imagen: b.ordenes.find(o => o.imagen)?.imagen || null
    };
  }).sort((a,b) => b.comprometido - a.comprometido);
}

/** Lo que el dueño necesita saber: qué pidieron y nadie sirvió. */
export function sinSatisfacer(){
  return agregar().filter(b => !b.llenable)
                  .map(b => ({ ...b, oportunidad: b.comprometido }));
}

/** Si NiJu la llena importando, ¿cuánto deja? */
export function simularLlenado(bloque, costoUnitARS){
  const precio = bloque.precioMaxMinimo;   // para llenar hay que respetar al más exigente
  const ingreso = precio * bloque.unidades;
  const costo = costoUnitARS * bloque.unidades;
  return {
    unidades:bloque.unidades, precio, ingreso, costo,
    margen: Math.round(ingreso - costo),
    margenPct: ingreso ? Math.round((1 - costo / ingreso) * 100) : 0,
    capitalPropio: Math.max(0, Math.round(costo - bloque.senas)),
    financiadoPorClientes: Math.min(100, Math.round(bloque.senas / costo * 100))
  };
}
