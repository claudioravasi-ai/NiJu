/* ============================================================
   NiJu — Carpeta impositiva del cliente
   ------------------------------------------------------------
   Cada compra hecha por la app genera consecuencias fiscales
   distintas según la condición del comprador. Este módulo las
   deduce y arma la carpeta lista para el contador:
     · qué comprobante recibe,
     · qué puede computar y qué es costo,
     · qué tiene que declarar y en qué formulario,
     · qué le queda a favor (percepciones a cuenta).

   ⚠️ Esto ORGANIZA información: no reemplaza al contador ni es
   asesoramiento impositivo. Los parámetros son editables y hay
   que validarlos contra la normativa vigente de ARCA.
   ============================================================ */
import { ALICUOTAS } from './facturacion.js';

export const PERFILES = {
  consumidor_final: {
    label:'Consumidor Final', corto:'CF', color:'#00E5FF',
    desc:'Persona que compra para uso propio. No liquida IVA.',
    computaIVA:false, computaPercepciones:false, requiereCUIT:false,
    puedeReventa:false, formularios:['Bienes Personales (si corresponde)'],
    limiteAnualUSD:null
  },
  monotributo: {
    label:'Monotributo', corto:'MT', color:'#D4FF3D',
    desc:'Pequeño contribuyente. El IVA de las compras es COSTO: no se computa crédito fiscal.',
    computaIVA:false, computaPercepciones:true, requiereCUIT:true,
    puedeReventa:true,
    formularios:['Recategorización semestral','Pago mensual F.155','DDJJ Ganancias si excede'],
    alerta:'Las compras y la facturación se cruzan para la recategorización. Importar para reventa puede excluirte de la categoría: consultá antes.',
    limiteAnualUSD:null
  },
  responsable_inscripto: {
    label:'Responsable Inscripto', corto:'RI', color:'#2EE6A8',
    desc:'Liquida IVA. Computa crédito fiscal y percepciones a cuenta.',
    computaIVA:true, computaPercepciones:true, requiereCUIT:true,
    puedeReventa:true,
    formularios:['IVA F.2002 (mensual)','Libro de IVA Digital (RG 4597)','Ganancias anual','IIBB / CM03'],
    limiteAnualUSD:null
  },
  exento: {
    label:'IVA Exento', corto:'EX', color:'#FFB800',
    desc:'Exento de IVA. El IVA de las compras es costo.',
    computaIVA:false, computaPercepciones:true, requiereCUIT:true,
    puedeReventa:true, formularios:['Ganancias anual'], limiteAnualUSD:null
  }
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * Deduce las consecuencias fiscales de UNA compra.
 * @param {object} c compra { tipo:'nacional'|'internacional'|'mayorista'|'propio',
 *                            totalARS, netoARS, ivaARS, feeARS, ivaFeeARS,
 *                            impuestosImportARS, percepcionesARS, valorUSD, destino:'uso'|'reventa' }
 * @param {string} perfilId
 */
export function consecuenciasFiscales(c, perfilId = 'consumidor_final'){
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  const computable = [], costo = [], aCuenta = [], obligaciones = [], avisos = [];

  /* --- IVA de la compra (nacional o NiJu Directo) --- */
  if (c.ivaARS){
    if (P.computaIVA) computable.push({ k:'IVA crédito fiscal de la compra', v:r2(c.ivaARS), donde:'IVA F.2002 · Libro IVA Digital' });
    else costo.push({ k:'IVA de la compra (no computable)', v:r2(c.ivaARS), motivo:`Tu condición (${P.label}) no permite computar crédito fiscal.` });
  }

  /* --- IVA de la comisión de NiJu --- */
  if (c.ivaFeeARS){
    if (P.computaIVA) computable.push({ k:'IVA crédito fiscal s/ comisión NiJu', v:r2(c.ivaFeeARS), donde:'IVA F.2002' });
    else costo.push({ k:'IVA s/ comisión NiJu (incluido en el precio)', v:r2(c.ivaFeeARS), motivo:'Comprobante B: el IVA no se discrimina ni se computa.' });
  }

  /* --- Importación --- */
  if (c.tipo === 'internacional' || c.tipo === 'mayorista'){
    if (c.regimen === 'general'){
      if (P.computaIVA){
        computable.push({ k:'IVA de importación', v:r2(c.ivaImportARS || 0), donde:'IVA F.2002' });
        aCuenta.push({ k:'Percepción IVA adicional (RG 2937)', v:r2(c.percIvaARS || 0), donde:'A cuenta de IVA' });
        aCuenta.push({ k:'Percepción Ganancias (RG 2281)', v:r2(c.percGanARS || 0), donde:'A cuenta de Ganancias' });
      } else {
        costo.push({ k:'IVA e percepciones de importación', v:r2(c.impuestosImportARS || 0),
          motivo:'Sin condición de inscripto, los tributos de importación son costo del bien.' });
      }
      costo.push({ k:'Derecho de importación y tasa de estadística', v:r2(c.derechosARS || 0), motivo:'Siempre forman parte del costo del bien.' });
      obligaciones.push({ k:'Despacho de importación', d:'Guardá el despacho (DJAI/SIM) y la factura del proveedor del exterior.', plazo:'10 años' });
    } else {
      costo.push({ k:'Derechos del régimen courier', v:r2(c.impuestosImportARS || 0),
        motivo:'El régimen simplificado no genera crédito fiscal: es costo.' });
      obligaciones.push({ k:'Envío courier', d:'Conservá la declaración simplificada y el comprobante del courier.', plazo:'5 años' });
      if (c.destino === 'reventa') avisos.push({ t:'bad',
        m:'El courier puerta a puerta es para USO PERSONAL. Si es para reventa, corresponde importación general.' });
    }

    if (c.percTarjetaARS){
      aCuenta.push({ k:'Percepción s/ consumos en moneda extranjera', v:r2(c.percTarjetaARS),
        donde: P.computaPercepciones ? 'A cuenta de Ganancias (DDJJ anual)' : 'Devolución por trámite web ante ARCA' });
    }
  }

  /* --- Reventa --- */
  if (c.destino === 'reventa'){
    if (!P.puedeReventa) avisos.push({ t:'warn', m:'Tu perfil es Consumidor Final: para revender necesitás inscribirte.' });
    obligaciones.push({ k:'Alta de la mercadería', d:'Registrá la compra en tu inventario y facturá la venta posterior.', plazo:'inmediato' });
  }

  /* --- Obligaciones comunes --- */
  obligaciones.push({ k:'Comprobante de NiJu', d:`Factura ${P.computaIVA ? 'A' : 'B'} por la comisión de gestión.`, plazo:'al confirmar' });
  if (P.requiereCUIT) obligaciones.push({ k:'Registro contable', d:'Asentá la operación en el libro que corresponda.', plazo:'mensual' });

  const totalComputable = r2(computable.reduce((a,x) => a + x.v, 0));
  const totalCosto      = r2(costo.reduce((a,x) => a + x.v, 0));
  const totalACuenta    = r2(aCuenta.reduce((a,x) => a + x.v, 0));

  return {
    perfil:P, computable, costo, aCuenta, obligaciones, avisos,
    totalComputable, totalCosto, totalACuenta,
    costoRealARS: r2((c.totalARS || 0) - totalComputable - totalACuenta),
    formularios:P.formularios
  };
}

/** Resumen anual: lo que el cliente lleva al contador. */
export function carpetaAnual(compras = [], perfilId = 'consumidor_final', anio = new Date().getFullYear()){
  const delAnio = compras.filter(c => new Date(c.fecha).getFullYear() === anio);
  const res = delAnio.map(c => ({ compra:c, fiscal:consecuenciasFiscales(c, perfilId) }));

  const tot = res.reduce((a, x) => ({
    gastado: a.gastado + (x.compra.totalARS || 0),
    computable: a.computable + x.fiscal.totalComputable,
    costo: a.costo + x.fiscal.totalCosto,
    aCuenta: a.aCuenta + x.fiscal.totalACuenta,
    importUSD: a.importUSD + (x.compra.valorUSD || 0)
  }), { gastado:0, computable:0, costo:0, aCuenta:0, importUSD:0 });

  const porMes = {};
  for (const x of res){
    const m = new Date(x.compra.fecha).getMonth();
    porMes[m] = r2((porMes[m] || 0) + (x.compra.totalARS || 0));
  }

  return {
    anio, perfil:PERFILES[perfilId], operaciones:res, totales:{
      gastado:r2(tot.gastado), creditoFiscal:r2(tot.computable),
      costoNoComputable:r2(tot.costo), saldoACuenta:r2(tot.aCuenta),
      importadoUSD:r2(tot.importUSD)
    },
    porMes,
    alertas: alertasAnuales(tot, perfilId)
  };
}

function alertasAnuales(tot, perfilId){
  const a = [];
  if (perfilId === 'monotributo' && tot.gastado > 0)
    a.push({ t:'warn', m:'ARCA cruza tus compras con tu facturación para la recategorización. Revisá que tus ingresos declarados sean coherentes con este volumen de compras.' });
  if (tot.aCuenta > 0)
    a.push({ t:'ok', m:`Tenés $${Math.round(tot.aCuenta).toLocaleString('es-AR')} en percepciones a favor. No las pierdas: se computan en la DDJJ o se piden en devolución.` });
  if (tot.importUSD > 1200)
    a.push({ t:'warn', m:`Llevás US$ ${Math.round(tot.importUSD)} importados este año. Revisá el uso de franquicias por envío y el destino declarado de cada compra.` });
  return a;
}

/** CSV de la carpeta, para mandarle al contador. */
export function csvCarpeta(carpeta){
  const cab = ['Fecha','Operación','Tienda','Tipo','Régimen','Total ARS','IVA computable','Costo no computable','Percepciones a cuenta','Valor USD','Destino'];
  const filas = carpeta.operaciones.map(({ compra:c, fiscal:f }) => [
    new Date(c.fecha).toLocaleDateString('es-AR'), c.titulo || '', c.tienda || '', c.tipo || '',
    c.regimen || '-', Math.round(c.totalARS || 0), Math.round(f.totalComputable),
    Math.round(f.totalCosto), Math.round(f.totalACuenta), (c.valorUSD || 0).toFixed(2), c.destino || 'uso'
  ]);
  return [cab, ...filas].map(f => f.map(x => `"${String(x).replace(/"/g,'""')}"`).join(';')).join('\n');
}

export function descargarCSV(nombre, contenido){
  const blob = new Blob(['﻿' + contenido], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
