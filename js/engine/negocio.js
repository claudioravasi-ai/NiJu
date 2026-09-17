/* ============================================================
   NiJu — "Hacemos tu negocio": el motor
   ------------------------------------------------------------
   Todo lo que la pantalla calcula sale de acá:
     · tasas de hoy del BCRA (API pública, sin clave)
     · préstamo en cuotas (sistema francés) a tasa bancaria
     · compra en sociedad según el capital de cada uno
     · estudio de máquinas en lugares (ventas, costos, recupero)
     · estudio de una idea (precios reales en Argentina + población)
     · IA gratuita (Gemini) por el servidor, si está encendida
   Regla de NiJu: nada se inventa. Lo que sale de una fuente lleva
   su fuente; lo que es un supuesto dice "supuesto" y el cliente
   lo puede cambiar.
   ============================================================ */
import { CONFIG } from '../config.js';
import { FX } from './fx.js';
import { buscar } from './search.js';
import { calcularImportacion } from './taxes.js';
import { referencia } from '../data/etapas-envio.js';

/* ---------- Tasas del BCRA ---------- */
export const FUENTE_BCRA = { titulo:'BCRA — Principales variables (API pública)', url:'https://www.bcra.gob.ar/PublicacionesEstadisticas/Principales_variables.asp' };
const BCRA_API = 'https://api.bcra.gob.ar/estadisticas/v4.0/monetarias';
/* idVariable del BCRA → uso en la app */
const VARIABLES = { 14:'personales', 13:'adelantos', 12:'plazoFijo', 44:'tamar' };
const CLAVE_TASAS = 'niju.tasasBCRA';

/** Tasas nominales anuales de hoy, en %. Se guardan 6 horas en la pestaña. */
export async function tasasBCRA(){
  try{
    const g = JSON.parse(sessionStorage.getItem(CLAVE_TASAS) || 'null');
    if (g && Date.now() - g.ts < 6 * 36e5) return g;
  }catch{}
  const r = await fetch(BCRA_API, { cache:'no-store' });
  if (!r.ok) throw new Error(`el BCRA respondió ${r.status}`);
  const d = await r.json();
  const t = { ts:Date.now(), fuente:FUENTE_BCRA };
  for (const v of d.results || []){
    const k = VARIABLES[v.idVariable];
    if (k) t[k] = { tna:+v.ultValorInformado, fecha:v.ultFechaInformada, nombre:String(v.descripcion).trim() };
  }
  if (!t.personales) throw new Error('el BCRA no informó la tasa de préstamos personales');
  try{ sessionStorage.setItem(CLAVE_TASAS, JSON.stringify(t)); }catch{}
  return t;
}

/* ---------- Préstamo: sistema francés ---------- */
export function prestamoFrances(capital, tnaPct, meses){
  const i = tnaPct / 100 / 12;
  const cuota = i ? capital * i / (1 - (1 + i) ** -meses) : capital / meses;
  const total = cuota * meses;
  /* TEA equivalente, para comparar con otras ofertas */
  const tea = ((1 + i) ** 12 - 1) * 100;
  return { capital, tna:tnaPct, meses, cuota, total, intereses:total - capital, tea };
}

/**
 * Opciones para "quiero comprar y no tengo el dinero".
 *  costoARS: lo que sale la compra puesta en Argentina
 *  capitalCliente: lo que pone el cliente
 *  ventaARS: lo que espera vender todo (opcional)
 *  meses: plazo que quiere
 */
export function opcionesFinanciacion({ costoARS, capitalCliente = 0, ventaARS = 0, meses = 12, tasas }){
  const falta = Math.max(0, costoARS - capitalCliente);
  const tnaBanco = tasas?.personales?.tna ?? null;
  const tnaFondeo = tasas?.plazoFijo?.tna ?? null;
  const ganancia = ventaARS ? ventaARS - costoARS : null;

  const prestamo = tnaBanco != null && falta > 0 ? prestamoFrances(falta, tnaBanco, meses) : null;
  /* Lo que gana NiJu prestando a la tasa del banco: la diferencia contra lo que
     rendiría esa plata en un plazo fijo (su costo de oportunidad). */
  const spreadNiju = prestamo && tnaFondeo != null ? prestamo.intereses - prestamoFrances(falta, tnaFondeo, meses).intereses : null;

  /* Sociedad: cada uno se lleva la ganancia en proporción a lo que pone.
     NiJu cobra además su gestión de compra (se muestra aparte). */
  const parteCliente = costoARS ? Math.min(1, capitalCliente / costoARS) : 0;
  const sociedad = falta > 0 ? {
    aporteNiju:falta, aporteCliente:Math.min(capitalCliente, costoARS),
    pctCliente:parteCliente * 100, pctNiju:(1 - parteCliente) * 100,
    gananciaCliente:ganancia != null ? ganancia * parteCliente : null,
    gananciaNiju:ganancia != null ? ganancia * (1 - parteCliente) : null
  } : null;

  /* Con préstamo, lo que le queda al cliente si vende lo que espera. */
  const netoConPrestamo = ganancia != null && prestamo ? ganancia - prestamo.intereses : null;
  const conviene = ganancia == null ? null
    : !prestamo ? 'propio'
    : netoConPrestamo > (sociedad?.gananciaCliente ?? -Infinity) ? 'prestamo' : 'sociedad';

  return { falta, prestamo, spreadNiju, sociedad, ganancia, netoConPrestamo, conviene, tnaBanco, tnaFondeo };
}

/* ---------- Población (para dimensionar el mercado) ---------- */
export const FUENTE_CENSO = { titulo:'INDEC — Censo 2022, resultados definitivos', url:'https://censo.gob.ar/index.php/datos_definitivos_total_pais/' };
export const POBLACION = {
  'Buenos Aires':17523996, 'CABA':3121707, 'Catamarca':429562, 'Chaco':1129606, 'Chubut':603120, 'Córdoba':3840905,
  'Corrientes':1212696, 'Entre Ríos':1425578, 'Formosa':607419, 'Jujuy':811611, 'La Pampa':361859, 'La Rioja':383865,
  'Mendoza':2043540, 'Misiones':1280960, 'Neuquén':710814, 'Río Negro':762067, 'Salta':1440672, 'San Juan':818234,
  'San Luis':540905, 'Santa Cruz':333473, 'Santa Fe':3556522, 'Santiago del Estero':1060906, 'Tierra del Fuego':185732, 'Tucumán':1731820
};

/* ---------- Máquinas en lugares ----------
   Supuestos de NiJu: no hay una fuente pública argentina con estos números.
   Se muestran como "supuesto" y el cliente los cambia con lo que sepa del lugar. */
export const TIPOS_MAQUINA = [
  { id:'snacks',  nombre:'Snacks y bebidas',          busqueda:'gaseosa 500 ml', margen:40, kg:250, rubro:'electro' },
  { id:'cafe',    nombre:'Café y bebidas calientes',  busqueda:'cafe capsulas',  margen:60, kg:60,  rubro:'electro' },
  { id:'higiene', nombre:'Higiene y farmacia',        busqueda:'toallitas',      margen:45, kg:200, rubro:'electro' },
  { id:'peluche', nombre:'Grúa de peluches',          busqueda:'peluche',        margen:70, kg:120, rubro:'juguetes' },
  { id:'carga',   nombre:'Carga de celulares',        busqueda:'cargador celular', margen:85, kg:40, rubro:'electro' },
  { id:'otra',    nombre:'Otra máquina',              busqueda:'',               margen:40, kg:150, rubro:'_default' }
];
export const TIPO_MAQUINA_BY_ID = Object.fromEntries(TIPOS_MAQUINA.map(t => [t.id, t]));

/* Compras por día cada 100 personas que pasan (supuesto por tipo de lugar). */
export const LUGARES = [
  { id:'escuela',     nombre:'Escuela o colegio',   compran:3 },
  { id:'universidad', nombre:'Universidad',         compran:4 },
  { id:'hospital',    nombre:'Hospital o clínica',  compran:5 },
  { id:'fabrica',     nombre:'Fábrica o depósito',  compran:6 },
  { id:'oficina',     nombre:'Oficinas',            compran:4 },
  { id:'club',        nombre:'Club o gimnasio',     compran:5 },
  { id:'estacion',    nombre:'Estación o terminal', compran:2 },
  { id:'comercio',    nombre:'Shopping o comercio', compran:1.5 },
  { id:'otro',        nombre:'Otro lugar',          compran:3 }
];
export const LUGAR_BY_ID = Object.fromEntries(LUGARES.map(l => [l.id, l]));

export const MODELOS_MAQUINA = [
  { id:'compra',   nombre:'Compro las máquinas y las opero', desc:'Las máquinas son tuyas. NiJu las trae, las instala y te cobra la gestión.' },
  { id:'comodato', nombre:'Tengo el lugar: que NiJu ponga la máquina', desc:'NiJu pone y opera la máquina. Vos cobrás un porcentaje de lo que vende, sin poner plata.' },
  { id:'sociedad', nombre:'En sociedad con NiJu', desc:'Ponen capital los dos y la ganancia se reparte según lo que puso cada uno.' }
];

/** Costo de una máquina puesta en Argentina, desde su precio afuera (US$). */
export function costoMaquinaImportada({ precioUSD, cantidad = 1, tipo }){
  const T = TIPO_MAQUINA_BY_ID[tipo] || TIPO_MAQUINA_BY_ID.otra;
  const pesoKg = T.kg * cantidad;
  const flete = referencia('fleteChinaCarga', { pesoKg });
  const g = calcularImportacion({ valorUSD:precioUSD * cantidad, fleteUSD:flete?.valor || 0, pesoKg, rubro:T.rubro, unidades:cantidad, regimen:'general', destino:'reventa' });
  return { totalUSD:g.total, recuperableUSD:g.recuperable, costoRealUSD:g.costoReal, fleteUSD:flete?.valor || 0, fleteFuente:flete?.fuente, pesoKg,
    porMaquinaARS:g.costoReal / cantidad * FX.oficial, aviso:'Aproximado por rubro: el cálculo exacto con la posición del Arancel se hace en "Traelo por mí".' };
}

/**
 * Estudio de máquinas en lugares.
 * d = { tipo, modelo, lugares:[{ nombre, tipo, personasDia, dias, maquinas }], ticketARS, margenPct,
 *       costoMaquinaARS, canonPct, gastoMensualMaquinaARS, capitalCliente }
 */
export function estudioMaquinas(d){
  const lugares = (d.lugares || []).map(l => {
    const L = LUGAR_BY_ID[l.tipo] || LUGAR_BY_ID.otro;
    const maquinas = Math.max(0, +l.maquinas || 0);
    const ventasDia = (+l.personasDia || 0) * (L.compran / 100);
    const ventasMes = ventasDia * (+l.dias || 22) * (d.ticketARS || 0);
    return { ...l, maquinas, compran:L.compran, ventasDia, ventasMes, ventasMesPorMaquina:maquinas ? ventasMes / maquinas : 0 };
  });
  const maquinas = lugares.reduce((a, l) => a + l.maquinas, 0);
  const ventasMes = lugares.reduce((a, l) => a + l.ventasMes, 0);
  const margenBruto = ventasMes * (d.margenPct || 0) / 100;
  const canon = ventasMes * (d.canonPct || 0) / 100;
  const gastos = maquinas * (d.gastoMensualMaquinaARS || 0);
  const resultadoMes = margenBruto - canon - gastos;
  const inversion = maquinas * (d.costoMaquinaARS || 0);
  const meses = resultadoMes > 0 && inversion ? inversion / resultadoMes : null;

  /* Cómo se reparte según el modelo */
  let cliente, niju;
  if (d.modelo === 'comodato'){
    /* El dueño del lugar no invierte: cobra el canon. NiJu invierte y se queda con el resto. */
    cliente = { invierte:0, ganaMes:canon, recupera:null };
    niju = { invierte:inversion, ganaMes:resultadoMes, recupera:meses };
  } else if (d.modelo === 'sociedad'){
    const pone = Math.min(d.capitalCliente || 0, inversion);
    const pct = inversion ? pone / inversion : 0;
    cliente = { invierte:pone, pct:pct * 100, ganaMes:resultadoMes * pct, recupera:meses };
    niju = { invierte:inversion - pone, pct:(1 - pct) * 100, ganaMes:resultadoMes * (1 - pct), recupera:meses };
  } else {
    cliente = { invierte:inversion, ganaMes:resultadoMes, recupera:meses };
    niju = { invierte:0, ganaMes:null, gestion:true };
  }

  const veredicto = !maquinas || !d.ticketARS ? 'faltan'
    : resultadoMes <= 0 ? 'no'
    : meses != null && meses > 36 ? 'lento'
    : meses != null && meses > 18 ? 'medio' : 'si';

  /* Lugares que no mueven la aguja: menos de la mitad de lo que vende el promedio por máquina. */
  const promedio = maquinas ? ventasMes / maquinas : 0;
  const flojos = lugares.filter(l => l.maquinas && l.ventasMesPorMaquina < promedio * 0.5).map(l => l.nombre || LUGAR_BY_ID[l.tipo]?.nombre);

  return { lugares, maquinas, ventasMes, margenBruto, canon, gastos, resultadoMes, inversion, meses, cliente, niju, veredicto, flojos };
}

/* ---------- Precios reales en Argentina (competencia) ---------- */
export async function preciosEnArgentina(consulta){
  if (!String(consulta || '').trim()) return null;
  const r = await buscar(consulta, { limite:24 });
  const precios = (r.grupos || []).map(g => g.mejor?.costo?.finalARS || g.mejor?.precio).filter(v => v > 0).sort((a, b) => a - b);
  if (!precios.length) return { consulta, cantidad:0 };
  const mitad = precios[Math.floor(precios.length / 2)];
  const tiendas = new Set((r.grupos || []).flatMap(g => (g.ofertas || [g.mejor]).map(o => o?.tiendaId)).filter(Boolean));
  return { consulta, cantidad:precios.length, min:precios[0], mediana:mitad, max:precios.at(-1), tiendas:tiendas.size,
    ejemplos:(r.grupos || []).slice(0, 4).map(g => ({ titulo:g.titulo, ars:g.mejor?.costo?.finalARS || g.mejor?.precio, url:g.mejor?.url })) };
}

/* ---------- Estudio de una idea ---------- */
export const FORMAS_MONTAJE = [
  { id:'online',    nombre:'Venta online',                   desc:'Tienda en redes o en una web, sin local. Menos inversión, más publicidad.' },
  { id:'local',     nombre:'Local a la calle',               desc:'Alquiler, habilitación y personal. Más costo fijo, más confianza del cliente.' },
  { id:'revendedor',nombre:'Red de revendedores',            desc:'Otros venden por vos a comisión. Crecés sin local propio.' },
  { id:'maquinas',  nombre:'Máquinas automáticas',           desc:'Sin personal: la máquina vende sola en lugares con mucha gente.' },
  { id:'mayorista', nombre:'Vender a comercios (por mayor)', desc:'Importás o comprás volumen y abastecés a otros negocios.' },
  { id:'grupal',    nombre:'Compra grupal con otros',        desc:'Se junta la plata de varios para comprar más barato y repartir.' }
];

/**
 * d = { idea, producto, provincia, capitalARS, costoUnidadARS, precioVentaARS, unidadesMes, gastosFijosMes, forma }
 * precios = resultado de preciosEnArgentina()
 */
export function estudioIdea(d, precios){
  const poblacion = POBLACION[d.provincia] || null;
  const margenUnidad = (d.precioVentaARS || 0) - (d.costoUnidadARS || 0);
  const gananciaMes = margenUnidad * (d.unidadesMes || 0) - (d.gastosFijosMes || 0);
  const equilibrio = margenUnidad > 0 ? Math.ceil((d.gastosFijosMes || 0) / margenUnidad) : null;
  const recupero = gananciaMes > 0 && d.capitalARS ? d.capitalARS / gananciaMes : null;

  const avisos = [];
  let competencia = 'sin datos';
  if (precios?.cantidad){
    competencia = precios.tiendas >= 6 ? 'alta' : precios.tiendas >= 3 ? 'media' : 'baja';
    if (d.precioVentaARS && d.precioVentaARS > precios.mediana * 1.15)
      avisos.push(`Tu precio (${Math.round(d.precioVentaARS).toLocaleString('es-AR')}) está más de 15% arriba de lo que se paga hoy en tiendas argentinas (mitad del mercado: $ ${Math.round(precios.mediana).toLocaleString('es-AR')}). Vas a tener que diferenciarte o bajarlo.`);
    if (d.costoUnidadARS && d.costoUnidadARS > precios.mediana)
      avisos.push('Tu costo por unidad ya supera el precio al que venden otros: así como está no conviene. Probá importando en volumen o en compra grupal.');
  } else if (precios){
    avisos.push('No encontramos este producto en las tiendas argentinas que la app lee en vivo: puede ser una oportunidad (nadie lo vende) o que se venda por otros canales. Hay que confirmarlo en Mercado Libre y en la calle.');
  }
  if (margenUnidad <= 0 && d.precioVentaARS) avisos.push('Con esos números perdés plata en cada venta.');

  const veredicto = !d.precioVentaARS || !d.costoUnidadARS || !d.unidadesMes ? 'faltan'
    : gananciaMes <= 0 ? 'no' : recupero != null && recupero > 24 ? 'lento' : 'si';

  /* Formas de montarlo que mejor encajan con la plata y la competencia */
  const sugeridas = [];
  if ((d.capitalARS || 0) < 3e6) sugeridas.push('online', 'revendedor', 'grupal');
  else sugeridas.push('local', 'mayorista');
  /* Mucha competencia: gana el que compra más barato. */
  if (competencia === 'alta') sugeridas.push('grupal', 'mayorista');
  if (veredicto === 'no') sugeridas.push('grupal', 'mayorista');

  return { poblacion, margenUnidad, gananciaMes, equilibrio, recupero, competencia, avisos, veredicto,
    formas:[...new Set(sugeridas)].map(id => FORMAS_MONTAJE.find(f => f.id === id)).filter(Boolean) };
}

/* ---------- IA gratuita por el servidor ---------- */
export async function pedirIA(accion, datos){
  if (!CONFIG.iaNegocio) return { ok:false, sinClave:true, error:'La IA está apagada en la app.' };
  try{
    const r = await fetch(CONFIG.api + '/negocio/ia', { method:'POST', cache:'no-store',
      headers:{ 'content-type':'application/json' }, body:JSON.stringify({ accion, ...datos }) });
    if (r.status === 404) return { ok:false, sinClave:true, error:'Falta actualizar el servidor de NiJu para usar la IA.' };
    return await r.json();
  }catch{
    return { ok:false, error:'No pudimos hablar con el servidor de NiJu.' };
  }
}

/* ---------- Achicar una foto antes de guardarla o mandarla ---------- */
export function achicarFoto(archivo, lado = 900, calidad = 0.8){
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new Error('No pudimos leer la foto.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new Error('El archivo no es una foto.'));
      img.onload = () => {
        const k = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
