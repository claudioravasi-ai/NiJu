/* ============================================================
   NiJu — Campañas por fecha y "Más comprás, más ahorrás"
   · El calendario comercial (Argentina y el mundo) se calcula acá:
     cada fecha arma su campaña sola. Una semana antes queda "por
     arrancar" para que el dueño la revise; en su fecha arranca sola,
     salvo que el dueño la haya frenado.
   · Lo que decide el dueño (aprobar, frenar, editar) y los
     beneficios que otorga viven en el servidor (/v1/promos).
   · Si el servidor todavía no tiene la ruta, no se muestra ninguna
     campaña: nada sale sin que el dueño haya podido revisarlo.
   ============================================================ */
import { llamar, hayCuenta } from './nube.js';
import { estaPagada } from './ordenes.js';
import { store } from '../state.js';

const DIA = 864e5;
export const ANTICIPO_DIAS = 7;

const fecha = (anio, mes, dia) => new Date(anio, mes - 1, dia);
const sumar = (f, dias) => new Date(f.getFullYear(), f.getMonth(), f.getDate() + dias);

/** El n-ésimo día de la semana de un mes (0 = domingo). */
function nesimo(anio, mes, diaSemana, n){
  const primero = new Date(anio, mes - 1, 1);
  const corrimiento = (diaSemana - primero.getDay() + 7) % 7;
  return new Date(anio, mes - 1, 1 + corrimiento + (n - 1) * 7);
}

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
function pascua(anio){
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

/** Las fechas comerciales de un año. "confirmar" marca las que fija una
    cámara cada año (Hot Sale y CyberMonday las define la CACE): la fecha
    es una estimación que el dueño corrige al editar la campaña. */
export function fechasDelAnio(anio){
  const padre = nesimo(anio, 6, 0, 3), infancias = nesimo(anio, 8, 0, 3), madre = nesimo(anio, 10, 0, 3);
  const hotSale = nesimo(anio, 5, 1, 2), cyber = nesimo(anio, 11, 1, 1);
  const blackFriday = sumar(nesimo(anio, 11, 4, 4), 1);
  return [
    { clave:'reyes', nombre:'Día de Reyes', alcance:'Argentina', inicio:fecha(anio, 1, 1), fin:fecha(anio, 1, 6), color:'#8c52ff',
      titulo:'Regalos de Reyes', texto:'Los regalos de Reyes al mejor precio final, comparados en todas las tiendas.', busqueda:'juguetes' },
    { clave:'san-valentin', nombre:'San Valentín', alcance:'Mundo', inicio:fecha(anio, 2, 7), fin:fecha(anio, 2, 14), color:'#f23d4f',
      titulo:'San Valentín', texto:'Un regalo para quien querés, sin pagar de más.', busqueda:'perfume' },
    { clave:'clases', nombre:'Vuelta a clases', alcance:'Argentina', inicio:fecha(anio, 2, 15), fin:fecha(anio, 3, 10), color:'#3483fa',
      titulo:'Vuelta a clases', texto:'Mochilas, útiles y tecnología: compará antes de comprar.', busqueda:'mochila' },
    { clave:'pascuas', nombre:'Pascuas', alcance:'Mundo', inicio:sumar(pascua(anio), -7), fin:pascua(anio), color:'#ff7733',
      titulo:'Pascuas en familia', texto:'Chocolates y regalos para compartir, al precio final más bajo.', busqueda:'chocolate' },
    { clave:'hot-sale', nombre:'Hot Sale', alcance:'Argentina', inicio:hotSale, fin:sumar(hotSale, 2), confirmar:true, color:'#f23d4f',
      titulo:'Hot Sale', texto:'Las ofertas del Hot Sale, todas las tiendas comparadas a la vez.', busqueda:'smart tv' },
    { clave:'dia-padre', nombre:'Día del Padre', alcance:'Argentina', inicio:sumar(padre, -7), fin:padre, color:'#1f55cc',
      titulo:'Día del Padre', texto:'El regalo para papá, con el precio final a la vista.', busqueda:'taladro' },
    { clave:'dia-amigo', nombre:'Día del Amigo', alcance:'Argentina', inicio:fecha(anio, 7, 13), fin:fecha(anio, 7, 20), color:'#00a650',
      titulo:'Día del Amigo', texto:'Algo lindo para esa amistad de siempre.', busqueda:'parlante' },
    { clave:'infancias', nombre:'Día de las Infancias', alcance:'Argentina', inicio:sumar(infancias, -10), fin:infancias, color:'#ff9e1b',
      titulo:'Día de las Infancias', texto:'Juguetes comparados en todas las tiendas, para que alcance para más.', busqueda:'juguete' },
    { clave:'primavera', nombre:'Día de la Primavera', alcance:'Argentina', inicio:fecha(anio, 9, 14), fin:fecha(anio, 9, 21), color:'#00a650',
      titulo:'Llegó la primavera', texto:'Renová lo que necesitás pagando lo justo.', busqueda:'zapatillas' },
    { clave:'dia-madre', nombre:'Día de la Madre', alcance:'Argentina', inicio:sumar(madre, -10), fin:madre, color:'#e91e8c',
      titulo:'Día de la Madre', texto:'El regalo para mamá al mejor precio final.', busqueda:'perfume' },
    { clave:'cybermonday', nombre:'CyberMonday', alcance:'Argentina', inicio:cyber, fin:sumar(cyber, 2), confirmar:true, color:'#3483fa',
      titulo:'CyberMonday', texto:'Las ofertas del CyberMonday, comparadas en todas las tiendas.', busqueda:'notebook' },
    { clave:'11-11', nombre:'11.11', alcance:'Mundo', inicio:fecha(anio, 11, 10), fin:fecha(anio, 11, 11), color:'#ff4747',
      titulo:'11.11 del mundo', texto:'Traé del exterior con impuestos y envío ya calculados.', busqueda:'auriculares' },
    { clave:'black-friday', nombre:'Black Friday y Cyber Monday', alcance:'Mundo', inicio:blackFriday, fin:sumar(blackFriday, 3), color:'#1f1f1f',
      titulo:'Black Friday', texto:'Las ofertas del mundo, con el precio puesto en tu casa.', busqueda:'celular' },
    { clave:'navidad', nombre:'Navidad', alcance:'Mundo', inicio:fecha(anio, 12, 1), fin:fecha(anio, 12, 24), color:'#c8102e',
      titulo:'Navidad', texto:'Los regalos de Navidad, comparados y sin sorpresas.', busqueda:'regalo' }
  ].map(f => ({ ...f, id:`${f.clave}-${anio}` }));
}

export const aTextoFecha = f => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
const deTextoFecha = t => { const [a, m, d] = String(t).split('-').map(Number); return new Date(a, m - 1, d); };

/** Todas las campañas del año y del siguiente, con lo que decidió el
    dueño aplicado y su estado de hoy:
    programada · por-arrancar (faltan 7 días o menos) · en-curso · frenada · terminada */
export function campaniasCalculadas(ajustes = {}, hoy = new Date()){
  const anio = hoy.getFullYear();
  return [...fechasDelAnio(anio), ...fechasDelAnio(anio + 1)].map(base => {
    const a = ajustes?.[base.id] || {};
    const c = { ...base,
      titulo:a.titulo || base.titulo, texto:a.texto || base.texto, busqueda:a.busqueda || base.busqueda,
      inicio:a.inicio ? deTextoFecha(a.inicio) : base.inicio, fin:a.fin ? deTextoFecha(a.fin) : base.fin,
      editada:!!(a.titulo || a.texto || a.busqueda || a.inicio || a.fin), decision:a.estado || null, decidida:a.decidida || null };
    const ini = c.inicio.getTime(), fin = c.fin.getTime() + DIA - 1, t = hoy.getTime();
    const porFecha = t > fin ? 'terminada' : t >= ini ? 'en-curso' : ini - t <= ANTICIPO_DIAS * DIA ? 'por-arrancar' : 'programada';
    c.estado = porFecha !== 'terminada' && a.estado === 'frenada' ? 'frenada' : porFecha;
    c.diasParaArrancar = Math.ceil((ini - t) / DIA);
    return c;
  }).sort((x, y) => x.inicio - y.inicio);
}

/* ---------------- Servidor ---------------- */
let publicas = null;

/** Lo que ven los clientes. null si el servidor todavía no tiene la ruta. */
export async function leerPromosPublicas(){
  if (publicas && Date.now() - publicas.ts < 5 * 60e3) return publicas.d;
  try{
    const d = await llamar('/promos', { anonimo:true, tiempo:8000 });
    publicas = { ts:Date.now(), d };
    return d;
  }catch{ return null; }
}

export const leerPromosDueno = () => llamar('/promos/todo', { comoDueno:true });

export async function guardarPromosDueno(d){
  const r = await llamar('/promos', { metodo:'PUT', cuerpo:{ campanias:d.campanias || {}, niveles:d.niveles || null, beneficios:d.beneficios || {} }, comoDueno:true });
  publicas = null;
  return r;
}

/** El beneficio aprobado del cliente que entró. Queda en el estado para
    que el carrito lo aplique sin esperar al servidor. */
export async function miBeneficio(){
  if (!hayCuenta()) { store.set('beneficio', null); return null; }
  try{
    const r = await llamar('/promos/yo');
    store.set('beneficio', r.beneficio || null);
    return r.beneficio || null;
  }catch{ return store.get('beneficio') || null; }
}

/* ---------------- Más comprás, más ahorrás ---------------- */
/* Punto de partida editable desde el Panel. El descuento es sobre la
   gestión de NiJu, que es lo único cuyo precio decide NiJu. */
export const NIVELES_INICIALES = [
  { id:'frecuente', nombre:'Cliente frecuente', compras:5,  gastoARS:300000,  pct:10 },
  { id:'oro',       nombre:'Cliente Oro',       compras:10, gastoARS:1000000, pct:20 },
  { id:'nijuplus',  nombre:'Cliente NiJu+',     compras:20, gastoARS:3000000, pct:30 }
];

const ordenarNiveles = niveles => [...(niveles || NIVELES_INICIALES)].sort((a, b) => a.compras - b.compras || a.gastoARS - b.gastoARS);

/** El nivel que corresponde a tantas compras pagadas y tanto gastado. */
export function nivelPara(compras, gastoARS, niveles){
  return ordenarNiveles(niveles).filter(n => compras >= n.compras && gastoARS >= n.gastoARS).at(-1) || null;
}

/** Cuánto le falta a un cliente para el próximo nivel. */
export function progreso(compras, gastoARS, niveles){
  const lista = ordenarNiveles(niveles);
  const actual = nivelPara(compras, gastoARS, lista);
  const proximo = lista.find(n => !(compras >= n.compras && gastoARS >= n.gastoARS)) || null;
  return { actual, proximo,
    faltanCompras: proximo ? Math.max(0, proximo.compras - compras) : 0,
    faltaGasto: proximo ? Math.max(0, proximo.gastoARS - gastoARS) : 0,
    avance: proximo ? Math.min(1, (Math.min(compras / proximo.compras, 1) + Math.min(gastoARS / proximo.gastoARS, 1)) / 2) : 1 };
}

/** Para el dueño: cada cliente con sus compras pagadas, el nivel que
    alcanzó y si hay un beneficio para aprobar. */
export function candidatos(ordenes = [], niveles, beneficios = {}){
  const porCliente = {};
  for (const o of ordenes){
    if (!estaPagada(o) || !o.cliente?.email) continue;
    const c = porCliente[o.cliente.email] ||= { email:o.cliente.email, nombre:o.cliente.nombre || o.cliente.email, compras:0, gastoARS:0, ultima:0 };
    c.compras++;
    c.gastoARS += o.totalARS || 0;
    c.ultima = Math.max(c.ultima, o.creada || 0);
  }
  return Object.values(porCliente).map(c => {
    const nivel = nivelPara(c.compras, c.gastoARS, niveles);
    const otorgado = beneficios[c.email] || null;
    return { ...c, nivel, otorgado, pendiente:!!nivel && (!otorgado || otorgado.nivel !== nivel.id) };
  }).sort((a, b) => Number(b.pendiente) - Number(a.pendiente) || b.gastoARS - a.gastoARS);
}
