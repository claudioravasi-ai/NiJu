/* ============================================================
   NiJu — El viaje de un paquete, etapa por etapa
   ------------------------------------------------------------
   Un "envío internacional" no es un solo costo. Son cinco etapas,
   cada una la hace alguien distinto, tiene sus trámites y cobra
   lo suyo. Acá están descriptas y, donde la empresa publica su
   tarifa, con el número y el link de donde salió.
   Donde la empresa no publica tarifa, se usa un valor general tomado
   de lo publicado en la web (REFERENCIAS, abajo), con su fuente y el
   sello "Valor de referencia"; lo que cargue el cliente manda.
   Tarifas consultadas el 14-09-2026.
   ============================================================ */

export const ETAPAS = [
  {
    id:'origen', n:1, icono:'tienda',
    titulo:'De la fábrica o tienda al punto de salida',
    quePasa:'El vendedor (una fábrica en China, una tienda en Estados Unidos) prepara el paquete y lo lleva al correo de su país, al depósito del marketplace o a tu casillero en Miami.',
    quien:'El vendedor',
    tramites:['El vendedor emite la factura comercial con el valor de la mercadería (valor FOB).', 'Si usás casillero, el paquete llega a tu dirección en Miami y ahí lo registran.'],
    costo:'Lo que la tienda cobra de envío. Figura en la página del producto; si dice "envío gratis", es cero.',
    campo:'origenUSD'
  },
  {
    id:'internacional', n:2, icono:'mundo',
    titulo:'El viaje: avión o barco',
    quePasa:'El courier, el correo del país de origen o el casillero lo sube a un avión (días) o a un barco (semanas) hasta Argentina.',
    quien:'Courier, correo postal o casillero',
    tramites:['Guía aérea o conocimiento de embarque, con el contenido y el valor declarados.', 'El valor declarado tiene que coincidir con la factura: si no, Aduana lo puede revisar.'],
    costo:'Tarifa del operador, por kilo. Aéreo es rápido y caro; marítimo es lento y barato.',
    campo:'internacionalUSD'
  },
  {
    id:'arribo', n:3, icono:'caja',
    titulo:'Llegada a la Aduana argentina',
    quePasa:'El paquete entra al depósito del courier, al de Correo Argentino o, si es carga general, a un depósito fiscal, y espera que se liberen los trámites.',
    quien:'Courier, Correo Argentino o depósito fiscal',
    tramites:['Courier: registra la declaración simplificada del envío (particular courier) ante ARCA.', 'Correo Argentino: completás la declaración y pagás en el módulo "Envíos Postales Internacionales" de ARCA, con clave fiscal nivel 2 como mínimo.', 'Carga general: la mercadería queda en depósito fiscal hasta el despacho.'],
    costo:'Gestión del courier, tasa de servicio y almacenaje de Correo Argentino o almacenaje del depósito fiscal.',
    campo:'arriboUSD'
  },
  {
    id:'aduana', n:4, icono:'documento',
    titulo:'En la Aduana: impuestos y trámites',
    quePasa:'Se calculan y se pagan los tributos de importación. En compras grandes, un despachante de aduana hace el despacho por vos.',
    quien:'Vos (o NiJu por vos), el courier o el despachante',
    tramites:['Pequeño envío: se declara el valor, se descuenta uno de tus 5 envíos del año y se pagan los tributos.', 'Importación general: necesitás CUIT e inscripción en el Registro de Importadores; el despachante oficializa el despacho, se pagan los tributos y Aduana asigna canal verde, naranja o rojo (sin revisión, revisión de papeles o revisión física).', 'Algunos productos necesitan autorización de otros organismos (por ejemplo ANMAT o INAL); en pequeño envío varias de esas intervenciones están exceptuadas.'],
    costo:'Derecho de importación, tasa de estadística, IVA y percepciones (según el caso), más los honorarios del despachante en la importación general.',
    campo:'despachanteUSD'
  },
  {
    id:'ultima', n:5, icono:'envio',
    titulo:'De la Aduana a tu casa',
    quePasa:'Una vez liberado, el courier, Correo Argentino o un transporte nacional lo lleva hasta tu puerta.',
    quien:'Courier, Correo Argentino o transporte',
    tramites:['Si es por correo, a veces hay que retirarlo en sucursal.', 'Firmás la recepción: revisá el paquete antes.'],
    costo:'Depende de la distancia: no cuesta lo mismo a CABA que a Ushuaia.',
    campo:'ultimaMillaARS'
  }
];

/* ---------- Operadores y lo que publican ----------
   calcular() devuelve solo lo que sale de la tarifa publicada. */
export const OPERADORES = [
  {
    id:'logistika-aereo', miami:true, origen:'eeuu', empresa:'Logistika', servicio:'Aéreo puerta a puerta desde Miami',
    publica:true, url:'https://logistika.us/puerta-a-puerta/', plazo:'7 a 10 días hábiles',
    condiciones:'Tarifa mínima US$ 160 de 1 a 5 libras (2,27 kg) y US$ 66 por cada kilo adicional. 10% de seguro y trámites aduaneros sobre el valor declarado (mínimo US$ 30). Electrónicos y carga de alto valor tienen otra tarifa. El reparto local se cobra en destino.',
    noIncluye:['Impuestos de importación', 'Reparto dentro de Argentina', 'Recargo de electrónicos y alto valor'],
    calcular:({ pesoKg, valorUSD }) => ({
      internacionalUSD: 160 + Math.max(0, Math.ceil(pesoKg - 2.27)) * 66,
      arriboUSD: Math.max(30, valorUSD * 0.10),
      detalleInternacional:`US$ 160 hasta 2,27 kg${pesoKg > 2.27 ? ` + ${Math.ceil(pesoKg - 2.27)} kg × US$ 66` : ''}`,
      detalleArribo:'10% del valor declarado por seguro y trámites (mínimo US$ 30)'
    })
  },
  {
    id:'aerobox-maritimo', miami:true, origen:'eeuu', empresa:'Aerobox', servicio:'Marítimo desde Miami',
    publica:'desde', url:'https://aerobox.com.ar/calculadora-envios/', plazo:null,
    condiciones:'Envío marítimo desde US$ 5,50 por kilo, más US$ 20 de gestión documental por paquete en Miami. Es un precio "desde": el definitivo sale de su calculadora.',
    noIncluye:['El precio final puede ser mayor al "desde"'],
    calcular:({ pesoKg }) => ({
      internacionalUSD: pesoKg * 5.5 + 20, desde:true,
      detalleInternacional:`desde ${pesoKg.toLocaleString('es-AR')} kg × US$ 5,50 + US$ 20 de gestión documental`
    })
  },
  { id:'estacion-miami', miami:true, origen:'eeuu', empresa:'Estación Miami', servicio:'Casillero en Miami', publica:false,
    url:'https://estacionmiami.com.ar/calculadora/', condiciones:'No publica tarifas: hay que registrarse y cotizar en su calculadora.' },
  /* ---------- Desde China (consultado el 14-09-2026) ----------
     origen:'china' las muestra solo cuando el producto viene de China;
     ciudad: dónde tiene oficina o depósito, para ordenar la lista.
     carga:true = sirve también para importación con despachante. */
  { id:'tienda-china', origen:'china', empresa:'La misma tienda', servicio:'AliExpress, Temu o SHEIN lo mandan (Cainiao y Correo Argentino)',
    publica:'desde', url:null, plazo:null,
    condiciones:'Lo despacha la propia tienda con su logística (Cainiao en AliExpress) y lo entrega Correo Argentino. Si la tienda dice "envío gratis", el viaje ya está en el precio; si al pagar te cobra envío, elegí "Tengo una cotización" y cargalo. La tasa del Correo se ve al declarar.',
    calcular:() => ({ internacionalUSD:0, incluyeSeguro:true, detalleInternacional:'incluido en el precio cuando la tienda dice "envío gratis"' }) },
  { id:'delmundo-maritimo', origen:'china', carga:true, ciudad:'shenzhen', empresa:'Del Mundo Courier', servicio:'LowCost Shipping, por barco desde China (oficina en Shenzhen)',
    publica:true, url:'https://delmundocourier.com', plazo:null,
    condiciones:'US$ 9,99 por kilo; desde 300 kg, US$ 5,50 por kilo; más de 500 kg cotizan aparte. Incluye seguro y la recepción y preparación en China, sin cobrar peso volumétrico. No publica el plazo del barco.',
    calcular:({ pesoKg }) => {
      const kg = Math.max(1, pesoKg), t = kg >= 300 ? 5.5 : 9.99;
      return { internacionalUSD:kg * t, incluyeSeguro:true,
        detalleInternacional:`${kg.toLocaleString('es-AR')} kg × US$ ${t.toLocaleString('es-AR')} por barco${kg > 500 ? ' (más de 500 kg cotizan aparte)' : ''}` };
    } },
  { id:'borderbox', origen:'china', ciudad:'yiwu', empresa:'BorderBox', servicio:'Casillero con depósito en Yiwu', publica:false,
    url:'https://www.borderbox.com.ar/calculadora-para-importaciones',
    condiciones:'Tiene depósito en Yiwu (Zhejiang) y consolida envíos, pero no publica la tarifa: se calcula en su web. Mientras tanto usamos la referencia de courier exprés desde China.' },
  { id:'courier-china', origen:'china', empresa:'Courier exprés (DHL, FedEx, UPS)', servicio:'Puerta a puerta desde cualquier ciudad de China', publica:'desde',
    url:'https://www.tonlexing.com/es/air-freight-from-china-to-argentina/', plazo:'3 a 7 días hábiles',
    condiciones:'No publican tarifa fija: cotizan cada envío. Como referencia, el exprés para paquetes chicos se publica entre US$ 12 y 18 por kilo; tomamos el tope.',
    calcular:({ pesoKg }) => ({ internacionalUSD:Math.max(1, pesoKg) * 18,
      detalleInternacional:`${Math.max(1, pesoKg).toLocaleString('es-AR')} kg × US$ 18, tope del rango publicado para exprés` }) },

  { id:'fedex', empresa:'FedEx', servicio:'Courier internacional', publica:false,
    url:'https://www.fedex.com/es-ar/shipping/rates.html', condiciones:'Cotiza cada envío en su web según origen, peso y medidas.' },
  { id:'ups', empresa:'UPS', servicio:'Courier internacional', publica:false,
    url:'https://www.ups.com/ar/es/support/shipping-support/shipping-costs-rates', condiciones:'Cotiza cada envío en su web según origen, peso y medidas.' },
  { id:'correo', empresa:'Correo Argentino', servicio:'Puerta a puerta (llega por correo postal)', publica:false,
    url:'https://www.correoargentino.com.ar/nuevo-regimen-de-importacion-y-exportacion-por-postal',
    condiciones:'Cobra en todos los casos la tasa de servicio y almacenaje. El monto no está publicado en la página del régimen: lo ves al declarar el envío.' },
  { id:'propio', empresa:'Tengo una cotización', servicio:'Cargo los valores que me pasaron', publica:'tuyo', url:null,
    condiciones:'Escribí lo que te cotizó el courier, el casillero o el correo.' }
];

export const OPERADOR_BY_ID = Object.fromEntries(OPERADORES.map(o => [o.id, o]));

/* Despachante: no hay tarifa oficial. Esto es lo único publicado. */
export const DESPACHANTE_REFERENCIA = {
  usd:300,
  texto:'No hay tarifa oficial: cada despachante fija la suya. El CDA sugirió US$ 200 por operación en 2016, en un encuentro nacional los despachantes acordaron US$ 300 (2018) y los estudios publican entre 2% y 5% del valor CIF más gastos. Pedí presupuesto.',
  url:'https://www.cda.org.ar/detalle_noticia.php?id=31149'
};

/* ---------- Valores generales, para no dejar etapas vacías ----------
   Pedido de Claudio (14-09-2026): donde la empresa no publica tarifa,
   poner un valor general tomado de lo publicado en la web. Cada uno
   lleva su fuente y el sello que corresponde; si el cliente escribe
   su cotización, manda la suya. Si no hay dato para ese peso, null. */
const LB = 0.45359237;
const IVA_TCA = 0.21;

/* Aeropuertos Argentina Cargas (TCA), importación "Precio flat": incluye
   el almacenaje hasta el día 7. Precios sin impuestos, vigentes desde el 15-03-2025. */
const TCA_FLAT = [[5, 52.31], [10, 71.14], [20, 103.14], [50, 149.93], [100, 205.82], [200, 279.50],
  [350, 381.16], [500, 526.48], [750, 622.56], [1000, 750.60], [1500, 880.22], [2000, 1019.95],
  [2500, 1155.66], [3000, 1359.42], [4000, 1577.46], [5000, 1916.92], [7000, 2279.29], [10000, 2742.22], [Infinity, 3258.56]];

/* Correo Argentino, Encomienda Clásica: hasta kg → [regional, nacional], en pesos. */
const CORREO_CLASICA = [[1, 19500, 26400], [5, 23100, 32000], [10, 31100, 45200], [15, 38200, 56600], [20, 45100, 65800], [25, 54200, 80900]];

export const REFERENCIAS = {
  origenUSD:{
    sello:'referencia', titulo:'USPS Ground Advantage, precio de mostrador desde el 12-07-2026',
    url:'https://idshipthat.app/shipping-rates/usps-ground-advantage/',
    calcular:({ pesoKg }) => {
      const t = [[1, 12.90], [5, 26.05], [10, 39.45], [20, 69.40]].find(([lb]) => pesoKg <= lb * LB);
      return t && { valor:t[1], detalle:`envío dentro de EE.UU. hasta ${t[0]} lb, zona más lejana (7-8). Si la tienda dice "envío gratis", poné 0` };
    }
  },
  fleteAereo:{
    sello:'referencia', titulo:'MJE Global — flete aéreo EE.UU.-Argentina (agosto 2026)',
    url:'https://mje-global.com/flete-aereo-o-maritimo-entre-argentina-y-estados-unidos-cuando-pagar-mas-es-la-decision-correcta/',
    calcular:({ pesoKg }) => ({ valor:Math.max(1, pesoKg) * 8,
      detalle:`${Math.max(1, pesoKg).toLocaleString('es-AR')} kg × US$ 8: tope del rango publicado de US$ 3 a 8 por kilo, porque las cargas chicas pagan el más alto` })
  },
  /* Desde China: la mayoría de las compras de los clientes. */
  fleteChinaCourier:{
    sello:'referencia', titulo:'Tonlexing — transporte aéreo de China a Argentina (enero 2026)',
    url:'https://www.tonlexing.com/es/air-freight-from-china-to-argentina/',
    calcular:({ pesoKg }) => ({ valor:Math.max(1, pesoKg) * 18,
      detalle:`${Math.max(1, pesoKg).toLocaleString('es-AR')} kg × US$ 18: courier exprés desde China, tope del rango publicado de US$ 12 a 18 por kilo` })
  },
  fleteChinaCarga:{
    sello:'referencia', titulo:'Tonlexing — transporte aéreo de China a Argentina (enero 2026)',
    url:'https://www.tonlexing.com/es/air-freight-from-china-to-argentina/',
    calcular:({ pesoKg }) => {
      const kg = Math.max(1, pesoKg), grande = kg >= 1000;
      return { valor:kg * (grande ? 7.70 : 12),
        detalle: grande ? `${kg.toLocaleString('es-AR')} kg × US$ 7,70: carga aérea desde China, más de 1.000 kg`
          : `${kg.toLocaleString('es-AR')} kg × US$ 12: carga chica desde China; el precio publicado de US$ 7,70 es para más de 1.000 kg. Por barco sale mucho menos` };
    }
  },
  seguroUSD:{
    sello:'referencia', titulo:'ArancelLatam — cómo calcular el valor CIF (julio 2026)',
    url:'https://arancellatam.com/guias/como-calcular-valor-cif',
    calcular:({ fobUSD }) => fobUSD ? { valor:fobUSD * 0.005, detalle:'0,5% del FOB: tope del 0,3 a 0,5% típico en carga general' } : null
  },
  depositoUSD:{
    sello:'publicada', titulo:'Aeropuertos Argentina Cargas (TCA) — régimen de precios de importación',
    url:'https://aeropuertosargentinacargas.com/precios.aspx',
    calcular:({ pesoKg }) => {
      const [hasta, flat] = TCA_FLAT.find(([kg]) => pesoKg <= kg);
      return { valor:flat * (1 + IVA_TCA),
        detalle:`precio fijo de Ezeiza${isFinite(hasta) ? ` hasta ${hasta.toLocaleString('es-AR')} kg` : ''}: US$ ${flat.toLocaleString('es-AR')} + IVA, incluye 7 días; desde el día 8 se cobra por día` };
    }
  },
  despachanteUSD:{
    sello:'referencia', titulo:'Trade News — honorario mínimo acordado por los despachantes',
    url:'https://tradenews.com.ar/honorario-profesional-minimo-sugerido-despachantes-aduana/',
    calcular:({ cifUSD }) => ({ valor:Math.max(300, cifUSD * 0.02),
      detalle:cifUSD * 0.02 > 300 ? '2% del valor CIF, el piso del rango publicado' : 'US$ 300, el mínimo acordado por los despachantes; pedí presupuesto' })
  },
  ultimaMillaARS:{
    sello:'publicada', titulo:'Correo Argentino — Encomienda Clásica',
    url:'https://www.correoargentino.com.ar/servicios/paqueteria/encomienda-correo-clasica',
    calcular:({ pesoKg, provincia }) => {
      const t = CORREO_CLASICA.find(([kg]) => pesoKg <= kg);
      if (!t) return null;
      const regional = /buenos aires|caba|capital/i.test(provincia || '');
      return { valor:regional ? t[1] : t[2], detalle:`Encomienda Clásica hasta ${t[0]} kg, tarifa ${regional ? 'regional' : 'nacional'}, hasta ${provincia}` };
    }
  }
};

/* ---------- Desde dónde sale en China ----------
   Los centros que más usan hoy las apps de compras (consultado el 14-09-2026).
   Ninguna fuente publica un precio por kilo distinto según la ciudad: cambia
   quién despacha desde ahí y por dónde sale, no la referencia de flete. */
export const CIUDADES_CHINA = [
  { id:'guangzhou', nombre:'Guangzhou (Cantón)', quienes:'SHEIN y Temu', salida:'sale en avión, muchas veces con escala en Hong Kong',
    fuente:{ titulo:'The Logistics World — la cadena de suministro de SHEIN', url:'https://thelogisticsworld.com/logistica-comercio-electronico/la-logistica-detras-de-la-cadena-de-suministro-global-de-shein/' } },
  { id:'shenzhen', nombre:'Shenzhen', quienes:'Temu y AliExpress; mucha electrónica', salida:'sale en avión desde Shenzhen o Hong Kong',
    fuente:{ titulo:'SendFromChina — desde dónde envía Temu', url:'https://www.sendfromchina.com/NewsCenter/Where-Does-Temu-Ship-From.html' } },
  { id:'dongguan', nombre:'Dongguan', quienes:'AliExpress (centro de clasificación de Cainiao)', salida:'la mayoría pasa por el eHub de Cainiao en Hong Kong',
    fuente:{ titulo:'Tiger Brokers — la red logística de Cainiao', url:'https://www.itiger.com/news/1129978391' } },
  { id:'yiwu', nombre:'Yiwu', quienes:'AliExpress y Temu: productos chicos y bazar', salida:'se consolida en el centro de Cainiao antes de salir',
    fuente:{ titulo:'Tiger Brokers — la red logística de Cainiao', url:'https://www.itiger.com/news/1129978391' } },
  { id:'hangzhou', nombre:'Hangzhou', quienes:'AliExpress (sede de Alibaba)', salida:'centro de servicios de AliExpress',
    fuente:{ titulo:'Tiger Brokers — la red logística de Cainiao', url:'https://www.itiger.com/news/1129978391' } },
  { id:'hongkong', nombre:'Hong Kong', quienes:'escala de SHEIN y AliExpress hacia el mundo', salida:'aeropuerto de Hong Kong',
    fuente:{ titulo:'Tiger Brokers — la red logística de Cainiao', url:'https://www.itiger.com/news/1129978391' } },
  { id:'shanghai', nombre:'Shanghái', quienes:'carga grande y compras por mayor', salida:'puerto de Yangshan, por barco',
    fuente:{ titulo:'Winsail — guía de puertos de China', url:'https://winsaillogistics.com/china-ports/' } }
];
export const CIUDAD_CHINA_BY_ID = Object.fromEntries(CIUDADES_CHINA.map(c => [c.id, c]));

/* Aplica una referencia: devuelve { valor, detalle, sello, fuente } o null. */
export function referencia(id, datos){
  const R = REFERENCIAS[id];
  const r = R?.calcular(datos);
  return r ? { ...r, sello:R.sello, fuente:{ titulo:R.titulo, url:R.url } } : null;
}
