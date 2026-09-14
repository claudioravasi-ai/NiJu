/* ============================================================
   NiJu — Tarjeta del asistente de compra
   Va en el carrito y en "Tu caso". Le habla a la persona de vos:
   en qué condición está, qué puede, qué no y qué le conviene con
   lo que tiene en el carrito ahora.
   ============================================================ */
import { el, ic } from '../util.js';
import { store } from '../state.js';
import { analizarCompra } from '../engine/asistente.js';
import { FUENTES } from '../data/fuentes-fiscales.js';

export const destinoCompra = () => store.get('config')?.destinoCompra || 'uso';

export function tarjetaAsistente({ ir, resumen = null, completa = false, alCambiar }){
  const u = store.get('usuario');
  const a = analizarCompra({ items:store.get('carrito'), perfilId:u?.perfilFiscal || 'consumidor_final',
                             destino:destinoCompra(), resumen });

  const columna = (clase, icono, titulo, items, vacio) => el('div', { class:'a-col ' + clase },
    el('h3', {}, el('span', { class:'a-col-ic' }, ic(icono)), titulo, el('small', {}, String(items.length))),
    ...(items.length
      ? items.map(x => el('div', { class:'a-item' },
          el('b', {}, x.t), el('p', {}, x.d),
          x.fuente ? el('a', { class:'c-fuente', href:FUENTES[x.fuente].url, target:'_blank', rel:'noopener' }, 'Leer en ' + FUENTES[x.fuente].titulo) : null))
      : [el('p', { class:'a-vacio' }, vacio)]));

  const contexto = a.hayCarrito
    ? 'Miramos lo que tenés en el carrito: ' + [a.tiendasPais && `${a.tiendasPais} tienda${a.tiendasPais > 1 ? 's' : ''} del país`,
        a.tiendasExterior && `${a.tiendasExterior} del exterior`].filter(Boolean).join(' y ') + '.'
    : 'Tu carrito está vacío, así que te contamos lo general. Cuando agregues productos, te decimos qué te conviene con eso.';

  return el('section', { class:'a-card' + (completa ? ' completa' : '') },
    el('div', { class:'a-head' },
      el('span', { class:'a-avatar', 'aria-hidden':'true' }, ic('usuario')),
      el('div', { class:'a-head-txt' },
        el('small', {}, completa ? 'Tu caso, explicado' : 'Tu asistente de compra'),
        el('h2', {}, u ? `Estás como ${a.perfil.label}` : 'Todavía no entraste: te tomamos como Consumidor Final'),
        el('p', {}, a.perfil.desc, ' ',
          el('button', { class:'p-link', onclick:() => ir('#/impuestos?tab=perfil') }, '¿No es tu condición?')))),
    el('div', { class:'a-destino', role:'group', 'aria-label':'Para qué es la compra' },
      el('span', {}, '¿Para qué es esta compra?'),
      ...[['uso', 'Para mí o mi familia'], ['reventa', 'Para vender']].map(([id, texto]) =>
        el('button', { class:'v-chip' + (destinoCompra() === id ? ' on' : ''), 'aria-pressed':String(destinoCompra() === id),
          onclick:() => { store.set('config', { ...store.get('config'), destinoCompra:id }); alCambiar?.(); } }, texto))),
    el('p', { class:'a-contexto' }, contexto),
    el('div', { class:'a-cols' },
      columna('si', 'check', 'Podés', a.podes, 'Nada especial para esta compra.'),
      columna('no', 'x', 'No podés', a.noPodes, 'No hay nada que te lo impida.'),
      columna('conviene', 'estrella', 'Te conviene', a.conviene, 'Está todo en orden.')),
    a.grande ? el('div', { class:'a-grande' },
      el('span', {}, el('b', {}, 'Esto ya es una compra grande. '), 'Te la gestionamos con despachante y todos los papeles en regla.'),
      el('button', { class:'btn btn-win btn-sm', onclick:() => ir('#/grandes') }, 'Ver cómo funciona')) : null,
    el('p', { class:'c-legal' }, 'Te orientamos con los datos de tu compra y los valores que usa la app; no reemplaza a un contador.'));
}
