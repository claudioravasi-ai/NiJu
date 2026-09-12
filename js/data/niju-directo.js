/* ============================================================
   NiJu Directo — catálogo propio (lo que vende NiJu)
   Esto se edita desde el Panel del dueño y en producción vive
   en Firestore (colección `productos_niju`).
   ============================================================ */

export const NIJU_PRODUCTOS = [
  { id:'nj-1', ref:'p-airfryer', n:'Air Fryer 5.5L digital — NiJu Selección', emo:'🍟', rubro:'electro',
    precio:189900, precioTachado:249900, stock:24, envioGratis:true, cuotas:12, destacado:true,
    desc:'Freidora de aire de 5.5 L con panel digital y 8 programas. Garantía NiJu 12 meses, cambio sin vueltas los primeros 30 días.' },
  { id:'nj-2', ref:'p-mibandi', n:'Smart Band 8 — NiJu Selección', emo:'⌚', rubro:'tecnologia',
    precio:54900, precioTachado:69900, stock:80, envioGratis:true, cuotas:6, destacado:true,
    desc:'Pulsera inteligente con AMOLED de 1.62", 16 días de batería y más de 150 modos deportivos.' },
  { id:'nj-3', ref:'p-mochila', n:'Mochila antirrobo 26L con USB', emo:'🎒', rubro:'moda',
    precio:62900, precioTachado:79900, stock:41, envioGratis:true, cuotas:6, destacado:true,
    desc:'Compartimento acolchado para notebook de 15.6", cierre oculto y puerto USB externo.' },
  { id:'nj-4', ref:'p-taladro', n:'Taladro percutor 20V + 2 baterías', emo:'🔩', rubro:'herramientas',
    precio:134900, precioTachado:169900, stock:17, envioGratis:false, cuotas:12, destacado:true,
    desc:'Kit completo con maletín, dos baterías de litio y 30 accesorios.' },
  { id:'nj-5', ref:'p-serum', n:'Sérum facial vitamina C 30 ml', emo:'🧪', rubro:'belleza',
    precio:24900, precioTachado:32900, stock:120, envioGratis:false, cuotas:3, destacado:false,
    desc:'Fórmula al 23% con ácido hialurónico. Apto para todo tipo de piel.' },
  { id:'nj-6', ref:'p-organizador', n:'Set 6 organizadores apilables', emo:'🗃️', rubro:'hogar',
    precio:38900, precioTachado:48900, stock:60, envioGratis:false, cuotas:3, destacado:false,
    desc:'Polipropileno reforzado, apilables, aptos para heladera y placard.' },
  { id:'nj-7', ref:'p-dualsense', n:'Joystick inalámbrico compatible PS5', emo:'🕹️', rubro:'gaming',
    precio:89900, precioTachado:109900, stock:33, envioGratis:true, cuotas:6, destacado:true,
    desc:'Respuesta háptica, batería recargable y conexión Bluetooth con PC y consola.' },
  { id:'nj-8', ref:'p-lego', n:'Bloques de construcción 1000 piezas', emo:'🧱', rubro:'juguetes',
    precio:59900, precioTachado:74900, stock:52, envioGratis:false, cuotas:6, destacado:false,
    desc:'Compatibles con las marcas principales. Incluye base y manual de 12 modelos.' }
];

/* Métodos de entrega ofrecidos por NiJu */
export const ENTREGAS = [
  { id:'domicilio',  nombre:'Envío a domicilio',       desc:'24-72 h en AMBA, 2-6 días al interior.', costo:3900, icon:'🚚' },
  { id:'express',    nombre:'Express mismo día',        desc:'Solo CABA y GBA, pedidos antes de las 13 h.', costo:7900, icon:'⚡' },
  { id:'sucursal',   nombre:'Retiro en punto NiJu',     desc:'Más de 400 puntos de retiro en todo el país.', costo:0, icon:'📍' },
  { id:'correo',     nombre:'Correo Argentino a sucursal', desc:'3-7 días hábiles, el más económico.', costo:2400, icon:'📮' },
  { id:'showroom',   nombre:'Retiro en showroom NiJu',  desc:'Sin costo, con turno previo.', costo:0, icon:'🏬' }
];

/* Métodos de pago */
export const PAGOS = [
  { id:'mp',      nombre:'Mercado Pago',        desc:'Tarjetas, dinero en cuenta y cuotas.', rec:12, icon:'💳' },
  { id:'tarjeta', nombre:'Tarjeta de crédito',  desc:'Hasta 12 cuotas con bancos adheridos.', rec:12, icon:'💳' },
  { id:'debito',  nombre:'Tarjeta de débito',   desc:'Acreditación inmediata.', rec:0, icon:'🏧' },
  { id:'transfer',nombre:'Transferencia bancaria', desc:'10% de descuento por pago directo.', rec:0, desc2:'-10%', icon:'🏦' },
  { id:'efectivo',nombre:'Efectivo / Rapipago', desc:'Pagás en el punto y despachamos al acreditarse.', rec:0, icon:'💵' },
  { id:'cripto',  nombre:'USDT / Cripto',       desc:'Para compras internacionales. Cotización al momento.', rec:0, icon:'🪙' },
  { id:'niju',    nombre:'Cuenta NiJu',         desc:'Saldo y cashback acumulado.', rec:0, icon:'🟠' }
];
