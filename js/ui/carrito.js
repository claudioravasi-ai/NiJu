/* ============================================================
   NiJu — Carrito unificado y checkout
   Un carrito con productos de tiendas distintas: se agrupa por
   origen, porque cada grupo tiene su propio envío, su propio
   plazo y su propio tratamiento impositivo.
   ============================================================ */
import { el, plata, num, ic, toast, hoja } from '../util.js';
import { STORE_BY_ID } from '../data/stores.js';
import { ENTREGAS, PAGOS } from '../data/niju-directo.js';
import { store, cambiarCant } from '../state.js';
import { calcularFee } from '../engine/fees.js';
import { comprobanteGestion, ALICUOTAS } from '../engine/facturacion.js';
import { calcularImportacion } from '../engine/taxes.js';
import { aUSD, FX } from '../engine/fx.js';
import { logoTienda, tagTipo, vacio, foto } from './components.js';
import { plazoCorto } from '../engine/envios.js';
import { crearOrden } from '../engine/ordenes.js';

export function vistaCarrito(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div', { class:'section' });
  raiz.append(cuerpo);

  let entrega = 'domicilio', pago = 'mp';

  function pintar(){
    const items = store.get('carrito');
    if (!items.length){
      cuerpo.replaceChildren(vacio('Tu carrito está vacío', 'Buscá algo y compará antes de comprar: la diferencia entre tiendas suele ser grande.'));
      return;
    }

    /* Agrupar por tienda */
    const porTienda = {};
    for (const it of items) (porTienda[it.tiendaId] ||= []).push(it);

    const grupos = [], resumen = { producto:0, envio:0, impuestos:0, fee:0, ivaFee:0, nacionalARS:0 };

    for (const [tid, lineas] of Object.entries(porTienda)){
      const t = STORE_BY_ID[tid] || {};
      const internacional = t.tipo === 'internacional';
      let sub = 0, envio = 0, pesoTot = 0, valorUSD = 0;

      for (const l of lineas){
        const p = l.moneda === 'ARS' ? l.precio : l.precio * (l.moneda === 'CNY' ? FX.cny * FX.tarjeta : FX.tarjeta);
        sub += p * l.cant;
        pesoTot += (l.pesoKg || 1) * l.cant;
        valorUSD += aUSD(l.precio, l.moneda) * l.cant;
      }
      envio = lineas.some(l => !l.envio) ? 0 : (t.envioBase || 0) * (internacional ? FX.tarjeta : 1);

      let imp = 0, detImp = null;
      if (internacional){
        detImp = calcularImportacion({ valorUSD, fleteUSD:aUSD(envio, 'ARS'), pesoKg:pesoTot,
          rubro:lineas[0].rubro, unidades:lineas.reduce((a,l) => a + l.cant, 0), regimen:store.get('config').regimen });
        imp = (detImp.impuestos + (detImp.gastos || 0)) * FX.tarjeta;
      }

      const fee = calcularFee({ valorUSD, fleteUSD:aUSD(envio, 'ARS'),
        tipo: t.tipo === 'propio' ? 'propio' : internacional ? 'internacional' : 'nacional' });
      const feeARS = fee.feeUSD * FX.tarjeta;

      resumen.producto += sub; resumen.envio += envio; resumen.impuestos += imp; resumen.fee += feeARS;
      if (!internacional && t.tipo !== 'propio') resumen.nacionalARS += sub;

      grupos.push(el('div', { class:'cart-group' },
        el('div', { class:'cart-group-head' },
          logoTienda(tid, true),
          el('div', { class:'spacer' },
            el('b', {}, t.nombre || tid),
            el('div', { class:'tiny dim' },
              'Llega en ' + plazoCorto(t.envioDias || [2,5], store.get('config').provincia, internacional)
              + (internacional ? ' · entra por courier' : ''))),
          tagTipo(t.tipo)),
        ...lineas.map(l => el('div', { class:'cart-line' },
          foto(l, 'cart-thumb'),
          el('div', { class:'spacer' },
            el('b', { class:'tiny' }, l.titulo),
            el('div', { class:'tiny dim' }, plata(l.precio, l.moneda) + ' c/u')),
          el('div', { class:'qty' },
            el('button', { onclick:() => { cambiarCant(l.ofertaId, -1); pintar(); } }, '−'),
            el('span', {}, String(l.cant)),
            el('button', { onclick:() => { cambiarCant(l.ofertaId, 1); pintar(); } }, '+')),
          el('b', { class:'mono', style:{ width:'110px', textAlign:'right' } },
            plata((l.moneda === 'ARS' ? l.precio : l.precio * FX.tarjeta) * l.cant)))),
        el('div', { style:{ padding:'11px 14px', background:'var(--bg-2)' } },
          fila('Subtotal', sub), fila(envio ? 'Envío' : 'Envío', envio, envio ? null : 'gratis'),
          imp ? fila('Impuestos de importación', imp, detImp ? detImp.regimen : null, () => verDetalle(detImp)) : null,
          internacional ? fila('Gestión NiJu', feeARS, `${fee.pctEfectivo}% + logística`)
                      : fila('Gestión NiJu', 0, 'se cobra una sola vez al final, no por tienda'))));
    }

    /* Comprobante por la gestión total.
       En una compra nacional asistida el cargo se calcula sobre el total
       nacional y la cantidad de tiendas: cada tienda es una compra que
       alguien de NiJu tiene que ir a hacer. */
    const tiendasNacionales = Object.entries(porTienda)
      .filter(([tid]) => { const st = STORE_BY_ID[tid]; return st && st.tipo !== 'internacional' && st.tipo !== 'propio'; }).length;
    if (resumen.nacionalARS > 0){
      const fa = calcularFee({ tipo:'nacional-asistida', montoARS:resumen.nacionalARS, tiendas:tiendasNacionales });
      resumen.fee += fa.feeARS;
      resumen.detalleAsistida = fa;
    }

    const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
    const comp = comprobanteGestion({ feeARS:resumen.fee, incluyeIVA:true, condicion:perfilId,
      jurisdiccion:store.get('config').provincia,
      cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit } });

    const costoEntrega = ENTREGAS.find(e => e.id === entrega)?.costo || 0;
    const descPago = pago === 'transfer' ? -(resumen.producto * 0.10) : 0;
    const total = Math.round(resumen.producto + resumen.envio + resumen.impuestos + comp.total + costoEntrega + descPago);

    const panel = el('div', { class:'buybox' },
      el('div', { class:'buybox-top' },
        el('div', { class:'kicker' }, 'Total del pedido'),
        el('div', { class:'price price-xl price-win' }, plata(total)),
        el('div', { class:'tiny dim' }, `${num(items.reduce((a,i) => a + i.cant, 0))} productos de ${Object.keys(porTienda).length} tiendas`)),
      el('div', { class:'buybox-body' },
        el('div', { class:'kicker' }, 'Cómo llega'),
        ...ENTREGAS.map(e => el('label', { class:'fitem' },
          el('input', { type:'radio', name:'entrega', checked:entrega === e.id || null, onchange:() => { entrega = e.id; pintar(); } }),
          el('span', { class:'spacer' }, `${e.icon} ${e.nombre}`, el('div', { class:'tiny dim' }, e.desc)),
          el('b', { class:'tiny mono' }, e.costo ? plata(e.costo) : 'gratis'))),

        el('hr', { class:'rule' }),
        el('div', { class:'kicker' }, 'Cómo pagás'),
        ...PAGOS.map(p => el('label', { class:'fitem' },
          el('input', { type:'radio', name:'pago', checked:pago === p.id || null, onchange:() => { pago = p.id; pintar(); } }),
          el('span', { class:'spacer' }, `${p.icon} ${p.nombre}`, el('div', { class:'tiny dim' }, p.desc)),
          p.desc2 ? el('b', { class:'tiny', style:{ color:'var(--ok)' } }, p.desc2) : null)),

        el('hr', { class:'rule' }),
        fila('Productos', resumen.producto),
        fila('Envíos', resumen.envio),
        resumen.impuestos ? fila('Impuestos de importación', resumen.impuestos) : null,
        resumen.detalleAsistida
          ? el('div', {},
              ...resumen.detalleAsistida.detalle.map(d => fila(d.k, d.v, d.nota)),
              resumen.detalleAsistida.noConviene
                ? el('div', { class:'notice notice-bad', style:{ margin:'8px 0' } },
                    el('b', {}, 'Te conviene más comprar vos. '),
                    resumen.detalleAsistida.avisoCliente,
                    el('div', { class:'row wrapf', style:{ marginTop:'8px' } },
                      ...Object.keys(porTienda).map(tid => el('a', {
                        class:'btn btn-sm', href:(porTienda[tid][0] || {}).url || '#',
                        target:'_blank', rel:'noopener'
                      }, 'Ir a ' + (STORE_BY_ID[tid]?.nombre || tid)))))
                : null)
          : null,
        comp.condicion === 'responsable_inscripto'
          ? [fila('Gestión NiJu (neto)', comp.neto), fila(`IVA ${(ALICUOTAS.iva*100).toFixed(0)}%`, comp.iva)]
          : fila('Gestión NiJu', comp.total, 'IVA incluido'),
        costoEntrega ? fila('Entrega', costoEntrega) : null,
        descPago ? fila('Descuento por transferencia', descPago) : null,
        el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('b', {}, plata(total))),

        el('div', { class:'tiny dim' }, `Recibís Factura ${comp.letra} por la gestión. `,
          el('a', { href:'#', style:{ color:'var(--win-tx)' }, onclick:e => { e.preventDefault(); verComprobante(comp); } }, 'Ver detalle')),

        el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => confirmar(items, total, comp, ir, entrega, pago) },
          ic('check'), 'Pagar todo junto'),
        el('div', { class:'tiny dim center' },
          'Pagás una sola vez acá. Compramos en cada tienda por vos y te mandamos todo junto.')));

    cuerpo.replaceChildren(
      el('div', { class:'notice notice-ok', style:{ marginBottom:'14px' } },
        el('b', {}, 'No tenés que entrar a ninguna tienda. '),
        'Aunque tu carrito tenga cosas de Coto, de Vea y de La Anónima, pagás una sola vez acá: nosotros compramos en cada una por vos, juntamos todo y te lo mandamos en un solo envío.'),
      el('div', { class:'row-b', style:{ marginBottom:'14px' } },
        el('div', {}, el('div', { class:'kicker' }, 'Una sola compra, todas las tiendas'), el('h2', {}, 'Tu carrito')),
        el('button', { class:'btn btn-sm', onclick:() => { store.set('carrito', []); pintar(); } }, 'Vaciar')),
      el('div', { class:'pdp' }, el('div', {}, ...grupos), panel));
  }

  pintar();
  return raiz;
}

const fila = (k, v, nota, onClick) => el('div', { class:'cost-line' + (onClick ? ' hoverable' : ''), onclick:onClick },
  el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
  el('span', { class:'mono' }, v ? plata(v) : '—'));

function verDetalle(d){
  if (!d) return;
  hoja({ titulo:'Impuestos de importación', cuerpo:el('div', {},
    ...d.lineas.map(l => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, l.k), el('span', { class:'mono' }, l.v ? 'US$ ' + l.v.toFixed(2) : '—'))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('span', {}, 'US$ ' + d.total.toFixed(2))))});
}

function verComprobante(comp){
  hoja({ titulo:`Factura ${comp.letra} por la gestión`, cuerpo:el('div', {},
    ...comp.lineas.map(l => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, l.k), el('span', { class:'mono' }, plata(l.v)))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('span', {}, plata(comp.total))),
    el('div', { class:'notice', style:{ marginTop:'10px' } }, comp.leyenda))});
}

function confirmar(items, total, comp, ir, entrega, pago){
  /* Una sola orden, aunque los productos sean de cinco tiendas
     distintas. El cliente paga acá; nosotros compramos en cada
     tienda por él y le mandamos todo junto. */
  const orden = crearOrden({
    items, totalARS:total, entrega, pago, comprobante:comp,
    direccion: store.get('usuario')?.direccion || null
  });

  store.push('comprasAnio', {
    fecha:Date.now(), ordenId:orden.id,
    titulo:items.map(i => i.titulo).slice(0,2).join(' + ') + (items.length > 2 ? ` +${items.length - 2}` : ''),
    tienda:[...new Set(items.map(i => STORE_BY_ID[i.tiendaId]?.nombre))].join(', '),
    tipo:items.some(i => STORE_BY_ID[i.tiendaId]?.tipo === 'internacional') ? 'internacional' : 'nacional',
    regimen:store.get('config').regimen, totalARS:total, ivaFeeARS:comp.iva,
    valorUSD:items.reduce((a,i) => a + aUSD(i.precio, i.moneda) * i.cant, 0), destino:'uso'
  });
  store.set('carrito', []);

  hoja({ titulo:'Listo, nos encargamos nosotros', ancho:560, cuerpo: el('div', { class:'col' },
    el('div', { class:'notice notice-ok' },
      el('b', {}, `Orden ${orden.id} confirmada. `),
      'Pagaste una sola vez. A partir de acá compramos nosotros en cada tienda, juntamos todo y te lo mandamos.'),
    el('div', { class:'kicker', style:{ marginTop:'6px' } }, 'Qué hacemos ahora'),
    ...orden.tramos.map((t, i) => el('div', { class:'step' },
      el('span', { class:'step-n' }, String(i + 1)),
      el('div', {},
        el('b', { class:'tiny' }, t.propio ? `Despachamos de nuestro depósito` : `Compramos en ${t.tienda}`),
        el('div', { class:'tiny dim' }, `${t.lineas.reduce((a,l) => a + l.cant, 0)} producto(s)`)))),
    el('div', { class:'step' },
      el('span', { class:'step-n' }, String(orden.tramos.length + 1)),
      el('div', {}, el('b', { class:'tiny' }, 'Juntamos todo en un solo envío'),
        el('div', { class:'tiny dim' }, 'No te llegan cinco paquetes distintos: te llega uno.'))),
    el('div', { class:'notice' },
      el('b', {}, 'Si algo cambia, te preguntamos. '),
      'Si un precio sube más del 5% o algo se quedó sin stock, te avisamos antes de comprar y decidís vos. Si no aceptás, te devolvemos esa parte.'),
    el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => { ir('#/cuenta'); location.reload(); } },
      'Ver el estado de mi orden')) });
}
