/* ============================================================
   NiJu — Registro de conectores
   Un solo lugar decide, para cada tienda, si se consulta el
   conector DEMO o el conector real (a través del proxy propio).
   Cambiar de demo a producción = cambiar MODO y levantar el proxy.
   ============================================================ */
import { STORES } from '../data/stores.js';
import { ConectorDemo } from './demo.js';
import { ConectorProxy } from './proxy.js';
import { ConectorNiju } from './niju.js';
import { CONFIG } from '../config.js';

const cache = new Map();

/** ¿Esta tienda trae precio de verdad, o todavía está simulada? */
export function esReal(tiendaId){
  if (CONFIG.modoDatos === 'demo')  return false;
  if (CONFIG.modoDatos === 'proxy') return true;
  return CONFIG.tiendasReales.includes(tiendaId);   // 'mixto'
}

export function conectorDe(tienda){
  if (cache.has(tienda.id)) return cache.get(tienda.id);
  let c;
  if (tienda.tipo === 'propio')      c = new ConectorNiju(tienda);
  else if (esReal(tienda.id))        c = new ConectorProxy(tienda);
  else                               c = new ConectorDemo(tienda);
  cache.set(tienda.id, c);
  return c;
}

export function tiendasActivas(filtro = {}){
  return STORES.filter(t => {
    if (CONFIG.tiendasApagadas.includes(t.id)) return false;
    /* Cuando el usuario elige recorrer una tienda, le preguntamos solo
       a esa: no tiene sentido molestar a las otras veintiséis. */
    if (filtro.ids?.length && !filtro.ids.includes(t.id)) return false;
    /* Sin datos reales no se publica: una oferta simulada no le sirve
       a nadie y encima ensucia la comparación. */
    if (CONFIG.soloReales && t.tipo !== 'propio' && !esReal(t.id)) return false;
    if (filtro.tipos?.length && !filtro.tipos.includes(t.tipo)) return false;
    if (filtro.rubro && !t.rubros.includes(filtro.rubro) && t.tipo !== 'propio') return false;
    if (filtro.mayorista && !t.mayorista) return false;
    return true;
  });
}
