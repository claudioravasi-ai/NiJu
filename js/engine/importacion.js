/* ============================================================
   NiJu — Desglose completo de una importación
   ------------------------------------------------------------
   Arma, línea por línea y etapa por etapa, todo lo que se paga
   para traer un producto del exterior, en dólares y en pesos,
   con la fórmula, la explicación y la fuente de cada número.

   Principios:
     · Si una vía no está permitida (por valor, peso, unidades,
       destino o cupo), NO se le pone precio: se dice por qué.
     · Si un costo no está publicado y no lo cargó el cliente,
       queda "falta cotizar" y no se suma a escondidas.
     · Lo que se recupera depende de la condición ante ARCA.
   ============================================================ */
import { NORMAS, topeTasaEstadistica } from '../data/normas-importacion.js';
import { ETAPAS, DESPACHANTE_REFERENCIA } from '../data/etapas-envio.js';
import { PERFILES } from './fiscal.js';

const r2 = n => Math.round(n * 100) / 100;
const pctTxt = v => `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits:2 })}%`;
const usdTxt = v => `US$ ${r2(v).toLocaleString('es-AR', { maximumFractionDigits:2 })}`;

/** ¿Se puede traer como pequeño envío? Devuelve los motivos por los que no. */
export function motivosSinPequenoEnvio({ fobUSD = 0, pesoKg = 0, unidades = 1, destino = 'uso', enviosAnio = 0 }){
  const P = NORMAS.pequenoEnvio;
  const m = [];
  if (fobUSD > P.valorMaxUSD) m.push(`Vale ${usdTxt(fobUSD)} y el pequeño envío admite hasta ${usdTxt(P.valorMaxUSD)} por envío.`);
  if (pesoKg > P.pesoMaxKg) m.push(`Pesa ${pesoKg.toLocaleString('es-AR')} kg y el máximo es ${P.pesoMaxKg} kg por paquete.`);
  if (unidades > P.unidadesIguales) m.push(`Son ${unidades} unidades iguales y el máximo es ${P.unidadesIguales}.`);
  if (destino === 'reventa') m.push('Es para vender, y el pequeño envío no puede tener fin comercial.');
  return m;
}

/**
 * @param {object} e
 *  fobUSD, unidades, pesoKg, via:'pequeno'|'general', destino:'uso'|'reventa',
 *  perfilId, inscriptoGanancias, enviosAnio, die (% del Arancel o null),
 *  ivaReducido, costos:{ origenUSD, internacionalUSD, arriboUSD, seguroUSD,
 *  despachanteUSD, depositoUSD, ultimaMillaARS } (null = falta cotizar),
 *  sellos:{ campo: 'publicada'|'tuyo'|... }, detalles:{ campo:texto },
 *  tc:{ tarjeta, oficial }, feeUSD
 */
export function desglosar(e){
  const {
    fobUSD = 0, unidades = 1, pesoKg = 1, via = 'pequeno', destino = 'uso',
    perfilId = 'consumidor_final', inscriptoGanancias = false, enviosAnio = 0,
    die = null, ivaReducido = false, costos = {}, sellos = {}, detalles = {},
    tc = { tarjeta:1, oficial:1 }, feeUSD = null
  } = e;
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  const lineas = [], avisos = [], requisitos = [];

  if (via === 'pequeno'){
    const motivos = motivosSinPequenoEnvio(e);
    if (motivos.length) return { via, disponible:false, motivos, fuentes:NORMAS.pequenoEnvio.fuentes };
  }

  const aARS = (usd, cambio) => usd == null ? null : Math.round(usd * cambio);
  const linea = x => lineas.push({ recupero:{ tipo:'no', texto:'Es costo: no se recupera.' }, ...x,
    ars: x.ars !== undefined ? x.ars : aARS(x.usd, x.cambio || tc.oficial) });
  const costo = (campo, sello) => costos[campo] == null
    ? { usd:null, sello:'falta' } : { usd:+costos[campo], sello:sellos[campo] || sello };

  /* ---------- Etapas 1 y 2: producto y flete ---------- */
  linea({ etapa:'origen', id:'fob', k:'Precio del producto (valor FOB)', usd:fobUSD, cambio:tc.tarjeta, sello:'tuyo',
    formula: unidades > 1 ? `${unidades} unidades` : 'lo que dice la tienda',
    explica:'FOB es el precio de la mercadería puesta en el punto de salida, sin el viaje internacional ni el seguro. Es el valor que Aduana usa para ver si entrás en la franquicia. Lo pagás con tarjeta, por eso va al dólar tarjeta.' });

  const origen = costo('origenUSD', 'tuyo');
  linea({ etapa:'origen', id:'origen', k:'Envío de la tienda al punto de salida', usd:origen.usd, cambio:tc.tarjeta, sello:origen.sello,
    formula:detalles.origenUSD || 'lo que cobra la tienda',
    explica:'Lo que cobra el vendedor por llevar el paquete al correo de su país, al depósito del marketplace o a tu casillero. Si la tienda dice "envío gratis", es cero.' });

  const inter = costo('internacionalUSD', 'publicada');
  linea({ etapa:'internacional', id:'internacional', k:'Viaje internacional (avión o barco)', usd:inter.usd, cambio:tc.tarjeta, sello:inter.sello,
    formula:detalles.internacionalUSD || '', fuente:e.fuenteOperador,
    explica:'El flete del courier, el correo o el casillero hasta Argentina. Se cobra por kilo. Aduana lo suma al valor para calcular los tributos.' });

  const seguro = +costos.seguroUSD || 0;
  const flete = (origen.usd || 0) + (inter.usd || 0);
  const cif = fobUSD + flete + seguro;
  const fleteIncompleto = origen.usd == null || inter.usd == null;

  /* ---------- Etapa 3: llegada ---------- */
  const arribo = costo('arriboUSD', 'publicada');
  linea({ etapa:'arribo', id:'arribo', k: via === 'pequeno' ? 'Gestión del courier o del correo' : 'Almacenaje en depósito fiscal',
    usd: via === 'pequeno' ? arribo.usd : (costos.depositoUSD == null ? null : +costos.depositoUSD),
    sello: via === 'pequeno' ? arribo.sello : (costos.depositoUSD == null ? 'falta' : 'tuyo'),
    formula: via === 'pequeno' ? (detalles.arriboUSD || '') : 'lo cotiza el depósito',
    explica: via === 'pequeno'
      ? 'El courier cobra por hacer la declaración y el trámite; Correo Argentino cobra siempre una tasa de servicio y almacenaje. Si el operador no publica el monto, cargá el que te informen.'
      : 'En la importación general la carga espera en un depósito fiscal hasta el despacho, y el depósito cobra por los días que está. No hay tarifa pública: se pide presupuesto.' });

  /* ---------- Etapa 4: tributos ---------- */
  const ivaPct = ivaReducido ? NORMAS.iva.reducida : NORMAS.iva.general;
  let baseDerechos, textoBase;

  if (via === 'pequeno'){
    const PE = NORMAS.pequenoEnvio;
    const conCupo = enviosAnio < PE.enviosPorAnio;
    const excedente = conCupo ? Math.max(0, fobUSD - PE.franquiciaFOB) : fobUSD;
    baseDerechos = fobUSD ? cif * (excedente / fobUSD) : 0;

    linea({ etapa:'aduana', id:'franquicia', k:'Franquicia del pequeño envío', usd:null, ars:null, informativa:true, sello:'oficial', fuente:PE.fuentes[0],
      formula: conCupo
        ? `${usdTxt(Math.min(fobUSD, PE.franquiciaFOB))} exentos · pagan derecho y tasa ${usdTxt(excedente)}`
        : `ya usaste ${PE.enviosPorAnio} envíos este año: pagan todo el valor`,
      explica:`Los primeros ${PE.enviosPorAnio} envíos del año de cada persona tienen ${usdTxt(PE.franquiciaFOB)} FOB libres de derecho de importación y tasa de estadística. El IVA se paga igual. ${conCupo ? `Este envío sería el número ${enviosAnio + 1}.` : ''}` });
    textoBase = excedente ? `sobre ${usdTxt(baseDerechos)} (excedente de ${usdTxt(excedente)} FOB más su parte de flete y seguro)` : 'sin excedente';
    if (!conCupo) avisos.push({ t:'warn', m:`Ya usaste los ${PE.enviosPorAnio} pequeños envíos del año: este paga los tributos sobre todo el valor.` });
  } else {
    baseDerechos = cif;
    textoBase = `sobre el valor en aduana ${usdTxt(cif)} (producto + fletes + seguro)`;
  }

  const derecho = die == null ? null : baseDerechos * die / 100;
  linea({ etapa:'aduana', id:'derecho', k:`Derecho de importación${die == null ? '' : ` (${die.toLocaleString('es-AR')}%)`}`, usd:derecho,
    sello: die == null ? 'falta' : 'arancel', fuente:{ titulo:NORMAS.arancel.titulo, url:NORMAS.arancel.url },
    formula: die == null ? 'falta elegir la posición NCM del producto' : textoBase,
    explica:'Es el arancel: un porcentaje que cambia según qué es el producto. Sale de su posición en la Nomenclatura Común del Mercosur (NCM), publicada en el Arancel Integrado de ARCA.' });

  const te = baseDerechos ? Math.min(baseDerechos * NORMAS.tasaEstadistica.pct, topeTasaEstadistica(cif)) : 0;
  linea({ etapa:'aduana', id:'tasa', k:`Tasa de estadística (${pctTxt(NORMAS.tasaEstadistica.pct)})`, usd:te, sello:NORMAS.tasaEstadistica.verificado,
    fuente:NORMAS.tasaEstadistica.fuentes[0],
    formula: baseDerechos ? `${textoBase}, con tope de ${usdTxt(topeTasaEstadistica(cif))}` : 'sin excedente: no paga',
    explica:`Una tasa del ${pctTxt(NORMAS.tasaEstadistica.pct)} que cobra Aduana por sus servicios de registro y control, con un monto máximo. Vigente hasta el ${NORMAS.tasaEstadistica.vigenteHasta.split('-').reverse().join('/')} (${NORMAS.tasaEstadistica.norma}).` });

  const baseIva = cif + (derecho || 0) + te;
  const iva = baseIva * ivaPct;
  linea({ etapa:'aduana', id:'iva', k:`IVA de importación (${pctTxt(ivaPct)})`, usd:iva, sello:'norma', fuente:NORMAS.iva.fuentes[0],
    formula:`sobre ${usdTxt(baseIva)} (valor en aduana + derecho + tasa)`,
    recupero: P.computaIVA ? { tipo:'credito', texto:'Lo computás como crédito fiscal en tu declaración de IVA.' } : { tipo:'no', texto:`Como ${P.label} no lo recuperás: es costo.` },
    explica: via === 'pequeno'
      ? 'El IVA se paga siempre, aunque el envío entre completo en la franquicia: la franquicia solo libera el derecho y la tasa.'
      : 'El mismo IVA que pagarías en una compra en el país, calculado sobre el valor en aduana más el derecho y la tasa.' });
  if (fleteIncompleto) avisos.push({ t:'warn', m:'Todavía falta cargar algún flete: cuando lo cargues, el derecho, la tasa y el IVA suben un poco, porque se calculan sobre el valor con flete.' });

  if (via === 'general'){
    const usoParticular = destino === 'uso';
    const ivaAdPct = usoParticular ? 0 : (ivaReducido ? NORMAS.ivaAdicional.reducida : NORMAS.ivaAdicional.general);
    linea({ etapa:'aduana', id:'ivaAdicional', k:`Percepción de IVA${usoParticular ? '' : ` (${pctTxt(ivaAdPct)})`}`, usd:baseIva * ivaAdPct, sello:'norma',
      fuente:NORMAS.ivaAdicional.fuentes[0],
      formula: usoParticular ? 'no corresponde: uso o consumo particular' : `sobre ${usdTxt(baseIva)}`,
      recupero: P.computaIVA ? { tipo:'aCuenta', texto:'Es un adelanto de IVA: lo descontás en tu declaración mensual.' } : { tipo:'no', texto:'Sin inscripción en IVA queda como costo. Consultá con tu contador si podés pedirla en devolución.' },
      explica:`Es un adelanto del IVA que Aduana cobra al importar (${NORMAS.ivaAdicional.norma}). ${NORMAS.ivaAdicional.excluye}` });

    const ganPct = usoParticular ? NORMAS.ganancias.usoParticular : NORMAS.ganancias.general;
    linea({ etapa:'aduana', id:'ganancias', k:`Percepción de Ganancias (${pctTxt(ganPct)})`, usd:baseIva * ganPct, sello:'norma',
      fuente:NORMAS.ganancias.fuentes[0], formula:`sobre ${usdTxt(baseIva)}`,
      recupero: inscriptoGanancias ? { tipo:'aCuenta', texto:'Es un adelanto de Ganancias: lo descontás en tu declaración anual.' } : { tipo:'no', texto:'Si no estás inscripto en Ganancias queda como costo. Consultá con tu contador si corresponde pedirla en devolución.' },
      explica:`Un adelanto del impuesto a las Ganancias (${NORMAS.ganancias.norma}): ${pctTxt(NORMAS.ganancias.general)} en general y ${pctTxt(NORMAS.ganancias.usoParticular)} cuando lo importado es para uso o consumo particular.` });

    linea({ etapa:'aduana', id:'iibb', k:'Percepción de Ingresos Brutos', usd:null, ars:null, informativa:true, sello:'falta',
      formula:'depende de tu provincia', explica:NORMAS.iibb.nota });

    const desp = costos.despachanteUSD == null ? null : +costos.despachanteUSD;
    linea({ etapa:'aduana', id:'despachante', k:'Honorarios del despachante de aduana', usd:desp,
      sello: desp == null ? 'falta' : (sellos.despachanteUSD || 'tuyo'), fuente:{ titulo:'CDA — honorario mínimo sugerido', url:DESPACHANTE_REFERENCIA.url },
      formula: desp == null ? 'pedí presupuesto' : (detalles.despachanteUSD || ''),
      explica:`El despachante es el profesional matriculado que hace el despacho ante Aduana. ${DESPACHANTE_REFERENCIA.texto}` });

    requisitos.push('CUIT e inscripción en el Registro de Importadores de ARCA.', 'Despachante de aduana matriculado.', 'Factura comercial y documento de transporte.');
    if (perfilId === 'consumidor_final') avisos.push({ t:'bad', m:'Como Consumidor Final no podés hacer una importación general: necesitás CUIT e inscripción como importador. NiJu puede hacerla como importador y venderte el producto ya nacionalizado.' });
    if (destino === 'reventa' && perfilId === 'monotributo') avisos.push({ t:'warn', m:'Lo que importes para vender cuenta para tu categoría de Monotributo. Revisalo con tu contador antes.' });
  }

  /* ---------- Etapa 5: a tu casa ---------- */
  linea({ etapa:'ultima', id:'ultima', k:'Envío de la Aduana a tu casa', usd:null,
    ars: costos.ultimaMillaARS == null ? null : Math.round(+costos.ultimaMillaARS),
    sello: costos.ultimaMillaARS == null ? 'falta' : 'tuyo', formula: e.provincia ? `hasta ${e.provincia}` : '',
    explica:'El reparto del courier, Correo Argentino o un transporte hasta tu puerta. Cuesta distinto según la distancia.' });

  if (feeUSD != null) linea({ etapa:'ultima', id:'niju', k:'Gestión de NiJu', usd:feeUSD, cambio:tc.tarjeta, sello:'niju',
    formula:'compra, seguimiento y trámites por vos',
    recupero: P.computaIVA ? { tipo:'credito', texto:'Te damos Factura A: el IVA de la gestión lo computás.' } : { tipo:'no', texto:'Factura B, IVA incluido.' },
    explica:'Lo que cobra NiJu por comprar, coordinar el envío, hacer los trámites y responder por el pedido. Lleva IVA porque es un servicio.' });

  /* ---------- Totales ---------- */
  const reales = lineas.filter(l => !l.informativa);
  const faltan = reales.filter(l => l.ars == null).map(l => l.k);
  const totalARS = reales.reduce((a, l) => a + (l.ars || 0), 0);
  const tributosUSD = reales.filter(l => l.etapa === 'aduana' && l.id !== 'despachante').reduce((a, l) => a + (l.usd || 0), 0);
  const recuperaARS = reales.filter(l => l.recupero.tipo !== 'no').reduce((a, l) => a + (l.ars || 0), 0);

  return {
    via, disponible:true, lineas, avisos, requisitos, faltan,
    completo: !faltan.length,
    cifUSD:r2(cif), tributosUSD:r2(tributosUSD), tributosARS:Math.round(tributosUSD * tc.oficial),
    totalARS, recuperaARS, costoRealARS: totalARS - recuperaARS,
    porEtapa: ETAPAS.map(et => ({ ...et, lineas:lineas.filter(l => l.etapa === et.id),
      ars:lineas.filter(l => l.etapa === et.id && !l.informativa).reduce((a, l) => a + (l.ars || 0), 0) }))
  };
}

/**
 * Qué conviene: pequeño envío, importación general o comprarlo en el país.
 * Solo compara opciones disponibles y avisa cuando falta cotizar algo.
 */
export function recomendar({ pequeno, general, local = null, destino = 'uso', perfilId = 'consumidor_final', unidades = 1 }){
  const opciones = [];
  if (pequeno?.disponible) opciones.push({ id:'pequeno', nombre:'Pequeño envío (courier o correo)', ars:pequeno.totalARS, completo:pequeno.completo });
  if (general?.disponible && perfilId !== 'consumidor_final') opciones.push({ id:'general', nombre:'Importación general con despachante', ars:general.totalARS, completo:general.completo });
  if (local) opciones.push({ id:'local', nombre:`Comprarlo en ${local.tienda}`, ars:local.ars * unidades, completo:true });

  const motivos = [], cuidado = [];
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  if (!pequeno?.disponible) motivos.push('No se puede traer como pequeño envío: ' + pequeno.motivos.join(' '));
  const pasos = pasosAseguir({ pequeno, general, local, perfilId, P });
  if (!opciones.length) return { elegida:null, opciones, motivos, cuidado, pasos, titulo:'Así como estás, no podés importarlo directo: te mostramos cómo seguir' };

  opciones.sort((a, b) => a.ars - b.ars);
  const mejor = opciones[0], segunda = opciones[1];
  if (mejor.id === 'local') pasos.unshift({ t:`Compralo en ${local.tienda}`, d:'Sale más barato que importarlo y te llega sin trámites de Aduana. Revisá que sea exactamente el mismo modelo.' });
  if (segunda) motivos.push(`${mejor.nombre} sale ${Math.round(segunda.ars - mejor.ars).toLocaleString('es-AR')} pesos menos que ${segunda.nombre.charAt(0).toLowerCase() + segunda.nombre.slice(1)}.`);
  if (opciones.some(o => !o.completo)) cuidado.push('Hay costos que todavía faltan cotizar, así que la comparación puede cambiar cuando los cargues.');
  if (destino === 'reventa' && local){
    const importado = opciones.find(o => o.id !== 'local');
    if (importado){
      const margen = (local.ars * unidades - importado.ars) / (local.ars * unidades);
      motivos.push(`Si lo vendés al precio más barato del país (${local.tienda}), te queda un margen bruto del ${Math.round(margen * 100)}% antes de tus propios impuestos y gastos de venta.`);
    }
  }
  return { elegida:mejor.id, opciones, motivos, cuidado, pasos,
    titulo: mejor.id === 'local' ? `Te conviene comprarlo en ${local.tienda}` : `Te conviene: ${mejor.nombre.toLowerCase()}` };
}

/* Qué hacer, en orden, según la vía posible y la condición ante ARCA.
   accion: 'grandes' | 'perfil' → la pantalla le pone el botón. */
function pasosAseguir({ pequeno, general, perfilId, P }){
  const faltan = d => d?.faltan?.length ? `Todavía falta cotizar: ${d.faltan.join(', ').toLowerCase()}. Pedí esos valores y cargalos en su etapa.` : null;

  if (pequeno?.disponible) return [
    { t:'Confirmá qué es tu producto', d:'Revisá que la posición NCM elegida describa lo que comprás: de ella sale el derecho de importación.' },
    faltan(pequeno) && { t:'Cotizá lo que falta', d:faltan(pequeno) },
    { t:'Comprá, o pedile a NiJu que lo compre', d:'Si comprás vos, pagá a nombre de quien lo recibe y guardá la factura con el valor FOB. Si lo hace NiJu, confirmás acá y nosotros compramos y seguimos el envío.' },
    { t:'Al llegar, se declara y se pagan los tributos', d:'Por courier, el courier hace la declaración y te cobra los tributos. Por Correo Argentino, lo declarás y pagás en ARCA, en "Envíos Postales Internacionales", con clave fiscal nivel 2. Se usa uno de tus 5 envíos del año.' },
    { t:'Guardá los comprobantes', d: P.computaIVA ? 'La factura del exterior y la constancia de pago de los tributos: el IVA lo computás en tu declaración.' : 'La factura del exterior y la constancia de pago de los tributos, por si ARCA te los pide.' }
  ].filter(Boolean);

  if (perfilId === 'consumidor_final') return [
    { t:'Por qué no entra como pequeño envío', d:pequeno.motivos.join(' ') },
    { t:'Elegí uno de los dos caminos legales', d:'1) Que NiJu lo importe como importador y te lo venda ya nacionalizado, con factura: vos no hacés trámites. 2) Inscribirte ante ARCA y en el Registro de Importadores para importar a tu nombre (consultalo con un contador).', accion:'grandes' },
    { t:'No lo partas en envíos chicos', d:'Dividir una compra en varios envíos para quedar debajo de los límites puede tomarse como una maniobra para eludir el régimen, y Aduana puede retener la mercadería.' },
    { t:'Revisá tu condición', d:'Si ya estás inscripto (Monotributo, Responsable Inscripto o Exento), cambiala en la app: el cálculo y los pasos cambian.', accion:'perfil' }
  ];

  return [
    { t:'Confirmá la posición NCM y los requisitos', d:`Como ${P.label} podés importar con CUIT, inscripción en el Registro de Importadores y despachante de aduana. Revisá si el producto necesita autorización de otro organismo.` },
    faltan(general) && { t:'Pedí presupuesto de lo que falta', d:faltan(general) },
    { t:'Pagá al proveedor y embarcá', d:'Con factura comercial y documento de transporte (guía aérea o conocimiento de embarque) a tu nombre.' },
    { t:'El despachante hace el despacho', d:'Oficializa la destinación, pagás los tributos y Aduana asigna canal verde, naranja o rojo. Después se libera la mercadería del depósito.' },
    { t:'Registrá la compra y lo que recuperás', d: P.computaIVA ? 'El IVA y la percepción de IVA van a tu declaración mensual; la percepción de Ganancias, a la anual si estás inscripto.' : 'Guardá el despacho y las facturas. Consultá con tu contador qué percepciones podés recuperar.' , accion:'grandes' }
  ].filter(Boolean);
}

/* Glosario para responder sin conexión al asistente. */
export const GLOSARIO = [
  { claves:['fob'], r:'FOB es el precio del producto puesto en el punto de salida, sin el viaje internacional ni el seguro. Aduana lo usa para ver si entrás en la franquicia de US$ 400.' },
  { claves:['cif', 'valor en aduana'], r:'El valor en aduana (CIF) es el producto más los fletes y el seguro hasta Argentina. Sobre ese valor se calculan el derecho, la tasa y el IVA.' },
  { claves:['ncm', 'posicion', 'posición', 'nomenclatura', 'arancel'], r:'La NCM (Nomenclatura Común del Mercosur) es el código que identifica qué es el producto para Aduana. De esa posición sale el porcentaje de derecho de importación, publicado en el Arancel Integrado de ARCA.' },
  { claves:['franquicia', '400'], r:'Los primeros 5 pequeños envíos del año tienen US$ 400 FOB libres de derecho de importación y tasa de estadística. El IVA se paga igual. Si vale más, se paga sobre lo que supera.' },
  { claves:['iva'], r:'El IVA de importación se paga siempre, incluso dentro de la franquicia: 21% en general (10,5% en algunos bienes) sobre el valor en aduana más el derecho y la tasa. Solo lo recupera un Responsable Inscripto.' },
  { claves:['3000', '3.000', 'courier', 'despachante'], r:'El pequeño envío por courier o correo admite hasta US$ 3.000 por envío, 50 kg por paquete, 3 unidades iguales y sin fin comercial. Si te pasás de cualquiera de esos límites, va exclusivamente por importación general con despachante.' },
  { claves:['tasa de estadistica', 'tasa de estadística', 'estadistica'], r:'La tasa de estadística es del 3% con un monto máximo (US$ 180 hasta US$ 10.000 de valor). Está prorrogada hasta el 31/12/2027.' },
  { claves:['percepcion', 'percepción', 'ganancias'], r:'Las percepciones son adelantos de impuestos que cobra Aduana en la importación general: 20% de IVA (salvo uso particular) y 6% u 11% de Ganancias. Si estás inscripto, los descontás de tus impuestos; si no, son costo.' },
  { claves:['flete', 'envio', 'envío', 'correo', 'avion', 'avión', 'barco'], r:'El envío tiene cinco etapas: de la tienda al punto de salida, el viaje en avión o barco, la llegada a la Aduana, los trámites y tributos, y el reparto hasta tu casa. Cada una la cobra alguien distinto.' },
  { claves:['vender', 'reventa'], r:'Para vender no se puede usar el pequeño envío: corresponde importación general con CUIT, inscripción como importador y despachante.' }
];
