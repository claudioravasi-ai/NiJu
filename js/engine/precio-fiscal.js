/* ============================================================
   NiJu — "El precio que te corresponde a vos"
   ------------------------------------------------------------
   El mismo producto tiene precios reales distintos según quién
   lo compra. Un responsable inscripto recupera el IVA; un
   monotributista no. Y una tienda que te da factura A puede
   convenirte aunque su precio de vidriera sea más alto.
   Ningún comparador muestra esto. Este sí.
   ============================================================ */
import { PERFILES } from './fiscal.js';
import { ALICUOTAS } from './facturacion.js';
import { STORE_BY_ID } from '../data/stores.js';

const IVA = ALICUOTAS.iva;

/**
 * Costo real de una oferta para un perfil tributario.
 * @param {object} oferta  con .costo ya calculado
 * @param {string} perfilId
 */
export function precioReal(oferta, perfilId = 'consumidor_final'){
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  const t = STORE_BY_ID[oferta.tiendaId] || {};
  const c = oferta.costo || {};
  const bruto = c.finalARS || oferta.precio || 0;

  /* ¿La tienda emite factura A? Sin factura A no hay crédito fiscal,
     por más responsable inscripto que seas. */
  const daFacturaA = t.facturaA !== false && t.tipo !== 'social';

  let recupera = 0;
  const notas = [];

  if (P.computaIVA && daFacturaA && !c.internacional){
    /* El precio de góndola tiene el IVA adentro: se descuenta. */
    recupera += bruto - bruto / (1 + IVA);
    notas.push(`Recuperás el IVA del ${(IVA*100).toFixed(0)}% porque te dan factura A.`);
  } else if (P.computaIVA && !daFacturaA){
    notas.push('Esta tienda no emite factura A: el IVA te queda como costo.');
  } else if (!P.computaIVA){
    notas.push(`Tu condición (${P.label}) no permite computar el IVA: forma parte del costo.`);
  }

  if (c.internacional && c.detalleImp && P.computaIVA && c.detalleImp.recuperable){
    notas.push('En importación formal también recuperás el IVA y las percepciones.');
  }

  const real = Math.round(bruto - recupera);
  return {
    perfil:P, bruto:Math.round(bruto), recupera:Math.round(recupera), real,
    ahorroPct: bruto ? Math.round(recupera / bruto * 100) : 0,
    daFacturaA, notas
  };
}

/** El mismo producto, visto por los cuatro tipos de comprador. */
export function tablaPerfiles(oferta){
  return Object.keys(PERFILES).map(id => ({ id, ...precioReal(oferta, id) }));
}

/**
 * Reordena las ofertas de un grupo según TU precio real.
 * Acá aparece lo interesante: la más barata de vidriera no siempre
 * es la más barata para vos.
 */
export function mejorParaVos(ofertas, perfilId){
  const conReal = ofertas.map(o => ({ oferta:o, calc:precioReal(o, perfilId) }))
                         .sort((a,b) => a.calc.real - b.calc.real);
  const porVidriera = ofertas.slice().sort((a,b) => (a.costo?.finalARS || 0) - (b.costo?.finalARS || 0));

  const cambia = conReal[0]?.oferta.tiendaId !== porVidriera[0]?.tiendaId;
  return {
    lista: conReal,
    mejor: conReal[0],
    mejorVidriera: porVidriera[0],
    cambiaElGanador: cambia,
    mensaje: cambia
      ? `Para vos conviene ${STORE_BY_ID[conReal[0].oferta.tiendaId]?.nombre}, aunque en la vidriera parezca más caro que ${STORE_BY_ID[porVidriera[0].tiendaId]?.nombre}.`
      : null
  };
}

/** ¿Le conviene cambiar de condición fiscal para esta compra? */
export function conviendCambiar(oferta, perfilActual){
  const tabla = tablaPerfiles(oferta);
  const actual = tabla.find(x => x.id === perfilActual);
  const mejor = tabla.slice().sort((a,b) => a.real - b.real)[0];
  if (!actual || mejor.id === perfilActual) return null;
  const dif = actual.real - mejor.real;
  if (dif < 1000) return null;
  return {
    de:actual.perfil.label, a:mejor.perfil.label, diferencia:Math.round(dif),
    texto:`Como ${mejor.perfil.label} esta compra te saldría ${Math.round(dif).toLocaleString('es-AR')} pesos menos. No es un consejo de inscripción: es una cuenta. Hablalo con tu contador.`
  };
}
