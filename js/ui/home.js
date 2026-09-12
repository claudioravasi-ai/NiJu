/* ============================================================
   NiJu — Portada
   ============================================================ */
import { el, plata, num, ic } from '../util.js';
import { CONFIG } from '../config.js';
import { RUBROS } from '../data/catalog.js';
import { STORES } from '../data/stores.js';
import { tiendasActivas } from '../connectors/registry.js';
import { NIJU_PRODUCTOS } from '../data/niju-directo.js';
import { buscar } from '../engine/search.js';
import { FX } from '../engine/fx.js';
import { store, registrarBusqueda } from '../state.js';
import { tarjetaGrupo, esqueleto, seccion, logoTienda, barraProgreso } from './components.js';

const SUGERENCIAS = ['iphone 15','air fryer','zapatillas nike','notebook','smart tv 55','taladro','aspiradora robot','playstation 5'];

export function vistaHome(ir){
  const raiz = el('div');

  /* ---------- Hero ---------- */
  const input = el('input', {
    type:'search', placeholder:'¿Qué estás buscando? Lo miramos en todas las tiendas a la vez…',
    'aria-label':'Buscar productos'
  });
  const lanzar = () => {
    const q = input.value.trim();
    if (!q) return;
    registrarBusqueda(q);
    ir(`#/buscar?q=${encodeURIComponent(q)}`);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') lanzar(); });

  /* Contamos las que de verdad responden, no las del registro:
     decir "50 tiendas" cuando funcionan 27 es empezar mintiendo. */
  const activas    = tiendasActivas().filter(t => t.tipo !== 'propio');
  const nacionales = activas.filter(t => t.tipo === 'nacional').length;
  const internac   = activas.filter(t => t.tipo === 'internacional').length;
  const sociales   = activas.filter(t => t.tipo === 'social').length;
  const pendientes = STORES.filter(t => t.tipo !== 'propio').length - activas.length;

  raiz.append(el('div', { class:'wrap' },
    el('section', { class:'hero' },
      el('div', { class:'kicker' }, 'Comparador universal de compras'),
      el('h1', {}, 'Comprá todo, ', el('span', { class:'hl' }, 'de todo'), ' y para todo'),
      el('p', { class:'hero-claim' }, CONFIG.claimLargo),
      el('div', { class:'search-hero' }, ic('buscar'), input,
        el('button', { class:'btn btn-win', onclick:lanzar }, 'Buscar en todas')),
      el('div', { class:'sugg' },
        el('span', { class:'tiny dim', style:{ alignSelf:'center' } }, 'Probá:'),
        ...SUGERENCIAS.map(s => el('button', { class:'chip', onclick:() => { input.value = s; lanzar(); } }, s))),
      el('div', { class:'hero-stats' },
        est(String(activas.length), 'tiendas conectadas'),
        est(String(nacionales), 'nacionales'),
        internac ? est(String(internac), 'internacionales') : null,
        sociales ? est(String(sociales), 'redes sociales') : null,
        pendientes ? est(String(pendientes), 'por conectar') : null,
        est(plata(FX.tarjeta), `dólar tarjeta · ${FX.origen === 'vivo' ? 'en vivo' : FX.origen}`))
    )
  ));

  /* ---------- Marquesina ---------- */
  const frases = ['precio final puesto en tu casa','impuestos de importación calculados','el mismo producto en 30 tiendas','sin salir de la app','courier y franquicia ARCA al día','compra por mayor con importadores verificados'];
  raiz.append(el('div', { class:'marquee' },
    el('div', { class:'marquee-in' }, ...[...frases, ...frases].map(f => el('span', {}, '◆ ' + f.toUpperCase())))));

  /* ---------- Rubros ---------- */
  const gRubros = el('div', { class:'grid g-auto-sm' });
  for (const r of RUBROS){
    /* Contamos solo las tiendas que de verdad responden, no las del
       registro: prometer "20 tiendas" y abrir una pantalla vacía es
       la peor manera de perder a alguien. */
    const conectadas = tiendasActivas({ rubro:r.id }).filter(t => t.tipo !== 'propio').length;
    gRubros.append(el('button', {
      class:'rubro', style:{ '--rc':r.color, opacity: conectadas ? 1 : .55 },
      onclick:() => ir(`#/buscar?rubro=${r.id}`)
    },
      el('span', { class:'emo' }, r.emo),
      el('b', {}, r.nombre),
      el('small', {}, conectadas
        ? conectadas + (conectadas === 1 ? ' tienda' : ' tiendas')
        : 'lo conseguimos igual')));
  }
  raiz.append(el('div', { class:'wrap' },
    seccion('Elegí tu rubro', { kicker:'Todo comparado, rubro por rubro' }, gRubros)));

  /* ---------- NiJu Directo ---------- */
  const destacados = NIJU_PRODUCTOS.filter(p => p.destacado);
  const gNiju = el('div', { class:'grid g-auto' });
  for (const p of destacados){
    gNiju.append(el('article', { class:'offer is-win', onclick:() => ir(`#/producto/${p.ref}`) },
      el('div', { class:'offer-img' }, p.emo,
        el('div', { class:'offer-badges' },
          el('span', { class:'saving' }, `-${Math.round((1 - p.precio / p.precioTachado) * 100)}%`),
          el('span', { class:'tag tag-niju', style:{ background:'#0d0d12' } }, 'NiJu Directo'))),
      el('div', { class:'offer-body' },
        el('h4', { class:'offer-title' }, p.n),
        el('div', {},
          el('div', { class:'tiny strike' }, plata(p.precioTachado)),
          el('div', { class:'price price-lg price-win' }, plata(p.precio)),
          el('div', { class:'tiny dim' }, `${p.cuotas} cuotas sin interés${p.envioGratis ? ' · envío gratis' : ''}`)),
        el('div', { class:'offer-foot' },
          el('span', { class:'offer-stores' }, `${p.stock} en stock`),
          el('span', { class:'spacer' }),
          el('span', { class:'tiny', style:{ color:'var(--niju)', fontWeight:'800' } }, 'Despacha NiJu')))));
  }
  raiz.append(el('div', { class:'wrap' },
    seccion('NiJu Directo', {
      kicker:'Stock propio · garantía propia · 48 h',
      accion: el('button', { class:'btn btn-niju', onclick:() => ir('#/buscar?tienda=niju') }, 'Ver todo el catálogo')
    }, gNiju)));

  /* ---------- Radar de ofertas ---------- */
  const cont = el('div');
  const prog = el('div');
  cont.append(prog, esqueleto(8));
  raiz.append(el('div', { class:'wrap' },
    seccion('Radar de ofertas', {
      kicker:'Lo mejor que encontramos ahora mismo, en todas las tiendas',
      accion: el('button', { class:'btn', onclick:() => ir('#/buscar?orden=ahorro') }, 'Ver todas')
    }, cont)));

  buscar('', { orden:'ahorro' }, est => {
    prog.replaceChildren(barraProgreso(est.tiendas));
    if (est.listo) setTimeout(() => prog.replaceChildren(), 1200);
  }).then(({ grupos }) => {
    const top = grupos.filter(g => g.ahorroPct >= 10).slice(0, 12);
    const g = el('div', { class:'grid g-auto' });
    top.forEach(x => g.append(tarjetaGrupo(x, gr => ir(`#/producto/${encodeURIComponent(gr.productoId || gr.titulo)}`))));
    cont.replaceChildren(prog, g);
  });

  /* ---------- Comprar por tienda ---------- */
  const tiendas = el('div', { class:'grid g-auto-sm' });
  for (const t of activas){
    tiendas.append(el('button', { class:'card hoverable', style:{ textAlign:'left' },
      onclick:() => ir(`#/tienda/${t.id}`) },
      el('div', { class:'row' }, logoTienda(t.id, true),
        el('div', { class:'spacer' },
          el('b', { style:{ fontSize:'13px' } }, t.nombre),
          el('div', { class:'tiny dim' }, t.rubros.length + (t.rubros.length === 1 ? ' rubro' : ' rubros')))),
      el('div', { class:'tiny', style:{ marginTop:'8px', color:'var(--accion)', fontWeight:'600' } },
        'Recorrer →')));
  }
  raiz.append(el('div', { class:'wrap' },
    seccion('Comprá por tienda', {
      kicker:'Entrá a una y recorrela como si estuvieras adentro',
      accion: el('button', { class:'btn', onclick:() => ir('#/tiendas') }, 'Estado de conectores')
    }, tiendas)));

  /* ---------- Bloques de servicio ---------- */
  raiz.append(el('div', { class:'wrap' }, seccion('Lo que hace NiJu por vos', { kicker:'Sin trámites, sin riesgos' },
    el('div', { class:'grid g-4' },
      bloque('📣', 'Pedí y que compitan', 'Al revés de siempre: decís qué querés y cuánto pagás, y salen a buscártelo. Si nadie lo consigue, te devolvemos la seña.', () => ir('#/demanda')),
      bloque('🎯', 'Traelo por mí', '¿No está en la app? Pegá el link de cualquier tienda del mundo y te lo traemos: compra, envío, aduana y entrega. Vos pagás en pesos.', () => ir('#/pedido')),
      bloque('🧮', 'Impuestos resueltos', 'Calculamos franquicia, derechos y percepciones de cada compra del exterior antes de que pagues. Te decimos si conviene courier o importación formal.', () => ir('#/impuestos')),
      bloque('🤝', 'Compra grupal', 'Juntamos a los que quieren lo mismo: cuanta más gente se suma, más barato sale para todos. También para el que reservó primero.', () => ir('#/grupal')),
      bloque('📦', 'Compra por mayor', 'Importadores con CUIT verificado, MOQ y tiempos reales. Pedís cotización desde acá.', () => ir('#/mayorista')),
      bloque('💬', 'Un solo canal', 'Hablás con el vendedor externo, con la tienda local y con nosotros desde la misma bandeja.', () => ir('#/mensajes'))
    ))));

  return raiz;
}

const est = (b, s) => el('div', { class:'hstat' }, el('b', {}, b), el('span', {}, s));

function bloque(emo, t, d, onClick){
  return el('div', { class:'card card-hard hoverable', onclick:onClick },
    el('div', { style:{ fontSize:'28px', marginBottom:'8px' } }, emo),
    el('h3', { style:{ marginBottom:'6px' } }, t),
    el('p', { class:'muted tiny' }, d));
}
