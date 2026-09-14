/* ============================================================
   NiJu — "Traelo por mí"
   Si el producto no está en la app, el cliente pega el link de
   CUALQUIER tienda del mundo. Lo leemos, lo traemos adentro, le
   decimos cuánto sale puesto en su casa —con impuestos y gestión—
   y NiJu se encarga de todos los trámites.
   Se presenta como los servicios de "pegá el link" de los grandes
   e-commerce: portada con buscador grande, el producto encontrado en
   una tarjeta, un cotizador con total grande y los pasos a la vista.
   ============================================================ */
import { el, plata, ic, toast, fecha, uid } from '../util.js';
import { CONFIG } from '../config.js';
import { RUBROS } from '../data/catalog.js';
import { STORE_BY_ID } from '../data/stores.js';
import { mejorRegimen } from '../engine/taxes.js';
import { panelImportacion } from './desglose.js';
import { calcularFee, TARIFARIO } from '../engine/fees.js';
import { comprobanteGestion, ALICUOTAS } from '../engine/facturacion.js';
import { aPesos, aUSD, FX } from '../engine/fx.js';
import { store } from '../state.js';
import { foto, logoTienda, cargandoNiju, botonVolver } from './components.js';
import { tokens } from '../engine/normalize.js';

/* Pasos que NiJu se compromete a hacer por el cliente */
const TRAMITES = [
  ['check',     'Verificamos el vendedor',  'Chequeamos que la tienda y el vendedor sean confiables antes de poner un peso.'],
  ['carrito',   'Compramos por vos',        'Pagamos en la tienda de origen con nuestros medios. Vos nos pagás en pesos, acá.'],
  ['caja',      'Preparamos el envío',      'Recibimos el paquete y lo dejamos listo para viajar.'],
  ['mundo',     'Hacemos la aduana',        'Declaración, franquicia y derechos: el trámite lo hacemos nosotros.'],
  ['envio',     'Te lo llevamos a tu casa', 'Última milla y seguimiento hasta la puerta.'],
  ['documento', 'Te dejamos la carpeta',    'Comprobantes y tratamiento impositivo listos para tu contador.']
];

/* Tiendas que se muestran como ejemplo: solo las que la app conoce. */
const TIENDAS_EJEMPLO = ['amazon', 'aliexpress', 'meli', 'ebay', 'shein', 'temu', 'walmart', 'alibaba'];

const pct = v => `${(v * 100).toLocaleString('es-AR', { maximumFractionDigits:2 })}%`;

/* AliExpress, Temu, SHEIN y Amazon no dejan que un programa lea sus fichas.
   Del link mismo se saca lo que se puede: la tienda, de dónde viene y, si el
   link lo trae escrito, el nombre del producto. Lo demás lo carga el cliente. */
const DESDE_CHINA = /aliexpress|temu|shein|alibaba|made-in-china|banggood|dhgate/i;
const TIENDAS_LINK = [[/aliexpress/i, 'AliExpress'], [/temu/i, 'Temu'], [/shein/i, 'SHEIN'], [/alibaba/i, 'Alibaba'], [/made-in-china/i, 'Made-in-China'],
  [/amazon/i, 'Amazon'], [/ebay/i, 'eBay'], [/walmart/i, 'Walmart'], [/bestbuy/i, 'Best Buy']];

function leerLink(u){
  let url; try{ url = new URL(u); }catch{ return {}; }
  const host = url.hostname.replace(/^www\./, '');
  const nombre = TIENDAS_LINK.find(([rx]) => rx.test(host))?.[1] || host;
  /* Amazon: /Nombre-Del-Producto/dp/ASIN · SHEIN y Temu: /nombre-p-123.html o /nombre-g-123.html */
  const tramo = url.pathname.split('/').filter(Boolean)
    .map(p => decodeURIComponent(p).replace(/\.html?$/i, '').replace(/-(p|g)-\d+.*$/i, ''))
    .filter(p => /[a-z]/i.test(p) && p.split('-').length >= 3 && !/^(dp|item|gp|product|goods)$/i.test(p))[0];
  const titulo = tramo ? tramo.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return { titulo, origen:DESDE_CHINA.test(host) ? 'china' : /amazon\.com$|ebay\.com$|walmart|bestbuy/i.test(host) ? 'eeuu' : null,
    tienda:{ nombre, tipo:/\.ar$/.test(host) ? 'nacional' : 'internacional', moneda:/\.ar$/.test(host) ? 'ARS' : 'USD' } };
}

/* ¿Lo que leyó el servidor es OTRO producto que el del link? Solo si no comparten
   ni una palabra (Temu mostró "cinta selladora" para un link de impresora).
   mismaIntencion() era demasiado exigente acá: el link de Amazon viene en inglés y
   el título en español, y "WH-1000XM5" contaba como una palabra distinta de
   "WH 1000XM5", así que se tiraban la foto y el precio de fichas correctas. */
const palabras = s => new Set(tokens(s).flatMap(t => t.split(/[-/.+"]+/)).filter(t => t.length > 1));
function esOtroProducto(delLink, leido){
  const a = palabras(delLink), b = palabras(leido);
  if (!a.size || !b.size) return false;
  for (const t of a) if (b.has(t)) return false;
  return true;
}

/* Hasta 25 segundos y un reintento: una red lenta del teléfono no es un error. */
async function pedirResolver(u){
  for (let intento = 1; ; intento++){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try{
      const r = await fetch(`${CONFIG.api}/resolver?url=${encodeURIComponent(u)}`, { signal:ctrl.signal });
      const texto = await r.text();
      try{ return JSON.parse(texto); }catch{ throw new Error(`el servidor respondió ${r.status} sin datos`); }
    }catch(e){
      if (intento >= 2) throw e;
    }finally{ clearTimeout(t); }
  }
}

export function vistaPedido(ir){
  const raiz = el('div', { class:'wrap c-cuenta' });
  const cuerpo = el('div');

  let datos = null;          // lo que devolvió el resolver
  let panel = null;          // panel de importación del producto actual
  const form = { pesoKg:1, unidades:1, destino:'uso', rubro:'tecnologia' };

  /* ---------- Entrada ---------- */
  const link = el('input', { type:'url', inputmode:'url', 'aria-label':'Link del producto',
    placeholder:'Pegá el link del producto de cualquier tienda' });
  const estado = el('div');           // producto encontrado o aviso
  const manualBox = el('div');        // formulario a mano (no se borra al cotizar)
  const cotizBox = el('div');         // cotización, se vuelve a pintar con cada cambio

  const buscarLink = async () => {
    const u = link.value.trim();
    if (!u) return toast('Pegá primero el link del producto', 'bad');
    if (!/^https?:\/\//i.test(u)) return toast('El link tiene que empezar con http:// o https://', 'bad');

    estado.replaceChildren(cargandoNiju('Leyendo el producto en la tienda…'));
    manualBox.replaceChildren(); cotizBox.replaceChildren(); panel = null;
    estado.scrollIntoView({ behavior:'smooth', block:'start' });

    try{
      const d = await pedirResolver(u);
      /* Temu a veces responde con otra ficha (sus recomendados) en vez del producto
         del link: si el link trae el nombre y no se parece a lo leído, ese precio no se usa. */
      const delLink = leerLink(u).titulo;
      const otro = d.titulo && delLink && esOtroProducto(delLink, d.titulo);
      if (otro){
        Object.assign(d, { ok:false, confianza:'nula', error:'La tienda nos mostró un producto distinto al de tu link.',
          sugerencia:'Abrí el producto en la tienda y completá el precio abajo: te cotizamos igual.' });
      }
      /* Con nombre y foto pero sin precio legible, igual se muestra el producto
         y el cliente escribe el precio al lado de la foto. */
      d.leido = !!d.titulo && (d.ok || d.confianza === 'parcial');
      datos = d;
      if (!d.leido){
        // El backend puede devolver un error técnico: al cliente le hablamos claro.
        const tecnico = !d.sugerencia;
        estado.replaceChildren(el('div', { class:'notice', style:{ marginBottom:'12px' } },
          el('b', {}, tecnico ? 'No pudimos leer ese link automáticamente.' : (d.error || 'No pudimos leer esa página.')),
          el('div', { class:'tiny', style:{ marginTop:'5px' } },
            d.sugerencia || 'No pasa nada: cargá los datos a mano acá abajo y te cotizamos igual, con impuestos y gestión incluidos.'),
          tecnico && d.error ? el('div', { class:'tiny dim', style:{ marginTop:'4px' } }, 'Detalle técnico: ' + d.error) : null));
        estado.append(tarjetaOrigen(u, d.tienda));
        pintarManual(u, d.tienda);
        return;
      }
      pintarEncontrado(d);
    }catch(e){
      datos = null;
      const motivo = !navigator.onLine ? 'Tu teléfono o computadora está sin internet.'
        : e.name === 'AbortError' ? 'La tienda tardó demasiado en responder (probamos dos veces).'
        : 'No pudimos hablar con el servidor de NiJu (probamos dos veces).';
      estado.replaceChildren(el('div', { class:'notice notice-bad', style:{ marginBottom:'12px' } },
        el('b', {}, 'No pudimos leer el link. '), motivo,
        el('div', { class:'tiny', style:{ marginTop:'5px' } }, 'Completá abajo el precio (y el nombre si no aparece) y te cotizamos igual. ',
          el('button', { class:'p-link', onclick:buscarLink }, 'Probar de nuevo')),
        e.name !== 'AbortError' && e.message ? el('div', { class:'tiny dim', style:{ marginTop:'4px' } }, 'Detalle técnico: ' + e.message) : null),
        tarjetaOrigen(u, null));
      pintarManual(u, null);
    }
  };
  link.addEventListener('keydown', e => { if (e.key === 'Enter') buscarLink(); });

  /* Si la tienda no deja leer la ficha, igual mostramos de dónde es el producto
     y un botón grande para abrirlo: ahí el cliente ve la foto y copia el precio.
     No se puede mostrar adentro de la app: esas tiendas prohíben abrirse en otro sitio. */
  const tarjetaOrigen = (u, tienda) => {
    const l = leerLink(u);
    const nombre = tienda?.nombre || l.tienda?.nombre || 'la tienda';
    return el('section', { class:'t-origen' },
      el('span', { class:'t-origen-ic' }, ic('tienda')),
      el('div', { class:'t-origen-txt' },
        el('small', {}, `Producto en ${nombre}`),
        el('b', {}, l.titulo || 'Tu producto'),
        el('span', {}, `${nombre} no deja que la app lea su página. Abrila, mirá la foto y el precio, y completalos abajo.`)),
      el('a', { class:'btn btn-win', href:u, target:'_blank', rel:'noopener' }, 'Abrir el producto en ', nombre, ' ↗'));
  };

  /* Campo de precio grande, como en la calculadora */
  const campoPrecio = etiqueta => el('label', { class:'k2-campo' },
    el('span', {}, etiqueta),
    el('div', { class:'k2-input' }, el('b', {}, form.moneda || 'USD'),
      el('input', { type:'number', inputmode:'decimal', min:'0', step:'0.01', value:form.precio || '',
        oninput:e => { form.precio = +e.target.value || 0; pintarCotizador(); } })));

  /* ---------- Producto encontrado ---------- */
  function pintarEncontrado(d){
    form.precio = d.precio ?? 0;
    form.moneda = d.moneda || (d.tienda?.moneda || 'USD');
    form.titulo = d.titulo;
    form.imagen = d.imagen;
    form.tienda = d.tienda;
    form.url = d.url;

    const precios = d.candidatos?.length > 1 ? [...new Set(d.candidatos.map(c => c.valor))].sort((a, b) => a - b) : [];
    const chipsPrecio = el('div', { class:'k2-chips' });
    const pintarChipsPrecio = () => chipsPrecio.replaceChildren(...precios.map(v => el('button', {
      class:'v-chip' + (v === form.precio ? ' on' : ''),
      onclick:() => { form.precio = v; pintarChipsPrecio(); pintarCotizador(); } }, plata(v, form.moneda))));
    pintarChipsPrecio();

    estado.replaceChildren(el('section', { class:'t-encontrado' },
      el('div', { class:'t-encontrado-foto' }, foto({ imagen:d.imagen, titulo:d.titulo }, 't-foto')),
      el('div', { class:'t-encontrado-info' },
        el('span', { class:'t-sello' }, ic('check'), d.tienda?.nombre ? `Lo encontramos en ${d.tienda.nombre}` : 'Lo encontramos'),
        el('h2', {}, d.titulo),
        d.marca ? el('div', { class:'c-sub' }, 'Marca: ' + d.marca) : null,
        d.precio != null
          ? el('div', { class:'t-precio' }, plata(d.precio, form.moneda), el('small', {}, 'precio en la tienda'))
          : [ el('div', { class:'notice', style:{ margin:'8px 0' } }, 'La página no muestra el precio de forma legible. Escribilo acá:'),
              campoPrecio('Precio en la tienda') ],
        d.aviso ? el('div', { class:'notice notice-bad', style:{ margin:'8px 0' } }, el('b', {}, 'Revisá el precio. '), d.aviso) : null,
        precios.length ? el('div', { class:'k2-campo', style:{ margin:'6px 0 10px' } },
          el('span', {}, 'Encontramos varios precios en esa página. ¿Cuál es el tuyo?'), chipsPrecio) : null,
        el('a', { href:d.url, target:'_blank', rel:'noopener', class:'c-fuente' }, 'Ver en la tienda original'))));
    pintarCotizador();
  }

  /* ---------- Carga a mano ---------- */
  function pintarManual(u, tienda){
    const delLink = leerLink(u);
    form.url = u; form.tienda = tienda || delLink.tienda || { nombre:'Tienda externa', tipo:'internacional', moneda:'USD' };
    form.titulo = delLink.titulo || ''; form.origen = delLink.origen; form.precio = 0; form.moneda = form.tienda.moneda || 'USD'; form.imagen = null;

    const campo = (etiqueta, clave, ayuda) => el('label', { class:'k2-campo' }, el('span', {}, etiqueta),
      el('input', { class:'inp', value:form[clave] ?? '', oninput:e => { form[clave] = e.target.value; pintarCotizador(); } }),
      ayuda ? el('small', {}, ayuda) : null);

    /* Del exterior: el panel de importación tiene sus propios campos. */
    if ((form.tienda.tipo || 'internacional') !== 'nacional'){ manualBox.replaceChildren(''); pintarCotizador(); return; }

    manualBox.replaceChildren(el('section', { class:'t-manual' },
      el('h2', {}, 'Contanos qué querés que traigamos'),
      el('div', { class:'grid g-2' },
        campo('Qué es', 'titulo', 'Por ejemplo: auriculares Sony WH-1000XM5.'),
        el('label', { class:'k2-campo' }, el('span', {}, 'Moneda de la tienda'),
          el('select', { class:'inp', onchange:e => { form.moneda = e.target.value; pintarCotizador(); } },
            ...['USD', 'ARS', 'EUR', 'CNY'].map(m => el('option', { value:m, selected:form.moneda === m || null }, m)))),
        el('label', { class:'k2-campo' }, el('span', {}, 'Precio en la tienda'),
          el('input', { class:'inp', type:'number', min:'0', step:'0.01', oninput:e => { form.precio = +e.target.value || 0; pintarCotizador(); } })),
        campo('Link', 'url'))));
    pintarCotizador();
  }

  /* ---------- Cotización ---------- */
  function pintarCotizador(){
    const internacional = (form.tienda?.tipo || 'internacional') !== 'nacional';
    /* Del exterior: todo discriminado, etapa por etapa (ui/desglose.js).
       El panel se arma una vez por producto; si cambia el precio, se actualiza. */
    if (internacional){
      const leido = datos?.leido;
      const clave = leido ? `${form.url}|${form.titulo}` : `${form.url}|manual`;
      if (panel?.clave !== clave){
        panel = panelImportacion({ ir, alConfirmar:pedirImportacion, producto: leido
          ? { titulo:form.titulo, precio:form.precio, moneda:form.moneda, descripcion:datos.descripcion || '', marca:datos.marca || '', tienda:form.tienda, url:form.url, imagen:form.imagen }
          : null,
          sugerido:leido ? null : { titulo:form.titulo, origen:form.origen, tienda:form.tienda, url:form.url } });
        panel.clave = clave;
      }
      if (leido) panel.actualizarPrecio(form.precio, form.moneda);
      if (cotizBox.firstChild !== panel) cotizBox.replaceChildren(panel);
      return;
    }
    const valorUSD = aUSD(form.precio || 0, form.moneda || 'USD') * (form.unidades || 1);
    const fleteUSD = internacional ? Math.max(9, (form.pesoKg || 1) * (form.unidades || 1) * 11) : 0;

    const m = internacional ? mejorRegimen({
      valorUSD, fleteUSD, pesoKg:(form.pesoKg || 1) * (form.unidades || 1), rubro:form.rubro, unidades:form.unidades || 1
    }) : null;
    /* Para vender no se puede usar courier: va con despachante. */
    if (m && form.destino === 'reventa'){ m.elegido = 'general'; m.motivo = 'Para vender no se puede traer por courier: va con despachante.'; }
    const imp = m ? m[m.elegido] : null;

    const fee = calcularFee({ valorUSD, fleteUSD, tipo:internacional ? (m?.elegido === 'general' ? 'mayorista' : 'internacional') : 'nacional' });
    const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
    const comp = comprobanteGestion({
      feeARS:fee.feeUSD * FX.tarjeta, incluyeIVA:true, condicion:perfilId,
      jurisdiccion:store.get('config').provincia,
      cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit }
    });

    const productoARS  = aPesos(form.precio || 0, form.moneda || 'USD') * (form.unidades || 1);
    const fleteARS     = fleteUSD * FX.tarjeta;
    const impuestosARS = imp ? (imp.impuestos + (imp.gastos || 0)) * FX.tarjeta : 0;
    const totalARS     = Math.round(productoARS + fleteARS + impuestosARS + comp.total);

    const botones = (etiqueta, clave, opciones) => el('div', { class:'k2-campo' }, el('span', {}, etiqueta),
      el('div', { class:'k2-chips', role:'group', 'aria-label':etiqueta }, ...opciones.map(([valor, texto]) =>
        el('button', { class:'v-chip' + (form[clave] === valor ? ' on' : ''), 'aria-pressed':String(form[clave] === valor),
          onclick:() => { form[clave] = valor; pintarCotizador(); } }, texto))));
    const cambiarUnidades = d => { form.unidades = Math.max(1, (form.unidades || 1) + d); pintarCotizador(); };
    const listo = !!(form.titulo && form.precio);

    cotizBox.replaceChildren(el('div', { class:'t-cotiza' },
      el('section', { class:'k2-form t-ajustes' },
        el('h2', {}, 'Ajustá tu envío'),
        internacional ? botones('¿Cuánto pesa cada uno?', 'pesoKg', [[1, 'Hasta 1 kg'], [2, '1 a 3 kg'], [5, '3 a 10 kg'], [15, 'Más de 10 kg']]) : null,
        el('div', { class:'k2-campo' }, el('span', {}, 'Cantidad'),
          el('div', { class:'qty k2-qty' },
            el('button', { 'aria-label':'Uno menos', onclick:() => cambiarUnidades(-1) }, '−'),
            el('b', {}, String(form.unidades || 1)),
            el('button', { 'aria-label':'Uno más', onclick:() => cambiarUnidades(1) }, '+'))),
        botones('¿Para qué es?', 'destino', [['uso', 'Para mí o mi familia'], ['reventa', 'Para vender']]),
        el('label', { class:'k2-campo' }, el('span', {}, 'Rubro'),
          el('select', { class:'inp', onchange:e => { form.rubro = e.target.value; pintarCotizador(); } },
            ...RUBROS.map(r => el('option', { value:r.id, selected:form.rubro === r.id || null }, r.nombre)))),
        internacional ? el('p', { class:'c-sub', style:{ margin:'0' } },
          'El peso define el flete. Si no lo sabés, dejá "Hasta 1 kg": al confirmar lo pesamos de verdad y te ajustamos la diferencia antes de cobrarte.') : null),

      el('section', { class:'t-resumen' },
        el('div', { class:'k2-resultado', 'aria-live':'polite' },
          el('small', {}, 'Puesto en tu casa, todo incluido'),
          el('div', { class:'k2-total' }, listo ? plata(totalARS) : '—'),
          el('div', { class:'k2-total-usd' }, listo ? 'Producto, envío, impuestos y gestión de NiJu. Sin sorpresas después.' : 'Completá qué es y el precio para ver el total.'),
          m && listo ? el('div', { class:'k2-motivo' }, ic('check'), m.motivo) : null),
        el('div', { class:'t-lineas' },
          linea('Producto', productoARS, form.moneda !== 'ARS' && form.precio ? `${plata(form.precio, form.moneda)} × ${form.unidades}` : null),
          internacional ? linea('Envío internacional', fleteARS, `estimado para ${(form.pesoKg * form.unidades).toLocaleString('es-AR')} kg`) : null,
          imp ? linea(imp.regimen === 'courier' ? 'Impuestos (courier)' : 'Impuestos y aduana (despachante)', impuestosARS) : null,
          comp.condicion === 'responsable_inscripto'
            ? [linea('Gestión NiJu (neto)', comp.neto), linea(`IVA ${(ALICUOTAS.iva * 100).toFixed(0)}%`, comp.iva)]
            : linea('Gestión NiJu', comp.total, `${fee.pctEfectivo || 0}% · IVA incluido`),
          el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('b', {}, listo ? plata(totalARS) : '—'))),
        imp?.bloqueado ? el('div', { class:'notice notice-bad' },
          'Esta compra supera los límites del courier: se hace como compra grande, con despachante. ',
          el('button', { class:'p-link', onclick:() => ir('#/grandes') }, 'Ver cómo funciona')) : null,
        el('button', { class:'btn btn-lg btn-win btn-block', disabled:listo ? null : true, onclick:() => confirmar(totalARS, imp, fee, comp) },
          ic('envio'), 'Pedir que NiJu lo traiga'),
        el('div', { class:'tiny dim center' }, 'Sin cargo hasta que confirmes. Te mandamos la cotización final.'))));
  }

  function pedirImportacion(res){
    /* Pedido de cotización con el desglose completo. No va a la carpeta
       fiscal como compra: aparece en "Tus cotizaciones de importación". */
    store.push('pedidos', {
      id:'pd-' + uid(), creado:Date.now(), estado:'cotizado',
      titulo:res.titulo || form.titulo, imagen:form.imagen, url:form.url,
      tienda:form.tienda?.nombre || 'Tienda externa', precio:form.precio, moneda:form.moneda,
      unidades:res.unidades, pesoKg:res.pesoKg, destino:res.destino,
      totalARS:res.totalARS, regimen:res.via, desglose:res
    });
    toast('¡Pedido creado! Te mandamos la cotización final', 'win');
    link.value = ''; panel = null;
    estado.replaceChildren(); manualBox.replaceChildren(); cotizBox.replaceChildren();
    pintar();
    document.querySelector('.t-mis-pedidos')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function confirmar(totalARS, imp, fee, comp){
    /* Es un pedido de cotización, no una compra: no va a la carpeta fiscal
       (la carpeta solo cuenta compras pagadas). */
    store.push('pedidos', {
      id:'pd-' + uid(), creado:Date.now(), estado:'cotizado',
      titulo:form.titulo, imagen:form.imagen, url:form.url,
      tienda:form.tienda?.nombre || 'Tienda externa',
      precio:form.precio, moneda:form.moneda, unidades:form.unidades,
      pesoKg:form.pesoKg, rubro:form.rubro, destino:form.destino,
      totalARS, regimen:imp?.regimen || null, feeUSD:fee.feeUSD, ivaFeeARS:comp.iva
    });
    toast('¡Pedido creado! Te mandamos la cotización final', 'win');
    link.value = '';
    estado.replaceChildren(); manualBox.replaceChildren(); cotizBox.replaceChildren();
    pintar();
    document.querySelector('.t-mis-pedidos')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  /* ---------- Pedidos existentes ---------- */
  function listaPedidos(){
    const p = store.get('pedidos') || [];
    if (!p.length) return null;
    return el('section', { class:'t-mis-pedidos' },
      el('h2', { class:'c-seccion' }, 'Tus pedidos para traer'),
      el('div', { class:'col' }, ...p.slice().reverse().map(x => el('article', { class:'t-pedido' },
        foto({ imagen:x.imagen, titulo:x.titulo }, 't-mini'),
        el('div', { class:'spacer', style:{ minWidth:'0' } },
          el('b', {}, x.titulo || 'Pedido'),
          el('div', { class:'tiny dim' }, `${x.tienda} · ${x.unidades} u. · ${fecha(x.creado)}`),
          x.url ? el('a', { href:x.url, target:'_blank', rel:'noopener', class:'tiny' }, 'Ver en la tienda original ↗') : null,
          x.desglose ? el('button', { class:'p-link tiny', onclick:() => ir('#/impuestos?tab=carpeta') }, 'Ver el desglose completo') : null),
        el('div', { style:{ textAlign:'right' } },
          el('span', { class:'k-estado warn' }, x.estado === 'cotizado' ? 'Cotizando' : x.estado),
          el('div', { class:'price price-lg', style:{ marginTop:'4px' } }, plata(x.totalARS)))))));
  }

  /* ---------- Armado ---------- */
  function pintar(){
    const i = TARIFARIO.internacional;
    const tiendas = TIENDAS_EJEMPLO.filter(id => STORE_BY_ID[id]);
    const pregunta = (titulo, texto) => el('details', {}, el('summary', {}, titulo), el('div', { class:'c-faq-body' }, el('p', {}, texto)));

    cuerpo.replaceChildren(...[
      botonVolver(ir),
      el('section', { class:'t-hero' },
        el('span', { class:'c-hero-kicker' }, 'Traelo por mí'),
        el('h1', {}, 'Lo que viste en cualquier tienda del mundo, en tu casa'),
        el('p', {}, 'Pegá el link. Te decimos cuánto sale puesto en tu casa —con envío, impuestos y gestión— y nos encargamos de todo. Vos pagás en pesos, acá.'),
        el('div', { class:'t-buscador' }, ic('mundo'), link,
          el('button', { onclick:buscarLink }, ic('buscar'), 'Traer')),
        el('details', { class:'t-ayuda' },
          el('summary', {}, '¿Cómo copio el link?'),
          el('ol', {},
            el('li', {}, 'Abrí el producto en la app o en la página de la tienda.'),
            el('li', {}, 'Tocá "Compartir" y elegí "Copiar enlace" (o copiá la dirección de arriba del navegador).'),
            el('li', {}, 'Pegalo en el buscador de acá arriba y tocá "Traer".'))),
        el('div', { class:'t-logos' }, ...tiendas.map(id => logoTienda(id, true)), el('span', {}, 'y cualquier otra tienda'))),

      el('div', { class:'t-confianza' },
        ...[['etiqueta', 'Precio final antes de pagar'], ['caja', 'Pagás en pesos, acá'], ['mundo', 'La aduana la hacemos nosotros'], ['envio', 'Seguimiento hasta tu puerta']]
          .map(([icono, texto]) => el('div', {}, el('span', { class:'c-ic' }, ic(icono)), texto))),

      el('div', { class:'t-resultado' }, estado, manualBox, cotizBox),

      listaPedidos(),

      el('h2', { class:'c-seccion' }, 'Cómo lo traemos'),
      el('ol', { class:'t-pasos' }, ...TRAMITES.map(([icono, titulo, texto], n) => el('li', {},
        el('span', { class:'t-paso-n', 'aria-hidden':'true' }, String(n + 1)),
        el('span', { class:'c-ic' }, ic(icono)), el('b', {}, titulo), el('p', {}, texto)))),

      el('h2', { class:'c-seccion' }, 'Preguntas rápidas'),
      el('div', { class:'c-faq' },
        pregunta('¿Cuánto cobra NiJu por traerlo?',
          `Entre ${pct(i.tramos.at(-1).pct)} y ${pct(i.tramos[0].pct)} del valor según el monto (cuanto más grande, menor el porcentaje), más US$ ${i.logisticaFijaUSD} de logística. Siempre lo ves sumado en el total antes de confirmar.`),
        pregunta('¿Y si el peso real es otro?',
          'Cuando confirmás, pesamos el paquete de verdad. Si el flete cambia, te avisamos la diferencia antes de cobrarte.'),
        pregunta('¿Tiene garantía?',
          'NiJu responde por la gestión. La garantía del fabricante puede no valer en el país cuando el producto viene del exterior: te lo explicamos antes de que confirmes.'),
        pregunta('¿Y si es para vender o son muchas unidades?',
          'Eso ya es una compra grande: va con despachante e importación formal. Te acompañamos paso a paso.')),
      el('div', { class:'c-acciones', style:{ marginTop:'14px' } },
        el('button', { class:'btn', onclick:() => ir('#/impuestos?tab=calc') }, ic('calc'), 'Calcular antes de pegar un link'),
        el('button', { class:'btn', onclick:() => ir('#/grandes') }, 'Compras grandes'),
        el('button', { class:'btn btn-ghost', onclick:() => ir('#/ayuda') }, 'Más preguntas'))
    ].filter(Boolean));
  }

  pintar();
  raiz.append(cuerpo);
  return raiz;
}

const linea = (k, v, nota) => el('div', { class:'cost-line' },
  el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
  el('span', { class:'mono' }, v ? plata(v) : '—'));
