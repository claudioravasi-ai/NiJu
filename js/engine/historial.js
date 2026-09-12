/* ============================================================
   NiJu — Historial de precios y cazador de descuentos truchos
   ------------------------------------------------------------
   La app le pregunta el precio a las tiendas todos los días. Ese
   dato, guardado, es un activo que nadie puede comprar después:
   el precio de ayer no se consigue en ningún lado.

   Con el historial podemos hacer dos cosas que ninguna tienda
   quiere que hagas:
     · Saber si un "descuento" es real o si subieron el precio
       dos semanas antes para después tacharlo.
     · Avisar cuando algo está de verdad barato, comparado con
       su propia historia y no con un precio de lista inventado.
   ============================================================ */
import { store } from '../state.js';

const MAX_DIAS = 180;

const hoy = () => new Date().toISOString().slice(0, 10);
const clave = o => `${o.tiendaId}|${o.productoId || o.titulo}`.slice(0, 120);

/** Guarda el precio del día. Un registro por producto, tienda y día. */
export function registrar(ofertas = []){
  const h = store.get('historial_precios') || {};
  const dia = hoy();
  let nuevos = 0;

  for (const o of ofertas){
    if (!o || !o.precio) continue;
    const k = clave(o);
    const serie = h[k] || { titulo:o.titulo, tiendaId:o.tiendaId, moneda:o.moneda, puntos:[] };
    const ultimo = serie.puntos[serie.puntos.length - 1];
    if (ultimo && ultimo.d === dia){ ultimo.p = o.precio; }
    else { serie.puntos.push({ d:dia, p:o.precio }); nuevos++; }
    if (serie.puntos.length > MAX_DIAS) serie.puntos = serie.puntos.slice(-MAX_DIAS);
    h[k] = serie;
  }
  store.set('historial_precios', h);
  return nuevos;
}

export function serieDe(oferta){
  const h = store.get('historial_precios') || {};
  return h[clave(oferta)] || null;
}

/**
 * Analiza el precio de hoy contra su propia historia.
 * Devuelve si el descuento es real, y con qué evidencia.
 */
export function analizar(oferta){
  const s = serieDe(oferta);
  if (!s || s.puntos.length < 2) return { hayHistoria:false, dias:s ? s.puntos.length : 0 };

  const ps = s.puntos.map(x => x.p);
  const actual = oferta.precio;
  const min = Math.min(...ps), max = Math.max(...ps);
  const promedio = Math.round(ps.reduce((a,b) => a + b, 0) / ps.length);
  const hace30 = s.puntos.slice(-31)[0];
  const variacion30 = hace30 ? Math.round((actual / hace30.p - 1) * 100) : null;

  /* El truco clásico: subir el precio y después "tacharlo".
     Si el precio de lista que publica la tienda es más alto que
     el máximo real de los últimos meses, el descuento es humo. */
  let descuentoTrucho = null;
  if (oferta.precioLista && oferta.precioLista > max * 1.03){
    descuentoTrucho = {
      listaPublicada: oferta.precioLista,
      maximoReal: max,
      infladoPct: Math.round((oferta.precioLista / max - 1) * 100),
      descuentoDeclarado: Math.round((1 - actual / oferta.precioLista) * 100),
      descuentoReal: Math.round((1 - actual / max) * 100)
    };
  }

  /* Subida reciente seguida de "oferta" */
  let subidaPrevia = null;
  if (s.puntos.length >= 10){
    const ventana = s.puntos.slice(-21);
    const pico = Math.max(...ventana.map(x => x.p));
    const antesDelPico = ventana[0].p;
    if (pico > antesDelPico * 1.12 && actual < pico * 0.95){
      subidaPrevia = { antes:antesDelPico, pico, ahora:actual,
        texto:`Subió ${Math.round((pico / antesDelPico - 1) * 100)}% y después "bajó". Contra el precio de antes, la baja real es del ${Math.round((1 - actual / antesDelPico) * 100)}%.` };
    }
  }

  const posicion = max === min ? 0 : Math.round((actual - min) / (max - min) * 100);

  return {
    hayHistoria:true, dias:s.puntos.length,
    actual, min, max, promedio, variacion30, posicion,
    esElMasBajo: actual <= min,
    baratoDeVerdad: actual <= promedio * 0.9,
    descuentoTrucho, subidaPrevia,
    veredicto:
      descuentoTrucho ? { t:'bad',  m:`Descuento inflado: dicen ${descuentoTrucho.descuentoDeclarado}% pero contra el precio real más alto es ${descuentoTrucho.descuentoReal}%.` } :
      subidaPrevia    ? { t:'warn', m:subidaPrevia.texto } :
      actual <= min   ? { t:'ok',   m:`Es el precio más bajo de los últimos ${s.puntos.length} días.` } :
      actual <= promedio * 0.9 ? { t:'ok', m:`Está ${Math.round((1 - actual / promedio) * 100)}% por debajo de su promedio.` } :
      actual >= max * 0.98 ? { t:'warn', m:'Está en su precio más alto. Conviene esperar.' } :
      { t:'', m:`Precio normal para este producto (promedio de los últimos ${s.puntos.length} días: $${promedio.toLocaleString('es-AR')}).` }
  };
}

/** Todos los descuentos truchos detectados: material de prensa. */
export function truchosDetectados(){
  const h = store.get('historial_precios') || {};
  const out = [];
  for (const [k, s] of Object.entries(h)){
    if (s.puntos.length < 5) continue;
    const ps = s.puntos.map(x => x.p);
    const max = Math.max(...ps), min = Math.min(...ps);
    const actual = ps[ps.length - 1];
    if (max > min * 1.25 && actual < max * 0.9){
      out.push({ clave:k, titulo:s.titulo, tiendaId:s.tiendaId,
        min, max, actual, infladoPct:Math.round((max / min - 1) * 100) });
    }
  }
  return out.sort((a,b) => b.infladoPct - a.infladoPct);
}

/** Índice propio: cuánto se movieron los precios que miramos. */
export function indiceNiju(dias = 30){
  const h = store.get('historial_precios') || {};
  let suben = 0, bajan = 0, igual = 0, acum = 0, n = 0;
  for (const s of Object.values(h)){
    if (s.puntos.length < 2) continue;
    const ref = s.puntos.slice(-(dias + 1))[0];
    const act = s.puntos[s.puntos.length - 1];
    if (!ref || ref.p === 0) continue;
    const v = act.p / ref.p - 1;
    acum += v; n++;
    if (v > 0.005) suben++; else if (v < -0.005) bajan++; else igual++;
  }
  return {
    productos:n, dias,
    variacionPromedio: n ? Math.round(acum / n * 1000) / 10 : 0,
    suben, bajan, igual
  };
}

export const tamanoHistorial = () => Object.keys(store.get('historial_precios') || {}).length;
