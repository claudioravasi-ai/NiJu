/* ============================================================
   NiJu — Utilidades
   ============================================================ */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function el(tag, props = {}, ...hijos){
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'data') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const h of hijos.flat()){
    if (h === null || h === undefined || h === false) continue;
    n.append(h.nodeType ? h : document.createTextNode(String(h)));
  }
  return n;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const fARS = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 });
const fUSD = new Intl.NumberFormat('es-AR', { style:'currency', currency:'USD', maximumFractionDigits:2 });
const fNUM = new Intl.NumberFormat('es-AR');

export function plata(n, moneda = 'ARS'){
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (moneda === 'ARS') return fARS.format(Math.round(n));
  if (moneda === 'USD') return fUSD.format(n);
  if (moneda === 'CNY') return '¥ ' + fNUM.format(Math.round(n));
  if (moneda === 'EUR') return '€ ' + fNUM.format(Math.round(n));
  return fNUM.format(n);
}
export const num = n => fNUM.format(n);
export const pct = n => `${n > 0 ? '' : ''}${Math.round(n)}%`;

export function fecha(ts){
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
}

export function debounce(fn, ms = 280){
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function toast(msg, tipo = ''){
  let cont = $('#toasts');
  if (!cont){ cont = el('div', { id:'toasts' }); document.body.append(cont); }
  const t = el('div', { class:`toast ${tipo}` }, msg);
  cont.append(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 2300);
  setTimeout(() => t.remove(), 2600);
}

export function hoja({ titulo, cuerpo, ancho = 600, alCerrar }){
  const bg = el('div', { class:'sheet-bg', onclick: e => { if (e.target === bg) cerrar(); } });
  const sh = el('div', { class:'sheet', style:{ maxWidth: ancho + 'px' } });
  let cerrada = false;
  const cerrar = () => {
    if (cerrada) return;
    cerrada = true;
    bg.remove(); document.body.style.overflow = '';
    alCerrar?.();
  };
  sh.append(
    el('div', { class:'sheet-head' },
      el('h3', { class:'spacer' }, titulo),
      el('button', { class:'iconbtn', onclick:cerrar, 'aria-label':'Cerrar' }, '✕')),
    el('div', { class:'sheet-body' }, cuerpo)
  );
  bg.append(sh);
  document.body.append(bg);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', function esc(e){
    if (e.key === 'Escape'){ cerrar(); document.removeEventListener('keydown', esc); }
  });
  return { cerrar, sheet:sh };
}

export function ic(nombre, cls = 'ic'){
  const P = {
    buscar:'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35',
    casa:'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
    rayo:'M13 2 3 14h8l-1 8 10-12h-8l1-8Z',
    etiqueta:'M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8ZM7 7h.01',
    carrito:'M3 3h2l.4 2M7 13h10l3-8H5.4M7 13 5.4 5M7 13l-2 5h14M9 21h.01M18 21h.01',
    usuario:'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    mundo:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z',
    calc:'M5 2h14v20H5zM9 6h6M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8',
    caja:'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
    chat:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z',
    panel:'M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z',
    corazon:'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z',
    flecha:'m6 9 6 6 6-6',
    filtro:'M22 3H2l8 9.5V19l4 2v-8.5L22 3Z',
    check:'m20 6-11 11-5-5',
    x:'M18 6 6 18M6 6l12 12',
    salir:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    menu:'M3 6h18M3 12h18M3 18h18',
    pin:'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z',
    alerta:'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
    envio:'M16 3h5v13h-2M1 3h15v13H1zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    campana:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    megafono:'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM16 8a5 5 0 0 1 0 8',
    estrella:'m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z',
    sol:'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    luna:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
    imagen:'M3 3h18v18H3zM3 16l5-5 4 4 3-3 6 6M9 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
    izq:'m15 18-6-6 6-6',
    der:'m9 18 6-6-6-6',
    tienda:'M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
    refrescar:'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6'
  };
  const d = P[nombre] || P.x;
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
  svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','2');
  svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
  svg.setAttribute('class', cls);
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

export const estrellas = n => '★'.repeat(Math.round(n)) + '☆'.repeat(Math.max(0, 5 - Math.round(n)));
export const uid = () => Math.random().toString(36).slice(2, 10);
