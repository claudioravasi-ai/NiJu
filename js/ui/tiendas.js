/* ============================================================
   NiJu — Estado de los conectores
   Qué tienda está conectada de verdad, por qué vía, y qué falta.
   Es el tablero de trabajo de la integración.
   ============================================================ */
import { el, ic, toast } from '../util.js';
import { STORES, TIPO_META, MODO_META } from '../data/stores.js';
import { CONFIG } from '../config.js';
import { logoTienda, tagTipo } from './components.js';
import { store } from '../state.js';
import { confirmarSalida } from './panel.js';

export function vistaTiendas(ir){
  const raiz = el('div', { class:'wrap' });
  const lista = el('div');
  let filtro = 'todas';

  function pintar(){
    const items = STORES.filter(t => filtro === 'todas' || t.tipo === filtro);
    const porModo = {};
    for (const t of STORES) porModo[t.integracion.modo] = (porModo[t.integracion.modo] || 0) + 1;

    lista.replaceChildren(
      el('div', { class:'grid g-4', style:{ marginBottom:'18px' } },
        ...Object.entries(porModo).map(([m, n]) => el('div', { class:'kpi' },
          el('div', { class:'kicker' }, MODO_META[m]?.label || m),
          el('b', { style:{ color:MODO_META[m]?.color } }, String(n)),
          el('div', { class:'d dim' }, 'tiendas')))),
      el('div', { class:'card', style:{ padding:'0' } },
        ...items.map(t => {
          const apagada = CONFIG.tiendasApagadas.includes(t.id);
          const m = MODO_META[t.integracion.modo];
          return el('div', { class:'conn-row' },
            logoTienda(t.id, true),
            el('div', { class:'spacer' },
              el('div', { class:'row', style:{ gap:'7px' } }, el('b', {}, t.nombre), tagTipo(t.tipo),
                el('span', { class:'tag', style:{ color:m?.color } }, m?.label)),
              el('div', { class:'tiny dim' }, t.integracion.notas),
              t.integracion.doc ? el('a', { href:t.integracion.doc, target:'_blank', rel:'noopener',
                class:'tiny', style:{ color:'var(--win-tx)' } }, 'Documentación ↗') : null),
            el('div', { style:{ textAlign:'right' } },
              el('span', { class:'tag ' + estadoTag(t.integracion.estado) }, t.integracion.estado),
              el('div', { class:'tiny dim mono' }, t.moneda + ' · ' + t.pais)),
            el('label', { class:'switch' },
              el('input', { type:'checkbox', checked:!apagada || null, onchange:e => {
                if (e.target.checked) CONFIG.tiendasApagadas = CONFIG.tiendasApagadas.filter(x => x !== t.id);
                else CONFIG.tiendasApagadas.push(t.id);
                toast(`${t.nombre}: ${e.target.checked ? 'activada' : 'desactivada'}`);
              } })));
        })));
  }

  raiz.append(el('section', { class:'section' },
    el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
      el('div', {},
        el('div', { class:'kicker' }, 'Infraestructura'),
        el('h1', {}, 'Conectores')),
      el('button', { class:'btn btn-sm', onclick:() => confirmarSalida() }, ic('x'), 'Salir del modo dueño')),
    el('p', { class:'muted', style:{ maxWidth:'74ch', marginBottom:'14px' } },
      'Cada tienda entra por una vía distinta. Las que tienen API oficial son las más rápidas de poner en producción; las que no, necesitan nuestro propio proxy. El modo actual de datos es ',
      el('b', { style:{ color:'var(--win-tx)' } }, CONFIG.modoDatos.toUpperCase()), '.'),
    el('div', { class:'notice', style:{ marginBottom:'16px' } },
      'Mientras el modo sea DEMO, los precios son generados localmente para probar la app entera. Al levantar el backend y poner modoDatos:"proxy", las mismas pantallas muestran precios reales sin cambiar una línea de interfaz.'),
    el('div', { class:'row wrapf', style:{ marginBottom:'14px' } },
      ...['todas', ...Object.keys(TIPO_META)].map(f => el('button', {
        class:'chip' + (filtro === f ? ' on-win' : ''),
        onclick:e => { filtro = f; pintar(); [...e.currentTarget.parentNode.children].forEach(c => c.classList.remove('on-win')); e.currentTarget.classList.add('on-win'); }
      }, f === 'todas' ? 'Todas' : TIPO_META[f].label))),
    lista));

  pintar();
  return raiz;
}

const estadoTag = e => e === 'listo' || e === 'listo-sandbox' ? 'tag-ok' : e === 'pendiente' ? 'tag-warn' : 'tag-nac';
