/* ============================================================
   NiJu — Talles, colores y medidas
   Las tiendas que venden ropa y calzado no dejan comprar sin elegir
   el talle. NiJu tampoco: sin eso compraríamos a ciegas.
   Los talles y el stock se leen de la propia tienda, en el momento.
   Si la tienda no los deja leer y el producto los necesita, el
   cliente los escribe a mano y el dueño los verifica al comprar.
   ============================================================ */
import { el, plata } from '../util.js';
import { variantesDe } from '../engine/nube.js';
import { STORE_BY_ID } from '../data/stores.js';

const PRENDA = /\b(zapatill|zapato|botin|botita|botas?\b|borcego|ojota|sandalia|pantufla|remera|camis|chomba|musculosa|top\b|buzo|campera|chaleco|sweater|pul+over|cardigan|polera|pantal|jean|jogging|calza|legging|short|bermuda|pollera|falda|vestido|enterito|body\b|malla|bikini|corpi|bombach|boxer|slip\b|medias?\b|soquete|guante|pijama|saco\b|blazer|tapado|parka|rompeviento|babucha|uniforme|anillo|casco|patines?\b|rollers?\b)/i;

/** ¿Este producto se compra por talle o medida? */
export const necesitaTalle = o => PRENDA.test(o?.titulo || '') || ['moda', 'calzado', 'indumentaria'].includes(o?.rubro);

export function selectorVariantes(oferta, { alCambiar } = {}){
  const tienda = STORE_BY_ID[oferta.tiendaId]?.nombre || 'la tienda';
  const nodo = el('div', { class:'var-box' });
  let estado = oferta.demo === false && !oferta.propio ? 'cargando' : (necesitaTalle(oferta) && !oferta.propio ? 'manual' : 'nada');
  let datos = null;
  let sel = {};
  const manual = { talle:'', color:'' };

  const opciones = () => datos?.opciones || [];
  const coincide = (s, elegido) => Object.entries(elegido).every(([k, v]) => !s.valores?.[k] || s.valores[k] === v);
  const hayStock = s => s.disponible !== false;

  function skuElegido(){
    if (!datos?.skus?.length) return null;
    if (!opciones().length) return datos.skus.length === 1 ? datos.skus[0] : null;
    if (opciones().some(o => !sel[o.nombre])) return null;
    return datos.skus.find(s => coincide(s, sel)) || null;
  }

  function info(s){
    if (!hayStock(s)) return el('div', { class:'notice notice-bad' }, 'Esa combinación no tiene stock en la tienda.');
    return el('div', { class:'tiny' },
      s.stock != null && s.stock <= 5 ? el('b', { style:{ color:'var(--warn)' } }, `¡Quedan ${s.stock}! `) : null,
      s.precio && Math.abs(s.precio - oferta.precio) > 0.5
        ? el('span', { class:'dim' }, `En esta variante la tienda cobra ${plata(s.precio)}.`) : null);
  }

  function pintar(){
    nodo.hidden = estado === 'nada';
    if (estado === 'nada'){ nodo.replaceChildren(); return; }

    if (estado === 'cargando'){
      nodo.replaceChildren(el('div', { class:'tiny dim' }, `Leyendo talles y stock en ${tienda}…`));
      return;
    }

    if (estado === 'manual'){
      const campo = (etiqueta, clave, ejemplo) => el('div', { class:'field' }, el('label', {}, etiqueta),
        el('input', { class:'inp', value:manual[clave], placeholder:ejemplo, oninput:e => { manual[clave] = e.target.value; nodo.classList.remove('falta'); } }));
      nodo.replaceChildren(
        el('div', { class:'notice' }, el('b', {}, 'Elegí tu talle. '),
          `No pudimos leer los talles de ${tienda}. Escribilo tal como figura en la tienda: lo verificamos antes de comprar y, si no hay, te consultamos.`),
        el('div', { class:'grid g-2' },
          campo('Talle o medida *', 'talle', 'Ej: 40, M, 32x34'),
          campo('Color', 'color', 'Ej: negro')),
        oferta.url ? el('a', { class:'tiny', href:oferta.url, target:'_blank', rel:'noopener' }, `Ver la tabla de talles en ${tienda}`) : '');
      return;
    }

    const s = skuElegido();
    nodo.replaceChildren(
      ...opciones().map(op => el('div', { class:'var-opc' + (sel[op.nombre] ? ' lista' : '') },
        el('div', { class:'var-nombre' }, op.nombre + ': ', el('b', {}, sel[op.nombre] || 'elegí uno')),
        el('div', { class:'var-vals' }, ...op.valores.map(v => {
          const conEsto = datos.skus.some(x => coincide(x, { ...sel, [op.nombre]:v }) && hayStock(x));
          const existe = datos.skus.some(x => coincide(x, { [op.nombre]:v }) && hayStock(x));
          return el('button', {
            type:'button',
            class:'var-chip' + (sel[op.nombre] === v ? ' on' : '') + (conEsto ? '' : ' agotado'),
            title: existe ? (conEsto ? '' : 'No hay en la combinación que elegiste') : 'Sin stock en la tienda',
            disabled: existe ? null : true,
            onclick:() => {
              const nuevo = { ...sel, [op.nombre]:v };
              /* Si con lo ya elegido no hay, arrancamos de nuevo desde este valor */
              sel = datos.skus.some(x => coincide(x, nuevo) && hayStock(x)) ? nuevo : { [op.nombre]:v };
              nodo.classList.remove('falta');
              pintar(); alCambiar?.();
            }
          }, v);
        })))),
      s ? info(s) : '',      /* replaceChildren escribe "null" si le pasás null */
      el('div', { class:'tiny dim' }, `Talles y stock según ${tienda}, consultados recién.`));
  }

  if (estado === 'cargando'){
    variantesDe(oferta).then(d => {
      if (d.soportado && !d.error && d.skus?.length){
        datos = d;
        for (const op of d.opciones) if (op.valores.length === 1) sel[op.nombre] = op.valores[0];
        estado = d.opciones.length ? 'lista' : 'nada';     // sin talles: igual guardamos el código del producto
      } else {
        estado = necesitaTalle(oferta) ? 'manual' : 'nada';
      }
    }).catch(() => { estado = necesitaTalle(oferta) ? 'manual' : 'nada'; })
      .finally(() => { pintar(); alCambiar?.(); });
  }
  pintar();

  return {
    nodo,
    precio:() => skuElegido()?.precio ?? null,
    imagen:() => Object.keys(sel).length ? (datos?.skus.find(s => coincide(s, sel) && s.imagen)?.imagen || null) : null,
    marcarFalta(){ nodo.classList.add('falta'); nodo.scrollIntoView({ block:'center', behavior:'smooth' }); },

    /** Lo que se guarda en el carrito, o por qué todavía no se puede comprar. */
    eleccion(){
      if (estado === 'cargando') return { ok:false, error:'Esperá un segundo: estamos leyendo los talles de la tienda.' };
      if (estado === 'manual'){
        const talle = manual.talle.trim(), color = manual.color.trim();
        if (!talle) return { ok:false, error:'Escribí el talle o la medida que querés.' };
        return { ok:true, variante:{ manual:true, texto:[`Talle ${talle}`, color && `Color ${color}`].filter(Boolean).join(' · '),
                                     valores:{ Talle:talle, ...(color ? { Color:color } : {}) } } };
      }
      if (!datos) return { ok:true, variante:null };
      const faltan = opciones().filter(o => !sel[o.nombre]).map(o => o.nombre.toLowerCase());
      if (faltan.length) return { ok:false, error:`Elegí ${faltan.join(' y ')} antes de comprar.` };
      const s = skuElegido();
      if (!s) return { ok:false, error:'Esa combinación no existe en la tienda.' };
      if (!hayStock(s)) return { ok:false, error:'Esa combinación no tiene stock en la tienda.' };
      return { ok:true, variante:{
        sku:String(s.sku), seller:s.seller || null, plataforma:datos.plataforma, host:datos.host,
        valores:{ ...sel }, texto:opciones().map(o => `${o.nombre} ${sel[o.nombre]}`).join(' · '),
        precio:s.precio ?? null, imagen:s.imagen || null } };
    }
  };
}
