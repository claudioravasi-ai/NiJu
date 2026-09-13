/* ============================================================
   NiJu — Componentes compartidos
   ============================================================ */
import { el, plata, num, ic, estrellas } from '../util.js';
import { STORE_BY_ID, TIPO_META } from '../data/stores.js';
import { RUBRO_BY_ID } from '../data/catalog.js';
import { esFavorito, alternarFavorito, store } from '../state.js';
import { dual } from '../engine/fx.js';
import { plazoCorto } from '../engine/envios.js';

/* ------------------------------------------------------------------
   La foto del producto.
   Mostramos SIEMPRE la imagen real de la tienda donde vas a comprar.
   Si esa tienda no nos dio foto, va un cuadro que dice "sin imagen":
   nunca un dibujito que aparente ser el producto, porque eso engaña.
   ------------------------------------------------------------------ */
export function foto(obj, clase = ''){
  const url = obj?.imagen || obj?.foto || null;
  const cont = el('div', { class:'foto ' + clase });
  if (url){
    const img = el('img', { src:url, alt:obj.titulo || obj.n || 'Producto', loading:'lazy', decoding:'async' });
    img.addEventListener('error', () => cont.replaceChildren(sinFoto()), { once:true });
    cont.append(img);
  } else {
    cont.append(sinFoto());
  }
  return cont;
}

const sinFoto = () => el('div', { class:'foto-vacia' }, ic('imagen'), el('span', {}, 'Sin imagen'));

/* ------------------------------------------------------------------
   Todo precio se muestra en las dos monedas. El comprador argentino
   piensa en pesos, pero cuando compara contra una tienda de afuera
   necesita ver el dólar para entender si le conviene.
   La moneda grande es la que el usuario eligió; la otra va abajo.
   ------------------------------------------------------------------ */
/** A dónde va el pedido. De esto dependen los plazos de entrega. */
export const destino = () => store.get('config')?.provincia || 'Buenos Aires';

export function precioDual(montoARS, opciones = {}){
  const { clase = 'price', color = '', internacional = false, nota = null } = opciones;
  const d = dual(montoARS);
  const pref = store.get('config')?.moneda || 'auto';

  /* Cómo se ordenan las dos monedas:
     · una tienda argentina piensa en pesos  → el peso va grande
     · una tienda del exterior piensa en dólares → el dólar va grande
     La otra moneda queda abajo, para poder comparar.
     Si el usuario fuerza una moneda, manda su elección. */
  const principal = pref === 'auto' ? (internacional ? 'USD' : 'ARS') : pref;

  const enUSD = 'US$ ' + d.usd.toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const grande = principal === 'USD' ? enUSD : plata(d.ars);
  const chica  = principal === 'USD' ? plata(d.ars) : enUSD;

  return el('div', { style:{ display:'flex', flexDirection:'column', alignItems:'inherit' } },
    el('span', { class:clase, style:{ color } }, grande),
    el('span', { class:'tiny dim mono', title:`Convertido al dólar tarjeta de hoy: $${d.tc}` }, chica,
      nota ? el('span', {}, ' · ' + nota) : null));
}

/** Botón para cambiar la moneda principal. */
export function selectorMoneda(alCambiar){
  const cfg = () => store.get('config') || {};
  const OPCIONES = [
    ['auto', 'Automático', 'Las argentinas en pesos y las del exterior en dólares. Abajo siempre la otra moneda.'],
    ['ARS',  '$ Pesos',    'Todo en pesos, con el dólar abajo.'],
    ['USD',  'US$ Dólares','Todo en dólares, con los pesos abajo.']
  ];
  const armar = () => {
    const act = cfg().moneda || 'auto';
    cont.replaceChildren(
      ...OPCIONES.map(([m, etiqueta, ayuda]) => el('button', {
        class:'chip' + (act === m ? ' on-win' : ''), title:ayuda,
        onclick:() => { store.set('config', { ...cfg(), moneda:m }); armar(); alCambiar?.(); }
      }, etiqueta)));
  };
  const cont = el('div', { class:'row', style:{ gap:'6px' } });
  armar();
  return cont;
}

/* ------------------------------------------------------------------
   Logo de cada tienda.
   Mostramos el ícono oficial que publica la propia tienda en su sitio
   (el mismo que ves en la pestaña del navegador), así se reconoce de
   un vistazo. Si no carga o es el genérico, queda el cuadro de color
   con las iniciales.
   ------------------------------------------------------------------ */
const DOMINIO_TIENDA = {
  meli:'mercadolibre.com.ar', coto:'cotodigital.com.ar', anonima:'laanonimaonline.com',
  jumbo:'jumbo.com.ar', carrefour:'carrefour.com.ar', easy:'easy.com.ar', sodimac:'sodimac.com.ar',
  fravega:'fravega.com', musimundo:'musimundo.com', compragamer:'compragamer.com',
  farmacity:'farmacity.com', dexter:'dexter.com.ar', tiendanube:'tiendanube.com',
  vea:'vea.com.ar', disco:'disco.com.ar', cetrogar:'cetrogar.com.ar', masonline:'masonline.com.ar',
  sportotal:'sportotal.com.ar', decathlon:'decathlon.com.ar', reebok:'reebok.com.ar',
  timberland:'timberland.com.ar', ansilta:'ansilta.com.ar', c47street:'47street.com.ar',
  mimo:'mimo.com.ar', topper:'topper.com.ar', portsaid:'portsaid.com.ar',
  desiderata:'desiderata.com.ar', tascani:'tascani.com.ar', legacy:'legacy.com.ar',
  sportline:'sportline.com.ar', cebra:'cebra.com.ar', juleriaque:'juleriaque.com.ar',
  puppis:'puppis.com.ar', cuspide:'cuspide.com',
  tiendamia:'tiendamia.com', amazon:'amazon.com', ebay:'ebay.com', aliexpress:'aliexpress.com', alibaba:'alibaba.com',
  '1688':'1688.com', temu:'temu.com', shein:'shein.com', walmart:'walmart.com',
  bestbuy:'bestbuy.com', etsy:'etsy.com', dhgate:'dhgate.com', tiktokshop:'tiktok.com',
  instagram:'instagram.com', fbmarket:'facebook.com', whatsapp:'whatsapp.com'
};

export function logoTienda(tiendaId, grande = false){
  const t = STORE_BY_ID[tiendaId];
  if (!t) return el('div', { class:'slogo', style:{ background:'#444' } }, '?');
  const iniciales = el('div', {
    class: 'slogo' + (grande ? ' slogo-lg' : ''),
    style: { background:t.color, color: esClaro(t.color) ? '#0a0a0a' : '#fff' },
    title: t.nombre
  }, t.abbr);

  const dominio = DOMINIO_TIENDA[tiendaId];
  if (!dominio) return iniciales;

  const img = el('img', { alt:t.nombre, loading:'lazy', decoding:'async', referrerpolicy:'no-referrer',
                          src:`https://www.google.com/s2/favicons?domain=${dominio}&sz=128` });
  const conLogo = el('div', { class:'slogo slogo-img' + (grande ? ' slogo-lg' : ''), title:t.nombre }, img);
  /* El servicio devuelve un globito de 16 px cuando la tienda no tiene
     ícono: eso no identifica a nadie, así que volvemos a las iniciales. */
  const volver = () => conLogo.replaceWith(iniciales);
  img.addEventListener('error', volver);
  img.addEventListener('load', () => { if (img.naturalWidth < 32) volver(); });
  return conLogo;
}

function esClaro(hex){
  const h = hex.replace('#','');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 > 140;
}

/** Distingue de un vistazo un precio real de uno simulado. */
export function selloOrigen(o){
  return o.demo === false
    ? el('span', { class:'tag tag-ok', title:'Precio consultado a la tienda en este momento' },
        el('i', { style:{ width:'5px', height:'5px', borderRadius:'50%', background:'currentColor', display:'inline-block' } }), 'En vivo')
    : el('span', { class:'tag', style:{ color:'var(--tx-3)' }, title:'Precio simulado: esta tienda todavía no está conectada' }, 'Demo');
}

export function tagTipo(tipo){
  const m = TIPO_META[tipo];
  return m ? el('span', { class:`tag ${m.tag}` }, m.label) : null;
}

export function barraProgreso(estado){
  const cont = el('div', { class:'probe' });
  for (const t of estado){
    cont.append(el('span', { class:`probe-item ${t.estado}` },
      el('i', { class:'pd' }),
      t.nombre,
      t.estado === 'done' ? el('b', { class:'mono' }, ` ${t.n}`) : null,
      t.estado === 'fail' ? el('b', {}, ' ✕') : null
    ));
  }
  return cont;
}

/** Tarjeta de producto agrupado, para grillas (home, rubros, radar). */
export function tarjetaGrupo(g, onClick){
  const m = g.mejor;
  const t = STORE_BY_ID[m.tiendaId];
  const fav = esFavorito(g.productoId);

  const card = el('article', { class:'offer' + (g.ahorroPct >= 25 ? ' is-win' : ''), onclick:() => onClick(g) },
    foto(g, 'offer-img'),
    el('div', {},
      el('div', { class:'offer-badges' },
        m.descuento ? el('span', { class:'saving' }, `-${m.descuento}%`) : null,
        m.propio ? el('span', { class:'tag tag-niju', style:{ background:'#0d0d12' } }, 'NiJu') : null
      ),
      el('button', {
        class:'iconbtn offer-fav', 'aria-label':'Guardar',
        style:{ width:'30px', height:'30px', flex:'0 0 30px' },
        onclick:e => { e.stopPropagation(); alternarFavorito(g.productoId); e.currentTarget.style.color = esFavorito(g.productoId) ? 'var(--win)' : ''; }
      }, ic('corazon'))
    ),
    el('div', { class:'offer-body' },
      el('div', { class:'row', style:{ gap:'6px' } }, tagTipo(t?.tipo), selloOrigen(m), el('span', { class:'tiny dim' }, t?.nombre || '')),
      el('h4', { class:'offer-title' }, g.titulo),
      el('div', {},
        m.precioLista ? el('div', { class:'tiny strike' }, plata(m.precioLista, m.moneda)) : null,
        precioDual(m.costo.finalARS, { clase:'price price-lg', internacional:m.costo.internacional }),
        el('div', { class:'tiny dim' }, m.costo.internacional ? 'final con impuestos y envío' : (m.envio ? 'sin envío' : 'envío gratis'))
      ),
      el('div', { class:'offer-foot' },
        el('span', { class:'offer-stores' }, `${g.tiendas} tienda${g.tiendas > 1 ? 's' : ''}`),
        el('span', { class:'spacer' }),
        g.ahorro > 0 ? el('span', { class:'tiny', style:{ color:'var(--win-tx)', fontWeight:'800' } }, `−${plata(g.ahorro)}`) : null
      )
    )
  );
  if (fav) card.querySelector('.offer-fav').style.color = 'var(--win)';
  return card;
}

/** Fila comparativa expandible: el componente estrella del buscador. */
export function filaCluster(g, { onVerFicha, abierto = false } = {}){
  const m = g.mejor;
  const t = STORE_BY_ID[m.tiendaId];

  const detalle = el('div', { class:'cluster-more', hidden:!abierto });
  g.ofertas.forEach((o, i) => detalle.append(lineaOferta(o, i === 0, onVerFicha)));

  const cont = el('article', { class:'cluster' + (abierto ? ' open' : '') });
  const cab = el('div', { class:'cluster-main', onclick:() => {
    detalle.hidden = !detalle.hidden;
    cont.classList.toggle('open', !detalle.hidden);
  }},
    foto(g, 'cluster-img'),
    el('div', { class:'cluster-info' },
      el('h3', { class:'cluster-title' }, g.titulo),
      el('div', { class:'cluster-meta' },
        el('span', { class:'tiny dim' },
          g.tiendas > 1 ? `${g.tiendas} tiendas comparadas` : 'Solo lo encontramos en una tienda'),
        tagTipo(t?.tipo),
        m.propio ? el('span', { class:'tag tag-niju' }, 'Stock propio') : null,
        g.ahorroPct > 0 ? el('span', { class:'saving' }, `Ahorrás ${plata(g.ahorro)}`) : null
      ),
      el('div', { class:'row', style:{ gap:'7px' } },
        logoTienda(m.tiendaId),
        el('div', {},
          el('div', { class:'tiny', style:{ fontWeight:'800' } }, `Más barato en ${t?.nombre || ''}`),
          el('div', { class:'tiny dim' }, 'Llega en ' + plazoCorto(m.entregaDias, destino(), m.costo?.internacional)))
      )
    ),
    el('div', { class:'cluster-price' },
      m.precioLista ? el('span', { class:'tiny strike' }, plata(m.precioLista, m.moneda)) : null,
      precioDual(m.costo.finalARS, { clase:'price price-xl', color:'var(--tx)', internacional:m.costo.internacional }),
      el('span', { class:'tiny dim' }, m.costo.internacional ? 'total puesto en tu casa' : 'precio total, no la cuota'),
      el('div', { class:'row', style:{ gap:'6px', marginTop:'6px' } },
        el('button', { class:'btn btn-sm btn-win', onclick:e => { e.stopPropagation(); onVerFicha?.(g); } }, 'Comparar'),
        el('span', { class:'chip tiny' }, 'Ver ', String(g.ofertas.length), ic('flecha', 'ic cluster-arrow'))
      )
    )
  );
  cont.append(cab, detalle);
  return cont;
}

function lineaOferta(o, mejor, onVerFicha){
  const t = STORE_BY_ID[o.tiendaId];
  const c = o.costo;
  return el('div', { class:'offer-line' + (mejor ? ' best' : '') },
    logoTienda(o.tiendaId),
    el('div', { class:'ol-store' },
      el('div', { class:'row', style:{ gap:'6px' } },
        el('b', { style:{ fontSize:'13.5px' } }, t?.nombre || o.tiendaId),
        selloOrigen(o),
        mejor ? el('span', { class:'tag tag-win' }, 'Mejor precio') : null,
        c.bloqueado ? el('span', { class:'tag tag-bad' }, 'Excede courier') : null
      ),
      el('div', { class:'tiny dim' },
        `${o.vendedor} · ${estrellas(o.reputacion)} ${o.reputacion}`,
        o.vendidos ? ` · ${num(o.vendidos)} vendidos` : '',
        ' · ' + plazoCorto(o.entregaDias, destino(), c.internacional))
    ),
    el('div', { class:'ol-nums' },
      precioDual(c.finalARS, { clase:'price', color: mejor ? 'var(--win-tx)' : '',
                               internacional:c.internacional }),
      /* La composición solo se explica cuando el final difiere del precio
         de la tienda. Repetir el mismo número dos veces confunde. */
      (c.envioARS || c.impuestosARS)
        ? el('div', { class:'tiny dim mono' },
            `producto ${plata(o.precio, o.moneda)}${c.envioARS ? ' + envío' : ''}${c.impuestosARS ? ' + impuestos' : ''}`)
        : null
    ),
    el('button', { class:'btn btn-sm ' + (mejor ? 'btn-win' : ''), onclick:e => { e.stopPropagation(); onVerFicha?.(o); } }, 'Ir')
  );
}

export function seccion(titulo, extra, contenido){
  return el('section', { class:'section' },
    el('div', { class:'section-head' },
      el('div', {}, el('div', { class:'kicker' }, extra?.kicker || ''), el('h2', {}, titulo)),
      extra?.accion || null),
    contenido);
}

export function vacio(msg, sub){
  return el('div', { class:'card center', style:{ padding:'48px 20px' } },
    el('div', { style:{ fontSize:'42px', marginBottom:'10px' } }, '🔍'),
    el('h3', {}, msg),
    sub ? el('p', { class:'muted tiny', style:{ marginTop:'6px' } }, sub) : null);
}

export function esqueleto(n = 8){
  const g = el('div', { class:'grid g-auto' });
  for (let i = 0; i < n; i++){
    g.append(el('div', { class:'offer' },
      el('div', { class:'sk', style:{ aspectRatio:'1/1' } }),
      el('div', { class:'offer-body' },
        el('div', { class:'sk', style:{ height:'11px', width:'55%' } }),
        el('div', { class:'sk', style:{ height:'11px' } }),
        el('div', { class:'sk', style:{ height:'20px', width:'62%' } }))));
  }
  return g;
}

export const rubroEmo = id => RUBRO_BY_ID[id]?.emo || '📦';
export const rubroNom = id => RUBRO_BY_ID[id]?.nombre || id;
