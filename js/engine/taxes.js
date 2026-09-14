/* ============================================================
   NiJu — Motor impositivo rápido (listados y carrito)
   ------------------------------------------------------------
   Se usa donde todavía no se sabe la posición NCM exacta del
   producto (resultados de búsqueda, carrito, mayorista): el
   derecho de importación va APROXIMADO POR RUBRO y así se dice.
   El desglose completo, con la alícuota real del Arancel
   Integrado de ARCA y cada etapa del envío, está en
   engine/importacion.js.

   Corrección del 14-09-2026: antes el courier cobraba un 50% sobre
   lo que pasaba los US$ 400 y no cobraba IVA. Eso no es la norma.
   ARCA: hasta US$ 400 FOB no paga derecho ni tasa de estadística,
   pero SÍ IVA; sobre el excedente paga derecho y tasa; 5 envíos por
   año, 3 unidades iguales, 50 kg y US$ 3.000 como máximo.
   ============================================================ */
import { NORMAS, topeTasaEstadistica } from '../data/normas-importacion.js';

const PE = NORMAS.pequenoEnvio;

export const REGLAS = {
  actualizado: '2026-09-14',
  verificado: true,          // reglas del régimen: página oficial de ARCA
  fuente: PE.fuentes[0].url,

  courier: {
    nombre: PE.nombre,
    topeValorUSD: PE.valorMaxUSD,
    topePesoKg: PE.pesoMaxKg,
    franquiciaUSD: PE.franquiciaFOB,
    franquiciasPorAnio: PE.enviosPorAnio,
    unidadesPorItem: PE.unidadesIguales,
    tasaEstadistica: NORMAS.tasaEstadistica.pct,
    iva: NORMAS.iva.general,
    requiereCUIT: false,
    nota: PE.texto + ' Sin fin comercial: para vender corresponde importación general con despachante.'
  },

  general: {
    nombre: 'Importación general (con despachante)',
    derechoPorDefecto: 0.18,
    tasaEstadistica: NORMAS.tasaEstadistica.pct,
    iva: NORMAS.iva.general,
    ivaAdicional: NORMAS.ivaAdicional.general,
    ganancias: NORMAS.ganancias.general,
    gananciasUsoParticular: NORMAS.ganancias.usoParticular,
    despachanteReferenciaUSD: 200,
    requiereCUIT: true,
    nota: 'Requiere CUIT, inscripción en el Registro de Importadores y despachante de aduana matriculado. El almacenaje en depósito fiscal se cotiza aparte y no está incluido.'
  },

  tarjeta: {
    percepcionGanancias: 0.00,
    nota: 'Percepción a cuenta de Ganancias sobre consumos en moneda extranjera. A verificar: cambió varias veces.'
  },

  /* Aproximación por rubro, SOLO para listados. Lo exacto sale del Arancel. */
  arancelPorRubro: {
    tecnologia:16, celulares:0, electro:20, hogar:20, moda:20, belleza:18,
    deportes:20, herramientas:14, construccion:14, gaming:20, juguetes:20,
    bebes:18, mascotas:14, salud:8, autos:18, jardin:14, libros:0, super:16,
    mayorista:18, _default:18
  }
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * @param {object} o
 *  valorUSD (FOB), fleteUSD, seguroUSD, pesoKg, rubro, unidades,
 *  regimen:'courier'|'general', enviosAnio (pequeños envíos ya usados en el año),
 *  destino:'uso'|'reventa'
 */
export function calcularImportacion(o){
  const {
    valorUSD = 0, fleteUSD = 0, seguroUSD = 0, pesoKg = 0,
    rubro = '_default', unidades = 1, regimen = 'courier', enviosAnio = 0,
    /* La importación general se usa, sobre todo, para mayorista y reventa. */
    destino = regimen === 'general' ? 'reventa' : 'uso'
  } = o;
  const avisos = [], lineas = [];
  const arancelPct = (REGLAS.arancelPorRubro[rubro] ?? REGLAS.arancelPorRubro._default) / 100;
  const cif = valorUSD + fleteUSD + seguroUSD;

  if (regimen === 'courier'){
    const C = REGLAS.courier;
    const excedeValor = valorUSD > C.topeValorUSD;
    const excedePeso  = pesoKg > C.topePesoKg;
    const excedeUnid  = unidades > C.unidadesPorItem;
    const comercial   = destino === 'reventa';
    if (excedeValor) avisos.push({ t:'bad', m:`Vale más de US$ ${C.topeValorUSD}: no entra como pequeño envío. Va exclusivamente por importación general con despachante.` });
    if (excedePeso)  avisos.push({ t:'bad', m:`Pesa más de ${C.topePesoKg} kg: no entra como pequeño envío.` });
    if (excedeUnid)  avisos.push({ t:'bad', m:`Más de ${C.unidadesPorItem} unidades iguales: no entra como pequeño envío.` });
    if (comercial)   avisos.push({ t:'bad', m:'Para vender no se puede usar el pequeño envío.' });
    const bloqueado = excedeValor || excedePeso || excedeUnid || comercial;

    const conCupo = enviosAnio < C.franquiciasPorAnio;
    const excedente = conCupo ? Math.max(0, valorUSD - C.franquiciaUSD) : valorUSD;
    const baseDer = valorUSD ? cif * excedente / valorUSD : 0;
    const derecho = r2(baseDer * arancelPct);
    const tasa = r2(baseDer ? Math.min(baseDer * C.tasaEstadistica, topeTasaEstadistica(cif)) : 0);
    const iva = r2((cif + derecho + tasa) * C.iva);

    lineas.push({ k:'Mercadería (FOB)', v:valorUSD, tipo:'base' });
    lineas.push({ k:'Flete', v:fleteUSD, tipo:'base' });
    lineas.push({ k:'Franquicia (sin derecho ni tasa)', v:0, tipo:'info', detalle:`US$ ${r2(Math.min(valorUSD, conCupo ? C.franquiciaUSD : 0))} de US$ ${C.franquiciaUSD}` });
    lineas.push({ k:`Derecho de importación (~${Math.round(arancelPct * 100)}% por rubro)`, v:derecho, tipo:'impuesto', detalle: excedente ? `sobre el excedente` : 'sin excedente' });
    lineas.push({ k:`Tasa de estadística (${C.tasaEstadistica * 100}%)`, v:tasa, tipo:'impuesto' });
    lineas.push({ k:`IVA (${C.iva * 100}%)`, v:iva, tipo:'impuesto', detalle:'se paga aunque entre en la franquicia' });

    const impuestos = r2(derecho + tasa + iva);
    if (!bloqueado && !excedente) avisos.push({ t:'ok', m:'Entra en la franquicia: no paga derecho ni tasa. El IVA se paga igual.' });
    return {
      regimen:'courier', lineas, avisos, impuestos, total:r2(cif + impuestos), bloqueado,
      franquicia:{ tope:C.franquiciaUSD, aplicada:r2(Math.min(valorUSD, conCupo ? C.franquiciaUSD : 0)), enviosAnio },
      tasaEfectiva: valorUSD ? r2(impuestos / valorUSD * 100) : 0, aproximado:true
    };
  }

  const G = REGLAS.general;
  const usoParticular = destino === 'uso';
  const derecho = r2(cif * arancelPct);
  const tasa    = r2(Math.min(cif * G.tasaEstadistica, topeTasaEstadistica(cif)));
  const baseIva = cif + derecho + tasa;
  const iva     = r2(baseIva * G.iva);
  const ivaAd   = usoParticular ? 0 : r2(baseIva * G.ivaAdicional);
  const gan     = r2(baseIva * (usoParticular ? G.gananciasUsoParticular : G.ganancias));
  const desp    = G.despachanteReferenciaUSD;

  lineas.push({ k:'Mercadería (FOB)', v:valorUSD, tipo:'base' });
  lineas.push({ k:'Flete + seguro', v:r2(fleteUSD + seguroUSD), tipo:'base' });
  lineas.push({ k:`Derecho de importación (~${(arancelPct * 100).toFixed(0)}% por rubro)`, v:derecho, tipo:'impuesto' });
  lineas.push({ k:`Tasa de estadística (${G.tasaEstadistica * 100}%)`, v:tasa, tipo:'impuesto' });
  lineas.push({ k:`IVA (${G.iva * 100}%)`, v:iva, tipo:'impuesto', recuperable:true });
  lineas.push({ k: usoParticular ? 'Percepción de IVA (no aplica: uso particular)' : `Percepción de IVA (${G.ivaAdicional * 100}%)`, v:ivaAd, tipo:'impuesto', recuperable:true });
  lineas.push({ k:`Percepción de Ganancias (${(usoParticular ? G.gananciasUsoParticular : G.ganancias) * 100}%)`, v:gan, tipo:'impuesto', recuperable:true });
  lineas.push({ k:'Despachante (honorario mínimo sugerido por el CDA)', v:desp, tipo:'gasto' });

  const impuestos   = r2(derecho + tasa + iva + ivaAd + gan);
  const recuperable = r2(iva + ivaAd + gan);
  const total       = r2(cif + impuestos + desp);

  avisos.push({ t:'warn', m:'Necesitás CUIT, inscripción en el Registro de Importadores y despachante de aduana.' });
  avisos.push({ t:'warn', m:'No incluye el almacenaje en depósito fiscal ni la percepción de Ingresos Brutos: se cotizan según el caso.' });

  return {
    regimen:'general', lineas, avisos, impuestos, gastos:desp, recuperable, total,
    costoReal: r2(total - recuperable), bloqueado:false,
    tasaEfectiva: valorUSD ? r2((impuestos + desp) / valorUSD * 100) : 0, aproximado:true
  };
}

/** Sugiere la vía: si el pequeño envío no está permitido, ni se compara. */
export function mejorRegimen(o){
  const c = calcularImportacion({ ...o, regimen:'courier' });
  const g = calcularImportacion({ ...o, regimen:'general' });
  if (c.bloqueado) return { elegido:'general', courier:c, general:g, motivo:'No entra como pequeño envío: va exclusivamente con despachante.' };
  const ahorro = Math.round(g.total - c.total);
  return { elegido: ahorro >= 0 ? 'courier' : 'general', courier:c, general:g,
    motivo: ahorro >= 0 ? `Como pequeño envío sale US$ ${ahorro} menos.` : `Con despachante sale US$ ${-ahorro} menos.` };
}

/** Estado anual de pequeños envíos de un cliente. */
export function estadoFranquicia(comprasDelAnio = []){
  const envios = comprasDelAnio.filter(c => c.regimen === 'courier').length;
  return {
    envios, topeAnual:REGLAS.courier.franquiciasPorAnio, topePorEnvio:REGLAS.courier.franquiciaUSD,
    nota:`Pequeños envíos usados: ${envios} de ${REGLAS.courier.franquiciasPorAnio} en el año.`
  };
}
