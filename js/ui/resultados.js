/* ============================================================
   NiJu — Resultados de búsqueda
   Acá vive la promesa: el mismo producto, todas las tiendas,
   ordenado por lo que realmente vas a pagar.
   Se presenta como un marketplace grande: filtros rápidos en una
   barra que queda pegada arriba, filtros completos como enlaces a
   un costado (en el celular, en una hoja), tarjetas que reaccionan
   y más productos a medida que se baja, sin botón.
   ============================================================ */
import { el, plata, num, ic, hoja } from '../util.js';
import { buscar, procesar } from '../engine/search.js';
import { STORE_BY_ID, TIPO_META } from '../data/stores.js';
import { RUBRO_BY_ID } from '../data/catalog.js';
import { tiendasActivas } from '../connectors/registry.js';
import { store, registrarBusqueda } from '../state.js';
import { filaCluster, vacio, selectorMoneda, logoTienda, foto } from './components.js';
import { tarjetaResultado, esqueletoGrilla, descuentoDe, cargaInfinita, selectorVista, vistaGuardada } from './vitrina.js';
import { esDueno } from '../engine/sesion.js';
import { RUBROS } from '../data/catalog.js';

const ORDENES = [
  { id:'relevancia', n:'Más relevantes' },
  { id:'precio',     n:'Menor precio final' },
  { id:'ahorro',     n:'Mayor ahorro' },
  { id:'entrega',    n:'Llega antes' },
  { id:'tiendas',    n:'Más tiendas comparadas' }
];
const INTERRUPTORES = { envioGratis:'Envío gratis', varias:'En varias tiendas', cuotas:'Cuotas sin interés',
                        sinImpuestos:'Sin costo de importación', mayorista:'Por mayor' };
const MOVIL = matchMedia('(max-width: 900px)');

export function vistaResultados(params, ir){
  const q     = params.get('q') || '';
  const rubro = params.get('rubro') || null;
  const soloTienda = params.get('tienda') || null;

  /* Sin palabra, sin rubro y sin tienda no hay nada que preguntarles a las
     tiendas: antes salía "0 resultados · Ninguna tienda tiene \"\"". */
  if (!q && !rubro && !soloTienda && params.get('mayorista') !== '1') return inicioBusqueda(ir);

  const filtros = {
    tipos: new Set(),
    tiendas: new Set(soloTienda ? [soloTienda] : []),
    precioMin: null,
    precioMax: null,
    descuentoMin: 0,
    envioGratis: false,
    varias: false,
    cuotas: false,
    sinImpuestos: false,
    mayorista: params.get('mayorista') === '1',
    orden: params.get('orden') || 'relevancia',
    regimen: store.get('config').regimen || 'courier'
  };

  let datos = null;
  let pagina = 0, acumulado = [], hayMas = false;
  let cargando = false, turno = 0;
  let visibles = [];
  let vista = vistaGuardada();
  let conFiltros = true;      // en la computadora, la columna de filtros se puede esconder
  let hojaFiltros = null;     // en el celular, los filtros van en una hoja
  const POR_PAGINA = 24;

  /* Los productos de una tienda conectada no tienen id nuestro:
     los identificamos por su título, que es lo que sí tienen. */
  const abrir = item => {
    const clave = item.productoId || item.titulo;
    if (clave) ir(`#/producto/${encodeURIComponent(clave)}`);
    else if (item.url) window.open(item.url, '_blank', 'noopener');
  };

  const raiz = el('div', { class:'wrap v-res' });
  const cab = el('header', { class:'v-cab' });
  const progreso = el('div', { class:'v-progreso' }, el('i'));
  const toolbar = el('div', { class:'v-toolbar' });
  const activos = el('div', { class:'v-activos' });
  const aside = el('aside', { class:'v-filtros', 'aria-label':'Filtros' });
  const destacados = el('div');
  const lista = el('div', {}, esqueletoGrilla(8));
  const infinita = cargaInfinita(() => { if (!cargando && hayMas){ pagina++; cargar({ siguiente:true }); } });
  const layout = el('div', { class:'v-layout' }, aside, el('div', { class:'v-main' }, destacados, lista, infinita.nodo));
  raiz.append(cab, progreso, toolbar, activos, layout);

  /* ---------- Cabecera ---------- */
  const hace = el('small');
  function pintarCabecera(){
    const titulo = q || (rubro ? RUBRO_BY_ID[rubro]?.nombre : 'Todas las ofertas');
    const meta = datos?.meta;
    const listo = meta && !cargando;
    cab.replaceChildren(
      el('nav', { class:'v-migas', 'aria-label':'Estás en' },
        el('a', { href:'#/' }, 'Inicio'), ic('der'),
        el('span', {}, rubro ? 'Categorías' : 'Búsqueda')),
      el('div', { class:'v-cab-fila' },
        el('h1', {}, titulo),
        datos ? el('span', { class:'v-cuenta' }, `${num(visibles.length)} ${visibles.length === 1 ? 'resultado' : 'resultados'}`) : null,
        el('span', { class:'spacer' }),
        el('span', { class:'v-vivo' + (listo ? '' : ' esperando'), title:'Cada precio se le pregunta a la tienda en el momento' },
          el('i'), listo ? `En vivo en ${meta.tiendasOk} tiendas` : 'Consultando tiendas…', listo ? hace : null),
        el('button', { class:'v-refrescar' + (cargando ? ' girando' : ''), title:'Volver a preguntarle el precio a cada tienda',
                       'aria-label':'Actualizar precios', onclick:() => cargar({ forzar:true }) }, ic('refrescar'))));
    actualizarHace();
  }
  function actualizarHace(){
    const t = datos?.meta?.consultado;
    if (!t) return;
    const s = Math.round((Date.now() - t) / 1000);
    hace.textContent = ' · ' + (s < 60 ? `hace ${Math.max(s, 1)} s` : `hace ${Math.round(s / 60)} min`);
  }

  /* ---------- Barra pegada: filtros rápidos, orden y vista ---------- */
  function pintarToolbar(){
    const antes = toolbar.querySelector('.v-chips')?.scrollLeft || 0;
    const top = Object.entries(contarTiendas()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
    for (const id of filtros.tiendas) if (!top.includes(id)) top.unshift(id);   // las elegidas, siempre a la vista

    const chip = (texto, activo, alHacer, antesDe = null) => el('button', {
      class:'v-chip' + (activo ? ' on' : ''), 'aria-pressed':String(!!activo), onclick:() => cambiar(alHacer)
    }, antesDe, texto, activo ? ic('x', 'ic v-chip-x') : null);

    const n = cuantosFiltros();
    const chips = el('div', { class:'v-chips' },
      chip('Envío gratis', filtros.envioGratis, () => filtros.envioGratis = !filtros.envioGratis),
      chip('Con descuento', filtros.descuentoMin > 0, () => filtros.descuentoMin = filtros.descuentoMin ? 0 : 10),
      chip('En varias tiendas', filtros.varias, () => filtros.varias = !filtros.varias),
      ...top.map(id => chip(STORE_BY_ID[id]?.nombre || id, filtros.tiendas.has(id), () => alternar(filtros.tiendas, id), logoTienda(id))));

    toolbar.replaceChildren(
      el('button', { class:'v-btn-filtros' + (!MOVIL.matches && conFiltros ? ' on' : ''), onclick:abrirFiltros },
        ic('filtro'), 'Filtros', n ? el('b', {}, String(n)) : null),
      chips,
      el('label', { class:'v-orden' }, el('span', {}, 'Ordenar por'),
        el('select', { onchange:e => cambiar(() => filtros.orden = e.target.value) },
          ...ORDENES.map(o => el('option', { value:o.id, selected:filtros.orden === o.id || null }, o.n)))),
      selectorVista(vista, v => { vista = v; pintarLista(); }));
    chips.scrollLeft = antes;
  }

  function abrirFiltros(){
    if (!MOVIL.matches){
      conFiltros = !conFiltros;
      layout.classList.toggle('sin-filtros', !conFiltros);
      pintarToolbar();
      return;
    }
    const cont = el('div');
    hojaFiltros = { cont, ...hoja({ titulo:'Filtrar', cuerpo:cont, alCerrar:() => { hojaFiltros = null; } }) };
    pintarFiltros();
  }

  /* ---------- Filtros aplicados ---------- */
  function pintarActivos(){
    const p = [];
    const pastilla = (texto, quitar) => p.push(el('button', { class:'v-activo', title:'Quitar este filtro', onclick:() => cambiar(quitar) }, texto, ic('x')));
    for (const k of filtros.tipos) pastilla(TIPO_META[k]?.label || k, () => filtros.tipos.delete(k));
    for (const id of filtros.tiendas) pastilla(STORE_BY_ID[id]?.nombre || id, () => filtros.tiendas.delete(id));
    if (filtros.precioMin || filtros.precioMax) pastilla(textoRango(filtros.precioMin, filtros.precioMax), () => { filtros.precioMin = filtros.precioMax = null; });
    if (filtros.descuentoMin) pastilla(`${filtros.descuentoMin}% OFF o más`, () => filtros.descuentoMin = 0);
    for (const [k, nombre] of Object.entries(INTERRUPTORES)) if (filtros[k]) pastilla(nombre, () => filtros[k] = false);
    if (p.length > 1) p.push(el('button', { class:'v-limpiar', onclick:() => cambiar(limpiar) }, 'Limpiar todo'));
    activos.replaceChildren(...p);
  }

  function limpiar(){
    filtros.tipos.clear(); filtros.tiendas.clear();
    filtros.precioMin = filtros.precioMax = null; filtros.descuentoMin = 0;
    for (const k of Object.keys(INTERRUPTORES)) filtros[k] = false;
  }

  /* ---------- Filtros completos ---------- */
  function armarFiltros(){
    if (!datos) return el('div', {}, el('div', { class:'v-sk', style:{ height:'160px' } }));
    const porTienda = contarTiendas();
    const porTipo = {};
    for (const g of datos.grupos) for (const o of g.ofertas){ const t = STORE_BY_ID[o.tiendaId]?.tipo; porTipo[t] = (porTipo[t] || 0) + 1; }

    const grupo = (titulo, ...hijos) => el('div', { class:'v-fgrupo' }, el('h4', {}, titulo), ...hijos);
    const opcion = (texto, activo, alHacer, cuenta, antesDe = null) => el('button', {
      class:'v-fop' + (activo ? ' on' : ''), 'aria-pressed':String(!!activo), onclick:() => cambiar(alHacer)
    }, antesDe, el('span', { class:'spacer' }, texto), cuenta != null ? el('small', {}, num(cuenta)) : null);
    const interruptor = clave => el('label', { class:'v-switch' }, el('span', {}, INTERRUPTORES[clave]),
      el('input', { type:'checkbox', checked:filtros[clave] || null, onchange:() => cambiar(() => filtros[clave] = !filtros[clave]) }),
      el('i'));

    /* Tiendas: las seis que más traen y el resto a pedido */
    const ordenT = Object.entries(porTienda).sort((a, b) => b[1] - a[1]);
    let todas = false;
    const listaT = el('div');
    const pintarT = () => listaT.replaceChildren(
      ...ordenT.slice(0, todas ? ordenT.length : 6).map(([id, n]) =>
        opcion(STORE_BY_ID[id]?.nombre || id, filtros.tiendas.has(id), () => alternar(filtros.tiendas, id), n, logoTienda(id))),
      ...(ordenT.length > 6 ? [el('button', { class:'p-link', onclick:() => { todas = !todas; pintarT(); } },
        todas ? 'Ver menos' : `Ver las ${ordenT.length} tiendas`)] : []));
    pintarT();

    /* Precio: tres tramos armados con los precios de esta búsqueda */
    const precios = datos.grupos.map(g => g.mejor.costo.finalARS).sort((a, b) => a - b);
    const redondo = n => { const p = 10 ** Math.max(2, Math.floor(Math.log10(n || 1)) - 1); return Math.round(n / p) * p; };
    const c1 = redondo(precios[Math.floor(precios.length / 3)]);
    const c2 = redondo(precios[Math.floor(precios.length * 2 / 3)]);
    const tramos = precios.length >= 6 && c1 < c2 ? [[null, c1], [c1, c2], [c2, null]] : [];
    const enTramo = (min, max) => precios.filter(p => (!min || p >= min) && (!max || p <= max)).length;
    const inMin = el('input', { type:'number', inputmode:'numeric', placeholder:'Mínimo', 'aria-label':'Precio mínimo', value:filtros.precioMin ?? '' });
    const inMax = el('input', { type:'number', inputmode:'numeric', placeholder:'Máximo', 'aria-label':'Precio máximo', value:filtros.precioMax ?? '' });
    const aplicarRango = () => cambiar(() => { filtros.precioMin = +inMin.value || null; filtros.precioMax = +inMax.value || null; });
    for (const i of [inMin, inMax]) i.addEventListener('keydown', e => { if (e.key === 'Enter') aplicarRango(); });

    const descuentos = [10, 25, 40]
      .map(x => [x, datos.grupos.filter(g => g.ofertas.some(o => descuentoDe(o) >= x)).length])
      .filter(([, n]) => n);
    const tipos = Object.keys(TIPO_META).filter(k => porTipo[k]);

    return el('div', {},
      grupo('Envío y condiciones', ...Object.keys(INTERRUPTORES).map(interruptor)),
      descuentos.length ? grupo('Descuentos', ...descuentos.map(([x, n]) =>
        opcion(`${x}% OFF o más`, filtros.descuentoMin === x, () => filtros.descuentoMin = filtros.descuentoMin === x ? 0 : x, n))) : null,
      grupo('Precio final',
        ...tramos.map(([min, max]) => {
          const activo = filtros.precioMin === min && filtros.precioMax === max;
          return opcion(textoRango(min, max), activo, () => { filtros.precioMin = activo ? null : min; filtros.precioMax = activo ? null : max; }, enTramo(min, max));
        }),
        el('div', { class:'v-rango' }, inMin, '–', inMax,
          el('button', { 'aria-label':'Aplicar precio', onclick:aplicarRango }, ic('der')))),
      grupo('Tiendas', listaT),
      tipos.length > 1 ? grupo('Origen', ...tipos.map(k =>
        opcion(TIPO_META[k].label, filtros.tipos.has(k), () => alternar(filtros.tipos, k), porTipo[k]))) : null,
      grupo('Cómo ver los precios',
        selectorMoneda(() => repintar()),
        el('div', { class:'v-segmento' }, ...[['courier', 'Courier puerta a puerta'], ['general', 'Importación formal']].map(([id, texto]) =>
          el('button', { class:'v-chip' + (filtros.regimen === id ? ' on' : ''), onclick:() => { filtros.regimen = id; recalcular(); } }, texto)))));
  }

  function pintarFiltros(){
    const scroll = aside.scrollTop;
    aside.replaceChildren(armarFiltros());
    aside.scrollTop = scroll;
    if (hojaFiltros?.cont.isConnected){
      hojaFiltros.cont.replaceChildren(armarFiltros(),
        el('div', { class:'v-hoja-pie' },
          el('button', { class:'btn btn-win btn-lg btn-block', onclick:() => hojaFiltros.cerrar() },
            `Ver ${num(visibles.length)} resultados`)));
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
      if (filtros.descuentoMin) ofertas = ofertas.filter(o => descuentoDe(o) >= filtros.descuentoMin);
      if (filtros.precioMin)    ofertas = ofertas.filter(o => o.costo.finalARS >= filtros.precioMin);
      if (filtros.precioMax)    ofertas = ofertas.filter(o => o.costo.finalARS <= filtros.precioMax);
      if (!ofertas.length) return null;
      const tiendas = new Set(ofertas.map(o => o.tiendaId)).size;
      if (filtros.varias && tiendas < 2) return null;
      const mejor = ofertas[0], peor = ofertas[ofertas.length - 1];
      return { ...g, ofertas, mejor, peor, tiendas,
        ahorro:Math.max(0, peor.costo.finalARS - mejor.costo.finalARS),
        ahorroPct: peor.costo.finalARS ? Math.round((1 - mejor.costo.finalARS / peor.costo.finalARS) * 100) : 0 };
    }).filter(Boolean);
  }

  function repintar(animar = true){
    if (!datos){ pintarCabecera(); pintarToolbar(); return; }
    const g = aplicar(datos.grupos);
    const o = filtros.orden;
    g.sort((a,b) =>
      o === 'precio'  ? a.mejor.costo.finalARS - b.mejor.costo.finalARS :
      o === 'ahorro'  ? b.ahorroPct - a.ahorroPct :
      o === 'entrega' ? a.mejor.entregaDias[0] - b.mejor.entregaDias[0] :
      o === 'tiendas' ? b.tiendas - a.tiendas :
      (b.rel * 2 + b.demanda / 10) - (a.rel * 2 + a.demanda / 10));
    visibles = g;

    pintarCabecera(); pintarToolbar(); pintarActivos();
    if (!g.length){ destacados.replaceChildren(); lista.replaceChildren(sinResultados(datos, q, ir, rubro)); return; }
    destacados.replaceChildren(franjaDestacados(g, abrir) || '');
    pintarLista(animar);
  }

  function pintarLista(animar = true){
    if (!visibles.length) return;
    lista.replaceChildren(vista === 'lista'
      ? el('div', {}, ...visibles.map((x, i) => filaCluster(x, { abierto:i === 0, onVerFicha:abrir })))
      : el('div', { class:'v-grilla' + (animar ? '' : ' quieta') }, ...visibles.map(x => tarjetaResultado(x, { abrir }))));
  }

  function cambiar(fn){ fn(); repintar(); pintarFiltros(); }
  const alternar = (conjunto, v) => conjunto.has(v) ? conjunto.delete(v) : conjunto.add(v);
  function contarTiendas(){
    const c = {};
    for (const g of datos?.grupos || []) for (const o of g.ofertas) c[o.tiendaId] = (c[o.tiendaId] || 0) + 1;
    return c;
  }
  const cuantosFiltros = () => filtros.tipos.size + filtros.tiendas.size
    + (filtros.precioMin || filtros.precioMax ? 1 : 0) + (filtros.descuentoMin ? 1 : 0)
    + Object.keys(INTERRUPTORES).filter(k => filtros[k]).length;

  function recalcular(){
    if (!datos?.crudo) return;
    datos = { ...procesar(datos.crudo, q, { regimen:filtros.regimen, orden:filtros.orden }), crudo:datos.crudo, meta:datos.meta };
    repintar(); pintarFiltros();
  }

  /* ---------- Carga ---------- */
  if (q) registrarBusqueda(q);

  /* forzar: vuelve a preguntar desde la primera página.
     siguiente: suma la página que sigue al pie.
     callado: refresca sin tapar la lista con el esqueleto. */
  function cargar({ forzar = false, siguiente = false, callado = false } = {}){
    const mio = ++turno;   // si llega una respuesta vieja, se descarta
    cargando = true;
    if (forzar){
      pagina = 0; acumulado = []; hayMas = false;
      if (!callado){ lista.replaceChildren(esqueletoGrilla(8)); destacados.replaceChildren(); }
    }
    infinita.estado(siguiente ? 'buscando' : 'oculto');
    progreso.classList.remove('listo');
    progreso.firstChild.style.width = '4%';
    pintarCabecera();

    buscar(q, { rubro, mayorista:filtros.mayorista, regimen:filtros.regimen, orden:filtros.orden, forzar,
                desde: pagina * POR_PAGINA, limite: POR_PAGINA },
      est => {
        if (mio !== turno) return;
        const contestaron = est.tiendas.filter(t => t.estado !== 'run').length;
        progreso.firstChild.style.width = Math.max(4, est.tiendas.length ? contestaron / est.tiendas.length * 100 : 100) + '%';
        if (est.listo) progreso.classList.add('listo');
      })
    .then(res => {
      if (mio !== turno) return;
      const vistos = new Set(acumulado.map(g => g.clave));
      const nuevos = res.grupos.filter(g => !vistos.has(g.clave));
      acumulado = acumulado.concat(nuevos);
      datos = { ...res, grupos:acumulado, crudo: acumulado.flatMap(g => g.ofertas) };
      hayMas = nuevos.length > 0 && res.meta?.hayMas !== false;
      cargando = false;
      repintar(!siguiente && !callado);
      pintarFiltros();
      infinita.estado(hayMas ? 'espera' : acumulado.length ? 'fin' : 'oculto', acumulado.length);
    })
    .catch(e => {
      if (mio !== turno) return;
      cargando = false;
      pintarCabecera();
      lista.replaceChildren(vacio('Se cayó la búsqueda', String(e.message || e)));
      infinita.estado('oculto');
    });
  }

  pintarCabecera(); pintarToolbar(); pintarFiltros();
  cargar();

  /* El "hace X s" corre solo, y cada dos minutos se refrescan los
     precios. Solo mirando la primera página: recargar con el cliente
     en la tercera lo mandaría de vuelta arriba. */
  const reloj = setInterval(() => {
    if (!raiz.isConnected){ clearInterval(reloj); return; }
    actualizarHace();
    const consultado = datos?.meta?.consultado;
    if (consultado && !document.hidden && !cargando && pagina === 0 && scrollY < 400 && Date.now() - consultado > 120000)
      cargar({ forzar:true, callado:true });
  }, 5000);

  return raiz;
}

const LO_MAS_BUSCADO = ['zapatillas', 'air fryer', 'notebook', 'smart tv', 'perfume', 'celular', 'taladro', 'aceite de girasol'];

/** Buscar sin palabra: buscador grande, lo más buscado, tus últimas
    búsquedas y las categorías. */
function inicioBusqueda(ir){
  const input = el('input', { type:'search', enterkeyhint:'search', placeholder:'¿Qué estás buscando?', 'aria-label':'Qué estás buscando' });
  const buscarAhora = texto => { const t = (texto ?? input.value).trim(); if (t) ir(`#/buscar?q=${encodeURIComponent(t)}`); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') buscarAhora(); });
  const recientes = (store.get('historial') || []).map(h => typeof h === 'string' ? h : h?.q).filter(Boolean).slice(0, 6);
  const chips = lista => el('div', { class:'k2-chips' }, ...lista.map(t => el('button', { class:'v-chip', onclick:() => buscarAhora(t) }, t)));
  setTimeout(() => input.focus({ preventScroll:true }), 50);

  return el('div', { class:'wrap v-inicio' },
    el('section', { class:'v-inicio-hero' },
      el('h1', {}, '¿Qué buscás hoy?'),
      el('p', {}, 'Lo buscamos en todas las tiendas a la vez y te mostramos dónde sale más barato, con el precio final a la vista.'),
      el('div', { class:'v-inicio-buscar' }, ic('buscar'), input, el('button', { onclick:() => buscarAhora() }, 'Buscar'))),
    recientes.length ? [el('h2', {}, 'Tus últimas búsquedas'), chips(recientes)] : null,
    el('h2', {}, 'Lo más buscado'), chips(LO_MAS_BUSCADO),
    el('h2', {}, 'O entrá por categoría'),
    el('div', { class:'v-inicio-cats' }, ...RUBROS.map(r => el('button', { class:'p-cat', style:`--rc:${r.color}`, onclick:() => ir(`#/buscar?rubro=${r.id}`) },
      el('span', { class:'p-cat-ic' }, r.emo), el('b', {}, r.nombre)))));
}

const textoRango = (min, max) =>
  min && max ? `${plata(min)} a ${plata(max)}` : max ? `Hasta ${plata(max)}` : `Más de ${plata(min)}`;

/** Tres atajos arriba de la lista: lo más barato, lo más rebajado y lo
    más comparado de esta búsqueda. */
function franjaDestacados(g, abrir){
  if (g.length < 4) return null;
  const barato = g.reduce((a, b) => b.mejor.costo.finalARS < a.mejor.costo.finalARS ? b : a);
  const rebaja = g.reduce((a, b) => descuentoDe(b.mejor) > descuentoDe(a.mejor) ? b : a);
  const comparado = g.reduce((a, b) => b.tiendas > a.tiendas ? b : a);
  const items = [
    ['Precio más bajo', barato, plata(barato.mejor.costo.finalARS)],
    descuentoDe(rebaja.mejor) >= 10 ? ['Mayor descuento', rebaja, `${descuentoDe(rebaja.mejor)}% OFF`] : null,
    comparado.tiendas > 1 ? ['Más comparado', comparado,
      comparado.ahorro > 0 ? `${comparado.tiendas} tiendas · ahorrás ${plata(comparado.ahorro)}` : `${comparado.tiendas} tiendas`] : null
  ].filter(Boolean);
  return el('div', { class:'v-destacados' }, ...items.map(([k, x, v]) =>
    el('button', { class:'v-dest', onclick:() => abrir(x) },
      foto(x, 'v-dest-foto'),
      el('span', {}, el('small', {}, k), el('b', {}, v), el('span', { class:'v-dest-tit' }, x.titulo)))));
}


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

    hayFiltros || !esDueno() ? null : el('div', { class:'notice notice-bad', style:{ textAlign:'left', maxWidth:'640px', margin:'0 auto 20px' } },
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
