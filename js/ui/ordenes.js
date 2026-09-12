/* ============================================================
   NiJu — Órdenes de compra asistida
   Dos miradas de lo mismo:
     · la del cliente: en qué anda mi pedido
     · la del operador: qué tengo que ir a comprar y dónde
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import { ordenes, ordenDe, ESTADOS, listaDeCompras, marcarLinea, cambiarEstado, resultado } from '../engine/ordenes.js';
import { logoTienda, foto } from './components.js';
import { store } from '../state.js';

/* ---------------- Lo que ve el cliente ---------------- */
export function misOrdenes(refrescar){
  const os = ordenes();
  if (!os.length) return null;

  return el('div', { style:{ marginTop:'22px' } },
    el('h3', { style:{ marginBottom:'12px' } }, 'Mis pedidos'),
    el('div', { class:'col' }, ...os.slice().reverse().map(o => {
      const e = ESTADOS[o.estado] || ESTADOS.pagada;
      const total = o.tramos.flatMap(t => t.lineas).reduce((a,l) => a + l.cant, 0);
      return el('div', { class:'card', style:{ borderLeft:`4px solid ${e.color}` } },
        el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
          el('div', {},
            el('div', { class:'row', style:{ gap:'8px' } },
              el('b', {}, o.id),
              el('span', { class:'tag', style:{ color:e.color } }, e.label)),
            el('div', { class:'tiny dim' }, `${fecha(o.creada)} · ${total} productos de ${o.tramos.length} tienda${o.tramos.length > 1 ? 's' : ''}`)),
          el('div', { style:{ textAlign:'right' } },
            el('div', { class:'price price-lg' }, plata(o.totalARS)),
            el('div', { class:'tiny dim' }, 'pagaste una sola vez'))),

        el('div', { class:'notice' + (o.estado === 'consultando' ? '' : ' notice-ok'), style:{ marginBottom:'10px' } }, e.desc),

        /* Una fila por tienda: el cliente ve que compramos nosotros */
        ...o.tramos.map(t => el('div', { class:'row', style:{ padding:'8px 0', borderBottom:'1px solid var(--line-soft)' } },
          logoTienda(t.tiendaId),
          el('div', { class:'spacer' },
            el('b', { class:'tiny' }, t.propio ? 'Despacha NiJu' : `Compramos en ${t.tienda}`),
            el('div', { class:'tiny dim' }, t.lineas.map(l => `${l.cant}× ${l.titulo}`).join(' · ').slice(0, 90))),
          el('span', { class:'tag ' + (t.estado === 'comprado' ? 'tag-ok' : t.estado === 'con-problema' ? 'tag-bad' : '') },
            t.estado === 'comprado' ? 'comprado' : t.estado === 'con-problema' ? 'con problema' : 'pendiente'))),

        o.necesitaOK ? el('div', { class:'notice notice-bad', style:{ marginTop:'10px' } },
          el('b', {}, 'Necesitamos que decidas. '),
          o.diferencia > 0
            ? `Algún precio subió ${plata(Math.round(o.diferencia))} respecto de lo que pagaste. Te contactamos para confirmar antes de seguir.`
            : 'Algo no tenía stock. Te contactamos para reemplazarlo o devolverte esa parte.') : null,

        el('details', { style:{ marginTop:'10px' } },
          el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Ver el paso a paso'),
          el('div', { style:{ paddingTop:'8px' } },
            ...o.historia.slice().reverse().map(h => el('div', { class:'row', style:{ padding:'5px 0' } },
              el('span', { class:'tiny dim mono', style:{ width:'110px' } }, fecha(h.ts)),
              el('span', { class:'tiny' }, h.nota || ESTADOS[h.estado]?.label))))));
    })));
}

/* ---------------- Lo que ve el operador ---------------- */
export function vistaOperacion(refrescar){
  const listas = listaDeCompras();
  const todas = ordenes();
  const abiertas = todas.filter(o => !['entregada','cancelada'].includes(o.estado));

  if (!todas.length){
    return el('div', { class:'card center', style:{ padding:'40px' } },
      el('div', { style:{ fontSize:'38px' } }, '🧾'),
      el('h3', { style:{ margin:'10px 0 6px' } }, 'Todavía no hay órdenes'),
      el('p', { class:'muted tiny', style:{ maxWidth:'56ch', margin:'0 auto' } },
        'Cuando un cliente pague, acá te va a aparecer la lista de qué comprar en cada tienda, con el link y el precio máximo que podés pagar.'));
  }

  const kpi = (t, v, d, col) => el('div', { class:'kpi' },
    el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);

  const facturado = abiertas.reduce((a,o) => a + o.totalARS, 0);
  const aComprar = listas.reduce((a,t) => a + t.aPagar, 0);

  return el('div', {},
    el('div', { class:'grid g-4', style:{ marginBottom:'18px' } },
      kpi('Órdenes abiertas', String(abiertas.length)),
      kpi('Cobrado', plata(facturado)),
      kpi('Tenés que comprar', plata(aComprar), 'en ' + listas.length + ' tiendas', 'var(--warn)'),
      kpi('Margen bruto', plata(facturado - aComprar), '', 'var(--win-tx)')),

    el('div', { class:'notice', style:{ marginBottom:'16px' } },
      el('b', {}, 'Esta es tu lista de compras. '),
      'Entrás a cada tienda, comprás lo que dice, y marcás cada renglón. Si el precio subió, lo anotás: la app avisa sola al cliente cuando la diferencia pasa el 5%.'),

    ...listas.map(t => el('div', { class:'card', style:{ marginBottom:'14px' } },
      el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
        el('div', { class:'row' }, logoTienda(t.tiendaId, true),
          el('div', {}, el('b', {}, t.tienda),
            el('div', { class:'tiny dim' }, `${t.renglones.length} renglones · ${t.unidades} unidades`))),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'kicker' }, 'A pagar en esta tienda'),
          el('b', { style:{ fontSize:'18px' } }, plata(t.aPagar)))),

      el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Producto'), el('th', {}, 'Cant'),
          el('th', {}, 'Hasta'), el('th', {}, 'Orden'), el('th', {}, 'Cliente'), el('th', {}, 'Acción'))),
        el('tbody', {}, ...t.renglones.map(r => el('tr', {},
          el('td', {}, el('a', { href:r.url || '#', target:'_blank', rel:'noopener' }, r.titulo.slice(0, 46))),
          el('td', { class:'mono' }, String(r.cant)),
          el('td', { class:'mono' }, plata(r.precioAcordado)),
          el('td', { class:'tiny mono' }, r.ordenId),
          el('td', { class:'tiny' }, r.cliente),
          el('td', {}, el('div', { class:'row', style:{ gap:'5px' } },
            el('button', { class:'btn btn-sm btn-win', onclick:() => {
              marcarLinea(r.ordenId, r.tramoId, r.ofertaId, { estado:'comprado', precioReal:r.precioAcordado });
              toast('Marcado como comprado', 'win'); refrescar();
            } }, 'Comprado'),
            el('button', { class:'btn btn-sm', onclick:() => problema(r, refrescar) }, 'Problema')))))))))),

    el('h3', { style:{ margin:'22px 0 12px' } }, 'Órdenes'),
    el('div', { class:'col' }, ...abiertas.slice().reverse().map(o => {
      const e = ESTADOS[o.estado]; const res = resultado(o);
      return el('div', { class:'card', style:{ borderLeft:`4px solid ${e.color}` } },
        el('div', { class:'row-b wrapf' },
          el('div', {}, el('div', { class:'row', style:{ gap:'7px' } },
            el('b', {}, o.id), el('span', { class:'tag', style:{ color:e.color } }, e.label)),
            el('div', { class:'tiny dim' }, `${o.cliente.nombre} · ${fecha(o.creada)}`)),
          el('div', { style:{ textAlign:'right' } },
            el('div', { class:'tiny dim' },
              `cobrado ${plata(res.cobrado)} · mercadería ${plata(res.mercaderia)} · envío ${plata(res.envio)}`),
            el('b', { style:{ color:'var(--win-tx)' } }, `margen ${plata(res.margen)} (${res.margenPct}%)`))),
        el('div', { class:'row wrapf', style:{ marginTop:'10px' } },
          ...['consolidando','enviada','entregada'].map(x => el('button', {
            class:'btn btn-sm' + (o.estado === x ? ' btn-win' : ''),
            onclick:() => { cambiarEstado(o.id, x); refrescar(); } }, ESTADOS[x].label)),
          el('button', { class:'btn btn-sm', style:{ color:'var(--bad)' },
            onclick:() => { cambiarEstado(o.id, 'cancelada', 'Anulada y devuelta.'); refrescar(); } }, 'Cancelar')));
    })));
}

function problema(r, refrescar){
  let precio = r.precioAcordado, motivo = 'sin-stock';
  const { cerrar } = hoja({ titulo:'¿Qué pasó con este producto?', cuerpo: el('div', { class:'col' },
    el('div', { class:'notice' }, r.titulo),
    el('div', { class:'field' }, el('label', {}, 'Motivo'),
      el('select', { class:'inp', onchange:e => motivo = e.target.value },
        el('option', { value:'sin-stock' }, 'No hay stock'),
        el('option', { value:'precio' }, 'Cambió el precio'),
        el('option', { value:'otro' }, 'Otro'))),
    el('div', { class:'field' }, el('label', {}, 'Precio real que encontraste'),
      el('input', { class:'inp', type:'number', value:String(r.precioAcordado),
        oninput:e => precio = +e.target.value || 0 })),
    el('button', { class:'btn btn-win btn-block', onclick:() => {
      marcarLinea(r.ordenId, r.tramoId, r.ofertaId, {
        estado: motivo === 'precio' ? 'comprado' : 'problema',
        precioReal: precio,
        nota: motivo === 'sin-stock' ? 'Sin stock en la tienda' : motivo === 'precio' ? 'El precio cambió' : 'Revisar'
      });
      toast('Anotado. Si hace falta, el cliente recibe el aviso.', 'win');
      cerrar(); refrescar();
    } }, 'Guardar')) });
}
