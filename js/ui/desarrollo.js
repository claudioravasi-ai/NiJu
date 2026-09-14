/* ============================================================
   NiJu — Apps y webs a medida (producto propio)
   ------------------------------------------------------------
   El cliente cuenta qué necesita, ve un rango de precio armado con
   valores de mercado 2026 (Argentina y mundo, con su fuente) y pide
   presupuesto. El precio final lo confirma NiJu después de charlar
   el proyecto: la estimación es orientativa y así se dice.
   Webs simples: rangos de precio publicados en Argentina.
   Apps y sistemas: horas estimadas × tarifa horaria de mercado.
   Las horas por tipo y por función son una estimación de NiJu.
   ============================================================ */
import { el, plata, ic, toast } from '../util.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';
import { botonVolver } from './components.js';
import { enviarSolicitud } from '../engine/solicitudes.js';
import { copiarPorAhora } from './exportar.js';

const FUENTES = {
  webAR:   { titulo:'Precios de páginas web en Argentina 2026 (Tomás Web)', url:'https://tomasweb.com.ar/blog/cuanto-cuesta-una-pagina-web-en-argentina-en-2026-precios-reales' },
  webAR2:  { titulo:'Precio de páginas web 2026 (Diseño Web Córdoba)', url:'https://disenowebcordoba.com.ar/blog/precio-de-paginas-web-en-2026-en-argentina/' },
  appAR:   { titulo:'Cuánto cuesta una app en Argentina 2026 (Desarrollo de Aplicaciones Móviles)', url:'https://desarrollo-de-aplicaciones-moviles.com.ar/blog/costo-desarrollo-app-argentina' },
  mundo:   { titulo:'Tarifas por hora y costo de un MVP en 2026 (Fullstack Labs)', url:'https://www.fullstack.com/labs/resources/blog/software-development-price-guide-hourly-rate-comparison' },
  mundo2:  { titulo:'Costo de desarrollo de apps por región 2026 (Appilian)', url:'https://appilian.com/app-development-cost-by-region/' }
};

/* Tarifa horaria de mercado en Argentina (senior, 2026). */
const HORA_USD = [35, 65];

const TIPOS = [
  { id:'landing', nombre:'Landing page', desc:'Una sola página para presentar un producto o servicio y juntar contactos.',
    modo:'precio', ars:[350000, 700000], semanas:[1, 2], fuente:'webAR2', anual:true },
  { id:'institucional', nombre:'Sitio institucional', desc:'Varias secciones: quiénes somos, servicios, contacto. Sin ventas online.',
    modo:'precio', ars:[350000, 700000], semanas:[2, 4], fuente:'webAR2', anual:true, nota:'Es el rango de un sitio sencillo: más secciones o funciones lo suben.' },
  { id:'tienda', nombre:'Tienda online', desc:'Catálogo, carrito y cobro con tarjeta o Mercado Pago.',
    modo:'precio', ars:[800000, 6000000], semanas:[3, 10], fuente:'webAR', anual:true },
  { id:'sistema', nombre:'Sistema web a medida', desc:'Turnos, gestión, portal de clientes, reservas: algo que no resuelve una plantilla.',
    modo:'horas', horas:[200, 600] },
  { id:'app', nombre:'App para celulares (primera versión)', desc:'Android e iPhone con un solo desarrollo. Lo mínimo para salir a probar.',
    modo:'horas', horas:[300, 600] },
  { id:'app-grande', nombre:'App completa', desc:'Muchas pantallas, usuarios, pagos, panel de administración e integraciones.',
    modo:'horas', horas:[800, 1500] }
];

/* Horas extra por función (estimación de NiJu). */
const FUNCIONES = [
  { id:'login', nombre:'Usuarios con cuenta y contraseña', horas:[40, 80] },
  { id:'pagos', nombre:'Cobros online', horas:[40, 80] },
  { id:'admin', nombre:'Panel de administración', horas:[60, 120] },
  { id:'diseno', nombre:'Diseño visual a medida (no plantilla)', horas:[40, 120] },
  { id:'integraciones', nombre:'Conexión con otros sistemas (facturación, stock, CRM)', horas:[40, 100] },
  { id:'mapas', nombre:'Mapas o ubicación', horas:[30, 60] },
  { id:'chat', nombre:'Chat o notificaciones', horas:[40, 80] },
  { id:'idiomas', nombre:'Varios idiomas', horas:[20, 40] }
];

const usd = v => `US$ ${Math.round(v).toLocaleString('es-AR')}`;

export function estimar(tipoId, funciones = []){
  const T = TIPOS.find(t => t.id === tipoId);
  if (!T) return null;
  if (T.modo === 'precio'){
    return { tipo:T, modo:'precio', ars:T.ars, usd:T.ars.map(v => v / FX.oficial), semanas:T.semanas,
             extras:funciones.length ? 'Las funciones que elegiste suben el precio: te lo ajustamos en el presupuesto.' : null };
  }
  const extra = FUNCIONES.filter(f => funciones.includes(f.id)).reduce((a, f) => [a[0] + f.horas[0], a[1] + f.horas[1]], [0, 0]);
  const horas = [T.horas[0] + extra[0], T.horas[1] + extra[1]];
  const usdR = [horas[0] * HORA_USD[0], horas[1] * HORA_USD[1]];
  return { tipo:T, modo:'horas', horas, usd:usdR, ars:usdR.map(v => v * FX.oficial),
           semanas:[Math.ceil(horas[0] / 35), Math.ceil(horas[1] / 30)], mantenimiento:usdR.map(v => v * 0.15).concat(usdR[1] * 0.25) };
}

export function vistaDesarrollo(ir){
  const u = store.get('usuario');
  const d = { tipo:'app', funciones:[], nombre:[u?.nombre, u?.apellido].filter(Boolean).join(' '), contacto:u?.email || u?.telefono || '' };
  const resultado = el('div');
  const listaTipos = el('div', { class:'dz-lista' });
  const listaFunciones = el('div', { class:'k2-chips' });

  function pintarTipos(){
    listaTipos.replaceChildren(...TIPOS.map(t => el('button', { type:'button', class:'dz-opcion' + (d.tipo === t.id ? ' on' : ''),
      onclick:() => { d.tipo = t.id; pintarTipos(); pintarResultado(); } },
      el('b', {}, t.nombre), el('small', {}, t.desc))));
  }
  function pintarFunciones(){
    listaFunciones.replaceChildren(...FUNCIONES.map(f => el('button', { type:'button', class:'v-chip' + (d.funciones.includes(f.id) ? ' on' : ''),
      'aria-pressed':String(d.funciones.includes(f.id)),
      onclick:() => { d.funciones = d.funciones.includes(f.id) ? d.funciones.filter(x => x !== f.id) : [...d.funciones, f.id]; pintarFunciones(); pintarResultado(); } }, f.nombre)));
  }
  function pintarResultado(){
    const e = estimar(d.tipo, d.funciones);
    const F = e.modo === 'precio' ? FUENTES[e.tipo.fuente] : FUENTES.appAR;
    resultado.replaceChildren(
      el('div', { class:'sv-resultado', 'aria-live':'polite' },
        el('small', {}, `Estimación para: ${e.tipo.nombre}`),
        el('b', {}, e.modo === 'precio' ? `${plata(e.ars[0])} a ${plata(e.ars[1])}` : `${usd(e.usd[0])} a ${usd(e.usd[1])}`),
        el('span', { class:'tiny' }, e.modo === 'precio'
          ? `unos ${usd(e.usd[0])} a ${usd(e.usd[1])} · ${e.semanas[0]} a ${e.semanas[1]} semanas`
          : `unos ${plata(e.ars[0])} a ${plata(e.ars[1])} · ${e.horas[0]} a ${e.horas[1]} horas · ${e.semanas[0]} a ${e.semanas[1]} semanas`)),
      el('div', { class:'t-lineas', style:{ marginTop:'10px' } },
        e.modo === 'horas' ? [
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Horas estimadas (tipo + funciones)'), el('span', { class:'mono' }, `${e.horas[0]} a ${e.horas[1]}`)),
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Tarifa de mercado en Argentina (senior)'), el('span', { class:'mono' }, `US$ ${HORA_USD[0]} a ${HORA_USD[1]} por hora`)),
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Mantenimiento por año (15% a 25%)'), el('span', { class:'mono' }, `${usd(e.mantenimiento[0])} a ${usd(e.mantenimiento[2])}`))
        ] : [
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Precio de mercado publicado en Argentina'), el('span', { class:'mono' }, `${plata(e.ars[0])} a ${plata(e.ars[1])}`)),
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Dominio por año (aprox.)'), el('span', { class:'mono' }, plata(18500))),
          el('div', { class:'cost-line' }, el('span', { class:'lbl' }, 'Hosting por año (aprox.)'), el('span', { class:'mono' }, `${plata(40000)} a ${plata(70000)}`))
        ]),
      e.tipo.nota ? el('p', { class:'c-legal' }, e.tipo.nota) : null,
      e.extras ? el('p', { class:'c-legal' }, e.extras) : null,
      el('p', { class:'c-legal' }, 'Rango orientativo con valores de mercado 2026, en dólares al oficial de hoy. El precio final te lo confirmamos después de charlar el proyecto. ',
        el('a', { class:'c-fuente', href:F.url, target:'_blank', rel:'noopener' }, 'Fuente')));
  }

  const campo = (etiqueta, clave, { ph = '', area = false } = {}) => el('label', { class:'k2-campo' },
    el('span', {}, etiqueta),
    el(area ? 'textarea' : 'input', { class:'inp', placeholder:ph, value:area ? null : (d[clave] || ''), oninput:e => d[clave] = e.target.value }, area ? d[clave] || '' : null));
  const elegir = (etiqueta, clave, opciones) => {
    const cont = el('div', { class:'k2-chips' });
    const pintar = () => cont.replaceChildren(...opciones.map(o => el('button', { type:'button', class:'v-chip' + (d[clave] === o ? ' on' : ''),
      onclick:() => { d[clave] = o; pintar(); } }, o)));
    pintar();
    return el('div', { class:'k2-campo' }, el('span', {}, etiqueta), cont);
  };

  const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
    if (!d.nombre?.trim() || !d.contacto?.trim()) return toast('Poné tu nombre y un teléfono o email', 'bad');
    if (!d.descripcion?.trim()) return toast('Contanos qué tiene que hacer la app o la web', 'bad');
    const e = estimar(d.tipo, d.funciones);
    const datos = { ...d, tipo:e.tipo.nombre, funciones:FUNCIONES.filter(f => d.funciones.includes(f.id)).map(f => f.nombre),
      estimacion: e.modo === 'precio' ? `${plata(e.ars[0])} a ${plata(e.ars[1])}` : `${usd(e.usd[0])} a ${usd(e.usd[1])} (${e.horas[0]}-${e.horas[1]} h)` };
    boton.disabled = true;
    try{
      const r = await enviarSolicitud('desarrollo', datos);
      toast(`Recibimos tu pedido (${r.id}). Te contactamos para charlar el proyecto.`, 'win');
    }catch(err){
      if (err.sinRuta) copiarPorAhora('desarrollo', datos, err.message); else toast(err.message, 'bad');
    }finally{ boton.disabled = false; }
  } }, 'Pedir presupuesto');

  pintarTipos(); pintarFunciones(); pintarResultado();

  const fila = (quien, hora, ejemplo, fuente) => el('tr', {}, el('td', {}, quien), el('td', {}, hora), el('td', {}, ejemplo),
    el('td', {}, el('a', { class:'c-fuente', href:FUENTES[fuente].url, target:'_blank', rel:'noopener' }, 'ver')));

  return el('div', { class:'wrap c-cuenta' },
    botonVolver(ir),
    el('section', { class:'c-hero' },
      el('span', { class:'c-hero-kicker' }, 'Hecho por NiJu'),
      el('h1', {}, 'Tu app o tu página web, a medida'),
      el('p', {}, 'Contanos qué necesitás y te mostramos cuánto sale en el mercado hoy, con la fuente. Después charlamos el proyecto y te pasamos el presupuesto final, sin compromiso.')),

    el('h2', { class:'c-seccion' }, '1. ¿Qué necesitás?'),
    listaTipos,
    el('h2', { class:'c-seccion' }, '2. ¿Qué tiene que hacer?'),
    el('p', { class:'c-sub' }, 'Tocá las funciones que necesitás. Si no sabés, dejalo así: lo vemos juntos.'),
    listaFunciones,
    el('h2', { class:'c-seccion' }, '3. Cuánto sale en el mercado'),
    resultado,

    el('h2', { class:'c-seccion' }, 'Cuánto se cobra hoy, en Argentina y en el mundo'),
    el('div', { class:'sv-scroll' }, el('table', { class:'sv-tabla' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Quién'), el('th', {}, 'Por hora'), el('th', {}, 'Ejemplo'), el('th', {}, 'Fuente'))),
      el('tbody', {},
        fila('Página web en Argentina', '—', 'Institucional sencilla $ 350.000 a $ 700.000; tienda online $ 800.000 a $ 6.000.000 o más', 'webAR'),
        fila('Desarrollo en Argentina', 'US$ 35 a 65 (senior)', 'App primera versión desde US$ 5.000; promedio US$ 15.000; compleja US$ 50.000 o más', 'appAR'),
        fila('Latinoamérica (contratistas)', 'US$ 30 a 75', 'Agencias: US$ 40 a 100 por hora', 'mundo'),
        fila('Europa del Este', 'US$ 35 a 80', 'Primera versión de una app (400 a 600 h): US$ 20.000 a 30.000', 'mundo2'),
        fila('Estados Unidos', 'US$ 100 a 250', 'App simple US$ 10.000 a 60.000; mediana US$ 60.000 a 150.000', 'mundo2')))),
    el('p', { class:'c-legal' }, 'Valores publicados en 2026 por cada fuente. Cambian con el dólar y con el tamaño del proyecto.'),

    el('h2', { class:'c-seccion' }, '4. Pedí tu presupuesto'),
    el('div', { class:'card' },
      el('div', { class:'grid g-2' }, campo('Tu nombre', 'nombre'), campo('Teléfono o email', 'contacto')),
      campo('¿Qué tiene que hacer? ¿Para quién es?', 'descripcion', { area:true, ph:'Ej: una app para que mis clientes reserven turnos y paguen la seña' }),
      elegir('¿Tenés diseño o marca?', 'marca', ['Tengo logo y colores', 'Tengo el diseño hecho', 'No tengo nada']),
      elegir('¿Para cuándo lo necesitás?', 'plazo', ['Lo antes posible', 'En 1 a 3 meses', 'Sin apuro']),
      campo('¿Tenés un presupuesto pensado? (opcional)', 'presupuesto', { ph:'Ej: hasta US$ 5.000' }),
      campo('Apps o webs que te gusten (links, opcional)', 'referencias'),
      boton,
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } }, 'Usamos estos datos solo para responderte (Ley 25.326).')));
}
