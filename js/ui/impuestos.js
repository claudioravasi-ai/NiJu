/* ============================================================
   NiJu — Lo impositivo, resuelto
   Para alguien que no sabe nada de impuestos: primero se explica
   cada cosa con palabras simples y con enlaces a la fuente oficial,
   después la calculadora antes de comprar, y la carpeta con lo que
   ya pagó, trazable pedido por pedido y descargable en PDF.
   ============================================================ */
import { el, plata, ic, toast, hoja } from '../util.js';
import { REGLAS } from '../engine/taxes.js';
import { comparadorDeFee } from '../engine/fees.js';
import { PERFILES, carpetaAnual, csvCarpeta, descargarCSV } from '../engine/fiscal.js';
import { panelImportacion, tarjetaCotizacion } from './desglose.js';
import { comprasDelCliente, DIAS_ARREPENTIMIENTO } from '../engine/ordenes.js';
import { hayCuenta, guardarPerfilNube } from '../engine/nube.js';
import { RUBROS } from '../data/catalog.js';
import { FUENTES, puntosDePerfil } from '../data/fuentes-fiscales.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';
import { botonVolver } from './components.js';
import { descargarResumenPDF } from './resumen-pdf.js';
import { tarjetaAsistente } from './asistente.js';

const PESTANIAS = [
  ['guia',    'Explicado fácil'],
  ['calc',    'Calculadora'],
  ['carpeta', 'Mi carpeta'],
  ['perfil',  'Tu caso'],
  ['reglas',  'Números que usamos']
];

export function vistaImpuestos(ir){
  const pedida = new URLSearchParams(location.hash.split('?')[1] || '').get('tab');
  let tab = PESTANIAS.some(([id]) => id === pedida) ? pedida : 'guia';

  const raiz = el('div', { class:'wrap c-cuenta' });
  const cuerpo = el('div');
  const tabs = el('div', { class:'tabs c-tabs', role:'tablist' });

  /* La pestaña queda en la dirección: al volver desde otra pantalla se
     abre la misma, y se puede mandar el link directo a la carpeta. */
  function cambiar(id){
    tab = id;
    history.replaceState(null, '', `#/impuestos?tab=${id}`);
    pintar();
    tabs.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }

  const paso = (n, icono, titulo, texto, alTocar) => el('li', {},
    el('button', { onclick:alTocar },
      el('span', { class:'c-paso-n' }, String(n)),
      el('span', {}, el('b', {}, ic(icono), titulo), texto)));

  raiz.append(
    botonVolver(ir),
    el('section', { class:'c-hero' },
      el('span', { class:'c-hero-kicker' }, 'Sin trámites, sin sorpresas'),
      el('h1', {}, 'Lo impositivo, resuelto'),
      el('p', {}, 'Cada vez que comprás pagás impuestos, aunque no los veas. NiJu te los muestra antes de pagar, los anota cuando pagás y te arma el resumen para vos o para tu contador.'),
      el('ol', { class:'c-pasos' },
        paso(1, 'calc', 'Antes de comprar', 'Calculamos el precio final con envío e impuestos.', () => cambiar('calc')),
        paso(2, 'check', 'Cuando pagás', 'La compra queda anotada con su número de pedido.', () => ir('#/compras')),
        paso(3, 'caja', 'Después', 'Tu carpeta dice qué recuperás y qué guardar. La bajás en PDF.', () => cambiar('carpeta')))),
    tabs, cuerpo);

  function pintar(){
    tabs.replaceChildren(...PESTANIAS.map(([id, n]) =>
      el('button', { class:'tab' + (tab === id ? ' on' : ''), role:'tab', 'aria-selected':String(tab === id), onclick:() => cambiar(id) }, n)));
    cuerpo.replaceChildren(
      tab === 'guia'    ? guia(ir, cambiar) :
      tab === 'calc'    ? calculadora(ir) :
      tab === 'carpeta' ? carpeta(ir, cambiar) :
      tab === 'perfil'  ? perfil(ir, pintar) : reglas());
  }
  pintar();
  return raiz;
}

const enlaceFuente = id => {
  const f = FUENTES[id];
  return el('a', { class:'c-fuente', href:f.url, target:'_blank', rel:'noopener', title:f.para }, f.titulo);
};
const marcaVerificar = () => REGLAS.verificado ? null
  : el('span', { class:'c-verificar', title:'Parámetro cargado en la app y todavía no contrastado con la norma oficial' }, 'valor a verificar');

/* ---------------- Explicado fácil ---------------- */
function guia(ir, cambiar){
  const u = store.get('usuario');
  const P = PERFILES[u?.perfilFiscal || 'consumidor_final'] || PERFILES.consumidor_final;
  const cr = REGLAS.courier;

  const concepto = (icono, titulo, queEs, enTuCaso, fuentes, accion = null) => el('article', { class:'c-concepto' },
    el('div', { class:'c-concepto-head' }, el('span', { class:'c-ic' }, ic(icono)), el('h3', {}, titulo)),
    ...[].concat(queEs).map(t => el('p', {}, t)),
    enTuCaso ? el('p', { class:'c-afecta' }, el('b', {}, 'En tu caso: '), enTuCaso) : null,
    el('div', { class:'c-links' }, accion, ...fuentes.map(enlaceFuente)));
  const accion = (texto, alTocar) => el('button', { class:'c-accion', onclick:alTocar }, texto, ic('der'));

  const pregunta = (titulo, ...contenido) => el('details', {},
    el('summary', {}, titulo), el('div', { class:'c-faq-body' }, ...contenido));

  const declarar = {
    consumidor_final:'En general no declarás cada compra. Si por tu patrimonio tenés que presentar Bienes Personales, lo que comprás puede formar parte. Guardá igual los comprobantes.',
    monotributo:'No declarás compra por compra, pero ARCA cruza tus compras con lo que facturás para la recategorización. Si comprás mucho y facturás poco, puede llamar la atención.',
    responsable_inscripto:'Sí. El IVA de tus compras va a tu declaración mensual de IVA y cada operación a tu contabilidad.',
    exento:'El IVA no se recupera. Las compras entran en tu contabilidad y en tu declaración de Ganancias.'
  }[u?.perfilFiscal || 'consumidor_final'];

  return el('div', { class:'section' },
    el('h2', { class:'c-seccion' }, 'Lo básico, en seis ideas'),
    el('div', { class:'c-conceptos' },
      concepto('usuario', 'Tu condición ante ARCA',
        'Es cómo estás anotado para pagar impuestos: Consumidor Final (no estás inscripto), Monotributo, Responsable Inscripto o Exento. De eso depende qué podés recuperar de lo que pagás.',
        u ? `figurás como ${P.label}. ${P.desc}` : 'todavía no entraste con tu cuenta, así que calculamos como Consumidor Final.',
        ['monotributo', 'iva'], accion('Ver o cambiar mi condición', () => cambiar('perfil'))),
      concepto('etiqueta', 'El IVA',
        'Es un impuesto que ya viene dentro del precio de casi todo lo que comprás en el país. La tasa general es del 21%.',
        P.computaIVA ? 'lo recuperás: se descuenta del IVA que cobrás en tus ventas.' : 'no lo recuperás: es parte de lo que cuesta el producto.',
        ['iva']),
      concepto('calc', 'Factura A o B',
        'Cada tienda te factura su producto. NiJu te factura aparte solo el servicio de gestión. La Factura A muestra el IVA separado; la B lo trae incluido.',
        `te corresponde Factura ${P.computaIVA ? 'A' : 'B'} por la gestión de NiJu.`,
        ['facturacion']),
      concepto('mundo', 'Comprar en el exterior',
        [`Lo que llega por courier o por Correo Argentino como pequeño envío es para uso personal: hasta ${cr.franquiciasPorAnio} envíos por año, US$ ${cr.topeValorUSD} y ${cr.topePesoKg} kg por envío y ${cr.unidadesPorItem} unidades iguales. Los primeros US$ ${cr.franquiciaUSD} FOB no pagan derecho de importación ni tasa de estadística; el IVA se paga siempre.`],
        'si es para revender, o se pasa de cualquiera de esos límites, va exclusivamente por importación con despachante.',
        ['envios'], accion('Calcular una compra', () => cambiar('calc'))),
      concepto('envio', 'Las percepciones',
        'Son adelantos de impuestos que te cobran en algunas compras, por ejemplo con tarjeta en moneda extranjera o en una importación. No son plata perdida: se descuentan de tus impuestos o se piden en devolución.',
        P.computaPercepciones ? 'las descontás en tu declaración.' : 'como no presentás declaraciones, se piden en devolución con un trámite en ARCA.',
        ['ganancias', 'tramites']),
      concepto('caja', 'Qué comprobantes guardar',
        'La factura de cada tienda, la de NiJu por la gestión y, si importaste, la constancia del courier o el despacho. Tu carpeta te dice cuánto tiempo guardarlos.',
        null, ['facturacion'], accion('Ir a mi carpeta', () => cambiar('carpeta')))),
    el('p', { class:'c-legal' }, marcaVerificar(), ' Los valores de importación son los que tiene cargados la app; la normativa cambia seguido. Mirá la pestaña Parámetros y fuentes.'),

    el('h2', { class:'c-seccion' }, 'Preguntas frecuentes'),
    el('div', { class:'c-faq' },
      pregunta('¿Tengo que declarar lo que compro?',
        el('p', {}, declarar),
        el('p', {}, 'Declaraciones que te pueden alcanzar: ', el('b', {}, P.formularios.join(' · ')), '.')),
      pregunta('¿Un pedido que todavía no pagué cuenta?',
        el('p', {}, 'No. Una compra entra en tu carpeta recién cuando se acredita el pago, con el número de pedido y la fecha de pago. Si un pedido se cancela, sale de la carpeta.'),
        el('button', { class:'c-accion', onclick:() => ir('#/compras') }, 'Ver mis compras', ic('der'))),
      pregunta('¿Qué pasa si compro para revender?',
        el('p', {}, P.puedeReventa
          ? 'Tu condición te lo permite. Registrá la compra y facturá la venta. Si es del exterior, no puede ir por courier: corresponde importación general con despachante.'
          : 'Como Consumidor Final, lo que comprás es para uso propio. Para revender tenés que inscribirte (por ejemplo, en el Monotributo).'),
        el('div', { class:'c-links' }, enlaceFuente('monotributo'), enlaceFuente('envios'))),
      pregunta('¿Por qué la gestión de NiJu tiene IVA?',
        el('p', {}, 'Porque es un servicio: NiJu compra en las tiendas por vos, coordina los envíos y responde por el pedido. Como todo servicio, lleva IVA, incluido en la Factura B o separado en la Factura A.')),
      pregunta('¿Me puedo arrepentir de una compra?',
        el('p', {}, `Sí. NiJu te da ${DIAS_ARREPENTIMIENTO} días para arrepentirte, según las condiciones que ves en cada pedido en Mis compras.`),
        el('div', { class:'c-links' }, enlaceFuente('consumidor'))),
      pregunta('¿Qué hacen con mis datos?',
        el('p', {}, 'Los usamos solo para comprar, facturar y entregar tus pedidos. Podés pedir verlos, corregirlos o borrarlos cuando quieras.'),
        el('div', { class:'c-links' }, enlaceFuente('datos'))),
      pregunta('¿Esto reemplaza a mi contador?',
        el('p', {}, 'No. NiJu ordena la información de tus compras para que la tengas a mano y se la puedas pasar. Las decisiones impositivas, con tu contador.'))),

    el('h2', { class:'c-seccion' }, 'Dónde informarte'),
    el('div', { class:'c-fuentes' }, ...Object.values(FUENTES).map(f =>
      el('a', { class:'c-fuente-card', href:f.url, target:'_blank', rel:'noopener' },
        el('b', {}, f.titulo), el('span', {}, f.para), el('small', {}, new URL(f.url).hostname)))),
    el('p', { class:'c-legal' }, 'Son sitios oficiales y se abren en otra pestaña.'));
}

/* ---------------- Calculadora ----------------
   El mismo panel que "Traelo por mí", con los datos cargados a mano:
   posición NCM del Arancel de ARCA, las cinco etapas del viaje con
   tarifas publicadas y el desglose línea por línea. Antes tenía un
   flete de US$ 35 fijo que no salía de ninguna tarifa, y le ponía
   precio al courier aunque la compra no pudiera ir por courier. */
function calculadora(ir){
  const comparativa = el('div');
  return el('div', { class:'section' },
    panelImportacion({ ir, alCambiar:r => comparativa.replaceChildren(r.fob ? comparativaFee(r.fob) : '') }),
    comparativa);
}

function comparativaFee(valorUSD){
  const opciones = comparadorDeFee(valorUSD);
  const niju = opciones.find(o => o.destacar);
  const masBarata = opciones[0];
  const tope = Math.max(...opciones.map(o => o.usd)) || 1;
  const usd = v => `US$ ${v.toLocaleString('es-AR', { maximumFractionDigits:2 })}`;
  const veredicto = masBarata.destacar
    ? `Para un producto de ${usd(valorUSD)}, NiJu es la opción que menos te cobra por gestionarte la compra: ${usd(niju.usd)}.`
    : `Para un producto de ${usd(valorUSD)}, ${masBarata.quien} cobra menos que NiJu (${usd(masBarata.usd)} contra ${usd(niju.usd)}). Si sabés comprar afuera y hacer el resto vos, te puede convenir. Con NiJu pagás por no tener que hacer nada.`;

  return el('div', { class:'card', style:{ marginTop:'14px' } },
    el('div', { class:'kicker', style:{ marginBottom:'4px' } }, 'Cuánto te cobra cada uno por gestionarte la compra'),
    el('p', { class:'c-sub' },
      'Para el mismo producto, comparamos lo que cuesta el servicio en dólares. El porcentaje es ese costo dividido el valor del producto, calculado igual para todos. No incluye el producto, el envío internacional ni los impuestos de aduana.'),
    el('div', { class:'notice ' + (masBarata.destacar ? 'notice-ok' : ''), style:{ margin:'8px 0 10px' } }, veredicto),
    ...opciones.map(o => el('details', { class:'c-cmp' + (o.destacar ? ' niju' : '') },
      el('summary', {},
        el('b', {}, o.quien),
        el('span', { class:'c-cmp-barra' }, el('i', { style:{ width:Math.round(o.usd / tope * 100) + '%' } })),
        el('span', { class:'c-cmp-num' }, usd(o.usd), el('small', {}, `${o.pct.toLocaleString('es-AR')}% del valor`))),
      el('div', { class:'c-cmp-cuerpo' },
        el('p', {}, el('b', {}, 'Cómo cobra: '), o.formula),
        el('p', {}, el('b', {}, 'Qué hace: '), o.hace),
        el('p', {}, el('b', {}, 'Qué te toca a vos: '), o.teToca)))),
    el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
      'Tocá cada opción para ver qué incluye. NiJu muestra su tarifa real; las demás son valores de referencia de mercado para comparar, no cotizaciones de empresas concretas.'));
}

/* ---------------- Carpeta ---------------- */
function carpeta(ir, cambiar){
  const cont = el('div', { class:'section' }, el('div', { class:'c-card v-sk', style:{ minHeight:'260px' } }));
  const u = store.get('usuario');
  const perfilId = u?.perfilFiscal || 'consumidor_final';

  if (!u || !hayCuenta() && !store.get('usuario')){
    cont.replaceChildren(el('div', { class:'c-card center', style:{ padding:'36px' } },
      el('h3', {}, 'Entrá con tu cuenta para ver tu carpeta'),
      el('p', { class:'c-sub' }, 'La carpeta se arma con tus compras pagadas.'),
      el('button', { class:'btn btn-win', onclick:() => ir('#/cuenta') }, 'Entrar')), cotizacionesGuardadas());
    return cont;
  }

  comprasDelCliente().then(({ pagadas, pendientes }) => {
    if (!cont.isConnected && cont.parentNode === null) { /* sigue armándose aunque no esté a la vista */ }
    const anios = [...new Set([new Date().getFullYear(), ...pagadas.map(x => new Date(x.fecha).getFullYear())])].sort((a, b) => b - a);
    let anio = anios[0];

    const pintar = () => {
      const c = carpetaAnual(pagadas, perfilId, anio);
      const P = c.perfil;
      const kpi = (titulo, valor, explicacion, tono = '') => el('div', { class:'c-kpi ' + tono },
        el('span', { class:'c-kpi-txt' }, el('small', {}, titulo), el('b', {}, valor), el('span', {}, explicacion)));

      const operacion = ({ compra:x, fiscal:f }) => {
        const lista = (titulo, clase, items, campo, vacio) => el('div', { class:'c-op-col ' + clase },
          el('h4', {}, titulo),
          ...(items.length
            ? items.map(i => el('div', { class:'c-op-linea' },
                el('span', {}, i.k, i[campo] ? el('small', {}, i[campo]) : null), el('b', {}, plata(i.v))))
            : [el('p', { class:'c-sub' }, vacio)]));
        return el('details', { class:'c-op' },
          el('summary', {},
            el('span', { class:'c-op-fecha' }, new Date(x.fecha).toLocaleDateString('es-AR'), el('small', {}, 'pago acreditado')),
            el('span', { class:'c-op-tit' }, x.titulo, el('small', {}, `Pedido ${x.ordenId || '—'} · ${x.tienda}`)),
            el('span', { class:'c-op-total' }, plata(x.totalARS),
              el('small', {}, f.totalComputable ? `recuperás ${plata(f.totalComputable)}` : f.totalACuenta ? `a favor ${plata(f.totalACuenta)}` : 'sin recupero'))),
          el('div', { class:'c-op-cuerpo' },
            el('div', { class:'c-op-cols' },
              lista('Recuperás', 'si', f.computable, 'donde', 'Nada que recuperar en esta compra.'),
              lista('Es costo', 'costo', f.costo, 'motivo', 'Ningún impuesto quedó como costo.'),
              lista('A tu favor', 'favor', f.aCuenta, 'donde', 'Sin percepciones.')),
            ...f.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : ''), style:{ marginTop:'8px' } }, a.m)),
            el('div', { class:'c-op-guardar' },
              el('h4', {}, 'Qué guardar'),
              ...f.obligaciones.map(o => el('div', { class:'c-op-linea' }, el('span', {}, o.k, el('small', {}, o.d)), el('b', {}, o.plazo)))),
            el('button', { class:'c-accion', onclick:() => ir('#/compras') }, 'Ver el pedido en Mis compras', ic('der'))));
      };

      cont.replaceChildren(
        el('div', { class:'c-carpeta-head' },
          el('div', {},
            el('h2', {}, `Tu carpeta ${anio}`),
            el('p', { class:'c-sub' }, `Calculada como ${P.label}. `,
              el('button', { class:'p-link', onclick:() => cambiar('perfil') }, '¿No es tu condición?'))),
          anios.length > 1 ? el('select', { class:'inp', style:{ width:'auto' }, 'aria-label':'Año',
            onchange:e => { anio = +e.target.value; pintar(); } },
            ...anios.map(a => el('option', { value:a, selected:a === anio || null }, a))) : null,
          el('div', { class:'c-acciones' },
            el('button', { class:'btn btn-win', onclick:() => descargarResumenPDF({ usuario:store.get('usuario'), carpeta:c, pendientes }) },
              ic('caja'), 'Resumen en PDF'),
            el('button', { class:'btn', disabled:c.operaciones.length ? null : true, onclick:() => {
              descargarCSV(`niju-carpeta-${c.anio}.csv`, csvCarpeta(c)); toast('Planilla descargada', 'win');
            } }, 'Planilla para el contador (CSV)'))),

        el('div', { class:'c-kpis' },
          kpi('Pagado en compras', plata(c.totales.gastado), `${c.operaciones.length} compra${c.operaciones.length === 1 ? '' : 's'} acreditada${c.operaciones.length === 1 ? '' : 's'}`),
          kpi('IVA que recuperás', plata(c.totales.creditoFiscal), P.computaIVA ? 'va a tu declaración de IVA' : 'tu condición no lo permite', 'ok'),
          kpi('Costo que no se recupera', plata(c.totales.costoNoComputable), 'impuestos que quedan en el precio', 'warn'),
          kpi('A tu favor', plata(c.totales.saldoACuenta), P.computaPercepciones ? 'para descontar en tus impuestos' : 'para pedir en devolución')),

        ...c.alertas.map(a => el('div', { class:'notice ' + (a.t === 'ok' ? 'notice-ok' : ''), style:{ marginBottom:'10px' } }, a.m)),

        c.operaciones.length
          ? el('div', { class:'c-ops' },
              el('p', { class:'c-sub' }, 'Tocá una compra para ver qué recuperás, qué es costo y qué comprobantes guardar.'),
              ...c.operaciones.slice().sort((a, b) => b.compra.fecha - a.compra.fecha).map(operacion))
          : el('div', { class:'c-card center', style:{ padding:'32px' } },
              el('div', { class:'c-ic c-ic-grande' }, ic('caja')),
              el('h3', { style:{ margin:'10px 0 6px' } }, `Todavía no hay compras pagadas en ${anio}`),
              el('p', { class:'c-sub' }, 'Cada compra entra acá cuando se acredita el pago, con su número de pedido y todo su detalle impositivo.')),

        pendientes.length ? el('div', { class:'c-card', style:{ marginTop:'16px' } },
          el('div', { class:'c-card-head' }, el('h2', {}, 'Todavía no cuentan')),
          el('p', { class:'c-sub' }, 'Estos pedidos están pendientes de pago. Entran en la carpeta cuando se acredite el pago.'),
          ...pendientes.map(o => el('div', { class:'c-op-linea' },
            el('span', {}, `Pedido ${o.id}`, el('small', {}, `confirmado el ${new Date(o.creada).toLocaleDateString('es-AR')}`)),
            el('b', {}, plata(o.totalARS)))),
          el('button', { class:'c-accion', onclick:() => ir('#/compras') }, 'Ir a pagar en Mis compras', ic('der'))) : '',

        cotizacionesGuardadas(),

        el('p', { class:'c-legal' },
          'Trazabilidad: cada compra lleva su número de pedido y la fecha en que se acreditó el pago. Si un pedido se cancela, sale de la carpeta. El resumen PDF lleva un código de control que cambia si cambia cualquier dato.'));
    };
    pintar();
  }).catch(e => {
    cont.replaceChildren(el('div', { class:'notice notice-bad' }, 'No pudimos leer tus compras: ' + (e.message || e)));
  });

  return cont;
}

/* Cotizaciones de importación guardadas: no son compras, no cuentan
   en la carpeta, pero guardan todo el desglose para consultarlo. */
function cotizacionesGuardadas(){
  const lista = [
    ...(store.get('importaciones') || []),
    ...(store.get('pedidos') || []).filter(p => p.desglose).map(p => ({ ...p.desglose, pedidoId:p.id }))
  ].sort((a, b) => b.creado - a.creado);
  if (!lista.length) return '';
  return el('div', { class:'c-card', style:{ marginTop:'16px' } },
    el('div', { class:'c-card-head' }, el('h2', {}, 'Tus cotizaciones de importación')),
    el('p', { class:'c-sub' }, 'Guardadas con su desglose completo. No son compras: no cuentan en la carpeta hasta que se paguen.'),
    el('div', { class:'c-ops' }, ...lista.map(tarjetaCotizacion)));
}

/* ---------------- Mi condición ---------------- */
function perfil(ir, repintar){
  const u = store.get('usuario');
  const actual = u?.perfilFiscal || 'consumidor_final';

  const tarjetas = Object.entries(PERFILES).map(([id, p]) => el('div', {
    class:'card hoverable', style:{ borderColor: id === actual ? 'var(--accion)' : '', boxShadow: id === actual ? '0 0 0 2px var(--accion)' : '' },
    onclick:() => { if (id !== actual) cambiarCondicion(id, ir, repintar); }
  },
    el('div', { class:'row-b' },
      el('h3', {}, p.label),
      id === actual ? el('span', { class:'tag tag-win' }, 'Tu condición') : el('span', { class:'tiny', style:{ color:'var(--accion)', fontWeight:'600' } }, 'Elegir')),
    el('p', { class:'tiny muted', style:{ margin:'8px 0' } }, p.desc),
    el('ul', { class:'c-puntos' }, ...puntosDePerfil(p).map(x =>
      el('li', { class:x.si ? 'si' : 'no' }, ic(x.si ? 'check' : 'alerta'), el('span', {}, el('b', {}, x.titulo))))),
    p.alerta ? el('div', { class:'notice', style:{ marginTop:'10px' } }, p.alerta) : null,
    el('div', { class:'kicker', style:{ margin:'12px 0 5px' } }, 'Te pueden alcanzar'),
    el('div', { class:'row wrapf' }, ...p.formularios.map(f => el('span', { class:'chip tiny' }, f)))));

  return el('div', { class:'section' },
    tarjetaAsistente({ ir, completa:true, alCambiar:repintar }),
    el('h2', { class:'c-seccion' }, '¿Es otra tu condición? Elegila acá'),
    el('p', { class:'muted', style:{ marginBottom:'6px' } },
      'Elegí la condición que figura en tu constancia de inscripción en ARCA. Con eso calculamos, en cada compra, qué podés recuperar, qué es costo y qué te queda a favor.'),
    el('p', { class:'c-sub', style:{ marginBottom:'14px' } }, 'Si no estás inscripto en nada, sos Consumidor Final. ', enlaceFuente('monotributo')),
    el('div', { class:'grid g-2' }, ...tarjetas),
    el('div', { class:'notice', style:{ marginTop:'16px' } },
      'NiJu organiza tu información. No es asesoramiento impositivo ni reemplaza a tu contador.'));
}

/** Cambiar la condición cambia la factura y los cálculos: se confirma y
    se guarda en la cuenta (antes quedaba solo en el teléfono). */
function cambiarCondicion(id, ir, repintar){
  const u = store.get('usuario');
  const P = PERFILES[id];
  if (!u){ toast('Entrá con tu cuenta para guardar tu condición', 'bad'); ir('#/cuenta'); return; }
  let ventana = null;
  const confirmar = el('button', { class:'btn btn-win btn-lg btn-block', onclick: async () => {
    confirmar.disabled = true;
    try{
      const nuevo = { ...u, perfilFiscal:id };
      if (hayCuenta()) await guardarPerfilNube(nuevo); else store.set('usuario', nuevo);
      toast('Guardamos tu condición: ' + P.label, 'win');
      ventana.cerrar();
      repintar();
    }catch(e){ toast(e.message || 'No se pudo guardar', 'bad'); confirmar.disabled = false; }
  } }, 'Sí, soy ' + P.label);

  ventana = hoja({ titulo:'Cambiar tu condición ante ARCA', cuerpo:el('div', { class:'col' },
    el('p', {}, el('b', {}, P.label + '. '), P.desc),
    el('div', { class:'notice' }, 'Tiene que coincidir con tu constancia de inscripción. Cambia cómo te facturamos (A o B) y tu carpeta se recalcula con la condición nueva.'),
    P.requiereCUIT && !u.cuit ? el('div', { class:'notice notice-bad' }, 'Esta condición necesita CUIT. Cargalo en Mi cuenta → Editar antes de comprar.') : null,
    confirmar,
    el('button', { class:'btn btn-block', onclick:() => ventana.cerrar() }, 'Cancelar')) });
}

/* ---------------- Números que usamos ---------------- */
const siNo = v => v ? 'Sí' : 'No';
const porciento = v => `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits:2 })}%`;
const dolares = v => `US$ ${Number(v).toLocaleString('es-AR')}`;

/* Cada parámetro con su nombre en castellano y cómo leerlo. */
const EXPLICADOS = {
  courier:[
    ['franquiciaUSD', 'Parte de cada envío (FOB) sin derecho ni tasa de estadística', dolares],
    ['franquiciasPorAnio', 'Pequeños envíos por persona por año', v => String(v)],
    ['topeValorUSD', 'Valor máximo por envío', dolares],
    ['topePesoKg', 'Peso máximo por paquete', v => `${v} kg`],
    ['unidadesPorItem', 'Unidades iguales como máximo', v => String(v)],
    ['tasaEstadistica', 'Tasa de estadística sobre lo que supera la franquicia', porciento],
    ['iva', 'IVA (se paga siempre, aun dentro de la franquicia)', porciento],
    ['requiereCUIT', '¿Hace falta CUIT?', siNo]
  ],
  general:[
    ['derechoPorDefecto', 'Derecho de importación promedio (el real sale del Arancel)', porciento],
    ['tasaEstadistica', 'Tasa de estadística (con tope)', porciento],
    ['iva', 'IVA de importación', porciento],
    ['ivaAdicional', 'Percepción de IVA (no aplica a uso particular)', porciento],
    ['ganancias', 'Percepción de Ganancias', porciento],
    ['gananciasUsoParticular', 'Percepción de Ganancias para uso particular', porciento],
    ['despachanteReferenciaUSD', 'Honorario mínimo sugerido de despachante (CDA)', dolares],
    ['requiereCUIT', '¿Hace falta CUIT?', siNo]
  ],
  tarjeta:[
    ['percepcionGanancias', 'Percepción de Ganancias cargada para consumos con tarjeta', porciento]
  ]
};

function reglas(){
  const bloque = (icono, titulo, explicacion, clave) => el('section', { class:'c-card', style:{ marginBottom:'14px' } },
    el('div', { class:'c-concepto-head', style:{ marginBottom:'6px' } }, el('span', { class:'c-ic' }, ic(icono)), el('h3', {}, titulo)),
    el('p', { class:'c-sub' }, explicacion),
    el('dl', { class:'c-datos' }, ...EXPLICADOS[clave].flatMap(([k, etiqueta, formato]) =>
      [el('dt', {}, etiqueta), el('dd', {}, formato(REGLAS[clave][k]))])),
    REGLAS[clave].nota ? el('p', { class:'c-nota' }, REGLAS[clave].nota) : null);

  return el('div', { class:'section' },
    el('p', { class:'muted', style:{ marginBottom:'12px' } },
      'Estos son los números con los que la app calcula tus impuestos. Los mostramos explicados para que cualquiera pueda revisarlos.'),
    REGLAS.verificado ? null : el('div', { class:'notice notice-bad', style:{ marginBottom:'14px' } },
      `Valores cargados el ${REGLAS.actualizado} y todavía no confirmados contra el texto oficial de ARCA. Tomalos como estimación.`),
    el('div', { class:'c-card', style:{ marginBottom:'14px' } },
      el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'Dónde lo dice el Estado'),
      el('div', { class:'c-links' }, ...Object.keys(FUENTES).map(enlaceFuente))),
    bloque('envio', 'Compras por courier (uso personal)', 'Lo que llega puerta a puerta desde el exterior, para vos o tu familia.', 'courier'),
    bloque('caja', 'Importación con despachante (compras grandes)', 'Para vender, para muchas unidades o cuando se pasan los límites del courier.', 'general'),
    bloque('etiqueta', 'Pagos con tarjeta al exterior', 'Lo que se agrega cuando se paga afuera con tarjeta.', 'tarjeta'),
    el('section', { class:'c-card' },
      el('div', { class:'c-concepto-head', style:{ marginBottom:'6px' } }, el('span', { class:'c-ic' }, ic('calc')), el('h3', {}, 'Derecho de importación por rubro')),
      el('p', { class:'c-sub' }, 'Aproximado para importación con despachante. El real depende de la posición arancelaria exacta del producto.'),
      el('dl', { class:'c-datos' }, ...Object.entries(REGLAS.arancelPorRubro).filter(([k]) => k !== '_default').flatMap(([k, v]) =>
        [el('dt', {}, RUBROS.find(r => r.id === k)?.nombre || k), el('dd', {}, v + '%')]))));
}
