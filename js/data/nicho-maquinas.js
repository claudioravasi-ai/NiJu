/* ============================================================
   NiJu — Nicho: máquinas chicas + insumos para emprendedores
   ------------------------------------------------------------
   El modelo es "maquinita y consumible": la máquina se vende casi
   al costo (es el anzuelo) y el negocio vive del insumo que ese
   cliente compra todos los meses durante años.

   ⚠️ Los precios FOB son VALORES DE REFERENCIA de rangos típicos
   de Alibaba/1688 al mínimo de compra. Hay que reemplazarlos por
   cotizaciones reales antes de comprometer un peso. Están acá para
   que el modelo calcule, no para que les creas.
   ============================================================ */

import { calcularImportacion } from '../engine/taxes.js';

/* Flete de referencia en US$ por kilo.
   · courier  : puerta a puerta, rápido y caro
   · aéreo    : carga consolidada
   · marítimo : LCL consolidado. Se cobra por metro cúbico o por
     tonelada, lo que dé más: para cosas livianas y voluminosas
     puede salir bastante más. */
export const FLETE = { courier: 12, aereo: 5.5, maritimo: 0.45, umbralAereo: 40 };

/* Margen objetivo con el que calculamos el precio sugerido de venta.
   La máquina va con margen flaco a propósito: es el anzuelo. */
export const MARGEN = { maquina: 0.18, consumible: 0.55 };

/**
 * Cada familia = una máquina + sus consumibles.
 * fob    : precio en origen por unidad, al mínimo de compra
 * kg     : peso real por unidad
 * porMes : cuántas unidades consume por mes un cliente activo
 *
 * El precio de venta NO está escrito a mano: lo calcula el modelo a
 * partir del costo real puesto en depósito más el margen objetivo.
 * Así nunca queda un precio inventado que no cierre con el costo.
 */
export const FAMILIAS = [
  {
    id:'sublimacion', nombre:'Sublimación de tazas', emo:'☕',
    publico:'Emprendedores de regalería, souvenirs, personalizados',
    porQue:'Es la puerta de entrada más barata al mundo del personalizado. El que compra una prensa de tazas vuelve por tazas todos los meses.',
    estacional:'Pico en mayo (Día de la Madre en algunos países), junio (Padre), y noviembre–diciembre (Navidad).',
    maquina:{ nombre:'Prensa de tazas 11oz', fob:38, kg:6.5, pvpRef:229000, moq:10 },
    consumibles:[
      { nombre:'Taza sublimable 11oz (blanca)', fob:0.58, kg:0.45, pvpRef:2600, porMes:40 },
      { nombre:'Papel de sublimación A4 x100',  fob:4.2,  kg:0.60, pvpRef:14900, porMes:3 },
      { nombre:'Cinta térmica 10mm x30m',       fob:1.10, kg:0.09, pvpRef:4200,  porMes:2 },
      { nombre:'Tinta de sublimación 100ml',    fob:3.40, kg:0.14, pvpRef:12500, porMes:2 }
    ]
  },
  {
    id:'dtf', nombre:'Estampado DTF', emo:'👕',
    publico:'Talleres de estampado, marcas de indumentaria chicas',
    porQue:'Es la tecnología que está desplazando al vinilo y a la serigrafía. El consumible es liviano, caro y se agota rápido: el mejor perfil que hay para traer por avión.',
    estacional:'Constante, con pico antes de cada temporada de indumentaria.',
    maquina:{ nombre:'Plancha térmica 38x38 cm', fob:88, kg:22, pvpRef:520000, moq:5 },
    consumibles:[
      { nombre:'Film DTF A3 x100 hojas',      fob:23, kg:1.20, pvpRef:78000,  porMes:4 },
      { nombre:'Polvo adhesivo DTF 1 kg',     fob:6.5, kg:1.05, pvpRef:22000, porMes:2 },
      { nombre:'Tinta DTF 1 litro',           fob:15, kg:1.10, pvpRef:49000,  porMes:2 },
      { nombre:'Papel siliconado A3 x100',    fob:5.5, kg:0.80, pvpRef:19000, porMes:2 }
    ]
  },
  {
    id:'vinilo', nombre:'Corte de vinilo', emo:'✂️',
    publico:'Gráficas chicas, cartelería, personalización de autos y vidrieras',
    porQue:'La cortadora dura años y el vinilo se consume por metro. Cliente profesional que no discute precio si tenés stock.',
    estacional:'Constante.',
    maquina:{ nombre:'Plotter de corte 34 cm', fob:125, kg:9, pvpRef:690000, moq:5 },
    consumibles:[
      { nombre:'Vinilo textil termotransferible 25cm x 5m', fob:9.5, kg:0.90, pvpRef:29000, porMes:6 },
      { nombre:'Vinilo adhesivo brillante 30cm x 10m',      fob:11,  kg:1.40, pvpRef:33000, porMes:4 },
      { nombre:'Cuchillas de repuesto x5',                  fob:3.2, kg:0.05, pvpRef:12000, porMes:1 },
      { nombre:'Papel transfer de aplicación 30cm x 10m',   fob:7,   kg:0.95, pvpRef:21000, porMes:3 }
    ]
  },
  {
    id:'resina', nombre:'Resina y moldes de silicona', emo:'💎',
    publico:'Artesanos, bijouterie, deco, souvenirs',
    porQue:'Los moldes pesan poquísimo y valen mucho: perfil ideal para avión. La resina es pesada y conviene comprarla acá.',
    estacional:'Fuerte en fechas de regalo y ferias de artesanos.',
    maquina:{ nombre:'Kit inicial: 12 moldes + herramientas', fob:22, kg:1.6, pvpRef:119000, moq:20 },
    consumibles:[
      { nombre:'Molde de silicona premium (unidad)', fob:2.6, kg:0.13, pvpRef:11500, porMes:5 },
      { nombre:'Pigmentos en polvo x12 colores',     fob:4.8, kg:0.22, pvpRef:17500, porMes:2 },
      { nombre:'Set de apliques y dijes x200',       fob:3.9, kg:0.25, pvpRef:14000, porMes:3 },
      { nombre:'Hoja de pan de oro imitación x100',  fob:2.2, kg:0.06, pvpRef:9500,  porMes:2 }
    ]
  },
  {
    id:'chapas', nombre:'Chapas y pins', emo:'🎖️',
    publico:'Merchandising, eventos, política, bandas, ferias',
    porQue:'Cada evento consume cientos de chapas. El insumo es barato y el cliente compra por volumen.',
    estacional:'Picos en campañas, recitales y fechas escolares.',
    maquina:{ nombre:'Botonera 58 mm con matriz', fob:46, kg:7, pvpRef:289000, moq:10 },
    consumibles:[
      { nombre:'Chapas 58 mm x100 (con mylar)', fob:6.2, kg:0.95, pvpRef:21000, porMes:8 },
      { nombre:'Chapas imán 58 mm x100',        fob:9.8, kg:1.10, pvpRef:31000, porMes:3 },
      { nombre:'Chapas espejo 58 mm x100',      fob:11,  kg:1.30, pvpRef:35000, porMes:2 }
    ]
  },
  {
    id:'laser', nombre:'Grabado láser de escritorio', emo:'🔦',
    publico:'Deco, regalería personalizada, marroquinería, maderas',
    porQue:'Producto de alto valor agregado. El insumo son planchas de madera, acrílico y cuero, que conviene comprar acá: lo que se trae son repuestos y accesorios.',
    estacional:'Pico en fechas de regalo.',
    maquina:{ nombre:'Grabadora láser diodo 5W', fob:115, kg:4.5, pvpRef:640000, moq:5 },
    consumibles:[
      { nombre:'Lentes y protectores de repuesto', fob:4.5, kg:0.08, pvpRef:16000, porMes:1 },
      { nombre:'Planchas de acrílico grabable A4 x20', fob:8, kg:1.6, pvpRef:24000, porMes:3 },
      { nombre:'Cuero sintético grabable 50x100 cm',   fob:5.5, kg:0.55, pvpRef:17500, porMes:3 }
    ]
  }
];

/* ---------- Cálculos del modelo ---------- */

const r2 = n => Math.round(n * 100) / 100;

/** US$ por kilo: decide si el producto viaja por avión o por barco. */
export function valorPorKg(item){ return r2(item.fob / item.kg); }

export function viaSugerida(item){
  const vk = valorPorKg(item);
  if (vk >= FLETE.umbralAereo) return { via:'aereo',  nota:'Alto valor por kilo: conviene avión.' };
  if (vk >= 15)                return { via:'mixto',  nota:'Valor medio: avión si hay urgencia, barco si hay volumen.' };
  return { via:'maritimo', nota:'Pesado y barato: solo por barco consolidado, o comprarlo acá.' };
}

/**
 * Costo real de una unidad puesta en depósito, en dólares.
 * Usa el mismo motor impositivo que el resto de la app (taxes.js),
 * así no hay dos verdades sobre lo que sale importar.
 * Devuelve DOS costos:
 *   total    : todo lo que sale del bolsillo
 *   real     : lo que realmente cuesta si sos Responsable Inscripto,
 *              porque el IVA y las percepciones se recuperan.
 */
export function costoPuesto(item, via = null, rubro = 'herramientas'){
  const v = via || viaSugerida(item).via;
  const tarifa = v === 'aereo' ? FLETE.aereo : v === 'mixto' ? FLETE.aereo : FLETE.maritimo;
  const flete = item.kg * tarifa;

  /* Lote grande: se importa formalmente, no por courier. */
  const lote = 500;
  const imp = calcularImportacion({
    valorUSD: item.fob * lote, fleteUSD: flete * lote,
    pesoKg: item.kg * lote, rubro, unidades: lote, regimen:'general'
  });

  const totalUnit = imp.total / lote;
  const recupUnit = (imp.recuperable || 0) / lote;

  return {
    fob:item.fob, flete:r2(flete), via:v,
    cif:r2(item.fob + flete),
    impuestos:r2(imp.impuestos / lote),
    gestion:r2(imp.gastos / lote),
    total:r2(totalUnit),
    real:r2(totalUnit - recupUnit),
    recuperable:r2(recupUnit)
  };
}

/** Precio de venta sugerido a partir del costo real y el margen objetivo. */
export function precioSugerido(item, tcARS, esMaquina = false){
  const c = costoPuesto(item);
  const costoARS = c.real * tcARS;
  const margen = esMaquina ? MARGEN.maquina : MARGEN.consumible;
  return Math.round(costoARS / (1 - margen) / 100) * 100;
}

/**
 * La cuenta que importa: cuánto deja un cliente a lo largo del tiempo.
 * @param {object} fam familia
 * @param {number} tcARS  dólar al que valuamos el costo
 * @param {number} meses  horizonte
 * @param {number} retencion  % de clientes que siguen comprando cada mes
 */
export function economia(fam, tcARS, meses = 24, retencion = 0.88){
  const cm = costoPuesto(fam.maquina);
  const costoMaqARS = cm.real * tcARS;
  const pvpMaquina  = precioSugerido(fam.maquina, tcARS, true);
  const margenMaquina = pvpMaquina - costoMaqARS;

  let margenMesUno = 0;
  const detalleConsumibles = fam.consumibles.map(c => {
    const cc = costoPuesto(c);
    const costoARS = cc.real * tcARS;
    const pvp = precioSugerido(c, tcARS, false);
    const margenUnit = pvp - costoARS;
    const margenMes = margenUnit * c.porMes;
    margenMesUno += margenMes;
    return {
      ...c, pvp, costoARS:Math.round(costoARS), costoTotalARS:Math.round(cc.total * tcARS),
      margenUnit:Math.round(margenUnit),
      margenPct: Math.round((1 - costoARS / pvp) * 100),
      margenMes: Math.round(margenMes), via: viaSugerida(c), valorKg: valorPorKg(c),
      difRef: c.pvpRef ? Math.round((pvp / c.pvpRef - 1) * 100) : null
    };
  });

  // El cliente se va cayendo mes a mes según la retención
  let vivos = 1, acumulado = 0;
  const serie = [];
  for (let m = 1; m <= meses; m++){
    acumulado += margenMesUno * vivos;
    serie.push({ mes:m, acumulado:Math.round(margenMaquina + acumulado) });
    vivos *= retencion;
  }

  const ltv = Math.round(margenMaquina + acumulado);
  const mesesRecupero = margenMesUno > 0 ? Math.ceil(costoMaqARS / margenMesUno) : null;

  return {
    maquina:{
      costoARS:Math.round(costoMaqARS), costoTotalARS:Math.round(cm.total * tcARS),
      pvp:pvpMaquina, pvpRef:fam.maquina.pvpRef || null,
      margen:Math.round(margenMaquina),
      margenPct: Math.round((1 - costoMaqARS / pvpMaquina) * 100),
      via: viaSugerida(fam.maquina), valorKg: valorPorKg(fam.maquina), costo: cm,
      difRef: fam.maquina.pvpRef ? Math.round((pvpMaquina / fam.maquina.pvpRef - 1) * 100) : null
    },
    consumibles: detalleConsumibles,
    margenMensual: Math.round(margenMesUno),
    ltv, serie, retencion, meses,
    vecesLaMaquina: margenMaquina > 0 ? r2(ltv / margenMaquina) : null,
    mesesRecupero,
    veredicto: margenMesUno > margenMaquina
      ? `El insumo deja más por mes (${Math.round(margenMesUno).toLocaleString('es-AR')}) que toda la venta de la máquina. El modelo funciona: el negocio es la recompra.`
      : `Ojo: acá la máquina deja más que el insumo mensual. O sumás consumibles, o este no es un buen caso de "maquinita y consumible".`
  };
}

/** Inversión y resultado de un lote inicial. */
export function lote(fam, maquinas, tcARS, mesesConsumo = 3){
  const cm = costoPuesto(fam.maquina);
  const e = economia(fam, tcARS);

  const invMaquinasUSD = cm.total * maquinas;          // lo que sale del bolsillo
  let invConsumiblesUSD = 0;
  for (const c of fam.consumibles){
    invConsumiblesUSD += costoPuesto(c).total * c.porMes * maquinas * mesesConsumo;
  }
  const inversionUSD = r2(invMaquinasUSD + invConsumiblesUSD);
  const recuperableUSD = r2(cm.recuperable * maquinas +
    fam.consumibles.reduce((a,c) => a + costoPuesto(c).recuperable * c.porMes * maquinas * mesesConsumo, 0));

  const ventaARS = e.maquina.pvp * maquinas + e.margenMensual * maquinas * mesesConsumo
                 + fam.consumibles.reduce((a,c) => a + 0, 0);
  const costoRealARS = (inversionUSD - recuperableUSD) * tcARS;

  return {
    maquinas, mesesConsumo,
    inversionUSD, inversionARS: Math.round(inversionUSD * tcARS),
    recuperableARS: Math.round(recuperableUSD * tcARS),
    costoRealARS: Math.round(costoRealARS),
    ventaEstimadaARS: Math.round(ventaARS),
    margenARS: Math.round(ventaARS - costoRealARS),
    ltvLote: Math.round(e.ltv * maquinas)
  };
}
