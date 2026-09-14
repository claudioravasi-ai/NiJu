/* ============================================================
   NiJu — Asesor de importación, sin inteligencia artificial
   ------------------------------------------------------------
   Claudio decidió no pagar una API de IA (14-09-2026). Este asesor
   funciona solo, gratis y en el teléfono:
     · clasifica la posición NCM buscando en el Arancel de ARCA
       (con sinónimos en inglés y en castellano rioplatense);
     · responde preguntas reconociendo el tema y contestando con
       los NÚMEROS del cálculo que el cliente tiene en pantalla.
   Si no reconoce la pregunta, lo dice y ofrece temas: no inventa.
   El worker conserva la ruta /v1/asesor con Claude por si algún día
   se decide encenderla (CONFIG.asistenteIA); hoy no se llama.
   ============================================================ */
import { CONFIG } from '../config.js';
import { buscarPosiciones, normalizar } from './arancel.js';
import { NORMAS } from '../data/normas-importacion.js';

/* ---------- Servidor (solo si algún día se enciende la IA) ---------- */
async function pedir(cuerpo){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try{
    const r = await fetch(`${CONFIG.api}/asesor`, { method:'POST', signal:ctrl.signal,
      headers:{ 'content-type':'application/json' }, body:JSON.stringify(cuerpo) });
    const d = await r.json().catch(() => null);
    if (!d || (!r.ok && r.status !== 429)) throw new Error('asistente no disponible (' + r.status + ')');
    return d;
  }finally{ clearTimeout(t); }
}

/** Devuelve { ncm, descripcion, confianza, motivo, alternativas, datosQueFaltan, ivaReducidoPosible, origen } */
export async function clasificarProducto({ titulo, descripcion = '', marca = '', tienda = '' }){
  if (CONFIG.asistenteIA){
    try{
      const d = await pedir({ accion:'clasificar', titulo, descripcion, marca, tienda });
      if (d.ok && d.clasificacion) return { ...d.clasificacion, origen:'asistente' };
    }catch{}
  }
  const candidatas = buscarPosiciones(titulo, 8);
  return {
    ncm:candidatas[0]?.ncm || null, descripcion:candidatas[0]?.texto || '', confianza:'baja',
    motivo: candidatas.length
      ? 'Buscamos las palabras del producto en el Arancel Integrado. Elegí la posición que describe exactamente lo que comprás.'
      : 'No encontramos el producto por sus palabras. Buscalo abajo con otras palabras en castellano (por ejemplo "auriculares" en vez del nombre comercial).',
    alternativas:candidatas.slice(1).map(p => ({ ncm:p.ncm, cuando:p.texto })),
    datosQueFaltan:[], ivaReducidoPosible:false, origen:'palabras'
  };
}

/** Responde una duda. historial: [{ rol:'cliente'|'niju', texto }] */
export async function preguntarAsesor({ pregunta, contexto, historial = [] }){
  if (CONFIG.asistenteIA){
    try{
      const d = await pedir({ accion:'preguntar', pregunta, contexto, historial });
      if (d.ok && d.respuesta) return { texto:d.respuesta, origen:'asistente' };
      if (d.error) return { texto:d.error, origen:'error' };
    }catch{}
  }
  return { texto:responder(pregunta, contexto || {}), origen:'local' };
}

/* ============================================================
   Respuestas locales
   ============================================================ */
const usd = v => `US$ ${Number(v).toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const ars = v => `$ ${Math.round(v).toLocaleString('es-AR')}`;
const pct = v => `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits:2 })}%`;
const PE = NORMAS.pequenoEnvio;

const lineaDe = (c, id) => c.lineas?.find(l => l.id === id);
/* El "¿lo recuperás?" llega como texto (desglose guardado) o como objeto (desglose en pantalla). */
const recupero = l => typeof l?.recupero === 'string' ? l.recupero : l?.recupero?.texto || '';
const monto = l => l.ars == null ? 'todavía falta cotizarlo'
  : l.usd != null ? `${usd(l.usd)} (${ars(l.ars)})` : ars(l.ars);
const hayCalculo = c => !!c.lineas?.length;
const sinCalculo = 'Cuando cargues el producto y el precio en la calculadora, te lo digo con los números de tu compra.';

const TEMAS_OFRECIDOS = 'cuánto pagás en total, el IVA, el derecho de importación, la franquicia de US$ 400, courier o despachante, qué recuperás, la NCM, los plazos o qué papeles guardar';

const TEMAS = [
  { si:q => /^(hola|holis|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal|hey)\b/.test(q) && q.split(' ').length <= 5,
    r:c => c.producto
      ? `¡Hola! Estoy mirando tu cálculo de "${c.producto}". Preguntame, por ejemplo, cuánto pagás en total, por qué pagás IVA o qué te conviene.`
      : '¡Hola! Te ayudo con precios, envíos, impuestos de importación y trámites de Aduana. Por ejemplo: "¿cuánto puedo traer por courier?", "¿por qué pago IVA si entra en la franquicia?" o "¿qué me conviene si es para vender?".' },

  { si:q => /\b(gracias|genial|perfecto|joya|buenisimo|excelente)\b/.test(q) && q.split(' ').length <= 5,
    r:() => '¡De nada! Si te queda otra duda, preguntame.' },

  { si:q => /(dividir|partir|separar|fraccionar|varios envios|en partes|de a poco)/.test(q),
    r:() => `No te lo recomendamos. Partir una compra en varios envíos para quedar debajo de los límites del pequeño envío (US$ ${PE.valorMaxUSD.toLocaleString('es-AR')}, ${PE.pesoMaxKg} kg, ${PE.unidadesIguales} unidades iguales) puede tomarse como una maniobra para eludir el régimen, y Aduana puede retener la mercadería. Además, cada envío usa uno de tus ${PE.enviosPorAnio} del año.` },

  { si:q => /(cuanto|total|en total|precio final|me sale|me cuesta|sale todo|cuesta todo)/.test(q) && !/(iva|derecho|tasa|flete|despachante|percepc)/.test(q),
    r:c => {
      if (!c.pequenoEnvio && !c.importacionGeneral) return `El total depende del producto, el envío y tu condición. ${sinCalculo}`;
      const partes = [];
      const via = (d, nombre) => d?.disponible
        ? `${nombre}: ${ars(d.totalARS)}${d.faltan?.length ? ` sin contar lo que falta cotizar (${d.faltan.join(', ').toLowerCase()})` : ', todo incluido'}.`
        : `${nombre}: no se puede usar${d?.motivos?.length ? ` (${d.motivos[0]})` : ''}.`;
      partes.push(via(c.pequenoEnvio, 'Como pequeño envío'), via(c.importacionGeneral, 'Con despachante'));
      if (c.recomendacion?.titulo) partes.push(c.recomendacion.titulo + '.');
      return partes.join(' ');
    } },

  { si:q => /\biva\b/.test(q) && !/(adicional|percepc)/.test(q),
    r:c => {
      const l = lineaDe(c, 'iva');
      const base = `El IVA de importación es ${pct(NORMAS.iva.general)} (${pct(NORMAS.iva.reducida)} en algunos bienes), sobre el valor en aduana más el derecho y la tasa. Se paga siempre: la franquicia de US$ ${PE.franquiciaFOB} solo libera el derecho de importación y la tasa de estadística, no el IVA.`;
      return l ? `${base} En tu compra son ${monto(l)}: ${l.formula}. ${recupero(l)}` : `${base} ${sinCalculo}`;
    } },

  { si:q => /(derecho|arancel|arancelari)/.test(q),
    r:c => {
      const l = lineaDe(c, 'derecho');
      const pos = typeof c.posicionNCM === 'object' ? c.posicionNCM : null;
      if (!pos) return 'El derecho de importación es un porcentaje que depende de qué es el producto, según su posición NCM en el Arancel Integrado de ARCA. Todavía no elegiste la posición: hacelo en "Qué es para la Aduana" y te digo cuánto es.';
      return `Tu producto va en la posición ${pos.codigo}, que tiene ${pos.derechoImportacionPct}% de derecho de importación según el Arancel Integrado de ARCA. ${l ? `En tu compra son ${monto(l)}: ${l.formula}.` : ''} Es costo: no se recupera.`;
    } },

  { si:q => /estadistic/.test(q),
    r:c => {
      const l = lineaDe(c, 'tasa');
      return `La tasa de estadística es ${pct(NORMAS.tasaEstadistica.pct)} con un monto máximo (US$ 180 hasta US$ 10.000 de valor), prorrogada hasta el 31/12/2027. En el pequeño envío se paga solo sobre lo que supera los US$ ${PE.franquiciaFOB}. ${l ? `En tu compra: ${monto(l)}.` : ''}`;
    } },

  { si:q => /(percepc|ganancias|iva adicional|ingresos brutos|iibb)/.test(q),
    r:c => {
      const iva = lineaDe(c, 'ivaAdicional'), gan = lineaDe(c, 'ganancias');
      const general = `En la importación con despachante Aduana cobra adelantos de impuestos: percepción de IVA de ${pct(NORMAS.ivaAdicional.general)} (no aplica si es para uso particular) y percepción de Ganancias de ${pct(NORMAS.ganancias.general)}, o ${pct(NORMAS.ganancias.usoParticular)} si es para uso particular. La de Ingresos Brutos depende de la provincia y no la sumamos. En el pequeño envío no hay percepciones.`;
      if (!iva && !gan) return general;
      return `${general} En tu compra: percepción de IVA ${monto(iva)} y de Ganancias ${monto(gan)}. ${recupero(gan)}`;
    } },

  { si:q => /(\bncm\b|posicion|nomenclatura|codigo arancelario|clasific)/.test(q),
    r:c => typeof c.posicionNCM === 'object'
      ? `La NCM es el código que identifica qué es el producto para Aduana. El tuyo es ${c.posicionNCM.codigo}: ${c.posicionNCM.descripcion}. De ahí sale el ${c.posicionNCM.derechoImportacionPct}% de derecho. Si no describe exactamente tu producto, elegí otra en "Qué es para la Aduana": la posición la define en última instancia Aduana.`
      : 'La NCM (Nomenclatura Común del Mercosur) es el código que identifica qué es el producto para Aduana, y de él sale el porcentaje de derecho de importación. Elegila en "Qué es para la Aduana": buscá con palabras en castellano y quedate con la que describe exactamente lo que comprás.' },

  { si:q => /(franquicia|\b400\b|3000|3\.000|limite|cupo|cuanto puedo traer|kilos|\bkg\b|unidades iguales|cinco envios|5 envios)/.test(q),
    r:c => `El pequeño envío (courier o Correo Argentino) admite hasta US$ ${PE.valorMaxUSD.toLocaleString('es-AR')} por envío, ${PE.pesoMaxKg} kg por paquete, ${PE.unidadesIguales} unidades iguales, sin fin comercial y ${PE.enviosPorAnio} envíos por persona por año. Los primeros US$ ${PE.franquiciaFOB} FOB no pagan derecho ni tasa de estadística; el IVA sí.${c.pequenosEnviosUsadosEsteAnio != null ? ` Marcaste que ya usaste ${c.pequenosEnviosUsadosEsteAnio} este año.` : ''}${c.pequenoEnvio && !c.pequenoEnvio.disponible ? ` Tu compra no entra: ${c.pequenoEnvio.motivos.join(' ')}` : ''}` },

  { si:q => /(conviene|mejor opcion|que me recomend|courier o despachante|despachante o courier|que hago|como sigo)/.test(q),
    r:c => {
      const rec = c.recomendacion;
      if (!rec) return `Depende de cuánto vale, cuánto pesa, para qué es y tu condición. ${sinCalculo}`;
      const pasos = (rec.pasos || []).slice(0, 3).map((p, i) => `${i + 1}) ${p.t}.`).join(' ');
      return [rec.titulo + '.', ...(rec.motivos || []), pasos && `Los primeros pasos: ${pasos}`, 'El paso a paso completo está en "Qué te conviene".'].filter(Boolean).join(' ');
    } },

  { si:q => /despachante/.test(q),
    r:c => {
      const l = lineaDe(c, 'despachante');
      return `El despachante de aduana es el profesional matriculado que hace el despacho en la importación general. No hay tarifa oficial: el Centro Despachantes de Aduana sugirió en 2016 un mínimo de US$ 200 por operación, y cada uno fija el suyo. ${l ? `En tu cálculo figura ${monto(l)}; cambialo por el presupuesto que te den.` : ''} Para importar así necesitás CUIT e inscripción en el Registro de Importadores.`;
    } },

  { si:q => /\bfob\b/.test(q),
    r:c => `FOB es el precio del producto puesto en el punto de salida, sin el viaje internacional ni el seguro. Es el valor que Aduana mira para la franquicia de US$ ${PE.franquiciaFOB} y el límite de US$ ${PE.valorMaxUSD.toLocaleString('es-AR')}.${c.precioFOBUSD ? ` El de tu compra es ${usd(c.precioFOBUSD)}.` : ''}` },

  { si:q => /(\bcif\b|valor en aduana)/.test(q),
    r:() => 'El valor en aduana (CIF) es el producto más los fletes y el seguro hasta Argentina. Sobre ese valor se calculan el derecho de importación, la tasa de estadística y el IVA.' },

  { si:q => /(cuanto tarda|demora|plazo|cuando llega|cuantos dias|tiempo de entrega)/.test(q),
    r:c => c.plazoDelViaje
      ? `${c.operadorDelViaje} informa ${c.plazoDelViaje} para el viaje, más el trámite de Aduana y el reparto hasta tu casa. Son plazos del operador, no una garantía.`
      : 'Depende del operador: el aéreo tarda días y el marítimo semanas, más el trámite de Aduana y el reparto. Elegí un operador con plazo publicado en "El viaje, en cinco etapas", o pedíselo al que te cotice.' },

  { si:q => /(flete|envio internacional|avion|barco|transporte|etapa|ultima milla|hasta mi casa|correo argentino|casillero|courier)/.test(q),
    r:c => {
      const base = 'El envío tiene cinco etapas: de la tienda al punto de salida, el viaje en avión o barco, la llegada a la Aduana, los impuestos y trámites, y el reparto hasta tu casa. Cada una la cobra alguien distinto.';
      if (!hayCalculo(c)) return `${base} ${sinCalculo}`;
      const det = [['origen', 'tienda al punto de salida'], ['internacional', 'viaje internacional'], ['arribo', 'llegada a Aduana'], ['ultima', 'hasta tu casa']]
        .map(([id, n]) => lineaDe(c, id) && `${n}: ${monto(lineaDe(c, id))}`).filter(Boolean).join('; ');
      return `${base} En tu cálculo${c.operadorDelViaje ? `, con ${c.operadorDelViaje}` : ''}: ${det}.`;
    } },

  { si:q => /(recuper|devolucion|devuelven|credito fiscal|a favor|computar)/.test(q),
    r:c => {
      if (!hayCalculo(c)) return `Qué recuperás depende de tu condición: un Responsable Inscripto computa el IVA y las percepciones; un Monotributista o Consumidor Final, en general, no. ${sinCalculo}`;
      const recup = c.lineas.filter(l => recupero(l) && !/^Es costo|no lo recuperás|queda como costo|Factura B/i.test(recupero(l)));
      const d = /despachante/.test(c.vistaActual || '') ? c.importacionGeneral : c.pequenoEnvio;
      return recup.length
        ? `Como ${c.condicionAnteARCA} recuperás: ${recup.map(l => `${l.k} (${monto(l)})`).join('; ')}. Tu costo real queda en ${ars(d?.costoRealARS || 0)}.`
        : `Como ${c.condicionAnteARCA}, en ${c.vistaActual || 'esta vía'} no recuperás nada: todos los impuestos son costo. Tu costo real es ${ars(d?.costoRealARS || d?.totalARS || 0)}.`;
    } },

  { si:q => /(vender|reventa|revender|negocio|emprendimiento|comercial)/.test(q),
    r:c => `Para vender no se puede usar el pequeño envío: va como importación general, con CUIT, inscripción en el Registro de Importadores y despachante.${/Consumidor Final/.test(c.condicionAnteARCA || '') ? ' Como Consumidor Final primero tenés que inscribirte (el Monotributo suele ser el primer paso; consultalo con un contador), o que NiJu importe como importador y te venda la mercadería nacionalizada.' : ''} Marcá "Para vender" en "Tu situación ante ARCA" y el cálculo se ajusta.` },

  { si:q => /(monotribut|responsable inscripto|consumidor final|exento|inscribir|mi condicion|\bcuit\b)/.test(q),
    r:c => `${c.condicionAnteARCA ? `Hoy la app te toma como ${c.condicionAnteARCA}. ` : ''}Tu condición cambia qué recuperás y qué podés hacer: un Responsable Inscripto computa el IVA y las percepciones; Monotributo y Consumidor Final no. Para importar con despachante hace falta CUIT e inscripción como importador. Cambiala en Impuestos → Tu caso; la decisión de inscribirte, con un contador.` },

  { si:q => /(dolar|tipo de cambio|cotizacion|en pesos)/.test(q),
    r:c => c.tipoDeCambio
      ? `Todo va al dólar oficial, hoy ${ars(c.tipoDeCambio.oficial)}. Si pagás afuera con tarjeta en pesos, el banco suma el 30% de percepción (RG 5617/2024), que va en su propia línea y se recupera: oficial más 30% es el dólar tarjeta, hoy ${ars(c.tipoDeCambio.tarjeta)}. Pagando el resumen con dólares propios no se cobra.`
      : 'Todo va al dólar oficial del día. Si pagás afuera con tarjeta en pesos, se suma el 30% de percepción, que se recupera y mostramos aparte.' },

  { si:q => /(declar|clave fiscal|pagar los impuestos|como pago|donde pago)/.test(q),
    r:() => 'Por courier, el courier hace la declaración y te cobra los tributos. Por Correo Argentino, declarás y pagás en la web de ARCA, en "Envíos Postales Internacionales", con clave fiscal nivel 2 como mínimo. En la importación general lo hace el despachante.' },

  { si:q => /(comprobante|factura|papeles|documentos|que guardo|guardar)/.test(q),
    r:c => `Guardá la factura del exterior (con el valor FOB), el comprobante del envío y la constancia de pago de los tributos${/despachante/.test(c.vistaActual || '') ? ', y el despacho de importación' : ''}. NiJu te factura aparte su gestión. Si sos inscripto, esos papeles van a tu contabilidad.` },

  { si:q => /(carrito)/.test(q),
    r:c => c.carrito?.length
      ? `Tenés ${c.carrito.length} producto${c.carrito.length > 1 ? 's' : ''} en el carrito: ${c.carrito.map(i => `${i.producto} (${i.tienda})`).join('; ')}. El total con envío, impuestos y gestión lo ves en el Carrito.`
      : 'Tu carrito está vacío.' },

  { si:q => /(garantia|arrepent|devolver|reclamo|mi pedido|seguimiento|no llego)/.test(q),
    r:() => 'El arrepentimiento y el seguimiento de cada pedido están en Mis compras. Si es un problema con un pedido concreto, escribinos desde Mis compras con el número de pedido: eso lo resuelve una persona del equipo.' }
];

function responder(pregunta, c){
  const q = normalizar(pregunta).replace(/\s+/g, ' ').trim();
  if (!q) return 'Escribí tu pregunta.';
  const tema = TEMAS.find(t => t.si(q));
  if (tema) return tema.r(c, q).replace(/\s+/g, ' ').trim();
  return `No tengo una respuesta segura para eso y prefiero no inventarte algo. Puedo explicarte ${TEMAS_OFRECIDOS}. Si es otra cosa, escribinos por Mensajes y te responde una persona.`;
}
