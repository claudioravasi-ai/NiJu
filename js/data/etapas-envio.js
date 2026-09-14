/* ============================================================
   NiJu — El viaje de un paquete, etapa por etapa
   ------------------------------------------------------------
   Un "envío internacional" no es un solo costo. Son cinco etapas,
   cada una la hace alguien distinto, tiene sus trámites y cobra
   lo suyo. Acá están descriptas y, donde la empresa publica su
   tarifa, con el número y el link de donde salió.
   Regla de la casa: si la empresa no publica la tarifa, NO se
   pone un número. Se dice que falta y se deja cargar la cotización.
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
    id:'logistika-aereo', empresa:'Logistika', servicio:'Aéreo puerta a puerta desde Miami',
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
    id:'aerobox-maritimo', empresa:'Aerobox', servicio:'Marítimo desde Miami',
    publica:'desde', url:'https://aerobox.com.ar/calculadora-envios/', plazo:null,
    condiciones:'Envío marítimo desde US$ 5,50 por kilo, más US$ 20 de gestión documental por paquete en Miami. Es un precio "desde": el definitivo sale de su calculadora.',
    noIncluye:['El precio final puede ser mayor al "desde"'],
    calcular:({ pesoKg }) => ({
      internacionalUSD: pesoKg * 5.5 + 20, desde:true,
      detalleInternacional:`desde ${pesoKg.toLocaleString('es-AR')} kg × US$ 5,50 + US$ 20 de gestión documental`
    })
  },
  { id:'estacion-miami', empresa:'Estación Miami', servicio:'Casillero en Miami', publica:false,
    url:'https://estacionmiami.com.ar/calculadora/', condiciones:'No publica tarifas: hay que registrarse y cotizar en su calculadora.' },
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
  usd:200,
  texto:'Honorario mínimo sugerido por el Centro Despachantes de Aduana por operación. Es una sugerencia de 2016: cada despachante fija el suyo, así que pedí presupuesto.',
  url:'https://www.cda.org.ar/detalle_noticia.php?id=31149'
};
