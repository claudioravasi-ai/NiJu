/* ============================================================
   NiJu — Arranque y ruteo
   ============================================================ */
import { $, el, ic, toast, debounce, num } from './util.js';
import { CONFIG } from './config.js';
import { store, totalItems, registrarBusqueda } from './state.js';
import { cargarCotizaciones, iniciarRefrescoFX, alCambiarFX, FX } from './engine/fx.js';

import { vistaHome } from './ui/home.js';
import { vistaResultados } from './ui/resultados.js';
import { vistaProducto } from './ui/producto.js';
import { vistaImpuestos } from './ui/impuestos.js';
import { vistaMayorista } from './ui/mayorista.js';
import { vistaPedido } from './ui/pedido.js';
import { vistaGrupal } from './ui/grupal.js';
import { vistaDemanda } from './ui/demanda.js';
import { vistaTienda } from './ui/tienda.js';
import { esDueno, entrar, salir, verificarClave } from './engine/sesion.js';
import { vistaCarrito } from './ui/carrito.js';
import { vistaCuenta } from './ui/cuenta.js';
import { vistaPanel } from './ui/panel.js';
import { vistaMensajes } from './ui/mensajes.js';
import { vistaTiendas } from './ui/tiendas.js';
import { vistaMisCompras } from './ui/ordenes.js';
import { modo, hayCuenta, refrescarPerfil } from './engine/nube.js';
import { listarOrdenes } from './engine/ordenes.js';

const NAV = [
  { ruta:'#/',          icono:'casa',     label:'Inicio' },
  { ruta:'#/buscar',    icono:'buscar',   label:'Buscar' },
  { ruta:'#/pedido',    icono:'envio',    label:'Traelo por mí' },
  { ruta:'#/impuestos', icono:'calc',     label:'Impuestos' },
  { ruta:'#/demanda',   icono:'megafono', label:'Pedí y que compitan' },
  { ruta:'#/grupal',    icono:'usuario',  label:'Compra grupal' },
  { ruta:'#/mayorista', icono:'caja',     label:'Por mayor' },
  { ruta:'#/mensajes',  icono:'chat',     label:'Mensajes' },
  { ruta:'#/carrito',   icono:'carrito',  label:'Carrito' },
  { ruta:'#/compras',   icono:'caja',     label:'Mis compras' },
  { ruta:'#/cuenta',    icono:'usuario',  label:'Mi cuenta' },
  { ruta:'#/tiendas',   icono:'mundo',    label:'Conectores', privado:true },
  { ruta:'#/panel',     icono:'panel',    label:'Panel',      privado:true }
];

const TABBAR = ['#/', '#/buscar', '#/pedido', '#/carrito', '#/cuenta'];

const ir = ruta => { location.hash = ruta; };


/* ------------------------------------------------------------------
   Identidad: un emblema y la palabra NiJu al lado.
   El emblema es una bolsa de compras con un tilde (lo compramos por
   vos) y un punto verde (ya llega). Va en vector, así se ve nítido a
   cualquier tamaño y en modo día y noche. Reemplazó al isotipo del pez:
   a 30 píxeles no se reconocía.
   ------------------------------------------------------------------ */
const EMBLEMA_SVG = `<svg viewBox="0 0 48 48" aria-hidden="true">
  <rect width="48" height="48" rx="13" fill="#3483fa"/>
  <path d="M19 19.5v-3.2a5 5 0 0 1 10 0v3.2" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M13.5 19h21l-1.7 17.6a3 3 0 0 1-3 2.7H18.2a3 3 0 0 1-3-2.7Z" fill="#fff"/>
  <path d="M19.3 29.4l3.2 3.2 6.2-6.6" fill="none" stroke="#3483fa" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="37.5" cy="11" r="6.2" fill="#00a650" stroke="#fff" stroke-width="2.6"/>
</svg>`;

function logoNiju(clase){
  return el('span', { class:'marca ' + clase, role:'img', 'aria-label':'NiJu' },
    el('span', { class:'emblema', html:EMBLEMA_SVG }),
    el('span', { class:'marca-texto' }, 'Ni', el('b', {}, 'Ju')));
}

/* ------------------------------------------------------------------
   Modo día / noche. Si el usuario nunca eligió, manda el sistema.
   ------------------------------------------------------------------ */
const TEMA_KEY = 'niju.tema';

function temaGuardado(){
  try{ return localStorage.getItem(TEMA_KEY); }catch{ return null; }
}

function aplicarTema(t){
  const raiz = document.documentElement;
  if (t === 'auto'){ delete raiz.dataset.theme; try{ localStorage.removeItem(TEMA_KEY); }catch{} }
  else { raiz.dataset.theme = t; try{ localStorage.setItem(TEMA_KEY, t); }catch{} }
  const oscuro = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#08080d' : '#fbfaf6');
  document.querySelectorAll('[data-tema]').forEach(b => {
    b.replaceChildren(ic(oscuro ? 'sol' : 'luna'));
    b.title = oscuro ? 'Pasar a modo día' : 'Pasar a modo noche';
    b.setAttribute('aria-label', b.title);
  });
}

function temaActual(){
  return document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function botonTema(){
  const b = el('button', { class:'iconbtn', data:{ tema:'1' }, onclick:() => {
    aplicarTema(temaActual() === 'dark' ? 'light' : 'dark');
  }});
  return b;
}

let abrirMenu = () => {}, cerrarMenu = () => {};
const CLAVE_MENU_FIJO = 'niju.menuFijo';
const ANCHO_ESCRITORIO = matchMedia('(min-width: 901px)');

function construirShell(){
  /* Chinche para dejar el menú fijo al costado. Va adentro del menú
     porque al abrirse tapa la hamburguesa de la cabecera. */
  const fijar = el('button', { class:'iconbtn btn-fijar', title:'Fijar menú', 'aria-label':'Fijar menú',
                               'aria-pressed':'false', onclick:() => fijarMenu(!menuFijo()) }, ic('pin'));
  const rail = el('aside', { class:'rail' },
    el('div', { class:'rail-head' },
      el('a', { class:'brand brand-full', href:'#/', 'aria-label':'NiJu — inicio',
                onclick:contarToques },
        logoNiju('logo-rail'),
        el('div', { class:'brand-sub' }, 'compra todo, de todo y para todo')),
      fijar),
    ...NAV.filter(n => !n.privado || esDueno()).map(n => el('button', { class:'nav-item', data:{ ruta:n.ruta }, onclick:() => { cerrarMenu(); ir(n.ruta); } },
      ic(n.icono), el('span', { class:'spacer' }, n.label),
      n.ruta === '#/carrito' ? el('span', { class:'tiny mono', data:{ badge:'carrito' } }, '') : null)),
    el('div', { class:'rail-foot' },
      el('div', { data:{ fx:'1' } }, ''),
      el('div', { style:{ marginTop:'6px' } }, `v${CONFIG.version} · modo ${CONFIG.modoDatos}`)));

  const buscador = el('input', { type:'search', placeholder:'Buscar en todas las tiendas…', 'aria-label':'Buscar' });
  buscador.addEventListener('keydown', e => {
    if (e.key === 'Enter' && buscador.value.trim()){
      registrarBusqueda(buscador.value.trim());
      ir(`#/buscar?q=${encodeURIComponent(buscador.value.trim())}`);
    }
  });

  /* Hamburguesa: con el mouse encima se abre el menú; mientras el mouse
     esté sobre ella o sobre el menú, sigue abierto. Al tocarla (celular,
     tablet) abre y cierra. */
  const hamburguesa = el('button', { class:'iconbtn btn-menu', title:'Menú (clic para fijarlo)', 'aria-label':'Menú',
                                     'aria-expanded':'false', onclick:() => {
      /* En la computadora, el clic fija o suelta el menú (pasar el
         mouse ya lo muestra). En el celular, abre y cierra. */
      if (ANCHO_ESCRITORIO.matches) fijarMenu(!menuFijo());
      else rail.classList.contains('abierto') ? cerrarMenu() : abrirMenu();
    } }, ic('menu'));
  let temporizador = null;
  abrirMenu = () => {
    clearTimeout(temporizador);
    rail.classList.add('abierto');
    hamburguesa.setAttribute('aria-expanded', 'true');
  };
  cerrarMenu = () => {
    clearTimeout(temporizador);
    if (menuFijo() && ANCHO_ESCRITORIO.matches) return;   // fijado: no se esconde
    rail.classList.remove('abierto');
    hamburguesa.setAttribute('aria-expanded', 'false');
  };
  let fijo = false;
  const menuFijo = () => fijo;
  function fijarMenu(si){
    fijo = si;
    document.documentElement.classList.toggle('menu-fijo', si);
    hamburguesa.title = si ? 'Soltar menú' : 'Menú (clic para fijarlo)';
    fijar.setAttribute('aria-pressed', String(si));
    fijar.title = si ? 'Soltar menú' : 'Fijar menú';
    fijar.setAttribute('aria-label', fijar.title);
    try{ localStorage.setItem(CLAVE_MENU_FIJO, si ? '1' : ''); }catch{}
    if (!si) cerrarMenu();
    else if (ANCHO_ESCRITORIO.matches) abrirMenu();
  }
  /* La preferencia se aplica siempre; el CSS solo la hace valer en
     pantallas anchas. En el celular el menú sigue siendo desplegable. */
  try{ if (localStorage.getItem(CLAVE_MENU_FIJO)) fijarMenu(true); }catch{}
  ANCHO_ESCRITORIO.addEventListener('change', e => {
    if (!menuFijo()) return;
    if (e.matches) abrirMenu();
    else { rail.classList.remove('abierto'); hamburguesa.setAttribute('aria-expanded', 'false'); }
  });
  const cerrarPronto = () => { clearTimeout(temporizador); temporizador = setTimeout(cerrarMenu, 400); };
  for (const zona of [hamburguesa, rail]){
    zona.addEventListener('mouseenter', abrirMenu);
    zona.addEventListener('mouseleave', cerrarPronto);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarMenu(); });
  document.addEventListener('pointerdown', e => {
    if (rail.classList.contains('abierto') && !rail.contains(e.target) && !hamburguesa.contains(e.target)) cerrarMenu();
  });

  const topbar = el('header', { class:'topbar' },
    el('div', { class:'topbar-in' },
      hamburguesa,
      el('a', { href:'#/', class:'brand brand-movil', 'aria-label':'NiJu — inicio',
                onclick:contarToques }, logoNiju('logo-top')),
      el('div', { class:'search' }, ic('buscar'), buscador),
      botonTema(),
      /* Atajo al Panel para el dueño. Sin esto, desde el celular no había
         forma de entrar: el menú lateral no existe en pantallas chicas. */
      esDueno()
        ? el('button', { class:'iconbtn', title:'Panel (solo vos)', 'aria-label':'Panel',
                         style:{ color:'var(--accion)' }, onclick:() => ir('#/panel') }, ic('panel'))
        : null,
      el('button', { class:'iconbtn', title:'Novedades de tus compras', 'aria-label':'Novedades de tus compras',
                     onclick:() => ir('#/compras') }, ic('campana'),
        el('span', { class:'dot', data:{ badge:'avisos' }, hidden:true }, '0')),
      el('button', { class:'iconbtn', title:'Carrito', onclick:() => ir('#/carrito') }, ic('carrito'),
        el('span', { class:'dot', data:{ badge:'top' }, hidden:true }, '0'))));

  const main = el('main', { class:'main' }, topbar, el('div', { id:'vista' }));

  /* El menú sin fijar arranca justo debajo de la cabecera. */
  const medirCabecera = () => document.documentElement.style.setProperty('--alto-cab', topbar.offsetHeight + 'px');
  requestAnimationFrame(medirCabecera);
  window.addEventListener('resize', medirCabecera);

  /* La barra de abajo del celular: si sos el dueño, la última posición
     lleva al Panel en vez de a Mi cuenta. */
  const rutasAbajo = esDueno()
    ? ['#/', '#/buscar', '#/pedido', '#/carrito', '#/panel']
    : TABBAR;
  const tabbar = el('nav', { class:'tabbar' },
    ...rutasAbajo.map(r => { const n = NAV.find(x => x.ruta === r);
      return el('button', { data:{ ruta:r }, onclick:() => ir(r) }, ic(n.icono), el('span', {}, n.label)); }));

  document.body.append(el('div', { class:'shell' }, rail, main), tabbar);
  return { buscador };
}

/* Cinco toques seguidos sobre el logo abren la puerta del dueño.
   Funciona igual en el celular y en la computadora. */
let toques = 0, ultimoToque = 0;
function contarToques(e){
  const ahora = Date.now();
  toques = (ahora - ultimoToque < 1200) ? toques + 1 : 1;
  ultimoToque = ahora;
  if (toques >= 5){
    toques = 0;
    e?.preventDefault?.();
    location.hash = '#/entrar';
  }
}

function marcarActivo(){
  const base = '#' + (location.hash.slice(1).split('?')[0] || '/');
  document.querySelectorAll('[data-ruta]').forEach(n => {
    n.classList.toggle('on', n.dataset.ruta === base || (base.startsWith('#/producto') && n.dataset.ruta === '#/buscar'));
  });
}

function actualizarBadges(){
  const n = totalItems();
  document.querySelectorAll('[data-badge="top"]').forEach(b => { b.hidden = !n; b.textContent = n; });
  document.querySelectorAll('[data-badge="carrito"]').forEach(b => { b.textContent = n ? String(n) : ''; });
}

function actualizarFX(){
  document.querySelectorAll('[data-fx]').forEach(d => {
    const vivo = FX.origen === 'vivo' || FX.origen === 'cache';
    const hora = FX.actualizado ? new Date(FX.actualizado).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' }) : '';
    d.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px">
        <i style="width:6px;height:6px;border-radius:50%;background:${vivo ? 'var(--ok)' : 'var(--warn)'};display:inline-block"></i>
        USD tarjeta <b style="color:var(--win-tx)">$${Math.round(FX.tarjeta)}</b></span>
      <br><span style="opacity:.6">${vivo ? 'en vivo · ' + hora : 'sin conexión'}</span>`;
  });
}

/* ------------------------------------------------------------------
   Puerta del dueño. Se entra por #/entrar, o tocando cinco veces el
   pie del menú. No es seguridad: es sacarlo de la vista del público.
   La seguridad de verdad la aplica el backend con la misma clave.
   ------------------------------------------------------------------ */
function vistaEntrar(ir){
  const clave = el('input', { class:'inp', type:'password', placeholder:'Clave de administración' });
  const raiz = el('div', { class:'wrap' },
    el('div', { class:'card card-hard', style:{ maxWidth:'420px', margin:'60px auto' } },
      el('div', { class:'kicker' }, 'Acceso interno'),
      el('h2', { style:{ marginBottom:'12px' } }, esDueno() ? 'Ya estás adentro' : 'Entrar como dueño'),
      esDueno()
        ? el('div', { class:'col' },
            el('div', { class:'notice notice-ok' }, 'Tenés el Panel y Conectores visibles en el menú.'),
            el('button', { class:'btn btn-block', onclick:() => { salir(); toast('Saliste del modo dueño'); location.hash = '#/'; location.reload(); } }, 'Salir del modo dueño'))
        : el('div', { class:'col' },
            el('p', { class:'tiny muted' },
              'Tiene que ser la misma clave que cargaste en Cloudflare como ADMIN_TOKEN. El servidor la verifica antes de abrir el Panel; con cualquier otra clave no se entra.'),
            el('div', { class:'field' }, el('label', {}, 'Clave'), clave),
            el('button', { class:'btn btn-lg btn-win btn-block', onclick: async e => {
              const valor = clave.value.trim();
              if (valor.length < 6) return toast('La clave tiene que tener al menos 6 caracteres', 'bad');
              const boton = e.currentTarget;
              boton.disabled = true; boton.textContent = 'Verificando…';
              const resultado = await verificarClave(valor);
              boton.disabled = false; boton.textContent = 'Entrar';
              if (resultado === 'mala')         { clave.value = ''; return toast('Clave incorrecta', 'bad'); }
              if (resultado === 'sin-clave')    return toast('Todavía no cargaste ADMIN_TOKEN en Cloudflare', 'bad');
              if (resultado === 'sin-conexion') return toast('No se pudo verificar la clave: revisá la conexión o volvé a subir el worker', 'bad');
              entrar(valor);
              toast('Modo dueño activado', 'win');
              location.hash = '#/panel'; location.reload();
            } }, 'Entrar'))));
  return raiz;
}

function rutear({ buscador }){
  const hash = location.hash || '#/';
  const [ruta, qs] = hash.slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const vista = $('#vista');

  window.scrollTo(0, 0);
  marcarActivo();

  if (ruta.startsWith('/tienda/')){
    vista.replaceChildren(vistaTienda(ruta.slice('/tienda/'.length), ir));
  } else if (ruta.startsWith('/producto/')){
    /* El título puede traer barras ("1/2 litro"): tomamos todo lo que
       viene después de /producto/, no solo el primer tramo. */
    vista.replaceChildren(vistaProducto(ruta.slice('/producto/'.length), ir));
  } else if (ruta === '/buscar'){
    buscador.value = params.get('q') || '';
    vista.replaceChildren(vistaResultados(params, ir));
  } else if (ruta === '/impuestos'){ vista.replaceChildren(vistaImpuestos(ir));
  } else if (ruta === '/mayorista'){ vista.replaceChildren(vistaMayorista(ir));
  } else if (ruta === '/pedido'){   vista.replaceChildren(vistaPedido(ir));
  } else if (ruta === '/grupal'){   vista.replaceChildren(vistaGrupal(ir));
  } else if (ruta === '/demanda'){  vista.replaceChildren(vistaDemanda(ir));
  } else if (ruta === '/carrito'){  vista.replaceChildren(vistaCarrito(ir));
  } else if (ruta === '/cuenta'){   vista.replaceChildren(vistaCuenta(ir));
  } else if (ruta === '/compras'){  vista.replaceChildren(vistaMisCompras(ir));
  } else if (ruta === '/entrar'){   vista.replaceChildren(vistaEntrar(ir));
  } else if (ruta === '/panel' || ruta === '/tiendas'){
    if (!esDueno()){ vista.replaceChildren(vistaEntrar(ir)); }
    else vista.replaceChildren(ruta === '/panel' ? vistaPanel(ir) : vistaTiendas(ir));
  } else if (ruta === '/mensajes'){ vista.replaceChildren(vistaMensajes(ir));
  } else { vista.replaceChildren(vistaHome(ir)); }
}

/* ------------------------------------------------------------------
   La campanita cuenta las novedades sin leer de las compras del
   cliente (compró, despachó, en camino, sin stock…).
   ------------------------------------------------------------------ */
let avisosContados = null;
async function revisarAvisos(){
  try{
    const m = await modo();
    if (m === 'sin-conexion' || (m === 'nube' && !hayCuenta())) return pintarAvisos(0);
    const os = await listarOrdenes({ dueno:false });
    const n = os.reduce((a, o) => a + (o.avisos || []).filter(x => !x.leido).length, 0);
    if (avisosContados !== null && n > avisosContados && !location.hash.startsWith('#/compras'))
      toast('Tenés novedades de tu compra', 'win');
    avisosContados = n;
    pintarAvisos(n);
  }catch{}
}
function pintarAvisos(n){
  document.querySelectorAll('[data-badge="avisos"]').forEach(b => { b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n); });
}

async function iniciar(){
  aplicarTema(temaGuardado() || 'auto');
  const ctx = construirShell();
  aplicarTema(temaGuardado() || 'auto');   // ya con el botón en pantalla
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!temaGuardado()) aplicarTema('auto');
  });
  actualizarBadges();
  store.sub(() => actualizarBadges());

  await cargarCotizaciones();
  actualizarFX();
  iniciarRefrescoFX();
  alCambiarFX(() => {
    actualizarFX();
    toast('Cotización actualizada: dólar tarjeta $' + Math.round(FX.tarjeta));
    rutear(ctx);           // recalcula todos los precios con el cambio nuevo
  });

  /* La app siempre abre en el inicio. Si quedó guardada la dirección del
     Panel y no hay sesión de dueño abierta, no la reabrimos: el dueño
     entra de nuevo con los cinco toques al logo o por #/entrar. */
  const rutaInicial = (location.hash.slice(1).split('?')[0]);
  if (['/panel', '/tiendas'].includes(rutaInicial) && !esDueno()){
    history.replaceState(null, '', location.pathname + location.search + '#/');
  }

  window.addEventListener('hashchange', () => rutear(ctx));
  rutear(ctx);

  refrescarPerfil();
  revisarAvisos();
  setInterval(revisarAvisos, 90 * 1000);
  window.addEventListener('niju:avisos', revisarAvisos);

  /* El service worker guarda la app para que ande sin internet. Buenísimo en
     producción, insoportable mientras desarrollamos: sirve archivos viejos.
     En localhost lo desactivamos y limpiamos lo que haya guardado. */
  const enLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  if ('serviceWorker' in navigator){
    if (enLocal){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches){
        const ks = await caches.keys();
        await Promise.all(ks.map(k => caches.delete(k)));
      }
    } else {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k'){ e.preventDefault(); document.querySelector('.search input')?.focus(); }
  });
}

iniciar();
