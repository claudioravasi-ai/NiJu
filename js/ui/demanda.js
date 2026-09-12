/* ============================================================
   NiJu — Bolsa de demanda (vista pública)
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import { ordenes, agregar, publicar, ofertar, sincronizarDemanda, estadoSyncDemanda,
         simularLlenado, SENA_DEMANDA } from '../engine/demanda.js';
import { RUBROS } from '../data/catalog.js';
import { store } from '../state.js';
import { foto } from './components.js';

export function vistaDemanda(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div');

  function pintar(){
    const bloques = agregar();
    const abiertos = bloques.filter(b => b.diasRestantes > 0);
    const total = bloques.reduce((a,b) => a + b.comprometido, 0);

    cuerpo.replaceChildren(...[
      el('section', { class:'section' },
        el('div', { class:'kicker' }, 'Al revés de siempre'),
        el('h1', { style:{ marginBottom:'8px' } }, 'Pedí y que compitan por vos'),
        el('p', { class:'muted', style:{ maxWidth:'76ch', marginBottom:'16px' } },
          'Acá no buscás entre lo que alguien decidió tener. Decís qué querés y cuánto pagás, y salen a buscártelo: tiendas con stock parado, importadores, mayoristas y nosotros. El que lo consigue a tu precio, se lo lleva. Si nadie lo consigue, te devolvemos la seña completa.'),
        aviso(),
        el('div', { class:'row wrapf' },
          el('button', { class:'btn btn-lg btn-win', onclick:() => formPublicar(pintar) }, ic('rayo'), 'Publicar lo que querés')),
        bloques.length ? el('div', { class:'grid g-3', style:{ marginTop:'18px' } },
          kpi('Órdenes abiertas', String(abiertos.length)),
          kpi('Unidades pedidas', num(bloques.reduce((a,b) => a + b.unidades, 0))),
          kpi('Plata comprometida', plata(total), 'con seña puesta', 'var(--win-tx)')) : null),

      el('section', { class:'section' },
        el('div', { class:'grid g-3' },
          paso('1', 'Decís qué y cuánto', 'Publicás el producto y el precio máximo que pagás. Dejás una seña del ' + Math.round(SENA_DEMANDA*100) + '%.'),
          paso('2', 'Se junta con otros', 'Tu pedido se suma a todos los que pidieron lo mismo. Una persona no mueve a nadie; doscientas mueven a todos.'),
          paso('3', 'Compiten por servirte', 'Tiendas, importadores y mayoristas ofertan. El primero que llega a tu precio, se lleva la orden.'))),

      bloques.length
        ? el('section', { class:'section' },
            el('h2', { style:{ marginBottom:'14px' } }, 'Órdenes abiertas'),
            el('div', { class:'col' }, ...bloques.map(b => tarjeta(b, pintar))))
        : el('div', { class:'card center', style:{ padding:'44px' } },
            el('div', { style:{ fontSize:'40px' } }, '📣'),
            el('h3', { style:{ margin:'10px 0 6px' } }, 'Todavía no hay demanda publicada'),
            el('p', { class:'muted tiny', style:{ maxWidth:'54ch', margin:'0 auto' } },
              'Sé el primero: publicá lo que estás buscando y a cuánto lo pagarías. Es gratis y no te compromete hasta que alguien lo consiga a tu precio.'))
    ].filter(Boolean));
  }

  function aviso(){
    if (estadoSyncDemanda.remoto) return null;
    return el('div', { class:'notice notice-bad', style:{ marginBottom:'14px' } },
      el('b', {}, 'La bolsa está guardada solo en este dispositivo. '),
      'Una bolsa de demanda que solo ve quien la publicó no sirve de nada: hay que crear el almacén KV en Cloudflare para que sea compartida (backend/DESPLIEGUE.md).');
  }

  pintar();
  sincronizarDemanda().then(pintar);
  raiz.append(cuerpo);
  return raiz;
}

function tarjeta(b, refrescar){
  const usuario = store.get('usuario');
  const sim = usuario ? simularLlenado(b, Math.round(b.precioMaxMinimo * 0.55)) : null;

  return el('div', { class:'card', style:{ borderLeft:`4px solid ${b.llenable ? 'var(--win)' : 'var(--accion)'}` } },
    el('div', { class:'row', style:{ gap:'14px', alignItems:'flex-start' } },
      foto({ imagen:b.imagen, titulo:b.titulo }, '', ),
      el('div', { class:'spacer' },
        el('div', { class:'row', style:{ gap:'7px', marginBottom:'4px' } },
          el('span', { class:'tag tag-nac' }, `${b.personas} persona${b.personas > 1 ? 's' : ''}`),
          b.llenable ? el('span', { class:'tag tag-win' }, 'Hay quien la llena') : null,
          b.diasRestantes <= 2 ? el('span', { class:'tag tag-warn' }, 'Cierra pronto') : null),
        el('h3', {}, b.titulo),
        el('div', { class:'tiny dim', style:{ marginTop:'4px' } },
          `${num(b.unidades)} unidades · cierra en ${b.diasRestantes} días · seña puesta ${plata(b.senas)}`)),
      el('div', { style:{ textAlign:'right', flex:'0 0 auto' } },
        el('div', { class:'kicker' }, 'Pagan hasta'),
        el('div', { class:'price price-lg' }, plata(b.precioMaxPromedio)),
        el('div', { class:'tiny dim' }, 'comprometido ' + plata(b.comprometido)))),

    b.ofertas.length
      ? el('div', { style:{ marginTop:'12px' } },
          el('div', { class:'kicker', style:{ marginBottom:'6px' } }, `${b.ofertas.length} oferta${b.ofertas.length > 1 ? 's' : ''} recibida${b.ofertas.length > 1 ? 's' : ''}`),
          ...b.ofertas.slice(0, 4).map((o, i) => el('div', { class:'row-b tiny', style:{
            padding:'6px 9px', borderRadius:'var(--r)', background: i === 0 ? 'var(--accion-suave)' : 'transparent' } },
            el('span', {}, (i === 0 ? '🏆 ' : '') + o.proveedor + (o.plazoDias ? ` · ${o.plazoDias} días` : '')),
            el('b', { class:'mono', style:{ color: o.precio <= b.precioMaxMinimo ? 'var(--win-tx)' : 'var(--bad)' } }, plata(o.precio)))))
      : el('div', { class:'notice', style:{ marginTop:'12px' } },
          'Nadie ofertó todavía. Esto es exactamente lo que le falta al mercado: hay ' + plata(b.comprometido) + ' esperando y nadie lo está sirviendo.'),

    el('div', { class:'row wrapf', style:{ marginTop:'12px' } },
      el('button', { class:'btn btn-sm btn-win', onclick:() => formPublicar(refrescar, b.titulo) }, 'Sumarme a este pedido'),
      el('button', { class:'btn btn-sm', onclick:() => formOfertar(b, refrescar) }, 'Yo lo consigo')),

    sim ? el('details', { style:{ marginTop:'10px' } },
      el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Si la llenás vos (solo lo ves vos)'),
      el('div', { style:{ paddingTop:'8px' } },
        fila('Unidades', String(sim.unidades)),
        fila('Precio que tenés que respetar', plata(sim.precio)),
        fila('Ingreso', plata(sim.ingreso)),
        fila('Margen estimado', plata(sim.margen) + ` (${sim.margenPct}%)`),
        fila('Capital propio necesario', plata(sim.capitalPropio)),
        el('div', { class:'notice notice-ok', style:{ marginTop:'8px' } },
          `Los clientes ya financian el ${sim.financiadoPorClientes}% de la compra con sus señas. Vendés antes de comprar.`))) : null);
}

function formPublicar(refrescar, tituloPrevio = ''){
  const d = { titulo:tituloPrevio, cantidad:1, dias:12 };
  const campo = (label, key, tipo = 'text', ph) => el('div', { class:'field' },
    el('label', {}, label),
    el('input', { class:'inp', type:tipo, placeholder:ph || '', value:d[key] ?? '',
      oninput:e => d[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value }));

  const resumen = el('div');
  const actualizar = () => {
    const sena = Math.round((d.precioMax || 0) * (d.cantidad || 1) * SENA_DEMANDA);
    resumen.replaceChildren(
      fila('Total si te lo consiguen', plata((d.precioMax || 0) * (d.cantidad || 1))),
      el('div', { class:'cost-line total' },
        el('span', {}, `Seña que dejás ahora (${Math.round(SENA_DEMANDA*100)}%)`), el('b', {}, plata(sena))),
      el('div', { class:'notice notice-ok', style:{ marginTop:'8px' } },
        'Si nadie lo consigue a tu precio antes del cierre, te devolvemos la seña completa. Y si lo consiguen más barato, pagás menos.'));
  };
  actualizar();

  const { cerrar } = hoja({ titulo:'Publicá lo que estás buscando', ancho:560, cuerpo: el('div', { class:'col' },
    campo('¿Qué estás buscando?', 'titulo', 'text', 'Ej: prensa de tazas 11oz'),
    el('div', { class:'field' }, el('label', {}, 'Detalles que importan'),
      el('textarea', { class:'inp', placeholder:'Marca, medida, color, si aceptás usado…',
        oninput:e => d.detalle = e.target.value })),
    el('div', { class:'grid g-2' },
      (() => { const c = campo('Pago hasta (por unidad)', 'precioMax', 'number'); c.querySelector('input').addEventListener('input', actualizar); return c; })(),
      (() => { const c = campo('Cantidad', 'cantidad', 'number'); c.querySelector('input').addEventListener('input', actualizar); return c; })()),
    el('div', { class:'grid g-2' },
      el('div', { class:'field' }, el('label', {}, 'Rubro'),
        el('select', { class:'inp', onchange:e => d.rubro = e.target.value },
          el('option', { value:'' }, 'Elegí uno'), ...RUBROS.map(r => el('option', { value:r.id }, r.nombre)))),
      campo('Días que esperás', 'dias', 'number')),
    campo('Tu nombre', 'autor', 'text', store.get('usuario')?.nombre || ''),
    resumen,
    el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
      if (!d.titulo?.trim()) return toast('Decinos qué buscás', 'bad');
      if (!d.precioMax) return toast('Poné hasta cuánto pagás', 'bad');
      publicar({ ...d, autor:d.autor || store.get('usuario')?.nombre || 'Anónimo',
                 email:store.get('usuario')?.email })
        .then(() => { toast('Tu demanda está publicada. Ahora que compitan.', 'win'); cerrar(); refrescar(); });
    } }, 'Publicar mi demanda')) });
}

function formOfertar(b, refrescar){
  const d = { cantidad:b.unidades };
  const campo = (label, key, tipo = 'text') => el('div', { class:'field' },
    el('label', {}, label),
    el('input', { class:'inp', type:tipo, value:d[key] ?? '',
      oninput:e => d[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value }));

  const { cerrar } = hoja({ titulo:'Ofertar por esta orden', cuerpo: el('div', { class:'col' },
    el('div', { class:'notice' },
      `Hay ${num(b.unidades)} unidades pedidas y ${plata(b.senas)} de señas ya puestas. Para llevarte la orden entera tu precio tiene que ser ${plata(b.precioMaxMinimo)} o menos.`),
    campo('Quién sos / tu comercio', 'proveedor'),
    campo('Precio por unidad', 'precio', 'number'),
    campo('Cuántas podés entregar', 'cantidad', 'number'),
    campo('En cuántos días', 'plazoDias', 'number'),
    el('div', { class:'field' }, el('label', {}, 'Notas'),
      el('textarea', { class:'inp', oninput:e => d.notas = e.target.value })),
    el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
      if (!d.proveedor || !d.precio) return toast('Falta tu nombre o el precio', 'bad');
      ofertar(b.ordenes[0].id, d).then(() => {
        toast('Oferta enviada', 'win'); cerrar(); refrescar();
      });
    } }, 'Enviar mi oferta')) });
}

const paso = (n, t, d) => el('div', { class:'card' },
  el('div', { class:'row', style:{ marginBottom:'6px' } }, el('span', { class:'step-n' }, n), el('b', {}, t)),
  el('p', { class:'tiny muted' }, d));
const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);
const fila = (k, v) => el('div', { class:'cost-line' },
  el('span', { class:'lbl' }, k), el('span', { class:'mono' }, v));
