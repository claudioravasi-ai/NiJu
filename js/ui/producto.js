/* ============================================================
   NiJu — Ficha comparativa de producto
   Todas las tiendas, una al lado de la otra, con el precio
   descompuesto: producto + envío + impuestos + gestión NiJu.
   Nada escondido hasta el final.
   ============================================================ */
import { el, plata, num, ic, toast, estrellas, hoja } from '../util.js';
import { PRODUCTO_BY_ID } from '../data/catalog.js';
import { STORE_BY_ID } from '../data/stores.js';
import { ENTREGAS, PAGOS } from '../data/niju-directo.js';
import { buscar } from '../engine/search.js';
import { calcularFee, comparadorDeFee, TARIFARIO } from '../engine/fees.js';
import { comprobanteGestion, ALICUOTAS } from '../engine/facturacion.js';
import { consecuenciasFiscales, PERFILES } from '../engine/fiscal.js';
import { aUSD, FX } from '../engine/fx.js';
import { plazo, PROVINCIAS } from '../engine/envios.js';
import { store, agregarAlCarrito } from '../state.js';
import { logoTienda, tagTipo, selloOrigen, esqueleto, barraProgreso, vacio, precioDual, selectorMoneda } from './components.js';
import { precioReal, tablaPerfiles, mejorParaVos, conviendCambiar } from '../engine/precio-fiscal.js';
import { analizar } from '../engine/historial.js';

/**
 * Abre la ficha comparativa.
 * Puede llegar de dos formas, y las dos tienen que funcionar:
 *   · con un id de nuestro catálogo (los productos propios)
 *   · con el título de un producto real de una tienda conectada,
 *     que no tiene id nuestro porque es de ellos
 */
export function vistaProducto(clave, ir){
  const porId = PRODUCTO_BY_ID[clave];
  const raiz = el('div', { class:'wrap' });
  const cont = el('div', { class:'section' });
  cont.append(esqueleto(3));
  raiz.append(cont);

  const consulta = porId ? `${porId.marca} ${porId.n}` : decodeURIComponent(clave || '');

  buscar(consulta, {}, () => {}).then(({ grupos }) => {
    const norm = t => (t || '').toLowerCase().trim();
    const g = grupos.find(x => x.productoId && x.productoId === clave)
           || grupos.find(x => norm(x.titulo) === norm(consulta))
           || grupos[0];
    if (!g){ cont.replaceChildren(vacio('No encontramos ese producto', 'Puede que haya salido de stock en todas las tiendas.')); return; }
    cont.replaceChildren(ficha(g, ir));
  });

  return raiz;
}

function ficha(g, ir){
  const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
  let elegida = g.mejor;
  let extras = new Set();
  let destino = 'uso';

  const box = el('div', { class:'buybox' });
  const tabla = el('div');

  function pintarBuyBox(){
    const o = elegida;
    const t = STORE_BY_ID[o.tiendaId];
    const c = o.costo;

    const valorUSD = aUSD(o.precio, o.moneda);
    const fleteUSD = aUSD(o.envio || 0, o.moneda);
    const tipoFee = o.propio ? 'propio' : c.internacional ? 'internacional' : 'nacional';
    const fee = calcularFee({ valorUSD, fleteUSD, tipo:tipoFee, extras:[...extras] });
    const feeARS = fee.feeUSD * FX.tarjeta;

    // La comisión de NiJu se factura con IVA: lo discriminamos siempre.
    const comp = comprobanteGestion({
      feeARS, incluyeIVA:true, condicion:perfilId,
      jurisdiccion: store.get('config').provincia,
      cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit }
    });

    const totalFinal = Math.round(c.productoARS + c.envioARS + c.impuestosARS + comp.total);

    box.replaceChildren(
      el('div', { class:'buybox-top' },
        el('div', { class:'row', style:{ marginBottom:'8px' } },
          logoTienda(o.tiendaId, true),
          el('div', { class:'spacer' },
            el('div', { class:'row', style:{ gap:'6px' } }, el('b', {}, t?.nombre || o.tiendaId), selloOrigen(o)),
            el('div', { class:'tiny dim' }, `${o.vendedor} · ${estrellas(o.reputacion)} ${o.reputacion}`)),
          tagTipo(t?.tipo)),
        o.precioLista ? el('div', { class:'tiny strike' }, plata(o.precioLista, o.moneda)) : null,
        precioDual(totalFinal, { clase:'price price-xl', internacional:c.internacional }),
        el('div', { class:'tiny dim' }, c.internacional ? 'precio final puesto en tu casa, todo incluido' : 'precio final con gestión'),
        cuotasReales(o, totalFinal)
      ),

      el('div', { class:'buybox-body' },
        el('div', { class:'kicker' }, 'Cómo se compone'),
        linea('Producto', c.productoARS, o.moneda !== 'ARS' ? `${plata(o.precio, o.moneda)} al dólar ${c.via}` : null),
        linea(o.envio ? 'Envío' : 'Envío', c.envioARS, o.envio ? null : 'gratis'),
        c.impuestosARS ? linea(`Impuestos de importación`, c.impuestosARS,
          c.detalleImp ? `${c.detalleImp.tasaEfectiva}% efectivo · ${c.detalleImp.regimen}` : null, () => verImpuestos(c)) : null,

        el('hr', { class:'rule', style:{ margin:'6px 0' } }),
        el('div', { class:'kicker' }, 'Gestión NiJu (facturada)'),
        comp.condicion === 'responsable_inscripto'
          ? [ linea('Gestión operativa y logística (neto)', comp.neto),
              linea(`IVA ${(ALICUOTAS.iva*100).toFixed(0)}%`, comp.iva),
              ...comp.percepciones.map(p => linea(p.k, p.v)) ]
          : [ linea('Gestión operativa y logística', comp.total, 'IVA incluido (Factura B)') ],

        el('div', { class:'cost-line total' },
          el('span', { class:'lbl' }, 'Total a pagar'),
          el('b', {}, plata(totalFinal))),

        el('div', { class:'tiny dim' },
          `Emitimos Factura ${comp.letra} a nombre de ${comp.cliente.nombre}. `,
          el('a', { href:'#', style:{ color:'var(--win-tx)' }, onclick:e => { e.preventDefault(); verComprobante(comp); } }, 'Ver comprobante')),

        el('div', { class:'row wrapf', style:{ gap:'6px' } },
          ...TARIFARIO.extras.map(x => el('button', {
            class:'chip' + (extras.has(x.id) ? ' on-win' : ''),
            title:x.desc,
            onclick:() => { extras.has(x.id) ? extras.delete(x.id) : extras.add(x.id); pintarBuyBox(); }
          }, '+ ' + x.nombre))),

        el('div', { class:'field' },
          el('label', {}, 'Destino de la compra'),
          el('select', { class:'inp', onchange:e => { destino = e.target.value; pintarBuyBox(); } },
            el('option', { value:'uso', selected:destino === 'uso' || null }, 'Uso personal'),
            el('option', { value:'reventa', selected:destino === 'reventa' || null }, 'Reventa / comercial'))),

        c.bloqueado ? el('div', { class:'notice notice-bad' },
          'Esta compra excede los límites del courier puerta a puerta. Hay que hacerla por importación general con despachante.') : null,

        el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
          agregarAlCarrito({ ...o, costoFinal:totalFinal }, 1);
          toast('Agregado al carrito', 'win');
        } }, ic('carrito'), o.propio ? 'Comprar ahora' : 'Comprar por NiJu'),

        el('button', { class:'btn btn-block', onclick:() => window.open(o.url, '_blank', 'noopener') },
          ic('mundo'), 'Ver en ' + (t?.nombre || 'la tienda')),

        el('button', { class:'btn btn-ghost btn-block btn-sm', onclick:() => verFiscal(o, c, comp, destino, perfilId) },
          ic('calc'), 'Qué tenés que declarar en ARCA'),

        (() => {
          const pl = plazo({ despacho:o.entregaDias, provincia:store.get('config').provincia,
                             internacional:c.internacional });
          return el('div', {},
            el('div', { class:'cost-line' },
              el('span', { class:'lbl' }, 'Llega en'),
              el('b', {}, pl.texto)),
            el('div', { class:'tiny dim' }, pl.detalle),
            el('div', { class:'field', style:{ marginTop:'8px' } },
              el('label', {}, 'Calcular para otra provincia'),
              el('select', { class:'inp', onchange:ev => {
                store.set('config', { ...store.get('config'), provincia:ev.target.value });
                pintarBuyBox(); pintarTabla();
              } }, ...Object.keys(PROVINCIAS).map(pr =>
                el('option', { value:pr, selected:store.get('config').provincia === pr || null }, pr)))),
            el('div', { class:'tiny dim center', style:{ marginTop:'8px' } },
              `${num(o.stock)} disponibles · el plazo es estimado, lo define la tienda y el correo`));
        })()
      )
    );
  }

  function pintarTabla(){
    const filas = g.ofertas.map(o => {
      const t = STORE_BY_ID[o.tiendaId];
      const c = o.costo;
      const valorUSD = aUSD(o.precio, o.moneda);
      const fee = calcularFee({ valorUSD, fleteUSD:aUSD(o.envio || 0, o.moneda),
        tipo:o.propio ? 'propio' : c.internacional ? 'internacional' : 'nacional' });
      const total = Math.round(c.productoARS + c.envioARS + c.impuestosARS + fee.feeUSD * FX.tarjeta);
      return { o, t, c, total, fee };
    }).sort((a,b) => a.total - b.total);

    const min = filas[0]?.total || 0;

    tabla.replaceChildren(el('div', { class:'tbl-wrap' },
      el('table', { class:'tbl' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Tienda'), el('th', {}, 'Origen'), el('th', {}, 'Producto'),
          el('th', {}, 'Envío'), el('th', {}, 'Impuestos'), el('th', {}, 'Gestión'),
          el('th', {}, 'Final'), el('th', {}, 'Entrega'), el('th', {}, ''))),
        el('tbody', {}, ...filas.map(({ o, t, c, total, fee }) => {
          const esMejor = total === min;
          return el('tr', { class: esMejor ? 'is-win' : '' },
            el('td', {}, el('div', { class:'row' }, logoTienda(o.tiendaId),
              el('div', {}, el('div', { class:'row', style:{ gap:'5px' } }, el('b', {}, t?.nombre || o.tiendaId), selloOrigen(o)),
                el('div', { class:'tiny dim' }, o.vendedor)))),
            el('td', {}, tagTipo(t?.tipo)),
            el('td', { class:'mono' }, plata(c.productoARS),
              o.moneda !== 'ARS' ? el('div', { class:'tiny dim' }, plata(o.precio, o.moneda)) : null),
            el('td', { class:'mono' }, c.envioARS ? plata(c.envioARS) : el('span', { style:{ color:'var(--ok)' } }, 'gratis')),
            el('td', { class:'mono' }, c.impuestosARS ? plata(c.impuestosARS) : '—'),
            el('td', { class:'mono' }, fee.gratis ? el('span', { style:{ color:'var(--ok)' } }, 'sin cargo') : plata(fee.feeUSD * FX.tarjeta)),
            el('td', {}, el('b', { class:'price', style:{ fontSize:'16px', color: esMejor ? 'var(--win)' : '' } }, plata(total)),
              esMejor ? el('div', { class:'tiny', style:{ color:'var(--win-tx)', fontWeight:'800' } }, 'MEJOR') :
                el('div', { class:'tiny dim' }, '+' + plata(total - min))),
            el('td', { class:'tiny' }, (() => {
              const pl = plazo({ despacho:o.entregaDias, provincia:store.get('config').provincia,
                                 internacional:c.internacional });
              return `${pl.min}-${pl.max} d`; })()),
            el('td', {}, el('button', { class:'btn btn-sm ' + (esMejor ? 'btn-win' : ''),
              onclick:() => { elegida = o; pintarBuyBox(); window.scrollTo({ top:0, behavior:'smooth' }); } }, 'Elegir')));
        })))));
  }

  pintarBuyBox(); pintarTabla();

  const specs = g.specs && Object.keys(g.specs).length
    ? el('div', { class:'card', style:{ marginTop:'16px' } },
        el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'Ficha técnica'),
        el('div', { class:'grid g-2' }, ...Object.entries(g.specs).map(([k, v]) =>
          el('div', { class:'row-b', style:{ borderBottom:'1px solid var(--line-soft)', padding:'6px 0' } },
            el('span', { class:'tiny dim' }, k), el('b', { class:'tiny' }, v)))))
    : null;

  const bloqueTuPrecio = tuPrecio(g, elegida, perfilId);
  const bloqueHistorial = historialDe(elegida);

  return el('div', {},
    el('div', { class:'row', style:{ marginBottom:'14px' } },
      el('button', { class:'btn btn-sm', onclick:() => history.back() }, '← Volver'),
      el('span', { class:'tiny dim' }, `${g.tiendas} tiendas comparadas · ahorro de hasta ${plata(g.ahorro)}`)),
    el('div', { class:'pdp' },
      el('div', {},
        el('div', { class:'pdp-gal' }, g.emo || '📦'),
        el('h1', { style:{ fontSize:'clamp(21px,3vw,30px)', textTransform:'none', marginTop:'16px' } }, g.titulo),
        el('div', { class:'row wrapf', style:{ margin:'8px 0 16px' } },
          el('span', { class:'chip' }, g.marca),
          el('span', { class:'chip' }, g.rubro),
          g.ahorroPct ? el('span', { class:'saving' }, `Hasta ${g.ahorroPct}% de diferencia entre tiendas`) : null),
        bloqueHistorial,
        bloqueTuPrecio,
        el('h3', { style:{ margin:'18px 0 10px' } }, 'Comparación completa'),
        tabla, specs),
      box));
}

const linea = (k, v, nota, onClick) => el('div', { class:'cost-line' + (onClick ? ' hoverable' : ''), onclick:onClick },
  el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
  el('span', { class:'mono' }, plata(v)));

function verImpuestos(c){
  const d = c.detalleImp;
  if (!d) return;
  hoja({ titulo:'Impuestos de importación', cuerpo: el('div', {},
    el('div', { class:'kicker', style:{ marginBottom:'8px' } }, d.regimen === 'courier' ? 'Régimen courier puerta a puerta' : 'Importación general'),
    ...d.lineas.map(l => el('div', { class:'cost-line' },
      el('span', { class:'lbl' }, l.k, l.detalle ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + l.detalle) : null),
      el('span', { class:'mono' }, l.v ? 'US$ ' + l.v.toFixed(2) : '—'))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total de la operación'), el('span', {}, 'US$ ' + d.total.toFixed(2))),
    ...d.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : a.t === 'ok' ? 'notice-ok' : ''), style:{ marginTop:'10px' } }, a.m)),
    el('p', { class:'tiny dim', style:{ marginTop:'14px' } },
      'Los parámetros del cálculo son editables y hay que contrastarlos con la normativa vigente de ARCA antes de operar.'))});
}

function verComprobante(comp){
  hoja({ titulo:`Factura ${comp.letra} — borrador`, cuerpo: el('div', {},
    el('div', { class:'card', style:{ marginBottom:'12px' } },
      el('div', { class:'row-b' },
        el('div', {}, el('b', {}, comp.emisor.razonSocial),
          el('div', { class:'tiny dim' }, `CUIT ${comp.emisor.cuit} · ${comp.emisor.condicion === 'responsable_inscripto' ? 'Responsable Inscripto' : 'Monotributo'}`),
          el('div', { class:'tiny dim' }, `IIBB ${comp.emisor.iibb} · ${comp.emisor.jurisdiccion}`)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { style:{ fontSize:'30px', fontWeight:'900' } }, comp.letra),
          el('div', { class:'tiny dim' }, 'Pto. Vta. ' + String(comp.emisor.ptoVta).padStart(5,'0')))),
      el('hr', { class:'rule', style:{ margin:'10px 0' } }),
      el('div', { class:'tiny' }, 'Cliente: ', el('b', {}, comp.cliente.nombre || 'Consumidor Final')),
      comp.cliente.cuit ? el('div', { class:'tiny' }, 'CUIT: ' + comp.cliente.cuit) : null,
      el('div', { class:'tiny dim' }, 'Condición frente al IVA: ' + (PERFILES[comp.condicion]?.label || comp.condicion))),
    ...comp.lineas.map(l => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, l.k), el('span', { class:'mono' }, plata(l.v)))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('span', {}, plata(comp.total))),
    el('div', { class:'notice', style:{ marginTop:'12px' } }, comp.leyenda),
    el('div', { class:'notice notice-bad', style:{ marginTop:'8px' } },
      'Sin CAE: es un borrador. El comprobante fiscal se emite desde el backend con el web service de ARCA (WSFEv1) al confirmar el pago.'),
    el('div', { class:'card', style:{ marginTop:'12px' } },
      el('div', { class:'kicker', style:{ marginBottom:'6px' } }, 'Para la contabilidad de NiJu (no va en el comprobante)'),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, `IIBB ${(comp.alicIIBB*100).toFixed(1)}% — ${comp.emisor.jurisdiccion}`), el('span', { class:'mono' }, plata(comp.iibb))),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Débito fiscal IVA del período'), el('span', { class:'mono' }, plata(comp.iva))))
  )});
}

function verFiscal(o, c, comp, destino, perfilId){
  const f = consecuenciasFiscales({
    tipo: o.propio ? 'propio' : c.internacional ? 'internacional' : 'nacional',
    regimen: c.detalleImp?.regimen,
    totalARS: c.productoARS + c.envioARS + c.impuestosARS + comp.total,
    ivaARS: c.internacional ? 0 : Math.round(c.productoARS - c.productoARS / 1.21),
    ivaFeeARS: comp.iva,
    impuestosImportARS: c.impuestosARS,
    valorUSD: aUSD(o.precio, o.moneda),
    destino
  }, perfilId);

  const bloque = (t, arr, color) => arr.length ? el('div', { style:{ marginBottom:'14px' } },
    el('div', { class:'kicker', style:{ color, marginBottom:'6px' } }, t),
    ...arr.map(x => el('div', { class:'cost-line' },
      el('span', { class:'lbl' }, x.k, x.donde || x.motivo ? el('i', { class:'tiny dim', style:{ fontStyle:'normal', display:'block' } }, x.donde || x.motivo) : null),
      el('span', { class:'mono' }, plata(x.v))))) : null;

  hoja({ titulo:'Tu situación fiscal en esta compra', ancho:660, cuerpo: el('div', {},
    el('div', { class:'card', style:{ marginBottom:'14px', borderColor:f.perfil.color } },
      el('div', { class:'row-b' },
        el('div', {}, el('div', { class:'kicker' }, 'Tu condición'),
          el('b', { style:{ fontSize:'17px', color:f.perfil.color } }, f.perfil.label)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'kicker' }, 'Costo real de la compra'),
          el('b', { style:{ fontSize:'19px' } }, plata(f.costoRealARS)))),
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } }, f.perfil.desc)),
    bloque('Podés computar', f.computable, 'var(--ok)'),
    bloque('Es costo (no lo recuperás)', f.costo, 'var(--warn)'),
    bloque('Queda a tu favor', f.aCuenta, 'var(--nac)'),
    el('div', { class:'kicker', style:{ marginBottom:'6px' } }, 'Qué tenés que hacer'),
    ...f.obligaciones.map(x => el('div', { class:'step' },
      el('span', { class:'step-n' }, '›'),
      el('div', {}, el('b', { class:'tiny' }, x.k), el('div', { class:'tiny dim' }, x.d),
        el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, 'Plazo: ' + x.plazo)))),
    el('div', { class:'kicker', style:{ margin:'14px 0 6px' } }, 'Formularios que te alcanzan'),
    el('div', { class:'row wrapf' }, ...f.formularios.map(x => el('span', { class:'chip' }, x))),
    ...f.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : ''), style:{ marginTop:'10px' } }, a.m)),
    el('div', { class:'notice', style:{ marginTop:'14px' } },
      'NiJu organiza tu información fiscal, no reemplaza a tu contador. Verificá los parámetros antes de presentar.'))});
}


/* ------------------------------------------------------------------
   "El precio que te corresponde a vos"
   El mismo producto vale distinto según tu condición ante ARCA, y
   la tienda más barata de vidriera no siempre es la que te conviene.
   ------------------------------------------------------------------ */
function tuPrecio(g, elegida, perfilId){
  const tabla = tablaPerfiles(elegida);
  const mio = tabla.find(x => x.id === perfilId) || tabla[0];
  const orden = mejorParaVos(g.ofertas, perfilId);
  const cambio = conviendCambiar(elegida, perfilId);

  return el('div', { class:'card', style:{ marginTop:'18px', borderLeft:'4px solid var(--accion)' } },
    el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
      el('div', {}, el('div', { class:'kicker' }, 'El precio que te corresponde a vos'),
        el('h3', {}, 'Sos ' + mio.perfil.label)),
      el('div', { style:{ textAlign:'right' } },
        el('div', { class:'tiny dim' }, 'Precio de vidriera ' + plata(mio.bruto)),
        el('div', { class:'price price-lg', style:{ color:'var(--win-tx)' } }, plata(mio.real)),
        mio.recupera ? el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, 'recuperás ' + plata(mio.recupera)) : null)),

    ...mio.notas.map(n => el('p', { class:'tiny muted', style:{ margin:'2px 0' } }, '· ' + n)),

    orden.cambiaElGanador
      ? el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
          el('b', {}, 'Ojo con esto: '), orden.mensaje)
      : null,

    el('div', { class:'tbl-wrap', style:{ marginTop:'12px' } },
      el('table', { class:'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Si sos…'), el('th', {}, 'Precio de vidriera'),
          el('th', {}, 'Recuperás'), el('th', {}, 'Te sale de verdad'))),
        el('tbody', {}, ...tabla.map(x => el('tr', { class: x.id === perfilId ? 'is-win' : '' },
          el('td', {}, x.perfil.label, x.id === perfilId ? el('span', { class:'tag tag-win', style:{ marginLeft:'6px' } }, 'vos') : null),
          el('td', { class:'mono' }, plata(x.bruto)),
          el('td', { class:'mono', style:{ color: x.recupera ? 'var(--win-tx)' : '' } }, x.recupera ? plata(x.recupera) : '—'),
          el('td', { class:'mono' }, el('b', {}, plata(x.real)))))))),

    cambio ? el('div', { class:'notice', style:{ marginTop:'10px' } }, cambio.texto) : null,
    el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
      'Esto organiza tu información fiscal; no es asesoramiento impositivo. Consultalo con tu contador.'));
}

/* ------------------------------------------------------------------
   El historial: si el descuento es real o es humo.
   ------------------------------------------------------------------ */
function historialDe(oferta){
  const a = analizar(oferta);
  if (!a.hayHistoria){
    return el('div', { class:'card', style:{ marginTop:'18px' } },
      el('div', { class:'kicker', style:{ marginBottom:'4px' } }, 'Historial de precio'),
      el('p', { class:'tiny muted' },
        `Todavía no tenemos historia de este producto (llevamos ${a.dias} día${a.dias === 1 ? '' : 's'}). ` +
        'La app guarda el precio de cada producto todos los días: en un par de semanas vas a poder ver si un descuento es real o si subieron el precio antes de tacharlo.'));
  }

  const barra = el('div', { style:{ position:'relative', height:'8px', background:'var(--surface-2)', borderRadius:'99px', margin:'10px 0 6px' } },
    el('i', { style:{ position:'absolute', left:a.posicion + '%', top:'-4px', width:'3px', height:'16px', background:'var(--accion)', borderRadius:'2px' } }));

  return el('div', { class:'card', style:{ marginTop:'18px', borderLeft:`4px solid ${a.descuentoTrucho ? 'var(--bad)' : a.esElMasBajo ? 'var(--win)' : 'var(--line-firme)'}` } },
    el('div', { class:'row-b wrapf' },
      el('div', {}, el('div', { class:'kicker' }, 'Historial de precio'),
        el('h3', {}, `Últimos ${a.dias} días`)),
      a.variacion30 !== null
        ? el('div', { style:{ textAlign:'right' } },
            el('div', { class:'kicker' }, 'En 30 días'),
            el('b', { style:{ color: a.variacion30 > 0 ? 'var(--bad)' : 'var(--win-tx)' } },
              (a.variacion30 > 0 ? '+' : '') + a.variacion30 + '%'))
        : null),
    barra,
    el('div', { class:'row-b tiny dim' },
      el('span', {}, 'mínimo ' + plata(a.min)),
      el('span', {}, 'promedio ' + plata(a.promedio)),
      el('span', {}, 'máximo ' + plata(a.max))),
    a.veredicto.m ? el('div', { class:'notice ' + (a.veredicto.t === 'bad' ? 'notice-bad' : a.veredicto.t === 'ok' ? 'notice-ok' : ''), style:{ marginTop:'10px' } },
      a.veredicto.m) : null,
    a.descuentoTrucho ? el('div', { style:{ marginTop:'8px' } },
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Precio tachado que publica la tienda'), el('span', { class:'mono' }, plata(a.descuentoTrucho.listaPublicada))),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Precio más alto que tuvo de verdad'), el('span', { class:'mono' }, plata(a.descuentoTrucho.maximoReal))),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Descuento declarado'), el('span', { class:'mono' }, a.descuentoTrucho.descuentoDeclarado + '%')),
      el('div', { class:'cost-line total' }, el('span', {}, 'Descuento real'), el('b', {}, a.descuentoTrucho.descuentoReal + '%'))) : null);
}


/* ------------------------------------------------------------------
   Las cuotas se muestran solo si la tienda realmente las ofrece.
   Antes salían de una tabla nuestra y eso hacía que la app dijera
   "12 cuotas sin interés" en productos que no tenían ninguna.
   ------------------------------------------------------------------ */
function cuotasReales(o, totalFinal){
  // Oferta real que SÍ publica cuotas: mostramos el valor que publica la tienda
  if (o.demo === false && o.cuotas > 1 && o.cuotaValor){
    return el('div', { class:'tiny', style:{ marginTop:'6px', color:'var(--win-tx)', fontWeight:'600' } },
      `${o.cuotas} cuotas sin interés de ${plata(o.cuotaValor)}`,
      el('div', { class:'dim', style:{ fontWeight:'400' } }, 'según publica la tienda'));
  }
  // Oferta real que NO tiene cuotas: lo decimos
  if (o.demo === false){
    return el('div', { class:'tiny dim', style:{ marginTop:'6px' } },
      'Esta tienda no publica cuotas sin interés para este producto.');
  }
  // Producto propio de NiJu: las cuotas las ponemos nosotros
  if (o.propio && o.cuotas > 1){
    return el('div', { class:'tiny', style:{ marginTop:'6px', color:'var(--win-tx)', fontWeight:'600' } },
      `${o.cuotas} cuotas sin interés de ${plata(totalFinal / o.cuotas)}`);
  }
  return null;
}
