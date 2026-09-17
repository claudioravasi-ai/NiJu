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
import { CONFIG } from '../config.js';
import { PERFILES } from '../engine/fiscal.js';

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
  let progresoTiendas = { ok:0, total:0 };
  let parcialPendiente = null, ultimoParcial = 0;
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
          el('i'), listo ? `En vivo en ${meta.tiendasOk} tiendas`
            : progresoTiendas.total ? `Buscando: respondieron ${progresoTiendas.ok} de ${progresoTiendas.total} tiendas` : 'Consultando tiendas…',
          listo ? hace : null),
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

    /* La fila de pastillas se desliza: flechas y degradado avisan de qué lado hay
       más. Antes la última tienda quedaba cortada en seco y parecía rota. */
    const flecha = (lado, icono, etiqueta) => el('button', { class:`v-chips-flecha ${lado}`, 'aria-label':etiqueta, tabindex:'-1',
      onclick:() => chips.scrollBy({ left:(lado === 'izq' ? -1 : 1) * Math.max(160, chips.clientWidth * 0.7), behavior:'smooth' }) }, ic(icono));
    const caja = el('div', { class:'v-chips-caja' }, flecha('izq', 'izq', 'Ver filtros anteriores'), chips, flecha('der', 'der', 'Ver más filtros'));
    const bordes = () => {
      const max = chips.scrollWidth - chips.clientWidth;
      caja.classList.toggle('hay-izq', chips.scrollLeft > 4);
      caja.classList.toggle('hay-der', chips.scrollLeft < max - 4);
    };
    chips.addEventListener('scroll', bordes, { passive:true });
    if (!toolbar._bordes){ toolbar._bordes = true; addEventListener('resize', () => toolbar._medir?.()); }
    toolbar._medir = bordes;

    toolbar.replaceChildren(
      el('button', { class:'v-btn-filtros' + (!MOVIL.matches && conFiltros ? ' on' : ''), onclick:abrirFiltros },
        ic('filtro'), 'Filtros', n ? el('b', {}, String(n)) : null),
      caja,
      el('label', { class:'v-orden' }, el('span', {}, 'Ordenar por'),
        el('select', { onchange:e => cambiar(() => filtros.orden = e.target.value) },
          ...ORDENES.map(o => el('option', { value:o.id, selected:filtros.orden === o.id || null }, o.n)))),
      selectorVista(vista, v => { vista = v; pintarLista(); }));
    chips.scrollLeft = antes;
    requestAnimationFrame(bordes);
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
          el('button', { class:'v-chip' + (filtros.regimen === id ? ' on' : ''), onclick:() => { filtros.regimen = id; recalcular(); } }, texto))),
        el('p', { class:'v-ayuda' },
          'Solo cambia cómo estimamos los impuestos de lo que viene de afuera. Courier: pequeño envío para uso personal (hasta US$ 3.000, 50 kg y 3 unidades iguales, 5 envíos por año). Importación formal: con despachante, para vender o compras grandes.')));
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
    if (!g.length){
      destacados.replaceChildren('');
      /* Mientras siguen contestando tiendas, "no hay nada" todavía no es cierto. */
      lista.replaceChildren(cargando ? esqueletoGrilla(8) : sinResultados({ datos, q, ir, rubro, filtros }));
      return;
    }
    const faltan = progresoTiendas.total - progresoTiendas.ok;
    destacados.replaceChildren(cargando && faltan > 0
      ? el('div', { class:'v-sigue', role:'status' }, el('i'),
          `Te mostramos lo que ya llegó. Seguimos buscando en ${faltan} ${faltan === 1 ? 'tienda' : 'tiendas'} más: la lista se completa sola.`)
      : franjaDestacados(g, abrir) || '');
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
        progresoTiendas = { ok:contestaron, total:est.tiendas.length };
        if (!siguiente && !callado && !est.listo && est.ofertas?.length) mostrarParcial(est.ofertas, mio);
        else pintarCabecera();
      })
    .then(res => {
      if (mio !== turno) return;
      clearTimeout(parcialPendiente);
      if (!siguiente) acumulado = [];   // lo parcial se reemplaza por el resultado completo
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

  /* Resultados parciales: como mucho una repintada cada 350 ms, para que
     la lista no salte con cada tienda que contesta. */
  function mostrarParcial(ofertas, mio){
    clearTimeout(parcialPendiente);
    parcialPendiente = setTimeout(() => {
      if (mio !== turno || !cargando) return;
      ultimoParcial = Date.now();
      const crudo = ofertas.slice();
      const res = procesar(crudo, q, { rubro, mayorista:filtros.mayorista, regimen:filtros.regimen, orden:filtros.orden });
      acumulado = res.grupos;
      datos = { ...res, crudo, meta:{ parcial:true } };
      repintar(false); pintarFiltros();
    }, Math.max(0, 350 - (Date.now() - ultimoParcial)));
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

/** Buscar sin palabra (rediseño 17-09-2026, pedido de Claudio: se veía
    "aislada, sin bordes ni contención"). Todo va en tarjetas: buscador
    grande con ejemplos que rotan, lo más buscado como ranking, tus últimas
    búsquedas, tiendas en vivo para entrar a una, categorías y atajos a
    los servicios de NiJu. */
function inicioBusqueda(ir){
  const input = el('input', { type:'search', enterkeyhint:'search', placeholder:'¿Qué estás buscando?', 'aria-label':'Qué estás buscando' });
  const buscarAhora = texto => { const t = (texto ?? input.value).trim(); if (t) ir(`#/buscar?q=${encodeURIComponent(t)}`); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') buscarAhora(); });
  setTimeout(() => input.focus({ preventScroll:true }), 50);

  /* El placeholder va mostrando ejemplos, como invitación a escribir */
  let k = 0;
  const rotar = setInterval(() => {
    if (!input.isConnected) return clearInterval(rotar);
    if (document.activeElement !== input || !input.value) input.placeholder = `Probá con "${LO_MAS_BUSCADO[k++ % LO_MAS_BUSCADO.length]}"`;
  }, 2600);

  const recientesDe = () => (store.get('historial') || []).map(h => typeof h === 'string' ? h : h?.q).filter(Boolean)
    .filter((q, i, a) => a.indexOf(q) === i).slice(0, 6);
  const cajaRecientes = el('div');
  const pintarRecientes = () => {
    const recientes = recientesDe();
    cajaRecientes.replaceChildren(...(recientes.length ? [
      el('div', { class:'vi-card-cab' }, el('h2', {}, ic('refrescar'), 'Tus últimas búsquedas'),
        el('button', { class:'p-link tiny', onclick:() => { store.set('historial', []); pintarRecientes(); } }, 'Borrar')),
      el('div', { class:'vi-recientes' }, ...recientes.map(t => el('button', { class:'vi-reciente', onclick:() => buscarAhora(t) },
        ic('buscar'), el('span', {}, t), ic('der'))))
    ] : [
      el('div', { class:'vi-card-cab' }, el('h2', {}, ic('refrescar'), 'Tus últimas búsquedas')),
      el('p', { class:'vi-vacio' }, 'Todavía no buscaste nada. Lo que busques va a quedar acá para volver con un toque.')]));
  };
  pintarRecientes();

  const tiendas = tiendasActivas().filter(t => t.tipo !== 'propio').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const filtroTiendas = el('input', { class:'vi-filtro', type:'search', placeholder:'Filtrar tiendas…', 'aria-label':'Filtrar tiendas' });
  const gridTiendas = el('div', { class:'vi-tiendas' });
  const pintarTiendas = () => {
    const q = filtroTiendas.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const vistas = tiendas.filter(t => t.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q));
    gridTiendas.replaceChildren(...(vistas.length ? vistas.map(t => el('button', { class:'vi-tienda', title:`Recorrer ${t.nombre}`, onclick:() => ir(`#/tienda/${t.id}`) },
      logoTienda(t.id, true), el('span', {}, t.nombre))) : [el('p', { class:'vi-vacio' }, 'Ninguna tienda con ese nombre.')]));
  };
  filtroTiendas.addEventListener('input', pintarTiendas);
  pintarTiendas();

  const servicio = (icono, titulo, texto, ruta) => el('button', { class:'vi-servicio', onclick:() => ir(ruta) },
    el('span', { class:'vi-servicio-ic' }, ic(icono)), el('b', {}, titulo), el('small', {}, texto), el('span', { class:'vi-flecha' }, ic('der')));

  return el('div', { class:'wrap v-inicio' },
    el('section', { class:'v-inicio-hero' },
      el('span', { class:'vi-kicker' }, el('i'), `${tiendas.length} tiendas en vivo`),
      el('h1', {}, '¿Qué buscás hoy?'),
      el('p', {}, 'Lo buscamos en todas las tiendas a la vez y te mostramos dónde sale más barato, con el precio final a la vista.'),
      el('div', { class:'v-inicio-buscar' }, ic('buscar'), input, el('button', { onclick:() => buscarAhora() }, 'Buscar')),
      el('div', { class:'vi-pasos' }, ...[['buscar', 'Escribís una vez'], ['mundo', 'Comparamos todas'], ['etiqueta', 'Ves el precio final']]
        .map(([i, t]) => el('span', {}, ic(i), t)))),

    el('div', { class:'vi-grilla' },
      el('section', { class:'vi-card' },
        el('div', { class:'vi-card-cab' }, el('h2', {}, ic('rayo'), 'Lo más buscado')),
        el('ol', { class:'vi-ranking' }, ...LO_MAS_BUSCADO.map((t, n) => el('li', {},
          el('button', { onclick:() => buscarAhora(t) }, el('b', { class:'vi-n' }, String(n + 1)), el('span', {}, t), ic('der')))))),
      el('section', { class:'vi-card' }, cajaRecientes)),

    el('section', { class:'vi-card' },
      el('div', { class:'vi-card-cab' }, el('h2', {}, ic('casa'), 'Entrá por categoría')),
      el('div', { class:'v-inicio-cats' }, ...RUBROS.map(r => el('button', { class:'p-cat vi-cat', style:`--rc:${r.color}`, onclick:() => ir(`#/buscar?rubro=${r.id}`) },
        el('span', { class:'p-cat-ic' }, r.emo), el('b', {}, r.nombre))))),

    el('section', { class:'vi-card' },
      el('div', { class:'vi-card-cab' }, el('h2', {}, ic('tienda'), 'Comprar por tienda'), filtroTiendas),
      gridTiendas),

    el('section', { class:'vi-servicios' },
      servicio('envio', 'Traelo por mí', 'Pegá un link de cualquier tienda del mundo', '#/pedido'),
      servicio('estrella', 'Hacemos tu negocio', 'Tu idea, con estudio de mercado y financiación', '#/negocio'),
      servicio('usuario', 'Compra grupal', 'Juntos compramos más barato', '#/grupal'),
      servicio('megafono', 'Pedí y que compitan', 'Publicá lo que buscás y te ofertan', '#/demanda')));
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
   Cuando no hay resultados hay que decir POR QUÉ, con palabras simples,
   y qué hacer después, paso a paso y según la condición ante ARCA.
   Antes decía 'Ninguna tienda tiene "" disponible · 0 de 0 tiendas'
   cuando el filtro era una tienda sin conectar: no se entendía nada.
   ------------------------------------------------------------------ */
function sinResultados({ datos, q, ir, rubro, filtros }){
  const meta = datos?.meta;
  const hayProductos = datos?.grupos?.length > 0;
  const usuario = store.get('usuario');
  const perfilId = usuario?.perfilFiscal || 'consumidor_final';
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  const nombre = id => STORE_BY_ID[id]?.nombre || id;
  const noConectadas = [...filtros.tiendas].filter(id => !CONFIG.tiendasReales.includes(id)).map(nombre);
  const fallaron = meta ? meta.tiendasTotal - meta.tiendasOk : 0;
  const casiTodasFallaron = meta?.tiendasTotal > 0 && fallaron >= meta.tiendasTotal * 0.6;
  const ningunaConsultada = meta && meta.tiendasTotal === 0;
  const que = q ? `"${q}"` : rubro ? `productos de ${(RUBRO_BY_ID[rubro]?.nombre || rubro).toLowerCase()}` : 'productos';

  let titulo;
  const porque = [];
  if (hayProductos){
    titulo = 'Tus filtros dejaron todo afuera';
    porque.push(`Encontramos ${num(datos.grupos.length)} productos, pero ninguno cumple todos los filtros que elegiste.`);
  } else if (casiTodasFallaron){
    titulo = 'Las tiendas no están respondiendo';
    porque.push(`${fallaron} de ${meta.tiendasTotal} tiendas no contestaron. No es que no haya productos: es un problema de conexión nuestro.`);
  } else if (ningunaConsultada){
    titulo = 'No hay tiendas para consultar con estos filtros';
    if (noConectadas.length) porque.push(`${noConectadas.join(', ')} todavía no ${noConectadas.length > 1 ? 'están conectadas' : 'está conectada'} a NiJu: no podemos leer sus precios en vivo.`);
    if (filtros.mayorista) porque.push('Elegiste "Por mayor", y todavía ninguna de las tiendas conectadas vende por mayor.');
    if (rubro && !porque.length) porque.push(`Todavía no hay tiendas de ${RUBRO_BY_ID[rubro]?.nombre || rubro} conectadas.`);
    if (!porque.length) porque.push('Con esta combinación de filtros no quedó ninguna tienda para consultar.');
  } else {
    titulo = `No encontramos ${que}`;
    porque.push(`Preguntamos en vivo en ${meta?.tiendasOk ?? 0} tiendas argentinas. Lo que había estaba sin stock o no tenía que ver con lo que buscás, y preferimos no mostrarte cualquier cosa.`);
  }

  const pasos = [];
  const hayFiltros = filtros.tiendas.size || filtros.mayorista || filtros.tipos.size || filtros.precioMin || filtros.precioMax
    || filtros.descuentoMin || filtros.envioGratis || filtros.varias || filtros.cuotas || filtros.sinImpuestos;
  if (casiTodasFallaron && esDueno()) pasos.push({ t:'Revisá los conectores', d:'Mirá cuál tienda está fallando y por qué.', accion:'Ver conectores', hacer:() => ir('#/tiendas') });
  if (hayFiltros) pasos.push({ t:'Quitá los filtros', d:'Mirá lo que hay en todas las tiendas conectadas, sin limitar por tienda ni por mayor.', accion:'Buscar sin filtros',
    hacer:() => ir(q ? `#/buscar?q=${encodeURIComponent(q)}` : rubro ? `#/buscar?rubro=${rubro}` : '#/buscar') });
  if (!hayProductos) pasos.push({ t:'Si lo viste en otra tienda, pegá el link',
    d:`Copiá el link del producto${noConectadas.length ? ` en ${noConectadas.join(', ')}` : ''} y pegalo en "Traelo por mí". Te decimos qué es para la Aduana, cuánto pagás en cada etapa del viaje y de impuestos, y si te conviene más comprarlo acá.`,
    accion:'Ir a Traelo por mí', hacer:() => ir('#/pedido') });
  if (filtros.mayorista) pasos.push(perfilId === 'consumidor_final'
    ? { t:'Para comprar por mayor, primero tu condición', d:'Como Consumidor Final no podés importar para vender. Podés inscribirte (el Monotributo suele ser el primer paso, consultalo con un contador) o dejar que NiJu importe como importador y te venda la mercadería ya nacionalizada.', accion:'Ver mi condición', hacer:() => ir('#/impuestos?tab=perfil') }
    : { t:'Por mayor es una compra grande', d:`Como ${P.label} podés importar para vender: va como importación general, con CUIT, inscripción en el Registro de Importadores y despachante. Te acompañamos en cada paso.`, accion:'Ver cómo son las compras grandes', hacer:() => ir('#/grandes') });
  pasos.push({ t:'Pedí y que compitan', d:'Contanos qué buscás y cuánto pagarías: salimos a buscarlo. Si nadie lo consigue, no pagás nada.', accion:'Publicar el pedido', hacer:() => ir('#/demanda') });

  return el('section', { class:'v-vacio' },
    el('div', { class:'v-vacio-cab' },
      el('span', { class:'v-vacio-ic', 'aria-hidden':'true' }, ic(hayProductos ? 'filtro' : 'buscar')),
      el('div', {},
        el('h2', {}, titulo),
        ...porque.map(p => el('p', {}, p)),
        meta?.tiendasTotal ? el('small', {}, `Consultamos ${meta.tiendasOk} de ${meta.tiendasTotal} tiendas.`) : null)),
    el('p', { class:'v-vacio-condicion' }, ic('usuario'),
      usuario ? `Te orientamos como ${P.label}.` : 'No entraste con tu cuenta: te orientamos como Consumidor Final.',
      el('button', { class:'p-link', onclick:() => ir('#/impuestos?tab=perfil') }, '¿No es tu condición?')),
    el('h3', {}, 'Qué podés hacer, paso a paso'),
    el('ol', { class:'v-vacio-pasos' }, ...pasos.map((p, i) => el('li', {},
      el('span', { class:'v-vacio-n', 'aria-hidden':'true' }, String(i + 1)),
      el('div', {},
        el('b', {}, p.t), el('p', {}, p.d),
        el('button', { class:'btn btn-sm' + (i === 0 ? ' btn-win' : ''), onclick:p.hacer }, p.accion, ic('der')))))));
}
