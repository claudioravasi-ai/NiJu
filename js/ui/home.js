/* ============================================================
   NiJu — Portada
   Arma la vidriera como un marketplace grande (Mercado Libre,
   Amazon): banner giratorio, atajos montados encima, ofertas en
   carrusel, tarjetas de a cuatro fotos por rubro y categorías en
   círculos. Corta a propósito: las tiendas se recorren desde el
   menú de la izquierda (Comprar por tienda), no desde acá.
   Todo lo que se ve sale de las tiendas en vivo: fotos, precios
   tachados y porcentajes de descuento los publica cada tienda.
   Si una tienda no responde, esa parte no aparece; nunca se
   rellena con productos inventados.
   ============================================================ */
import { el, plata, ic } from '../util.js';
import { RUBROS } from '../data/catalog.js';
import { STORE_BY_ID } from '../data/stores.js';
import { tiendasActivas } from '../connectors/registry.js';
import { buscar } from '../engine/search.js';
import { FX } from '../engine/fx.js';
import { foto, logoTienda, precioDual, destino } from './components.js';

/* Qué se sale a buscar para llenar la vidriera. Una palabra por rubro
   y solo en las tiendas de ese rubro: preguntar "perfume" a una
   ferretería es gastar una consulta. */
const VIDRIERA = [
  { rubro:'electro',  q:'freidora de aire', titulo:'Cocina y electro' },
  { rubro:'moda',     q:'zapatillas',       titulo:'Zapatillas' },
  { rubro:'belleza',  q:'perfume',          titulo:'Perfumes y belleza' },
  { rubro:'hogar',    q:'sillon',           titulo:'Para tu casa' }
];

export function vistaHome(ir){
  const raiz = el('div', { class:'portada' });

  const activas = tiendasActivas().filter(t => t.tipo !== 'propio');
  const nTiendas = activas.length;

  /* ---------- 1. Banner giratorio ---------- */
  const fotosOferta = el('div', { class:'p-slide-fotos' }, ...[0,1,2].map(() => el('div', { class:'p-slide-foto sk' })));
  const tituloOferta = el('h2', {}, 'Ofertas de verdad, en ', String(nTiendas), ' tiendas a la vez');
  const bajadaOferta = el('p', {}, 'Buscás una vez y te mostramos dónde sale más barato, con el precio final puesto en tu casa.');

  const slides = [
    slide('p-s-ofertas', 'Comparado en vivo', tituloOferta, bajadaOferta,
      el('button', { class:'p-cta', onclick:() => ofertasSec.scrollIntoView({ behavior:'smooth', block:'start' }) }, 'Ver ofertas', ic('der')),
      fotosOferta),
    slide('p-s-traelo', 'Traelo por mí', el('h2', {}, '¿Lo viste en otra tienda del mundo?'),
      el('p', {}, 'Pegá el link y te lo traemos: compra, envío, aduana y entrega. Vos pagás en pesos.'),
      el('button', { class:'p-cta', onclick:() => ir('#/pedido') }, 'Pegar un link', ic('der')),
      el('div', { class:'p-slide-logos' },
        ...['tiendamia','amazon','shein','aliexpress','ebay','walmart'].filter(id => STORE_BY_ID[id]).map(id => logoTienda(id, true)))),
    slide('p-s-final', 'Sin sorpresas', el('h2', {}, 'El precio que ves es el que pagás'),
      el('p', {}, 'Producto, envío, impuestos y gestión sumados antes de comprar. Si te conviene comprar directo, te lo decimos.'),
      el('button', { class:'p-cta', onclick:() => ir('#/impuestos') }, 'Cómo lo calculamos', ic('der')),
      el('div', { class:'p-slide-cuenta' },
        ...['Producto','Envío','Impuestos','Gestión'].map(t => el('div', {}, ic('check'), t)),
        el('div', { class:'p-slide-total' }, 'Precio final'))),
    slide('p-s-grupal', 'Compra grupal', el('h2', {}, 'Cuantos más se suman, más barato sale'),
      el('p', {}, 'Juntamos a los que quieren lo mismo y compramos por cantidad. El precio baja para todos.'),
      el('button', { class:'p-cta', onclick:() => ir('#/grupal') }, 'Ver compras grupales', ic('der')),
      el('div', { class:'p-slide-escalera' }, ...[38, 56, 74, 92].map((h, i) => el('i', { style:{ height:h + '%', animationDelay:(i * .12) + 's' } }))))
  ];
  const banner = carruselBanner(slides);

  /* ---------- 2. Atajos montados sobre el banner ---------- */
  const atajos = el('div', { class:'p-atajos' },
    atajo('mundo', `${nTiendas} tiendas en vivo`, 'Buscás una vez y comparamos todas',
      'Recorrer una tienda', () => window.dispatchEvent(new CustomEvent('niju:tiendas'))),
    atajo('etiqueta', `Dólar tarjeta ${plata(FX.tarjeta)}`, FX.origen === 'vivo' ? 'Cotización en vivo, cada 5 minutos' : 'Última cotización disponible',
      'Ver impuestos', () => ir('#/impuestos')),
    atajo('envio', `Envío a ${destino()}`, 'Plazos según tu destino, no promedios',
      'Cambiar destino', () => ir('#/cuenta')),
    atajo('caja', 'Un solo pago', 'Varias tiendas en un carrito: compramos por vos',
      'Ir al carrito', () => ir('#/carrito')));

  raiz.append(el('div', { class:'p-top' }, el('div', { class:'wrap' }, banner, atajos)));

  /* ---------- 3. Ofertas del día ---------- */
  const pistaOfertas = el('div', { class:'p-pista' }, ...Array.from({ length:6 }, esqueletoProd));
  const ofertasSec = bloque('Ofertas del día', 'Descuentos publicados por cada tienda, ahora',
    null, carrusel(pistaOfertas));
  raiz.append(el('div', { class:'wrap' }, ofertasSec));

  /* ---------- 4. Tarjetas por rubro, de a cuatro fotos ---------- */
  const tarjetasRubro = VIDRIERA.map(v => {
    const cuerpo = el('div', { class:'p-cuatro' }, ...[0,1,2,3].map(() => el('div', { class:'p-cuatro-item' }, el('div', { class:'sk p-cuatro-foto' }), el('div', { class:'sk', style:{ height:'10px', width:'70%' } }))));
    const card = el('article', { class:'p-rubro-card' },
      el('h3', {}, v.titulo),
      cuerpo,
      el('button', { class:'p-link', onclick:() => ir(`#/buscar?q=${encodeURIComponent(v.q)}`) }, 'Ver más', ic('der')));
    return { v, card, cuerpo };
  });
  raiz.append(el('div', { class:'wrap' }, el('div', { class:'p-rubros-cards' }, ...tarjetasRubro.map(t => t.card))));

  /* ---------- 5. Categorías en círculos ---------- */
  const conTiendas = RUBROS.map(r => ({ r, n:tiendasActivas({ rubro:r.id }).filter(t => t.tipo !== 'propio').length }))
    .sort((a, b) => (b.n > 0) - (a.n > 0));
  raiz.append(el('div', { class:'wrap' }, bloque('Categorías', null, null,
    carrusel(el('div', { class:'p-pista p-pista-cat' }, ...conTiendas.map(({ r, n }) =>
      /* El color va como texto: Object.assign sobre style no graba variables CSS. */
      el('button', { class:'p-cat', style:`--rc:${r.color}`, onclick:() => ir(`#/buscar?rubro=${r.id}`) },
        el('span', { class:'p-cat-ic' }, r.emo),
        el('b', {}, r.nombre),
        el('small', {}, n ? `${n} ${n === 1 ? 'tienda' : 'tiendas'}` : 'a pedido'))))))));

  /* ---------- Carga en vivo ---------- */
  cargarVidriera(ir, { pistaOfertas, ofertasSec, tarjetasRubro, fotosOferta, tituloOferta, bajadaOferta });

  return raiz;
}

/* ------------------------------------------------------------------
   Datos en vivo
   ------------------------------------------------------------------ */
async function cargarVidriera(ir, ui){
  const abrir = g => ir(`#/producto/${encodeURIComponent(g.productoId || g.titulo)}`);
  const resultados = await Promise.all(VIDRIERA.map(v =>
    buscar(v.q, { rubro:v.rubro, limite:12 }).then(r => r.grupos || []).catch(() => [])));

  /* Tarjetas de a cuatro: lo que tenga foto, primero lo más rebajado. */
  resultados.forEach((grupos, i) => {
    const { card, cuerpo } = ui.tarjetasRubro[i];
    const conFoto = grupos.filter(g => g.imagen).sort((a, b) => descuento(b) - descuento(a)).slice(0, 4);
    if (!conFoto.length){ card.remove(); return; }
    cuerpo.replaceChildren(...conFoto.map(g => el('button', { class:'p-cuatro-item', onclick:() => abrir(g) },
      foto(g, 'p-cuatro-foto'),
      el('span', {}, descuento(g) ? el('b', {}, `${descuento(g)}% OFF`) : plata(g.mejor.costo.finalARS)))));
  });

  /* Ofertas del día: descuentos que la tienda publica (precio de lista
     mayor al precio), sin repetir producto. */
  const vistos = new Set();
  const ofertas = resultados.flat()
    .filter(g => g.imagen && descuento(g) >= 10)
    .sort((a, b) => descuento(b) - descuento(a))
    .filter(g => !vistos.has(g.clave) && vistos.add(g.clave))
    .slice(0, 18);

  if (!ofertas.length){
    ui.ofertasSec.remove();
    ui.bajadaOferta.textContent = 'Buscá lo que quieras arriba y te mostramos dónde sale más barato.';
    ui.fotosOferta.remove();
    return;
  }
  ui.pistaOfertas.replaceChildren(...ofertas.map(g => tarjetaProd(g, abrir)));

  const tope = descuento(ofertas[0]);
  const nombres = [...new Set(ofertas.map(g => STORE_BY_ID[g.mejor.tiendaId]?.nombre).filter(Boolean))];
  ui.tituloOferta.replaceChildren('Hasta ', el('span', { class:'p-resalte' }, `${tope}% OFF`), ' hoy');
  ui.bajadaOferta.textContent = nombres.length > 2
    ? `En ${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} tiendas más, comparadas en vivo.`
    : `En ${nombres.join(' y ')}, comparado en vivo.`;
  ui.fotosOferta.replaceChildren(...ofertas.slice(0, 3).map(g =>
    el('button', { class:'p-slide-foto', onclick:e => { e.stopPropagation(); abrir(g); } },
      foto(g, 'p-slide-img'), el('span', { class:'p-slide-off' }, `-${descuento(g)}%`))));
}

/** Descuento publicado por la tienda. Solo vale si el precio de lista
    realmente es mayor que el precio: si no, no hay rebaja que mostrar. */
function descuento(g){
  const m = g.mejor;
  if (!m?.precioLista || !(m.precioLista > m.precio)) return 0;
  return m.descuento || Math.round((1 - m.precio / m.precioLista) * 100);
}

/* ------------------------------------------------------------------
   Piezas
   ------------------------------------------------------------------ */
function tarjetaProd(g, abrir){
  const m = g.mejor;
  const t = STORE_BY_ID[m.tiendaId];
  const d = descuento(g);
  const internacional = m.costo?.internacional;
  return el('article', { class:'p-prod', onclick:() => abrir(g) },
    foto(g, 'p-prod-foto'),
    el('div', { class:'p-prod-body' },
      el('div', { class:'p-prod-tienda' }, logoTienda(m.tiendaId), t?.nombre || ''),
      el('h4', { class:'p-prod-tit' }, g.titulo),
      d ? el('div', { class:'p-tachado' }, plata(m.precioLista, m.moneda)) : null,
      el('div', { class:'p-prod-fila' },
        precioDual(m.costo.finalARS, { clase:'p-prod-precio', internacional }),
        d ? el('span', { class:'p-off' }, `${d}% OFF`) : null),
      !internacional && !m.envio ? el('div', { class:'p-envio' }, 'Envío gratis') : null,
      g.tiendas > 1 ? el('div', { class:'p-comparado' }, `Comparado en ${g.tiendas} tiendas`) : null));
}

function esqueletoProd(){
  return el('div', { class:'p-prod' },
    el('div', { class:'sk p-prod-foto' }),
    el('div', { class:'p-prod-body' },
      el('div', { class:'sk', style:{ height:'10px', width:'45%' } }),
      el('div', { class:'sk', style:{ height:'12px' } }),
      el('div', { class:'sk', style:{ height:'22px', width:'60%' } })));
}

function slide(clase, kicker, titulo, bajada, cta, visual){
  return el('div', { class:'p-slide ' + clase },
    el('div', { class:'p-slide-txt' }, el('span', { class:'p-slide-kicker' }, kicker), titulo, bajada, cta),
    el('div', { class:'p-slide-visual' }, visual));
}

/** Banner que gira solo cada 6 segundos, se frena con el mouse encima
    y se maneja con flechas, puntos o deslizando el dedo. */
function carruselBanner(slides){
  const pista = el('div', { class:'p-banner-pista' }, ...slides);
  const puntos = el('div', { class:'p-banner-puntos' });
  const banner = el('section', { class:'p-banner', 'aria-roledescription':'carrusel' },
    pista,
    el('button', { class:'p-banner-flecha izq', 'aria-label':'Anterior', onclick:() => ir(i - 1) }, ic('izq')),
    el('button', { class:'p-banner-flecha der', 'aria-label':'Siguiente', onclick:() => ir(i + 1) }, ic('der')),
    puntos);
  let i = 0;
  const botones = slides.map((_, k) => el('button', { 'aria-label':`Ir al anuncio ${k + 1}`, onclick:() => ir(k) }));
  puntos.append(...botones);
  function ir(k){
    i = (k + slides.length) % slides.length;
    pista.style.transform = `translateX(-${i * 100}%)`;
    botones.forEach((b, n) => b.classList.toggle('on', n === i));
    slides.forEach((s, n) => s.setAttribute('aria-hidden', String(n !== i)));
  }
  ir(0);

  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pausa = false;
  const reloj = setInterval(() => {
    if (!banner.isConnected){ clearInterval(reloj); return; }   // se fue de la portada
    if (!pausa && !quieto && !document.hidden) ir(i + 1);
  }, 6000);
  banner.addEventListener('mouseenter', () => pausa = true);
  banner.addEventListener('mouseleave', () => pausa = false);

  let x0 = null;
  banner.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; pausa = true; }, { passive:true });
  banner.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - (x0 ?? 0);
    if (Math.abs(dx) > 40) ir(i + (dx < 0 ? 1 : -1));
    x0 = null; pausa = false;
  });
  return banner;
}

/** Fila que se desliza de costado, con flechas en la computadora. */
function carrusel(pista){
  const mover = s => pista.scrollBy({ left:s * pista.clientWidth * .85, behavior:'smooth' });
  const izq = el('button', { class:'p-flecha izq', 'aria-label':'Anterior', onclick:() => mover(-1) }, ic('izq'));
  const der = el('button', { class:'p-flecha der', 'aria-label':'Siguiente', onclick:() => mover(1) }, ic('der'));
  const cont = el('div', { class:'p-carrusel' }, pista, izq, der);
  const revisar = () => {
    izq.hidden = pista.scrollLeft < 8;
    der.hidden = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 8;
  };
  pista.addEventListener('scroll', revisar, { passive:true });
  new ResizeObserver(revisar).observe(pista);
  new MutationObserver(revisar).observe(pista, { childList:true });
  return cont;
}

function bloque(titulo, kicker, accion, contenido){
  return el('section', { class:'p-bloque' },
    el('div', { class:'p-bloque-head' },
      el('h2', {}, titulo),
      kicker ? el('span', { class:'p-bloque-kicker' }, kicker) : null,
      el('span', { class:'spacer' }),
      accion),
    contenido);
}

function atajo(icono, titulo, texto, accion, onClick){
  return el('button', { class:'p-atajo', onclick:onClick },
    el('span', { class:'p-atajo-ic' }, ic(icono)),
    el('b', {}, titulo),
    el('span', { class:'p-atajo-tx' }, texto),
    el('span', { class:'p-atajo-link' }, accion));
}
