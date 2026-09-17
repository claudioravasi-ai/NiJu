/* ============================================================
   NiJu — "Hacemos tu negocio" (#/negocio)
   ------------------------------------------------------------
   El caballito de batalla de NiJu (pedido de Claudio, 17-09-2026):
   la persona sube una foto, pega un link o cuenta su idea, y la app
   le pregunta qué quiere hacer:
     · Traémelo            → pasa a "Traelo por mí" con todo cargado
     · Poner máquinas      → lugares, máquinas por lugar, modelo de negocio
     · Tengo el lugar      → NiJu pone la máquina (comodato con canon)
     · No tengo el dinero  → préstamo a tasa del BCRA, sociedad o grupal
     · Montar mi negocio   → estudio de mercado con precios reales
   Cada camino termina en una propuesta con cómo gana cada uno y se
   manda a NiJu (Panel → Solicitudes). Hace falta la cuenta.
   Los campos no se vuelven a dibujar mientras se escribe: solo los
   resultados. Lo cargado queda en la pestaña.
   ============================================================ */
import { el, plata, ic, toast, uid } from '../util.js';
import { store } from '../state.js';
import { FX, aUSD } from '../engine/fx.js';
import { botonVolver, cargandoNiju, destino } from './components.js';
import { enviarSolicitud } from '../engine/solicitudes.js';
import { copiarPorAhora } from './exportar.js';
import { esDueno } from '../engine/sesion.js';
import { calcularImportacion } from '../engine/taxes.js';
import { referencia } from '../data/etapas-envio.js';
import { pedirResolver } from './pedido.js';
import {
  tasasBCRA, opcionesFinanciacion, TIPOS_MAQUINA, TIPO_MAQUINA_BY_ID, LUGARES, MODELOS_MAQUINA, costoMaquinaImportada,
  estudioMaquinas, preciosEnArgentina, estudioIdea, POBLACION, FUENTE_CENSO, FORMAS_MONTAJE, pedirIA, achicarFoto
} from '../engine/negocio.js';

const MEMORIA = 'niju.negocio';
const poner = (nodo, ...hijos) => nodo.replaceChildren(...hijos.flat(Infinity).filter(h => h != null && h !== false));
const meses = m => m == null ? '—' : m < 1 ? 'menos de 1 mes' : `${m.toLocaleString('es-AR', { maximumFractionDigits:1 })} meses`;
const pct = v => `${(+v || 0).toLocaleString('es-AR', { maximumFractionDigits:1 })}%`;

const ACCIONES = [
  { id:'traer',     icono:'envio',    titulo:'Traémelo',                           desc:'Lo compramos donde esté y te lo dejamos en tu casa, con aduana y todo.' },
  { id:'maquinas',  icono:'caja',     titulo:'Quiero poner máquinas en lugares',   desc:'Expendedoras u otras máquinas en escuelas, clubes, fábricas u oficinas.' },
  { id:'lugar',     icono:'tienda',   titulo:'Tengo el lugar: pongan ustedes la máquina', desc:'Sin poner plata: NiJu instala y opera, vos cobrás parte de lo que vende.' },
  { id:'financiar', icono:'etiqueta', titulo:'Quiero comprar y no tengo el dinero', desc:'Préstamo a tasa bancaria de hoy, sociedad con NiJu o compra grupal.' },
  { id:'idea',      icono:'estrella', titulo:'Quiero montar un negocio o una pyme', desc:'Estudiamos el mercado con precios reales y te decimos cómo conviene armarlo.' }
];

const EJEMPLOS = ['Máquinas de café en hospitales', 'Traer 50 parlantes para vender', 'Una grúa de peluches en un shopping', 'Abrir una tienda de ropa online'];

export function vistaNegocio(ir){
  const usuario = store.get('usuario');
  const n = {
    paso:1, modo:'link', link:'', texto:'', foto:null, leido:null, leyendo:false, accion:null,
    /* máquinas */
    tipo:'snacks', tengoMaquinas:false, modelo:'compra', precioMaquina:null, monedaMaquina:'USD',
    lugares:[{ id:uid(), nombre:'', tipo:'escuela', personasDia:500, dias:22, maquinas:1 }],
    ticketARS:null, margenPct:40, canonPct:10, gastoMensualMaquinaARS:30000, capitalCliente:0, preciosTicket:null,
    /* financiar */
    cantidad:1, precioUnidad:null, monedaUnidad:'USD', pesoUnidadKg:1, ventaUnidadARS:null, plazo:12, tasas:null, errorTasas:'',
    /* idea */
    producto:'', provincia:destino(), capitalARS:null, costoUnidadARS:null, precioVentaARS:null, unidadesMes:null, gastosFijosMes:null,
    forma:'online', precios:null, buscandoPrecios:false,
    /* comunes */
    ia:null, pensandoIA:false, comentario:'', contacto:usuario?.telefono || usuario?.email || '', enviado:null
  };
  try{ Object.assign(n, JSON.parse(sessionStorage.getItem(MEMORIA) || '{}'), { leyendo:false, pensandoIA:false, buscandoPrecios:false }); }catch{}
  const recordar = () => { try{ const { foto, ...resto } = n; sessionStorage.setItem(MEMORIA, JSON.stringify(resto)); }catch{} };

  const raiz = el('div', { class:'wrap ng' });
  const cuerpo = el('div');
  const resultado = el('div', { 'aria-live':'polite' });

  /* ---------- Ayudantes de formulario ---------- */
  const numero = v => v === '' || v == null || !isFinite(+v) ? null : +v;
  const campoNum = (etiqueta, clave, { pref = '$', ayuda = null, paso = '1', alCambiar = pintarResultado, supuesto = false } = {}) =>
    el('label', { class:'k2-campo' },
      el('span', {}, etiqueta, supuesto ? el('em', { class:'ng-supuesto' }, 'supuesto, cambialo') : null),
      el('div', { class:'k2-input' }, el('b', {}, pref),
        el('input', { type:'number', inputmode:'decimal', min:'0', step:paso, value:n[clave] ?? '',
          oninput:e => { n[clave] = numero(e.target.value); recordar(); alCambiar(); } })),
      ayuda ? el('small', {}, ayuda) : null);
  const campoTexto = (etiqueta, clave, { ph = '', area = false, alCambiar = () => {} } = {}) => el('label', { class:'k2-campo' },
    el('span', {}, etiqueta),
    el(area ? 'textarea' : 'input', { class:'inp', rows:area ? '3' : null, placeholder:ph, value:area ? null : (n[clave] || ''),
      oninput:e => { n[clave] = e.target.value; recordar(); alCambiar(); } }, area ? (n[clave] || '') : null));
  const chips = (etiqueta, clave, opciones, alElegir = () => pintar()) => el('div', { class:'k2-campo' }, el('span', {}, etiqueta),
    el('div', { class:'k2-chips', role:'group', 'aria-label':etiqueta }, ...opciones.map(([v, t]) =>
      el('button', { type:'button', class:'v-chip' + (n[clave] === v ? ' on' : ''), 'aria-pressed':String(n[clave] === v),
        onclick:() => { n[clave] = v; recordar(); alElegir(v); } }, t))));
  const tarjetas = (clave, opciones, alElegir = () => pintar()) => el('div', { class:'dz-tarjetas', role:'radiogroup' },
    ...opciones.map(o => el('button', { type:'button', class:'dz-tarjeta' + (n[clave] === o.id ? ' on' : ''), role:'radio', 'aria-checked':String(n[clave] === o.id),
      onclick:() => { n[clave] = o.id; recordar(); alElegir(o.id); } },
      el('span', { class:'dz-radio', 'aria-hidden':'true' }), el('span', { class:'dz-tarjeta-txt' }, el('b', {}, o.nombre), o.desc ? el('small', {}, o.desc) : null))));
  const linea = (k, v, nota = null, clase = '') => el('div', { class:'cost-line ' + clase },
    el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
    el('span', { class:'mono' }, v));
  const fuente = f => f ? el('a', { class:'c-fuente', href:f.url, target:'_blank', rel:'noopener' }, 'Fuente: ' + f.titulo) : null;
  const titulo = () => n.leido?.titulo || n.texto.trim() || n.producto || '';

  const irA = paso => { n.paso = paso; recordar(); pintar(); raiz.scrollIntoView({ behavior:'smooth', block:'start' }); };

  /* ---------- Paso 1: qué tenés ---------- */
  async function leerLink(){
    const u = n.link.trim();
    if (!/^https?:\/\//i.test(u)) return toast('Pegá un link que empiece con http:// o https://', 'bad');
    n.leyendo = true; pintar();
    try{
      const d = await pedirResolver(u);
      n.leido = d.titulo ? { titulo:d.titulo, precio:d.precio ?? null, moneda:d.moneda || d.tienda?.moneda || 'USD', imagen:d.imagen || null, url:d.url || u, tienda:d.tienda || null,
        pesoKg:d.pesoKg || null } : { titulo:'', url:u, precio:null, moneda:'USD' };
      if (!d.titulo) toast('La tienda no deja leer el producto: contanos qué es abajo', 'bad');
    }catch{
      n.leido = { titulo:'', url:u, precio:null, moneda:'USD' };
      toast('No pudimos leer el link: contanos qué es y seguimos igual', 'bad');
    }
    n.leyendo = false; recordar(); pintar();
  }

  async function subirFoto(archivo){
    if (!archivo) return;
    try{
      n.foto = await achicarFoto(archivo);
      pintar();
      const r = await pedirIA('describir', { imagen:await achicarFoto(archivo, 640, 0.75) });
      if (r.ok && r.texto && !n.texto.trim()){ n.texto = r.texto.slice(0, 200); recordar(); toast('La IA reconoció la foto: revisá el texto', 'win'); pintar(); }
    }catch(e){ toast(e.message, 'bad'); }
  }

  function paso1(){
    const tabs = [['link', 'Pegar un link'], ['foto', 'Subir una foto'], ['texto', 'Contar mi idea']];
    const entrada = n.modo === 'link'
      ? el('div', { class:'t-buscador ng-buscador' }, ic('mundo'),
          el('input', { type:'url', inputmode:'url', value:n.link, placeholder:'Link del producto o de la máquina, de cualquier tienda',
            'aria-label':'Link', oninput:e => { n.link = e.target.value; recordar(); }, onkeydown:e => { if (e.key === 'Enter') leerLink(); } }),
          el('button', { onclick:leerLink, disabled:n.leyendo ? true : null }, ic('buscar'), n.leyendo ? 'Leyendo…' : 'Leer'))
      : n.modo === 'foto'
        ? el('label', { class:'ng-foto' },
            n.foto ? el('img', { src:n.foto, alt:'Tu foto' }) : [ic('imagen'), el('b', {}, 'Tocá para sacar o elegir una foto'), el('small', {}, 'De la máquina, del producto o del lugar')],
            el('input', { type:'file', accept:'image/*', capture:'environment', onchange:e => subirFoto(e.target.files?.[0]) }))
        : null;

    return [
      el('section', { class:'ng-hero' },
        el('span', { class:'c-hero-kicker' }, 'Hacemos tu negocio por vos'),
        el('h1', {}, 'Decinos qué querés hacer y NiJu lo hace realidad'),
        el('p', {}, '¿Tenés una idea? ¿Querés montar una pyme, poner máquinas, traer productos para tu local y no tenés la plata? Contanos. Estudiamos el mercado, armamos los números y te proponemos cómo hacerlo: nosotros lo compramos, lo traemos, lo instalamos, te financiamos o nos asociamos.'),
        el('div', { class:'ng-ejemplos' }, ...EJEMPLOS.map(t => el('button', { type:'button', class:'ng-ejemplo', onclick:() => { n.modo = 'texto'; n.texto = t; recordar(); pintar(); } }, t)))),
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '1'), el('span', {}, el('small', {}, 'Paso 1 de 4'), 'Mostranos qué tenés en mente')),
        el('div', { class:'ng-tabs', role:'tablist' }, ...tabs.map(([id, t]) => el('button', { type:'button', role:'tab', class:'ng-tab' + (n.modo === id ? ' on' : ''),
          'aria-selected':String(n.modo === id), onclick:() => { n.modo = id; recordar(); pintar(); } }, t))),
        entrada,
        n.leyendo ? cargandoNiju('Leyendo el producto en la tienda…') : null,
        n.leido?.titulo ? el('div', { class:'ng-leido' },
          n.leido.imagen ? el('img', { src:n.leido.imagen, alt:'' }) : null,
          el('span', {}, el('b', {}, n.leido.titulo), el('small', {}, [n.leido.tienda?.nombre, n.leido.precio != null ? plata(n.leido.precio, n.leido.moneda) : 'sin precio legible'].filter(Boolean).join(' · ')))) : null,
        campoTexto(n.modo === 'texto' ? 'Contanos tu idea o tu necesidad' : 'Qué es (si la app no lo reconoce, escribilo)', 'texto',
          { area:n.modo === 'texto', ph:'Ej: quiero poner 10 máquinas de snacks en escuelas de Rosario' }),
        el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
          if (!titulo() && !n.foto) return toast('Pegá un link, subí una foto o contanos tu idea', 'bad');
          irA(2);
        } }, 'Seguir', ic('der')))
    ];
  }

  /* ---------- Paso 2: qué querés hacer ---------- */
  function paso2(){
    return el('section', { class:'dz-sec' },
      el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '2'), el('span', {}, el('small', {}, 'Paso 2 de 4'), '¿Qué querés hacer?')),
      resumenEntrada(),
      el('div', { class:'ng-acciones' }, ...ACCIONES.map(a => el('button', { type:'button', class:'ng-accion' + (n.accion === a.id ? ' on' : ''),
        onclick:() => elegirAccion(a.id) },
        el('span', { class:'ng-accion-ic' }, ic(a.icono)), el('b', {}, a.titulo), el('small', {}, a.desc)))),
      el('button', { class:'btn btn-ghost', onclick:() => irA(1) }, ic('izq'), 'Cambiar lo que cargué'));
  }

  function resumenEntrada(){
    const img = n.leido?.imagen || n.foto;
    return el('div', { class:'ng-leido' }, img ? el('img', { src:img, alt:'' }) : el('span', { class:'dz-r-sinfoto' }, ic('estrella')),
      el('span', {}, el('b', {}, titulo() || 'Tu foto'), n.leido?.precio != null ? el('small', {}, plata(n.leido.precio, n.leido.moneda)) : null));
  }

  function elegirAccion(id){
    n.accion = id;
    if (id === 'traer') return irATraelo();
    const precioUSD = n.leido?.precio != null ? aUSD(n.leido.precio, n.leido.moneda || 'USD') : null;
    if (id === 'lugar'){ n.modelo = 'comodato'; n.canonPct = 12; }
    if (id === 'maquinas' || id === 'lugar'){
      const t = titulo().toLowerCase();
      n.tipo = /caf[eé]/.test(t) ? 'cafe' : /peluche|gr[uú]a|claw/.test(t) ? 'peluche' : /carga|cargador/.test(t) ? 'carga' : /higiene|farmacia|preservativ|toall/.test(t) ? 'higiene' : n.tipo;
      if (precioUSD && n.precioMaquina == null){ n.precioMaquina = Math.round(precioUSD); n.monedaMaquina = 'USD'; }
    }
    if (id === 'financiar'){
      if (precioUSD && n.precioUnidad == null){ n.precioUnidad = Math.round(precioUSD * 100) / 100; n.monedaUnidad = 'USD'; }
      if (n.leido?.pesoKg) n.pesoUnidadKg = n.leido.pesoKg;
      const cant = titulo().match(/(\d{1,5})\s*(unidades|u\.|productos|piezas)?/i);
      if (cant && n.cantidad === 1) n.cantidad = Math.min(10000, +cant[1]);
      cargarTasas();
    }
    if (id === 'idea' && !n.producto) n.producto = n.leido?.titulo || n.texto.trim();
    irA(3);
  }

  /* "Traémelo": pasa a Traelo por mí con lo leído, sin volver a cargar nada. */
  function irATraelo(){
    try{ sessionStorage.setItem('niju.desdeNegocio', JSON.stringify({
      url:n.leido?.url || (/^https?:/i.test(n.link) ? n.link : ''), titulo:titulo(), precio:n.leido?.precio ?? null,
      moneda:n.leido?.moneda || 'USD', imagen:n.leido?.imagen || n.foto || null, tienda:n.leido?.tienda || null, pesoKg:n.leido?.pesoKg || null })); }catch{}
    ir('#/pedido');
  }

  /* ---------- Paso 3 y 4: máquinas ---------- */
  function costoMaquinaARS(){
    if (n.precioMaquina == null) return null;
    if (n.monedaMaquina === 'ARS') return n.precioMaquina;
    const cantidad = Math.max(1, n.lugares.reduce((a, l) => a + (+l.maquinas || 0), 0));
    return costoMaquinaImportada({ precioUSD:n.precioMaquina, cantidad, tipo:n.tipo }).porMaquinaARS;
  }

  async function buscarTicket(){
    const T = TIPO_MAQUINA_BY_ID[n.tipo];
    const q = T.busqueda || titulo();
    if (!q) return toast('Escribí qué vende la máquina', 'bad');
    n.buscandoPrecios = true; pintarResultado();
    try{
      n.preciosTicket = await preciosEnArgentina(q);
      if (n.preciosTicket?.mediana){ n.ticketARS = Math.round(n.preciosTicket.mediana); toast('Usamos el precio de la mitad del mercado de hoy', 'win'); }
      else toast('No encontramos ese producto en tiendas en vivo: poné el precio a mano', 'bad');
    }catch{ toast('No pudimos buscar precios ahora', 'bad'); }
    n.buscandoPrecios = false; recordar(); pintar();
  }

  function pasoMaquinas(){
    const filaLugar = (l, i) => el('div', { class:'ng-lugar' },
      el('b', { class:'ng-lugar-n' }, String(i + 1)),
      el('input', { class:'inp', value:l.nombre, placeholder:'Nombre (ej: Escuela N° 12)', 'aria-label':'Nombre del lugar',
        oninput:e => { l.nombre = e.target.value; recordar(); pintarResultado(); } }),
      el('select', { class:'inp', 'aria-label':'Tipo de lugar', onchange:e => { l.tipo = e.target.value; recordar(); pintarResultado(); } },
        ...LUGARES.map(x => el('option', { value:x.id, selected:l.tipo === x.id || null }, x.nombre))),
      ...[['personasDia', 'personas por día'], ['dias', 'días abiertos al mes'], ['maquinas', 'máquinas']].map(([k, t]) =>
        el('label', { class:'ng-mini' }, el('input', { class:'inp', type:'number', min:'0', step:'1', value:l[k] ?? '',
          oninput:e => { l[k] = numero(e.target.value) || 0; recordar(); pintarResultado(); } }), el('small', {}, t))),
      n.lugares.length > 1 ? el('button', { type:'button', class:'iconbtn', title:'Quitar lugar', 'aria-label':'Quitar lugar',
        onclick:() => { n.lugares = n.lugares.filter(x => x.id !== l.id); recordar(); pintar(); } }, ic('x')) : null);

    return [
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '3'), el('span', {}, el('small', {}, 'Paso 3 de 4'), 'Armemos tu negocio de máquinas')),
        resumenEntrada(),
        chips('¿Qué máquina?', 'tipo', TIPOS_MAQUINA.map(t => [t.id, t.nombre]), () => { n.preciosTicket = null; pintar(); }),
        el('div', { class:'k2-campo dz-grupo' }, el('span', {}, '¿Cómo lo querés hacer?'), tarjetas('modelo', MODELOS_MAQUINA, v => {
          n.canonPct = v === 'comodato' ? 12 : 10; pintar(); })),
        n.modelo !== 'comodato' ? chips('¿Ya tenés las máquinas?', 'tengoMaquinas', [[false, 'No: que NiJu las traiga'], [true, 'Sí, ya las tengo']]) : null,
        n.modelo !== 'comodato' && !n.tengoMaquinas ? el('div', { class:'dz-fila' },
          campoNum('Precio de cada máquina', 'precioMaquina', { pref:n.monedaMaquina === 'USD' ? 'US$' : '$',
            ayuda:n.monedaMaquina === 'USD' ? 'Precio afuera (Alibaba, Made-in-China…). Le sumamos flete, aduana e impuestos.' : 'Precio en Argentina, ya puesta acá.' }),
          chips('¿Dónde la comprás?', 'monedaMaquina', [['USD', 'Afuera, en dólares'], ['ARS', 'En Argentina, en pesos']])) : null,

        el('h3', { class:'dz-h3' }, '¿En qué lugares?'),
        el('p', { class:'dz-sub' }, 'Cargá cada institución o lugar: cuánta gente pasa por día y cuántas máquinas pondrías. Si no sabés la gente, preguntá en el lugar: es el dato que más cambia el resultado.'),
        el('div', { class:'ng-lugares' }, ...n.lugares.map(filaLugar)),
        el('button', { type:'button', class:'btn', onclick:() => { n.lugares.push({ id:uid(), nombre:'', tipo:'escuela', personasDia:300, dias:22, maquinas:1 }); recordar(); pintar(); } },
          '+ Agregar otro lugar'),

        el('h3', { class:'dz-h3' }, 'Números de la venta'),
        el('div', { class:'dz-fila' },
          el('div', {}, campoNum('Precio promedio de lo que vende', 'ticketARS', { ayuda:'Lo que paga la gente por compra.' }),
            el('button', { type:'button', class:'btn btn-sm', onclick:buscarTicket, disabled:n.buscandoPrecios ? true : null }, ic('buscar'),
              n.buscandoPrecios ? 'Buscando…' : 'Buscar el precio real en tiendas')),
          campoNum('Margen sobre lo que vende', 'margenPct', { pref:'%', supuesto:true, ayuda:'Lo que queda después de pagar la mercadería.' })),
        el('div', { class:'dz-fila' },
          campoNum(n.modelo === 'comodato' ? 'Parte de las ventas para vos (dueño del lugar)' : 'Parte de las ventas para el dueño del lugar', 'canonPct',
            { pref:'%', supuesto:true, ayuda:'Lo que se paga por usar el espacio.' }),
          campoNum('Gastos por máquina por mes', 'gastoMensualMaquinaARS', { supuesto:true, ayuda:'Luz, reposición, mantenimiento y cobro.' })),
        n.modelo === 'sociedad' ? campoNum('Capital que ponés vos', 'capitalCliente') : null),
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '4'), el('span', {}, el('small', {}, 'Paso 4 de 4'), 'El estudio y la propuesta de NiJu')),
        resultado)
    ];
  }

  function resultadoMaquinas(){
    const costo = n.modelo === 'comodato' || !n.tengoMaquinas ? costoMaquinaARS() : 0;
    const e = estudioMaquinas({ ...n, costoMaquinaARS:costo || 0 });
    const imp = n.modelo !== 'comodato' && !n.tengoMaquinas && n.monedaMaquina === 'USD' && n.precioMaquina
      ? costoMaquinaImportada({ precioUSD:n.precioMaquina, cantidad:Math.max(1, e.maquinas), tipo:n.tipo }) : null;
    const V = {
      faltan:['warn', 'Faltan datos', 'Completá el precio de lo que vende y al menos un lugar con máquinas.'],
      no:['bad', 'Así como está, no conviene', 'Lo que vende no alcanza a cubrir el canon y los gastos. Mirá las alternativas abajo.'],
      lento:['warn', 'Se puede, pero recuperás la plata muy lento', `Tardás ${meses(e.meses)} en recuperar lo invertido.`],
      medio:['ok', 'Conviene, con cuidado', `Recuperás lo invertido en ${meses(e.meses)}.`],
      si:['ok', 'Conviene', e.meses ? `Recuperás lo invertido en ${meses(e.meses)}.` : 'Ganás desde el primer mes sin invertir.']
    }[e.veredicto];
    const ganaNiju = n.modelo === 'comodato'
      ? `NiJu pone ${plata(e.inversion)} en máquinas, las opera y se queda con lo que queda después de pagarte el ${pct(n.canonPct)} de las ventas y los gastos: ${plata(e.niju.ganaMes)} por mes.`
      : n.modelo === 'sociedad'
        ? `NiJu pone ${plata(e.niju.invierte)} (${pct(e.niju.pct)}) y se lleva esa parte de la ganancia: ${plata(e.niju.ganaMes)} por mes. Además cobra la gestión de compra e importación de las máquinas.`
        : 'NiJu cobra la gestión de compra, importación e instalación de las máquinas (te la cotizamos con el pedido). La ganancia de las máquinas es toda tuya.';

    return [
      el('div', { class:`ng-veredicto ${V[0]}` }, el('b', {}, V[1]), el('span', {}, V[2])),
      imp ? el('div', { class:'notice' }, el('b', {}, 'Cada máquina puesta en Argentina: '), plata(imp.porMaquinaARS),
        ` (precio afuera + flete como carga ${imp.pesoKg.toLocaleString('es-AR')} kg + aduana, sin lo que recuperás). `, imp.aviso, ' ',
        fuente(imp.fleteFuente)) : null,
      n.preciosTicket?.cantidad ? el('p', { class:'c-legal' }, `Precio en tiendas argentinas hoy para "${n.preciosTicket.consulta}": de ${plata(n.preciosTicket.min)} a ${plata(n.preciosTicket.max)}, la mitad del mercado en ${plata(n.preciosTicket.mediana)} (${n.preciosTicket.cantidad} productos en ${n.preciosTicket.tiendas} tiendas, leídos en vivo).`) : null,
      e.lugares.some(l => l.maquinas) ? el('div', { class:'sv-scroll' }, el('table', { class:'sv-tabla ng-tabla' },
        el('thead', {}, el('tr', {}, ...['Lugar', 'Máquinas', 'Compras por día', 'Ventas por mes', 'Por máquina'].map(t => el('th', {}, t)))),
        el('tbody', {}, ...e.lugares.map((l, i) => el('tr', {},
          el('td', {}, l.nombre || `Lugar ${i + 1}`, el('small', {}, ` · ${l.compran} de cada 100 compran (supuesto)`)),
          el('td', {}, String(l.maquinas)), el('td', {}, Math.round(l.ventasDia).toLocaleString('es-AR')),
          el('td', {}, plata(l.ventasMes)), el('td', {}, plata(l.ventasMesPorMaquina))))))) : null,
      el('div', { class:'t-lineas' },
        linea('Ventas por mes', plata(e.ventasMes), `${e.maquinas} máquinas`),
        linea('Queda después de la mercadería', plata(e.margenBruto), pct(n.margenPct)),
        linea(n.modelo === 'comodato' ? 'Para vos, dueño del lugar' : 'Para el dueño del lugar', '− ' + plata(e.canon), pct(n.canonPct)),
        linea('Gastos de las máquinas', '− ' + plata(e.gastos)),
        linea('Resultado por mes', plata(e.resultadoMes), null, 'total'),
        e.inversion ? linea('Inversión en máquinas', plata(e.inversion)) : null,
        e.meses ? linea('Se recupera en', meses(e.meses)) : null),
      el('div', { class:'ng-reparto' },
        el('div', {}, el('small', {}, 'Vos'), el('b', {}, e.cliente.ganaMes != null ? `${plata(e.cliente.ganaMes)} / mes` : '—'),
          el('span', {}, e.cliente.invierte ? `ponés ${plata(e.cliente.invierte)}` : 'sin poner plata')),
        el('div', {}, el('small', {}, 'NiJu'), el('b', {}, e.niju.ganaMes != null ? `${plata(e.niju.ganaMes)} / mes` : 'gestión'),
          el('span', {}, e.niju.invierte ? `pone ${plata(e.niju.invierte)}` : 'cobra por traerlas e instalarlas'))),
      el('p', { class:'dz-sub' }, el('b', {}, 'Cómo gana NiJu: '), ganaNiju),
      e.flojos.length ? el('div', { class:'notice' }, el('b', {}, 'Lugares que venden poco: '), e.flojos.join(', '),
        '. Conviene poner menos máquinas ahí y más donde pasa más gente.') : null,
      ['no', 'lento'].includes(e.veredicto) ? el('div', { class:'notice' }, el('b', {}, 'Alternativas: '),
        'probá con menos máquinas en los lugares con más gente; cambiá a una máquina de mayor margen (café o grúa de peluches); o que NiJu ponga las máquinas y vos cobres parte de las ventas sin arriesgar plata.',
        el('div', { class:'c-acciones', style:{ marginTop:'8px' } },
          n.modelo !== 'comodato' ? el('button', { class:'btn btn-sm', onclick:() => { n.modelo = 'comodato'; n.canonPct = 12; recordar(); pintar(); } }, 'Ver con NiJu poniendo las máquinas') : null,
          el('button', { class:'btn btn-sm', onclick:() => { n.accion = 'financiar'; n.precioUnidad = n.precioMaquina; n.monedaUnidad = n.monedaMaquina; n.cantidad = Math.max(1, e.maquinas); cargarTasas(); irA(3); } }, 'Ver cómo financiarlas'))) : null,
      el('p', { class:'c-legal' }, 'Los porcentajes marcados como supuesto son de NiJu: no hay una estadística pública argentina de ventas de máquinas por lugar. Cambialos con lo que sepas del lugar. El precio de venta sale de tiendas argentinas leídas en vivo.'),
      bloqueIA({ tipo:'maquinas', maquina:TIPO_MAQUINA_BY_ID[n.tipo].nombre, modelo:n.modelo, lugares:e.lugares, ticketARS:n.ticketARS, margenPct:n.margenPct,
        canonPct:n.canonPct, gastoMensualMaquinaARS:n.gastoMensualMaquinaARS, costoMaquinaARS:costo, resultado:{ ventasMes:e.ventasMes, resultadoMes:e.resultadoMes, inversion:e.inversion, mesesRecupero:e.meses } }),
      bloqueEnviar(() => ({ accion:n.modelo === 'comodato' ? 'Tengo el lugar: NiJu pone la máquina' : 'Poner máquinas en lugares',
        maquina:TIPO_MAQUINA_BY_ID[n.tipo].nombre, modelo:MODELOS_MAQUINA.find(m => m.id === n.modelo)?.nombre,
        lugares:e.lugares.map(l => `${l.nombre || 'sin nombre'} (${l.tipo}, ${l.personasDia} personas/día, ${l.maquinas} máq.)`),
        ventasMes:Math.round(e.ventasMes), resultadoMes:Math.round(e.resultadoMes), inversion:Math.round(e.inversion), recupero:meses(e.meses) }))
    ];
  }

  /* ---------- Paso 3 y 4: financiar ---------- */
  async function cargarTasas(){
    if (n.tasas) return;
    try{ n.tasas = await tasasBCRA(); n.errorTasas = ''; }
    catch(e){ n.errorTasas = e.message || 'sin respuesta'; }
    recordar(); pintarResultado();
  }

  function costoCompraARS(){
    if (n.precioUnidad == null) return null;
    if (n.monedaUnidad === 'ARS') return n.precioUnidad * n.cantidad;
    const pesoKg = (n.pesoUnidadKg || 1) * n.cantidad;
    const flete = referencia('fleteChinaCarga', { pesoKg });
    const g = calcularImportacion({ valorUSD:n.precioUnidad * n.cantidad, fleteUSD:flete?.valor || 0, pesoKg, unidades:n.cantidad, regimen:'general', destino:'reventa' });
    return g.total * FX.oficial;
  }

  function pasoFinanciar(){
    return [
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '3'), el('span', {}, el('small', {}, 'Paso 3 de 4'), 'Tu compra y la plata que tenés')),
        resumenEntrada(),
        el('div', { class:'dz-fila' },
          campoNum('Cantidad de unidades', 'cantidad', { pref:'u.', alCambiar:() => { n.cantidad = Math.max(1, n.cantidad || 1); pintarResultado(); } }),
          campoNum('Precio de cada unidad', 'precioUnidad', { pref:n.monedaUnidad === 'USD' ? 'US$' : '$' })),
        el('div', { class:'dz-fila' },
          chips('¿Dónde se compra?', 'monedaUnidad', [['USD', 'Afuera (se importa)'], ['ARS', 'En Argentina']]),
          n.monedaUnidad === 'USD' ? campoNum('Peso de cada unidad', 'pesoUnidadKg', { pref:'kg', paso:'0.1' }) : null),
        el('div', { class:'dz-fila' },
          campoNum('Plata que tenés para poner', 'capitalCliente', { ayuda:'Si no tenés nada, dejá 0.' }),
          campoNum('Precio al que vas a vender cada unidad', 'ventaUnidadARS', { ayuda:'Opcional: con esto calculamos tu ganancia.' })),
        chips('¿En cuántos meses querés devolverlo?', 'plazo', [3, 6, 12, 18, 24].map(m => [m, `${m} meses`]), () => pintarResultado())),
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '4'), el('span', {}, el('small', {}, 'Paso 4 de 4'), 'Cómo lo hacemos posible')),
        resultado)
    ];
  }

  function resultadoFinanciar(){
    const costo = costoCompraARS();
    if (!costo) return el('div', { class:'dz-vacio' }, ic('etiqueta'), el('b', {}, 'Cargá el precio de cada unidad'), el('span', {}, 'y te mostramos las opciones al instante.'));
    const T = n.tasas;
    const o = opcionesFinanciacion({ costoARS:costo, capitalCliente:n.capitalCliente || 0, ventaARS:(n.ventaUnidadARS || 0) * n.cantidad, meses:n.plazo, tasas:T });
    const P = o.prestamo, S = o.sociedad;
    const recomendada = { prestamo:'Te conviene el préstamo', sociedad:'Te conviene la sociedad', propio:'Te alcanza con tu plata' }[o.conviene];

    return [
      el('div', { class:'t-lineas' },
        linea('Tu compra puesta en Argentina', plata(costo), n.monedaUnidad === 'USD' ? 'con flete como carga, aduana y despachante (aproximado por rubro)' : null),
        linea('Ponés vos', plata(Math.min(costo, n.capitalCliente || 0))),
        linea('Falta', plata(o.falta), null, 'total')),
      !T ? el('div', { class:'notice' + (n.errorTasas ? ' notice-bad' : '') }, n.errorTasas
          ? [`No pudimos leer las tasas del BCRA (${n.errorTasas}). `, el('button', { class:'p-link', onclick:() => { n.errorTasas = ''; cargarTasas(); } }, 'Probar de nuevo')]
          : 'Leyendo las tasas de hoy del Banco Central…') : null,
      o.falta <= 0 ? el('div', { class:'ng-veredicto ok' }, el('b', {}, 'Te alcanza con tu plata'), el('span', {}, 'No hace falta financiar: NiJu te hace la compra y la importación.')) : null,
      o.falta > 0 ? el('div', { class:'ng-opciones' },
        el('article', { class:'ng-opcion' + (o.conviene === 'prestamo' ? ' on' : '') },
          el('h3', {}, 'NiJu te presta'), el('small', {}, 'Devolvés en cuotas fijas, a la tasa de los bancos de hoy'),
          P ? [el('b', { class:'ng-grande' }, `${plata(P.cuota)} / mes`),
            linea('Cuotas', `${P.meses}`), linea('Tasa nominal anual', pct(P.tna), `BCRA, préstamos personales, ${T.personales.fecha.split('-').reverse().join('/')}`),
            linea('Tasa efectiva anual', pct(P.tea)), linea('Intereses', plata(P.intereses)), linea('Devolvés en total', plata(P.total), null, 'total'),
            o.netoConPrestamo != null ? linea('Te queda si vendés todo', plata(o.netoConPrestamo)) : null]
            : el('p', { class:'dz-sub' }, 'Esperando la tasa del BCRA…'),
          el('p', { class:'c-legal' }, el('b', {}, 'Cómo gana NiJu: '), o.spreadNiju != null
            ? `la diferencia entre la tasa del préstamo y lo que rinde un plazo fijo (${pct(o.tnaFondeo)}): ${plata(o.spreadNiju)} en todo el préstamo, más la gestión de la compra.`
            : 'con la diferencia de tasa y la gestión de la compra.')),
        el('article', { class:'ng-opcion' + (o.conviene === 'sociedad' ? ' on' : '') },
          el('h3', {}, 'Nos asociamos'), el('small', {}, 'NiJu pone lo que falta y la ganancia se reparte según lo que puso cada uno'),
          el('b', { class:'ng-grande' }, `${pct(S.pctCliente)} vos · ${pct(S.pctNiju)} NiJu`),
          linea('Ponés vos', plata(S.aporteCliente)), linea('Pone NiJu', plata(S.aporteNiju)),
          S.gananciaCliente != null ? [linea('Tu parte de la ganancia', plata(S.gananciaCliente)), linea('Parte de NiJu', plata(S.gananciaNiju))]
            : el('p', { class:'dz-sub' }, 'Poné el precio de venta para ver cuánto le toca a cada uno.'),
          el('p', { class:'c-legal' }, el('b', {}, 'Cómo gana NiJu: '), 'con su parte de la ganancia. No hay cuotas: si no se vende, pierden los dos en proporción. Los porcentajes finales se acuerdan por contrato.')),
        el('article', { class:'ng-opcion' },
          el('h3', {}, 'Compra grupal'), el('small', {}, 'Juntamos a varios que quieren lo mismo: más unidades, precio más bajo'),
          el('p', { class:'dz-sub' }, 'No pedís plata prestada: cada uno pone lo suyo y el flete y la aduana se reparten entre todos.'),
          el('button', { class:'btn btn-win btn-block', onclick:() => ir('#/grupal') }, 'Ver compras grupales', ic('der')),
          el('p', { class:'c-legal' }, el('b', {}, 'Cómo gana NiJu: '), 'con la gestión de la compra de todo el grupo.'))) : null,
      recomendada && o.falta > 0 ? el('div', { class:'ng-veredicto ok' }, el('b', {}, recomendada),
        el('span', {}, o.conviene === 'prestamo' ? 'Vendiendo al precio que pusiste, te queda más plata pagando los intereses que repartiendo la ganancia.'
          : 'Repartiendo la ganancia te queda más que pagando los intereses del préstamo.')) : null,
      T ? el('p', { class:'c-legal' }, `Tasas del BCRA leídas hoy: préstamos personales ${pct(T.personales?.tna)}, adelantos en cuenta corriente ${pct(T.adelantos?.tna)}, plazo fijo a 30 días ${pct(T.plazoFijo?.tna)}. `, fuente(T.fuente)) : null,
      esDueno() ? el('div', { class:'notice notice-bad' }, el('b', {}, 'Solo lo ves vos (dueño): '),
        'para prestar plata de forma habitual NiJu tiene que inscribirse en el BCRA como proveedor no financiero de crédito y cumplir las normas de defensa del consumidor sobre tasas y costo financiero total. Confirmalo con un abogado antes de ofrecer el préstamo.') : null,
      bloqueIA({ tipo:'financiar', producto:titulo(), cantidad:n.cantidad, costoARS:Math.round(costo), capitalCliente:n.capitalCliente, ventaUnidadARS:n.ventaUnidadARS,
        plazoMeses:n.plazo, prestamo:P, sociedad:S, tasasBCRA:T && { personales:T.personales?.tna, plazoFijo:T.plazoFijo?.tna } }),
      bloqueEnviar(() => ({ accion:'Comprar sin tener el dinero', producto:titulo(), cantidad:n.cantidad, costoARS:Math.round(costo),
        capitalCliente:n.capitalCliente || 0, falta:Math.round(o.falta), plazo:`${n.plazo} meses`,
        cuota:P ? Math.round(P.cuota) : null, tna:P?.tna, sociedad:S ? `${pct(S.pctCliente)} cliente / ${pct(S.pctNiju)} NiJu` : null }))
    ];
  }

  /* ---------- Paso 3 y 4: idea o pyme ---------- */
  async function estudiarMercado(){
    if (!n.producto.trim()) return toast('Escribí qué vas a vender', 'bad');
    n.buscandoPrecios = true; pintarResultado();
    try{ n.precios = await preciosEnArgentina(n.producto); }
    catch{ n.precios = null; toast('No pudimos buscar precios ahora', 'bad'); }
    n.buscandoPrecios = false; recordar(); pintarResultado();
  }

  function pasoIdea(){
    return [
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '3'), el('span', {}, el('small', {}, 'Paso 3 de 4'), 'Contanos tu negocio')),
        resumenEntrada(),
        campoTexto('¿Qué querés hacer?', 'texto', { area:true, ph:'Ej: vender ropa deportiva importada en Córdoba' }),
        el('div', { class:'dz-fila' },
          campoTexto('Producto o servicio principal (para buscar precios)', 'producto', { ph:'Ej: zapatillas running' }),
          el('label', { class:'k2-campo' }, el('span', {}, '¿Dónde?'),
            el('select', { class:'inp', onchange:e => { n.provincia = e.target.value; recordar(); pintarResultado(); } },
              ...Object.keys(POBLACION).map(p => el('option', { value:p, selected:n.provincia === p || null }, p))))),
        el('div', { class:'k2-campo dz-grupo' }, el('span', {}, '¿Cómo lo imaginás?'), tarjetas('forma', FORMAS_MONTAJE, () => pintar())),
        el('div', { class:'dz-fila' },
          campoNum('Capital que tenés', 'capitalARS'),
          campoNum('Gastos fijos por mes', 'gastosFijosMes', { ayuda:'Alquiler, sueldos, internet, publicidad. Online suele ser mucho menos.' })),
        el('div', { class:'dz-fila' },
          campoNum('Costo de cada unidad', 'costoUnidadARS', { ayuda:'Si lo importás, calculalo en "Traelo por mí".' }),
          campoNum('Precio de venta de cada unidad', 'precioVentaARS')),
        campoNum('Unidades que creés vender por mes', 'unidadesMes', { pref:'u.' }),
        el('button', { class:'btn btn-lg btn-win', onclick:estudiarMercado, disabled:n.buscandoPrecios ? true : null }, ic('buscar'),
          n.buscandoPrecios ? 'Estudiando el mercado…' : 'Estudiar el mercado')),
      el('section', { class:'dz-sec' },
        el('h2', { class:'dz-cab' }, el('span', { class:'dz-cab-n' }, '4'), el('span', {}, el('small', {}, 'Paso 4 de 4'), 'Estudio de mercado y propuesta')),
        resultado)
    ];
  }

  function resultadoIdea(){
    if (n.buscandoPrecios) return cargandoNiju('Buscando tu producto en las tiendas argentinas…');
    const e = estudioIdea(n, n.precios);
    const P = n.precios;
    const V = {
      faltan:['warn', 'Faltan números', 'Poné costo, precio de venta y unidades por mes para saber si da.'],
      no:['bad', 'Así no da', 'Con esos números el negocio pierde plata. Mirá las otras formas de montarlo.'],
      lento:['warn', 'Da, pero lento', `Recuperás el capital en ${meses(e.recupero)}.`],
      si:['ok', 'Da', e.recupero ? `Recuperás el capital en ${meses(e.recupero)}.` : 'Gana plata desde el primer mes.']
    }[e.veredicto];
    const irFormas = { maquinas:() => { n.accion = 'maquinas'; irA(3); }, grupal:() => ir('#/grupal'), mayorista:() => ir('#/mayorista') };

    return [
      el('div', { class:`ng-veredicto ${V[0]}` }, el('b', {}, V[1]), el('span', {}, V[2])),
      el('h3', { class:'dz-h3' }, 'El mercado'),
      el('div', { class:'t-lineas' },
        linea(`Población de ${n.provincia}`, e.poblacion ? e.poblacion.toLocaleString('es-AR') + ' personas' : '—', 'Censo 2022'),
        P?.cantidad ? [
          linea('Precio más bajo hoy', plata(P.min)), linea('La mitad del mercado vende a', plata(P.mediana)), linea('Precio más alto hoy', plata(P.max)),
          linea('Competencia', { alta:'Alta', media:'Media', baja:'Baja' }[e.competencia], `${P.tiendas} tiendas con ${P.cantidad} productos`)]
          : linea('Competencia', P ? 'Sin datos en tiendas en vivo' : 'Tocá "Estudiar el mercado"')),
      P?.ejemplos?.length ? el('ul', { class:'ng-ejemplos-lista' }, ...P.ejemplos.map(x => el('li', {},
        el('span', {}, x.titulo), el('b', {}, plata(x.ars)), x.url ? el('a', { class:'c-fuente', href:x.url, target:'_blank', rel:'noopener' }, 'Ver') : null))) : null,
      el('h3', { class:'dz-h3' }, 'Tus números'),
      el('div', { class:'t-lineas' },
        linea('Ganás por unidad', plata(e.margenUnidad)),
        linea('Ganancia por mes', plata(e.gananciaMes), null, 'total'),
        e.equilibrio != null ? linea('Unidades para cubrir los gastos fijos', `${e.equilibrio.toLocaleString('es-AR')} por mes`) : null,
        e.recupero != null ? linea('Recuperás el capital en', meses(e.recupero)) : null),
      ...e.avisos.map(a => el('div', { class:'notice', style:{ marginTop:'8px' } }, a)),
      el('h3', { class:'dz-h3' }, 'Formas de montarlo que te sugerimos'),
      el('div', { class:'ng-formas' }, ...e.formas.map(f => el('div', { class:'ng-forma' }, el('b', {}, f.nombre), el('small', {}, f.desc),
        irFormas[f.id] ? el('button', { class:'btn btn-sm', onclick:irFormas[f.id] }, 'Ver esta opción', ic('der')) : null))),
      el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } }, el('b', {}, 'Lo que NiJu puede hacer por vos: '),
        'comprar o importar la mercadería (cobramos la gestión), financiarte lo que falta a tasa bancaria, asociarnos poniendo capital a cambio de una parte de la ganancia, o armar una compra grupal.',
        el('div', { class:'c-acciones', style:{ marginTop:'8px' } },
          el('button', { class:'btn btn-sm', onclick:() => { n.accion = 'financiar'; n.precioUnidad = n.costoUnidadARS; n.monedaUnidad = 'ARS'; n.cantidad = n.unidadesMes || 1;
            n.ventaUnidadARS = n.precioVentaARS; n.capitalCliente = n.capitalARS || 0; cargarTasas(); irA(3); } }, 'Financiar la primera compra'),
          el('button', { class:'btn btn-sm', onclick:irATraelo }, 'Importar la mercadería'))),
      el('p', { class:'c-legal' }, 'Precios leídos en vivo en tiendas argentinas conectadas a la app (Mercado Libre todavía no deja leerse). Población: ', fuente(FUENTE_CENSO),
        '. Las unidades por mes y los gastos los pone el cliente: es la parte que más conviene validar antes de invertir.'),
      bloqueIA({ tipo:'idea', idea:n.texto, producto:n.producto, provincia:n.provincia, poblacion:e.poblacion, forma:n.forma, capitalARS:n.capitalARS,
        costoUnidadARS:n.costoUnidadARS, precioVentaARS:n.precioVentaARS, unidadesMes:n.unidadesMes, gastosFijosMes:n.gastosFijosMes,
        mercado:P, resultado:{ margenUnidad:e.margenUnidad, gananciaMes:e.gananciaMes, equilibrio:e.equilibrio, mesesRecupero:e.recupero, competencia:e.competencia } }),
      bloqueEnviar(() => ({ accion:'Montar un negocio', idea:n.texto, producto:n.producto, provincia:n.provincia,
        forma:FORMAS_MONTAJE.find(f => f.id === n.forma)?.nombre, capitalARS:n.capitalARS, gananciaMes:Math.round(e.gananciaMes), veredicto:V[1] }))
    ];
  }

  /* ---------- IA gratuita ---------- */
  function bloqueIA(contexto){
    const pedir = async () => {
      n.pensandoIA = true; pintarResultado();
      const r = await pedirIA('estudio', { contexto:{ ...contexto, dolarOficial:FX.oficial, fecha:new Date().toISOString().slice(0, 10) } });
      n.ia = r.ok ? { texto:r.texto, modelo:r.modelo } : { error:r.error, sinClave:r.sinClave };
      n.pensandoIA = false; recordar(); pintarResultado();
    };
    return el('div', { class:'ng-ia' },
      el('div', { class:'ng-ia-cab' }, el('b', {}, ic('chat'), ' Opinión de la IA'), el('small', {}, 'Gratis. Lee los mismos números de arriba.')),
      n.pensandoIA ? el('p', { class:'dz-sub' }, 'Pensando…')
        : n.ia?.texto ? [el('div', { class:'ng-ia-texto' }, n.ia.texto), el('p', { class:'c-legal' }, `Respuesta de ${n.ia.modelo || 'IA'}. Es una opinión: revisala antes de decidir.`)]
        : n.ia?.error ? el('div', { class:'notice' }, n.ia.sinClave ? 'La IA todavía no está encendida: el estudio de arriba lo hizo el motor de NiJu, con los mismos números.' : n.ia.error) : null,
      el('button', { class:'btn btn-sm', disabled:n.pensandoIA ? true : null, onclick:pedir }, n.ia?.texto ? 'Pedir otra opinión' : 'Pedir la opinión de la IA'));
  }

  /* ---------- Enviar a NiJu ---------- */
  function bloqueEnviar(armar){
    const u = store.get('usuario');
    if (!u) return el('div', { class:'notice', style:{ marginTop:'14px' } },
      el('b', {}, 'Para que NiJu te arme la propuesta necesitás tu cuenta. '),
      el('button', { class:'btn btn-sm btn-win', onclick:() => ir('#/cuenta') }, 'Entrar o crear mi cuenta'));
    if (n.enviado) return el('div', { class:'ng-veredicto ok', style:{ marginTop:'14px' } }, el('b', {}, `Recibimos tu pedido (${n.enviado})`),
      el('span', {}, 'Te contactamos para ajustar los números y avanzar. Lo ves en Mi cuenta.'),
      el('button', { class:'p-link', onclick:() => { n.enviado = null; recordar(); pintarResultado(); } }, 'Mandar otro'));
    const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
      const datos = { ...armar(), nombre:[u.nombre, u.apellido].filter(Boolean).join(' '), contacto:n.contacto || u.email || u.telefono || '',
        comentario:n.comentario, link:n.leido?.url || null, descripcion:titulo() };
      if (!datos.contacto.trim()) return toast('Poné un teléfono o email para contactarte', 'bad');
      boton.disabled = true;
      try{
        const r = await enviarSolicitud('negocio', datos);
        n.enviado = r.id;
        store.push('negocios', { id:r.id, creado:Date.now(), ...datos });
        toast('¡Listo! NiJu recibió tu negocio', 'win');
        recordar(); pintarResultado();
      }catch(err){
        if (err.sinRuta) copiarPorAhora('negocio', datos, err.message); else toast(err.message, 'bad');
      }finally{ boton.disabled = false; }
    } }, ic('envio'), 'Quiero que NiJu lo haga');
    return el('div', { class:'ng-enviar' },
      el('h3', { class:'dz-h3' }, 'Mandáselo a NiJu'),
      el('p', { class:'dz-sub' }, 'Sin costo ni compromiso: revisamos los números con vos y te pasamos la propuesta final.'),
      campoTexto('Teléfono o email', 'contacto'),
      campoTexto('¿Algo más que tengamos que saber? (opcional)', 'comentario', { area:true }),
      boton,
      el('p', { class:'tiny dim' }, 'Usamos estos datos solo para responderte (Ley 25.326).'));
  }

  /* ---------- Armado ---------- */
  function pintarResultado(){
    if (n.paso !== 3) return;
    const f = { maquinas:resultadoMaquinas, lugar:resultadoMaquinas, financiar:resultadoFinanciar, idea:resultadoIdea }[n.accion];
    if (f) poner(resultado, f());
  }

  function progreso(){
    const pasos = ['Qué tenés', 'Qué querés hacer', 'Los datos', 'Estudio y propuesta'];
    /* En el paso 3 los datos y el estudio van juntos: el estudio se arma mientras se completa. */
    const actual = n.paso;
    return el('nav', { class:'dz-progreso ng-progreso', 'aria-label':'Pasos' }, el('ol', {}, ...pasos.map((t, i) => {
      const k = i + 1, hecho = k < actual;
      return el('li', { class:(hecho ? 'hecho' : '') + (k === actual || (actual === 3 && k === 4) ? ' actual' : '') },
        el('button', { onclick:() => { if (k < actual) irA(k); } }, el('span', { class:'dz-p-n' }, hecho ? ic('check') : String(k)), el('span', { class:'dz-p-t' }, t)));
    })));
  }

  function pintar(){
    const partes = [botonVolver(ir), progreso()];
    if (n.paso === 1) partes.push(paso1());
    else if (n.paso === 2) partes.push(paso2());
    else partes.push({ maquinas:pasoMaquinas, lugar:pasoMaquinas, financiar:pasoFinanciar, idea:pasoIdea }[n.accion]?.() || paso2(),
      el('button', { class:'btn btn-ghost', style:{ marginTop:'10px' }, onclick:() => irA(2) }, ic('izq'), 'Elegir otra cosa para hacer'));
    poner(cuerpo, partes);
    pintarResultado();
  }

  raiz.append(cuerpo);
  if (n.accion === 'financiar' && n.paso === 3) cargarTasas();
  pintar();
  return raiz;
}
