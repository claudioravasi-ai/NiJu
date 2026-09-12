/* ============================================================
   NiJu — Resultados de búsqueda
   Acá vive la promesa: el mismo producto, todas las tiendas,
   ordenado por lo que realmente vas a pagar.
   ============================================================ */
import { el, plata, num, ic, toast } from '../util.js';
import { buscar, procesar } from '../engine/search.js';
import { STORES, STORE_BY_ID, TIPO_META } from '../data/stores.js';
import { RUBROS, RUBRO_BY_ID } from '../data/catalog.js';
import { tiendasActivas } from '../connectors/registry.js';
import { store, registrarBusqueda } from '../state.js';
import { filaCluster, barraProgreso, esqueleto, vacio, selectorMoneda } from './components.js';
import { tirasDeTiendas } from './tienda.js';

const ORDENES = [
  { id:'relevancia', n:'Más relevante' },
  { id:'precio',     n:'Precio final ↑' },
  { id:'ahorro',     n:'Mayor ahorro' },
  { id:'entrega',    n:'Llega antes' },
  { id:'tiendas',    n:'Más comparado' }
];

export function vistaResultados(params, ir){
  const q     = params.get('q') || '';
  const rubro = params.get('rubro') || null;
  const soloTienda = params.get('tienda') || null;

  const filtros = {
    tipos: new Set(),
    tiendas: new Set(soloTienda ? [soloTienda] : []),
    precioMax: null,
    envioGratis: false,
    cuotas: false,
    sinImpuestos: false,
    mayorista: params.get('mayorista') === '1',
    orden: params.get('orden') || 'relevancia',
    regimen: store.get('config').regimen || 'courier'
  };

  let datos = null;
  let pagina = 0, acumulado = [];
  const POR_PAGINA = 24;
  const masBoton = el('div', { style:{ marginTop:'16px' } });

  const raiz = el('div', { class:'wrap' });
  const cabecera = el('div');
  const progreso = el('div');
  const panelFiltros = el('aside', { class:'filters cerrado' });
  const btnFiltros = el('button', { class:'btn btn-sm filtros-toggle', onclick:() => {
    panelFiltros.classList.toggle('cerrado');
    btnFiltros.textContent = panelFiltros.classList.contains('cerrado') ? 'Filtrar y ordenar' : 'Ocultar filtros';
  } }, 'Filtrar y ordenar');
  const lista = el('div');
  lista.append(esqueleto(6));

  /* Cuando se entra por rubro, mostramos las tiendas que lo cubren:
     el cliente puede querer recorrer una sola, no comparar todas. */
  const tiendasDelRubro = rubro
    ? tiendasActivas({ rubro }).filter(t => t.tipo !== 'propio')
    : [];

  raiz.append(el('section', { class:'section', style:{ paddingTop:'20px' } },
    cabecera,
    tirasDeTiendas(tiendasDelRubro, ir, `Tiendas de ${RUBRO_BY_ID[rubro]?.nombre || 'este rubro'}`),
    btnFiltros, progreso,
    el('div', { class:'res-layout' }, panelFiltros, el('div', {}, lista, masBoton))));

  /* ---------- Cabecera ---------- */
  function pintarCabecera(){
    const titulo = q ? `"${q}"` : rubro ? RUBRO_BY_ID[rubro]?.nombre : 'Todas las ofertas';
    const meta = datos?.meta;
    cabecera.replaceChildren(
      el('div', { class:'res-head' },
        el('div', {},
          el('div', { class:'kicker' }, rubro ? 'Rubro' : 'Búsqueda comparada'),
          el('h2', {}, titulo),
          meta ? el('div', { class:'tiny dim', style:{ marginTop:'5px' } },
            `${num(meta.ofertas)} ofertas de ${meta.tiendasOk}/${meta.tiendasTotal} tiendas en ${meta.ms} ms · agrupadas en ${datos.grupos.length} productos`) : null,
          meta ? el('div', { class:'row tiny', style:{ marginTop:'4px', gap:'7px' } },
            el('i', { style:{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--ok)', display:'inline-block' } }),
            el('span', { style:{ color:'var(--ok)', fontWeight:'800' } }, 'PRECIOS EN VIVO'),
            el('span', { class:'dim' }, '· consultados ' + new Date(meta.consultado).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }))) : null),
        el('div', { class:'row wrapf' },
          el('button', { class:'btn btn-sm', title:'Volver a preguntarle el precio a cada tienda', onclick:() => cargar(true) }, '↻ Actualizar precios'),
          selectorMoneda(() => repintar()),
          el('select', { class:'inp', style:{ width:'auto' }, onchange:e => { filtros.orden = e.target.value; repintar(); } },
            ...ORDENES.map(o => el('option', { value:o.id, selected:filtros.orden === o.id || null }, o.n))),
          el('select', { class:'inp', style:{ width:'auto' },
            onchange:e => { filtros.regimen = e.target.value; recalcular(); } },
            el('option', { value:'courier', selected:filtros.regimen === 'courier' || null }, 'Courier puerta a puerta'),
            el('option', { value:'general', selected:filtros.regimen === 'general' || null }, 'Importación formal'))
        ))
    );
  }

  /* ---------- Filtros ---------- */
  function pintarFiltros(){
    if (!datos) return;
    const todas = datos.grupos.flatMap(g => g.ofertas);
    const porTienda = {}; for (const o of todas) porTienda[o.tiendaId] = (porTienda[o.tiendaId] || 0) + 1;
    const porTipo = {};   for (const o of todas){ const t = STORE_BY_ID[o.tiendaId]?.tipo; porTipo[t] = (porTipo[t] || 0) + 1; }

    const gTipo = el('div', { class:'fgroup' }, el('h4', {}, 'Origen'));
    for (const [k, m] of Object.entries(TIPO_META)){
      if (!porTipo[k]) continue;
      gTipo.append(el('label', { class:'fitem' },
        el('input', { type:'checkbox', checked:filtros.tipos.has(k) || null,
          onchange:e => { e.target.checked ? filtros.tipos.add(k) : filtros.tipos.delete(k); repintar(); } }),
        el('span', { style:{ color:m.color, fontWeight:'800' } }, m.label),
        el('span', { class:'cnt' }, porTipo[k])));
    }

    const gTienda = el('div', { class:'fgroup' }, el('h4', {}, 'Tienda'));
    Object.entries(porTienda).sort((a,b) => b[1] - a[1]).forEach(([id, n]) => {
      gTienda.append(el('label', { class:'fitem' },
        el('input', { type:'checkbox', checked:filtros.tiendas.has(id) || null,
          onchange:e => { e.target.checked ? filtros.tiendas.add(id) : filtros.tiendas.delete(id); repintar(); } }),
        el('span', {}, STORE_BY_ID[id]?.nombre || id),
        el('span', { class:'cnt' }, n)));
    });

    const precios = datos.grupos.map(g => g.mejor.costo.finalARS).sort((a,b) => a - b);
    const max = precios[precios.length - 1] || 0;
    const slider = el('input', { type:'range', min:0, max:String(max), value:String(filtros.precioMax ?? max),
      style:{ width:'100%', accentColor:'var(--win)' },
      oninput:e => { filtros.precioMax = +e.target.value; lblPrecio.textContent = 'hasta ' + plata(+e.target.value); },
      onchange:repintar });
    const lblPrecio = el('span', { class:'tiny mono' }, filtros.precioMax ? 'hasta ' + plata(filtros.precioMax) : 'sin tope');

    const gPrecio = el('div', { class:'fgroup' }, el('h4', {}, 'Precio final'), slider,
      el('div', { class:'row-b tiny dim' }, el('span', {}, plata(0)), lblPrecio));

    const gExtra = el('div', { class:'fgroup' }, el('h4', {}, 'Condiciones'),
      chk('Envío gratis', 'envioGratis'),
      chk('Con cuotas sin interés verificadas', 'cuotas'),
      chk('Sin costo de importación', 'sinImpuestos'),
      chk('Solo por mayor', 'mayorista'));

    const gLimpiar = el('button', { class:'btn btn-block', onclick:() => {
      filtros.tipos.clear(); filtros.tiendas.clear(); filtros.precioMax = null;
      filtros.envioGratis = filtros.cuotas = filtros.sinImpuestos = filtros.mayorista = false;
      pintarFiltros(); repintar();
    } }, 'Limpiar filtros');

    panelFiltros.replaceChildren(gTipo, gPrecio, gTienda, gExtra, gLimpiar);

    function chk(label, key){
      return el('label', { class:'fitem' },
        el('input', { type:'checkbox', checked:filtros[key] || null, onchange:e => { filtros[key] = e.target.checked; repintar(); } }),
        el('span', {}, label));
    }
  }

  /* ---------- Lista ---------- */
  function aplicar(grupos){
    return grupos.map(g => {
      let ofertas = g.ofertas;
      if (filtros.tipos.size)   ofertas = ofertas.filter(o => filtros.tipos.has(STORE_BY_ID[o.tiendaId]?.tipo));
      if (filtros.tiendas.size) ofertas = ofertas.filter(o => filtros.tiendas.has(o.tiendaId));
      if (filtros.envioGratis)  ofertas = ofertas.filter(o => !o.envio);
      if (filtros.cuotas)       ofertas = ofertas.filter(o => o.cuotas >= 3 && (o.demo === false ? !!o.cuotaValor : true));
      if (filtros.sinImpuestos) ofertas = ofertas.filter(o => !o.costo.impuestosARS);
      if (filtros.mayorista)    ofertas = ofertas.filter(o => o.mayorista);
      if (filtros.precioMax)    ofertas = ofertas.filter(o => o.costo.finalARS <= filtros.precioMax);
      if (!ofertas.length) return null;
      const mejor = ofertas[0], peor = ofertas[ofertas.length - 1];
      return { ...g, ofertas, mejor, peor,
        ahorro:Math.max(0, peor.costo.finalARS - mejor.costo.finalARS),
        ahorroPct: peor.costo.finalARS ? Math.round((1 - mejor.costo.finalARS / peor.costo.finalARS) * 100) : 0,
        tiendas:new Set(ofertas.map(o => o.tiendaId)).size };
    }).filter(Boolean);
  }

  function repintar(){
    if (!datos) return;
    let g = aplicar(datos.grupos);
    const o = filtros.orden;
    g.sort((a,b) =>
      o === 'precio'  ? a.mejor.costo.finalARS - b.mejor.costo.finalARS :
      o === 'ahorro'  ? b.ahorroPct - a.ahorroPct :
      o === 'entrega' ? a.mejor.entregaDias[0] - b.mejor.entregaDias[0] :
      o === 'tiendas' ? b.tiendas - a.tiendas :
      (b.rel * 2 + b.demanda / 10) - (a.rel * 2 + a.demanda / 10));

    pintarCabecera();
    if (!g.length){ lista.replaceChildren(sinResultados(datos, q, ir, rubro)); return; }

    const resumen = el('div', { class:'card', style:{ marginBottom:'14px', borderColor:'var(--win)' } },
      el('div', { class:'row-b wrapf' },
        el('div', {},
          el('div', { class:'kicker' }, 'Resumen de la comparación'),
          el('div', { style:{ fontWeight:'800', fontSize:'15px' } },
            `${g.length} productos · ahorro máximo ${plata(Math.max(...g.map(x => x.ahorro)))}`)),
        el('div', { class:'row wrapf' },
          mini('El más barato', plata(Math.min(...g.map(x => x.mejor.costo.finalARS)))),
          mini('Tiendas', String(new Set(g.flatMap(x => x.ofertas.map(o => o.tiendaId))).size)),
          mini('Régimen', filtros.regimen === 'courier' ? 'Courier' : 'Formal'))));

    const cont = el('div');
    g.slice(0, 60).forEach((x, i) => cont.append(filaCluster(x, {
      abierto: i === 0,
      onVerFicha: item => {
        /* Los productos de una tienda conectada no tienen id nuestro:
           los identificamos por su título, que es lo que sí tienen. */
        const clave = item.productoId || item.titulo;
        if (clave) ir(`#/producto/${encodeURIComponent(clave)}`);
        else if (item.url) window.open(item.url, '_blank', 'noopener');
      }
    })));
    lista.replaceChildren(resumen, cont);
  }

  function recalcular(){
    if (!datos?.crudo) return;
    datos = { ...procesar(datos.crudo, q, { regimen:filtros.regimen, orden:filtros.orden }), crudo:datos.crudo, meta:datos.meta };
    repintar();
  }

  /* ---------- Carga ---------- */
  if (q) registrarBusqueda(q);
  pintarCabecera();

  function cargar(forzar = false, siguiente = false){
  if (forzar){ pagina = 0; acumulado = []; lista.replaceChildren(esqueleto(6)); masBoton.replaceChildren(); }
  if (siguiente) masBoton.replaceChildren(el('div', { class:'card center tiny dim', style:{ padding:'14px' } }, 'Buscando más…'));
  buscar(q, { rubro, mayorista:filtros.mayorista, regimen:filtros.regimen, orden:filtros.orden, forzar,
              desde: pagina * POR_PAGINA, limite: POR_PAGINA },
    est => {
      progreso.replaceChildren(barraProgreso(est.tiendas));
      if (est.listo) setTimeout(() => progreso.replaceChildren(
        el('div', { class:'tiny dim', style:{ marginBottom:'12px' } },
          `Consultamos ${est.tiendas.length} tiendas · ${est.tiendas.filter(t => t.estado === 'fail').length} no respondieron`)), 900);
    })
    .then(res => {
      const vistos = new Set(acumulado.map(g => g.clave));
      const nuevos = res.grupos.filter(g => !vistos.has(g.clave));
      acumulado = acumulado.concat(nuevos);
      datos = { ...res, grupos:acumulado, crudo: acumulado.flatMap(g => g.ofertas) };
      pintarFiltros();
      repintar();

      if (nuevos.length && res.meta?.hayMas !== false){
        masBoton.replaceChildren(el('button', {
          class:'btn btn-win btn-block btn-lg',
          onclick:() => { pagina++; cargar(false, true); }
        }, 'Ver más resultados'));
      } else {
        masBoton.replaceChildren(acumulado.length
          ? el('div', { class:'card center tiny dim', style:{ padding:'14px' } },
              `Llegaste al final: ${acumulado.length} productos comparados.`)
          : el('div'));
      }
    })
    .catch(e => { lista.replaceChildren(vacio('Se cayó la búsqueda', String(e.message || e))); });
  }
  cargar();

  /* Refresco automático mientras la pestaña esté a la vista */
  const reloj = setInterval(() => { if (!document.hidden && document.body.contains(raiz)) cargar(true); }, 120000);
  new MutationObserver(() => { if (!document.body.contains(raiz)) clearInterval(reloj); })
    .observe(document.body, { childList:true, subtree:true });

  return raiz;
}

const mini = (k, v) => el('div', { style:{ textAlign:'right' } },
  el('div', { class:'kicker' }, k),
  el('div', { style:{ fontWeight:'900', fontSize:'16px' } }, v));


/* ------------------------------------------------------------------
   Cuando no hay resultados hay que decir POR QUÉ, y no echarle la
   culpa a los filtros si el problema es que nadie lo tiene.
   Y es el mejor momento para ofrecer las dos cosas que sí resuelven:
   traerlo de afuera, o pedirlo y que compitan por conseguirlo.
   ------------------------------------------------------------------ */
function sinResultados(datos, q, ir, rubro){
  const hayFiltros = datos && datos.grupos && datos.grupos.length > 0;
  const meta = datos?.meta;
  const sinTiendas = rubro && tiendasActivas({ rubro }).filter(t => t.tipo !== 'propio').length === 0;
  const nombreRubro = rubro ? (RUBRO_BY_ID[rubro]?.nombre || rubro) : null;
  /* Si la mayoría de las tiendas no contestó, el problema no es que no
     haya productos: es que el backend no las está atendiendo. Decirlo
     es la diferencia entre un error que se arregla y uno que se oculta. */
  const fallaron = meta ? meta.tiendasTotal - meta.tiendasOk : 0;
  const casiTodasFallaron = meta && meta.tiendasTotal > 0 && fallaron >= meta.tiendasTotal * 0.6;

  return el('div', { class:'card', style:{ padding:'36px 28px', textAlign:'center' } },
    el('div', { style:{ fontSize:'40px', marginBottom:'10px' } }, hayFiltros ? '🔎' : '🤷'),
    el('h3', { style:{ marginBottom:'8px' } },
      hayFiltros ? 'Tus filtros dejaron todo afuera'
      : casiTodasFallaron ? 'Las tiendas no están respondiendo'
      : sinTiendas ? `Todavía no tenemos tiendas de ${nombreRubro}`
      : `Ninguna tienda tiene "${q}" disponible`),
    el('p', { class:'muted tiny', style:{ maxWidth:'60ch', margin:'0 auto 6px' } },
      hayFiltros
        ? 'Hay productos, pero ninguno entra en lo que pediste. Probá aflojar el precio máximo o sumar tiendas.'
        : casiTodasFallaron
          ? `${fallaron} de ${meta.tiendasTotal} tiendas no contestaron. No es que no haya productos: es un problema nuestro de conexión. Mirá el estado en Conectores.`
        : sinTiendas
          ? `Todavía no hay ninguna tienda de ${nombreRubro} conectada a NiJu. Pero eso no quiere decir que no te lo podamos conseguir: podemos traerlo de afuera o salir a buscarlo por vos.`
          : 'Buscamos en todas las tiendas conectadas. Lo que había estaba sin stock o no tenía que ver con lo que buscás, así que preferimos no mostrarte nada antes que mostrarte cualquier cosa.'),
    meta ? el('p', { class:'tiny dim', style:{ marginBottom:'14px' } },
      `Consultamos ${meta.tiendasOk} de ${meta.tiendasTotal} tiendas.`) : null,

    hayFiltros ? null : el('div', { class:'notice notice-bad', style:{ textAlign:'left', maxWidth:'640px', margin:'0 auto 20px' } },
      el('b', {}, 'Ojo: las tiendas internacionales todavía no están buscando de verdad. '),
      'Amazon, eBay, AliExpress y las demás están en modo demostración: simulan precios sobre una lista corta de productos, ' +
      'así que no pueden encontrar cualquier cosa. Para que busquen en serio hay que cargarles su clave ' +
      '(eBay y Best Buy son gratis y se hacen en quince minutos).'),

    casiTodasFallaron ? el('button', { class:'btn btn-win', style:{ marginBottom:'16px' },
      onclick:() => ir('#/tiendas') }, 'Ver qué tienda falla') : null,

    hayFiltros ? null : el('div', { class:'grid g-2', style:{ maxWidth:'620px', margin:'0 auto', textAlign:'left' } },
      el('div', { class:'card hoverable', onclick:() => ir(`#/pedido?q=${encodeURIComponent(q)}`) },
        el('b', {}, '🎯 Traelo por mí'),
        el('p', { class:'tiny muted', style:{ marginTop:'6px' } },
          'Si lo viste en una tienda de afuera, pegá el link y te lo traemos con todos los trámites hechos.')),
      el('div', { class:'card hoverable', onclick:() => ir('#/demanda') },
        el('b', {}, '📣 Pedí y que compitan'),
        el('p', { class:'tiny muted', style:{ marginTop:'6px' } },
          'Decí cuánto pagarías y dejá que salgan a buscártelo. Si nadie lo consigue, no pagás nada.'))));
}
