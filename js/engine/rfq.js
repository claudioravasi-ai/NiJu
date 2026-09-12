/* ============================================================
   NiJu — Pedido de cotización (RFQ)
   ------------------------------------------------------------
   Un pedido de cotización mal escrito trae respuestas inútiles:
   "US$ 0,50" sin decir a qué cantidad, cuánto pesa la caja, ni qué
   posición arancelaria tiene. Y sin eso no podés calcular nada.
   Acá se arma el pedido con las nueve preguntas que sí importan.
   ============================================================ */
import { store } from '../state.js';
import { uid } from '../util.js';

/* Lo que hay que preguntar sí o sí, y por qué */
export const PREGUNTAS = [
  { k:'precio',   q:'Precio FOB por escalones (100 / 500 / 1.000 unidades)', porque:'Un precio suelto no sirve: necesitás saber a qué cantidad baja.' },
  { k:'moq',      q:'Mínimo de compra',                                      porque:'Define cuánta plata tenés que poner para arrancar.' },
  { k:'peso',     q:'Peso neto y bruto por unidad',                          porque:'El flete se cobra por kilo. Sin esto no hay cálculo posible.' },
  { k:'caja',     q:'Unidades por caja y medidas de la caja (cm)',           porque:'El marítimo se cobra por metro cúbico: el volumen puede costar más que el peso.' },
  { k:'ncm',      q:'Posición arancelaria (HS code) de 6 dígitos',           porque:'Determina cuánto vas a pagar de derechos de importación.' },
  { k:'lead',     q:'Tiempo de producción desde la seña',                    porque:'Es tu capital inmovilizado. 60 días no es lo mismo que 20.' },
  { k:'pago',     q:'Condiciones de pago',                                   porque:'30/70 contra copia de embarque te protege; 100% adelantado no.' },
  { k:'muestra',  q:'Costo y plazo de una muestra',                          porque:'Nunca compres un contenedor sin haber tocado el producto.' },
  { k:'cert',     q:'Certificaciones y, si es eléctrico, voltaje y ficha',   porque:'Si es 110 V o ficha americana, no lo podés vender acá.' }
];

/** Arma el mensaje en inglés, que es el idioma de Alibaba y 1688. */
export function mensajeIngles(fam, items){
  const lista = items.map((i, n) => `${n + 1}. ${i.nombre}${i.detalle ? ` (${i.detalle})` : ''}`).join('\n');
  return `Hello,

We are an Argentinian importer looking for a long-term supplier for the following items:

${lista}

Please quote FOB with the following details for EACH item:

1. FOB unit price at 100 / 500 / 1,000 units
2. Minimum order quantity (MOQ)
3. Net and gross weight per unit
4. Units per carton and carton dimensions (L x W x H in cm)
5. HS code (6 digits)
6. Production lead time after deposit
7. Payment terms
8. Sample cost and lead time
9. Certifications available${fam?.electrico ? ' — and please confirm voltage (220V) and plug type (Argentina / IRAM type I)' : ''}
10. Port of loading

We also need to know if you can do OEM / private label, and the MOQ for it.

We plan to start with a trial order and grow into monthly repeat orders on consumables.

Thank you,
NiJu — Argentina`;
}

/** Versión en castellano, para proveedores locales o importadores argentinos. */
export function mensajeCastellano(fam, items){
  const lista = items.map((i, n) => `${n + 1}. ${i.nombre}${i.detalle ? ` (${i.detalle})` : ''}`).join('\n');
  return `Hola, buenas.

Somos NiJu, estamos armando una línea de insumos y necesitamos cotización de:

${lista}

De cada ítem necesitamos, por favor:

1. Precio por escalones (100 / 500 / 1.000 unidades)
2. Mínimo de compra
3. Peso neto y bruto por unidad
4. Unidades por bulto y medidas del bulto
5. Posición arancelaria (si son importados)
6. Plazo de entrega
7. Condiciones de pago
8. Si entregan muestra y a qué costo
9. Si emiten factura A

La idea es arrancar con una compra de prueba y pasar a reposición mensual.

Quedamos atentos. Gracias.`;
}

/* ---------------- Cotizaciones recibidas ---------------- */

export function guardarCotizacion(c){
  const nueva = {
    id:'ct-' + uid(), fecha:Date.now(), elegida:false,
    familiaId:c.familiaId || null, item:c.item, proveedor:c.proveedor,
    fob:+c.fob || 0, moq:+c.moq || 0, kg:+c.kg || 0,
    cajaUnidades:+c.cajaUnidades || 0, cajaCm:c.cajaCm || '',
    ncm:c.ncm || '', lead:c.lead || '', pago:c.pago || '',
    muestra:c.muestra || '', notas:c.notas || ''
  };
  store.push('cotizaciones', nueva);
  return nueva;
}

export const cotizaciones = () => store.get('cotizaciones') || [];

export function elegir(id){
  const cs = cotizaciones();
  const elegida = cs.find(c => c.id === id);
  if (!elegida) return;
  store.set('cotizaciones', cs.map(c =>
    c.item === elegida.item ? { ...c, elegida: c.id === id } : c));
}

/** La cotización que manda para un ítem: la elegida, o la más barata. */
export function cotizacionDe(nombreItem){
  const cs = cotizaciones().filter(c => c.item === nombreItem);
  if (!cs.length) return null;
  return cs.find(c => c.elegida) || cs.slice().sort((a,b) => a.fob - b.fob)[0];
}

/**
 * Devuelve la familia con los valores REALES donde haya cotización,
 * y marca cuáles siguen siendo estimaciones mías.
 */
export function familiaConCotizaciones(fam){
  const aplicar = item => {
    const c = cotizacionDe(item.nombre);
    if (!c) return { ...item, cotizado:false };
    return { ...item, fob:c.fob, kg:c.kg || item.kg, moq:c.moq || item.moq,
             cotizado:true, proveedor:c.proveedor, ncm:c.ncm, lead:c.lead };
  };
  return {
    ...fam,
    maquina: aplicar(fam.maquina),
    consumibles: fam.consumibles.map(aplicar)
  };
}

/** Cuánto de la familia ya está cotizado de verdad. */
export function cobertura(fam){
  const items = [fam.maquina, ...fam.consumibles];
  const con = items.filter(i => cotizacionDe(i.nombre)).length;
  return { total:items.length, cotizados:con, pct:Math.round(con / items.length * 100) };
}

/** Compara cotizaciones de un mismo ítem, con el costo por kilo incluido. */
export function comparar(nombreItem){
  return cotizaciones()
    .filter(c => c.item === nombreItem)
    .map(c => ({ ...c, usdPorKg: c.kg ? Math.round(c.fob / c.kg * 100) / 100 : null }))
    .sort((a,b) => a.fob - b.fob);
}
