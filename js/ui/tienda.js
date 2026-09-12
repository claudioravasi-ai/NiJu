/* ============================================================
   NiJu — Recorrer una tienda
   Además de buscar un producto en todas, el cliente puede entrar
   a una tienda y recorrerla por rubro, como si estuviera adentro.
   ============================================================ */
import { el, plata, num, ic, toast, debounce } from '../util.js';
import { STORE_BY_ID, TIPO_META, MODO_META } from '../data/stores.js';
import { RUBROS, RUBRO_BY_ID } from '../data/catalog.js';
import { buscar } from '../engine/search.js';
import { esReal } from '../connectors/registry.js';
import { filaCluster, esqueleto, vacio, logoTienda, tagTipo, selectorMoneda } from './components.js';
import { store } from '../state.js';
import { plazoCorto } from '../engine/envios.js';

export function vistaTienda(tiendaId, ir){
  const t = STORE_BY_ID[tiendaId];
  const raiz = el('div', { class:'wrap' });

  if (!t){
    raiz.append(el('div', { class:'section' }, vacio('No conocemos esa tienda')));
    return raiz;
  }

  /* Los rubros que esta tienda realmente cubre */
  const rubrosTienda = RUBROS.filter(r => t.rubros.includes(r.id));
  let rubroActivo = rubrosTienda[0]?.id || null;
  let consulta = '';

  const lista = el('div');
  const masBoton = el('div', { style:{ marginTop:'16px' } });
  const chips = el('div', { class:'row wrapf', style:{ marginBottom:'14px' } });
  let pagina = 0, acumulado = [];
  /* Si un rubro no devuelve nada, lo anotamos y lo marcamos en la
     solapa: así nadie sigue haciendo clic en una pestaña vacía.
     También nos corrige a nosotros cuando le asignamos mal un rubro. */
  const rubrosVacios = new Set();

  const buscador = el('input', {
    class:'inp', type:'search',
    placeholder:`Buscar dentro de ${t.nombre}…`
  });
  buscador.addEventListener('input', debounce(() => { consulta = buscador.value.trim(); cargar(true); }, 450));
  buscador.addEventListener('keydown', e => { if (e.key === 'Enter') { consulta = buscador.value.trim(); cargar(true); } });

  function pintarChips(){
    chips.replaceChildren(...rubrosTienda.map(r => {
      const vacio = rubrosVacios.has(r.id);
      return el('button', {
        class:'chip' + (rubroActivo === r.id && !consulta ? ' on-win' : ''),
        style: vacio ? { opacity:'.45' } : {},
        title: vacio ? 'Esta tienda no nos devolvió productos de este rubro' : '',
        onclick:() => { rubroActivo = r.id; consulta = ''; buscador.value = ''; pintarChips(); cargar(true); }
      }, `${r.emo} ${r.nombre}`, vacio ? el('span', { class:'tiny' }, ' · vacío') : null);
    }));
  }

  const POR_PAGINA = 24;

  function cargar(reiniciar = false){
    if (reiniciar){ pagina = 0; acumulado = []; lista.replaceChildren(esqueleto(6)); masBoton.replaceChildren(); }
    else masBoton.replaceChildren(el('div', { class:'card center tiny dim', style:{ padding:'14px' } }, 'Buscando más…'));

    const termino = consulta || RUBRO_BY_ID[rubroActivo]?.busqueda || '';
    buscar(termino, { ids:[tiendaId], rubro: consulta ? null : rubroActivo,
                      desde: pagina * POR_PAGINA, limite: POR_PAGINA }, () => {})
      .then(({ grupos, meta }) => {
        /* Acumulamos sin repetir: la tienda puede devolver el mismo
           producto en dos páginas distintas. */
        const vistos = new Set(acumulado.map(g => g.clave));
        const nuevos = grupos.filter(g => !vistos.has(g.clave));
        acumulado = acumulado.concat(nuevos);

        if (!acumulado.length){
          if (!consulta && rubroActivo){ rubrosVacios.add(rubroActivo); pintarChips(); }
          lista.replaceChildren(el('div', { class:'card center', style:{ padding:'36px' } },
            el('div', { style:{ fontSize:'36px' } }, '🔎'),
            el('h3', { style:{ margin:'10px 0 6px' } },
              consulta ? `${t.nombre} no tiene "${consulta}"` : `No encontramos nada en ${RUBRO_BY_ID[rubroActivo]?.nombre}`),
            el('p', { class:'muted tiny' }, 'Probá con otra palabra o cambiá de rubro acá arriba.'),
            el('div', { class:'row wrapf', style:{ justifyContent:'center', marginTop:'14px' } },
              el('button', { class:'btn btn-sm btn-win', onclick:() => ir(`#/buscar?rubro=${rubroActivo}`) },
                'Buscarlo en todas las tiendas'),
              el('button', { class:'btn btn-sm', onclick:() => ir('#/demanda') }, 'Pedirlo y que compitan'))));
          masBoton.replaceChildren();
          return;
        }

        if (!consulta && rubroActivo && rubrosVacios.delete(rubroActivo)) pintarChips();

        const cont = el('div');
        cont.append(el('div', { class:'row-b wrapf', style:{ marginBottom:'12px' } },
          el('span', { class:'tiny dim' },
            `${acumulado.length} productos${consulta ? ` para "${consulta}"` : ` en ${RUBRO_BY_ID[rubroActivo]?.nombre}`}`),
          el('span', { class:'tiny dim' }, meta ? `página ${pagina + 1}` : '')));
        acumulado.forEach((g, i) => cont.append(filaCluster(g, {
          abierto: i === 0,
          onVerFicha: item => {
            const clave = item.productoId || item.titulo;
            if (clave) ir(`#/producto/${encodeURIComponent(clave)}`);
          }
        })));
        lista.replaceChildren(cont);

        /* ¿Seguimos? Solo si la última página trajo algo nuevo. */
        if (nuevos.length && meta?.hayMas !== false){
          masBoton.replaceChildren(el('button', {
            class:'btn btn-win btn-block btn-lg',
            onclick:() => { pagina++; cargar(false); }
          }, 'Ver más productos de ' + t.nombre));
        } else {
          masBoton.replaceChildren(el('div', { class:'card center tiny dim', style:{ padding:'14px' } },
            pagina === 0 ? 'Esto es todo lo que esta tienda nos devuelve para este rubro.'
                         : `Llegaste al final: ${acumulado.length} productos.`));
        }
      })
      .catch(e => {
        lista.replaceChildren(vacio('No pudimos leer esta tienda', String(e.message || e)));
        masBoton.replaceChildren();
      });
  }

  const m = MODO_META[t.integracion.modo];
  const enVivo = esReal(t.id);

  raiz.append(el('section', { class:'section' },
    el('button', { class:'btn btn-sm', style:{ marginBottom:'14px' }, onclick:() => history.back() }, '← Volver'),

    el('div', { class:'card card-hard', style:{ marginBottom:'18px' } },
      el('div', { class:'row wrapf', style:{ gap:'16px' } },
        logoTienda(t.id, true),
        el('div', { class:'spacer' },
          el('div', { class:'row', style:{ gap:'7px' } },
            el('h2', {}, t.nombre),
            tagTipo(t.tipo),
            enVivo ? el('span', { class:'tag tag-ok' }, '● En vivo') : el('span', { class:'tag' }, 'Sin conectar')),
          el('div', { class:'tiny dim', style:{ marginTop:'4px' } },
            `${t.pais} · ${t.moneda} · ${plazoCorto(t.envioDias || [2,5], store.get('config').provincia, t.tipo === 'internacional')}`),
          el('p', { class:'tiny muted', style:{ marginTop:'6px' } }, t.integracion.notas)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'kicker' }, 'Rubros'),
          el('b', { style:{ fontSize:'20px' } }, String(rubrosTienda.length)))),
      el('div', { class:'row wrapf', style:{ marginTop:'12px' } },
        buscador,
        selectorMoneda(() => cargar()))),

    chips, lista, masBoton));

  pintarChips();
  cargar(true);
  return raiz;
}

/* ------------------------------------------------------------------
   Tira de tiendas de un rubro: se muestra arriba de los resultados
   para que se pueda entrar a una sola.
   ------------------------------------------------------------------ */
export function tirasDeTiendas(tiendas, ir, titulo = 'Tiendas de este rubro'){
  if (!tiendas.length) return null;
  return el('div', { style:{ marginBottom:'16px' } },
    el('div', { class:'row-b', style:{ marginBottom:'8px' } },
      el('div', { class:'kicker' }, titulo),
      el('span', { class:'tiny dim' }, `${tiendas.length} conectada${tiendas.length > 1 ? 's' : ''}`)),
    el('div', { class:'scroller' }, ...tiendas.map(t => el('button', {
      class:'card hoverable', style:{ minWidth:'168px', textAlign:'left' },
      onclick:() => ir(`#/tienda/${t.id}`)
    },
      el('div', { class:'row' }, logoTienda(t.id, true),
        el('div', {},
          el('b', { style:{ fontSize:'13px' } }, t.nombre),
          el('div', { class:'tiny dim' }, t.rubros.length + (t.rubros.length === 1 ? ' rubro' : ' rubros')))),
      el('div', { class:'tiny', style:{ marginTop:'8px', color:'var(--accion)', fontWeight:'600' } },
        'Recorrer la tienda →')))));
}
