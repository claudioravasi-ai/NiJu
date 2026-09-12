/* ============================================================
   NiJu — Radar de oportunidades
   ------------------------------------------------------------
   Convierte el uso de la app en una lista de qué conviene traer.
   Tres señales, en orden de valor:
     1. Pedidos de "Traelo por mí"  → demanda con nombre y apellido
     2. Brecha de precio             → cuánto margen hay
     3. Búsquedas repetidas          → cuánta gente lo quiere
   ============================================================ */
import { store } from '../state.js';
import { buscar } from './search.js';
import { STORE_BY_ID } from '../data/stores.js';

/** Cuánto más caro está acá que trayéndolo. Arriba de 1,8 hay negocio. */
export const UMBRAL_OPORTUNIDAD = 1.8;

/** Señales crudas que dejó la gente usando la app. */
export function senales(){
  const historial = store.get('historial') || [];
  const pedidos   = store.get('pedidos') || [];
  const alertas   = store.get('alertas') || [];
  const carrito   = store.get('carrito') || [];

  const conteo = new Map();
  const sumar = (texto, peso, origen) => {
    const k = (texto || '').trim().toLowerCase();
    if (k.length < 3) return;
    const a = conteo.get(k) || { termino:k, puntos:0, busquedas:0, pedidos:0, alertas:0, carritos:0 };
    a.puntos += peso;
    a[origen] = (a[origen] || 0) + 1;
    conteo.set(k, a);
  };

  historial.forEach(q => sumar(q, 1, 'busquedas'));
  pedidos.forEach(p => sumar(p.titulo, 8, 'pedidos'));     // el que pide, paga
  alertas.forEach(a => sumar(a.titulo, 4, 'alertas'));
  carrito.forEach(c => sumar(c.titulo, 3, 'carritos'));

  return [...conteo.values()].sort((a,b) => b.puntos - a.puntos);
}

/**
 * Para un término, mide la brecha entre el precio local y el de traerlo.
 * Devuelve null si no hay con qué comparar.
 */
export async function medirBrecha(termino){
  const { grupos } = await buscar(termino, { orden:'precio' }, () => {});
  if (!grupos.length) return null;

  let local = null, importado = null, ejemplo = null;
  for (const g of grupos){
    for (const o of g.ofertas){
      const t = STORE_BY_ID[o.tiendaId];
      if (!t) continue;
      const final = o.costo.finalARS;
      if (t.tipo === 'nacional' || t.tipo === 'propio'){
        if (!local || final < local.final){ local = { final, tienda:t.nombre, titulo:g.titulo, imagen:g.imagen }; }
      } else if (t.tipo === 'internacional'){
        if (!importado || final < importado.final){ importado = { final, tienda:t.nombre, titulo:g.titulo, imagen:g.imagen }; ejemplo = g; }
      }
    }
  }
  if (!local || !importado) return null;

  const indice = local.final / importado.final;
  return {
    termino, local, importado, ejemplo,
    indice: Math.round(indice * 100) / 100,
    margenARS: Math.round(local.final - importado.final),
    hayNegocio: indice >= UMBRAL_OPORTUNIDAD,
    imagen: importado.imagen || local.imagen || null
  };
}

/** El radar completo: señales + brecha medida, ordenado por lo que más conviene. */
export async function radar(maximo = 10, onPaso = () => {}){
  const s = senales().slice(0, maximo);
  const out = [];
  for (let i = 0; i < s.length; i++){
    onPaso({ hecho:i, total:s.length, termino:s[i].termino });
    try{
      const b = await medirBrecha(s[i].termino);
      if (b) out.push({ ...s[i], ...b, puntaje: puntuar(s[i], b) });
      else out.push({ ...s[i], indice:null, puntaje: s[i].puntos });
    }catch{ out.push({ ...s[i], indice:null, puntaje:s[i].puntos }); }
  }
  onPaso({ hecho:s.length, total:s.length, listo:true });
  return out.sort((a,b) => b.puntaje - a.puntaje);
}

function puntuar(senal, brecha){
  const demanda = senal.puntos;                       // cuánta gente
  const margen  = brecha ? Math.max(0, brecha.indice - 1) * 12 : 0;   // cuánto deja
  const plata   = brecha ? Math.min(20, brecha.margenARS / 15000) : 0; // cuánto en pesos
  return Math.round((demanda + margen + plata) * 10) / 10;
}

/* ============================================================
   PILOTO — punto 3: probar con pocas unidades antes de arriesgar
   ============================================================ */

export function crearPiloto({ nombre, familiaId, unidades, costoUnitARS, pvpARS, notas }){
  const p = {
    id:'pl-' + Math.random().toString(36).slice(2,9),
    nombre, familiaId, unidades, costoUnitARS, pvpARS, notas:notas || '',
    inicio: Date.now(), ventas: [], estado:'en-curso'
  };
  store.push('pilotos', p);
  return p;
}

export function registrarVenta(pilotoId, cantidad = 1){
  const ps = (store.get('pilotos') || []).map(p =>
    p.id === pilotoId ? { ...p, ventas:[...p.ventas, { ts:Date.now(), cantidad }] } : p);
  store.set('pilotos', ps);
}

/** ¿Rota o no rota? Es la única pregunta que importa en un piloto. */
export function evaluarPiloto(p){
  const vendidas = p.ventas.reduce((a,v) => a + v.cantidad, 0);
  const semanas  = Math.max(1, (Date.now() - p.inicio) / (7 * 864e5));
  const porSemana = vendidas / semanas;
  const semanasParaAgotar = porSemana > 0 ? (p.unidades - vendidas) / porSemana : Infinity;
  const margenUnit = p.pvpARS - p.costoUnitARS;
  const invertido = p.unidades * p.costoUnitARS;
  const recuperado = vendidas * p.pvpARS;

  /* Criterio: si a este ritmo el lote se agota en 8 semanas o menos,
     la demanda está probada y conviene importar en serio. */
  const veredicto =
    vendidas === 0        ? { estado:'sin-datos', texto:'Todavía no hay ventas. Dale más tiempo o revisá el precio.' } :
    semanasParaAgotar <= 8 ? { estado:'aprobado', texto:`Rota bien: a este ritmo agotás el lote en ${Math.ceil(semanasParaAgotar)} semanas. Pasalo a importación formal.` } :
    semanasParaAgotar <= 20 ? { estado:'dudoso',  texto:`Rota lento: ${Math.ceil(semanasParaAgotar)} semanas para agotar. Probá bajar el precio o cambiar la foto antes de repetir.` } :
                             { estado:'rechazado', texto:'No rota. No inviertas más en este producto.' };

  return {
    vendidas, restantes:p.unidades - vendidas,
    porSemana: Math.round(porSemana * 10) / 10,
    semanasParaAgotar: isFinite(semanasParaAgotar) ? Math.ceil(semanasParaAgotar) : null,
    margenUnit, invertido, recuperado,
    resultado: Math.round(recuperado - invertido),
    avance: Math.min(100, Math.round(vendidas / p.unidades * 100)),
    veredicto
  };
}

/* Punto 4: el piloto aprobado se convierte en producto propio. */
export function graduarANijuDirecto(p, rubro = 'herramientas'){
  const nuevo = {
    id:'nj-' + Math.random().toString(36).slice(2,9),
    n:p.nombre, emo:'📦', rubro,
    precio:p.pvpARS, precioTachado:Math.round(p.pvpARS * 1.25),
    stock:0, envioGratis:false, cuotas:6, destacado:false,
    desc:`Producto validado con piloto: ${p.unidades} unidades probadas antes de importarlo en serio.`,
    origenPiloto:p.id
  };
  store.push('nijuExtra', nuevo);
  store.set('pilotos', (store.get('pilotos') || []).map(x => x.id === p.id ? { ...x, estado:'graduado' } : x));
  return nuevo;
}
