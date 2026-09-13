/* ============================================================
   NiJu — Recorrer una tienda
   Además de buscar un producto en todas, el cliente puede entrar
   a una tienda y recorrerla por rubro, como si estuviera adentro:
   portada con los colores de la tienda, buscador propio, rubros en
   una barra pegada arriba y productos a medida que se baja.
   ============================================================ */
import { el, num, ic, debounce } from '../util.js';
import { STORE_BY_ID } from '../data/stores.js';
import { RUBROS, RUBRO_BY_ID } from '../data/catalog.js';
import { buscar } from '../engine/search.js';
import { esReal } from '../connectors/registry.js';
import { filaCluster, vacio, logoTienda, tagTipo } from './components.js';
import { store } from '../state.js';
import { plazoCorto } from '../engine/envios.js';
import { tarjetaResultado, esqueletoGrilla, cargaInfinita, selectorVista, vistaGuardada } from './vitrina.js';

export function vistaTienda(tiendaId, ir){
  const t = STORE_BY_ID[tiendaId];
  const raiz = el('div', { class:'wrap v-res' });

  if (!t){
    raiz.append(el('div', { class:'section' }, vacio('No conocemos esa tienda')));
    return raiz;
  }

  /* Los rubros que esta tienda realmente cubre */
  const rubrosTienda = RUBROS.filter(r => t.rubros.includes(r.id));
  let rubroActivo = rubrosTienda[0]?.id || null;
  let consulta = '';
  let vista = vistaGuardada();

  const abrir = item => {
    const clave = item.productoId || item.titulo;
    if (clave) ir(`#/producto/${encodeURIComponent(clave)}`);
  };

  const lista = el('div', {}, esqueletoGrilla(8));
  const conteo = el('div', { class:'v-conteo' });
  const chips = el('div', { class:'v-chips' });
  let pagina = 0, acumulado = [], hayMas = false, cargando = false, turno = 0;
  const infinita = cargaInfinita(() => { if (!cargando && hayMas){ pagina++; cargar(false); } });
  /* Si un rubro no devuelve nada, lo anotamos y lo marcamos en la
     solapa: así nadie sigue haciendo clic en una pestaña vacía.
     También nos corrige a nosotros cuando le asignamos mal un rubro. */
  const rubrosVacios = new Set();

  const buscador = el('input', { type:'search', placeholder:`Buscar en ${t.nombre}…`, 'aria-label':`Buscar en ${t.nombre}` });
  buscador.addEventListener('input', debounce(() => { consulta = buscador.value.trim(); pintarChips(); cargar(true); }, 450));
  buscador.addEventListener('keydown', e => { if (e.key === 'Enter') { consulta = buscador.value.trim(); pintarChips(); cargar(true); } });

  function pintarChips(){
    chips.replaceChildren(...rubrosTienda.map(r => {
      const sinNada = rubrosVacios.has(r.id);
      return el('button', {
        class:'v-chip' + (rubroActivo === r.id && !consulta ? ' on' : '') + (sinNada ? ' vacio' : ''),
        title: sinNada ? 'Esta tienda no nos devolvió productos de este rubro' : '',
        onclick:() => { rubroActivo = r.id; consulta = ''; buscador.value = ''; pintarChips(); cargar(true); }
      }, el('span', { class:'v-chip-emo' }, r.emo), r.nombre);
    }));
  }

  function pintarLista(animar = true){
    if (!acumulado.length) return;
    lista.replaceChildren(vista === 'lista'
      ? el('div', {}, ...acumulado.map((g, i) => filaCluster(g, { abierto:i === 0, onVerFicha:abrir })))
      : el('div', { class:'v-grilla' + (animar ? '' : ' quieta') }, ...acumulado.map(g => tarjetaResultado(g, { abrir }))));
  }

  const POR_PAGINA = 24;

  function cargar(reiniciar = false){
    const mio = ++turno;
    cargando = true;
    if (reiniciar){ pagina = 0; acumulado = []; hayMas = false; lista.replaceChildren(esqueletoGrilla(8)); conteo.textContent = ''; }
    infinita.estado(reiniciar ? 'oculto' : 'buscando');

    const termino = consulta || RUBRO_BY_ID[rubroActivo]?.busqueda || '';
    buscar(termino, { ids:[tiendaId], rubro: consulta ? null : rubroActivo,
                      desde: pagina * POR_PAGINA, limite: POR_PAGINA }, () => {})
      .then(({ grupos, meta }) => {
        if (mio !== turno) return;
        cargando = false;
        /* Acumulamos sin repetir: la tienda puede devolver el mismo
           producto en dos páginas distintas. */
        const vistos = new Set(acumulado.map(g => g.clave));
        const nuevos = grupos.filter(g => !vistos.has(g.clave));
        acumulado = acumulado.concat(nuevos);

        if (!acumulado.length){
          if (!consulta && rubroActivo){ rubrosVacios.add(rubroActivo); pintarChips(); }
          conteo.textContent = '';
          lista.replaceChildren(el('div', { class:'card center', style:{ padding:'36px' } },
            el('div', { style:{ fontSize:'36px' } }, '🔎'),
            el('h3', { style:{ margin:'10px 0 6px' } },
              consulta ? `${t.nombre} no tiene "${consulta}"` : `No encontramos nada en ${RUBRO_BY_ID[rubroActivo]?.nombre}`),
            el('p', { class:'muted tiny' }, 'Probá con otra palabra o cambiá de rubro acá arriba.'),
            el('div', { class:'row wrapf', style:{ justifyContent:'center', marginTop:'14px' } },
              el('button', { class:'btn btn-sm btn-win', onclick:() => ir(`#/buscar?rubro=${rubroActivo}`) },
                'Buscarlo en todas las tiendas'),
              el('button', { class:'btn btn-sm', onclick:() => ir('#/demanda') }, 'Pedirlo y que compitan'))));
          infinita.estado('oculto');
          return;
        }

        if (!consulta && rubroActivo && rubrosVacios.delete(rubroActivo)) pintarChips();

        conteo.textContent = `${num(acumulado.length)} productos${consulta ? ` para "${consulta}"` : ` en ${RUBRO_BY_ID[rubroActivo]?.nombre}`}`;
        pintarLista(reiniciar);

        /* ¿Seguimos? Solo si la última página trajo algo nuevo. */
        hayMas = nuevos.length > 0 && meta?.hayMas !== false;
        infinita.estado(hayMas ? 'espera' : 'fin', acumulado.length);
      })
      .catch(e => {
        if (mio !== turno) return;
        cargando = false;
        lista.replaceChildren(vacio('No pudimos leer esta tienda', String(e.message || e)));
        infinita.estado('oculto');
      });
  }

  const enVivo = esReal(t.id);

  raiz.append(
    el('button', { class:'v-volver', onclick:() => history.back() }, ic('izq'), 'Volver'),
    el('header', { class:'v-tienda-cab', style:`--tc:${t.color}` },
      el('div', { class:'v-tienda-banda' }),
      el('div', { class:'v-tienda-info' },
        el('span', { class:'v-tienda-logo' }, logoTienda(t.id, true)),
        el('div', { class:'v-tienda-txt' },
          el('h1', {}, t.nombre),
          el('div', { class:'v-tienda-meta' },
            tagTipo(t.tipo),
            enVivo ? el('span', { class:'v-vivo' }, el('i'), 'Precios en vivo') : el('span', { class:'tag' }, 'Sin conectar'),
            el('span', {}, `${t.pais} · llega en ${plazoCorto(t.envioDias || [2,5], store.get('config').provincia, t.tipo === 'internacional')}`))),
        el('label', { class:'v-tienda-buscar' }, ic('buscar'), buscador))),
    el('div', { class:'v-toolbar' }, chips, selectorVista(vista, v => { vista = v; pintarLista(); })),
    conteo, lista, infinita.nodo);

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
