/* ============================================================
   NiJu — "Pedí y que compitan" (pantalla)
   Pedidos abiertos de todos, publicar, ofertar (proveedores aprobados,
   NiJu o cualquier cliente con cuenta, con foto), "Mis pedidos" y
   "Mis ofertas" para Mi cuenta, y vistaProveedores() para el Panel.
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import {
  listarPedidos, misPedidos, agregar, publicar, ofertar, aceptarOferta, cerrarPedido, marcarLeido,
  simularLlenado, estadoDe, ESTADOS_PEDIDO, diasQueFaltan, codigoProveedor, nombreProveedor,
  entrarComoProveedor, salirComoProveedor, listarProveedores, crearProveedor, bajaProveedor, DIAS_DEFECTO,
  misOfertas, fotoUrl, reducirFoto, COMISION_PARTICULAR, TIPOS_OFERTA, ESTADOS_PRODUCTO
} from '../engine/demanda.js';
import { RUBROS } from '../data/catalog.js';
import { hayCuenta } from '../engine/nube.js';
import { esDueno } from '../engine/sesion.js';
import { botonVolver } from './components.js';
import { asegurarCuenta } from './cuenta.js';

const REFRESCO_MS = 30 * 1000;

export function vistaDemanda(ir){
  const raiz = el('div', { class:'wrap' });
  const barraProveedor = el('div');
  const mios = el('div');
  const lista = el('div', {}, el('div', { class:'card v-sk', style:{ minHeight:'160px' } }));
  const actualizado = el('small', { class:'tiny dim' });
  let pedidos = [], error = null;

  async function cargar(){
    try{ pedidos = await listarPedidos(); error = null; }
    catch(e){ error = e.message; }
    actualizado.textContent = error ? '' : `Actualizado a las ${new Date().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' })} · se actualiza solo`;
    pintarLista();
  }

  function pintarLista(){
    if (error){
      lista.replaceChildren(el('div', { class:'notice notice-bad' }, 'No pudimos leer los pedidos: ' + error));
      return;
    }
    const bloques = agregar(pedidos);
    lista.replaceChildren(bloques.length
      ? el('div', { class:'col' }, ...bloques.map(b => tarjeta(b, cargar)))
      : el('div', { class:'card center', style:{ padding:'36px' } },
          el('h3', { style:{ margin:'0 0 6px' } }, 'Todavía no hay pedidos abiertos'),
          el('p', { class:'muted tiny', style:{ maxWidth:'54ch', margin:'0 auto' } },
            'Publicá lo que buscás: cuando alguien lo consiga, te avisamos en la campanita y lo ves en Mi cuenta.')));
  }

  function pintarBarraProveedor(){
    barraProveedor.replaceChildren(
      esDueno()
        ? el('div', { class:'notice', style:{ marginBottom:'12px' } }, el('b', {}, 'Estás como dueño: '),
            'podés ofertar como NiJu y ves el margen de cada pedido. Los proveedores se dan de alta en Panel → Proveedores.')
        : codigoProveedor()
          ? el('div', { class:'notice notice-ok', style:{ marginBottom:'12px' } },
              el('b', {}, `Estás ofertando como ${nombreProveedor() || 'proveedor'} (proveedor aprobado). `),
              el('button', { class:'p-link', onclick:() => { salirComoProveedor(); pintarBarraProveedor(); pintarLista(); } }, 'Salir'))
          : el('p', { class:'tiny dim', style:{ margin:'0 0 12px' } }, '¿Sos proveedor aprobado por NiJu? ',
              el('button', { class:'p-link', onclick:() => formProveedor(() => { pintarBarraProveedor(); pintarLista(); }) }, 'Ingresá tu código de proveedor')));
  }

  const pedirConCuenta = async (titulo = '') => {
    const u = await asegurarCuenta();
    if (u) formPublicar(() => { cargar(); pintarMios(); }, titulo);
  };
  const pintarMios = () => mios.replaceChildren(hayCuenta() ? tarjetaMisPedidos(ir) : '');
  const ofertarConCuenta = async (b, refrescar) => {
    if (esDueno() || codigoProveedor()) return formOfertar(b, refrescar, false);
    const u = await asegurarCuenta();
    if (u) formOfertar(b, refrescar, true);
  };

  const paso = (n, t, d) => el('div', { class:'card' },
    el('div', { class:'row', style:{ marginBottom:'6px' } }, el('span', { class:'step-n' }, n), el('b', {}, t)),
    el('p', { class:'tiny muted' }, d));

  raiz.append(
    botonVolver(ir),
    el('section', { class:'section' },
      el('div', { class:'kicker' }, 'Al revés de siempre'),
      el('h1', { style:{ marginBottom:'8px' } }, 'Pedí y que compitan por vos'),
      el('p', { class:'muted', style:{ maxWidth:'76ch', marginBottom:'16px' } },
        'Publicás qué buscás y hasta cuánto pagás. Te hacen ofertas proveedores aprobados, NiJu y cualquier persona con cuenta que lo tenga o lo consiga más barato. Vos elegís la que te sirve y se convierte en un pedido de compra. Publicar no cuesta nada ni te obliga a comprar.'),
      el('div', { class:'row wrapf' },
        el('button', { class:'btn btn-lg btn-win', onclick:() => pedirConCuenta() }, ic('rayo'), 'Publicar lo que buscás'),
        hayCuenta() ? el('button', { class:'btn btn-lg', onclick:() => mios.scrollIntoView({ behavior:'smooth', block:'start' }) }, 'Ver mis pedidos') : null)),

    el('section', { class:'section' },
      el('div', { class:'grid g-2' },
        paso('1', 'Publicás con tu cuenta', 'Qué buscás, cuántos, hasta cuánto pagás por unidad y cuántos días esperás. Queda guardado en Mi cuenta.'),
        paso('2', 'Se suma con otros', 'Si otras personas piden lo mismo, se juntan en un solo pedido grande: eso atrae mejores precios.'),
        paso('3', 'Te ofertan y te avisamos', 'Ofertan proveedores aprobados, NiJu y vendedores con cuenta verificada, con foto real. Cada oferta nueva te llega a la campanita.'),
        paso('4', 'Elegís y se hace la compra', 'Aceptás la que te conviene y se crea el pedido en Mis compras. Recién ahí pagás, como en cualquier compra.')),
      el('div', { class:'card', style:{ marginTop:'12px', borderLeft:'4px solid var(--win)' } },
        el('b', {}, '¿Lo tenés o sabés dónde está más barato? Ganá con la diferencia'),
        el('p', { class:'tiny muted', style:{ margin:'6px 0 0', lineHeight:'1.55' } },
          `Cualquiera con cuenta puede ofertar: un particular, un emprendedor o un negocio. Subís una foto real, decís si es nuevo, usado o reacondicionado y cómo está, y te comprometés a enviarlo a cada comprador. Si aceptan tu oferta, ganás la diferencia entre lo que te cuesta y lo que ofertaste. NiJu te cobra ${Math.round(COMISION_PARTICULAR * 100)}% de lo que vendés.`)),
      el('details', { class:'card', style:{ marginTop:'12px' } },
        el('summary', { style:{ cursor:'pointer', fontWeight:'600' } }, '¿Dónde entra NiJu?'),
        el('ul', { class:'tiny muted', style:{ margin:'10px 0 0', paddingLeft:'18px', lineHeight:'1.6' } },
          el('li', {}, 'Aprueba a los proveedores y exige la cuenta completa (DNI, CUIT y domicilio) a quien oferta como particular.'),
          el('li', {}, `Le cobra ${Math.round(COMISION_PARTICULAR * 100)}% de comisión al particular o emprendedor que vende: es lo que sostiene el servicio.`),
          el('li', {}, 'Oferta él mismo cuando puede conseguirlo: comprándolo en el país o importándolo para todos juntos.'),
          el('li', {}, 'Cuando aceptás una oferta, gestiona la compra: cobra, coordina con el proveedor, sigue el envío y responde por el pedido.'),
          el('li', {}, 'Ve qué se pide y nadie consigue: es la mejor pista para decidir qué traer.')))),

    el('section', { class:'section' }, barraProveedor, mios,
      el('div', { class:'row-b wrapf', style:{ margin:'14px 0 10px' } },
        el('h2', { style:{ margin:0 } }, 'Pedidos abiertos'), actualizado),
      lista));

  pintarBarraProveedor(); pintarMios(); cargar();
  const reloj = setInterval(() => {
    if (!raiz.isConnected) return clearInterval(reloj);
    if (!document.hidden) cargar();
  }, REFRESCO_MS);
  return raiz;

  /* ---------- Tarjeta de un pedido (agrupado) ---------- */
  function tarjeta(b, refrescar){
    const sim = esDueno() ? simularLlenado(b, Math.round(b.precioMaxMinimo * 0.55)) : null;
    return el('div', { class:'card', style:{ borderLeft:`4px solid ${b.llenable ? 'var(--win)' : 'var(--accion)'}` } },
      el('div', { class:'row-b', style:{ gap:'14px', alignItems:'flex-start' } },
        el('div', { style:{ minWidth:0 } },
          el('div', { class:'row wrapf', style:{ gap:'7px', marginBottom:'4px' } },
            el('span', { class:'tag tag-nac' }, `${b.personas} persona${b.personas > 1 ? 's' : ''}`),
            b.llenable ? el('span', { class:'tag tag-win' }, 'Ya hay quien lo consigue') : null,
            b.diasRestantes <= 2 ? el('span', { class:'tag tag-warn' }, 'Cierra pronto') : null),
          el('h3', { style:{ margin:0 } }, b.titulo),
          el('div', { class:'tiny dim', style:{ marginTop:'4px' } }, `${num(b.unidades)} unidades · cierra en ${b.diasRestantes} días`)),
        el('div', { style:{ textAlign:'right', flex:'0 0 auto' } },
          el('div', { class:'kicker' }, 'Pagan hasta'),
          el('div', { class:'price price-lg' }, plata(b.precioMaxMinimo)),
          el('div', { class:'tiny dim' }, 'por unidad'))),

      b.ofertas.length
        ? el('div', { style:{ marginTop:'12px' } },
            el('div', { class:'kicker', style:{ marginBottom:'6px' } }, `${b.ofertas.length} oferta${b.ofertas.length > 1 ? 's' : ''}`),
            ...b.ofertas.slice(0, 4).map((o, i) => filaOferta(o, i === 0, b.precioMaxMinimo)))
        : el('p', { class:'tiny muted', style:{ margin:'12px 0 0' } }, 'Todavía no hay ofertas.'),

      el('div', { class:'row wrapf', style:{ marginTop:'12px' } },
        el('button', { class:'btn btn-sm btn-win', onclick:() => pedirConCuenta(b.titulo) }, 'Yo también lo quiero'),
        el('button', { class:'btn btn-sm', onclick:() => ofertarConCuenta(b, refrescar) }, esDueno() ? 'Ofertar como NiJu' : 'Yo lo consigo')),

      sim ? el('details', { style:{ marginTop:'10px' } },
        el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Si NiJu lo consigue (solo lo ve el dueño)'),
        el('div', { style:{ paddingTop:'8px' } },
          fila('Unidades', String(sim.unidades)),
          fila('Precio a respetar', plata(sim.precio)),
          fila('Ingreso', plata(sim.ingreso)),
          fila('Margen si el costo fuera 55% del precio', `${plata(sim.margen)} (${sim.margenPct}%)`),
          fila('Capital para comprarlo', plata(sim.capitalPropio)))) : null);
  }
}

/* ---------- Mis pedidos (Mi cuenta y esta pantalla) ---------- */
export function tarjetaMisPedidos(ir){
  const abiertos = new Set();
  const cabeza = () => el('div', { class:'c-card-head' }, el('h2', {}, 'Mis pedidos en "Pedí y que compitan"'));
  const cont = el('section', { class:'c-card', style:{ marginTop:'14px' } }, cabeza(), el('p', { class:'c-sub' }, 'Cargando tus pedidos…'));

  async function pintar(){
    let lista;
    try{ lista = await misPedidos(); }
    catch(e){ cont.replaceChildren(cabeza(), el('div', { class:'notice notice-bad' }, 'No pudimos leer tus pedidos: ' + e.message)); return; }
    if (!lista.length){
      cont.replaceChildren(cabeza(), el('p', { class:'c-sub' }, 'Todavía no publicaste pedidos. Decí qué buscás y a cuánto, y que compitan por conseguírtelo.'),
        el('button', { class:'btn btn-sm', onclick:() => ir('#/demanda') }, 'Publicar un pedido', ic('der')));
      return;
    }
    cont.replaceChildren(cabeza(),
      el('p', { class:'c-sub' }, 'Se actualiza solo. Cuando llega una oferta nueva te avisamos en la campanita.'),
      el('div', { class:'c-ops' }, ...lista.map(p => filaPedido(p))));
  }

  function filaPedido(p){
    const est = estadoDe(p);
    const E = ESTADOS_PEDIDO[est] || ESTADOS_PEDIDO.abierta;
    const sinLeer = (p.avisos || []).filter(a => !a.leido).length;
    const abierto = est === 'abierta';
    const ofertas = (p.ofertas || []).slice().sort((a, b) => a.precio - b.precio);

    return el('details', { class:'c-op', open:abiertos.has(p.id) || null, ontoggle:e => {
      if (!e.currentTarget.open){ abiertos.delete(p.id); return; }
      abiertos.add(p.id);
      if (sinLeer) marcarLeido(p.id).then(() => window.dispatchEvent(new Event('niju:avisos'))).catch(() => {});
    } },
      el('summary', {},
        el('span', { class:'c-op-fecha' }, fecha(p.creada), el('small', {}, E.texto)),
        el('span', { class:'c-op-tit' }, p.titulo, el('small', {}, `${p.cantidad} u. · pagás hasta ${plata(p.precioMax)} c/u`)),
        el('span', { class:'c-op-total' }, `${ofertas.length} oferta${ofertas.length === 1 ? '' : 's'}`,
          el('small', {}, sinLeer ? `${sinLeer} nueva${sinLeer > 1 ? 's' : ''}` : abierto ? `cierra en ${diasQueFaltan(p)} días` : ''))),
      el('div', { class:'c-op-cuerpo' },
        est === 'adjudicada' ? el('div', { class:'notice notice-ok', style:{ marginBottom:'10px' } },
          el('b', {}, 'Aceptaste una oferta. '), `Tu pedido de compra es ${p.ordenId}: seguilo en Mis compras.`,
          el('div', { style:{ marginTop:'8px' } }, el('button', { class:'btn btn-sm', onclick:() => ir('#/compras') }, 'Ver en Mis compras'))) : null,
        est === 'vencida' ? el('div', { class:'notice', style:{ marginBottom:'10px' } }, 'Pasó la fecha sin que aceptaras una oferta. Si todavía lo buscás, publicalo de nuevo.') : null,
        ofertas.length
          ? ofertas.map(o => filaOferta({ ...o, proveedor:o.proveedor + (p.ofertaAceptada === o.id ? ' (aceptada)' : '')
                + (o.cantidad < p.cantidad ? ` · consigue ${o.cantidad} de ${p.cantidad}` : '') }, false, p.precioMax,
              abierto ? el('button', { class:'btn btn-sm btn-win', onclick:() => confirmarAceptar(p, o) }, 'Aceptar') : null))
          : el('p', { class:'c-sub' }, abierto ? 'Todavía no hay ofertas. Te avisamos cuando llegue la primera.' : 'No recibió ofertas.'),
        abierto ? el('button', { class:'p-link', style:{ marginTop:'10px' }, onclick:() => confirmarCerrar(p) }, 'Ya no lo busco: cerrar este pedido') : null));
  }

  function confirmarAceptar(p, o){
    const cant = Math.min(p.cantidad, o.cantidad);
    const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
      boton.disabled = true;
      try{
        const r = await aceptarOferta(p.id, o.id);
        h.cerrar();
        toast(`Listo: se creó tu pedido ${r.orden?.id || ''}`, 'win');
        window.dispatchEvent(new Event('niju:avisos'));
        ir('#/compras');
      }catch(e){
        boton.disabled = false;
        toast(e.message, 'bad');
        if (/Complet[aá] tus datos/i.test(e.message)){ h.cerrar(); ir('#/cuenta'); }
      }
    } }, `Aceptar y crear el pedido por ${plata(o.precio * cant)}`);
    const h = hoja({ titulo:'Aceptar esta oferta', ancho:480, cuerpo:el('div', { class:'col' },
      el('p', {}, el('b', {}, o.proveedor), ` te lo consigue a ${plata(o.precio)} por unidad${o.plazoDias ? `, en ${o.plazoDias} días` : ''}.`),
      cant < p.cantidad ? el('div', { class:'notice' }, `Ojo: consigue ${cant} de las ${p.cantidad} unidades que pediste.`) : null,
      el('div', { class:'notice' }, 'Se crea un pedido de compra en Mis compras, pendiente de pago. NiJu te contacta para coordinar el pago y la entrega. Las otras ofertas quedan descartadas.'),
      boton,
      el('button', { class:'btn btn-block', onclick:() => h.cerrar() }, 'Todavía no'))});
  }

  function confirmarCerrar(p){
    const h = hoja({ titulo:'Cerrar el pedido', ancho:420, cuerpo:el('div', { class:'col' },
      el('p', {}, `"${p.titulo}" deja de recibir ofertas.`),
      el('button', { class:'btn btn-win btn-block', onclick:async () => {
        try{ await cerrarPedido(p.id); h.cerrar(); toast('Pedido cerrado'); pintar(); }
        catch(e){ toast(e.message, 'bad'); }
      } }, 'Sí, cerrarlo'),
      el('button', { class:'btn btn-block', onclick:() => h.cerrar() }, 'Cancelar')) });
  }

  pintar();
  const reloj = setInterval(() => {
    if (!cont.isConnected) return clearInterval(reloj);
    if (!document.hidden) pintar();
  }, REFRESCO_MS);
  return cont;
}

/* ---------- Una oferta, con foto y estado si la tiene ---------- */
function filaOferta(o, mejor, precioMax, accion = null){
  const detalle = [TIPOS_OFERTA[o.tipo] || TIPOS_OFERTA.proveedor, ESTADOS_PRODUCTO[o.estadoProducto],
    o.plazoDias ? `entrega en ${o.plazoDias} días` : null, o.condicion || o.notas || null].filter(Boolean).join(' · ');
  return el('div', { class:'d-oferta' + (mejor ? ' mejor' : '') },
    o.foto ? el('a', { href:fotoUrl(o.id), target:'_blank', rel:'noopener', class:'d-oferta-foto', title:'Ver la foto' },
      el('img', { src:fotoUrl(o.id), alt:'Foto del producto ofertado', loading:'lazy' })) : null,
    el('span', { class:'d-oferta-txt' }, el('b', {}, (mejor ? 'Mejor oferta: ' : '') + o.proveedor), el('small', {}, detalle)),
    el('span', { class:'d-oferta-precio' },
      el('b', { class:'mono', style:{ color:precioMax == null || o.precio <= precioMax ? 'var(--win-tx)' : 'var(--bad)' } }, plata(o.precio)),
      accion));
}

/* ---------- Mis ofertas como vendedor (Mi cuenta) ---------- */
export function tarjetaMisOfertas(ir){
  const TEXTO = { abierta:'Esperando que decidan', aceptada:'¡La aceptaron! NiJu te contacta para el envío y el cobro',
                  otra:'Eligieron otra oferta', cerrada:'El pedido se cerró', vencida:'El pedido venció' };
  const cabeza = () => el('div', { class:'c-card-head' }, el('h2', {}, 'Mis ofertas como vendedor'));
  const cont = el('section', { class:'c-card', style:{ marginTop:'14px' } }, cabeza(), el('p', { class:'c-sub' }, 'Cargando tus ofertas…'));
  async function pintar(){
    let lista;
    try{ lista = await misOfertas(); }
    catch(e){ cont.replaceChildren(cabeza(), el('div', { class:'notice notice-bad' }, 'No pudimos leer tus ofertas: ' + e.message)); return; }
    if (!lista.length){
      cont.replaceChildren(cabeza(),
        el('p', { class:'c-sub' }, '¿Tenés algo que otros buscan, o sabés dónde está más barato? Ofertá en "Pedí y que compitan" y ganá con la diferencia.'),
        el('button', { class:'btn btn-sm', onclick:() => ir('#/demanda') }, 'Ver pedidos abiertos', ic('der')));
      return;
    }
    cont.replaceChildren(cabeza(),
      el('div', { class:'c-ops' }, ...lista.map(o => el('div', { class:'c-op-linea' },
        el('span', {}, o.titulo, el('small', {}, `${TEXTO[o.estado] || o.estado} · ${o.cantidad} u. a ${plata(o.precio)}${o.ordenId ? ` · pedido ${o.ordenId}` : ''}`)),
        el('b', {}, plata(Math.round(o.precio * o.cantidad * (1 - (o.comisionPct || 0)))))))),
      el('p', { class:'c-legal' }, 'El monto es lo que cobrás si te compran todo, ya descontada la comisión de NiJu. A eso restale lo que te cuesta conseguirlo y enviarlo.'));
  }
  pintar();
  const reloj = setInterval(() => {
    if (!cont.isConnected) return clearInterval(reloj);
    if (!document.hidden) pintar();
  }, 60 * 1000);
  return cont;
}

/* ---------- Formularios ---------- */
function formPublicar(alPublicar, tituloPrevio = ''){
  const d = { titulo:tituloPrevio, cantidad:1, dias:DIAS_DEFECTO };
  const campo = (label, key, tipo = 'text', ph = '') => el('div', { class:'field' },
    el('label', {}, label),
    el('input', { class:'inp', type:tipo, placeholder:ph, value:d[key] ?? '', min:tipo === 'number' ? '1' : null,
      oninput:e => { d[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value; actualizar(); } }));

  const resumen = el('div');
  function actualizar(){
    resumen.replaceChildren(
      el('div', { class:'cost-line total' }, el('span', {}, 'Total si te lo consiguen a tu precio'), el('b', {}, plata((d.precioMax || 0) * (d.cantidad || 1)))),
      el('div', { class:'notice notice-ok', style:{ marginTop:'8px' } },
        'Publicar no cuesta nada. Pagás recién si aceptás una oferta, y si te lo consiguen más barato, pagás menos.'));
  }
  actualizar();

  const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
    if (!d.titulo?.trim()) return toast('Decinos qué buscás', 'bad');
    if (!(d.precioMax > 0)) return toast('Poné hasta cuánto pagás por unidad', 'bad');
    boton.disabled = true;
    try{
      await publicar(d);
      toast('Tu pedido está publicado. Lo seguís en Mi cuenta.', 'win');
      h.cerrar();
      alPublicar();
    }catch(e){ boton.disabled = false; toast(e.message, 'bad'); }
  } }, 'Publicar mi pedido');

  const h = hoja({ titulo:'Publicá lo que buscás', ancho:560, cuerpo:el('div', { class:'col' },
    campo('¿Qué buscás?', 'titulo', 'text', 'Ej: prensa para tazas de 11 oz'),
    el('div', { class:'field' }, el('label', {}, 'Detalles que importan'),
      el('textarea', { class:'inp', placeholder:'Marca, medida, color, si aceptás usado…', oninput:e => d.detalle = e.target.value })),
    el('div', { class:'grid g-2' }, campo('Pago hasta (por unidad, en pesos)', 'precioMax', 'number'), campo('Cantidad', 'cantidad', 'number')),
    el('div', { class:'grid g-2' },
      el('div', { class:'field' }, el('label', {}, 'Rubro'),
        el('select', { class:'inp', onchange:e => d.rubro = e.target.value },
          el('option', { value:'' }, 'Elegí uno'), ...RUBROS.map(r => el('option', { value:r.id }, r.nombre)))),
      campo('Días que esperás ofertas', 'dias', 'number')),
    resumen, boton) });
}

/* particular:true = un cliente que no es proveedor aprobado: foto real,
   estado del producto, compromiso de envío y comisión de NiJu. */
function formOfertar(b, refrescar, particular = false){
  const d = { cantidad:b.unidades, estadoProducto:particular ? '' : 'nuevo', compromisoEnvio:false, foto:null };
  const campo = (label, key, tipo = 'text') => el('div', { class:'field' },
    el('label', {}, label),
    el('input', { class:'inp', type:tipo, value:d[key] ?? '', min:tipo === 'number' ? '0' : null,
      oninput:e => { d[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value; cuenta(); } }));

  const ganancia = el('div');
  function cuenta(){
    if (!particular){ ganancia.replaceChildren(''); return; }
    const cant = Math.min(d.cantidad || 0, b.unidades);
    const venta = (d.precio || 0) * cant;
    const comision = Math.round(venta * COMISION_PARTICULAR);
    ganancia.replaceChildren(
      fila(`Vendés ${cant} u. a ${plata(d.precio || 0)}`, plata(venta)),
      fila(`Comisión de NiJu (${Math.round(COMISION_PARTICULAR * 100)}%)`, '− ' + plata(comision)),
      el('div', { class:'cost-line total' }, el('span', {}, 'Cobrás si aceptan todos'), el('b', {}, plata(venta - comision))),
      el('p', { class:'tiny dim', style:{ margin:'6px 0 0' } }, 'Tu ganancia es eso menos lo que te cuesta conseguirlo y enviarlo.'));
  }
  cuenta();

  const previa = el('div', { class:'d-foto-previa' });
  const inputFoto = el('input', { type:'file', accept:'image/*', class:'inp', onchange:async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    previa.replaceChildren('Preparando la foto…');
    try{ d.foto = await reducirFoto(f); previa.replaceChildren(el('img', { src:d.foto, alt:'Foto que vas a subir' })); }
    catch(err){ d.foto = null; previa.replaceChildren(''); toast(err.message, 'bad'); }
  } });

  const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
    if (!(d.precio > 0)) return toast('Poné tu precio por unidad', 'bad');
    if (particular){
      if (!d.foto) return toast('Subí una foto real del producto', 'bad');
      if (!d.estadoProducto) return toast('Decinos si es nuevo, usado o reacondicionado', 'bad');
      if (!d.compromisoEnvio) return toast('Tenés que comprometerte a enviarlo a cada comprador', 'bad');
    }
    boton.disabled = true;
    try{
      const r = await ofertar(b, d);
      toast(`Oferta enviada a ${r.ofertados} persona${r.ofertados > 1 ? 's' : ''}`, 'win');
      h.cerrar(); refrescar();
    }catch(e){ boton.disabled = false; toast(e.message, 'bad'); }
  } }, 'Enviar mi oferta');

  const h = hoja({ titulo:particular ? 'Yo lo consigo' : 'Ofertar por este pedido', ancho:560, cuerpo:el('div', { class:'col' },
    el('div', { class:'notice' },
      `Piden ${num(b.unidades)} unidades entre ${b.personas} persona${b.personas > 1 ? 's' : ''}. Para que tu oferta le sirva a todos, tiene que ser de ${plata(b.precioMaxMinimo)} por unidad o menos. Cada persona decide si la acepta.`),
    particular ? el('div', { class:'field' }, el('label', {}, 'Foto real del producto (obligatoria)'), inputFoto,
      el('small', { class:'tiny dim' }, 'Sacala vos, del producto que vas a mandar: nada de fotos de internet.'), previa) : null,
    el('div', { class:'grid g-2' },
      el('div', { class:'field' }, el('label', {}, 'Estado del producto'),
        el('select', { class:'inp', onchange:e => d.estadoProducto = e.target.value },
          particular ? el('option', { value:'' }, 'Elegí') : null,
          ...Object.entries(ESTADOS_PRODUCTO).map(([v, t]) => el('option', { value:v, selected:d.estadoProducto === v || null }, t)))),
      campo('Precio por unidad, en pesos', 'precio', 'number')),
    el('div', { class:'grid g-2' }, campo('Cuántas podés entregar', 'cantidad', 'number'), campo('En cuántos días', 'plazoDias', 'number')),
    el('div', { class:'field' }, el('label', {}, particular ? 'Cómo está (marcas de uso, caja, garantía, qué incluye)' : 'Notas (garantía, condiciones)'),
      el('textarea', { class:'inp', oninput:e => { d.condicion = e.target.value; d.notas = e.target.value; } })),
    particular ? el('label', { class:'switch' },
      el('input', { type:'checkbox', onchange:e => d.compromisoEnvio = e.target.checked }),
      el('span', { class:'tiny' }, 'Me comprometo a que el producto es el de la foto, en el estado que declaro, y a enviarlo a cada comprador que acepte mi oferta.')) : null,
    ganancia,
    particular ? el('p', { class:'tiny dim' }, 'Si vendés seguido, tenés que estar inscripto ante ARCA (por ejemplo, en el Monotributo). NiJu factura su comisión.') : null,
    boton) });
}

function formProveedor(alEntrar){
  const input = el('input', { class:'inp', placeholder:'P-XXXXXXXXXX', autocomplete:'off' });
  const boton = el('button', { class:'btn btn-win btn-block', onclick:async () => {
    if (!input.value.trim()) return toast('Pegá tu código', 'bad');
    boton.disabled = true;
    try{
      const nombre = await entrarComoProveedor(input.value);
      toast(`Listo, ofertás como ${nombre}`, 'win');
      h.cerrar(); alEntrar();
    }catch(e){ boton.disabled = false; toast(e.message, 'bad'); }
  } }, 'Entrar como proveedor');
  const h = hoja({ titulo:'Soy proveedor', ancho:440, cuerpo:el('div', { class:'col' },
    el('p', { class:'muted' }, 'NiJu da de alta a cada proveedor y le pasa un código. Con ese código podés ofertar en los pedidos abiertos desde este dispositivo.'),
    el('div', { class:'field' }, el('label', {}, 'Tu código'), input),
    boton,
    el('p', { class:'tiny dim' }, 'Si todavía no tenés código, escribinos por Mensajes contando qué vendés.')) });
}

/* ---------- Panel → Proveedores ---------- */
export function vistaProveedores(){
  const cont = el('div', { class:'section' }, el('div', { class:'card v-sk', style:{ minHeight:'120px' } }));
  async function pintar(){
    let lista;
    try{ lista = await listarProveedores(); }
    catch(e){ cont.replaceChildren(el('div', { class:'notice notice-bad' }, 'No pudimos leer los proveedores: ' + e.message)); return; }
    const d = {};
    const campo = (label, key, ph) => el('div', { class:'field' }, el('label', {}, label),
      el('input', { class:'inp', placeholder:ph, oninput:e => d[key] = e.target.value }));
    const boton = el('button', { class:'btn btn-win', onclick:async () => {
      if (!d.nombre?.trim()) return toast('Poné el nombre del proveedor', 'bad');
      boton.disabled = true;
      try{
        const r = await crearProveedor(d);
        const copiar = el('button', { class:'btn btn-block', onclick:() => navigator.clipboard?.writeText(r.codigo).then(() => toast('Código copiado', 'win')) }, 'Copiar código');
        const hh = hoja({ titulo:`Código de ${r.proveedor.nombre}`, ancho:420, cuerpo:el('div', { class:'col' },
          el('p', {}, 'Pasale este código al proveedor. Lo ingresa en "Pedí y que compitan" → "Ingresá tu código de proveedor".'),
          el('div', { class:'mono center', style:{ fontSize:'24px', fontWeight:'700', padding:'14px', background:'var(--surface-2)', borderRadius:'var(--r)' } }, r.codigo),
          el('div', { class:'notice notice-bad' }, 'Se muestra una sola vez: no queda guardado en ningún lado. Si se pierde, dalo de baja y creá otro.'),
          copiar, el('button', { class:'btn btn-win btn-block', onclick:() => hh.cerrar() }, 'Ya lo guardé')) });
        pintar();
      }catch(e){ boton.disabled = false; toast(e.message, 'bad'); }
    } }, 'Dar de alta');

    cont.replaceChildren(
      el('p', { class:'muted', style:{ marginBottom:'12px' } },
        'Solo los proveedores de esta lista pueden ofertar en "Pedí y que compitan". Al darlos de alta se genera un código que se muestra una sola vez.'),
      el('div', { class:'card', style:{ marginBottom:'14px' } },
        el('div', { class:'grid g-2' }, campo('Nombre del proveedor', 'nombre', 'Ej: Importadora del Sur'), campo('Contacto', 'contacto', 'Teléfono o email')),
        boton),
      lista.length
        ? el('div', { class:'col' }, ...lista.map(p => el('div', { class:'card row-b' },
            el('div', {}, el('b', {}, p.nombre), el('div', { class:'tiny dim' }, `${p.contacto || 'sin contacto'} · alta ${fecha(p.creado)}`)),
            p.activo
              ? el('button', { class:'btn btn-sm', onclick:async () => { try{ await bajaProveedor(p.id); toast('Proveedor dado de baja'); pintar(); }catch(e){ toast(e.message, 'bad'); } } }, 'Dar de baja')
              : el('span', { class:'tag' }, 'Dado de baja'))))
        : el('p', { class:'muted' }, 'Todavía no hay proveedores aprobados.'));
  }
  pintar();
  return cont;
}

const fila = (k, v) => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, k), el('span', { class:'mono' }, v));
