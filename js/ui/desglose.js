/* ============================================================
   NiJu — Panel de importación, todo discriminado
   ------------------------------------------------------------
   Se usa en "Traelo por mí" (con el producto leído del link) y en
   la calculadora de Impuestos (cargando los datos a mano).
   Secciones, de arriba hacia abajo:
     1. Tu situación ante ARCA (condición, destino, Ganancias, cupo)
     2. Qué es para la Aduana: posición NCM del Arancel Integrado
     3. Las cinco etapas del viaje, con tarifas publicadas o a cargar
     4. El desglose línea por línea: pequeño envío o despachante
     5. El mismo producto en tiendas argentinas
     6. Qué te conviene
     7. Preguntale a NiJu
   Los campos de texto no se vuelven a dibujar mientras escribís:
   solo se recalculan las secciones de resultados.
   ============================================================ */
import { el, plata, ic, toast, uid } from '../util.js';
import { store } from '../state.js';
import { FX, aUSD } from '../engine/fx.js';
import { calcularFee } from '../engine/fees.js';
import { PERFILES } from '../engine/fiscal.js';
import { SELLO, CONSULTADO } from '../data/normas-importacion.js';
import { ETAPAS, OPERADORES, OPERADOR_BY_ID, DESPACHANTE_REFERENCIA, CIUDADES_CHINA, CIUDAD_CHINA_BY_ID, referencia } from '../data/etapas-envio.js';
import { desglosar, recomendar } from '../engine/importacion.js';
import { guardarPendiente } from '../engine/grupal.js';
import { cargarArancel, arancelListo, buscarPosiciones, porCodigo, descripcionCompleta } from '../engine/arancel.js';
import { clasificarProducto, preguntarAsesor } from '../engine/asesor.js';
import { buscar } from '../engine/search.js';
import { STORE_BY_ID } from '../data/stores.js';
import { destino } from './components.js';

const usd = v => v == null ? '—' : `US$ ${Number(v).toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const numero = v => v === '' || v == null || !isFinite(+v) ? null : +v;
const fechaAR = iso => iso.split('-').reverse().join('/');

/* replaceChildren del navegador no aplana listas y escribe "null" como texto:
   este ayudante aplana y descarta lo vacío antes de poner los hijos. */
const poner = (nodo, ...hijos) => nodo.replaceChildren(...hijos.flat(Infinity).filter(h => h != null && h !== false));

const PREGUNTAS_RAPIDAS = ['¿Qué es el valor FOB?', '¿Por qué pago IVA si entra en la franquicia?', '¿Qué me conviene: courier o despachante?', '¿Qué es la NCM de mi producto?'];

/* Versión liviana de un desglose: para guardar y para mandar al asistente. */
const liviano = d => d.disponible
  ? { disponible:true, totalARS:d.totalARS, tributosARS:d.tributosARS, recuperaARS:d.recuperaARS, costoRealARS:d.costoRealARS, faltan:d.faltan,
      lineas:d.lineas.map(({ etapa, id, k, usd:u, ars, formula, sello, informativa, recupero, fuente, explica }) =>
        ({ etapa, id, k, usd:u, ars, formula, sello, informativa:!!informativa, recupero:recupero?.texto, fuente, explica })) }
  : { disponible:false, motivos:d.motivos };

export function panelImportacion({ ir, producto = null, sugerido = null, alConfirmar = null, alCambiar = null }){
  const cfg = () => store.get('config') || {};
  const guardarCfg = cambios => store.set('config', { ...cfg(), ...cambios });
  const usuario = store.get('usuario');
  const perfilId = usuario?.perfilFiscal || 'consumidor_final';
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;

  const s = {
    titulo:producto?.titulo || sugerido?.titulo || '', precio:producto?.precio ?? null, moneda:producto?.moneda || 'USD',
    unidades:1, pesoKg:1, destino:cfg().destinoCompra || 'uso',
    inscriptoGanancias:cfg().inscriptoGanancias ?? (perfilId === 'responsable_inscripto'),
    enviosAnio:cfg().pequenosEnviosAnio ?? 0,
    operador:'logistika-aereo', pago:cfg().pagoExterior || 'tarjeta', origen:sugerido?.origen || cfg().origenCompra || 'china', ciudadChina:cfg().ciudadChina || 'guangzhou',
    /* null = usa el valor general publicado; lo que escribe el cliente queda en "tocados" */
    costos:{ origenUSD:null, internacionalUSD:null, arriboUSD:null, seguroUSD:null, despachanteUSD:null, depositoUSD:null, ultimaMillaARS:null },
    tocados:new Set(),
    arancel:'cargando', errorArancel:'', clasificando:false, clasif:null, opciones:[], busquedaNCM:'', posicion:null, ivaReducido:false,
    locales:null, buscandoLocal:false, localElegido:null,
    tab:'pequeno', tabElegida:false, chat:[], pensando:false, resultado:null
  };

  /* Armado tipo checkout: pasos numerados a la izquierda, resumen fijo a la
     derecha (en el celular, barra abajo con el total y el botón). */
  const pid = 'dz' + uid();
  const secSituacion = el('section', { class:'dz-sec', id:`${pid}-1` });
  const secProducto  = el('section', { class:'dz-sec', id:`${pid}-2` });
  const cajaNCM      = el('div');
  const secEtapas    = el('section', { class:'dz-sec', id:`${pid}-3` });
  const cajaOps      = el('div', { class:'dz-ops', role:'radiogroup', 'aria-label':'Con quién viaja' });
  const secDesglose  = el('section', { class:'dz-sec', id:`${pid}-4`, 'aria-live':'polite' });
  const secComparar  = el('section', { class:'dz-sec' });
  const secConsejo   = el('section', { class:'dz-sec dz-consejo' });
  const secPreguntas = el('section', { class:'dz-sec' });
  const progreso     = el('nav', { class:'dz-progreso', 'aria-label':'Pasos de tu cotización' });
  const secResumen   = el('aside', { class:'dz-resumen', 'aria-live':'polite' });
  const barra        = el('div', { class:'dz-barra' });
  const irAPaso = n => document.getElementById(`${pid}-${n}`)?.scrollIntoView({ behavior:'smooth', block:'start' });

  /* ---------- Ayudantes de formulario ---------- */
  const chips = (etiqueta, actual, opciones, alElegir) => el('div', { class:'k2-campo' }, el('span', {}, etiqueta),
    el('div', { class:'k2-chips', role:'group', 'aria-label':etiqueta }, ...opciones.map(([v, t]) =>
      el('button', { class:'v-chip' + (actual === v ? ' on' : ''), 'aria-pressed':String(actual === v), onclick:() => alElegir(v) }, t))));

  /* requerido: si queda vacío se marca en rojo para invitar a completarlo. */
  const campoNum = (etiqueta, valor, alCambiarValor, { pref = 'US$', ayuda = null, paso = '0.01', min = '0', vacio = 'sin cotizar', requerido = false } = {}) =>
    el('label', { class:'dz-campo', 'data-requerido':requerido ? '1' : null }, el('span', {}, etiqueta, requerido ? el('i', { class:'dz-req' }, ' obligatorio') : null),
      el('div', { class:'k2-input' }, el('b', {}, pref),
        el('input', { type:'number', inputmode:'decimal', min, step:paso, value:valor ?? '', placeholder:valor == null ? vacio : null,
          oninput:e => alCambiarValor(numero(e.target.value)) })),
      ayuda ? el('small', {}, ayuda) : null);

  const enlace = (texto, url) => url ? el('a', { class:'c-fuente', href:url, target:'_blank', rel:'noopener' }, texto) : null;

  /* Encabezado de paso: número en círculo que se vuelve tilde al completarse. */
  const cabecera = (n, titulo, sub, listo = false) => [
    el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' + (listo ? ' listo' : ''), 'aria-hidden':'true' }, listo ? ic('check') : String(n)),
      el('span', {}, el('small', {}, `Paso ${n} de 4`), titulo)),
    sub ? el('p', { class:'dz-sub' }, sub) : null];

  /* Tarjetas de opción grandes, como en el checkout de un e-commerce. */
  const tarjetas = (etiqueta, actual, opciones, alElegir) => el('div', { class:'k2-campo dz-grupo' }, el('span', {}, etiqueta),
    el('div', { class:'dz-tarjetas', role:'radiogroup', 'aria-label':etiqueta }, ...opciones.map(([v, t, d]) =>
      el('button', { class:'dz-tarjeta' + (actual === v ? ' on' : ''), role:'radio', 'aria-checked':String(actual === v), onclick:() => alElegir(v) },
        el('span', { class:'dz-radio', 'aria-hidden':'true' }), el('span', { class:'dz-tarjeta-txt' }, el('b', {}, t), d ? el('small', {}, d) : null)))));

  /* ---------- 1. Situación ---------- */
  function pintarSituacion(){
    poner(secSituacion,
      cabecera(1, 'Contanos cómo comprás', null, true),
      el('p', { class:'dz-sub' },
        usuario ? `Calculamos como ${P.label}. ` : 'Sin cuenta, calculamos como Consumidor Final. ',
        el('button', { class:'p-link', onclick:() => ir('#/impuestos?tab=perfil') }, '¿No es tu condición?')),
      tarjetas('¿Desde dónde viene?', s.origen, [['china', 'China', 'AliExpress, Temu, SHEIN, Alibaba'], ['eeuu', 'Estados Unidos', 'Amazon, eBay, Best Buy, Walmart']],
        v => { s.origen = v; guardarCfg({ origenCompra:v }); pintarSituacion(); pintarEtapas(); recalcular(); }),
      tarjetas('¿Para qué es?', s.destino, [['uso', 'Para mí o mi familia', 'Puede entrar como pequeño envío'], ['reventa', 'Para vender', 'Va con despachante']],
        v => { s.destino = v; guardarCfg({ destinoCompra:v }); pintarSituacion(); recalcular(); }),
      tarjetas('¿Cómo pagás afuera?', s.pago, [['tarjeta', 'Tarjeta, en pesos', 'Suma 30% de percepción, recuperable'], ['dolares', 'Con mis dólares', 'Sin la percepción del 30%']],
        v => { s.pago = v; guardarCfg({ pagoExterior:v }); pintarSituacion(); recalcular(); }),
      el('details', { class:'dz-mas' }, el('summary', {}, 'Ganancias y envíos del año (ajustá si hace falta)'),
        el('div', { class:'dz-fila' },
          chips('¿Estás inscripto en Ganancias?', s.inscriptoGanancias, [[true, 'Sí'], [false, 'No']],
            v => { s.inscriptoGanancias = v; guardarCfg({ inscriptoGanancias:v }); pintarSituacion(); recalcular(); }),
          chips('Pequeños envíos que ya usaste este año', s.enviosAnio, [0, 1, 2, 3, 4, 5].map(n => [n, String(n)]),
            v => { s.enviosAnio = v; guardarCfg({ pequenosEnviosAnio:v }); pintarSituacion(); recalcular(); })),
        el('p', { class:'c-legal' }, 'Tus envíos usados los ves en ARCA con clave fiscal, en "Envíos Postales Internacionales".')),
      el('p', { class:'c-legal' }, s.pago === 'tarjeta'
        ? 'Pagando en pesos, el banco suma el 30% de percepción (RG 5617/2024) sobre lo que pagás afuera: por eso existe el "dólar tarjeta". Se recupera y lo mostramos aparte.'
        : 'Pagando el resumen en dólares con dólares propios, entre el cierre y el vencimiento, no se cobra la percepción del 30%.'));
  }

  /* ---------- 2. Producto y NCM ---------- */
  function pintarProducto(){
    poner(secProducto,
      cabecera(2, 'Tu producto', 'Con el precio, el peso y qué es, calculamos el flete y los impuestos exactos.'),
      producto ? el('p', { class:'dz-prod-tit' }, el('b', {}, s.titulo)) : el('div', { class:'dz-fila' },
        el('label', { class:'k2-campo', 'data-requerido':'1' }, el('span', {}, 'Qué es', el('i', { class:'dz-req' }, ' obligatorio')),
          el('input', { class:'inp', value:s.titulo, placeholder:'Por ejemplo: auriculares inalámbricos Sony',
            oninput:e => { s.titulo = e.target.value; marcarRequeridos(); }, onchange:() => { clasificar(); buscarLocal(); } })),
        campoNum('Precio del producto (FOB, sin envío)', s.precio, v => { s.precio = v; recalcular(); },
          { requerido:true, ayuda:'Lo que dice la tienda por todas las unidades de una, sin el envío.' })),
      el('div', { class:'dz-fila' },
        campoNum('Cantidad de unidades iguales', s.unidades, v => { s.unidades = Math.max(1, Math.round(v || 1)); recalcular(); }, { pref:'u.', paso:'1', min:'1' }),
        campoNum('Peso de cada unidad, con embalaje', s.pesoKg, v => { s.pesoKg = v || 0; recalcular(); },
          { pref:'kg', paso:'0.1', requerido:true, ayuda:'Suele figurar en la ficha de la tienda. Define el flete y si entra en los 50 kg.' })),
      el('h3', { class:'dz-h3' }, 'Qué es para la Aduana'),
      el('p', { class:'dz-sub' }, 'Cada producto tiene un código en la Nomenclatura Común del Mercosur (NCM). De ese código sale el porcentaje de derecho de importación, que leemos del Arancel Integrado de ARCA. Elegí el que describe tu producto.'),
      cajaNCM);
    pintarNCM();
  }

  function pintarNCM(){
    const A = arancelListo();
    const partes = [];
    if (s.arancel === 'cargando') partes.push(el('div', { class:'notice' },
      el('b', {}, 'Bajando el Arancel Integrado de ARCA… '),
      'La primera vez del día puede tardar unos 20 segundos, porque el servidor de ARCA es lento. Mientras tanto podés completar el resto: después queda guardado y abre al instante.'));
    if (s.arancel === 'error') partes.push(el('div', { class:'notice notice-bad' }, `No pudimos leer el Arancel de ARCA: ${s.errorArancel} `,
      el('button', { class:'p-link', onclick:iniciarArancel }, 'Probar de nuevo')));
    if (s.clasificando) partes.push(el('div', { class:'notice' }, 'Buscando la posición de tu producto…'));

    if (s.posicion) partes.push(el('div', { class:'dz-pos' },
      el('span', { class:'dz-pos-cod' }, s.posicion.codigo),
      el('span', { class:'dz-pos-die' }, el('b', {}, `${s.posicion.die.toLocaleString('es-AR')}%`), el('small', {}, 'derecho de importación')),
      el('span', { class:'dz-pos-txt' }, descripcionCompleta(s.posicion))));

    if (s.clasif && !s.clasificando){
      const c = s.clasif;
      partes.push(el('p', { class:'dz-sub', style:{ margin:'8px 0 0' } },
        el('b', {}, c.origen === 'asistente' ? `Sugerencia del asistente (confianza ${c.confianza}). ` : 'Búsqueda por palabras. '), c.motivo));
      if (c.datosQueFaltan?.length) partes.push(el('div', { class:'notice', style:{ marginTop:'8px' } },
        el('b', {}, 'Para confirmar la posición falta saber: '), c.datosQueFaltan.join(' · ')));
      if (c.ncm && !porCodigo(c.ncm).length) partes.push(el('div', { class:'notice notice-bad', style:{ marginTop:'8px' } },
        `La posición ${c.ncm} no figura en el Arancel de hoy. Buscala abajo con otras palabras.`));
    }

    if (s.opciones.length > (s.posicion ? 1 : 0)) partes.push(
      el('div', { class:'k2-campo', style:{ marginTop:'10px' } }, el('span', {}, s.posicion ? '¿Es otra? Elegí la que describe tu producto' : 'Elegí la que describe tu producto'),
        el('div', { class:'dz-lista' }, ...s.opciones.map(p => el('button', {
          class:'dz-opcion' + (s.posicion?.codigo === p.codigo ? ' on' : ''),
          onclick:() => { s.posicion = p; pintarNCM(); recalcular(); } },
          el('span', { class:'mono' }, p.codigo), el('b', { class:'mono' }, `${p.die.toLocaleString('es-AR')}%`),
          el('small', {}, descripcionCompleta(p) + (p.cuando ? ` — ${p.cuando}` : '')))))));

    if (s.clasif?.ivaReducidoPosible || s.ivaReducido) partes.push(
      chips('Este bien podría ir con IVA al 10,5%. ¿Lo confirmaste?', s.ivaReducido, [[false, 'No, 21%'], [true, 'Sí, 10,5%']],
        v => { s.ivaReducido = v; pintarNCM(); recalcular(); }));

    const buscador = el('input', { class:'inp', value:s.busquedaNCM, placeholder:'Buscar en el Arancel: palabras en castellano o un código', 'aria-label':'Buscar posición en el Arancel',
      oninput:e => { s.busquedaNCM = e.target.value; } });
    const buscarNCM = () => {
      if (!A) return toast('Esperá a que termine de cargar el Arancel', 'bad');
      s.opciones = buscarPosiciones(s.busquedaNCM, 15);
      if (!s.opciones.length) toast('No encontramos esa búsqueda en el Arancel. Probá con otras palabras.', 'bad');
      pintarNCM();
    };
    buscador.addEventListener('keydown', e => { if (e.key === 'Enter') buscarNCM(); });
    partes.push(el('div', { class:'dz-buscar' }, buscador, el('button', { class:'btn', onclick:buscarNCM }, ic('buscar'), 'Buscar')));

    partes.push(el('p', { class:'c-legal' },
      A ? `Arancel Integrado de ARCA con datos al ${A.fecha}. ` : '', 'La posición la define en última instancia Aduana. ',
      enlace('Ver el Arancel en ARCA', 'https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/default.asp')));
    poner(cajaNCM, ...partes);
  }

  async function clasificar(){
    if (!s.titulo.trim() || !arancelListo()) return;
    s.clasificando = true; pintarNCM();
    const c = await clasificarProducto({ titulo:s.titulo, descripcion:producto?.descripcion || '', marca:producto?.marca || '', tienda:producto?.tienda?.nombre || '' });
    const principales = c.ncm ? porCodigo(c.ncm) : [];
    const alternativas = (c.alternativas || []).flatMap(a => porCodigo(a.ncm).map(p => ({ ...p, cuando:a.cuando })));
    const vistas = new Set();
    const opciones = [...principales, ...alternativas].filter(p => !vistas.has(p.codigo) && vistas.add(p.codigo));
    Object.assign(s, { clasif:c, clasificando:false, opciones:opciones.slice(0, 20),
      posicion:principales.length === 1 ? principales[0] : null, ivaReducido:false });
    pintarNCM(); recalcular();
  }

  function iniciarArancel(){
    s.arancel = 'cargando'; pintarNCM();
    cargarArancel()
      .then(() => { s.arancel = 'listo'; pintarNCM(); clasificar(); })
      .catch(e => { s.arancel = 'error'; s.errorArancel = e.message || String(e); pintarNCM(); });
  }

  /* Operadores del origen elegido; en China, primero los de la ciudad de salida. */
  const operadoresDe = () => OPERADORES.filter(o => !o.origen || o.origen === s.origen)
    .sort((a, b) => (s.origen === 'china' ? (b.ciudad === s.ciudadChina) - (a.ciudad === s.ciudadChina) : 0));
  const asegurarOperador = () => {
    const lista = operadoresDe();
    if (lista.some(o => o.id === s.operador)) return;
    s.operador = lista[0].id;
    for (const c of ['internacionalUSD', 'arriboUSD']){ s.costos[c] = null; s.tocados.delete(c); }
  };

  /* ---------- 3. Etapas ---------- */
  function pintarEtapas(){
    asegurarOperador();
    const op = OPERADOR_BY_ID[s.operador];
    const tarifa = (texto, url, extra = null) => el('div', { class:'dz-tarifa' }, texto, extra, url ? ' ' : null, enlace('Ver tarifa', url));

    /* Escribir un valor lo fija; borrarlo vuelve al valor general publicado. */
    const cargar = campo => v => { s.costos[campo] = v; v == null ? s.tocados.delete(campo) : s.tocados.add(campo); recalcular(); };
    const general = 'usa el valor general';

    const cuerpo = {
      origen:() => [campoNum('Envío que cobra la tienda', s.costos.origenUSD, cargar('origenUSD'),
        { vacio:general, ayuda:'Si dice "envío gratis", poné 0. Vacío usa la tarifa de USPS dentro de EE.UU. según el peso.' })],

      internacional:() => [
        tarifa(op.condiciones, op.url, op.plazo ? el('span', {}, ` Plazo informado: ${op.plazo}.`) : null),
        op.calcular ? null : campoNum('Lo que te cotizaron por el viaje', s.costos.internacionalUSD, cargar('internacionalUSD'),
          { vacio:general, ayuda:'Vacío usa, en pequeño envío, la tarifa publicada de Logistika; con despachante, carga aérea a US$ 8 por kilo.' }),
        campoNum('Seguro de la carga', s.costos.seguroUSD, cargar('seguroUSD'), { vacio:general, ayuda:'Vacío usa el 0,5% del valor FOB.' })],

      arribo:() => [
        OPERADOR_BY_ID[s.operador].id === 'logistika-aereo'
          ? tarifa('Pequeño envío: incluido en la tarifa de Logistika como 10% de seguro y trámites aduaneros (mínimo US$ 30).', OPERADOR_BY_ID['logistika-aereo'].url)
          : campoNum('Pequeño envío: gestión del courier o tasa del correo', s.costos.arriboUSD, cargar('arriboUSD'),
            { vacio:general, ayuda:'Vacío usa lo que publica Logistika: 10% del valor, mínimo US$ 30.' }),
        tarifa(OPERADOR_BY_ID.correo.condiciones, OPERADOR_BY_ID.correo.url),
        campoNum('Importación general: almacenaje en depósito fiscal', s.costos.depositoUSD, cargar('depositoUSD'),
          { vacio:general, ayuda:'Vacío usa el precio fijo publicado por la terminal de cargas de Ezeiza (TCA) según el peso, con 7 días incluidos.' })],

      aduana:() => [
        el('p', {}, 'Los tributos se calculan solos abajo, con la posición del Arancel y las normas vigentes.'),
        campoNum('Importación general: honorarios del despachante', s.costos.despachanteUSD, cargar('despachanteUSD'),
          { vacio:general, ayuda:DESPACHANTE_REFERENCIA.texto })],

      ultima:() => [campoNum(`Envío hasta tu casa (${destino()})`, s.costos.ultimaMillaARS, cargar('ultimaMillaARS'),
        { pref:'$', paso:'1', vacio:general, ayuda:'Vacío usa la tarifa publicada de la Encomienda Clásica de Correo Argentino (hasta 25 kg).' })]
    };

    const ciudad = CIUDAD_CHINA_BY_ID[s.ciudadChina];
    poner(secEtapas,
      cabecera(3, 'Elegí con quién viaja', 'Te mostramos cuánto cuesta el viaje con cada opción para el peso que cargaste. Cambiá y mirá cómo se mueve el total.'),
      s.origen === 'china' ? [
        chips('¿Desde qué ciudad de China sale?', s.ciudadChina, CIUDADES_CHINA.map(c => [c.id, c.nombre]),
          v => { s.ciudadChina = v; guardarCfg({ ciudadChina:v }); pintarEtapas(); recalcular(); }),
        el('p', { class:'c-legal', style:{ marginTop:'4px' } }, `${ciudad.nombre}: ${ciudad.quienes}; ${ciudad.salida}. Si no sabés, dejá Guangzhou: el seguimiento del pedido suele decir la ciudad. `,
          enlace('Fuente', ciudad.fuente.url))] : null,
      cajaOps,
      el('details', { class:'dz-mas' },
        el('summary', {}, 'Ver las 5 etapas del viaje y ajustar cada costo'),
        el('p', { class:'dz-sub', style:{ marginTop:'10px' } }, 'Cada etapa la hace alguien distinto y cobra lo suyo. Donde la empresa publica su tarifa, la usamos y te dejamos el link; donde no, usamos un valor general publicado. Si te cotizaron otro, escribilo.'),
        el('ol', { class:'dz-etapas' }, ...ETAPAS.map(et => el('li', { class:'dz-etapa' },
          el('span', { class:'dz-n', 'aria-hidden':'true' }, String(et.n)),
          el('div', { style:{ minWidth:'0' } },
            el('h3', {}, et.titulo),
            el('p', {}, et.quePasa, ' ', el('b', {}, 'Lo hace: '), et.quien, '.'),
            el('details', {}, el('summary', {}, 'Trámites de esta etapa'), el('ul', {}, ...et.tramites.map(t => el('li', {}, t)))),
            el('div', { class:'dz-campos' }, ...cuerpo[et.id]())))))));
  }

  /* Tarjetas de operador con el precio del viaje para el peso cargado. */
  function pintarOps(r){
    const logistika = OPERADOR_BY_ID['logistika-aereo'];
    const estimar = o => {
      if (o.id === 'propio') return { usd:s.tocados.has('internacionalUSD') ? s.costos.internacionalUSD : null, tipo:'Tu cotización', clase:'' };
      if (o.id === 'tienda-china') return { usd:0, tipo:'Incluido en el precio', clase:'ok' };
      if (o.calcular) return { usd:o.calcular({ pesoKg:r.peso, valorUSD:r.fob }).internacionalUSD,
        tipo:o.publica === true ? 'Tarifa publicada' : 'Precio "desde"', clase:o.publica === true ? 'ok' : 'warn' };
      const ref = s.origen === 'china' ? referencia('fleteChinaCourier', { pesoKg:r.peso })?.valor : logistika.calcular({ pesoKg:r.peso, valorUSD:r.fob }).internacionalUSD;
      return { usd:ref ?? null, tipo:'Sin tarifa pública: estimado', clase:'warn' };
    };
    const lista = operadoresDe().map(o => ({ o, e:estimar(o) }));
    const conPrecio = lista.filter(x => x.e.usd > 0 && x.e.clase === 'ok');
    const masBarato = conPrecio.length ? conPrecio.reduce((a, b) => b.e.usd < a.e.usd ? b : a).o.id : null;
    poner(cajaOps, ...lista.map(({ o, e }) => el('button', {
      class:'dz-op' + (o.id === s.operador ? ' on' : ''), role:'radio', 'aria-checked':String(o.id === s.operador),
      onclick:() => {
        s.operador = o.id;
        for (const c of ['internacionalUSD', 'arriboUSD']){ s.costos[c] = null; s.tocados.delete(c); }
        pintarEtapas(); recalcular();
      } },
      el('span', { class:'dz-radio', 'aria-hidden':'true' }),
      el('span', { class:'dz-op-txt' },
        el('b', {}, o.empresa, o.id === masBarato ? el('em', { class:'dz-badge win' }, 'Más barato') : null,
          s.origen === 'china' && o.ciudad === s.ciudadChina ? el('em', { class:'dz-badge' }, 'En tu ciudad') : null),
        el('small', {}, o.servicio),
        el('span', { class:'dz-sello ' + e.clase }, e.tipo), o.plazo ? el('small', { class:'dz-op-plazo' }, ic('envio'), ' ', o.plazo) : null),
      el('span', { class:'dz-op-precio' },
        e.usd == null ? el('small', {}, 'cargá tu cotización') : e.usd === 0 ? el('b', {}, 'Incluido')
          : [el('b', {}, plata(Math.round(e.usd * FX.oficial))), el('small', {}, usd(e.usd))]))));
  }

  /* Campos obligatorios vacíos: se marcan en rojo para invitar a completarlos. */
  function marcarRequeridos(){
    for (const c of raiz.querySelectorAll('[data-requerido]')){
      const i = c.querySelector('input');
      c.classList.toggle('dz-falta', !i || !i.value || +i.value === 0 && i.type === 'number');
    }
  }

  /* ---------- Cálculo ---------- */
  function calcular(){
    asegurarOperador();
    const fob = aUSD(s.precio || 0, s.moneda) * s.unidades;
    const peso = s.pesoKg * s.unidades;
    const op = OPERADOR_BY_ID[s.operador];
    const logistika = OPERADOR_BY_ID['logistika-aereo'];
    const fuenteOperador = o => o.url ? { titulo:`${o.empresa} — ${o.servicio}`, url:o.url } : null;

    /* Arma los costos de una vía: lo que escribió el cliente, la tarifa del
       operador elegido o, si no hay, el valor general publicado. */
    const costosPara = via => {
      const costos = { ...s.costos }, sellos = {}, detalles = {}, fuentes = {};
      for (const c of s.tocados) sellos[c] = 'tuyo';
      /* El primero que completa un campo manda: el operador que incluye el
         seguro no puede quedar pisado por la referencia general del 0,5%. */
      const poner = (campo, r) => {
        if (s.tocados.has(campo) || !r || sellos[campo]) return;
        Object.assign(costos, { [campo]:r.valor });
        sellos[campo] = r.sello; detalles[campo] = r.detalle; if (r.fuente) fuentes[campo] = r.fuente;
      };
      const deOperador = (o, sello) => {
        const c = o.calcular({ pesoKg:peso, valorUSD:fob });
        poner('internacionalUSD', { valor:c.internacionalUSD, sello, fuente:fuenteOperador(o),
          detalle:`${o.empresa}: ${c.detalleInternacional}${c.desde ? ' (precio "desde")' : ''}` });
        if (c.arriboUSD != null) poner('arriboUSD', { valor:c.arriboUSD, sello, fuente:fuenteOperador(o), detalle:`${o.empresa}: ${c.detalleArribo}` });
        return c;
      };

      const china = s.origen === 'china';
      const ciudad = CIUDAD_CHINA_BY_ID[s.ciudadChina];
      const desdeCiudad = r => r && china ? { ...r, detalle:`desde ${ciudad.nombre}: ${r.detalle}` } : r;
      /* USPS es envío dentro de EE.UU.; desde China no hay tarifa publicada del tramo a la salida. */
      if (!china) poner('origenUSD', referencia('origenUSD', { pesoKg:peso }));
      /* Con despachante la mercadería viaja como carga, no por courier puerta a
         puerta: la tarifa del courier (US$ 66 por kilo) daba fletes absurdos. */
      if (via === 'general' && op.carga && op.calcular){
        /* Un operador de carga con tarifa publicada (Del Mundo por barco) sirve también con despachante. */
        const c = deOperador(op, op.publica === true ? 'publicada' : 'referencia');
        if (c.incluyeSeguro) poner('seguroUSD', { valor:0, sello:'publicada', detalle:`incluido en la tarifa de ${op.empresa}` });
      } else if (via === 'general'){
        poner('internacionalUSD', desdeCiudad(referencia(china ? 'fleteChinaCarga' : 'fleteAereo', { pesoKg:peso })));
      } else if (china){
        /* Operador de China con tarifa (o la tienda misma); si no publica, courier exprés de referencia. */
        const c = op.calcular ? deOperador(op, op.publica === true ? 'publicada' : 'referencia') : null;
        if (!c) poner('internacionalUSD', desdeCiudad(referencia('fleteChinaCourier', { pesoKg:peso })));
        poner('arriboUSD', { valor:Math.max(30, fob * 0.10), sello:'referencia', fuente:fuenteOperador(logistika),
          detalle:'gestión y seguro como publica Logistika: 10% del valor, mínimo US$ 30' });
        poner('seguroUSD', { valor:0, sello:'referencia', detalle:'incluido en la gestión de referencia' });
      } else if (op.calcular){
        const c = deOperador(op, op.publica === true ? 'publicada' : 'referencia');
        if (c.arriboUSD != null) poner('seguroUSD', { valor:0, sello:'publicada', detalle:'incluido en la gestión del operador' });
      } else {
        /* Operador sin tarifa pública: se estima con la de un courier que sí la publica. */
        const c = deOperador(logistika, 'referencia');
        if (c.arriboUSD != null) poner('seguroUSD', { valor:0, sello:'referencia', detalle:'incluido en la gestión de referencia' });
      }
      poner('seguroUSD', referencia('seguroUSD', { fobUSD:fob }));
      const cif = fob + (costos.origenUSD || 0) + (costos.internacionalUSD || 0) + (costos.seguroUSD || 0);
      poner('depositoUSD', referencia('depositoUSD', { pesoKg:peso }));
      poner('despachanteUSD', referencia('despachanteUSD', { cifUSD:cif }));
      poner('ultimaMillaARS', referencia('ultimaMillaARS', { pesoKg:peso, provincia:destino() }));
      return { costos, sellos, detalles, fuentes };
    };

    const base = { fobUSD:fob, unidades:s.unidades, pesoKg:peso, destino:s.destino, perfilId, inscriptoGanancias:s.inscriptoGanancias,
      enviosAnio:s.enviosAnio, die:s.posicion?.die ?? null, ivaReducido:s.ivaReducido, pago:s.pago,
      tc:{ tarjeta:FX.tarjeta, oficial:FX.oficial }, provincia:destino(), fuenteOperador:fuenteOperador(op) };
    const cp = costosPara('pequeno'), cg = costosPara('general');
    const fee = (tipo, c) => calcularFee({ valorUSD:fob, fleteUSD:c.costos.internacionalUSD || 0, tipo }).feeUSD;
    const pequeno = desglosar({ ...base, ...cp, via:'pequeno', feeUSD:fee('internacional', cp) });
    const general = desglosar({ ...base, ...cg, via:'general', feeUSD:fee('mayorista', cg) });
    const local = s.localElegido != null ? s.locales?.[s.localElegido] || null : null;
    const consejo = recomendar({ pequeno, general, local, destino:s.destino, perfilId, unidades:s.unidades, fobARS:fob * FX.oficial, pesoKg:peso });
    return { fob, peso, op, pequeno, general, consejo };
  }

  /* Lleva el producto a Compra grupal ya calculado: cuánto sale traerlo solo y
     cuánto por unidad comprando entre varios (el mismo cálculo, con más unidades:
     el flete, el depósito y el despachante se reparten). */
  const META_GRUPAL = 10;
  function irAGrupal(r){
    const d = s.tab === 'pequeno' && r.pequeno.disponible ? r.pequeno : r.general.disponible ? r.general : r.pequeno;
    const unidades = s.unidades;
    let g;
    s.unidades = unidades * META_GRUPAL;
    try{ g = calcular(); }finally{ s.unidades = unidades; }
    const dg = g.general.disponible ? g.general : g.pequeno;
    const L = (x, id) => x.disponible ? (x.lineas.find(l => l.id === id)?.ars || 0) : 0;
    guardarPendiente({
      titulo:s.titulo, imagen:producto?.imagen || null, url:producto?.url || sugerido?.url || null,
      tienda:producto?.tienda?.nombre || sugerido?.tienda?.nombre || '', unidades, pesoKg:s.pesoKg, origen:s.origen, meta:META_GRUPAL,
      soloARS:Math.round((d.totalARS || 0) / unidades),
      grupoARS:Math.round((dg.totalARS || 0) / (unidades * META_GRUPAL)),
      motivo:L(d, 'fob') ? `Traerlo solo, el avión o el barco cuesta ${Math.round(L(d, 'internacional') / L(d, 'fob') * 100)}% del valor del producto.` : ''
    });
    ir('#/grupal');
  }

  function recalcular(){
    const r = calcular();
    s.resultado = r;
    if (!s.tabElegida) s.tab = r.pequeno.disponible ? 'pequeno' : 'general';
    pintarOps(r); pintarDesglose(r); pintarConsejo(r); pintarResumen(r); pintarProgreso(r);
    alCambiar?.(r);
  }

  /* ---------- 4. Desglose ---------- */
  function lineaEl(l){
    const sello = SELLO[l.sello] || SELLO.tuyo;
    return el('details', { class:'dz-linea' + (l.informativa ? ' info' : '') },
      el('summary', {},
        el('span', { class:'dz-linea-k' }, l.k, el('span', { class:'dz-sello ' + sello.clase }, sello.texto)),
        el('span', { class:'dz-usd' }, l.informativa ? '' : usd(l.usd)),
        el('span', { class:'dz-ars' }, l.informativa ? '' : l.ars == null ? 'falta' : plata(l.ars)),
        l.formula ? el('span', { class:'dz-linea-f' }, l.formula) : null),
      el('div', { class:'dz-linea-cuerpo' },
        el('p', {}, l.explica),
        l.informativa ? null : el('p', {}, el('b', {}, '¿Lo recuperás? '), l.recupero.texto),
        l.fuente ? enlace('Fuente: ' + l.fuente.titulo, l.fuente.url) : null));
  }

  const total = (titulo, valor, nota, clase = '') => el('div', { class:'dz-total ' + clase }, el('small', {}, titulo), el('b', {}, valor), nota ? el('span', {}, nota) : null);

  function tabla(d){
    if (!d.disponible) return el('div', { class:'dz-no' },
      el('h3', {}, 'No se puede traer como pequeño envío'),
      el('ul', {}, ...d.motivos.map(m => el('li', {}, m))),
      el('p', {}, 'Por eso va exclusivamente por importación general con despachante.'),
      el('div', { class:'c-links' }, ...d.fuentes.map(f => enlace(f.titulo, f.url))),
      el('button', { class:'btn', style:{ marginTop:'10px' }, onclick:() => { s.tab = 'general'; s.tabElegida = true; recalcular(); } }, 'Ver el desglose con despachante'));

    return el('div', {},
      ...d.porEtapa.filter(e => e.lineas.length).flatMap(e => [
        el('div', { class:'dz-etapa-cab' }, el('span', {}, `${e.n} · ${e.titulo}`), el('span', {}, plata(e.ars))),
        ...e.lineas.map(lineaEl)]),
      ...d.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : ''), style:{ marginTop:'10px' } }, a.m)),
      d.requisitos.length ? el('div', { class:'notice', style:{ marginTop:'10px' } }, el('b', {}, 'Qué necesitás: '), d.requisitos.join(' ')) : null,
      el('div', { class:'dz-totales' },
        total(d.completo ? 'Pagás en total' : 'Pagás, sin lo que falta', plata(d.totalARS),
          d.completo ? 'todo incluido' : `falta cotizar: ${d.faltan.join(', ').toLowerCase()}`, 'grande'),
        total('De eso, tributos de Aduana', plata(d.tributosARS), usd(d.tributosUSD)),
        total('Recuperás', plata(d.recuperaARS), `como ${P.label}`),
        total('Costo real para vos', plata(d.costoRealARS), 'lo que pagás menos lo que recuperás')),
      el('p', { class:'dz-cambio' },
        `Todo va al dólar oficial ($ ${Math.round(FX.oficial).toLocaleString('es-AR')}). `,
        s.pago === 'tarjeta' ? `Lo que pagás afuera con tarjeta en pesos lleva además el 30% de percepción, en su propia línea: juntos dan el dólar tarjeta ($ ${Math.round(FX.tarjeta).toLocaleString('es-AR')}). ` : '',
        'Los valores con el sello "Valor de referencia" son generales, tomados de lo publicado: tu cotización puede ser distinta. ',
        `Cotización ${FX.origen === 'vivo' ? 'en vivo' : 'de referencia'}. Normas consultadas el ${fechaAR(CONSULTADO)}. Tocá cada línea para ver qué es y de dónde sale.`));
  }

  function pintarDesglose(r){
    const via = (id, nombre, desc, d) => el('button', {
      class:'dz-via' + (s.tab === id ? ' on' : '') + (d.disponible ? '' : ' no'), role:'radio', 'aria-checked':String(s.tab === id),
      onclick:() => { s.tab = id; s.tabElegida = true; recalcular(); } },
      el('span', { class:'dz-radio', 'aria-hidden':'true' }),
      el('span', { class:'dz-via-txt' }, el('b', {}, nombre, r.consejo.elegida === id ? el('em', { class:'dz-badge win' }, 'Recomendado') : null), el('small', {}, desc)),
      el('span', { class:'dz-via-precio' }, d.disponible ? plata(d.totalARS) : 'No disponible', d.disponible && !d.completo ? el('small', {}, 'faltan datos') : null));
    const listo = s.precio > 0 && s.posicion && (s.tab === 'pequeno' ? r.pequeno : r.general).completo;
    poner(secDesglose,
      cabecera(4, 'Tu cotización, línea por línea', 'Elegí cómo traerlo. Tocá cada línea para ver qué es, de dónde sale el número y si lo recuperás.', !!listo),
      !s.precio ? el('div', { class:'dz-vacio' }, ic('etiqueta'), el('b', {}, 'Cargá el precio del producto'), el('span', {}, 'y te mostramos el desglose completo al instante.'),
        el('button', { class:'btn btn-sm', onclick:() => irAPaso(2) }, 'Ir a cargar el precio')) : [
        el('div', { class:'dz-vias', role:'radiogroup', 'aria-label':'Forma de traerlo' },
          via('pequeno', 'Pequeño envío', 'Courier o correo · hasta US$ 3.000 y 50 kg, sin fin comercial', r.pequeno),
          via('general', 'Con despachante', 'Importación formal · montos grandes o para vender', r.general)),
        tabla(s.tab === 'pequeno' ? r.pequeno : r.general)]);
  }

  /* ---------- Resumen del pedido (fijo al costado) ---------- */
  function pintarResumen(r){
    const elegida = s.tab === 'pequeno' ? r.pequeno : r.general;
    const d = elegida.disponible ? elegida : (r.pequeno.disponible ? r.pequeno : r.general);
    const L = id => d.disponible ? (d.lineas.find(l => l.id === id)?.ars || 0) : 0;
    const hayImportacion = r.pequeno.disponible || r.general.disponible;
    const datos = [
      ['Precio del producto', s.precio > 0, 2],
      ['Peso', s.pesoKg > 0, 2],
      ['Qué es para la Aduana (NCM)', !!s.posicion, 2],
      ['Con quién viaja', !!s.operador, 3]
    ];
    const faltan = datos.filter(x => !x[1]);
    const puedePedir = hayImportacion && s.precio > 0 && !!s.posicion;
    const hecho = datos.length - faltan.length;
    const linea = (k, v, nota) => v ? el('div', { class:'dz-r-linea' }, el('span', {}, k, nota ? el('small', {}, nota) : null), el('b', {}, plata(v))) : null;
    const pedir = () => puedePedir ? alConfirmar(resumen(r)) : irAPaso(faltan[0]?.[2] || 4);
    const imagen = producto?.imagen || null;
    const tienda = producto?.tienda?.nombre || sugerido?.tienda?.nombre || '';

    poner(secResumen,
      el('div', { class:'dz-r-card' },
        el('h2', {}, 'Resumen de tu pedido'),
        el('div', { class:'dz-r-prod' },
          imagen ? el('img', { src:imagen, alt:'', loading:'lazy' }) : el('span', { class:'dz-r-sinfoto' }, ic('caja')),
          el('span', {}, el('b', {}, s.titulo || 'Tu producto'), el('small', {}, [tienda, `${s.unidades} u.`, s.pesoKg ? `${(s.pesoKg * s.unidades).toLocaleString('es-AR')} kg` : null].filter(Boolean).join(' · ')))),
        s.precio > 0 && d.disponible ? [
          el('div', { class:'dz-r-lineas' },
            linea('Producto', L('fob')),
            linea('Viaje y llegada', L('origen') + L('internacional') + L('seguro') + L('arribo'), r.op.empresa),
            linea('Impuestos de Aduana', d.tributosARS),
            linea('Percepción 30% tarjeta', L('percepcionTarjeta'), 'recuperable'),
            linea('Despachante', L('despachante')),
            linea('Envío a tu casa', L('ultima')),
            linea('Gestión de NiJu', L('niju'))),
          el('div', { class:'dz-r-total' }, el('span', {}, d.completo ? 'Total puesto en tu casa' : 'Total estimado'), el('b', {}, plata(d.totalARS))),
          d.recuperaARS ? el('p', { class:'dz-r-recupera' }, ic('check'), ` Recuperás ${plata(d.recuperaARS)} · costo real ${plata(d.costoRealARS)}`) : null,
          d.faltan.length ? el('p', { class:'dz-r-nota' }, `Sin contar: ${d.faltan.join(', ').toLowerCase()}.`) : null]
        : el('div', { class:'dz-r-total vacio' }, el('span', {}, 'Total puesto en tu casa'), el('b', {}, '$ —'), el('small', {}, 'Cargá el precio para verlo')),

        el('div', { class:'dz-r-check' },
          el('div', { class:'dz-r-check-cab' }, el('b', {}, faltan.length ? `Te faltan ${faltan.length} dato${faltan.length > 1 ? 's' : ''}` : '¡Listo para pedir!'), el('span', {}, `${hecho}/${datos.length}`)),
          el('div', { class:'dz-p-barra' }, el('i', { style:{ width:`${hecho / datos.length * 100}%` } })),
          el('ul', {}, ...datos.map(([t, ok, n]) => el('li', { class:ok ? 'ok' : '' },
            ok ? el('span', {}, ic('check'), ' ', t) : el('button', { class:'p-link', onclick:() => irAPaso(n) }, '○ ', t, ' →'))))),

        r.consejo.caroSolo ? el('button', { class:'dz-r-grupal', onclick:() => irAGrupal(r) },
          el('b', {}, 'Traerlo solo no conviene'), el('span', {}, 'Sumate a una compra grupal y dividí el flete →')) : null,

        alConfirmar ? el('button', { class:'btn btn-lg btn-win btn-block dz-r-cta', disabled:hayImportacion ? null : true, onclick:pedir },
          ic('envio'), puedePedir ? 'Pedir que NiJu lo traiga' : 'Completar los datos') : null,
        el('button', { class:'btn btn-block', disabled:hayImportacion && s.precio > 0 ? null : true, onclick:() => {
          store.push('importaciones', resumen(r)); toast('Guardado en tu carpeta, con todo el desglose', 'win');
        } }, ic('caja'), 'Guardar cotización'),
        el('ul', { class:'dz-r-confianza' },
          el('li', {}, ic('etiqueta'), 'Precio final antes de pagar'),
          el('li', {}, ic('check'), 'Sin cargo hasta que confirmes'),
          el('li', {}, ic('mundo'), 'La Aduana la hacemos nosotros'))));

    poner(barra,
      el('span', {}, el('small', {}, s.precio > 0 && d.disponible ? (d.completo ? 'Total en tu casa' : 'Total estimado') : `Te faltan ${faltan.length} datos`),
        el('b', {}, s.precio > 0 && d.disponible ? plata(d.totalARS) : '$ —')),
      alConfirmar ? el('button', { class:'btn btn-win', disabled:hayImportacion ? null : true, onclick:pedir }, puedePedir ? 'Pedir' : 'Completar')
        : el('button', { class:'btn', onclick:() => secResumen.scrollIntoView({ behavior:'smooth' }) }, 'Ver resumen'));
  }

  /* ---------- Barra de progreso ---------- */
  function pintarProgreso(r){
    const d = s.tab === 'pequeno' ? r.pequeno : r.general;
    const pasos = [
      [1, 'Cómo comprás', true],
      [2, 'Tu producto', s.precio > 0 && s.pesoKg > 0 && !!s.posicion],
      [3, 'El envío', !!s.operador && s.precio > 0],
      [4, 'Tu cotización', s.precio > 0 && !!s.posicion && d.disponible && d.completo]
    ];
    const actual = pasos.find(p => !p[2])?.[0] || 4;
    poner(progreso, el('ol', {}, ...pasos.map(([n, t, ok]) => el('li', { class:(ok ? 'hecho' : '') + (n === actual && !ok ? ' actual' : '') },
      el('button', { onclick:() => irAPaso(n) }, el('span', { class:'dz-p-n' }, ok ? ic('check') : String(n)), el('span', { class:'dz-p-t' }, t))))));
    marcarRequeridos();
  }

  /* ---------- 5. Comparar con Argentina ---------- */
  async function buscarLocal(){
    if (!s.titulo.trim() || s.buscandoLocal) return;
    s.buscandoLocal = true; s.localElegido = null; pintarComparar();
    try{
      const res = await buscar(s.titulo, { limite:12 });
      s.locales = (res.grupos || [])
        .filter(g => STORE_BY_ID[g.mejor.tiendaId]?.tipo === 'nacional')
        .slice(0, 4)
        .map(g => ({ tienda:STORE_BY_ID[g.mejor.tiendaId]?.nombre || g.mejor.tiendaId, titulo:g.titulo, ars:g.mejor.costo?.finalARS || g.mejor.precio, url:g.mejor.url }));
    }catch{ s.locales = []; }
    s.buscandoLocal = false; pintarComparar(); recalcular();
  }

  /* Mercado Libre no deja leer precios sin una app registrada (su API da 403 y el
     listado pide verificar la cuenta): hasta cargar MELI_APP_ID y MELI_SECRET en
     el worker, se abre su búsqueda con el nombre del producto. */
  const botonMeli = () => s.titulo.trim() ? el('a', { class:'btn', target:'_blank', rel:'noopener',
    href:`https://listado.mercadolibre.com.ar/${encodeURIComponent(s.titulo.trim().toLowerCase().replace(/\s+/g, '-'))}` },
    ic('buscar'), 'Ver este producto en Mercado Libre') : null;

  function pintarComparar(){
    const cuerpo = s.buscandoLocal ? [el('div', { class:'notice' }, 'Buscando el mismo producto en tiendas argentinas…')]
      : s.locales == null ? [el('button', { class:'btn', onclick:buscarLocal }, ic('buscar'), 'Buscar en tiendas argentinas')]
      : !s.locales.length ? [el('div', { class:'notice' }, 'No lo encontramos en las tiendas argentinas que la app lee en vivo. Mercado Libre todavía no nos deja leer sus precios desde la app: te lo abrimos con tu búsqueda para que compares antes de decidir.'),
          el('div', { class:'c-acciones', style:{ marginTop:'10px' } }, botonMeli())]
      : [el('div', { class:'dz-lista' }, ...s.locales.map((l, i) => el('div', { class:'dz-local' },
          el('span', {}, el('b', {}, l.tienda), el('br'), el('small', {}, l.titulo)),
          el('span', { style:{ textAlign:'right' } }, el('b', {}, plata(l.ars)), el('br'), enlace('Ver', l.url)),
          el('label', {}, el('input', { type:'radio', name:'dz-local-' + uid(), checked:s.localElegido === i || null,
            onchange:() => { s.localElegido = i; recalcular(); } }), 'Es exactamente el mismo producto: compararlo')))),
        el('p', { class:'c-legal' }, 'Marcá solo si es el mismo modelo: comparar con uno parecido te daría un ahorro que no existe.')];
    poner(secComparar, 
      el('h2', {}, ic('tienda'), 'El mismo producto en Argentina'),
      el('p', { class:'dz-sub' }, 'Precio de hoy en tiendas del país, leído en vivo.'), ...cuerpo);
  }

  /* ---------- 6. Qué te conviene ---------- */
  function resumen(r){
    const via = r.pequeno.disponible ? (r.consejo.elegida === 'general' ? 'general' : 'pequeno') : 'general';
    const d = via === 'pequeno' ? r.pequeno : r.general;
    return {
      id:'imp-' + uid(), creado:Date.now(), titulo:s.titulo, fobUSD:r.fob, unidades:s.unidades, pesoKg:r.peso,
      destino:s.destino, condicion:P.label, operador:r.op.empresa, arancelAl:arancelListo()?.fecha || null,
      posicion: s.posicion ? { codigo:s.posicion.codigo, descripcion:descripcionCompleta(s.posicion), die:s.posicion.die } : null,
      via, totalARS:d.totalARS || 0, completo:!!d.completo,
      pequeno:liviano(r.pequeno), general:liviano(r.general),
      consejo:{ titulo:r.consejo.titulo, motivos:r.consejo.motivos, cuidado:r.consejo.cuidado }
    };
  }

  function pintarConsejo(r){
    const c = r.consejo;
    const hayImportacion = r.pequeno.disponible || r.general.disponible;
    poner(secConsejo, 
      el('h2', {}, ic('estrella'), 'Qué te conviene'),
      !s.precio ? el('p', { class:'dz-sub' }, 'Cuando cargues el precio te decimos qué conviene.') : [
        el('h3', {}, c.titulo),
        c.motivos.length ? el('ul', {}, ...c.motivos.map(m => el('li', {}, m))) : null,
        c.pasos?.length ? [
          el('p', { class:'dz-sub', style:{ margin:'10px 0 8px' } }, el('b', {}, `Qué hacer, paso a paso, como ${P.label}:`)),
          el('ol', { class:'v-vacio-pasos', style:{ marginBottom:'12px' } }, ...c.pasos.map((p, i) => el('li', {},
            el('span', { class:'v-vacio-n', 'aria-hidden':'true' }, String(i + 1)),
            el('div', {}, el('b', {}, p.t), el('p', {}, p.d),
              p.accion === 'grupal' ? el('button', { class:'btn btn-sm btn-win', onclick:() => irAGrupal(r) }, 'Armar una compra grupal con este producto', ic('der'))
              : p.accion === 'grandes' ? el('button', { class:'btn btn-sm', onclick:() => ir('#/grandes') }, 'Ver cómo son las compras grandes', ic('der'))
              : p.accion === 'perfil' ? el('button', { class:'btn btn-sm', onclick:() => ir('#/impuestos?tab=perfil') }, 'Cambiar mi condición', ic('der')) : null))))] : null,
        !s.posicion ? el('div', { class:'notice', style:{ marginBottom:'8px' } }, 'Falta elegir la posición NCM: sin ella no sabemos el derecho de importación.') : null,
        ...c.cuidado.map(m => el('div', { class:'notice', style:{ marginBottom:'8px' } }, m)),
        r.pequeno.disponible && r.op.plazo && !(s.origen === 'china' && r.op.miami) ? el('p', { class:'dz-sub' }, `Plazo del viaje informado por ${r.op.empresa}: ${r.op.plazo}, más el trámite de Aduana.`) : null,
        el('div', { class:'c-acciones' },
          hayImportacion ? null : el('span', { class:'dz-sub' }, 'Así como está, no hay una vía de importación disponible.'),
          el('button', { class:'btn btn-ghost', onclick:() => ir('#/impuestos?tab=carpeta') }, 'Ver Mi carpeta')),
        el('p', { class:'c-legal' }, 'Te orientamos con normas oficiales y tarifas publicadas. No reemplaza a un despachante ni a un contador.')]);
  }

  /* ---------- 7. Preguntas ---------- */
  function pintarPreguntas(enfocar = false){
    const input = el('input', { class:'inp', placeholder:'Preguntá lo que no entiendas de este cálculo…', 'aria-label':'Tu pregunta' });
    const enviar = async (texto = input.value) => {
      const t = texto.trim();
      if (!t || s.pensando) return;
      s.chat.push({ rol:'cliente', texto:t });
      s.pensando = true; pintarPreguntas();
      const r = s.resultado;
      const vista = s.tab === 'pequeno' ? r.pequeno : r.general;
      const contexto = {
        producto:s.titulo, condicionAnteARCA:P.label, paraQueEs:s.destino === 'uso' ? 'uso personal' : 'para vender',
        inscriptoEnGanancias:s.inscriptoGanancias, pequenosEnviosUsadosEsteAnio:s.enviosAnio,
        precioFOBUSD:r.fob, unidades:s.unidades, pesoTotalKg:r.peso,
        posicionNCM: s.posicion ? { codigo:s.posicion.codigo, descripcion:descripcionCompleta(s.posicion), derechoImportacionPct:s.posicion.die } : 'todavía sin elegir',
        operadorDelViaje:`${r.op.empresa} — ${r.op.servicio}`, plazoDelViaje:r.op.plazo || null,
        vistaActual:s.tab === 'pequeno' ? 'pequeño envío' : 'importación con despachante',
        pequenoEnvio:liviano(r.pequeno), importacionGeneral:liviano(r.general),
        recomendacion:r.consejo, tipoDeCambio:{ tarjeta:FX.tarjeta, oficial:FX.oficial }, lineas:vista.disponible ? vista.lineas : []
      };
      const resp = await preguntarAsesor({ pregunta:t, contexto, historial:s.chat.slice(0, -1) });
      s.chat.push({ rol:'niju', texto:resp.texto, origen:resp.origen });
      s.pensando = false; pintarPreguntas(true);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

    const chat = el('div', { class:'dz-chat', 'aria-live':'polite' },
      ...s.chat.map(m => el('div', { class:'dz-burbuja ' + (m.rol === 'cliente' ? 'yo' : 'niju') }, m.texto)),
      s.pensando ? el('div', { class:'dz-burbuja niju' }, 'Pensando la respuesta…') : null);

    poner(secPreguntas, 
      el('h2', {}, ic('chat'), 'Preguntale a NiJu'),
      el('p', { class:'dz-sub' }, 'Responde con los números de este cálculo y las normas vigentes. Si algo no lo sabe, te lo dice.'),
      s.chat.length ? chat : null,
      el('div', { class:'k2-chips', style:{ marginBottom:'8px' } }, ...PREGUNTAS_RAPIDAS.map(q => el('button', { class:'v-chip', onclick:() => enviar(q) }, q))),
      el('div', { class:'dz-buscar' }, input, el('button', { class:'btn btn-win', disabled:s.pensando ? true : null, onclick:() => enviar() }, 'Preguntar')));
    chat.scrollTop = chat.scrollHeight;
    if (enfocar) input.focus({ preventScroll:true });
  }

  /* ---------- Armado ---------- */
  const raiz = el('div', { class:'dz' },
    progreso,
    el('div', { class:'dz-layout' },
      el('div', { class:'dz-main' }, secSituacion, secProducto, secEtapas, secDesglose, secConsejo, secComparar, secPreguntas),
      secResumen),
    barra);
  pintarSituacion(); pintarProducto(); pintarEtapas(); recalcular(); pintarComparar(); pintarPreguntas();
  iniciarArancel();
  if (s.titulo) buscarLocal();

  /* "Traelo por mí" cambia el precio cuando el cliente elige otro de la página. */
  raiz.actualizarPrecio = (precio, moneda) => {
    if (precio === s.precio && moneda === s.moneda) return;
    s.precio = precio; s.moneda = moneda || s.moneda; recalcular();
  };
  return raiz;
}

/** Tarjeta de una cotización guardada, para Mi carpeta. */
export function tarjetaCotizacion(x){
  const d = x.via === 'pequeno' ? x.pequeno : x.general;
  return el('details', { class:'c-op' },
    el('summary', {},
      el('span', { class:'c-op-fecha' }, new Date(x.creado).toLocaleDateString('es-AR'), el('small', {}, x.pedidoId ? 'pedido a NiJu' : 'cotización')),
      el('span', { class:'c-op-tit' }, x.titulo || 'Producto', el('small', {}, `${x.via === 'pequeno' ? 'Pequeño envío' : 'Con despachante'} · ${x.posicion?.codigo || 'sin NCM'}`)),
      el('span', { class:'c-op-total' }, plata(x.totalARS), el('small', {}, x.completo ? 'todo incluido' : 'faltan costos'))),
    el('div', { class:'c-op-cuerpo' },
      x.posicion ? el('p', { class:'c-sub' }, el('b', {}, `NCM ${x.posicion.codigo} · ${x.posicion.die}% de derecho. `), x.posicion.descripcion,
        x.arancelAl ? ` (Arancel de ARCA al ${x.arancelAl})` : '') : null,
      d?.disponible ? d.lineas.filter(l => !l.informativa).map(l => el('div', { class:'c-op-linea' },
        el('span', {}, l.k, l.formula ? el('small', {}, l.formula) : null), el('b', {}, l.ars == null ? 'falta' : plata(l.ars)))) : null,
      x.consejo ? el('div', { class:'notice', style:{ marginTop:'10px' } }, el('b', {}, x.consejo.titulo + '. '), x.consejo.motivos.join(' ')) : null,
      el('p', { class:'c-legal' }, `Calculado como ${x.condicion}, ${x.destino === 'uso' ? 'para uso personal' : 'para vender'}. Los tributos y tarifas pueden cambiar: volvé a cotizar antes de comprar.`)));
}
