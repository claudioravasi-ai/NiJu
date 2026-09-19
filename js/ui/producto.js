/* ============================================================
   NiJu — Ficha comparativa de producto
   Con el armado de los comparadores grandes (ComparaYa como
   referencia, a pedido de Claudio) y los colores de NiJu:
     · arriba: foto, título, "En resumen", favorito / carrito /
       alerta de precio, rango de precios y especificaciones; al
       costado, el precio de la tienda elegida y la tarjetita del
       historial
     · solapas pegadas: Ofertas · Ficha · Historial · Tu precio ·
       Relacionados
     · todas las ofertas en renglones, con MÁS BARATO / TU PRODUCTO,
       orden, filtro por tienda y "Excluir" por palabra
     · el historial de precios en gráfico, guardado en el servidor
   Lo propio de NiJu sigue: el precio final se descompone en producto
   + envío + impuestos + gestión, y nada queda escondido.
   ============================================================ */
import { el, plata, ic, toast, hoja } from '../util.js';
import { PRODUCTO_BY_ID } from '../data/catalog.js';
import { STORE_BY_ID } from '../data/stores.js';
import { buscar } from '../engine/search.js';
import { calcularFee, TARIFARIO } from '../engine/fees.js';
import { comprobanteGestion, ALICUOTAS } from '../engine/facturacion.js';
import { consecuenciasFiscales, PERFILES } from '../engine/fiscal.js';
import { aUSD, FX } from '../engine/fx.js';
import { plazo, PROVINCIAS } from '../engine/envios.js';
import { tokens } from '../engine/normalize.js';
import { store, agregarAlCarrito, esFavorito, alternarFavorito } from '../state.js';
import { logoTienda, cargandoNiju, vacio, precioDual, foto, botonVolver } from './components.js';
import { tablaPerfiles, mejorParaVos, conviendCambiar } from '../engine/precio-fiscal.js';
import { analizar, historialCompartido, serieDiaria, resumenSerie, alertaDe, alternarAlerta } from '../engine/historial.js';
import { selectorVariantes } from './variantes.js';
import { descuentoDe } from './vitrina.js';

/**
 * Abre la ficha comparativa.
 * Puede llegar de dos formas, y las dos tienen que funcionar:
 *   · con un id de nuestro catálogo (los productos propios)
 *   · con el título de un producto real de una tienda conectada,
 *     que no tiene id nuestro porque es de ellos
 */
export function vistaProducto(clave, ir){
  const porId = PRODUCTO_BY_ID[clave];
  const raiz = el('div', { class:'wrap' });
  const cont = el('div', { class:'section' });
  cont.append(cargandoNiju());
  raiz.append(cont);

  const consulta = porId ? `${porId.marca} ${porId.n}` : decodeURIComponent(clave || '');

  buscar(consulta, {}, () => {}).then(({ grupos }) => {
    const norm = t => (t || '').toLowerCase().trim();
    const g = grupos.find(x => x.productoId && x.productoId === clave)
           || grupos.find(x => norm(x.titulo) === norm(consulta))
           || grupos[0];
    if (!g){ cont.replaceChildren(vacio('No encontramos ese producto', 'Puede que haya salido de stock en todas las tiendas.')); return; }
    cont.replaceChildren(ficha(g, ir, { grupos, consulta }));
  });

  return raiz;
}

/* ---------- piezas chicas ---------- */
/* replaceChildren del navegador escribe "null" por cada hueco: acá se
   filtran antes (el() ya los ignora, replaceChildren no). */
const poner = (nodo, ...hijos) => nodo.replaceChildren(...hijos.flat(Infinity).filter(h => h !== null && h !== undefined && h !== false));
const nombreTienda = id => STORE_BY_ID[id]?.nombre || id;
const esFull = o => (o.tags || []).includes('full');
function condicionDe(o){
  if (o.condicion === 'reacondicionado' || /reacondicionad/i.test(o.titulo || '')) return 'Reacondicionado';
  if (o.condicion === 'usado') return 'Usado';
  if (o.condicion === 'nuevo') return 'Nuevo';
  return null;
}
const cuotasSinInteres = o => (o.demo === false || o.propio) && o.cuotas > 1 ? o.cuotas : 0;
const envioGratis = o => !o.costo?.internacional && !o.envio;
const pastilla = (txt, tono = '') => el('span', { class:'fx-pill ' + tono }, txt);

/** Sellos de una oferta: solo lo que la tienda informa. */
function sellos(o){
  const cond = condicionDe(o);
  const c = cuotasSinInteres(o);
  return [
    cond && cond !== 'Nuevo' ? pastilla(cond, 'naranja') : null,
    esFull(o) ? pastilla('FULL', 'verde') : null,
    envioGratis(o) ? pastilla('Envío gratis', 'verde') : null,
    o.costo?.internacional ? pastilla('Internacional', 'violeta') : null,
    c ? pastilla(`${c} cuotas sin interés`, 'azul') : null
  ].filter(Boolean);
}

/** Especificaciones que se pueden afirmar con lo que publica la tienda. */
function especificaciones(o, g){
  const d = descuentoDe(o);
  const c = cuotasSinInteres(o);
  const cond = condicionDe(o);
  return [
    ['Tienda', nombreTienda(o.tiendaId)],
    ['Vendedor', o.vendedor && o.vendedor !== nombreTienda(o.tiendaId) ? o.vendedor : null],
    ['Marca', g.marca || o.marca || null],
    ['Modelo', o.modelo || null],
    ['Condición', cond],
    ['FULL', esFull(o) ? 'Sí' : null],
    ['Cuotas', c ? `${c} cuotas sin interés` : null],
    ['Descuento', d ? `${d}% OFF` : null],
    ['Envío gratis', o.costo?.internacional ? null : (o.envio ? 'No' : 'Sí')],
    ['Precio', o.demo === false ? 'Consultado a la tienda en este momento' : null],
    ...Object.entries(g.specs || {})
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');
}

const tablaSpecs = filas => el('div', { class:'fx-specs' },
  ...filas.map(([k, v]) => el('div', { class:'fx-spec' }, el('span', {}, k), el('b', {}, String(v)))));

/* Código de modelo: letras y números juntos, sin ser una medida
   ("256gb", "5g", "8/256gb" no son modelo). */
const MEDIDA = /^(\d+(\.\d+)?(gb|tb|mb|g|mp|mah|w|hz|mm|cm|m|ml|l|lts|kg|v|k|p|in|pulgadas))$|^[345]g$/;
const esCodigo = w => /[a-z]/.test(w) && /\d/.test(w) && !w.includes('/') && !MEDIDA.test(w);
/* Palabras que no sirven para "Excluir": unidades y números sueltos. */
const NO_EXCLUIR = new Set(['gb','tb','ram','rom','5g','4g','nfc','dual','sim','mah','mp','celular','smartphone','libre']);

/** Link a la búsqueda de Mercado Libre con las palabras del producto. */
const busquedaML = titulo => 'https://listado.mercadolibre.com.ar/' +
  encodeURIComponent(tokens(titulo).slice(0, 7).join('-'));

/* ============================================================ */
function ficha(g, ir, { grupos = [], consulta = '' } = {}){
  const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
  let elegida = g.mejor;
  let extras = new Set();
  let destino = 'uso';

  /* Las ofertas de "todas las tiendas": las del producto exacto y las
     de los grupos casi iguales (otro color, otra versión), como hacen
     los comparadores. Las que cuestan menos de un tercio o más del
     triple no son el mismo producto y quedan afuera. */
  const ref = g.mejor.costo.finalARS;
  const usadas = new Set();
  const todas = [];
  const cercanos = new Set([g]);
  /* Si el título tiene código de modelo ("A56", "WH-1000XM5"), la oferta
     parecida tiene que tenerlo: sin esto, al Galaxy A56 se le colaban el
     A16, el A07 y el A17 como "más baratos". */
  const codigos = tokens(g.titulo).filter(esCodigo);
  const parecida = (gr, o) => {
    const f = o.costo.finalARS;
    if (codigos.length){
      const ws = new Set(tokens(o.titulo));
      return codigos.every(c => ws.has(c)) && f >= ref * 0.4 && f <= ref * 2.5;
    }
    return gr.rel >= 0.7 && f >= ref * 0.5 && f <= ref * 2;
  };
  for (const gr of [g, ...grupos.filter(x => x !== g && x.rel >= 0.55)]){
    for (const o of gr.ofertas){
      if (usadas.has(o.id) || (gr !== g && !parecida(gr, o))) continue;
      usadas.add(o.id); todas.push(o); cercanos.add(gr);
    }
  }
  const tiendasTodas = [...new Set(todas.map(o => o.tiendaId))];
  const precios = todas.map(o => o.costo.finalARS);
  const minTodas = Math.min(...precios), maxTodas = Math.max(...precios);

  /* ---------- foto ---------- */
  const galeria = el('div', { class:'fx-foto' });
  const selectores = new Map();
  const selectorDe = o => {
    if (!selectores.has(o.id)) selectores.set(o.id, selectorVariantes(o, { alCambiar:() => { if (elegida === o) pintarArriba(); } }));
    return selectores.get(o.id);
  };

  const info = el('div', { class:'fx-info' });
  const lado = el('aside', { class:'fx-lado' });
  const extra = el('div', { class:'fx-extra' });
  const mini = el('button', { class:'fx-mini', onclick:() => irA('historial') });
  const secHist = el('div', { class:'fx-card fx-hist' });
  let serie = serieDiaria(null, g.ofertas);
  let desdeServidor = false;

  const secciones = {};
  const irA = id => secciones[id]?.scrollIntoView({ behavior:'smooth', block:'start' });

  /* ---------- comprar (lo usan el botón grande y "Al carrito") ---------- */
  function comprar(o, totalFinal){
    const sel = selectorDe(o);
    const e = sel.eleccion();
    if (!e.ok){ toast(e.error, 'bad'); sel.marcarFalta(); return; }
    const v = e.variante;
    agregarAlCarrito({ ...o, precio:v?.precio ?? o.precio, imagen:v?.imagen || o.imagen, costoFinal:totalFinal }, 1, v);
    toast(v?.texto ? `Agregado: ${v.texto}` : 'Agregado al carrito', 'win');
  }

  function pintarArriba(){
    const o = elegida;
    const t = STORE_BY_ID[o.tiendaId];
    const sel = selectorDe(o);
    const precioTalle = sel.precio();
    const c = precioTalle && !o.costo.internacional && Math.abs(precioTalle - o.precio) > 0.5
      ? { ...o.costo, productoARS:precioTalle, finalARS:o.costo.finalARS - o.costo.productoARS + precioTalle }
      : o.costo;

    /* La foto se cambia solo si cambia la dirección: rehacerla en cada
       repintado dejaba el cuadro vacío mientras recargaba. */
    const urlFoto = sel.imagen() || o.imagen || g.imagen || '';
    if (galeria.dataset.url !== urlFoto || !galeria.firstChild){
      galeria.dataset.url = urlFoto;
      const cuadro = foto({ imagen:urlFoto || null, titulo:o.titulo || g.titulo }, 'fx-foto-img');
      cuadro.querySelector('img')?.setAttribute('loading', 'eager');
      poner(galeria, cuadro);
    }

    /* Gestión de NiJu, facturada con IVA discriminado. En una tienda
       nacional, "Comprar por NiJu" es compra asistida y tiene el mismo
       cargo que cobra el carrito (antes acá figuraba sin cargo y el
       total del carrito no coincidía con el de la ficha). */
    const fee = calcularFee({ valorUSD:aUSD(o.precio, o.moneda), fleteUSD:aUSD(o.envio || 0, o.moneda),
      tipo:o.propio ? 'propio' : c.internacional ? 'internacional' : 'nacional-asistida',
      montoARS:c.productoARS + c.envioARS, tiendas:1, extras:[...extras] });
    const comp = comprobanteGestion({
      feeARS:fee.feeARS ?? fee.feeUSD * FX.tarjeta, incluyeIVA:true, condicion:perfilId,
      jurisdiccion:store.get('config').provincia,
      cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit }
    });
    const totalFinal = Math.round(c.productoARS + c.envioARS + c.impuestosARS + comp.total);
    const d = descuentoDe(o);

    /* ---- columna del medio ---- */
    const favId = g.productoId || g.clave;
    const btnFav = el('button', { class:'fx-accion rosa' + (esFavorito(favId) ? ' on' : ''), onclick:() => {
      alternarFavorito(favId);
      btnFav.classList.toggle('on', esFavorito(favId));
      toast(esFavorito(favId) ? 'Guardado en favoritos' : 'Lo sacamos de favoritos');
    } }, ic('corazon'), 'Favorito');

    const pisoARS = Math.min(...g.ofertas.filter(x => x.moneda === 'ARS').map(x => x.precio), Infinity);
    const btnAlerta = el('button', { class:'fx-accion violeta' + (alertaDe(g) ? ' on' : ''), onclick:() => {
      const objetivo = isFinite(pisoARS) ? pisoARS : c.productoARS;
      const activa = alternarAlerta(g, objetivo);
      btnAlerta.classList.toggle('on', activa);
      btnAlerta.lastChild.textContent = activa ? 'Alerta activada' : 'Alerta de precio';
      toast(activa ? `Te avisamos cuando baje de ${plata(objetivo)}` : 'Alerta de precio quitada', activa ? 'win' : '');
    } }, ic('campana'), el('span', {}, alertaDe(g) ? 'Alerta activada' : 'Alerta de precio'));

    poner(info, 
      el('div', { class:'fx-tienda' }, logoTienda(o.tiendaId), el('span', {}, t?.nombre || o.tiendaId)),
      g.marca ? el('div', { class:'fx-marca' }, g.marca) : null,
      el('h1', { class:'fx-titulo' }, o.titulo || g.titulo),
      el('div', { class:'fx-resumen' }, el('b', {}, 'En resumen:'),
        ...sellos(o).map(p => { p.className = 'fx-pill'; return p; }),
        d ? pastilla(`${d}% OFF`) : null,
        pastilla(o.stock > 0 ? 'En stock' : 'Sin stock')),
      el('div', { class:'fx-acciones' },
        btnFav,
        el('button', { class:'fx-accion naranja', onclick:() => comprar(o, totalFinal) }, ic('carrito'), 'Al carrito'),
        btnAlerta));

    /* Rango de precios y especificaciones: debajo del título en la
       computadora, y después del precio en el teléfono. */
    poner(extra, 
      el('div', { class:'fx-card fx-rango' },
        el('div', { class:'fx-rango-top' },
          el('span', {}, `${tiendasTodas.length} ${tiendasTodas.length === 1 ? 'tienda' : 'tiendas'} · ${todas.length} ${todas.length === 1 ? 'oferta' : 'ofertas'}`),
          el('button', { class:'fx-link', onclick:() => irA('ofertas') }, 'Ver todas')),
        el('div', { class:'fx-rango-fila' },
          el('div', {}, el('small', {}, 'Más barato'), el('b', { class:'fx-verde' }, plata(minTodas))),
          el('i', { class:'fx-barra' }),
          el('div', { class:'fx-der' }, el('small', {}, 'Más caro'), el('b', {}, plata(maxTodas))))),
      el('div', { class:'fx-card' },
        el('h3', { class:'fx-card-tit' }, 'Especificaciones'),
        tablaSpecs(especificaciones(o, g))));

    /* ---- columna del precio ---- */
    const lblPrecio = c.internacional ? `Puesto en tu casa desde ${t?.nombre || o.tiendaId}`
                    : o.envio ? `Precio en ${t?.nombre || o.tiendaId} + envío` : `Precio en ${t?.nombre || o.tiendaId}`;
    const pl = plazo({ despacho:o.entregaDias, provincia:store.get('config').provincia, internacional:c.internacional });

    poner(lado, 
      el('div', { class:'fx-caja' },
        el('small', { class:'fx-caja-lbl' }, lblPrecio),
        el('div', { class:'fx-caja-precio' },
          precioDual(c.finalARS, { clase:'fx-precio-xl', internacional:c.internacional }),
          d ? el('span', { class:'fx-off' }, `-${d}%`) : null),
        d ? el('div', { class:'fx-tachado' }, plata(o.precioLista, o.moneda)) : null,
        el('div', { class:'fx-disp' }, `Disponible en ${tiendasTodas.length} ${tiendasTodas.length === 1 ? 'tienda' : 'tiendas'}`),
        cuotasReales(o, totalFinal),
        sel.nodo,
        el('button', { class:'fx-btn fx-btn-1', onclick:() => comprar(o, totalFinal) },
          el('span', {}, o.propio ? 'Comprar ahora' : 'Comprar por NiJu'), ic('carrito')),
        o.url ? el('button', { class:'fx-btn', onclick:() => window.open(o.url, '_blank', 'noopener') },
          el('span', {}, 'Ir a ' + (t?.nombre || 'la tienda')), ic('externo')) : null,
        el('button', { class:'fx-btn', onclick:() => irA('ofertas') }, el('span', {}, 'Comparar precios'), ic('pulso'))),

      mini,

      /* El precio final con NiJu, a la vista: el total arriba y el
         detalle a un toque. */
      el('details', { class:'fx-card fx-desglose' },
        el('summary', {},
          el('span', {}, 'Con la gestión de NiJu'),
          el('b', {}, plata(totalFinal)),
          ic('flecha', 'ic fx-desglose-fl')),
        el('div', { class:'fx-desglose-cuerpo' },
          linea('Producto', c.productoARS, o.moneda !== 'ARS' ? `${plata(o.precio, o.moneda)} al dólar ${c.via}` : null),
          linea('Envío', c.envioARS, o.envio ? null : 'gratis'),
          c.impuestosARS ? linea('Impuestos de importación', c.impuestosARS,
            c.detalleImp ? `${c.detalleImp.tasaEfectiva}% efectivo · ${c.detalleImp.regimen}` : null, () => verImpuestos(c)) : null,
          comp.condicion === 'responsable_inscripto'
            ? [ linea('Gestión operativa y logística (neto)', comp.neto),
                linea(`IVA ${(ALICUOTAS.iva*100).toFixed(0)}%`, comp.iva),
                ...comp.percepciones.map(p => linea(p.k, p.v)) ]
            : [ linea('Gestión NiJu', comp.total, 'IVA incluido (Factura B)') ],
          el('div', { class:'cost-line total' }, el('span', { class:'lbl' }, 'Total a pagar'), el('b', {}, plata(totalFinal))),
          el('div', { class:'tiny dim' },
            `Emitimos Factura ${comp.letra} a nombre de ${comp.cliente.nombre}. `,
            el('a', { href:'#', style:{ color:'var(--accion)' }, onclick:e => { e.preventDefault(); verComprobante(comp); } }, 'Ver comprobante')),
          /* Los servicios extra (inspección, seguro…) son de la compra al exterior. */
          c.internacional ? el('div', { class:'row wrapf', style:{ gap:'6px' } },
            ...TARIFARIO.extras.map(x => el('button', {
              class:'chip' + (extras.has(x.id) ? ' on-win' : ''), title:x.desc,
              onclick:() => { extras.has(x.id) ? extras.delete(x.id) : extras.add(x.id); pintarArriba(); }
            }, '+ ' + x.nombre))) : null,
          el('div', { class:'field' },
            el('label', {}, 'Destino de la compra'),
            el('select', { class:'inp', onchange:e => { destino = e.target.value; pintarArriba(); } },
              el('option', { value:'uso', selected:destino === 'uso' || null }, 'Uso personal'),
              el('option', { value:'reventa', selected:destino === 'reventa' || null }, 'Reventa / comercial'))),
          c.bloqueado ? el('div', { class:'notice notice-bad' },
            'Esta compra excede los límites del courier puerta a puerta. Hay que hacerla por importación general con despachante.') : null,
          el('button', { class:'btn btn-ghost btn-block btn-sm', onclick:() => verFiscal(o, c, comp, destino, perfilId) },
            ic('calc'), 'Qué tenés que declarar en ARCA'),
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Llega en'), el('b', {}, pl.texto)),
          el('div', { class:'tiny dim' }, pl.detalle),
          el('div', { class:'field' },
            el('label', {}, 'Calcular para otra provincia'),
            el('select', { class:'inp', onchange:ev => {
              store.set('config', { ...store.get('config'), provincia:ev.target.value });
              pintarArriba();
            } }, ...Object.keys(PROVINCIAS).map(pr =>
              el('option', { value:pr, selected:store.get('config').provincia === pr || null }, pr)))))));

    /* El <details> se rehace en cada repintado: si estaba abierto, sigue abierto. */
    if (pintarArriba.abierto) lado.querySelector('.fx-desglose').open = true;
    lado.querySelector('.fx-desglose').addEventListener('toggle', e => { pintarArriba.abierto = e.target.open; });
  }

  /* ---------- tarjetita del historial y gráfico ---------- */
  function pintarHistorial(){
    const r = resumenSerie(serie, 90);
    poner(mini, r
      ? el('div', { class:'fx-mini-in' },
          chispa(r.serie.map(x => x.min)),
          el('div', { class:'fx-mini-txt' },
            el('small', {}, `Historial ${r.dias}d`),
            r.variacion
              ? el('span', { class:'fx-var ' + (r.variacion > 0 ? 'sube' : 'baja') },
                  ic(r.variacion > 0 ? 'sube' : 'baja'), `${r.variacion > 0 ? 'Subió' : 'Bajó'} ${Math.abs(r.variacion)}%`)
              : el('span', { class:'fx-var' }, 'Sin cambios'),
            el('small', {}, 'Mín: ' + plata(r.min))),
          ic('der'))
      : el('div', { class:'fx-mini-in' },
          el('div', { class:'fx-mini-txt' },
            el('small', {}, 'Historial de precios'),
            el('span', { class:'fx-var' }, serie.length ? `Desde el ${diaCorto(serie[0].d)}` : 'Empieza hoy'),
            el('small', {}, serie.length ? 'Se dibuja desde el segundo día' : 'Guardamos el precio de cada día')),
          ic('der')));

    const a = analizar(elegida);
    poner(secHist, 
      el('div', { class:'fx-hist-cab' },
        el('h3', { class:'fx-card-tit' }, 'Historial de precios'),
        serie.length > 1 ? el('div', { class:'fx-leyenda' },
          el('span', {}, el('i', { class:'fx-ley-linea' }), 'Precio más bajo'),
          el('span', {}, el('i', { class:'fx-ley-linea punteada' }), 'Promedio de las tiendas')) : null),
      serie.length > 1
        ? graficoHistorial(serie)
        : el('div', { class:'fx-hist-vacio' },
            ic('pulso'),
            el('b', {}, serie.length ? `Por ahora hay un día registrado: ${diaCorto(serie[0].d)}, desde ${plata(serie[0].min)}.` : 'Todavía no hay precios guardados de este producto.'),
            el('span', {}, 'El gráfico se dibuja desde el segundo día. Cada vez que alguien abre esta ficha, NiJu anota el precio del día de cada tienda.')),
      el('p', { class:'fx-hist-pie' },
        desdeServidor
          ? 'El historial se arma con los precios que NiJu consulta a cada tienda cuando alguien abre esta ficha.'
          : 'Por ahora este historial está guardado solo en este dispositivo: el servidor de NiJu no respondió.'),
      a.hayHistoria && a.veredicto.m
        ? el('div', { class:'notice ' + (a.veredicto.t === 'bad' ? 'notice-bad' : a.veredicto.t === 'ok' ? 'notice-ok' : ''), style:{ marginTop:'10px' } },
            a.veredicto.m) : null);
  }

  /* ---------- ofertas de todas las tiendas ---------- */
  let orden = 'menor';
  let cuantas = 12;
  const ocultas = new Set();
  const excluidas = new Set();
  const tiendasSel = new Set();
  const lista = el('div', { class:'fx-ofertas' });
  const barraTiendas = el('div', { class:'fx-chips' });
  const barraExcluir = el('div', { class:'fx-excluir' });
  const palabrasDe = new Map(todas.map(o => [o.id, new Set(tokens(o.titulo))]));

  /* "Excluir": palabras que aparecen en algunas ofertas y no en todas
     (colores, capacidades, versiones). Tocar una esconde esas ofertas. */
  const conteo = new Map();
  for (const ws of palabrasDe.values()) for (const w of ws) conteo.set(w, (conteo.get(w) || 0) + 1);
  const palabrasExcluir = todas.length >= 4
    ? [...conteo].filter(([w, n]) => n >= 2 && n <= todas.length * 0.8 && !/^\d+$/.test(w) && !NO_EXCLUIR.has(w))
        .sort((a, b) => b[1] - a[1]).slice(0, 14)
    : [];

  function pintarFiltros(){
    poner(barraTiendas, ...tiendasTodas.map(id => el('button', {
      class:'fx-chip' + (tiendasSel.has(id) ? ' on' : ''),
      onclick:() => { tiendasSel.has(id) ? tiendasSel.delete(id) : tiendasSel.add(id); pintarFiltros(); pintarOfertas(); }
    }, nombreTienda(id))));
    barraExcluir.hidden = !palabrasExcluir.length;
    poner(barraExcluir, el('span', {}, 'Excluir:'), ...palabrasExcluir.map(([w, n]) => el('button', {
      class:'fx-chip gris' + (excluidas.has(w) ? ' on' : ''),
      onclick:() => { excluidas.has(w) ? excluidas.delete(w) : excluidas.add(w); pintarFiltros(); pintarOfertas(); }
    }, `${w} (${n})`)));
  }

  function pintarOfertas(){
    const vis = todas.filter(o => !ocultas.has(o.id)
      && (!tiendasSel.size || tiendasSel.has(o.tiendaId))
      && ![...excluidas].some(w => palabrasDe.get(o.id).has(w)));
    vis.sort((a, b) => orden === 'mayor' ? b.costo.finalARS - a.costo.finalARS
                     : orden === 'descuento' ? descuentoDe(b) - descuentoDe(a)
                     : a.costo.finalARS - b.costo.finalARS);
    const barata = vis.reduce((x, y) => !x || y.costo.finalARS < x.costo.finalARS ? y : x, null);
    const base = elegida.costo.finalARS;

    const filas = vis.slice(0, cuantas).map(o => {
      const t = STORE_BY_ID[o.tiendaId];
      const f = o.costo.finalARS;
      const d = descuentoDe(o);
      const tuyo = o.id === elegida.id;
      const barato = o === barata;
      const rel = Math.round((f / base - 1) * 100);
      return el('div', { class:'fx-of' + (tuyo ? ' tuyo' : barato ? ' barato' : '') },
        el('div', { class:'fx-of-izq' },
          el('div', { class:'fx-of-tienda' }, logoTienda(o.tiendaId), el('b', {}, t?.nombre || o.tiendaId),
            barato ? el('span', { class:'fx-sello azul' }, 'MÁS BARATO') : null,
            tuyo ? el('span', { class:'fx-sello verde' }, 'TU PRODUCTO') : null),
          el('div', { class:'fx-of-tit' }, o.titulo),
          el('div', { class:'fx-of-sellos' }, ...sellos(o))),
        el('div', { class:'fx-of-der' },
          el('div', { class:'fx-of-precio' }, el('b', {}, plata(f)), d ? el('span', { class:'fx-off' }, `-${d}%`) : null),
          d ? el('div', { class:'fx-tachado' }, plata(o.precioLista, o.moneda)) : null,
          !tuyo && rel ? el('div', { class:'fx-rel ' + (rel > 0 ? 'sube' : 'baja') }, `${rel > 0 ? '+' : ''}${rel}%`) : null,
          o.envio && !o.costo.internacional ? el('div', { class:'fx-nota' }, 'con envío') : null,
          el('div', { class:'fx-of-btns' },
            o.url ? el('button', { class:'fx-ir' + (tuyo ? ' verde' : barato ? ' azul' : ''), onclick:() => window.open(o.url, '_blank', 'noopener') },
              'Ir a la tienda') : null,
            !tuyo ? el('button', { class:'fx-ir', title:'Ver esta oferta arriba, con su precio final', onclick:() => {
              elegida = o; pintarArriba(); pintarOfertas(); pintarHistorial();
              window.scrollTo({ top:0, behavior:'smooth' });
            } }, 'Elegir') : null,
            el('button', { class:'fx-ojo', title:'Ocultar esta oferta', 'aria-label':'Ocultar esta oferta',
              onclick:() => { ocultas.add(o.id); pintarOfertas(); } }, ic('ojoNo')))));
    });

    /* Mercado Libre: si no vino con precio, se ofrece su búsqueda. Sin
       inventar un precio: solo el camino para mirarlo. */
    const sinML = !todas.some(o => o.tiendaId === 'meli');
    const filaML = sinML && !tiendasSel.size ? el('div', { class:'fx-of fx-of-ml' },
      el('div', { class:'fx-of-izq' },
        el('div', { class:'fx-of-tienda' }, logoTienda('meli'), el('b', {}, 'Mercado Libre')),
        el('div', { class:'fx-of-tit' }, 'Mercado Libre no nos pasó el precio de este producto. Miralo directo en su sitio.')),
      el('div', { class:'fx-of-der' },
        el('button', { class:'fx-ir amarillo', onclick:() => window.open(busquedaML(g.titulo), '_blank', 'noopener') },
          'Buscar en Mercado Libre'))) : null;

    poner(lista, 
      ...(filas.length ? filas : [el('div', { class:'fx-of-vacio' }, 'Ninguna oferta con esos filtros.')]),
      filaML,
      vis.length > cuantas ? el('button', { class:'fx-mas', onclick:() => { cuantas += 12; pintarOfertas(); } },
        `Ver ${Math.min(12, vis.length - cuantas)} ofertas más (quedan ${vis.length - cuantas})`) : null,
      ocultas.size ? el('button', { class:'fx-link', onclick:() => { ocultas.clear(); pintarOfertas(); } },
        `Mostrar las ${ocultas.size} ocultas`) : null);
  }

  /* ---------- relacionados ---------- */
  let relacionados = grupos.filter(x => !cercanos.has(x));
  let ordenRel = 'relevancia';
  const tiendasRel = new Set();
  const grillaRel = el('div', { class:'fx-grilla' });
  const barraRel = el('div', { class:'fx-chips' });
  const contRel = el('span', { class:'fx-cuenta' });

  function pintarRelacionados(){
    const ids = [...new Set(relacionados.map(x => x.mejor.tiendaId))];
    poner(barraRel, ...ids.map(id => el('button', {
      class:'fx-chip' + (tiendasRel.has(id) ? ' on' : ''),
      onclick:() => { tiendasRel.has(id) ? tiendasRel.delete(id) : tiendasRel.add(id); pintarRelacionados(); }
    }, nombreTienda(id))));
    const vis = relacionados.filter(x => !tiendasRel.size || tiendasRel.has(x.mejor.tiendaId)).slice();
    if (ordenRel === 'menor') vis.sort((a, b) => a.mejor.costo.finalARS - b.mejor.costo.finalARS);
    if (ordenRel === 'mayor') vis.sort((a, b) => b.mejor.costo.finalARS - a.mejor.costo.finalARS);
    if (ordenRel === 'descuento') vis.sort((a, b) => descuentoDe(b.mejor) - descuentoDe(a.mejor));
    contRel.textContent = String(relacionados.length);
    contRel.hidden = !relacionados.length;
    poner(grillaRel, ...(vis.length
      ? vis.slice(0, 16).map(gr => tarjetaRelacionada(gr, () => ir(`#/producto/${encodeURIComponent(gr.productoId || gr.titulo)}`)))
      : [el('div', { class:'fx-of-vacio' }, relacionados.length ? 'Ninguno con esos filtros.' : 'Buscando productos parecidos…')]));
  }

  /* Los parecidos se buscan con la marca y la primera palabra del producto,
     recién cuando el cliente baja hasta ahí. */
  let relPedidos = false;
  function pedirRelacionados(){
    if (relPedidos) return;
    relPedidos = true;
    const q = [g.marca, ...tokens(g.titulo).filter(w => w !== (g.marca || '').toLowerCase())].filter(Boolean).slice(0, 2).join(' ');
    buscar(q, {}, () => {}).then(({ grupos:otros }) => {
      const ya = new Set([...cercanos, ...relacionados].map(x => x.clave));
      relacionados = [...relacionados, ...otros.filter(x => !ya.has(x.clave) && !x.ofertas.some(o => usadas.has(o.id)))];
      if (!relacionados.length) poner(grillaRel, el('div', { class:'fx-of-vacio' }, 'No encontramos productos parecidos.'));
      else pintarRelacionados();
    }).catch(() => poner(grillaRel, el('div', { class:'fx-of-vacio' }, 'No pudimos buscar productos parecidos.')));
  }

  /* ---------- armado ---------- */
  pintarArriba(); pintarFiltros(); pintarOfertas(); pintarHistorial(); pintarRelacionados();

  historialCompartido(g, consulta).then(doc => {
    if (!doc) return;
    desdeServidor = true;
    serie = serieDiaria(doc, g.ofertas);
    pintarHistorial();
  });

  const seccion = (id, titulo, ...hijos) => {
    const s = el('section', { class:'fx-sec', id:'fx-' + id }, el('h2', { class:'fx-h2' }, titulo), ...hijos);
    secciones[id] = s;
    return s;
  };

  const solapas = [
    ['ofertas', 'Ofertas', todas.length],
    ['ficha', 'Ficha del producto'],
    ['historial', 'Historial de precios'],
    ['tuprecio', 'Tu precio'],
    ['relacionados', 'Relacionados', contRel]
  ];
  const tabs = el('nav', { class:'fx-tabs' }, ...solapas.map(([id, txt, n]) => el('button', {
    class:'fx-tab', 'data-sec':id, onclick:() => irA(id)
  }, txt, n === undefined ? null : n instanceof Node ? n : el('span', { class:'fx-cuenta' }, String(n)))));

  const selOrden = el('select', { class:'fx-select', onchange:e => { orden = e.target.value; pintarOfertas(); } },
    el('option', { value:'menor' }, 'Precio: menor a mayor'),
    el('option', { value:'mayor' }, 'Precio: mayor a menor'),
    el('option', { value:'descuento' }, 'Mayor descuento'));
  const selRel = el('select', { class:'fx-select', onchange:e => { ordenRel = e.target.value; pintarRelacionados(); } },
    el('option', { value:'relevancia' }, 'Ordenar por'),
    el('option', { value:'menor' }, 'Precio: menor a mayor'),
    el('option', { value:'mayor' }, 'Precio: mayor a menor'),
    el('option', { value:'descuento' }, 'Mayor descuento'));

  const raiz = el('div', { class:'fx' },
    el('div', { class:'fx-miga' },
      botonVolver(ir, '#/buscar'),
      el('a', { href:'#/' }, 'Inicio'), el('span', {}, '/'),
      el('span', { class:'fx-miga-tit' }, g.titulo)),
    el('div', { class:'fx-hero' }, el('div', { class:'fx-card fx-foto-card' }, galeria), info, lado, extra),
    tabs,
    seccion('ofertas', 'Ofertas de todas las tiendas',
      el('div', { class:'fx-card' },
        el('div', { class:'fx-barra-filtros' }, selOrden, barraTiendas),
        barraExcluir,
        lista)),
    seccion('ficha', 'Ficha del producto',
      el('div', { class:'fx-card' }, el('h3', { class:'fx-card-tit' }, 'Especificaciones'), tablaSpecs(especificaciones(g.mejor, g)))),
    seccion('historial', 'Historial de precios', secHist),
    seccion('tuprecio', 'El precio que te corresponde a vos', tuPrecio(g, elegida, perfilId)),
    seccion('relacionados', 'Productos relacionados',
      el('div', { class:'fx-card' }, el('div', { class:'fx-barra-filtros' }, selRel, barraRel), grillaRel)),
    el('div', { class:'fx-card fx-texto' },
      el('h3', {}, `${g.titulo}: precio y dónde comprarlo en Argentina`),
      el('p', {}, `NiJu compara este producto en ${tiendasTodas.length} ${tiendasTodas.length === 1 ? 'tienda' : 'tiendas'}. ` +
        `El mejor precio encontrado ahora es ${plata(minTodas)}${todas.length > 1 ? ` y el más alto ${plata(maxTodas)}` : ''}. ` +
        'Los precios se consultan a cada tienda en el momento. Podés ir a la tienda y comprar vos, o que NiJu lo compre por vos con la gestión discriminada en la factura.')));

  /* La solapa se marca sola según la sección que está a la vista,
     y los relacionados se buscan al acercarse. */
  if ('IntersectionObserver' in window){
    const vistas = new Map();
    const obs = new IntersectionObserver(entradas => {
      for (const e of entradas) vistas.set(e.target.id, e.isIntersecting);
      const activa = solapas.map(([id]) => id).find(id => vistas.get('fx-' + id));
      tabs.querySelectorAll('.fx-tab').forEach(b => b.classList.toggle('on', b.dataset.sec === activa));
    }, { rootMargin:'-120px 0px -55% 0px' });
    Object.values(secciones).forEach(s => obs.observe(s));
    const obsRel = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ pedirRelacionados(); obsRel.disconnect(); } },
      { rootMargin:'700px 0px' });
    obsRel.observe(secciones.relacionados);
  } else {
    pedirRelacionados();
  }

  return raiz;
}

/* ---------- tarjeta de "Productos relacionados" ---------- */
function tarjetaRelacionada(gr, abrir){
  const m = gr.mejor;
  const d = descuentoDe(m);
  const a = analizar(m);
  const c = cuotasSinInteres(m);
  return el('article', { class:'fx-rc', tabindex:'0', onclick:abrir, onkeydown:e => { if (e.key === 'Enter') abrir(); } },
    el('div', { class:'fx-rc-top' },
      d ? el('span', { class:'fx-off' }, `-${d}%`) : el('span'),
      el('span', { class:'fx-rc-tienda' }, logoTienda(m.tiendaId), nombreTienda(m.tiendaId))),
    foto(gr, 'fx-rc-foto'),
    el('div', { class:'fx-rc-tit' }, gr.titulo),
    el('div', { class:'fx-rc-precio' }, el('b', {}, plata(m.costo.finalARS)), d ? el('s', {}, plata(m.precioLista, m.moneda)) : null),
    a.hayHistoria && a.variacion30 < 0 ? el('span', { class:'fx-var baja' }, ic('baja'), `Bajó ${Math.abs(a.variacion30)}%`) : null,
    c ? el('div', { class:'fx-rc-cuotas' }, `${c} cuotas sin interés`) : null,
    envioGratis(m) ? el('div', { class:'fx-rc-envio' }, 'Envío gratis') : null,
    el('div', { class:'fx-rc-pie' },
      el('span', { class:'fx-stock' + (m.stock > 0 ? '' : ' no') }, m.stock > 0 ? 'En stock' : 'Sin stock'),
      el('span', { class:'fx-entiendas' }, ic('tienda'), `En ${gr.tiendas} ${gr.tiendas === 1 ? 'tienda' : 'tiendas'}`)));
}

/* ---------- gráficos ---------- */
const diaCorto = d => { const [, m, dd] = d.split('-'); return `${+dd}/${+m}`; };
const SVG = 'http://www.w3.org/2000/svg';
function nodo(tag, attrs = {}){
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/* Curva monótona: pasa por cada punto sin inventar picos entre dos días. */
function curva(pts){
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++){ dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++){
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  t[n - 1] = m[n - 2];
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++){
    const h = dx[i] / 3;
    d += `C${pts[i].x + h},${pts[i].y + h * t[i]} ${pts[i + 1].x - h},${pts[i + 1].y - h * t[i + 1]} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

const pesosCortos = v => v >= 10000 ? '$' + Math.round(v / 1000).toLocaleString('es-AR') + 'k' : plata(v);

/** El gráfico grande: precio más bajo del día (línea llena) y promedio de
    las tiendas (punteada), con fechas abajo y el valor al pasar el mouse. */
function graficoHistorial(serie){
  const W = 900, H = 270, L = 62, R = 14, T = 14, B = 34;
  const lo = Math.min(...serie.map(x => x.min)), hi = Math.max(...serie.map(x => x.prom));
  const pad = (hi - lo) * 0.12 || hi * 0.05 || 1;
  const y0 = Math.max(0, lo - pad), y1 = hi + pad;
  const X = i => L + (serie.length === 1 ? 0 : i * (W - L - R) / (serie.length - 1));
  const Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);

  const svg = nodo('svg', { viewBox:`0 0 ${W} ${H}`, class:'fx-graf', role:'img',
    'aria-label':`Historial de precios de ${serie.length} días: mínimo ${plata(lo)}` });
  for (let k = 0; k <= 4; k++){
    const v = y0 + (y1 - y0) * k / 4;
    svg.append(nodo('line', { x1:L, x2:W - R, y1:Y(v), y2:Y(v), class:'fx-graf-grilla' }));
    const tx = nodo('text', { x:L - 8, y:Y(v) + 4, 'text-anchor':'end', class:'fx-graf-eje' });
    tx.textContent = pesosCortos(v);
    svg.append(tx);
  }
  const paso = Math.max(1, Math.ceil(serie.length / 14));
  serie.forEach((x, i) => {
    if (i % paso && i !== serie.length - 1) return;
    svg.append(nodo('line', { x1:X(i), x2:X(i), y1:T, y2:H - B, class:'fx-graf-grilla' }));
    const tx = nodo('text', { x:X(i), y:H - B + 18, 'text-anchor':'middle', class:'fx-graf-eje' });
    tx.textContent = diaCorto(x.d);
    svg.append(tx);
  });
  svg.append(nodo('path', { d:curva(serie.map((x, i) => ({ x:X(i), y:Y(x.prom) }))), class:'fx-graf-prom' }));
  svg.append(nodo('path', { d:curva(serie.map((x, i) => ({ x:X(i), y:Y(x.min) }))), class:'fx-graf-min' }));

  /* Al pasar el mouse (o el dedo): línea, puntos y el valor del día. */
  const guia = nodo('line', { y1:T, y2:H - B, class:'fx-graf-guia', visibility:'hidden' });
  const p1 = nodo('circle', { r:4.5, class:'fx-graf-p1', visibility:'hidden' });
  const p2 = nodo('circle', { r:3.5, class:'fx-graf-p2', visibility:'hidden' });
  const zona = nodo('rect', { x:L, y:T, width:W - L - R, height:H - T - B, fill:'transparent' });
  svg.append(guia, p2, p1, zona);
  const globo = el('div', { class:'fx-globo', hidden:true });
  const caja = el('div', { class:'fx-graf-caja' }, svg, globo);

  const mover = ev => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - r.left) * W / r.width;
    const i = Math.max(0, Math.min(serie.length - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, serie.length - 1)))));
    const x = serie[i];
    for (const n of [guia, p1, p2]) n.setAttribute('visibility', 'visible');
    guia.setAttribute('x1', X(i)); guia.setAttribute('x2', X(i));
    p1.setAttribute('cx', X(i)); p1.setAttribute('cy', Y(x.min));
    p2.setAttribute('cx', X(i)); p2.setAttribute('cy', Y(x.prom));
    globo.hidden = false;
    poner(globo, el('b', {}, diaCorto(x.d)),
      el('span', {}, 'Más bajo: ', el('b', {}, plata(x.min))),
      el('span', {}, 'Promedio: ', plata(x.prom)),
      el('small', {}, `${x.n} ${x.n === 1 ? 'precio' : 'precios'} ese día`));
    const izq = X(i) / W * r.width;
    globo.style.left = Math.min(r.width - 170, Math.max(0, izq + 12)) + 'px';
  };
  const salir = () => { for (const n of [guia, p1, p2]) n.setAttribute('visibility', 'hidden'); globo.hidden = true; };
  zona.addEventListener('mousemove', mover);
  zona.addEventListener('touchmove', mover, { passive:true });
  zona.addEventListener('mouseleave', salir);
  return caja;
}

/** Línea chiquita para la tarjetita del historial. */
function chispa(valores){
  const W = 96, H = 40;
  const lo = Math.min(...valores), hi = Math.max(...valores);
  const pts = valores.map((v, i) => ({ x:2 + i * (W - 4) / Math.max(1, valores.length - 1), y:4 + (hi === lo ? 0.5 : 1 - (v - lo) / (hi - lo)) * (H - 8) }));
  const svg = nodo('svg', { viewBox:`0 0 ${W} ${H}`, class:'fx-chispa', 'aria-hidden':'true' });
  svg.append(nodo('path', { d:curva(pts), class:'fx-chispa-l' }));
  return svg;
}

const linea = (k, v, nota, onClick) => el('div', { class:'cost-line' + (onClick ? ' hoverable' : ''), onclick:onClick },
  el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
  el('span', { class:'mono' }, plata(v)));

function verImpuestos(c){
  const d = c.detalleImp;
  if (!d) return;
  hoja({ titulo:'Impuestos de importación', cuerpo: el('div', {},
    el('div', { class:'kicker', style:{ marginBottom:'8px' } }, d.regimen === 'courier' ? 'Régimen courier puerta a puerta' : 'Importación general'),
    ...d.lineas.map(l => el('div', { class:'cost-line' },
      el('span', { class:'lbl' }, l.k, l.detalle ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + l.detalle) : null),
      el('span', { class:'mono' }, l.v ? 'US$ ' + l.v.toFixed(2) : '—'))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total de la operación'), el('span', {}, 'US$ ' + d.total.toFixed(2))),
    ...d.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : a.t === 'ok' ? 'notice-ok' : ''), style:{ marginTop:'10px' } }, a.m)),
    el('p', { class:'tiny dim', style:{ marginTop:'14px' } },
      'Los parámetros del cálculo son editables y hay que contrastarlos con la normativa vigente de ARCA antes de operar.'))});
}

function verComprobante(comp){
  hoja({ titulo:`Factura ${comp.letra} — borrador`, cuerpo: el('div', {},
    el('div', { class:'card', style:{ marginBottom:'12px' } },
      el('div', { class:'row-b' },
        el('div', {}, el('b', {}, comp.emisor.razonSocial),
          el('div', { class:'tiny dim' }, `CUIT ${comp.emisor.cuit} · ${comp.emisor.condicion === 'responsable_inscripto' ? 'Responsable Inscripto' : 'Monotributo'}`),
          el('div', { class:'tiny dim' }, `IIBB ${comp.emisor.iibb} · ${comp.emisor.jurisdiccion}`)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { style:{ fontSize:'30px', fontWeight:'900' } }, comp.letra),
          el('div', { class:'tiny dim' }, 'Pto. Vta. ' + String(comp.emisor.ptoVta).padStart(5,'0')))),
      el('hr', { class:'rule', style:{ margin:'10px 0' } }),
      el('div', { class:'tiny' }, 'Cliente: ', el('b', {}, comp.cliente.nombre || 'Consumidor Final')),
      comp.cliente.cuit ? el('div', { class:'tiny' }, 'CUIT: ' + comp.cliente.cuit) : null,
      el('div', { class:'tiny dim' }, 'Condición frente al IVA: ' + (PERFILES[comp.condicion]?.label || comp.condicion))),
    ...comp.lineas.map(l => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, l.k), el('span', { class:'mono' }, plata(l.v)))),
    el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('span', {}, plata(comp.total))),
    el('div', { class:'notice', style:{ marginTop:'12px' } }, comp.leyenda),
    el('div', { class:'notice notice-bad', style:{ marginTop:'8px' } },
      'Sin CAE: es un borrador. El comprobante fiscal se emite desde el backend con el web service de ARCA (WSFEv1) al confirmar el pago.'),
    el('div', { class:'card', style:{ marginTop:'12px' } },
      el('div', { class:'kicker', style:{ marginBottom:'6px' } }, 'Para la contabilidad de NiJu (no va en el comprobante)'),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, `IIBB ${(comp.alicIIBB*100).toFixed(1)}% — ${comp.emisor.jurisdiccion}`), el('span', { class:'mono' }, plata(comp.iibb))),
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Débito fiscal IVA del período'), el('span', { class:'mono' }, plata(comp.iva))))
  )});
}

function verFiscal(o, c, comp, destino, perfilId){
  const f = consecuenciasFiscales({
    tipo: o.propio ? 'propio' : c.internacional ? 'internacional' : 'nacional',
    regimen: c.detalleImp?.regimen,
    totalARS: c.productoARS + c.envioARS + c.impuestosARS + comp.total,
    ivaARS: c.internacional ? 0 : Math.round(c.productoARS - c.productoARS / 1.21),
    ivaFeeARS: comp.iva,
    impuestosImportARS: c.impuestosARS,
    valorUSD: aUSD(o.precio, o.moneda),
    destino
  }, perfilId);

  const bloque = (t, arr, color) => arr.length ? el('div', { style:{ marginBottom:'14px' } },
    el('div', { class:'kicker', style:{ color, marginBottom:'6px' } }, t),
    ...arr.map(x => el('div', { class:'cost-line' },
      el('span', { class:'lbl' }, x.k, x.donde || x.motivo ? el('i', { class:'tiny dim', style:{ fontStyle:'normal', display:'block' } }, x.donde || x.motivo) : null),
      el('span', { class:'mono' }, plata(x.v))))) : null;

  hoja({ titulo:'Tu situación fiscal en esta compra', ancho:660, cuerpo: el('div', {},
    el('div', { class:'card', style:{ marginBottom:'14px', borderColor:f.perfil.color } },
      el('div', { class:'row-b' },
        el('div', {}, el('div', { class:'kicker' }, 'Tu condición'),
          el('b', { style:{ fontSize:'17px', color:f.perfil.color } }, f.perfil.label)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'kicker' }, 'Costo real de la compra'),
          el('b', { style:{ fontSize:'19px' } }, plata(f.costoRealARS)))),
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } }, f.perfil.desc)),
    bloque('Podés computar', f.computable, 'var(--ok)'),
    bloque('Es costo (no lo recuperás)', f.costo, 'var(--warn)'),
    bloque('Queda a tu favor', f.aCuenta, 'var(--nac)'),
    el('div', { class:'kicker', style:{ marginBottom:'6px' } }, 'Qué tenés que hacer'),
    ...f.obligaciones.map(x => el('div', { class:'step' },
      el('span', { class:'step-n' }, '›'),
      el('div', {}, el('b', { class:'tiny' }, x.k), el('div', { class:'tiny dim' }, x.d),
        el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, 'Plazo: ' + x.plazo)))),
    el('div', { class:'kicker', style:{ margin:'14px 0 6px' } }, 'Formularios que te alcanzan'),
    el('div', { class:'row wrapf' }, ...f.formularios.map(x => el('span', { class:'chip' }, x))),
    ...f.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : ''), style:{ marginTop:'10px' } }, a.m)),
    el('div', { class:'notice', style:{ marginTop:'14px' } },
      'NiJu organiza tu información fiscal, no reemplaza a tu contador. Verificá los parámetros antes de presentar.'))});
}


/* ------------------------------------------------------------------
   "El precio que te corresponde a vos"
   El mismo producto vale distinto según tu condición ante ARCA, y
   la tienda más barata de vidriera no siempre es la que te conviene.
   ------------------------------------------------------------------ */
function tuPrecio(g, elegida, perfilId){
  const tabla = tablaPerfiles(elegida);
  const mio = tabla.find(x => x.id === perfilId) || tabla[0];
  const orden = mejorParaVos(g.ofertas, perfilId);
  const cambio = conviendCambiar(elegida, perfilId);

  return el('div', { class:'card', style:{ marginTop:'18px', borderLeft:'4px solid var(--accion)' } },
    el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
      el('div', {}, el('div', { class:'kicker' }, 'El precio que te corresponde a vos'),
        el('h3', {}, 'Sos ' + mio.perfil.label)),
      el('div', { style:{ textAlign:'right' } },
        el('div', { class:'tiny dim' }, 'Precio de vidriera ' + plata(mio.bruto)),
        el('div', { class:'price price-lg', style:{ color:'var(--win-tx)' } }, plata(mio.real)),
        mio.recupera ? el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, 'recuperás ' + plata(mio.recupera)) : null)),

    ...mio.notas.map(n => el('p', { class:'tiny muted', style:{ margin:'2px 0' } }, '· ' + n)),

    orden.cambiaElGanador
      ? el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
          el('b', {}, 'Ojo con esto: '), orden.mensaje)
      : null,

    el('div', { class:'tbl-wrap', style:{ marginTop:'12px' } },
      el('table', { class:'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Si sos…'), el('th', {}, 'Precio de vidriera'),
          el('th', {}, 'Recuperás'), el('th', {}, 'Te sale de verdad'))),
        el('tbody', {}, ...tabla.map(x => el('tr', { class: x.id === perfilId ? 'is-win' : '' },
          el('td', {}, x.perfil.label, x.id === perfilId ? el('span', { class:'tag tag-win', style:{ marginLeft:'6px' } }, 'vos') : null),
          el('td', { class:'mono' }, plata(x.bruto)),
          el('td', { class:'mono', style:{ color: x.recupera ? 'var(--win-tx)' : '' } }, x.recupera ? plata(x.recupera) : '—'),
          el('td', { class:'mono' }, el('b', {}, plata(x.real)))))))),

    cambio ? el('div', { class:'notice', style:{ marginTop:'10px' } }, cambio.texto) : null,
    el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
      'Esto organiza tu información fiscal; no es asesoramiento impositivo. Consultalo con tu contador.'));
}

/* ------------------------------------------------------------------
   Las cuotas se muestran solo si la tienda realmente las ofrece.
   Antes salían de una tabla nuestra y eso hacía que la app dijera
   "12 cuotas sin interés" en productos que no tenían ninguna.
   ------------------------------------------------------------------ */
function cuotasReales(o, totalFinal){
  // Oferta real que SÍ publica cuotas: mostramos el valor que publica la tienda
  if (o.demo === false && o.cuotas > 1 && o.cuotaValor){
    return el('div', { class:'tiny', style:{ marginTop:'6px', color:'var(--win-tx)', fontWeight:'600' } },
      `${o.cuotas} cuotas sin interés de ${plata(o.cuotaValor)}`,
      el('div', { class:'dim', style:{ fontWeight:'400' } }, 'según publica la tienda'));
  }
  // Oferta real que NO tiene cuotas: lo decimos
  if (o.demo === false){
    return el('div', { class:'tiny dim', style:{ marginTop:'6px' } },
      'Esta tienda no publica cuotas sin interés para este producto.');
  }
  // Producto propio de NiJu: las cuotas las ponemos nosotros
  if (o.propio && o.cuotas > 1){
    return el('div', { class:'tiny', style:{ marginTop:'6px', color:'var(--win-tx)', fontWeight:'600' } },
      `${o.cuotas} cuotas sin interés de ${plata(totalFinal / o.cuotas)}`);
  }
  return null;
}
