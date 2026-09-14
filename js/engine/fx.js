/* ============================================================
   NiJu — Cotizaciones
   Fuente en vivo: dolarapi.com (API pública con CORS habilitado,
   así que funciona desde el navegador sin backend).
   Si falla, cae a valores de referencia y lo dice en pantalla:
   nunca mostramos un número inventado como si fuera en vivo.
   ============================================================ */

const CACHE_KEY = 'niju.fx.v1';
const TTL_MS = 5 * 60 * 1000;      // el dólar se refresca cada 5 minutos
const REFRESCO_MS = 5 * 60 * 1000;

/* Valores de referencia — solo se usan si no hay red. */
const FALLBACK = {
  oficial:1450, tarjeta:1885, mep:1520, blue:1500, cripto:1530, ccl:1510, mayorista:1420,
  cny:0.1385,   // 1 CNY en USD
  eur:1.08
};

export const FX = {
  ...FALLBACK,
  origen:'referencia',      // 'vivo' | 'cache' | 'referencia'
  actualizado:null
};

export async function cargarCotizaciones(){
  // 1) cache fresco
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw){
      const c = JSON.parse(raw);
      if (Date.now() - c.ts < TTL_MS){ Object.assign(FX, c.d, { origen:'cache', actualizado:c.ts }); return FX; }
    }
  }catch{}

  // 2) en vivo
  try{
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch('https://dolarapi.com/v1/dolares', { signal:ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error('http ' + res.status);
    const arr = await res.json();
    const pick = k => arr.find(x => x.casa === k)?.venta;
    const d = {
      oficial: pick('oficial') || FALLBACK.oficial,
      tarjeta: pick('tarjeta') || FALLBACK.tarjeta,
      mep:     pick('bolsa')   || FALLBACK.mep,
      blue:    pick('blue')    || FALLBACK.blue,
      cripto:  pick('cripto')  || FALLBACK.cripto,
      ccl:     pick('contadoconliqui') || FALLBACK.ccl,
      mayorista: pick('mayorista') || FALLBACK.mayorista,
      cny: FALLBACK.cny, eur: FALLBACK.eur
    };
    Object.assign(FX, d, { origen:'vivo', actualizado:Date.now() });
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts:Date.now(), d }));
  }catch{
    Object.assign(FX, FALLBACK, { origen:'referencia', actualizado:Date.now() });
  }
  return FX;
}

/** Convierte a pesos según el tipo de cambio que corresponda a la operación. */
export function aPesos(monto, moneda = 'USD', via = 'tarjeta'){
  if (moneda === 'ARS') return monto;
  const base = moneda === 'CNY' ? monto * FX.cny
             : moneda === 'EUR' ? monto * FX.eur
             : monto;
  const tc = via === 'oficial' ? FX.oficial
           : via === 'mep'     ? FX.mep
           : via === 'cripto'  ? FX.cripto
           : FX.tarjeta;
  return base * tc;
}

/** Un mismo importe, visto en las dos monedas. */
/* Con qué dólar se MUESTRAN los precios en dólares. Por defecto el
   oficial; el cliente puede elegir otro en el pie de la app.
   El costo de una compra al exterior NO cambia con esta elección: se
   sigue calculando con lo que realmente cuesta pagar afuera. */
export const COTIZACIONES = [
  ['oficial', 'Dólar oficial'], ['tarjeta', 'Dólar tarjeta'], ['mep', 'Dólar MEP'],
  ['ccl', 'Contado con liquidación'], ['blue', 'Dólar blue'], ['cripto', 'Dólar cripto'], ['mayorista', 'Dólar mayorista']
];
const CLAVE_VISTA = 'niju.dolarVista';
let vista = 'oficial';
try{ const v = localStorage.getItem(CLAVE_VISTA); if (COTIZACIONES.some(c => c[0] === v)) vista = v; }catch{}

export const cotizacionVista = () => vista;
export const nombreCotizacion = (id = vista) => (COTIZACIONES.find(c => c[0] === id) || COTIZACIONES[0])[1];
export function usarCotizacion(id){
  if (!COTIZACIONES.some(c => c[0] === id)) return;
  vista = id;
  try{ localStorage.setItem(CLAVE_VISTA, id); }catch{}
  window.dispatchEvent(new Event('niju:dolar'));
}

/** Un mismo importe, visto en las dos monedas. */
export function dual(montoARS, via = vista){
  const tc = FX[via] || FX.oficial;
  return { ars: Math.round(montoARS), usd: Math.round(montoARS / tc * 100) / 100, tc: Math.round(tc) };
}

/* ---- Refresco automático mientras la app está abierta ---- */
const oyentes = new Set();
export function alCambiarFX(fn){ oyentes.add(fn); return () => oyentes.delete(fn); }

let timer = null;
export function iniciarRefrescoFX(){
  if (timer) return;
  const tick = async () => {
    const antes = FX.tarjeta;
    try{ localStorage.removeItem(CACHE_KEY); }catch{}
    await cargarCotizaciones();
    if (FX.tarjeta !== antes) for (const fn of oyentes) fn(FX);
  };
  timer = setInterval(tick, REFRESCO_MS);
  // y cuando el usuario vuelve a la app después de un rato
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - (FX.actualizado || 0) > TTL_MS) tick();
  });
}

export function aUSD(monto, moneda = 'ARS', via = 'tarjeta'){
  if (moneda === 'USD') return monto;
  if (moneda === 'CNY') return monto * FX.cny;
  if (moneda === 'EUR') return monto * FX.eur;
  const tc = via === 'oficial' ? FX.oficial : via === 'mep' ? FX.mep : FX.tarjeta;
  return monto / tc;
}
