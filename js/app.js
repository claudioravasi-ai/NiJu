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
import { esDueno, entrar, salir } from './engine/sesion.js';
import { vistaCarrito } from './ui/carrito.js';
import { vistaCuenta } from './ui/cuenta.js';
import { vistaPanel } from './ui/panel.js';
import { vistaMensajes } from './ui/mensajes.js';
import { vistaTiendas } from './ui/tiendas.js';

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
  { ruta:'#/cuenta',    icono:'usuario',  label:'Mi cuenta' },
  { ruta:'#/tiendas',   icono:'mundo',    label:'Conectores', privado:true },
  { ruta:'#/panel',     icono:'panel',    label:'Panel',      privado:true }
];

const TABBAR = ['#/', '#/buscar', '#/pedido', '#/carrito', '#/cuenta'];

const ir = ruta => { location.hash = ruta; };


/* ------------------------------------------------------------------
   Identidad. Dos piezas:
     · el isotipo (el dibujo), que va en un cuadrado redondeado
     · la palabra NiJu al lado
   Si el archivo del isotipo no está, cae a la marca vectorial, que
   toma el color del texto y se ve bien de día y de noche.
   ------------------------------------------------------------------ */
const MARCA_SVG = `<svg viewBox="0 0 660 230" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="23" stroke-linecap="round" stroke-linejoin="round">
    <path d="M96 196 V106 C96 72 138 66 155 100 L246 182 C262 198 282 190 282 166 V74"/>
    <path d="M338 196 V120"/>
    <path d="M416 62 V158 C416 196 366 202 352 176"/>
    <path d="M492 108 V160 C492 196 548 196 548 160 V108"/>
    <path d="M548 108 V196"/>
  </g>
  <circle cx="338" cy="80" r="15" fill="currentColor"/>
</svg>`;

/* Buscamos el dibujo una sola vez, probando los formatos posibles:
   no le vamos a pedir a nadie que convierta un jpg a png. */
let isotipoURL = null;      // null = sin averiguar, false = no está
const oyentesIsotipo = new Set();

function verificarIsotipo(){
  if (isotipoURL !== null) return;
  const candidatos = [].concat(CONFIG.isotipo || []);
  if (!candidatos.length){ isotipoURL = false; return; }

  let i = 0;
  const probar = () => {
    if (i >= candidatos.length){ isotipoURL = false; return; }
    const url = candidatos[i++];
    const img = new Image();
    img.onload  = () => { isotipoURL = url; oyentesIsotipo.forEach(f => f()); };
    img.onerror = probar;
    img.src = url;
  };
  probar();
}

function logoNiju(clase){
  const cont = el('span', { class:'marca ' + clase, role:'img', 'aria-label':'NiJu' });

  const armar = () => {
    if (isotipoURL){
      const cuadro = el('span', { class:'isotipo' });
      cuadro.style.backgroundImage = `url("${isotipoURL}")`;
      cuadro.style.setProperty('--zoom', CONFIG.isotipoZoom || '205%');
      cuadro.style.setProperty('--foco', CONFIG.isotipoFoco || '27% 56%');
      cont.replaceChildren(cuadro,
        el('span', { class:'marca-texto' }, CONFIG.isotipoTexto || 'NiJu'));
    } else {
      cont.replaceChildren(el('span', { class:'logo ' + clase, html:MARCA_SVG }));
    }
  };

  armar();
  if (isotipoURL === null){ oyentesIsotipo.add(armar); verificarIsotipo(); }
  return cont;
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

function construirShell(){
  const rail = el('aside', { class:'rail' },
    el('a', { class:'brand brand-full', href:'#/', 'aria-label':'NiJu — inicio' },
      logoNiju('logo-rail'),
      el('div', { class:'brand-sub' }, 'compra todo, de todo y para todo')),
    ...NAV.filter(n => !n.privado || esDueno()).map(n => el('button', { class:'nav-item', data:{ ruta:n.ruta }, onclick:() => ir(n.ruta) },
      ic(n.icono), el('span', { class:'spacer' }, n.label),
      n.ruta === '#/carrito' ? el('span', { class:'tiny mono', data:{ badge:'carrito' } }, '') : null)),
    el('div', { class:'rail-foot', onclick:contarToques, title:'' },
      el('div', { data:{ fx:'1' } }, ''),
      el('div', { style:{ marginTop:'6px' } }, `v${CONFIG.version} · modo ${CONFIG.modoDatos}`)));

  const buscador = el('input', { type:'search', placeholder:'Buscar en todas las tiendas…', 'aria-label':'Buscar' });
  buscador.addEventListener('keydown', e => {
    if (e.key === 'Enter' && buscador.value.trim()){
      registrarBusqueda(buscador.value.trim());
      ir(`#/buscar?q=${encodeURIComponent(buscador.value.trim())}`);
    }
  });

  const topbar = el('header', { class:'topbar' },
    el('div', { class:'topbar-in' },
      el('a', { href:'#/', class:'brand brand-movil', 'aria-label':'NiJu — inicio' }, logoNiju('logo-top')),
      el('div', { class:'search' }, ic('buscar'), buscador),
      botonTema(),
      el('button', { class:'iconbtn', title:'Alertas', onclick:() => ir('#/cuenta') }, ic('campana')),
      el('button', { class:'iconbtn', title:'Carrito', onclick:() => ir('#/carrito') }, ic('carrito'),
        el('span', { class:'dot', data:{ badge:'top' }, hidden:true }, '0'))));

  const main = el('main', { class:'main' }, topbar, el('div', { id:'vista' }));

  const tabbar = el('nav', { class:'tabbar' },
    ...TABBAR.map(r => { const n = NAV.find(x => x.ruta === r);
      return el('button', { data:{ ruta:r }, onclick:() => ir(r) }, ic(n.icono), el('span', {}, n.label)); }));

  document.body.append(el('div', { class:'shell' }, rail, main), tabbar);
  return { buscador };
}

let toques = 0, ultimoToque = 0;
function contarToques(){
  const ahora = Date.now();
  toques = (ahora - ultimoToque < 1200) ? toques + 1 : 1;
  ultimoToque = ahora;
  if (toques >= 5){ toques = 0; location.hash = '#/entrar'; }
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
            el('button', { class:'btn btn-block', onclick:() => { salir(); toast('Saliste del modo dueño'); ir('#/'); } }, 'Salir del modo dueño'))
        : el('div', { class:'col' },
            el('p', { class:'tiny muted' },
              'Tiene que ser la misma clave que cargaste en el backend como ADMIN_TOKEN. Se guarda solo en este dispositivo y viaja en cada operación sensible para que el servidor la valide.'),
            el('div', { class:'field' }, el('label', {}, 'Clave'), clave),
            el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
              if (!entrar(clave.value.trim())) return toast('La clave tiene que tener al menos 6 caracteres', 'bad');
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
  } else if (ruta === '/entrar'){   vista.replaceChildren(vistaEntrar(ir));
  } else if (ruta === '/panel' || ruta === '/tiendas'){
    if (!esDueno()){ vista.replaceChildren(vistaEntrar(ir)); }
    else vista.replaceChildren(ruta === '/panel' ? vistaPanel(ir) : vistaTiendas(ir));
  } else if (ruta === '/mensajes'){ vista.replaceChildren(vistaMensajes(ir));
  } else { vista.replaceChildren(vistaHome(ir)); }
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

  window.addEventListener('hashchange', () => rutear(ctx));
  rutear(ctx);

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
