/* ============================================================
   NiJu — Orquestador de búsqueda
   Dispara TODAS las tiendas en paralelo, no espera a la más
   lenta para mostrar la primera (resultados en streaming),
   agrupa por producto, y calcula el precio PUESTO EN CASA:
   producto + envío + impuestos de importación + tipo de cambio.
   ============================================================ */
import { tiendasActivas, conectorDe } from '../connectors/registry.js';
import { agrupar, relevancia } from './normalize.js';
import { aPesos } from './fx.js';
import { calcularImportacion } from './taxes.js';
import { STORE_BY_ID } from '../data/stores.js';
import { RUBRO_BY_ID } from '../data/catalog.js';
import { CONFIG } from '../config.js';
import { registrar } from './historial.js';

const cache = new Map();

/**
 * @param {string} consulta
 * @param {object} opts { rubro, tipos:[], mayorista, via, regimen, usadoAnualUSD }
 * @param {(estado)=>void} onProgreso  se llama en cada tienda que responde
 */
export async function buscar(consulta, opts = {}, onProgreso = () => {}){
  /* Entrar por rubro no manda ninguna palabra, y las tiendas reales
     necesitan una para poder buscar. Por eso cada rubro tiene su
     palabra representativa: así la pantalla nunca queda vacía. */
  if (!(consulta || '').trim() && opts.rubro){
    consulta = RUBRO_BY_ID[opts.rubro]?.busqueda || '';
    opts = { ...opts, porRubro:true };
  }

  const claveCache = JSON.stringify([consulta, opts.rubro, opts.tipos, opts.mayorista, opts.ids, opts.desde]);
  const hit = cache.get(claveCache);
  if (opts.forzar) cache.delete(claveCache);
  if (!opts.forzar && hit && Date.now() - hit.ts < CONFIG.cacheBusquedaMs){
    onProgreso({ tiendas:hit.estado, listo:true });
    return hit.res;
  }

  const tiendas = tiendasActivas({ rubro:opts.rubro, tipos:opts.tipos, mayorista:opts.mayorista, ids:opts.ids });
  const estado = tiendas.map(t => ({ id:t.id, nombre:t.nombre, estado:'run', ms:0, n:0 }));
  onProgreso({ tiendas:estado, listo:false });

  let todas = [];
  const t0 = performance.now();

  await Promise.all(tiendas.map(async (t, i) => {
    const ini = performance.now();
    try{
      const ofertas = await conectorDe(t).buscar(consulta, opts);
      todas.push(...ofertas);
      estado[i] = { ...estado[i], estado:'done', ms:Math.round(performance.now() - ini), n:ofertas.length };
    }catch(e){
      estado[i] = { ...estado[i], estado:'fail', ms:Math.round(performance.now() - ini), error:String(e.message || e) };
    }
    /* Con cada tienda que contesta se mandan las ofertas juntadas hasta
       ahora: la pantalla muestra lo que ya hay mientras siguen las demás. */
    onProgreso({ tiendas:[...estado], listo:false, ofertas:todas });
  }));

  /* Cada consulta alimenta el historial. Es el activo que nadie
     puede comprar después: el precio de ayer no se consigue. */
  try{ registrar(todas); }catch{}

  const res = procesar(todas, consulta, opts);
  res.meta = {
    consultado: Date.now(),
    desde: opts.desde || 0,
    /* Si alguna tienda devolvió el cupo completo, es probable que tenga
       más para dar: ofrecemos seguir. */
    hayMas: estado.some(e => e.estado === 'done' && e.n >= (opts.limite || 24) * 0.6),
    ms: Math.round(performance.now() - t0),
    tiendasOk: estado.filter(e => e.estado === 'done').length,
    tiendasTotal: tiendas.length,
    ofertas: todas.length
  };
  cache.set(claveCache, { ts:Date.now(), res, estado });
  onProgreso({ tiendas:estado, listo:true });
  return res;
}

/** Agrupa, calcula costo final y ordena. */
export function procesar(ofertas, consulta, opts = {}){
  const via = opts.via || CONFIG.tipoCambioCompra;
  const conCosto = ofertas.map(o => ({ ...o, costo: costoPuestoEnCasa(o, opts) }));

  const grupos = agrupar(conCosto).map(g => {
    /* Red de seguridad: una tienda no vende dos veces EL MISMO producto a
       precios distintos. Si aparece repetida es que el agrupado se pasó de
       generoso; nos quedamos con su oferta más barata. Sin esto, la app
       anuncia ahorros que no existen. */
    const porTienda = new Map();
    for (const o of g.ofertas.slice().sort((a,b) => a.costo.finalARS - b.costo.finalARS)){
      if (!porTienda.has(o.tiendaId)) porTienda.set(o.tiendaId, o);
    }
    let lista = [...porTienda.values()].sort((a,b) => a.costo.finalARS - b.costo.finalARS);

    /* Segunda red de seguridad: dentro de un mismo producto los precios
       no pueden diferir tanto. Si una oferta cuesta más del triple que la
       más barata, no es el mismo producto: el agrupador se equivocó.
       Sin esto la app anuncia "ahorrás $36.991" en algo que vale $8.600,
       que es un ahorro imposible y deja a la app como mentirosa. */
    if (lista.length > 1){
      const piso = lista[0].costo.finalARS;
      const creibles = lista.filter(o => o.costo.finalARS <= piso * 3);
      if (creibles.length >= 1) lista = creibles;
    }
    const mejor = lista[0];
    const peor  = lista[lista.length - 1];
    const base  = lista.find(x => x.propio) || mejor;
    return {
      clave: g.clave,
      productoId: mejor.productoId,
      titulo: base.titulo,
      marca: base.marca,
      emo: base.emo,
      /* la foto sale de la oferta que realmente vas a comprar; si esa no
         tiene, buscamos la primera del grupo que sí */
      imagen: mejor.imagen || (lista.find(o => o.imagen) || {}).imagen || null,
      rubro: base.rubro,
      specs: base.specs,
      ofertas: lista,
      mejor, peor,
      ahorro: Math.max(0, peor.costo.finalARS - mejor.costo.finalARS),
      ahorroPct: peor.costo.finalARS ? Math.round((1 - mejor.costo.finalARS / peor.costo.finalARS) * 100) : 0,
      tiendas: new Set(lista.map(o => o.tiendaId)).size,
      hayPropio: lista.some(o => o.propio),
      demanda: base.demanda || 5,
      rel: relevancia(consulta || '', base)
    };
  });

  /* Con una consulta escrita, sacamos lo que apenas roza el pedido:
     "notebook" no puede devolver una mochila para notebook. */
  /* Si nada tiene que ver con lo que buscó, no mostramos nada.
     Antes, cuando el filtro descartaba todo, volvíamos a mostrar lo
     descartado para no dejar la pantalla vacía: así aparecía el
     "adhesivo para zapatillas" cuando alguien buscaba zapatillas.
     Es peor que una pantalla vacía, porque el cliente desconfía. */
  const usados = (consulta || '').trim()
    ? grupos.filter(g => g.rel >= 0.45)
    : grupos;
  grupos.length = 0; grupos.push(...usados);

  const orden = opts.orden || 'relevancia';
  grupos.sort((a,b) => {
    if (orden === 'precio')   return a.mejor.costo.finalARS - b.mejor.costo.finalARS;
    if (orden === 'ahorro')   return b.ahorroPct - a.ahorroPct;
    if (orden === 'entrega')  return a.mejor.entregaDias[0] - b.mejor.entregaDias[0];
    if (orden === 'tiendas')  return b.tiendas - a.tiendas;
    return (b.rel * 2 + b.demanda / 10 + b.ahorroPct / 60) - (a.rel * 2 + a.demanda / 10 + a.ahorroPct / 60);
  });

  return { grupos, via };
}

/**
 * Precio puesto en casa = producto + envío + nacionalización + cambio.
 * Es EL número con el que se comparan tiendas de países distintos.
 */
export function costoPuestoEnCasa(o, opts = {}){
  const t = STORE_BY_ID[o.tiendaId] || {};
  const via = opts.via || CONFIG.tipoCambioCompra;
  const internacional = t.tipo === 'internacional' || (t.tipo === 'social' && t.moneda !== 'ARS');

  const productoARS = aPesos(o.precio, o.moneda, via);
  const envioARS    = aPesos(o.envio || 0, o.moneda, via);

  let impuestosARS = 0, detalleImp = null, bloqueado = false;

  if (internacional){
    const valorUSD = o.moneda === 'USD' ? o.precio
                   : o.moneda === 'CNY' ? o.precio * 0.1385
                   : o.precio / 1000;
    const fleteUSD = o.moneda === 'USD' ? (o.envio || 0) : (o.envio || 0) * 0.1385;
    detalleImp = calcularImportacion({
      valorUSD, fleteUSD, pesoKg:o.pesoKg || 1, rubro:o.rubro,
      unidades:1, regimen: opts.regimen || 'courier', usadoAnualUSD: opts.usadoAnualUSD || 0
    });
    impuestosARS = aPesos(detalleImp.impuestos + (detalleImp.gastos || 0), 'USD', via);
    bloqueado = detalleImp.bloqueado;
  }

  const servicioARS = internacional ? (productoARS + envioARS) * CONFIG.feeServicio : 0;
  const finalARS = Math.round(productoARS + envioARS + impuestosARS + servicioARS);

  return {
    productoARS:Math.round(productoARS),
    envioARS:Math.round(envioARS),
    impuestosARS:Math.round(impuestosARS),
    servicioARS:Math.round(servicioARS),
    finalARS, internacional, bloqueado, detalleImp, via
  };
}

/** Radar: mejores ofertas del momento, con o sin rubro. */
export async function radar(rubro = null, onProgreso = () => {}){
  const { grupos } = await buscar('', { rubro, orden:'ahorro' }, onProgreso);
  return grupos.filter(g => g.mejor.descuento > 0 || g.ahorroPct > 12).slice(0, 24);
}
