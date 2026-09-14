/* ============================================================
   NiJu — Páginas para leer: Compras grandes, Preguntas frecuentes,
   Términos y condiciones, y Quiénes somos.
   Todos los números (tarifas, días de arrepentimiento, tolerancia de
   precio, límites del courier) se leen de los mismos parámetros que
   usa la app: si cambia un valor, cambia también el texto.
   ============================================================ */
import { el, plata, ic, hoja } from '../util.js';
import { CONFIG } from '../config.js';
import { TARIFARIO } from '../engine/fees.js';
import { REGLAS } from '../engine/taxes.js';
import { TOLERANCIA, DIAS_ARREPENTIMIENTO } from '../engine/ordenes.js';
import { NIVELES_INICIALES } from '../engine/promos.js';
import { esDueno } from '../engine/sesion.js';
import { FUENTES } from '../data/fuentes-fiscales.js';
import { botonVolver } from './components.js';

const pct = v => `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits:2 })}%`;
export const TERMINOS_ACTUALIZADOS = '14 de septiembre de 2026';

const fuente = id => el('a', { class:'c-fuente', href:FUENTES[id].url, target:'_blank', rel:'noopener' }, FUENTES[id].titulo);
const hero = (clase, kicker, titulo, texto) => el('section', { class:'i-hero ' + clase },
  el('span', { class:'c-hero-kicker' }, kicker), el('h1', {}, titulo), el('p', {}, texto));

/* ---- Tarifas en palabras, siempre leídas del tarifario ---- */
function tarifasEnPalabras(){
  const n = TARIFARIO.nacional.asistida, i = TARIFARIO.internacional, m = TARIFARIO.mayorista;
  const tramos = i.tramos;
  return {
    comparar:'Comparar precios es gratis, siempre.',
    nacional:`Si comprás en tiendas del país y querés que compremos por vos: ${pct(n.pct)} del total, más ${plata(n.porTiendaARS)} por cada tienda, con un mínimo de ${plata(n.minARS)}. Si ese cargo supera el ${pct(n.avisarSobre)} de tu compra, te avisamos que te conviene comprar directo.`,
    exterior:`Si traemos algo del exterior: entre ${pct(tramos.at(-1).pct)} y ${pct(tramos[0].pct)} según el monto (cuanto más grande, menor el porcentaje), más US$ ${i.logisticaFijaUSD} de logística. Incluye compra, seguimiento, trámite de courier y entrega.`,
    grande:`En compras grandes: ${pct(m.pctSobreCIF)} sobre el valor CIF (producto + flete + seguro), con un mínimo de US$ ${m.minUSD}.`
  };
}

/* =================== Compras grandes =================== */
export function vistaGrandes(ir){
  const cr = REGLAS.courier, g = REGLAS.general;
  const t = tarifasEnPalabras();
  const tarjeta = (icono, titulo, texto) => el('div', { class:'i-tarjeta' },
    el('span', { class:'c-ic' }, ic(icono)), el('h3', {}, titulo), el('p', {}, texto));
  const paso = (n, titulo, texto) => el('li', {}, el('span', { class:'i-paso-n' }, String(n)), el('div', {}, el('h3', {}, titulo), el('p', {}, texto)));

  return el('div', { class:'wrap c-cuenta' },
    botonVolver(ir),
    hero('azul', 'Compras grandes', 'Lo que parecía imposible, lo hacemos juntos',
      'Cuando lo que querés traer no entra por courier —porque es para vender, porque son muchas unidades o porque pesa o vale mucho— no te dejamos solo con los trámites. Lo gestionamos con vos, paso a paso, y siempre sabés cuánto vas a pagar.'),

    el('h2', { class:'c-seccion' }, '¿Cuándo es una compra grande?'),
    el('div', { class:'i-grilla' },
      tarjeta('caja', 'Es para vender', 'Stock para tu negocio o tu emprendimiento. El courier puerta a puerta es solo para uso personal.'),
      tarjeta('etiqueta', 'Son muchas unidades iguales', `Más de ${cr.unidadesPorItem} unidades del mismo producto ya se toman como compra comercial.`),
      tarjeta('envio', 'Vale o pesa mucho', `Más de US$ ${cr.topeValorUSD} o más de ${cr.topePesoKg} kg por envío no entran por courier.`),
      tarjeta('rayo', 'Máquinas e insumos', 'Maquinaria, repuestos o materia prima para producir: necesitan importación formal.')),

    el('h2', { class:'c-seccion' }, 'Qué hace NiJu por vos'),
    el('ul', { class:'i-lista' },
      ...[
        ['buscar', 'Buscamos y comparamos proveedores', 'En el país y en el exterior. Te mostramos opciones, no una sola.'],
        ['chat', 'Pedimos cotizaciones reales', 'Precio, cantidad mínima, plazos de fabricación y de envío, por escrito.'],
        ['calc', 'Te explicamos cada costo antes', 'Producto, flete, seguro, derechos de importación, tasa de estadística, IVA, percepciones, despachante y gastos de depósito. Todo sumado en un precio final puesto en tu lugar.'],
        ['mundo', 'Coordinamos el viaje', 'Flete internacional y seguro, con seguimiento de cada tramo.'],
        ['check', 'Hacemos la aduana en regla', 'Con despachante de aduana matriculado y la documentación que corresponde.'],
        ['envio', 'Te lo entregamos', 'En tu depósito, tu local o tu casa.'],
        ['caja', 'Te dejamos los papeles listos', 'Facturas, despacho y todo lo que tu contador necesita.']
      ].map(([icono, titulo, texto]) => el('li', {}, el('span', { class:'c-ic' }, ic(icono)), el('div', {}, el('b', {}, titulo), el('p', {}, texto))))),

    el('h2', { class:'c-seccion' }, 'Cómo trabajamos, paso a paso'),
    el('ol', { class:'i-pasos' },
      paso(1, 'Nos contás qué necesitás', 'Qué producto, cuántas unidades, para cuándo y adónde. Si tenés un link o una foto, mejor.'),
      paso(2, 'Cotizamos', 'Buscamos proveedores y te traemos opciones con precio, plazos y condiciones.'),
      paso(3, 'Te mostramos el costo final', 'Desglosado, línea por línea, para que decidas con todos los números a la vista.'),
      paso(4, 'Confirmás', 'Con una seña y una orden de compra firmada, donde queda escrito qué compramos en tu nombre y en qué condiciones.'),
      paso(5, 'Compramos, embarcamos y despachamos', 'Te avisamos en cada etapa: compra, fabricación, viaje, aduana.'),
      paso(6, 'Lo recibís con toda la documentación', 'Y quedamos a disposición para lo que venga después.')),

    el('div', { class:'i-dos' },
      el('div', { class:'c-card' },
        el('h2', {}, 'Qué necesitás tener'),
        el('p', { class:'c-sub' }, `${g.nota} Si lo importás a tu nombre, necesitás eso. Si no lo tenés, en la cotización te explicamos las alternativas posibles para tu caso.`),
        el('div', { class:'c-links' }, fuente('envios'), fuente('tramites'))),
      el('div', { class:'c-card' },
        el('h2', {}, 'Cuánto cobra NiJu'),
        el('p', { class:'c-sub' }, t.grande),
        el('p', { class:'c-sub' }, 'Los impuestos de importación los fija la aduana, no NiJu: te los mostramos antes para que no haya sorpresas.'))),

    el('section', { class:'i-cta' },
      el('h2', {}, '¿Tenés algo en mente?'),
      el('p', {}, 'Contanos qué querés traer. Te respondemos con opciones y números claros.'),
      el('div', { class:'c-acciones' },
        el('button', { class:'btn btn-win btn-lg', onclick:() => ir('#/mayorista') }, ic('caja'), 'Pedir una cotización'),
        el('button', { class:'btn btn-lg', onclick:() => ir('#/mensajes') }, ic('chat'), 'Escribirnos'))));
}

/* =================== Preguntas frecuentes =================== */
function preguntas(){
  const t = tarifasEnPalabras();
  const cr = REGLAS.courier;
  const nivel = NIVELES_INICIALES[0];
  return [
    ['Comprar', '¿Qué es NiJu?', ['NiJu busca el mismo producto en muchas tiendas a la vez y te muestra cuánto vas a pagar de verdad: producto, envío, impuestos y gestión. Si querés, compramos por vos en cada tienda y vos pagás una sola vez.'], [['Quiénes somos', '#/nosotros']]],
    ['Comprar', '¿Cómo compro?', ['Buscás lo que querés, comparás, lo agregás al carrito y confirmás. Te pedimos tus datos (la tienda los necesita para facturar y despachar), pagás y nosotros compramos en cada tienda por vos.'], [['Ir a buscar', '#/buscar']]],
    ['Comprar', '¿Puedo comprar en varias tiendas a la vez?', ['Sí. Aunque el carrito tenga productos de distintas tiendas, confirmás y pagás una sola vez. Elegís si cada tienda te lo manda directo o si lo juntamos todo en un solo paquete.'], []],
    ['Comprar', '¿Cuánto cobra NiJu?', [t.comparar, t.nacional, t.exterior, t.grande, 'Siempre lo ves sumado en el total antes de confirmar.'], []],
    ['Comprar', '¿Por qué puede cambiar el precio?', [`Los precios se consultan en vivo en cada tienda y las tiendas los cambian. Si al momento de comprar el precio subió más de un ${pct(TOLERANCIA)}, te consultamos antes de seguir: aceptás la diferencia o cancelás.`], []],
    ['Pagos', '¿Cómo pago?', ['Al confirmar, tu pedido queda pendiente de pago y te contactamos para coordinarlo. Muy pronto vas a poder pagar con Mercado Pago dentro de la app.'], [['Mis compras', '#/compras']]],
    ['Pagos', '¿Cuándo compran mi pedido?', ['Apenas se acredita el pago salimos a comprar en cada tienda. Todo queda anotado en Mis compras, con cada paso y cada aviso.'], [['Mis compras', '#/compras']]],
    ['Envíos', '¿Cuánto tarda en llegar?', ['Los plazos son estimados y dependen de cada tienda, del correo y de tu provincia. En cada producto te mostramos el plazo para tu destino, y en Mis compras seguís cada envío con su número de seguimiento.'], []],
    ['Envíos', '¿Qué pasa si no hay stock?', ['Te avisamos antes de hacer nada. Decidís vos: cancelar ese producto, cambiarlo o esperar. Si ya pagaste lo que no se pudo comprar, se te devuelve.'], []],
    ['Cambios y garantía', '¿Me puedo arrepentir?', [`Sí. Tenés ${DIAS_ARREPENTIMIENTO} días desde que recibís tu compra, con el botón de arrepentimiento en Mis compras. Es un derecho que te da la Ley de Defensa del Consumidor.`], [['Mis compras', '#/compras'], 'consumidor']],
    ['Cambios y garantía', '¿Tiene garantía?', ['Sí: la garantía del fabricante o de la tienda, y la garantía legal que establece la Ley de Defensa del Consumidor. Si algo falla, nos escribís y hacemos el reclamo por vos.'], [['Escribirnos', '#/mensajes']]],
    ['Impuestos', '¿Tengo que declarar lo que compro?', ['Depende de tu condición ante ARCA. En "Lo impositivo, resuelto" te lo explicamos para tu caso, con lo que tenés en el carrito.'], [['Ver mi caso', '#/impuestos?tab=perfil']]],
    ['Impuestos', '¿Por qué me piden DNI y CUIT o CUIL?', ['La tienda los necesita para facturarte y despacharte, y ARCA los exige en las compras al exterior. Los usamos solo para eso.'], ['datos']],
    ['Compras al exterior', '¿Cuánto puedo traer por courier?', [`Con los valores que usa la app: hasta US$ ${cr.topeValorUSD} y ${cr.topePesoKg} kg por envío, para uso personal. Los primeros US$ ${cr.franquiciaUSD} de cada envío no pagan derechos; sobre el excedente se paga un ${Math.round(cr.derechoExcedente * 100)}%. La normativa cambia seguido: lo mantenemos actualizado y te lo mostramos antes de comprar.`], [['Calculadora', '#/impuestos?tab=calc'], 'envios']],
    ['Compras grandes', '¿Y si quiero traer mucho o para vender?', ['Eso es una compra grande: va con despachante e importación formal. Te acompañamos en todo el proceso.'], [['Compras grandes', '#/grandes']]],
    ['Tu cuenta', '¿Mis datos están seguros?', ['Los usamos solo para comprar, facturar y entregar tus pedidos. Tu clave se guarda cifrada. Podés pedir verlos, corregirlos o borrarlos cuando quieras.'], ['datos']],
    ['Beneficios', '¿Qué es "Más comprás, más ahorrás"?', [`Es nuestra forma de agradecerte. Desde ${nivel.compras} compras pagadas y cierto monto acumulado, accedés a beneficios que no tiene cualquiera, como un descuento en la gestión de NiJu. Cada beneficio lo revisa y lo aprueba una persona del equipo, y lo ves en Mi cuenta.`], [['Mi cuenta', '#/cuenta']]],
    ['Beneficios', '¿Qué son las promociones del cartel?', ['Son campañas de NiJu para las fechas especiales: Día del Padre, Día de la Madre, Hot Sale, Black Friday y más. Cada una dice qué incluye y hasta cuándo vale.'], []],
    ['Ayuda', '¿Cómo me comunico con NiJu?', ['Desde Mensajes, dentro de la app. Te responde una persona.'], [['Escribirnos', '#/mensajes']]]
  ].map(([cat, q, r, links]) => ({ cat, q, r, links }));
}

export function vistaAyuda(ir){
  const lista = preguntas();
  const categorias = ['Todas', ...new Set(lista.map(p => p.cat))];
  let cat = 'Todas', texto = '';
  const plano = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const resultado = el('div', { class:'c-faq' });
  const chips = el('div', { class:'v-chips i-chips' });
  const buscador = el('input', { type:'search', placeholder:'Escribí tu duda: envío, arrepentirme, CUIT…', 'aria-label':'Buscar en las preguntas' });
  buscador.addEventListener('input', () => { texto = buscador.value.trim(); pintar(); });

  function pintar(){
    chips.replaceChildren(...categorias.map(c => el('button', { class:'v-chip' + (cat === c ? ' on' : ''), onclick:() => { cat = c; pintar(); } }, c)));
    const q = plano(texto);
    const visibles = lista.filter(p => (cat === 'Todas' || p.cat === cat) && (!q || plano(p.q + ' ' + p.r.join(' ')).includes(q)));
    resultado.replaceChildren(...(visibles.length ? visibles.map((p, i) => el('details', { open:(q && i < 3) || null },
      el('summary', {}, el('span', {}, el('small', { class:'i-cat' }, p.cat), p.q)),
      el('div', { class:'c-faq-body' },
        ...p.r.map(x => el('p', {}, x)),
        p.links.length ? el('div', { class:'c-links' }, ...p.links.map(l => typeof l === 'string'
          ? fuente(l)
          : el('button', { class:'c-accion', onclick:() => ir(l[1]) }, l[0], ic('der')))) : null)))
      : [el('div', { class:'c-card center' }, el('p', {}, 'No encontramos esa duda.'),
          el('button', { class:'btn btn-win', onclick:() => ir('#/mensajes') }, 'Preguntanos directamente')) ]));
  }
  pintar();

  return el('div', { class:'wrap c-cuenta' },
    botonVolver(ir),
    hero('verde', 'Ayuda', 'Preguntas frecuentes', 'Todo lo que la gente nos pregunta, contado simple. Si tu duda no está, escribinos: te responde una persona.'),
    el('label', { class:'v-tienda-buscar i-buscar' }, ic('buscar'), buscador),
    chips, resultado,
    el('div', { class:'c-acciones', style:{ marginTop:'18px' } },
      el('button', { class:'btn', onclick:() => ir('#/legal') }, 'Términos y condiciones'),
      el('button', { class:'btn', onclick:() => ir('#/nosotros') }, 'Quiénes somos')));
}

/* =================== Términos y condiciones =================== */
/** Los bloques del texto legal. Se usan en la página y en la hoja que se
    abre desde la casilla "Acepto los términos" del registro. */
export function bloquesTerminos(){
  const t = tarifasEnPalabras();
  const cr = REGLAS.courier;
  const tit = CONFIG.titular || {};
  const titular = tit.razonSocial
    ? `${tit.razonSocial}, CUIT ${tit.cuit || '—'}, con domicilio en ${tit.domicilio || '—'}${tit.email ? `, correo ${tit.email}` : ''}`
    : 'el titular de NiJu (sus datos de inscripción se publican en esta sección al completar la constitución de la empresa)';

  const s = (id, titulo, ...parrafos) => ({ id, titulo, parrafos });
  return [
    s('quienes', '1. Quiénes somos y qué hacemos',
      `NiJu es una plataforma operada por ${titular}. Ofrece dos servicios: la comparación de precios de productos publicados por tiendas de terceros, que es gratuita, y la compra asistida, en la que NiJu compra en esas tiendas en nombre y por cuenta del cliente.`,
      'NiJu no fabrica los productos ni es la tienda que los vende. Cada tienda es responsable de su producto, de su factura y de su garantía; NiJu es responsable de la gestión que presta.'),
    s('aceptacion', '2. Aceptación',
      'Al crear una cuenta o confirmar un pedido aceptás estos términos. Si no estás de acuerdo, podés usar el comparador sin comprar. Podés leer estos términos en cualquier momento desde el menú de la app.'),
    s('cuenta', '3. Tu cuenta',
      'Para comprar tenés que ser mayor de 18 años y cargar datos verdaderos: nombre, DNI, CUIT o CUIL, domicilio y condición ante ARCA. Las tiendas los usan para facturar y despachar, y ARCA los exige en compras al exterior.',
      'Tu clave es personal. Si pensás que alguien la conoce, cambiala y avisanos.'),
    s('mandato', '4. La compra asistida (mandato)',
      'Al confirmar un pedido nos das un mandato para comprar en tu nombre los productos elegidos, en las tiendas elegidas, en las condiciones que ves antes de confirmar (Código Civil y Comercial, artículos 1319 y siguientes).',
      'Compramos recién cuando se acredita tu pago. Todo lo que hacemos queda registrado en Mis compras: cada compra en cada tienda, su número de pedido y su envío.'),
    s('precios', '5. Precios, stock y cambios',
      'Los precios se consultan en vivo y se muestran como precio final: producto, envío, impuestos estimados y gestión de NiJu.',
      `Si al comprar el precio de una tienda subió más de un ${pct(TOLERANCIA)}, o no hay stock, te consultamos antes de seguir. Nunca compramos a un precio mayor sin tu conformidad.`),
    s('tarifas', '6. Cuánto cobra NiJu',
      t.comparar, t.nacional, t.exterior, t.grande,
      'La gestión de NiJu se factura por separado, con Factura A o B según tu condición, y siempre la ves sumada antes de confirmar.'),
    s('pagos', '7. Pagos',
      'El pedido queda pendiente de pago hasta que se acredita. Si el pago no se acredita, no se compra nada. Si una tienda no puede venderte un producto ya pagado, te devolvemos ese importe.'),
    s('envios', '8. Envíos y entregas',
      'Los plazos que mostramos son estimados: dependen de cada tienda, del correo y de tu provincia. Podés elegir que cada tienda te despache directo o que juntemos todo en un solo envío. Te pasamos los números de seguimiento.'),
    s('exterior', '9. Compras al exterior',
      `Las compras por courier puerta a puerta son para uso personal y tienen límites de valor y peso (con los valores que usa hoy la app: US$ ${cr.topeValorUSD} y ${cr.topePesoKg} kg por envío). Los tributos de importación los fija la aduana y están a tu cargo; te los mostramos estimados antes de comprar.`,
      'Si la aduana retiene un envío o cambia la normativa, te informamos y gestionamos lo necesario. Las compras para revender o que superan los límites se hacen como importación formal, con despachante.'),
    s('arrepentimiento', '10. Derecho de arrepentimiento',
      `Podés arrepentirte de tu compra dentro de los ${DIAS_ARREPENTIMIENTO} días corridos desde que la recibís o desde que se celebró el contrato, lo último que ocurra, sin dar explicaciones (Ley 24.240 de Defensa del Consumidor, artículo 34, y Código Civil y Comercial, artículo 1110).`,
      'Lo hacés con el botón de arrepentimiento en Mis compras (Resolución 424/2020 de la Secretaría de Comercio Interior). Nosotros gestionamos la devolución ante cada tienda y te informamos cada paso.'),
    s('garantia', '11. Garantías',
      'Los productos tienen la garantía del fabricante o de la tienda y la garantía legal de la Ley 24.240 (artículo 11). Si un producto falla, escribinos por Mensajes y hacemos el reclamo por vos.'),
    s('impuestos', '12. Información impositiva',
      'La información impositiva de la app (carpeta, resumen en PDF, asistente) es orientativa: organiza los datos de tus compras, pero no es asesoramiento profesional ni reemplaza a un contador.'),
    s('datos', '13. Tus datos personales',
      'Tratamos tus datos según la Ley 25.326 de Protección de Datos Personales, solo para comprar, facturar, entregar tus pedidos y, si lo aceptaste, contarte ofertas. Podés pedir acceso, rectificación o supresión escribiéndonos. La Agencia de Acceso a la Información Pública es el órgano de control de esta ley.'),
    s('promos', '14. Promociones y beneficios',
      'Cada promoción indica qué incluye, desde cuándo y hasta cuándo vale. Los beneficios de "Más comprás, más ahorrás" se otorgan según tus compras pagadas, los revisa una persona del equipo y se muestran en Mi cuenta antes de aplicarse.'),
    s('marcas', '15. Marcas de terceros',
      'Los nombres, logos y fotos de productos y tiendas pertenecen a sus dueños y se muestran solo para identificarlos.'),
    s('cambios', '16. Cambios en estos términos',
      'Si cambiamos estos términos, lo avisamos en la app. Los cambios no afectan los pedidos ya confirmados.'),
    s('reclamos', '17. Consultas y reclamos',
      'Escribinos por Mensajes y te responde una persona. Si no quedás conforme, podés acudir a Defensa del Consumidor y al Servicio de Conciliación Previa en las Relaciones de Consumo (Ley 26.993).'),
    s('ley', '18. Ley aplicable',
      'Estos términos se rigen por las leyes de la República Argentina. Para cualquier conflicto son competentes los tribunales del domicilio del consumidor.')
  ];
}

const pintarBloques = bloques => bloques.map(b => el('section', { class:'l-bloque', id:'legal-' + b.id },
  el('h2', {}, b.titulo), ...b.parrafos.map(p => el('p', {}, p))));

export function abrirTerminos(){
  hoja({ titulo:'Términos y condiciones', ancho:760, cuerpo:el('div', { class:'l-hoja' },
    el('p', { class:'c-sub' }, `Última actualización: ${TERMINOS_ACTUALIZADOS}.`), ...pintarBloques(bloquesTerminos())) });
}

export function vistaLegal(ir){
  const bloques = bloquesTerminos();
  return el('div', { class:'wrap c-cuenta' },
    botonVolver(ir),
    hero('gris', 'Legal y comercial', 'Términos y condiciones',
      'Lo que nos comprometemos a hacer y lo que te corresponde, escrito lo más claro posible. Si algo no se entiende, preguntanos.'),
    esDueno() ? el('div', { class:'notice notice-bad', style:{ marginBottom:'14px' } },
      el('b', {}, 'Solo lo ves vos: '), 'este texto es un borrador armado con la normativa argentina de consumo. Antes de publicarlo como definitivo, hacelo revisar por un abogado y cargá los datos del titular en CONFIG.titular.') : null,
    el('div', { class:'l-layout' },
      el('nav', { class:'l-indice', 'aria-label':'Índice' },
        el('b', {}, 'Índice'),
        ...bloques.map(b => el('button', { onclick:() => document.getElementById('legal-' + b.id)?.scrollIntoView({ behavior:'smooth', block:'start' }) }, b.titulo))),
      el('div', { class:'l-texto' },
        el('p', { class:'c-sub' }, `Última actualización: ${TERMINOS_ACTUALIZADOS}.`),
        ...pintarBloques(bloques),
        el('div', { class:'c-links', style:{ marginTop:'18px' } }, fuente('consumidor'), fuente('datos')))));
}

/* =================== Quiénes somos =================== */
export function vistaNosotros(ir){
  const valor = (icono, titulo, texto) => el('div', { class:'i-tarjeta' },
    el('span', { class:'c-ic' }, ic(icono)), el('h3', {}, titulo), el('p', {}, texto));
  return el('div', { class:'wrap c-cuenta' },
    botonVolver(ir),
    el('section', { class:'n-hero' },
      el('span', { class:'n-corazon', 'aria-hidden':'true' }, ic('corazon')),
      el('span', { class:'c-hero-kicker' }, 'Quiénes somos'),
      el('h1', {}, 'Somos una familia que gestiona deseos'),
      el('p', {}, 'Detrás de NiJu no hay una gran corporación: hay una familia que decidió poner su tiempo, su paciencia y su corazón al servicio de los deseos de otras familias.')),

    el('section', { class:'n-historia' },
      el('h2', {}, 'Por qué existimos'),
      el('p', {}, 'Todos conocemos a alguien que alguna vez quiso algo y no lo consiguió. No por falta de ganas, sino porque en el camino aparecieron las palabras que asustan: aduana, franquicia, percepción, despachante, formulario, CUIT.'),
      el('p', {}, 'La abuela que quería el regalo que vio en internet para su nieta. El que arranca un emprendimiento y necesita una máquina que no se consigue acá. La familia que compara precios hasta tarde para que el sueldo alcance. La persona que simplemente no sabe por dónde empezar, y le da vergüenza preguntar.'),
      el('p', { class:'n-destacado' }, 'NiJu nació para ellos. Para que nadie se quede sin lo que desea por no entender un trámite.'),
      el('p', {}, 'Nosotros hacemos la parte difícil: buscamos, comparamos, calculamos cada impuesto, compramos, seguimos cada envío y nos ocupamos de los papeles. Vos solo tenés que contarnos qué querés.')),

    el('h2', { class:'c-seccion' }, 'Lo que creemos'),
    el('div', { class:'i-grilla' },
      valor('corazon', 'Cada pedido es una persona', 'Detrás de cada compra hay una historia, una ilusión, un esfuerzo. La tratamos como si fuera nuestra.'),
      valor('check', 'La verdad antes que la venta', 'Si te conviene comprar directo, te lo decimos, aunque perdamos la venta. Preferimos tu confianza.'),
      valor('etiqueta', 'Sin letra chica', 'Precio final a la vista, cada costo explicado y cada paso registrado. Lo que ves es lo que pagás.'),
      valor('chat', 'Siempre alguien del otro lado', 'Cuando escribís, te responde una persona que quiere ayudarte, no una máquina que te hace esperar.')),

    el('h2', { class:'c-seccion' }, 'Lo que hacemos por vos'),
    el('ul', { class:'i-lista' },
      ...[
        ['buscar', 'Buscamos por vos', 'El mismo producto en muchas tiendas del país y del mundo, en un solo lugar.'],
        ['calc', 'Te decimos cuánto pagás de verdad', 'Con envío, impuestos y gestión sumados, antes de que decidas.'],
        ['caja', 'Compramos y juntamos todo', 'Pagás una vez y nosotros compramos en cada tienda.'],
        ['mundo', 'Nos ocupamos de la aduana', 'Los trámites que asustan son nuestro trabajo de todos los días.'],
        ['envio', 'Te acompañamos hasta que llega', 'Y después también, si algo no está bien.']
      ].map(([icono, titulo, texto]) => el('li', {}, el('span', { class:'c-ic' }, ic(icono)), el('div', {}, el('b', {}, titulo), el('p', {}, texto))))),

    el('section', { class:'n-cierre' },
      el('h2', {}, 'Contanos qué deseás'),
      el('p', {}, 'Puede ser algo chiquito o algo que parece imposible. Lo vamos a intentar con las mismas ganas.'),
      el('div', { class:'c-acciones' },
        el('button', { class:'btn btn-lg n-btn', onclick:() => ir('#/pedido') }, ic('mundo'), 'Traelo por mí'),
        el('button', { class:'btn btn-lg', onclick:() => ir('#/mensajes') }, ic('chat'), 'Escribirnos'))));
}
