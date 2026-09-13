/* ============================================================
   NiJu — Vitrina de productos
   Las piezas que comparten los resultados y la vista de tienda,
   con el lenguaje de los marketplaces grandes: tarjeta con foto
   que se agranda, favorito que late, vista rápida, precios de
   todas las tiendas desplegables dentro de la tarjeta y carga
   infinita al llegar abajo.
   ============================================================ */
import { el, plata, num, ic, hoja } from '../util.js';
import { STORE_BY_ID } from '../data/stores.js';
import { esFavorito, alternarFavorito } from '../state.js';
import { plazoCorto } from '../engine/envios.js';
import { foto, logoTienda, precioDual, destino } from './components.js';

/** Descuento publicado por la tienda. Solo vale si el precio de lista
    realmente es mayor que el precio: si no, no hay rebaja que mostrar. */
export function descuentoDe(o){
  if (!o?.precioLista || !(o.precioLista > o.precio)) return 0;
  return o.descuento || Math.round((1 - o.precio / o.precioLista) * 100);
}

/** Tarjeta de producto para la grilla. */
export function tarjetaResultado(g, { abrir }){
  const m = g.mejor;
  const t = STORE_BY_ID[m.tiendaId];
  const d = descuentoDe(m);
  const internacional = m.costo?.internacional;

  /* Los productos de tiendas conectadas no tienen id nuestro: el
     favorito se guarda con la clave del grupo. */
  const favId = g.productoId || g.clave;
  const fav = el('button', {
    class:'v-fav' + (esFavorito(favId) ? ' on' : ''), 'aria-label':'Guardar en favoritos',
    onclick:e => {
      e.stopPropagation();
      alternarFavorito(favId);
      fav.classList.toggle('on', esFavorito(favId));
      fav.classList.remove('pop'); void fav.offsetWidth; fav.classList.add('pop');
    }
  }, ic('corazon'));

  /* Los precios de las otras tiendas se despliegan dentro de la tarjeta,
     sin salir de la lista. Se arman recién la primera vez que se abren. */
  const precios = el('div', { class:'v-precios', hidden:true });
  const comparar = g.tiendas > 1 ? el('button', {
    class:'v-comparar', 'aria-expanded':'false',
    onclick:e => {
      e.stopPropagation();
      const mostrar = precios.hidden;
      if (mostrar && !precios.childElementCount){
        precios.append(...filasPrecios(g, () => abrir(g), 4),
          ...(g.ofertas.length > 4 ? [el('button', { class:'v-ver-todo', onclick:ev => { ev.stopPropagation(); abrir(g); } },
            `Ver las ${g.ofertas.length} ofertas`)] : []));
      }
      precios.hidden = !mostrar;
      comparar.setAttribute('aria-expanded', String(mostrar));
    }
  }, pilaLogos(g), el('span', {}, `${g.tiendas} tiendas`),
     g.ahorro > 0 ? el('b', {}, `ahorrás ${plata(g.ahorro)}`) : null,
     ic('flecha', 'ic v-comparar-fl')) : null;

  return el('article', {
    class:'v-card', tabindex:'0',
    onclick:() => abrir(g),
    onkeydown:e => { if (e.key === 'Enter' && e.target === e.currentTarget) abrir(g); }
  },
    el('div', { class:'v-card-media' },
      foto(g, 'v-card-foto'),
      el('div', { class:'v-badges' },
        m.propio ? el('span', { class:'v-badge niju' }, 'NiJu Directo') : null,
        d >= 40 ? el('span', { class:'v-badge' }, 'Súper oferta') : null),
      fav,
      el('button', { class:'v-rapida', onclick:e => { e.stopPropagation(); vistaRapida(g, abrir); } },
        ic('buscar'), 'Vista rápida')),
    el('div', { class:'v-card-body' },
      el('div', { class:'v-card-tienda' }, logoTienda(m.tiendaId), el('span', {}, t?.nombre || '')),
      el('h3', { class:'v-card-tit' }, g.titulo),
      d ? el('div', { class:'v-tachado' }, plata(m.precioLista, m.moneda)) : null,
      el('div', { class:'v-fila' },
        precioDual(m.costo.finalARS, { clase:'v-precio', internacional }),
        d ? el('span', { class:'v-off' }, `${d}% OFF`) : null),
      lineaEnvio(m),
      comparar,
      precios));
}

function lineaEnvio(m){
  const internacional = m.costo?.internacional;
  return !internacional && !m.envio
    ? el('div', { class:'v-envio' }, 'Envío gratis')
    : el('div', { class:'v-llega' }, 'Llega en ' + plazoCorto(m.entregaDias, destino(), internacional));
}

function pilaLogos(g){
  const ids = [...new Set(g.ofertas.map(o => o.tiendaId))].slice(0, 3);
  return el('span', { class:'v-pila' }, ...ids.map(id => logoTienda(id)));
}

function filasPrecios(g, alElegir, max = 5){
  return g.ofertas.slice(0, max).map((o, i) => el('button', {
    class:'v-precio-fila' + (i === 0 ? ' mejor' : ''),
    onclick:e => { e.stopPropagation(); alElegir(o); }
  }, logoTienda(o.tiendaId),
     el('span', {}, STORE_BY_ID[o.tiendaId]?.nombre || o.tiendaId),
     i === 0 ? el('em', {}, 'Mejor') : null,
     el('b', {}, plata(o.costo.finalARS))));
}

/** Vista rápida: foto grande, precio y todas las tiendas, sin salir
    de la lista. */
function vistaRapida(g, abrir){
  const m = g.mejor;
  const t = STORE_BY_ID[m.tiendaId];
  const d = descuentoDe(m);
  let ventana = null;
  const irAFicha = () => { ventana?.cerrar(); abrir(g); };
  const cuerpo = el('div', { class:'v-rapida-cuerpo' },
    foto(g, 'v-rapida-foto'),
    el('div', { class:'v-rapida-info' },
      el('div', { class:'v-card-tienda' }, logoTienda(m.tiendaId), el('span', {}, t?.nombre || '')),
      el('h3', {}, g.titulo),
      d ? el('div', { class:'v-tachado' }, plata(m.precioLista, m.moneda)) : null,
      el('div', { class:'v-fila' },
        precioDual(m.costo.finalARS, { clase:'v-precio', internacional:m.costo?.internacional }),
        d ? el('span', { class:'v-off' }, `${d}% OFF`) : null),
      lineaEnvio(m),
      g.tiendas > 1 ? el('div', { class:'v-precios' },
        el('small', { class:'v-precios-tit' }, `Precio final en ${g.tiendas} tiendas`),
        ...filasPrecios(g, irAFicha)) : null,
      el('button', { class:'btn btn-win btn-lg btn-block', onclick:irAFicha }, ic('carrito'), 'Ver ficha y comprar'),
      m.url ? el('button', { class:'btn btn-block', onclick:() => window.open(m.url, '_blank', 'noopener') },
        ic('mundo'), 'Ver en ' + (t?.nombre || 'la tienda')) : null));
  ventana = hoja({ titulo:'Vista rápida', ancho:780, cuerpo });
}

export function esqueletoGrilla(n = 8){
  return el('div', { class:'v-grilla' }, ...Array.from({ length:n }, () =>
    el('div', { class:'v-card v-card-sk' },
      el('div', { class:'v-card-media v-sk' }),
      el('div', { class:'v-card-body' },
        el('div', { class:'v-sk', style:{ height:'10px', width:'40%' } }),
        el('div', { class:'v-sk', style:{ height:'13px', marginTop:'6px' } }),
        el('div', { class:'v-sk', style:{ height:'13px', width:'75%' } }),
        el('div', { class:'v-sk', style:{ height:'24px', width:'55%', marginTop:'8px' } })))));
}

/** Carga infinita: un marcador al pie de la lista que pide la página
    siguiente cuando se acerca a la pantalla. */
export function cargaInfinita(alVer){
  const nodo = el('div', { class:'v-infinita', hidden:true });
  let modo = 'oculto';
  const cerca = () => nodo.isConnected && !nodo.hidden && nodo.getBoundingClientRect().top < innerHeight + 700;
  new IntersectionObserver(entradas => {
    if (modo === 'espera' && entradas.some(e => e.isIntersecting)) alVer();
  }, { rootMargin:'0px 0px 700px 0px' }).observe(nodo);

  function estado(m, total = 0){
    modo = m;
    nodo.hidden = m === 'oculto';
    nodo.replaceChildren(...(
      m === 'buscando' ? [el('i', { class:'v-rueda' }), 'Buscando más productos…'] :
      m === 'espera'   ? [el('i', { class:'v-rueda' })] :
      m === 'fin'      ? [`Llegaste al final · ${num(total)} productos comparados`] : []));
    /* Si la lista es corta, el marcador ya está a la vista y el
       observador no vuelve a avisar: lo pedimos a mano. */
    if (m === 'espera') requestAnimationFrame(() => { if (modo === 'espera' && cerca()) alVer(); });
  }
  return { nodo, estado };
}

const CLAVE_VISTA = 'niju.vistaResultados';
export function vistaGuardada(){
  try{ return localStorage.getItem(CLAVE_VISTA) === 'lista' ? 'lista' : 'grilla'; }catch{ return 'grilla'; }
}

/** Cuadrícula (como Mercado Libre) o lista comparativa (la fila de NiJu
    que despliega todas las tiendas). Se recuerda la elección. */
export function selectorVista(actual, alCambiar){
  const cont = el('div', { class:'v-vista', role:'group', 'aria-label':'Cómo ver los productos' });
  const boton = (v, icono, titulo) => el('button', {
    class:actual === v ? 'on' : '', title:titulo, 'aria-label':titulo, 'aria-pressed':String(actual === v), data:{ v },
    onclick:() => {
      if (actual === v) return;
      actual = v;
      try{ localStorage.setItem(CLAVE_VISTA, v); }catch{}
      cont.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', b.dataset.v === v);
        b.setAttribute('aria-pressed', String(b.dataset.v === v));
      });
      alCambiar(v);
    }
  }, ic(icono));
  cont.append(boton('grilla', 'panel', 'Ver en cuadrícula'), boton('lista', 'menu', 'Ver en lista comparativa'));
  return cont;
}
