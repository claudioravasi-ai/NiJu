/* ============================================================
   NiJu — Idiomas: español e inglés (14-09-2026)
   ------------------------------------------------------------
   La app está escrita en español directamente en cada pantalla.
   En vez de reescribir todo, un traductor recorre la página y
   cambia cada texto por su versión en inglés según el
   diccionario (js/i18n/en.js). Un MutationObserver traduce
   también lo que aparece después: resultados, carrito, avisos.
   · Lo que no está en el diccionario queda en español.
   · Textos con números ("5 resultados") van por PATRONES.
   · data-no-traducir en un elemento lo deja como está
     (nombres de productos, direcciones, lo que escribe el cliente).
   ============================================================ */
import { EN } from './i18n/en.js';

const CLAVE = 'niju.idioma';
export const IDIOMAS = [['es', 'Español'], ['en', 'English']];

export function idioma(){
  try{
    const g = localStorage.getItem(CLAVE);
    if (g === 'es' || g === 'en') return g;
  }catch{}
  return /^en/i.test(navigator.language || '') ? 'en' : 'es';
}

export function cambiarIdioma(l){
  try{ localStorage.setItem(CLAVE, l); }catch{}
  location.reload();
}

const normal = s => s.replace(/\s+/g, ' ').trim();
let DIC = null;
const dic = () => DIC || (DIC = new Map(Object.entries(EN).map(([k, v]) => [normal(k), v])));

/* Textos armados con números o nombres. El primero que coincide manda. */
const PATRONES = [
  [/^(\d[\d.]*) resultados?$/, (_, n) => `${n} result${n === '1' ? '' : 's'}`],
  [/^En vivo en (\d+) tiendas?$/, (_, n) => `Live in ${n} store${n === '1' ? '' : 's'}`],
  [/^Buscando: respondieron (\d+) de (\d+) tiendas$/, (_, a, b) => `Searching: ${a} of ${b} stores answered`],
  [/^· hace (\d+) (s|min)$/, (_, n, u) => `· ${n} ${u === 's' ? 's' : 'min'} ago`],
  [/^Paso (\d+) de (\d+)$/, (_, a, b) => `Step ${a} of ${b}`],
  [/^Te faltan (\d+) datos?$/, (_, n) => `${n} detail${n === '1' ? '' : 's'} missing`],
  [/^Llega en (\d+)-(\d+) días a (.+)$/, (_, a, b, d) => `Arrives in ${a}-${b} days to ${d}`],
  [/^Llega en (\d+) días? a (.+)$/, (_, a, d) => `Arrives in ${a} day${a === '1' ? '' : 's'} to ${d}`],
  [/^Lo encontramos en (.+)$/, (_, t) => `Found it at ${t}`],
  [/^Producto en (.+)$/, (_, t) => `Product at ${t}`],
  [/^Tu producto en (.+)$/, (_, t) => `Your product at ${t}`],
  [/^Comprando entre (\d+)$/, (_, n) => `Buying among ${n}`],
  [/^(\d+) días restantes$/, (_, n) => `${n} day${n === '1' ? '' : 's'} left`],
  [/^(✓ )?Desde (\d+) unidades?$/, (_, c, n) => `${c || ''}From ${n} unit${n === '1' ? '' : 's'}`],
  [/^Faltan (\d+) para que baje a (\$[\d.]+) — para todos\.$/, (_, n, p) => `${n} more to drop to ${p}, for everyone.`],
  [/^(\d+)% menos por unidad, estimado$/, (_, n) => `${n}% less per unit, estimated`],
  [/^(\d+)% menos que el precio de lista$/, (_, n) => `${n}% below list price`],
  [/^(\d+)% OFF$/, (_, n) => `${n}% OFF`],
  [/^(\d+) u\.$/, (_, n) => `${n} u.`],
  [/^Cotización actualizada: (.+)$/, (_, t) => `Exchange rate updated: ${t}`],
  [/^Recuperás (\$[\d.]+) · costo real (\$[\d.]+)$/, (_, a, b) => `You get back ${a} · real cost ${b}`],
  [/^Sin contar: (.+)\.$/, (_, t) => `Not counted yet: ${t}.`],
  [/^Calculamos como (.+)\. $/, (_, t) => `We calculate as ${t}. `],
  [/^Van (\d+) de (\d+): sumate y el precio baja para todos\.$/, (_, a, b) => `${a} of ${b} so far: join and the price drops for everyone.`],
  [/^© (\d{4}) NiJu\. Todos los derechos reservados\.$/, (_, y) => `© ${y} NiJu. All rights reserved.`],
  [/^(\d+) tiendas en vivo$/, (_, n) => `${n} stores live`],
  [/^Dólar (oficial|tarjeta|MEP|blue|cripto|CCL|mayorista)(\s.*)?$/, (_, d, resto) =>
    `${{ oficial:'Official', tarjeta:'Card', MEP:'MEP', blue:'Blue', cripto:'Crypto', CCL:'CCL', mayorista:'Wholesale' }[d]} dollar${resto || ''}`],
  [/^En (.+) y (\d+) tiendas más, comparadas en vivo\.$/, (_, t, n) => `At ${t} and ${n} more stores, compared live.`],
  [/^Elegís cuántas unidades querés\. En preventa dejás una seña del (\d+)%\.$/, (_, n) => `You choose how many units you want. In pre-sale you leave a ${n}% deposit.`],
  [/^Reservar con (\d+)% de seña$/, (_, n) => `Reserve with ${n}% deposit`],
  [/^(\d+) de (\d+)$/, (_, a, b) => `${a} of ${b}`]
];

/** Traduce un texto suelto. Devuelve null si no hay traducción. */
export function traducir(texto){
  if (idioma() !== 'en' || !texto) return null;
  const n = normal(texto);
  if (!n) return null;
  let r = dic().get(n);
  if (r == null){
    for (const [rx, fn] of PATRONES){
      const m = n.match(rx);
      if (m){ r = fn(...m); break; }
    }
  }
  if (r == null) return null;
  return texto.match(/^\s*/)[0] + r + texto.match(/\s*$/)[0];
}

/** Para usar en código: t('Buscar') → 'Search' en inglés. */
export const t = texto => traducir(texto) ?? texto;

const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];
const SALTEAR = /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/;

function traducirTexto(nodo){
  const p = nodo.parentNode;
  if (!p || SALTEAR.test(p.nodeName) || p.closest?.('[data-no-traducir]')) return;
  const r = traducir(nodo.nodeValue);
  if (r != null && r !== nodo.nodeValue) nodo.nodeValue = r;
}

function traducirAtributos(e){
  if (e.closest?.('[data-no-traducir]')) return;
  for (const a of ATRIBUTOS){
    const v = e.getAttribute?.(a);
    if (!v) continue;
    const r = traducir(v);
    if (r != null && r !== v) e.setAttribute(a, r);
  }
}

function traducirArbol(raiz){
  if (raiz.nodeType === 3) return traducirTexto(raiz);
  if (raiz.nodeType !== 1) return;
  traducirAtributos(raiz);
  for (const e of raiz.querySelectorAll('[placeholder],[title],[aria-label],[alt]')) traducirAtributos(e);
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) traducirTexto(n);
}

/** Se llama una vez al arrancar, antes de dibujar la app. */
export function iniciarIdioma(){
  const l = idioma();
  document.documentElement.lang = l === 'en' ? 'en' : 'es-AR';
  if (l !== 'en') return;
  document.title = 'NiJu — Buy everything, of everything, for everything';
  traducirArbol(document.body);
  /* Cada cambio es idempotente: un texto ya traducido no coincide con el
     diccionario en español, así que no hay vueltas infinitas. */
  new MutationObserver(cambios => {
    for (const c of cambios){
      if (c.type === 'childList') c.addedNodes.forEach(traducirArbol);
      else if (c.type === 'characterData') traducirTexto(c.target);
      else if (c.type === 'attributes') traducirAtributos(c.target);
    }
  }).observe(document.documentElement, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATRIBUTOS });
}
