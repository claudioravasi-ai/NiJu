/* ============================================================
   NiJu — Comisión de gestión operativa y logística
   ------------------------------------------------------------
   De acá sale la ganancia de la plataforma. Tres fuentes:
     1) FEE al comprador  — solo cuando NiJu gestiona de verdad
        (compra internacional, consolidación, nacionalización,
        última milla). Si la compra es un simple redireccionado
        a una tienda nacional, el comprador NO paga nada.
     2) COMISIÓN DE AFILIADO — la paga la tienda, no el usuario.
     3) MARGEN PROPIO — NiJu Directo.

   Referencias de mercado usadas para calibrar (parámetros, no
   dogma: se ajustan desde el Panel):
     · Comisión de marketplace en AR: ~11% a 16% del precio.
     · Gestión de compra internacional / casillero: 5% a 12%
       del valor, con mínimo por envío.
     · Agentes de compra en China (1688/Taobao): 5% a 10% + flete.
     · Despachante en importación formal: ~0,8% a 1,5% del CIF.
   NiJu se para deliberadamente por DEBAJO del marketplace local:
   cobramos por gestionar, no por dejar publicar.
   ============================================================ */

export const TARIFARIO = {
  actualizado:'2026-09-12',
  moneda:'USD',

  /* Compra internacional gestionada: escalonado por ticket */
  internacional: {
    tramos: [
      { hasta:50,   pct:0.12, minUSD:6 },
      { hasta:200,  pct:0.09, minUSD:8 },
      { hasta:500,  pct:0.07, minUSD:14 },
      { hasta:1500, pct:0.055, minUSD:35 },
      { hasta:Infinity, pct:0.045, minUSD:80 }
    ],
    logisticaFijaUSD: 8,      // consolidación + trazabilidad + última milla
    seguroOpcional: 0.015,    // sobre el valor declarado
    nota:'Incluye gestión de compra, seguimiento, gestión aduanera courier y entrega.'
  },

  /* Compra nacional — dos casos distintos:
     · SOLO COMPARÁS: el cliente se va a la tienda y compra él. No paga
       nada; NiJu cobra comisión de afiliado o convenio a la tienda.
     · COMPRA ASISTIDA: el cliente paga acá una sola vez y NOSOTROS
       compramos en cada tienda, juntamos y despachamos. Eso es trabajo
       real —gestión, capital adelantado, consolidación, última milla—
       y se cobra. Sin esto la app trabaja gratis. */
  nacional: {
    feeComprador: 0,
    comisionAfiliadoPromedio: 0.05,
    asistida: { pct: 0.07, minARS: 1500, porTiendaARS: 700, avisarSobre: 0.18 },
    nota:'Comparar es gratis. Que compremos por vos tiene un cargo de gestión.'
  },

  /* Mayorista / importación formal */
  mayorista: {
    pctSobreCIF: 0.035,
    minUSD: 120,
    gestionDespachante: true,
    nota:'Gestión integral: proveedor verificado, inspección, consolidado, despacho y entrega.'
  },

  /* NiJu Directo */
  propio: { margenObjetivo: 0.32, nota:'Margen bruto objetivo sobre costo de reposición.' },

  /* Servicios opcionales */
  extras: [
    { id:'inspeccion', nombre:'Inspección en origen',      precioUSD:35, desc:'Fotos y control de calidad antes del embarque.' },
    { id:'express',    nombre:'Despacho prioritario',       precioUSD:25, desc:'Adelanta el envío en la cola del courier.' },
    { id:'seguro',     nombre:'Seguro de la compra',        pct:0.015,    desc:'Cubre pérdida y rotura puerta a puerta.' },
    { id:'fiscal',     nombre:'Armado de carpeta impositiva', precioUSD:12, desc:'Documentación lista para tu contador.' }
  ]
};

const r2 = n => Math.round(n * 100) / 100;

/**
 * Calcula el fee de NiJu para una compra.
 * @param {object} o { valorUSD, fleteUSD, tipo:'nacional'|'internacional'|'mayorista'|'propio', extras:[] }
 */
export function calcularFee(o){
  const { valorUSD = 0, fleteUSD = 0, tipo = 'internacional', extras = [] } = o;
  const detalle = [];
  let fee = 0;

  if (tipo === 'nacional' || tipo === 'propio'){
    const com = tipo === 'nacional' ? valorUSD * TARIFARIO.nacional.comisionAfiliadoPromedio : 0;
    return {
      feeUSD:0, detalle:[{ k:'Gestión NiJu', v:0, nota:'Sin cargo: vas vos a la tienda.' }],
      ingresoNiju: r2(com), tipo, gratis:true
    };
  }

  /* Compra nacional asistida: la hacemos nosotros de punta a punta. */
  if (tipo === 'nacional-asistida'){
    const A = TARIFARIO.nacional.asistida;
    const tiendas = o.tiendas || 1;
    const baseARS = o.montoARS || 0;
    const porPct = baseARS * A.pct;
    const porTienda = A.porTiendaARS * tiendas;
    const feeARS = Math.max(A.minARS, porPct) + porTienda;
    const pctEfectivo = baseARS ? feeARS / baseARS : 0;
    return {
      feeARS: Math.round(feeARS), feeUSD: 0, tipo, gratis:false,
      pctEfectivo: baseARS ? r2(pctEfectivo * 100) : 0,
      /* Si la gestión se come una parte grande de una compra chica, hay
         que decirlo. Cobrarle 40% a alguien por traerle $8.000 de super
         no es un negocio: es perder un cliente y la reputación. */
      noConviene: pctEfectivo > A.avisarSobre,
      avisoCliente: pctEfectivo > A.avisarSobre
        ? `Para una compra de este tamaño la gestión representa el ${Math.round(pctEfectivo*100)}%. No te conviene que la hagamos nosotros: te sale bastante menos comprando vos directo en la tienda. Te dejamos los enlaces abajo.`
        : null,
      detalle:[
        /* Mostramos lo que REALMENTE se cobra, no el porcentaje teórico:
           si se aplica el mínimo, el renglón tiene que decir el mínimo,
           o los números no suman y el cliente desconfía con razón. */
        { k: porPct < A.minARS
              ? `Gestión de compra (mínimo)`
              : `Gestión de compra (${(A.pct*100).toFixed(0)}%)`,
          v: Math.round(Math.max(A.minARS, porPct)),
          nota: porPct < A.minARS
              ? `el ${(A.pct*100).toFixed(0)}% daba $${Math.round(porPct).toLocaleString('es-AR')}, se aplica el mínimo`
              : null },
        { k:`Compra en ${tiendas} tienda${tiendas>1?'s':''}`, v:porTienda,
          nota:'Cada tienda es una compra aparte que hacemos por vos' }
      ],
      ingresoNiju: Math.round(feeARS)
    };
  }

  if (tipo === 'mayorista'){
    const cif = valorUSD + fleteUSD;
    fee = Math.max(TARIFARIO.mayorista.minUSD, cif * TARIFARIO.mayorista.pctSobreCIF);
    detalle.push({ k:`Gestión de importación (${(TARIFARIO.mayorista.pctSobreCIF*100).toFixed(1)}% del CIF)`, v:r2(fee) });
  } else {
    const tramo = TARIFARIO.internacional.tramos.find(t => valorUSD <= t.hasta);
    const pct = valorUSD * tramo.pct;
    fee = Math.max(tramo.minUSD, pct);
    detalle.push({ k:`Gestión operativa (${(tramo.pct*100).toFixed(1)}%)`, v:r2(fee),
      nota: pct < tramo.minUSD ? `Mínimo de US$ ${tramo.minUSD} por envío` : null });
    fee += TARIFARIO.internacional.logisticaFijaUSD;
    detalle.push({ k:'Logística y última milla', v:TARIFARIO.internacional.logisticaFijaUSD });
  }

  for (const id of extras){
    const x = TARIFARIO.extras.find(e => e.id === id);
    if (!x) continue;
    const v = x.pct ? r2(valorUSD * x.pct) : x.precioUSD;
    fee += v;
    detalle.push({ k:x.nombre, v, opcional:true });
  }

  return { feeUSD:r2(fee), detalle, ingresoNiju:r2(fee), tipo, gratis:false,
           pctEfectivo: valorUSD ? r2(fee / valorUSD * 100) : 0 };
}

/** Comparación honesta contra alternativas del mercado.
    Todas se miden con la misma vara: lo que cuesta el servicio en dólares
    y ese costo dividido el valor del producto. Antes NiJu mostraba su
    porcentaje con la logística adentro y las demás sin su cargo fijo:
    13% contra 9% parecía caro aunque en dólares NiJu salía más barato.
    Las alternativas son referencias de mercado cargadas acá, no
    cotizaciones de empresas concretas. */
export function comparadorDeFee(valorUSD){
  const niju = calcularFee({ valorUSD, tipo:'internacional' });
  const tramo = TARIFARIO.internacional.tramos.find(t => valorUSD <= t.hasta);
  const opcion = (quien, usd, datos) => ({ quien, usd:r2(usd), pct:valorUSD ? r2(usd / valorUSD * 100) : 0, ...datos });
  return [
    opcion('NiJu', niju.feeUSD, { destacar:true,
      formula:`${r2(tramo.pct * 100).toLocaleString('es-AR')}% del valor (mínimo US$ ${tramo.minUSD}) + US$ ${TARIFARIO.internacional.logisticaFijaUSD} de logística`,
      hace:'Comprás en la app y pagás una sola vez en pesos. Nosotros compramos en la tienda, calculamos los impuestos antes, hacemos el trámite del courier y te lo llevamos.',
      teToca:'Elegir el producto y recibirlo.' }),
    opcion('Marketplace local', valorUSD * 0.135, { formula:'13,5% del valor',
      hace:'Un vendedor del país que ya trajo el producto y lo vende con su margen incluido.',
      teToca:'Pagar el precio que fija el vendedor.' }),
    opcion('Casillero / forwarder', valorUSD * 0.09 + 12, { formula:'9% del valor + US$ 12 fijos',
      hace:'Te da una dirección en el exterior y te reenvía el paquete.',
      teToca:'Comprar y pagar vos en cada tienda de afuera, y revisar qué incluye su tarifa.' }),
    opcion('Agente de compra en China', valorUSD * 0.08 + 15, { formula:'8% del valor + US$ 15 fijos',
      hace:'Compra por vos en tiendas chinas.',
      teToca:'Arreglar con el agente el envío internacional y los tiempos.' })
  ].sort((a, b) => a.usd - b.usd);
}
