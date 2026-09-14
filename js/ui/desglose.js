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
import { ETAPAS, OPERADORES, OPERADOR_BY_ID, DESPACHANTE_REFERENCIA } from '../data/etapas-envio.js';
import { desglosar, recomendar } from '../engine/importacion.js';
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

export function panelImportacion({ ir, producto = null, alConfirmar = null, alCambiar = null }){
  const cfg = () => store.get('config') || {};
  const guardarCfg = cambios => store.set('config', { ...cfg(), ...cambios });
  const usuario = store.get('usuario');
  const perfilId = usuario?.perfilFiscal || 'consumidor_final';
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;

  const s = {
    titulo:producto?.titulo || '', precio:producto?.precio ?? null, moneda:producto?.moneda || 'USD',
    unidades:1, pesoKg:1, destino:cfg().destinoCompra || 'uso',
    inscriptoGanancias:cfg().inscriptoGanancias ?? (perfilId === 'responsable_inscripto'),
    enviosAnio:cfg().pequenosEnviosAnio ?? 0,
    operador:'logistika-aereo',
    costos:{ origenUSD:0, internacionalUSD:null, arriboUSD:null, seguroUSD:0, despachanteUSD:DESPACHANTE_REFERENCIA.usd, depositoUSD:null, ultimaMillaARS:null },
    despachanteTocado:false,
    arancel:'cargando', errorArancel:'', clasificando:false, clasif:null, opciones:[], busquedaNCM:'', posicion:null, ivaReducido:false,
    locales:null, buscandoLocal:false, localElegido:null,
    tab:'pequeno', tabElegida:false, chat:[], pensando:false, resultado:null
  };

  const secSituacion = el('section', { class:'dz-sec' });
  const secProducto  = el('section', { class:'dz-sec' });
  const cajaNCM      = el('div');
  const secEtapas    = el('section', { class:'dz-sec' });
  const secDesglose  = el('section', { class:'dz-sec', 'aria-live':'polite' });
  const secComparar  = el('section', { class:'dz-sec' });
  const secConsejo   = el('section', { class:'dz-sec dz-consejo' });
  const secPreguntas = el('section', { class:'dz-sec' });

  /* ---------- Ayudantes de formulario ---------- */
  const chips = (etiqueta, actual, opciones, alElegir) => el('div', { class:'k2-campo' }, el('span', {}, etiqueta),
    el('div', { class:'k2-chips', role:'group', 'aria-label':etiqueta }, ...opciones.map(([v, t]) =>
      el('button', { class:'v-chip' + (actual === v ? ' on' : ''), 'aria-pressed':String(actual === v), onclick:() => alElegir(v) }, t))));

  const campoNum = (etiqueta, valor, alCambiarValor, { pref = 'US$', ayuda = null, paso = '0.01', min = '0' } = {}) =>
    el('label', { class:'dz-campo' }, el('span', {}, etiqueta),
      el('div', { class:'k2-input' }, el('b', {}, pref),
        el('input', { type:'number', inputmode:'decimal', min, step:paso, value:valor ?? '', placeholder:valor == null ? 'sin cotizar' : null,
          oninput:e => alCambiarValor(numero(e.target.value)) })),
      ayuda ? el('small', {}, ayuda) : null);

  const enlace = (texto, url) => url ? el('a', { class:'c-fuente', href:url, target:'_blank', rel:'noopener' }, texto) : null;

  /* ---------- 1. Situación ---------- */
  function pintarSituacion(){
    poner(secSituacion, 
      el('h2', {}, ic('usuario'), 'Tu situación ante ARCA'),
      el('p', { class:'dz-sub' },
        usuario ? `Estás como ${P.label}. ` : 'No entraste con tu cuenta: calculamos como Consumidor Final. ',
        el('button', { class:'p-link', onclick:() => ir('#/impuestos?tab=perfil') }, '¿No es tu condición?')),
      el('div', { class:'dz-fila' },
        chips('¿Para qué es?', s.destino, [['uso', 'Para mí o mi familia'], ['reventa', 'Para vender']],
          v => { s.destino = v; guardarCfg({ destinoCompra:v }); pintarSituacion(); recalcular(); }),
        chips('¿Estás inscripto en Ganancias?', s.inscriptoGanancias, [[true, 'Sí'], [false, 'No']],
          v => { s.inscriptoGanancias = v; guardarCfg({ inscriptoGanancias:v }); pintarSituacion(); recalcular(); }),
        chips('Pequeños envíos que ya usaste este año', s.enviosAnio, [0, 1, 2, 3, 4, 5].map(n => [n, String(n)]),
          v => { s.enviosAnio = v; guardarCfg({ pequenosEnviosAnio:v }); pintarSituacion(); recalcular(); })),
      el('p', { class:'c-legal' }, 'Tus envíos usados los ves en ARCA con clave fiscal, en "Envíos Postales Internacionales".'));
  }

  /* ---------- 2. Producto y NCM ---------- */
  function pintarProducto(){
    poner(secProducto, 
      el('h2', {}, ic('documento'), 'Qué es para la Aduana'),
      el('p', { class:'dz-sub' }, 'Cada producto tiene un código en la Nomenclatura Común del Mercosur (NCM). De ese código sale el porcentaje de derecho de importación, que leemos del Arancel Integrado de ARCA.'),
      producto ? el('p', { style:{ margin:'0 0 10px' } }, el('b', {}, s.titulo)) : el('div', { class:'dz-fila' },
        el('label', { class:'k2-campo' }, el('span', {}, 'Qué es'),
          el('input', { class:'inp', value:s.titulo, placeholder:'Por ejemplo: auriculares inalámbricos Sony',
            oninput:e => { s.titulo = e.target.value; }, onchange:() => { clasificar(); buscarLocal(); } })),
        campoNum('Precio del producto (FOB, sin envío)', s.precio, v => { s.precio = v; recalcular(); }, { ayuda:'Lo que dice la tienda por todas las unidades de una, sin el envío.' })),
      el('div', { class:'dz-fila' },
        campoNum('Cantidad de unidades iguales', s.unidades, v => { s.unidades = Math.max(1, Math.round(v || 1)); recalcular(); }, { pref:'u.', paso:'1', min:'1' }),
        campoNum('Peso de cada unidad, con embalaje', s.pesoKg, v => { s.pesoKg = v || 0; recalcular(); }, { pref:'kg', paso:'0.1', ayuda:'Suele figurar en la ficha de la tienda. Define el flete y si entra en los 50 kg.' })),
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

  /* ---------- 3. Etapas ---------- */
  function pintarEtapas(){
    const op = OPERADOR_BY_ID[s.operador];
    const tarifa = (texto, url, extra = null) => el('div', { class:'dz-tarifa' }, texto, extra, url ? ' ' : null, enlace('Ver tarifa', url));

    const cuerpo = {
      origen:() => [campoNum('Envío que cobra la tienda', s.costos.origenUSD, v => { s.costos.origenUSD = v; recalcular(); },
        { ayuda:'Si dice "envío gratis", dejá 0. Si no lo sabés, borralo: queda como "falta cotizar".' })],

      internacional:() => [
        el('label', { class:'dz-campo' }, el('span', {}, 'Con quién viaja'),
          el('select', { class:'inp', onchange:e => {
            s.operador = e.target.value;
            if (!OPERADOR_BY_ID[s.operador].calcular){ s.costos.internacionalUSD = null; s.costos.arriboUSD = null; }
            pintarEtapas(); recalcular();
          } }, ...OPERADORES.map(o => el('option', { value:o.id, selected:o.id === s.operador || null },
            `${o.empresa} · ${o.servicio}${o.publica === false ? ' (sin tarifa pública)' : ''}`)))),
        tarifa(op.condiciones, op.url, op.plazo ? el('span', {}, ` Plazo informado: ${op.plazo}.`) : null),
        op.calcular ? null : campoNum('Lo que te cotizaron por el viaje', s.costos.internacionalUSD, v => { s.costos.internacionalUSD = v; recalcular(); })],

      arribo:() => [
        OPERADOR_BY_ID[s.operador].id === 'logistika-aereo'
          ? tarifa('Pequeño envío: incluido en la tarifa de Logistika como 10% de seguro y trámites aduaneros (mínimo US$ 30).', OPERADOR_BY_ID['logistika-aereo'].url)
          : campoNum('Pequeño envío: gestión del courier o tasa del correo', s.costos.arriboUSD, v => { s.costos.arriboUSD = v; recalcular(); }),
        tarifa(OPERADOR_BY_ID.correo.condiciones, OPERADOR_BY_ID.correo.url),
        campoNum('Importación general: almacenaje en depósito fiscal', s.costos.depositoUSD, v => { s.costos.depositoUSD = v; recalcular(); },
          { ayuda:'No hay tarifa pública: lo cotiza el depósito según los días.' })],

      aduana:() => [
        el('p', {}, 'Los tributos se calculan solos abajo, con la posición del Arancel y las normas vigentes.'),
        campoNum('Importación general: honorarios del despachante', s.costos.despachanteUSD, v => { s.costos.despachanteUSD = v; s.despachanteTocado = true; recalcular(); },
          { ayuda:DESPACHANTE_REFERENCIA.texto })],

      ultima:() => [campoNum(`Envío hasta tu casa (${destino()})`, s.costos.ultimaMillaARS, v => { s.costos.ultimaMillaARS = v; recalcular(); },
        { pref:'$', paso:'1', ayuda:'No hay una tarifa única publicada: cargá lo que te cobre el courier, Correo Argentino o el transporte.' })]
    };

    poner(secEtapas, 
      el('h2', {}, ic('mundo'), 'El viaje, en cinco etapas'),
      el('p', { class:'dz-sub' }, 'Cada etapa la hace alguien distinto y cobra lo suyo. Donde la empresa publica su tarifa, la usamos y te dejamos el link; donde no, queda "falta cotizar" hasta que cargues el valor. No inventamos números.'),
      el('ol', { class:'dz-etapas' }, ...ETAPAS.map(et => el('li', { class:'dz-etapa' },
        el('span', { class:'dz-n', 'aria-hidden':'true' }, String(et.n)),
        el('div', { style:{ minWidth:'0' } },
          el('h3', {}, et.titulo),
          el('p', {}, et.quePasa, ' ', el('b', {}, 'Lo hace: '), et.quien, '.'),
          el('details', {}, el('summary', {}, 'Trámites de esta etapa'), el('ul', {}, ...et.tramites.map(t => el('li', {}, t)))),
          el('div', { class:'dz-campos' }, ...cuerpo[et.id]()))))));
  }

  /* ---------- Cálculo ---------- */
  function calcular(){
    const fob = aUSD(s.precio || 0, s.moneda) * s.unidades;
    const peso = s.pesoKg * s.unidades;
    const op = OPERADOR_BY_ID[s.operador];
    const costos = { ...s.costos }, sellos = {}, detalles = {};
    if (op.calcular){
      const c = op.calcular({ pesoKg:peso, valorUSD:fob });
      costos.internacionalUSD = c.internacionalUSD;
      sellos.internacionalUSD = op.publica === true ? 'publicada' : 'referencia';
      detalles.internacionalUSD = `${op.empresa}: ${c.detalleInternacional}${c.desde ? ' (precio "desde")' : ''}`;
      if (c.arriboUSD != null){ costos.arriboUSD = c.arriboUSD; sellos.arriboUSD = 'publicada'; detalles.arriboUSD = `${op.empresa}: ${c.detalleArribo}`; }
    }
    sellos.despachanteUSD = s.despachanteTocado ? 'tuyo' : 'referencia';
    if (!s.despachanteTocado) detalles.despachanteUSD = 'mínimo sugerido por el CDA; pedí presupuesto';

    const base = { fobUSD:fob, unidades:s.unidades, pesoKg:peso, destino:s.destino, perfilId, inscriptoGanancias:s.inscriptoGanancias,
      enviosAnio:s.enviosAnio, die:s.posicion?.die ?? null, ivaReducido:s.ivaReducido, costos, sellos, detalles,
      tc:{ tarjeta:FX.tarjeta, oficial:FX.oficial }, provincia:destino(),
      fuenteOperador: op.url ? { titulo:`${op.empresa} — ${op.servicio}`, url:op.url } : null };
    const fee = tipo => calcularFee({ valorUSD:fob, fleteUSD:costos.internacionalUSD || 0, tipo }).feeUSD;
    const pequeno = desglosar({ ...base, via:'pequeno', feeUSD:fee('internacional') });
    const general = desglosar({ ...base, via:'general', feeUSD:fee('mayorista') });
    const local = s.localElegido != null ? s.locales?.[s.localElegido] || null : null;
    const consejo = recomendar({ pequeno, general, local, destino:s.destino, perfilId, unidades:s.unidades });
    return { fob, peso, op, pequeno, general, consejo };
  }

  function recalcular(){
    const r = calcular();
    s.resultado = r;
    if (!s.tabElegida) s.tab = r.pequeno.disponible ? 'pequeno' : 'general';
    pintarDesglose(r); pintarConsejo(r);
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
        `Lo que pagás afuera va al dólar tarjeta ($ ${Math.round(FX.tarjeta).toLocaleString('es-AR')}); los tributos y gastos de Aduana, al dólar oficial ($ ${Math.round(FX.oficial).toLocaleString('es-AR')}). `,
        `Cotización ${FX.origen === 'vivo' ? 'en vivo' : 'de referencia'}. Normas consultadas el ${fechaAR(CONSULTADO)}. Tocá cada línea para ver qué es y de dónde sale.`));
  }

  function pintarDesglose(r){
    const pestania = (id, nombre, d) => el('button', { class:'v-chip' + (s.tab === id ? ' on' : ''), 'aria-pressed':String(s.tab === id),
      onclick:() => { s.tab = id; s.tabElegida = true; recalcular(); } },
      `${nombre} · ${d.disponible ? plata(d.totalARS) : 'no disponible'}`);
    poner(secDesglose, 
      el('h2', {}, ic('calc'), 'Todo lo que pagás, discriminado'),
      el('p', { class:'dz-sub' }, 'Cada línea con su fórmula, en dólares y en pesos, y con de dónde sale el número.'),
      !s.precio ? el('div', { class:'notice' }, 'Cargá el precio del producto para ver el desglose.') : [
        el('div', { class:'dz-tabs', role:'group', 'aria-label':'Forma de traerlo' },
          pestania('pequeno', 'Pequeño envío', r.pequeno), pestania('general', 'Con despachante', r.general)),
        tabla(s.tab === 'pequeno' ? r.pequeno : r.general)]);
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

  function pintarComparar(){
    const cuerpo = s.buscandoLocal ? [el('div', { class:'notice' }, 'Buscando el mismo producto en tiendas argentinas…')]
      : s.locales == null ? [el('button', { class:'btn', onclick:buscarLocal }, ic('buscar'), 'Buscar en tiendas argentinas')]
      : !s.locales.length ? [el('div', { class:'notice' }, 'No lo encontramos en las tiendas argentinas que la app lee en vivo. Eso no quiere decir que no se venda: buscalo también en Mercado Libre antes de decidir.')]
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
              p.accion === 'grandes' ? el('button', { class:'btn btn-sm', onclick:() => ir('#/grandes') }, 'Ver cómo son las compras grandes', ic('der'))
              : p.accion === 'perfil' ? el('button', { class:'btn btn-sm', onclick:() => ir('#/impuestos?tab=perfil') }, 'Cambiar mi condición', ic('der')) : null))))] : null,
        !s.posicion ? el('div', { class:'notice', style:{ marginBottom:'8px' } }, 'Falta elegir la posición NCM: sin ella no sabemos el derecho de importación.') : null,
        ...c.cuidado.map(m => el('div', { class:'notice', style:{ marginBottom:'8px' } }, m)),
        r.pequeno.disponible && r.op.plazo ? el('p', { class:'dz-sub' }, `Plazo del viaje informado por ${r.op.empresa}: ${r.op.plazo}, más el trámite de Aduana.`) : null,
        el('div', { class:'c-acciones' },
          alConfirmar ? el('button', { class:'btn btn-lg btn-win', disabled:hayImportacion && s.posicion ? null : true,
            onclick:() => alConfirmar(resumen(r)) }, ic('envio'), 'Pedir que NiJu lo traiga') : null,
          el('button', { class:'btn', disabled:hayImportacion ? null : true, onclick:() => {
            store.push('importaciones', resumen(r));
            toast('Guardado en tu carpeta, con todo el desglose', 'win');
          } }, ic('caja'), 'Guardar en Mi carpeta'),
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
  const raiz = el('div', { class:'dz' }, secSituacion, secProducto, secEtapas, secDesglose, secComparar, secConsejo, secPreguntas);
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
