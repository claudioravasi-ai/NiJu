/* ============================================================
   NiJu — Órdenes de compra asistida
   Dos miradas de lo mismo:
     · la del cliente: "Mis compras", dónde está cada cosa
     · la del dueño: qué cobrar, qué comprar en cada tienda (de
       todos los clientes juntos), y el seguimiento de cada envío
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import {
  ESTADOS, ENVIO, MODALIDADES, PASOS_ENVIO, EMPRESAS_ENVIO, TOLERANCIA, destinoDe,
  listarOrdenes, listarLotes, responder, puedeArrepentirse, resultado,
  confirmarPago, cancelarOrden, cancelarLinea, reintentarLinea, aceptarDiferencia, atenderRespuesta,
  armarCompras, simular, enlaceCarrito, enlaceRenglon, registrarCompra,
  actualizarEnvioLote, actualizarEnvioTramo, actualizarEnvioFinal
} from '../engine/ordenes.js';
import { modo, hayCuenta } from '../engine/nube.js';
import { PERFILES } from '../engine/fiscal.js';
import { PAGOS } from '../data/niju-directo.js';
import { domicilioTexto, formatoCuit, nombreFactura } from '../engine/perfil.js';
import { logoTienda, foto, vacio } from './components.js';

const cargando = texto => el('div', { class:'card center', style:{ padding:'30px' } }, el('span', { class:'dim' }, texto));
const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);
const tagEnvio = estado => { const e = ENVIO[estado] || ENVIO.pendiente; return el('span', { class:'tag', style:{ color:e.color } }, e.label); };

function copiar(texto){
  navigator.clipboard?.writeText(texto).then(() => toast('Copiado', 'win'), () => toast('No se pudo copiar', 'bad'));
}

function errorCaja(e, reintentar){
  return el('div', { class:'card center', style:{ padding:'30px' } },
    el('h3', { style:{ marginBottom:'6px' } }, 'No se pudo cargar'),
    el('p', { class:'muted tiny' }, e.message || String(e)),
    el('button', { class:'btn btn-win', onclick:reintentar }, 'Probar de nuevo'));
}

const avisoSinBase = () => el('div', { class:'notice notice-bad', style:{ marginBottom:'14px' } },
  el('b', {}, 'Sin base de datos. '),
  'El servidor todavía no tiene el almacén KV: las compras quedan guardadas solo en este dispositivo y el dueño no las ve desde otro. Ver backend/DESPLIEGUE.md, paso E.');

/* Botón que se bloquea mientras trabaja, para no guardar dos veces. */
function accion(etiqueta, fn, clase = 'btn btn-sm'){
  const b = el('button', { class:clase, onclick: async () => {
    b.disabled = true;
    try{ await fn(); }
    catch(e){ toast(e.message || 'No se pudo guardar', 'bad'); }
    finally{ b.disabled = false; }
  } }, etiqueta);
  return b;
}

/* ================================================================
   LO QUE VE EL CLIENTE — Mis compras
   ================================================================ */
export function vistaMisCompras(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div', { class:'section' }, cargando('Buscando tus compras…'));
  raiz.append(cuerpo);

  async function cargar(){
    let m, os;
    try{
      m = await modo();
      if (m === 'nube' && !hayCuenta()){
        cuerpo.replaceChildren(el('div', { class:'card center', style:{ padding:'40px', maxWidth:'520px', margin:'30px auto' } },
          el('h2', { style:{ marginBottom:'8px' } }, 'Entrá para ver tus compras'),
          el('p', { class:'muted tiny' }, 'El seguimiento de cada pedido está en tu cuenta, así lo ves desde cualquier teléfono.'),
          el('button', { class:'btn btn-lg btn-win', onclick:() => ir('#/cuenta') }, 'Entrar o crear cuenta')));
        return;
      }
      os = await listarOrdenes({ dueno:false });
    }catch(e){ cuerpo.replaceChildren(errorCaja(e, cargar)); return; }

    cuerpo.replaceChildren(
      el('div', { class:'kicker' }, 'Seguimiento'),
      el('h1', { style:{ marginBottom:'16px' } }, 'Mis compras'),
      m === 'local' ? avisoSinBase() : '',      /* replaceChildren escribe "null" si le pasás null */
      os.length
        ? el('div', { class:'col' }, ...os.map(o => tarjetaCompra(o, cargar)))
        : vacio('Todavía no compraste nada', 'Cuando confirmes un pedido, acá vas a ver en qué anda cada producto de cada tienda.'));

    /* Lo que se mostró queda leído (se pinta primero, así se ve resaltado). */
    const conNovedades = os.filter(o => (o.avisos || []).some(a => !a.leido));
    if (conNovedades.length){
      Promise.all(conNovedades.map(o => responder(o, 'leido').catch(() => null)))
        .then(() => window.dispatchEvent(new Event('niju:avisos')));
    }
  }

  cargar();
  return raiz;
}

function pasosOrden(o){
  const consolidado = o.modalidad === 'consolidado';
  const nombres = consolidado
    ? ['Pedido', 'Pago', 'Compra', 'En NiJu', 'En camino', 'Entregado']
    : ['Pedido', 'Pago', 'Compra', 'Despachado', 'Entregado'];
  const hecho = (consolidado
    ? { pendiente_pago:0, pagada:1, comprando:1, consultando:1, preparando:2, en_deposito:3, enviada:4, entregada:5 }
    : { pendiente_pago:0, pagada:1, comprando:1, consultando:1, preparando:2, enviada:3, entregada:4 })[o.estado] ?? -1;
  if (o.estado === 'cancelada') return null;
  return el('div', { class:'pasos' }, ...nombres.map((n, i) =>
    el('div', { class:'paso' + (i <= hecho ? ' hecho' : i === hecho + 1 ? ' actual' : '') }, n)));
}

function cajaSeguimiento(s){
  if (!s || !(s.numero || s.url || s.empresa)) return null;
  return el('div', { class:'envio-caja' },
    ic('envio'),
    el('span', { class:'tiny spacer' },
      s.empresa ? el('b', {}, s.empresa) : 'Envío',
      s.numero ? ` · N° ${s.numero}` : ''),
    s.numero ? el('button', { class:'btn btn-sm btn-ghost', onclick:() => copiar(s.numero) }, 'Copiar número') : null,
    s.url ? el('a', { class:'btn btn-sm', href:s.url, target:'_blank', rel:'noopener' }, 'Seguir el envío') : null);
}

function tarjetaCompra(o, refrescar){
  const e = ESTADOS[o.estado] || ESTADOS.pendiente_pago;
  const nuevos = (o.avisos || []).filter(a => !a.leido);
  const lineas = o.tramos.flatMap(t => t.lineas);
  const unidades = lineas.filter(l => l.estado !== 'cancelado').reduce((a, l) => a + l.cant, 0);
  const problemas = lineas.filter(l => l.estado === 'problema');
  const pendientes = (o.respuestas || []).filter(r => !r.atendida);

  const responderYRefrescar = async (tipo, extra, mensaje) => {
    await responder(o, tipo, extra);
    toast(mensaje, 'win');
    refrescar();
  };

  return el('div', { class:'card', style:{ borderLeft:`4px solid ${e.color}` } },
    el('div', { class:'row-b wrapf' },
      el('div', {},
        el('div', { class:'row wrapf', style:{ gap:'8px' } },
          el('b', {}, o.id),
          el('span', { class:'tag', style:{ color:e.color } }, e.label),
          nuevos.length ? el('span', { class:'tag tag-win' }, `${nuevos.length} novedad${nuevos.length > 1 ? 'es' : ''}`) : null),
        el('div', { class:'tiny dim' },
          `${fecha(o.creada)} · ${unidades} producto${unidades === 1 ? '' : 's'} de ${o.tramos.length} tienda${o.tramos.length > 1 ? 's' : ''} · ${MODALIDADES[o.modalidad]?.nombre || ''}`)),
      el('div', { style:{ textAlign:'right' } },
        el('div', { class:'price price-lg' }, plata(o.totalARS)),
        el('div', { class:'tiny dim' }, 'total del pedido'))),

    pasosOrden(o),
    el('div', { class:'notice' + (o.estado === 'consultando' ? ' notice-bad' : o.estado === 'cancelada' ? ' notice-bad' : ' notice-ok') }, e.desc),

    /* Decisiones que esperan al cliente */
    o.necesitaOK && o.estado !== 'cancelada' ? el('div', { class:'card', style:{ marginTop:'10px', boxShadow:'0 0 0 2px var(--warn)' } },
      el('b', {}, 'Tenés que decidir'),
      ...problemas.map(l => el('div', { class:'row-b wrapf', style:{ padding:'8px 0', borderBottom:'1px solid var(--line-soft)' } },
        el('div', { class:'tiny' }, el('b', {}, l.titulo), l.variante?.texto ? ` · ${l.variante.texto}` : '', el('div', { class:'dim' }, l.nota || 'Sin stock')),
        pendientes.some(r => r.lineaId === l.id)
          ? el('span', { class:'tag' }, 'Ya nos avisaste')
          : accion('Cancelalo y devolveme', () => responderYRefrescar('cancelo', { lineaId:l.id }, 'Listo, lo cancelamos y te devolvemos esa parte'), 'btn btn-sm'))),
      o.diferenciaPct > (o.tolerancia ?? TOLERANCIA) && !o.diferenciaAceptada
        ? el('div', { style:{ paddingTop:'8px' } },
            el('div', { class:'tiny' }, `Los precios subieron ${plata(Math.round(o.diferencia))} en total desde que confirmaste.`),
            pendientes.some(r => ['acepto', 'cancelo'].includes(r.tipo) && !r.lineaId)
              ? el('span', { class:'tag' }, 'Ya nos avisaste')
              : el('div', { class:'row wrapf', style:{ marginTop:'8px' } },
                  accion('Acepto la diferencia', () => responderYRefrescar('acepto', {}, 'Gracias, seguimos con la compra'), 'btn btn-sm btn-win'),
                  accion('Prefiero cancelar', () => responderYRefrescar('cancelo', {}, 'Recibimos tu pedido de cancelación'))))
        : null) : null,

    /* Una fila por tienda: qué se compró y dónde está */
    ...o.tramos.map(t => bloqueTramo(o, t)),

    o.modalidad === 'consolidado' && o.envioFinal ? el('div', { class:'tramo' },
      el('div', { class:'row-b' }, el('b', { class:'tiny' }, 'Envío de NiJu a tu casa'), tagEnvio(o.envioFinal.estado)),
      cajaSeguimiento(o.envioFinal)) : null,

    (o.reintegros || []).length ? el('div', { class:'tramo' },
      el('b', { class:'tiny' }, 'Devoluciones de dinero'),
      ...o.reintegros.map(r => el('div', { class:'row-b tiny', style:{ padding:'4px 0' } },
        el('span', {}, `${r.titulo} · ${r.motivo}`), el('b', { class:'mono' }, plata(r.monto))))) : null,

    (o.avisos || []).length ? el('details', { class:'tramo', open:nuevos.length ? true : null },
      el('summary', { class:'tiny', style:{ cursor:'pointer', fontWeight:'600' } }, `Novedades (${o.avisos.length})`),
      ...o.avisos.slice().reverse().map(a => el('div', { class:'aviso' + (a.leido ? '' : ' aviso-nuevo'), style:{ padding:'8px 0' } },
        el('div', { class:'row-b' }, el('b', { class:'tiny' }, a.titulo), el('span', { class:'tiny dim' }, fecha(a.ts))),
        el('div', { class:'tiny muted' }, a.texto),
        cajaSeguimiento(a.seguimiento)))) : null,

    el('details', { class:'tramo' },
      el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Ver el paso a paso'),
      ...(o.historia || []).slice().reverse().map(h => el('div', { class:'row', style:{ padding:'5px 0', alignItems:'flex-start' } },
        el('span', { class:'tiny dim mono', style:{ width:'110px', flex:'0 0 110px' } }, fecha(h.ts)),
        el('span', { class:'tiny' }, h.nota || ESTADOS[h.estado]?.label)))),

    el('div', { class:'row wrapf', style:{ marginTop:'10px', justifyContent:'flex-end' } },
      el('button', { class:'btn btn-sm btn-ghost', onclick:() => hojaConsulta(o, refrescar) }, ic('chat'), 'Consultar por este pedido'),
      puedeArrepentirse(o)
        ? el('button', { class:'btn btn-sm', style:{ color:'var(--bad)' }, onclick:() => hojaArrepentimiento(o, refrescar) }, 'Botón de arrepentimiento')
        : null));
}

function bloqueTramo(o, t){
  const est = ENVIO[t.estado] || ENVIO.pendiente;
  const envios = (t.envios || []).filter(x => x.empresa || x.numero || x.url);
  return el('div', { class:'tramo' },
    el('div', { class:'row', style:{ alignItems:'flex-start' } },
      logoTienda(t.tiendaId),
      el('div', { class:'spacer', style:{ minWidth:0 } },
        el('div', { class:'row-b' },
          el('b', { class:'tiny' }, t.propio ? 'Despacha NiJu' : `Compra en ${t.tienda}`),
          el('span', { class:'tag', style:{ color:est.color } }, est.label)),
        ...t.lineas.map(l => el('div', { class:'row', style:{ padding:'6px 0', gap:'10px' } },
          foto(l, 'cart-thumb mini-thumb'),
          el('div', { class:'spacer tiny', style:{ minWidth:0 } },
            el('div', { style:l.estado === 'cancelado' ? { textDecoration:'line-through', color:'var(--tx-3)' } : {} }, `${l.cant}× ${l.titulo}`),
            l.variante?.texto ? el('div', { class:'linea-var' }, l.variante.texto) : null,
            ['problema', 'cancelado'].includes(l.estado) ? el('div', { style:{ color:'var(--bad)' } }, l.nota || ENVIO[l.estado].label) : null))),
        ...envios.map(cajaSeguimiento))));
}

function hojaConsulta(o, refrescar){
  let texto = '';
  const h = hoja({ titulo:`Consulta · ${o.id}`, ancho:480, cuerpo:el('div', { class:'col' },
    el('textarea', { class:'inp', placeholder:'¿Qué necesitás saber?', oninput:e => texto = e.target.value }),
    accion('Enviar', async () => {
      if (!texto.trim()) return toast('Escribí tu consulta', 'bad');
      await responder(o, 'consulta', { nota:texto.trim() });
      toast('Recibimos tu consulta', 'win'); h.cerrar(); refrescar();
    }, 'btn btn-win btn-block')) });
}

function hojaArrepentimiento(o, refrescar){
  let motivo = '';
  const h = hoja({ titulo:'Botón de arrepentimiento', ancho:520, cuerpo:el('div', { class:'col' },
    el('p', { class:'tiny muted' },
      'Tenés 10 días corridos desde que compraste o desde que recibiste el pedido (lo último) para arrepentirte, sin dar explicaciones (Ley 24.240, art. 34). Te confirmamos la cancelación y te devolvemos el dinero.'),
    el('div', { class:'field' }, el('label', {}, 'Motivo (opcional)'),
      el('textarea', { class:'inp', oninput:e => motivo = e.target.value })),
    accion('Quiero arrepentirme de esta compra', async () => {
      await responder(o, 'arrepentimiento', { nota:motivo.trim() });
      toast('Recibimos tu pedido. Te confirmamos por acá.', 'win'); h.cerrar(); refrescar();
    }, 'btn btn-block')) });
}

/* ================================================================
   LO QUE VE EL DUEÑO — Panel → Órdenes para comprar
   ================================================================ */
export function vistaOperacion(){
  const raiz = el('div', {}, cargando('Trayendo órdenes y compras…'));
  let sub = null;
  let datos = { ordenes:[], lotes:[], modo:'local' };

  async function cargar(){
    try{
      const [m, ordenes, lotes] = await Promise.all([modo(), listarOrdenes({ dueno:true }), listarLotes()]);
      datos = { modo:m, ordenes, lotes };
      pintar();
    }catch(e){ raiz.replaceChildren(errorCaja(e, cargar)); }
  }

  function pintar(){
    const { ordenes, lotes } = datos;
    const porCobrar = ordenes.filter(o => o.estado === 'pendiente_pago');
    const compras = armarCompras(ordenes);
    const lotesActivos = lotes.filter(l => !['en_deposito', 'entregado'].includes(l.envio?.estado));
    const abiertas = ordenes.filter(o => !['entregada', 'cancelada'].includes(o.estado));
    const conRespuesta = ordenes.filter(o => (o.respuestas || []).some(r => !r.atendida));
    sub ||= porCobrar.length && !compras.length ? 'cobrar' : 'comprar';

    const margen = abiertas.filter(o => o.estado !== 'pendiente_pago').reduce((a, o) => a + resultado(o).margen, 0);
    const pestanias = [
      ['cobrar', `Por cobrar (${porCobrar.length})`],
      ['comprar', `Para comprar (${compras.length} tienda${compras.length === 1 ? '' : 's'})`],
      ['seguimiento', `Compras hechas (${lotesActivos.length} en curso)`],
      ['ordenes', `Órdenes (${abiertas.length})` + (conRespuesta.length ? ` · ${conRespuesta.length} con respuesta` : '')]
    ];

    raiz.replaceChildren(
      datos.modo === 'local' ? avisoSinBase() : '',
      el('div', { class:'grid g-4', style:{ marginBottom:'16px' } },
        kpi('Por cobrar', plata(porCobrar.reduce((a, o) => a + o.totalARS, 0)), `${porCobrar.length} pedido(s)`, 'var(--warn)'),
        kpi('Tenés que comprar', plata(compras.reduce((a, t) => a + t.aPagar, 0)), `en ${compras.length} tienda(s)`),
        kpi('Envíos en curso', String(lotesActivos.length), 'compras hechas sin entregar'),
        kpi('Margen estimado', plata(margen), 'órdenes pagadas abiertas', 'var(--win-tx)')),
      el('div', { class:'subtabs' }, ...pestanias.map(([id, n]) =>
        el('button', { class:'chip' + (sub === id ? ' on' : ''), onclick:() => { sub = id; pintar(); } }, n)),
        el('span', { class:'spacer' }),
        el('button', { class:'btn btn-sm btn-ghost', onclick:cargar }, 'Actualizar')),
      sub === 'cobrar' ? vistaCobrar(porCobrar, cargar)
      : sub === 'comprar' ? vistaComprar(compras, ordenes, cargar)
      : sub === 'seguimiento' ? vistaSeguimiento(lotes, ordenes, cargar)
      : vistaOrdenes(ordenes, cargar));
  }

  cargar();
  return raiz;
}

/* ---------------- Por cobrar ---------------- */
function vistaCobrar(ordenes, refrescar){
  if (!ordenes.length) return vacio('No hay pedidos esperando pago', 'Cuando un cliente confirme un pedido, aparece acá hasta que marques el pago como acreditado.');
  return el('div', { class:'col' },
    el('div', { class:'notice' }, el('b', {}, 'Todavía no hay cobro dentro de la app. '),
      'El cliente confirma y queda "pendiente de pago". Cuando te llegue la plata (transferencia, link de Mercado Pago), confirmalo acá: recién ahí aparece en "Para comprar".'),
    ...ordenes.map(o => el('div', { class:'card' },
      el('div', { class:'row-b wrapf' },
        el('div', {},
          el('b', {}, o.id), el('span', { class:'tiny dim' }, ' · ' + fecha(o.creada)),
          el('div', { class:'tiny' }, `${o.cliente?.nombre} · ${o.cliente?.telefono || 'sin teléfono'} · ${o.cliente?.email || ''}`),
          el('div', { class:'tiny dim' }, `Eligió pagar con ${PAGOS.find(p => p.id === o.pago)?.nombre || o.pago} · ${MODALIDADES[o.modalidad]?.nombre}`)),
        el('div', { style:{ textAlign:'right' } }, el('div', { class:'price price-lg' }, plata(o.totalARS)))),
      el('div', { class:'row wrapf', style:{ marginTop:'10px' } },
        el('button', { class:'btn btn-sm btn-win', onclick:() => {
          let nota = '';
          const h = hoja({ titulo:`Confirmar pago · ${o.id}`, ancho:440, cuerpo:el('div', { class:'col' },
            el('div', { class:'field' }, el('label', {}, 'Referencia del pago (opcional)'),
              el('input', { class:'inp', placeholder:'Ej: transferencia 12/09, operación MP 123…', oninput:e => nota = e.target.value })),
            accion(`Confirmar ${plata(o.totalARS)} acreditados`, async () => {
              await confirmarPago(o, nota.trim()); toast('Pago confirmado. El cliente recibe el aviso.', 'win'); h.cerrar(); refrescar();
            }, 'btn btn-win btn-block')) });
        } }, 'Confirmar pago recibido'),
        el('button', { class:'btn btn-sm', style:{ color:'var(--bad)' }, onclick:() => hojaCancelar(o, refrescar) }, 'Cancelar pedido')))));
}

function hojaCancelar(o, refrescar){
  let motivo = '';
  const comprado = o.tramos.some(t => t.lineas.some(l => l.estado === 'comprado'));
  const h = hoja({ titulo:`Cancelar ${o.id}`, ancho:460, cuerpo:el('div', { class:'col' },
    comprado ? el('div', { class:'notice notice-bad' }, 'Hay productos ya comprados: gestioná la devolución en esas tiendas antes de devolver el dinero.') : null,
    el('div', { class:'field' }, el('label', {}, 'Motivo que ve el cliente'),
      el('input', { class:'inp', oninput:e => motivo = e.target.value })),
    accion('Cancelar y avisar al cliente', async () => {
      await cancelarOrden(o, motivo.trim()); toast('Pedido cancelado', 'win'); h.cerrar(); refrescar();
    }, 'btn btn-block')) });
}

/* ---------------- Para comprar ---------------- */
function vistaComprar(compras, ordenes, refrescar){
  if (!compras.length) return vacio('No hay nada para comprar', 'Los pedidos aparecen acá cuando confirmás el pago. Se juntan por tienda, de todos los clientes.');

  return el('div', {},
    el('div', { class:'notice', style:{ marginBottom:'12px' } },
      el('b', {}, 'Todo lo que hay que comprar, junto por tienda. '),
      'Primero simulá: la app consulta cada producto en la tienda (precio y stock de ahora) sin comprar nada. Después comprás de una vez y registrás el número de pedido: cada cliente recibe su aviso.'),
    el('div', { class:'row', style:{ marginBottom:'14px', justifyContent:'flex-end' } },
      el('button', { class:'btn btn-sm', onclick:() => hojaSimularTodo(compras) }, 'Simular todas las tiendas')),
    ...compras.map(T => el('div', { class:'card', style:{ marginBottom:'14px' } },
      el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
        el('div', { class:'row' }, logoTienda(T.tiendaId, true),
          el('div', {}, el('b', {}, T.tienda),
            el('div', { class:'tiny dim' }, `${T.unidades} unidades · ${T.clientes} pedido(s) · ${T.grupos.length} compra(s) a hacer`))),
        el('div', { style:{ textAlign:'right' } }, el('div', { class:'kicker' }, 'Acordado con clientes'), el('b', { style:{ fontSize:'18px' } }, plata(T.aPagar)))),
      ...T.grupos.map(G => grupoCompra(T, G, ordenes, refrescar)))));
}

function titulodestino(G){
  return G.tipo === 'deposito'
    ? 'Envío al depósito de NiJu · se compra todo junto'
    : `Envío directo a ${G.cliente?.nombre} · ${domicilioTexto(G.direccion)}`;
}

function grupoCompra(T, G, ordenes, refrescar){
  const enlace = enlaceCarrito(G.renglones);
  return el('div', { class:'grupo-compra' },
    el('div', { class:'row-b wrapf', style:{ marginBottom:'8px' } },
      el('div', {}, el('b', { class:'tiny' }, titulodestino(G)),
        el('div', { class:'tiny dim' }, `${G.unidades} unidades · ${plata(G.aPagar)}` + (enlace ? ` · carrito armado para ${enlace.cubre} de ${G.renglones.length} renglones` : ''))),
      el('div', { class:'row wrapf', style:{ gap:'6px' } },
        el('button', { class:'btn btn-sm', onclick:() => hojaSimulacion(T, G, ordenes, refrescar) }, 'Simular compra'),
        el('button', { class:'btn btn-sm btn-win', onclick:() => hojaCompra(T, G, null, ordenes, refrescar) }, 'Comprar ahora'))),
    el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Producto'), el('th', {}, 'Talle / variante'), el('th', {}, 'Cant'),
        el('th', {}, 'Hasta'), el('th', {}, 'Cliente'))),
      el('tbody', {}, ...G.renglones.map(r => el('tr', {},
        el('td', {}, el('a', { href:r.url || '#', target:'_blank', rel:'noopener' }, r.titulo.slice(0, 60))),
        el('td', { class:'tiny' }, r.variante?.texto || el('span', { class:'dim' }, '—'),
          r.variante?.manual ? el('div', { style:{ color:'var(--warn)' } }, 'escrito a mano: verificar') : null),
        el('td', { class:'mono' }, String(r.cant)),
        el('td', { class:'mono' }, plata(r.precioAcordado)),
        el('td', { class:'tiny' }, r.cliente, el('div', { class:'dim mono' }, r.ordenId))))))));
}

function tablaSimulacion(s){
  return el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Producto'), el('th', {}, 'Cliente'), el('th', {}, 'Cant'),
      el('th', {}, 'Acordado'), el('th', {}, 'Hoy'), el('th', {}, 'Estado'))),
    el('tbody', {}, ...s.renglones.map(r => el('tr', {},
      el('td', { class:'tiny' }, el('b', {}, r.titulo.slice(0, 50)), r.variante?.texto ? el('div', { class:'linea-var' }, r.variante.texto) : null),
      el('td', { class:'tiny' }, r.cliente),
      el('td', { class:'mono' }, String(r.cant)),
      el('td', { class:'mono' }, plata(r.precioAcordado)),
      el('td', { class:'mono', style:{ color: r.subePct > TOLERANCIA * 100 ? 'var(--bad)' : r.subePct < 0 ? 'var(--win-tx)' : '' } },
        r.precioHoy ? plata(r.precioHoy) : '—', r.subePct ? el('div', { class:'tiny' }, (r.subePct > 0 ? '+' : '') + r.subePct + '%') : null),
      el('td', { class:'tiny' },
        !r.verificado ? el('span', { style:{ color:'var(--warn)' } }, r.motivo || 'Sin verificar')
        : r.faltaStock ? el('span', { style:{ color:'var(--bad)' } }, r.motivo || 'Sin stock')
        : el('span', { style:{ color:'var(--ok)' } }, r.stockHoy != null && r.stockHoy < 50 ? `Hay (${r.stockHoy})` : 'Hay stock')))))));
}

function resumenSimulacion(s){
  return el('div', { class:'grid g-4', style:{ margin:'12px 0' } },
    kpi('Acordado con clientes', plata(s.totalAcordado)),
    kpi('Hoy en la tienda', plata(s.totalHoy), 'lo que tiene stock'),
    kpi('Diferencia', (s.diferencia > 0 ? '+' : '') + plata(s.diferencia), s.suben ? `${s.suben} suben más de ${TOLERANCIA * 100}%` : 'dentro de lo acordado',
        s.diferencia > 0 ? 'var(--bad)' : 'var(--win-tx)'),
    kpi('Sin stock / sin verificar', `${s.sinStock} / ${s.sinVerificar}`, '', s.sinStock ? 'var(--bad)' : ''));
}

async function hojaSimulacion(T, G, ordenes, refrescar){
  const cuerpo = el('div', {}, cargando(`Consultando ${T.tienda} producto por producto…`));
  const h = hoja({ titulo:`Simulación · ${T.tienda}`, ancho:880, cuerpo });
  const s = await simular(G.renglones);
  cuerpo.replaceChildren(
    el('div', { class:'notice' }, el('b', {}, 'Esto es una simulación. '),
      `No se compró nada ni se avisó a nadie. Precios y stock consultados a ${T.tienda} a las ${new Date(s.hecha).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })}.`),
    el('div', { class:'tiny', style:{ marginTop:'8px' } }, el('b', {}, 'Destino: '), titulodestino(G)),
    resumenSimulacion(s),
    s.suben ? el('div', { class:'notice notice-bad', style:{ marginBottom:'10px' } },
      `Si comprás igual, los pedidos con precios que suben más del ${TOLERANCIA * 100}% van a pedirle el OK al cliente antes de seguir.`) : '',
    tablaSimulacion(s),
    el('div', { class:'tiny dim', style:{ margin:'10px 0' } }, s.enlace
      ? `La tienda acepta carrito armado: se abre con ${s.enlace.cubre} renglón(es) cargados de una vez.`
      : 'Esta tienda no acepta carrito armado desde afuera: vas a abrir producto por producto.'),
    el('div', { class:'row', style:{ justifyContent:'flex-end', gap:'8px' } },
      el('button', { class:'btn', onclick:() => h.cerrar() }, 'Cerrar'),
      el('button', { class:'btn btn-win', onclick:() => { h.cerrar(); hojaCompra(T, G, s, ordenes, refrescar); } }, 'Pasar a comprar')));
}

async function hojaSimularTodo(compras){
  const cuerpo = el('div', {}, cargando(`Consultando ${compras.length} tienda(s)…`));
  hoja({ titulo:'Simulación de todas las compras', ancho:880, cuerpo });
  const resultados = await Promise.all(compras.map(async T => ({ T, s:await simular(T.renglones) })));
  const total = (f) => resultados.reduce((a, x) => a + f(x.s), 0);
  cuerpo.replaceChildren(
    el('div', { class:'notice' }, el('b', {}, 'Simulación: '), 'no se compró nada. Así quedaría la jornada si comprás todo ahora.'),
    resumenSimulacion({ totalAcordado:total(s => s.totalAcordado), totalHoy:total(s => s.totalHoy), diferencia:total(s => s.diferencia),
      sinStock:total(s => s.sinStock), sinVerificar:total(s => s.sinVerificar), suben:total(s => s.suben) }),
    el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Tienda'), el('th', {}, 'Renglones'), el('th', {}, 'Acordado'),
        el('th', {}, 'Hoy'), el('th', {}, 'Diferencia'), el('th', {}, 'Sin stock'), el('th', {}, 'Sin verificar'))),
      el('tbody', {}, ...resultados.map(({ T, s }) => el('tr', {},
        el('td', {}, el('div', { class:'row' }, logoTienda(T.tiendaId), el('b', { class:'tiny' }, T.tienda))),
        el('td', { class:'mono' }, String(s.renglones.length)),
        el('td', { class:'mono' }, plata(s.totalAcordado)),
        el('td', { class:'mono' }, plata(s.totalHoy)),
        el('td', { class:'mono', style:{ color:s.diferencia > 0 ? 'var(--bad)' : 'var(--win-tx)' } }, (s.diferencia > 0 ? '+' : '') + plata(s.diferencia)),
        el('td', { class:'mono', style:{ color:s.sinStock ? 'var(--bad)' : '' } }, String(s.sinStock)),
        el('td', { class:'mono', style:{ color:s.sinVerificar ? 'var(--warn)' : '' } }, String(s.sinVerificar))))))));
}

function datosDestino(T, G){
  if (G.tipo === 'deposito'){
    const clientesRI = [...new Map(G.renglones.filter(r => r.clienteDatos?.perfilFiscal === 'responsable_inscripto')
      .map(r => [r.ordenId, r.clienteDatos])).values()];
    return el('div', { class:'col' },
      el('div', { class:'tiny' }, 'En el checkout de la tienda poné como entrega la dirección del depósito de NiJu y facturá a nombre de NiJu, o como corresponda al mandato.'),
      clientesRI.length ? el('div', { class:'notice notice-bad' },
        el('b', {}, 'Ojo: '), `${clientesRI.map(c => c.nombre).join(', ')} ${clientesRI.length > 1 ? 'son' : 'es'} Responsable Inscripto. Si necesita factura A a su nombre, compralo en una compra aparte con sus datos fiscales.`) : null);
  }
  const c = G.cliente || {}, d = G.direccion || {};
  const texto = [
    `Nombre: ${c.nombre || ''}`, `DNI: ${c.dni || ''}`, `Teléfono: ${c.telefono || ''}`, `Email: ${c.email || ''}`,
    `Dirección: ${[d.calle, d.numero].filter(Boolean).join(' ')}${d.piso ? ', ' + d.piso : ''}`,
    `Localidad: ${d.localidad || ''} · CP ${d.cp || ''} · ${d.provincia || ''}`,
    d.referencias ? `Referencias: ${d.referencias}` : null,
    `Facturar a: ${nombreFactura(c)} · CUIT/CUIL ${formatoCuit(c.cuit)} · ${PERFILES[c.perfilFiscal]?.label || c.perfilFiscal || ''}`
  ].filter(Boolean).join('\n');
  return el('div', { class:'col' },
    el('div', { class:'tiny' }, 'Esta compra va directo al cliente. Cargá estos datos en el checkout de la tienda:'),
    el('div', { class:'datos-copiar' }, texto),
    el('button', { class:'btn btn-sm', onclick:() => copiar(texto) }, 'Copiar datos'));
}

function hojaCompra(T, G, sim, ordenes, refrescar){
  const renglones = G.renglones.map(r => {
    const x = sim?.renglones.find(y => y.id === r.id && y.ordenId === r.ordenId);
    return { ...r, ...(x || {}), conseguido:x ? !x.faltaStock : true, precioReal:x?.precioHoy ?? r.precioAcordado };
  });
  const enlace = enlaceCarrito(renglones.filter(r => r.conseguido));
  const f = { pedido:'', total:'', medio:'', notas:'' };
  const campo = (label, k, ph, tipo = 'text') => el('div', { class:'field' }, el('label', {}, label),
    el('input', { class:'inp', type:tipo, placeholder:ph, oninput:e => f[k] = e.target.value }));
  const paso = (n, titulo, ...contenido) => el('div', { class:'step' }, el('span', { class:'step-n' }, String(n)),
    el('div', { class:'spacer', style:{ minWidth:0 } }, el('b', {}, titulo), el('div', { style:{ marginTop:'8px' } }, ...contenido)));

  const h = hoja({ titulo:`Comprar en ${T.tienda}`, ancho:900, cuerpo:el('div', {},
    sim ? null : el('div', { class:'notice', style:{ marginBottom:'8px' } }, 'Sin simular: los precios de abajo son los acordados con el cliente. Corregilos con lo que veas en la tienda.'),

    paso(1, 'Datos para el checkout de la tienda', datosDestino(T, G)),

    paso(2, 'Cargá el carrito',
      enlace
        ? el('a', { class:'btn btn-win', href:enlace.url, target:'_blank', rel:'noopener' }, ic('carrito'),
            `Abrir el carrito armado en ${T.tienda} (${enlace.cubre} renglón${enlace.cubre === 1 ? '' : 'es'})`)
        : el('div', { class:'tiny dim' }, 'Esta tienda no acepta carrito armado: abrí cada producto y elegí el talle indicado.'),
      el('div', { class:'col', style:{ marginTop:'10px', gap:'4px' } },
        ...renglones.map(r => el('div', { class:'row tiny', style:{ gap:'8px' } },
          el('span', { class:'mono' }, `${r.cant}×`),
          el('a', { href:enlaceRenglon(r) || '#', target:'_blank', rel:'noopener', class:'spacer' }, r.titulo.slice(0, 60)),
          r.variante?.texto ? el('b', {}, r.variante.texto) : null)))),

    paso(3, 'Registrá lo que compraste',
      el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Lo conseguí'), el('th', {}, 'Producto'), el('th', {}, 'Cant'),
          el('th', {}, 'Acordado'), el('th', {}, 'Pagué c/u'))),
        el('tbody', {}, ...renglones.map(r => el('tr', {},
          el('td', {}, el('input', { type:'checkbox', checked:r.conseguido || null, onchange:e => r.conseguido = e.target.checked })),
          el('td', { class:'tiny' }, r.titulo.slice(0, 50), r.variante?.texto ? el('div', { class:'linea-var' }, r.variante.texto) : null,
            el('div', { class:'dim' }, r.cliente), r.motivo ? el('div', { style:{ color:'var(--warn)' } }, r.motivo) : null),
          el('td', { class:'mono' }, String(r.cant)),
          el('td', { class:'mono' }, plata(r.precioAcordado)),
          el('td', {}, el('input', { class:'inp', type:'number', style:{ width:'120px' }, value:String(Math.round(r.precioReal)),
            oninput:e => r.precioReal = +e.target.value || r.precioAcordado }))))))),
      el('div', { class:'grid g-3', style:{ marginTop:'10px' } },
        campo('N° de pedido en la tienda', 'pedido', 'Ej: 1234567890-01'),
        campo('Total pagado en la tienda', 'total', 'con envío', 'number'),
        campo('Medio de pago usado', 'medio', 'Ej: Visa empresa')),
      campo('Notas', 'notas', 'Opcional')),

    el('div', { class:'row', style:{ justifyContent:'flex-end', gap:'8px', marginTop:'12px' } },
      el('button', { class:'btn', onclick:() => h.cerrar() }, 'Todavía no'),
      accion('Registrar compra y avisar a los clientes', async () => {
        if (!f.pedido.trim()) return toast('Cargá el número de pedido de la tienda', 'bad');
        await registrarCompra({ tienda:T, grupo:G, renglones, pedidoTienda:f.pedido, totalPagado:f.total, medioPago:f.medio, notas:f.notas }, ordenes);
        toast('Compra registrada. Cada cliente recibe su aviso.', 'win');
        h.cerrar(); refrescar();
      }, 'btn btn-win'))) });
}

/* ---------------- Compras hechas y envíos ---------------- */
function hojaEnvio({ titulo, pasos, actual, previo = {}, onGuardar }){
  const f = { estado:pasos.find(p => (ENVIO[p].rango > (ENVIO[actual]?.rango ?? 0))) || pasos.at(-1),
              empresa:previo.empresa || '', numero:previo.numero || '', url:previo.url || '', nota:'' };
  const lista = 'empresas-' + Math.random().toString(36).slice(2, 7);
  const input = (label, k, ph) => el('div', { class:'field' }, el('label', {}, label),
    el('input', { class:'inp', value:f[k], placeholder:ph, list:k === 'empresa' ? lista : null, oninput:e => f[k] = e.target.value }));
  const h = hoja({ titulo, ancho:520, cuerpo:el('div', { class:'col' },
    el('div', { class:'field' }, el('label', {}, 'Estado'),
      el('select', { class:'inp', onchange:e => f.estado = e.target.value },
        ...pasos.map(p => el('option', { value:p, selected:p === f.estado || null }, ENVIO[p].label)))),
    input('Empresa de envío', 'empresa', 'Andreani, OCA, Correo Argentino…'),
    el('datalist', { id:lista }, ...EMPRESAS_ENVIO.map(x => el('option', { value:x }))),
    input('Número de seguimiento', 'numero', 'El que te dio la tienda'),
    input('Link de seguimiento', 'url', 'https://… (el que manda la tienda por mail)'),
    el('div', { class:'tiny dim' }, 'El link lo copiás del mail de la tienda o del correo: la app no inventa direcciones de seguimiento.'),
    accion('Guardar y avisar', async () => {
      if (f.url && !/^https?:\/\//i.test(f.url.trim())) return toast('El link tiene que empezar con https://', 'bad');
      await onGuardar(f); toast('Guardado. El cliente recibe el aviso.', 'win'); h.cerrar();
    }, 'btn btn-win btn-block')) });
}

function vistaSeguimiento(lotes, ordenes, refrescar){
  if (!lotes.length) return vacio('Todavía no registraste compras', 'Cuando compres en una tienda y cargues el número de pedido, la compra queda acá para seguir el envío.');
  const terminado = l => ['en_deposito', 'entregado'].includes(l.envio?.estado);
  return el('div', { class:'col' }, ...[...lotes.filter(l => !terminado(l)), ...lotes.filter(terminado)].map(l => {
    const pasos = PASOS_ENVIO[l.destino?.tipo || 'deposito'];
    const conseguidos = l.renglones.filter(r => r.conseguido);
    return el('div', { class:'card', style:{ opacity:terminado(l) ? .75 : 1 } },
      el('div', { class:'row-b wrapf' },
        el('div', { class:'row' }, logoTienda(l.tiendaId, true),
          el('div', {},
            el('div', { class:'row wrapf', style:{ gap:'8px' } }, el('b', {}, l.tienda), el('span', { class:'tiny mono dim' }, l.id), tagEnvio(l.envio?.estado || 'comprado')),
            el('div', { class:'tiny dim' }, `${fecha(l.creado)} · pedido ${l.pedidoTienda || 's/n'} · ${l.destino?.tipo === 'cliente' ? 'directo a ' + l.destino.cliente : 'al depósito de NiJu'}`))),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'tiny dim' }, 'Pagado en la tienda'),
          el('b', {}, l.totalPagado ? plata(l.totalPagado) : '—'),
          el('div', { class:'tiny dim' }, `acordado ${plata(conseguidos.reduce((a, r) => a + r.precioAcordado * r.cant, 0))}`))),
      el('div', { class:'tiny', style:{ margin:'8px 0' } },
        conseguidos.map(r => `${r.cant}× ${r.titulo}${r.variante ? ` (${r.variante})` : ''} — ${r.cliente}`).join(' · ')),
      cajaSeguimiento(l.envio),
      el('div', { class:'row wrapf', style:{ marginTop:'8px' } },
        terminado(l) ? null : el('button', { class:'btn btn-sm btn-win', onclick:() => hojaEnvio({
          titulo:`Envío · ${l.tienda} · ${l.pedidoTienda || l.id}`, pasos, actual:l.envio?.estado, previo:l.envio,
          onGuardar: async f => { await actualizarEnvioLote(l, f, ordenes); refrescar(); } }) }, 'Actualizar envío')),
      el('details', { style:{ marginTop:'8px' } },
        el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Movimientos'),
        ...(l.eventos || []).slice().reverse().map(ev => el('div', { class:'row tiny', style:{ padding:'4px 0' } },
          el('span', { class:'dim mono', style:{ width:'110px' } }, fecha(ev.ts)), el('span', {}, ev.nota)))));
  }));
}

/* ---------------- Órdenes de clientes ---------------- */
function vistaOrdenes(ordenes, refrescar){
  if (!ordenes.length) return vacio('Todavía no hay órdenes', 'Cuando un cliente confirme un pedido, aparece acá con todos sus datos.');
  const orden = o => ((o.respuestas || []).some(r => !r.atendida) ? 0 : 1) + (['entregada', 'cancelada'].includes(o.estado) ? 2 : 0);
  return el('div', { class:'col' }, ...ordenes.slice().sort((a, b) => orden(a) - orden(b) || b.creada - a.creada).map(o => tarjetaOrdenDueno(o, refrescar)));
}

function tarjetaOrdenDueno(o, refrescar){
  const e = ESTADOS[o.estado] || ESTADOS.pendiente_pago;
  const res = resultado(o);
  const c = o.cliente || {};
  const pendientes = (o.respuestas || []).filter(r => !r.atendida);
  const hacer = (fn, ok) => async () => { await fn(); toast(ok, 'win'); refrescar(); };

  return el('div', { class:'card', style:{ borderLeft:`4px solid ${e.color}`, opacity:['entregada', 'cancelada'].includes(o.estado) ? .8 : 1 } },
    el('div', { class:'row-b wrapf' },
      el('div', {},
        el('div', { class:'row wrapf', style:{ gap:'7px' } },
          el('b', {}, o.id), el('span', { class:'tag', style:{ color:e.color } }, e.label),
          el('span', { class:'tag' }, MODALIDADES[o.modalidad]?.nombre || ''), o.local ? el('span', { class:'tag tag-warn' }, 'solo en este dispositivo') : null),
        el('div', { class:'tiny dim' }, `${c.nombre} · ${fecha(o.creada)}`)),
      el('div', { style:{ textAlign:'right' } },
        el('div', { class:'tiny dim' }, `cobrado ${plata(res.cobrado)} · mercadería ${plata(res.mercaderia)} · envíos ${plata(res.envio)}`),
        el('b', { style:{ color:'var(--win-tx)' } }, `margen ${plata(res.margen)} (${res.margenPct}%)`))),

    pendientes.length ? el('div', { class:'notice notice-bad', style:{ marginTop:'10px' } },
      ...pendientes.map(r => el('div', { class:'row-b wrapf', style:{ padding:'4px 0' } },
        el('span', { class:'tiny' }, el('b', {}, { acepto:'Aceptó la diferencia', cancelo:'Pide cancelar', arrepentimiento:'Se arrepintió', consulta:'Consulta' }[r.tipo]),
          r.lineaId ? ` · ${o.tramos.flatMap(t => t.lineas).find(l => l.id === r.lineaId)?.titulo || ''}` : '',
          r.nota ? ` · "${r.nota}"` : '', el('span', { class:'dim' }, ' · ' + fecha(r.ts))),
        el('div', { class:'row', style:{ gap:'5px' } },
          r.tipo === 'acepto' ? accion('Tomar el OK', hacer(() => aceptarDiferencia(o), 'Seguimos con la compra'), 'btn btn-sm btn-win') : null,
          r.tipo === 'cancelo' && r.lineaId ? accion('Cancelar y devolver', hacer(() => cancelarLinea(o, r.lineaId, 'Cancelado a pedido del cliente'), 'Producto cancelado'), 'btn btn-sm btn-win') : null,
          (r.tipo === 'arrepentimiento' || (r.tipo === 'cancelo' && !r.lineaId)) ? el('button', { class:'btn btn-sm btn-win', onclick:() => hojaCancelar(o, refrescar) }, 'Cancelar pedido') : null,
          accion('Marcar atendida', hacer(() => atenderRespuesta(o, r.ts), 'Listo'), 'btn btn-sm'))))) : null,

    el('details', { style:{ marginTop:'8px' } },
      el('summary', { class:'tiny', style:{ cursor:'pointer' } }, 'Datos del cliente'),
      el('div', { class:'datos-copiar', style:{ marginTop:'6px' } },
        [`${c.nombre} · DNI ${c.dni || '—'}`, `${c.email || ''} · ${c.telefono || ''}`,
         `Factura: ${nombreFactura(c)} · CUIT/CUIL ${formatoCuit(c.cuit) || '—'} · ${PERFILES[c.perfilFiscal]?.label || c.perfilFiscal || ''}`,
         `Entrega: ${domicilioTexto(o.direccion) || '—'}`].join('\n'))),

    ...o.tramos.map(t => el('div', { class:'tramo' },
      el('div', { class:'row-b wrapf' },
        el('div', { class:'row' }, logoTienda(t.tiendaId), el('b', { class:'tiny' }, t.propio ? 'NiJu Directo' : t.tienda), tagEnvio(t.estado)),
        (t.propio || t.lineas.every(l => !l.loteId)) && !['pendiente_pago', 'cancelada'].includes(o.estado) && t.estado !== 'cancelado'
          ? el('button', { class:'btn btn-sm', onclick:() => hojaEnvio({
              titulo:`Envío · ${t.propio ? 'NiJu Directo' : t.tienda} · ${o.id}`, pasos:PASOS_ENVIO[destinoDe(o)],
              actual:t.estado, previo:(t.envios || []).find(x => x.loteId === 'tramo'),
              onGuardar: async f => { await actualizarEnvioTramo(o, t.id, f); refrescar(); } }) },
              t.propio ? 'Actualizar envío' : 'Cargar a mano')
          : null),
      ...t.lineas.map(l => el('div', { class:'row-b wrapf tiny', style:{ padding:'5px 0' } },
        el('span', {}, `${l.cant}× ${l.titulo.slice(0, 60)}`, l.variante?.texto ? el('b', {}, ` · ${l.variante.texto}`) : '',
          el('span', { class:'dim' }, ` · ${ENVIO[l.estado]?.label || l.estado}${l.loteId ? ' · ' + l.loteId : ''}`),
          l.nota ? el('span', { style:{ color:'var(--bad)' } }, ` · ${l.nota}`) : ''),
        el('span', { class:'row', style:{ gap:'6px' } },
          el('span', { class:'mono' }, plata(l.precioReal ?? l.precioAcordado)),
          l.estado === 'problema' ? accion('Reintentar', hacer(() => reintentarLinea(o, l.id), 'Vuelve a "Para comprar"')) : null,
          l.estado === 'problema' ? accion('Cancelar y devolver', hacer(() => cancelarLinea(o, l.id), 'Producto cancelado')) : null))),
      ...(t.envios || []).filter(x => x.numero || x.url).map(cajaSeguimiento))),

    o.modalidad === 'consolidado' && ['en_deposito', 'enviada'].includes(o.estado)
      ? el('div', { class:'tramo' },
          el('div', { class:'row-b' }, el('b', { class:'tiny' }, 'Envío final de NiJu al cliente'), o.envioFinal ? tagEnvio(o.envioFinal.estado) : null),
          cajaSeguimiento(o.envioFinal),
          el('button', { class:'btn btn-sm btn-win', style:{ marginTop:'8px' }, onclick:() => hojaEnvio({
            titulo:`Envío final · ${o.id}`, pasos:['despachado', 'en_camino', 'entregado'], actual:o.envioFinal?.estado, previo:o.envioFinal,
            onGuardar: async f => { await actualizarEnvioFinal(o, f); refrescar(); } }) }, 'Cargar envío final'))
      : null,

    el('div', { class:'row wrapf', style:{ marginTop:'10px' } },
      o.estado === 'pendiente_pago' ? accion('Confirmar pago', hacer(() => confirmarPago(o), 'Pago confirmado'), 'btn btn-sm btn-win') : null,
      !['entregada', 'cancelada'].includes(o.estado)
        ? el('button', { class:'btn btn-sm', style:{ color:'var(--bad)' }, onclick:() => hojaCancelar(o, refrescar) }, 'Cancelar pedido') : null),

    el('details', { style:{ marginTop:'8px' } },
      el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Historia'),
      ...(o.historia || []).slice().reverse().map(h => el('div', { class:'row tiny', style:{ padding:'4px 0', alignItems:'flex-start' } },
        el('span', { class:'dim mono', style:{ width:'110px', flex:'0 0 110px' } }, fecha(h.ts)),
        el('span', {}, h.de === 'cliente' ? el('b', {}, 'Cliente: ') : '', h.nota)))));
}
