/* ============================================================
   NiJu — Facturación de la comisión de gestión
   ------------------------------------------------------------
   La ganancia de NiJu no es "un número que queda": es un ingreso
   gravado que se factura, se discrimina y se declara. Este módulo
   arma el comprobante como lo armaría un contador:

     · Elige el TIPO de comprobante según la condición del receptor.
     · Separa NETO GRAVADO / IVA / PERCEPCIONES / TOTAL.
     · Deja el ingreso listo para el Libro IVA Ventas (RG 4597,
       Libro de IVA Digital) y para la liquidación de IIBB.

   ⚠️ El CAE lo otorga ARCA: se obtiene desde el backend con el
   web service de facturación electrónica (WSFEv1) y certificado
   digital. El front NUNCA puede firmar un comprobante. Acá se
   arma el borrador y se envía a emitir.
   ⚠️ Alícuotas y regímenes: parametrizados, a confirmar con el
   contador antes de emitir el primer comprobante real.
   ============================================================ */

export const EMISOR = {
  razonSocial: 'NiJu S.A.S.',
  nombreFantasia: 'NiJu',
  cuit: '30-00000000-0',                 // completar
  condicion: 'responsable_inscripto',    // 'responsable_inscripto' | 'monotributo'
  iibb: '901-000000-0',                  // completar
  jurisdiccion: 'Buenos Aires',
  convenioMultilateral: true,
  inicioActividades: '2026-01-01',
  actividad: { codigo:'821100', desc:'Servicios combinados de gestión administrativa' },
  actividad2:{ codigo:'791200', desc:'Servicios de gestión de compras y logística' },
  ptoVta: 1
};

/* Alícuotas — parámetros editables */
export const ALICUOTAS = {
  iva: 0.21,
  ivaReducido: 0.105,
  iibbPorJurisdiccion: {               // servicios; confirmar con contador
    'Ciudad Autónoma de Buenos Aires':0.030,
    'Buenos Aires':0.035,
    'Córdoba':0.040,
    'Santa Fe':0.045,
    'Mendoza':0.040,
    'Río Negro':0.030,
    'Neuquén':0.030,
    'Chubut':0.030,
    'Santa Cruz':0.030,
    _default:0.035
  },
  percepcionIVA_RG2408: 0.03,   // a inscriptos, si corresponde inscripción en el régimen
  retencionGanancias_RG830: 0.02,
  gananciasSociedades: 0.25     // escala 25/30/35 según utilidad
};

export const CONDICIONES_RECEPTOR = {
  responsable_inscripto: { label:'Responsable Inscripto',  comp:'A', discrimina:true,  computaCF:true },
  monotributo:           { label:'Monotributista',          comp:'B', discrimina:false, computaCF:false },
  exento:                { label:'IVA Exento',              comp:'B', discrimina:false, computaCF:false },
  consumidor_final:      { label:'Consumidor Final',        comp:'B', discrimina:false, computaCF:false },
  no_categorizado:       { label:'Sujeto no categorizado',  comp:'B', discrimina:false, computaCF:false },
  exterior:              { label:'Cliente del exterior',    comp:'E', discrimina:false, computaCF:false, exportacion:true }
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * Arma el comprobante por la comisión de gestión de NiJu.
 * @param {object} o
 * @param {number} o.feeARS        comisión total en pesos (IVA incluido o neto, según `incluyeIVA`)
 * @param {boolean} o.incluyeIVA   true si el fee mostrado al cliente ya tiene IVA adentro
 * @param {string} o.condicion     condición del receptor
 * @param {string} o.jurisdiccion  provincia del cliente
 * @param {object} o.cliente       { nombre, cuit }
 * @param {string} o.concepto
 */
export function comprobanteGestion(o){
  const {
    feeARS = 0, incluyeIVA = true, condicion = 'consumidor_final',
    jurisdiccion = 'Buenos Aires', cliente = {}, concepto = 'Servicio de gestión operativa y logística de compra',
    operacionId = null
  } = o;

  const C = CONDICIONES_RECEPTOR[condicion] || CONDICIONES_RECEPTOR.consumidor_final;

  if (C.exportacion){
    return { tipo:'E', letra:'E', condicion, neto:r2(feeARS), iva:0, percepciones:[], total:r2(feeARS),
      leyenda:'Operación de exportación de servicios — exenta de IVA (art. 1 inc. b, Ley 23.349).',
      lineas:[{ k:'Neto (exportación de servicios)', v:r2(feeARS) }], emisor:EMISOR, cliente, concepto, operacionId };
  }

  const neto = incluyeIVA ? r2(feeARS / (1 + ALICUOTAS.iva)) : r2(feeARS);
  const iva  = r2(neto * ALICUOTAS.iva);

  /* Percepciones: solo a inscriptos y cuando NiJu esté designado agente. */
  const percepciones = [];
  if (condicion === 'responsable_inscripto' && EMISOR.agentePercepcionIVA){
    percepciones.push({ k:'Percepción IVA RG 2408', v:r2(neto * ALICUOTAS.percepcionIVA_RG2408), regimen:'RG 2408' });
  }

  const total = r2(neto + iva + percepciones.reduce((a,p) => a + p.v, 0));

  /* IIBB: NO se discrimina al cliente. Es costo del emisor; se liquida
     por jurisdicción con Convenio Multilateral. Lo calculamos para el
     tablero contable, no para el comprobante.                         */
  const alicIIBB = ALICUOTAS.iibbPorJurisdiccion[jurisdiccion] ?? ALICUOTAS.iibbPorJurisdiccion._default;
  const iibb = r2(neto * alicIIBB);

  const lineas = [{ k:concepto, v:neto, tipo:'neto' }];
  if (C.discrimina){
    lineas.push({ k:`IVA ${(ALICUOTAS.iva*100).toFixed(0)}%`, v:iva, tipo:'iva' });
    percepciones.forEach(p => lineas.push({ ...p, tipo:'percepcion' }));
  }

  return {
    tipo: C.comp, letra: C.comp, condicion, condicionLabel: C.discrimina ? 'IVA discriminado' : 'IVA incluido',
    neto, iva, percepciones, total, lineas, iibb, alicIIBB,
    leyenda: C.discrimina
      ? 'IVA discriminado conforme RG 1415 y concordantes.'
      : 'El IVA está incluido en el precio (comprobante B: no discrimina).',
    cae: null, caeVto: null, estado:'borrador',
    emisor: EMISOR, cliente, concepto, operacionId, fecha: Date.now(),
    nota: 'Borrador. El CAE se solicita a ARCA desde el backend (WSFEv1) al confirmar la operación.'
  };
}

/**
 * Tablero contable del período: lo que un contador querría ver.
 * @param {Array} comprobantes  comprobantes emitidos
 * @param {Array} compras       comprobantes recibidos (gastos con IVA CF)
 */
export function liquidacionPeriodo(comprobantes = [], compras = []){
  const ventasNeto = r2(comprobantes.reduce((a,c) => a + c.neto, 0));
  const debito     = r2(comprobantes.reduce((a,c) => a + c.iva, 0));
  const credito    = r2(compras.reduce((a,c) => a + (c.iva || 0), 0));
  const saldoIVA   = r2(debito - credito);

  const iibbPorJur = {};
  for (const c of comprobantes){
    const j = c.cliente?.jurisdiccion || EMISOR.jurisdiccion;
    iibbPorJur[j] = r2((iibbPorJur[j] || 0) + (c.iibb || 0));
  }
  const iibbTotal = r2(Object.values(iibbPorJur).reduce((a,b) => a + b, 0));

  const gastosNeto = r2(compras.reduce((a,c) => a + (c.neto || 0), 0));
  const utilidad   = r2(ventasNeto - gastosNeto - iibbTotal);
  const ganancias  = r2(Math.max(0, utilidad) * ALICUOTAS.gananciasSociedades);

  return {
    ventasNeto, debito, credito, saldoIVA,
    iibbPorJur, iibbTotal, gastosNeto, utilidad, ganancias,
    utilidadDespuesImp: r2(utilidad - ganancias),
    comprobantes: comprobantes.length,
    vencimientos: [
      { id:'iva',   nombre:'IVA — DDJJ mensual (F.2002)', base:saldoIVA,  cuando:'según terminación de CUIT' },
      { id:'iibb',  nombre:'IIBB — anticipo mensual',      base:iibbTotal, cuando:'CM03 / jurisdicción local' },
      { id:'gan',   nombre:'Ganancias — anticipos',        base:r2(ganancias / 10), cuando:'10 anticipos' },
      { id:'libro', nombre:'Libro de IVA Digital (RG 4597)', base:null,    cuando:'mensual' }
    ]
  };
}

/** Exporta el Libro IVA Ventas en CSV (formato legible, para el contador). */
export function csvLibroIVAVentas(comprobantes){
  const cab = ['Fecha','Tipo','Pto Vta','Nro','CAE','Cliente','CUIT','Cond. IVA','Neto Gravado','IVA 21%','Percepciones','Total'];
  const filas = comprobantes.map((c, i) => [
    new Date(c.fecha).toLocaleDateString('es-AR'),
    `Factura ${c.letra}`, String(EMISOR.ptoVta).padStart(5,'0'), String(i + 1).padStart(8,'0'),
    c.cae || 'PENDIENTE', c.cliente?.nombre || 'Consumidor Final', c.cliente?.cuit || '',
    CONDICIONES_RECEPTOR[c.condicion]?.label || '',
    c.neto.toFixed(2), c.iva.toFixed(2),
    c.percepciones.reduce((a,p) => a + p.v, 0).toFixed(2), c.total.toFixed(2)
  ]);
  return [cab, ...filas].map(f => f.map(x => `"${String(x).replace(/"/g,'""')}"`).join(';')).join('\n');
}
