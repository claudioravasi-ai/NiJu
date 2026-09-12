/* ============================================================
   NiJu — Motor impositivo de importación
   ------------------------------------------------------------
   ⚠️ LEER ANTES DE USAR EN PRODUCCIÓN
   Los valores de REGLAS son PARÁMETROS EDITABLES precargados con
   los que creemos vigentes. La normativa argentina de importación
   cambia varias veces por año: ANTES DE PUBLICAR hay que
   contrastar cada número contra el texto oficial de ARCA y dejar
   `verificado:true` con fecha y número de resolución.
   El motor está hecho para que cambiar un número sea cambiar una
   línea de este archivo (o un documento en Firestore), no tocar
   la lógica.
   ============================================================ */

export const REGLAS = {
  actualizado: '2026-09-12',
  verificado: false,
  fuente: 'https://www.arca.gob.ar/  (pendiente de contrastar)',

  /* --- Régimen courier puerta a puerta (simplificado) --- */
  courier: {
    nombre: 'Courier puerta a puerta (simplificado)',
    topeValorUSD: 3000,        // valor máximo declarado por envío
    topePesoKg: 50,            // peso máximo por envío
    franquiciaUSD: 400,        // tramo exento por envío, uso personal
    franquiciasPorAnio: null,  // null = sin tope anual declarado. VERIFICAR.
    derechoExcedente: 0.50,    // % sobre el valor que supera la franquicia
    ivaIncluido: true,         // en el simplificado el 50% engloba todo
    unidadesPorItem: 3,        // más de N iguales ⇒ se presume fin comercial
    requiereCUIT: false,
    nota: 'Uso personal, sin fines comerciales. Superado el tope hay que importar de forma general con despachante.'
  },

  /* --- Régimen general / formal (mayorista, importación comercial) --- */
  general: {
    nombre: 'Importación general (con despachante)',
    derechoPorDefecto: 0.18,   // arancel promedio; el real depende de la posición NCM
    tasaEstadistica: 0.03,     // con topes por tramo de valor
    iva: 0.21,
    ivaAdicional: 0.20,        // percepción RG 2937 (responsables inscriptos)
    ganancias: 0.06,           // percepción RG 2281
    iibb: 0.025,               // percepción provincial (varía por jurisdicción)
    honorariosDespachante: 0.01,
    gastosFijosUSD: 180,       // portuarios/aeroportuarios + verificación
    requiereCUIT: true,
    nota: 'Requiere CUIT, inscripción en el Registro de Importadores y despachante de aduana matriculado.'
  },

  /* --- Compras con tarjeta al exterior --- */
  tarjeta: {
    percepcionGanancias: 0.00, // VERIFICAR: cambió varias veces entre 2024 y 2026
    nota: 'Percepción a cuenta de Ganancias sobre consumos en moneda extranjera. Recuperable en la DDJJ anual.'
  },

  /* --- Aranceles por rubro (aproximación por NCM, para el régimen general) --- */
  arancelPorRubro: {
    tecnologia:16, celulares:16, electro:20, hogar:20, moda:35, belleza:18,
    deportes:20, herramientas:14, construccion:14, gaming:20, juguetes:20,
    bebes:18, mascotas:14, salud:8, autos:18, jardin:14, libros:0, super:16,
    mayorista:18, _default:18
  }
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * Calcula el costo de nacionalización de una compra internacional.
 * @param {object} o
 * @param {number} o.valorUSD   valor de la mercadería (sin envío)
 * @param {number} o.fleteUSD   costo del envío internacional
 * @param {number} o.pesoKg
 * @param {string} o.rubro
 * @param {number} o.unidades
 * @param {'courier'|'general'} o.regimen
 * @param {number} o.usadoAnualUSD  franquicia ya consumida en el año
 */
export function calcularImportacion(o){
  const {
    valorUSD = 0, fleteUSD = 0, seguroUSD = 0, pesoKg = 0,
    rubro = '_default', unidades = 1, regimen = 'courier', usadoAnualUSD = 0
  } = o;

  const avisos = [];
  const lineas = [];

  if (regimen === 'courier'){
    const C = REGLAS.courier;
    const excedePeso  = pesoKg > C.topePesoKg;
    const excedeValor = valorUSD > C.topeValorUSD;
    const excedeUnid  = unidades > C.unidadesPorItem;

    if (excedeValor) avisos.push({ t:'bad',  m:`Supera los US$ ${C.topeValorUSD} por envío del régimen courier. Hay que importar de forma general.` });
    if (excedePeso)  avisos.push({ t:'bad',  m:`Supera los ${C.topePesoKg} kg por envío. No entra por courier.` });
    if (excedeUnid)  avisos.push({ t:'warn', m:`Más de ${C.unidadesPorItem} unidades iguales: Aduana puede presumir fin comercial y rechazar el uso personal.` });

    const franqDisponible = Math.max(0, C.franquiciaUSD - usadoAnualUSD);
    const cubierto  = Math.min(valorUSD, franqDisponible);
    const excedente = Math.max(0, valorUSD - cubierto);
    const derecho   = r2(excedente * C.derechoExcedente);

    lineas.push({ k:'Mercadería',                v:valorUSD, tipo:'base' });
    lineas.push({ k:'Flete internacional',       v:fleteUSD, tipo:'base' });
    if (seguroUSD) lineas.push({ k:'Seguro',     v:seguroUSD, tipo:'base' });
    lineas.push({ k:`Franquicia aplicada (exenta)`, v:-0, tipo:'info', detalle:`US$ ${r2(cubierto)} de US$ ${C.franquiciaUSD}` });
    lineas.push({ k:`Derecho sobre excedente (${C.derechoExcedente*100}%)`, v:derecho, tipo:'impuesto',
                  detalle: excedente ? `sobre US$ ${r2(excedente)}` : 'sin excedente' });

    const impuestos = derecho;
    const total = r2(valorUSD + fleteUSD + seguroUSD + impuestos);

    if (!excedente) avisos.push({ t:'ok', m:'Entra completo dentro de la franquicia: no paga derechos.' });

    return {
      regimen:'courier', lineas, avisos, impuestos, total,
      franquicia:{ tope:C.franquiciaUSD, usado:usadoAnualUSD, aplicada:r2(cubierto), restante:r2(Math.max(0, franqDisponible - cubierto)) },
      bloqueado: excedeValor || excedePeso,
      tasaEfectiva: valorUSD ? r2(impuestos / valorUSD * 100) : 0
    };
  }

  /* --- Régimen general --- */
  const G = REGLAS.general;
  const arancelPct = (REGLAS.arancelPorRubro[rubro] ?? REGLAS.arancelPorRubro._default) / 100;
  const cif = valorUSD + fleteUSD + seguroUSD;

  const derecho   = r2(cif * arancelPct);
  const estad     = r2(cif * G.tasaEstadistica);
  const baseIva   = cif + derecho + estad;
  const iva       = r2(baseIva * G.iva);
  const ivaAd     = r2(baseIva * G.ivaAdicional);
  const gan       = r2(baseIva * G.ganancias);
  const iibb      = r2(baseIva * G.iibb);
  const honor     = r2(cif * G.honorariosDespachante);
  const fijos     = G.gastosFijosUSD;

  lineas.push({ k:'Mercadería (FOB)',                     v:valorUSD, tipo:'base' });
  lineas.push({ k:'Flete + seguro',                       v:r2(fleteUSD + seguroUSD), tipo:'base' });
  lineas.push({ k:`Derecho de importación (${(arancelPct*100).toFixed(0)}%)`, v:derecho, tipo:'impuesto' });
  lineas.push({ k:`Tasa de estadística (${G.tasaEstadistica*100}%)`, v:estad, tipo:'impuesto' });
  lineas.push({ k:`IVA (${G.iva*100}%)`,                  v:iva,    tipo:'impuesto', recuperable:true });
  lineas.push({ k:`IVA adicional (${G.ivaAdicional*100}%)`, v:ivaAd, tipo:'impuesto', recuperable:true });
  lineas.push({ k:`Percepción Ganancias (${G.ganancias*100}%)`, v:gan, tipo:'impuesto', recuperable:true });
  lineas.push({ k:`Percepción IIBB (${G.iibb*100}%)`,      v:iibb,   tipo:'impuesto', recuperable:true });
  lineas.push({ k:'Honorarios despachante',               v:honor,  tipo:'gasto' });
  lineas.push({ k:'Gastos portuarios y verificación',     v:fijos,  tipo:'gasto' });

  const impuestos  = r2(derecho + estad + iva + ivaAd + gan + iibb);
  const gastos     = r2(honor + fijos);
  const recuperable= r2(iva + ivaAd + gan + iibb);
  const total      = r2(cif + impuestos + gastos);

  avisos.push({ t:'warn', m:'Necesitás CUIT, inscripción en el Registro de Importadores y despachante de aduana.' });
  avisos.push({ t:'ok',   m:`US$ ${recuperable} son recuperables o computables si sos responsable inscripto.` });

  return {
    regimen:'general', lineas, avisos, impuestos, gastos, recuperable, total,
    costoReal: r2(total - recuperable),
    bloqueado:false,
    tasaEfectiva: valorUSD ? r2((impuestos + gastos) / valorUSD * 100) : 0
  };
}

/** Sugiere el régimen más barato para una compra dada. */
export function mejorRegimen(o){
  const c = calcularImportacion({ ...o, regimen:'courier' });
  const g = calcularImportacion({ ...o, regimen:'general' });
  if (c.bloqueado) return { elegido:'general', courier:c, general:g, motivo:'Excede los límites del courier.' };
  const ahorro = Math.round(g.total - c.total);
  return { elegido:'courier', courier:c, general:g, motivo:`El courier sale US$ ${ahorro} menos en esta compra.` };
}

/** Estado anual de franquicia de un cliente (para el panel impositivo). */
export function estadoFranquicia(comprasDelAnio = []){
  const usado = comprasDelAnio.reduce((a,c) => a + (c.valorUSD || 0), 0);
  const tope  = REGLAS.courier.franquiciaUSD;
  return {
    usado: Math.round(usado), topePorEnvio: tope, envios: comprasDelAnio.length,
    nota: REGLAS.courier.franquiciasPorAnio
      ? `Franquicias usadas: ${comprasDelAnio.length} de ${REGLAS.courier.franquiciasPorAnio} por año.`
      : 'La franquicia es por envío. Verificar si hay tope anual vigente.'
  };
}
