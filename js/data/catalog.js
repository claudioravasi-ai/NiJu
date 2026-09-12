/* ============================================================
   NiJu — Rubros + catálogo semilla de productos
   El catálogo semilla es el "conocimiento de producto": el mismo
   ítem que después cada conector devuelve con su precio propio.
   Esto es lo que permite comparar peras con peras.
   ============================================================ */

export const RUBROS = [
  { id:'tecnologia',   nombre:'Tecnología',       emo:'💻', busqueda:'notebook', color:'#00E5FF' },
  { id:'celulares',    nombre:'Celulares',        emo:'📱', busqueda:'celular', color:'#7C5CFF' },
  { id:'electro',      nombre:'Electrodomésticos',emo:'🔌', busqueda:'heladera', color:'#FF7A1A' },
  { id:'hogar',        nombre:'Hogar y Muebles',  emo:'🛋️', busqueda:'sillon', color:'#FFB800' },
  { id:'super',        nombre:'Supermercado',     emo:'🛒', busqueda:'aceite', color:'#2EE6A8' },
  { id:'moda',         nombre:'Moda',             emo:'👟', busqueda:'remera', color:'#FF2E88' },
  { id:'belleza',      nombre:'Belleza',          emo:'💄', busqueda:'perfume', color:'#FF6EC7' },
  { id:'deportes',     nombre:'Deportes',         emo:'⚽', busqueda:'zapatillas', color:'#4CD964' },
  { id:'herramientas', nombre:'Herramientas',     emo:'🔧', busqueda:'taladro', color:'#FFD400' },
  { id:'construccion', nombre:'Construcción',     emo:'🧱', busqueda:'pintura', color:'#C97B3C' },
  { id:'gaming',       nombre:'Gaming',           emo:'🎮', busqueda:'joystick', color:'#A56BFF' },
  { id:'juguetes',     nombre:'Juguetes',         emo:'🧸', busqueda:'juguete', color:'#FF9EC4' },
  { id:'bebes',        nombre:'Bebés',            emo:'🍼', busqueda:'pañales', color:'#8ED6FF' },
  { id:'mascotas',     nombre:'Mascotas',         emo:'🐾', busqueda:'alimento perro', color:'#D4FF3D' },
  { id:'salud',        nombre:'Salud',            emo:'🩺', busqueda:'termometro', color:'#5AC8FA' },
  { id:'autos',        nombre:'Autos y Motos',    emo:'🚗', busqueda:'cubierta', color:'#FF453A' },
  { id:'jardin',       nombre:'Jardín',           emo:'🌿', busqueda:'manguera', color:'#34C759' },
  { id:'libros',       nombre:'Libros',           emo:'📚', busqueda:'libro', color:'#BFA980' },
  { id:'mayorista',    nombre:'Por Mayor',        emo:'📦', busqueda:'mayorista', color:'#FF7A1A' }
];
export const RUBRO_BY_ID = Object.fromEntries(RUBROS.map(r => [r.id, r]));

/* usd = precio de referencia minorista internacional (sin envío ni impuestos)
   kg  = peso volumétrico estimado para calcular envío
   dem = demanda relativa 1-10 (ordena el radar de ofertas)            */
export const PRODUCTOS = [
  // --- Celulares
  { id:'p-iph15', n:'iPhone 15 128GB', marca:'Apple', mod:'A3090', rubro:'celulares', emo:'📱', usd:679, kg:0.5, dem:10,
    specs:{ Pantalla:'6.1" OLED', Cámara:'48 MP', Chip:'A16 Bionic', Batería:'3349 mAh' }, tags:['iphone','apple','celular','smartphone'] },
  { id:'p-s24', n:'Samsung Galaxy S24 256GB', marca:'Samsung', mod:'SM-S921', rubro:'celulares', emo:'📱', usd:599, kg:0.5, dem:9,
    specs:{ Pantalla:'6.2" AMOLED 120Hz', Cámara:'50 MP', Chip:'Exynos 2400', Batería:'4000 mAh' }, tags:['samsung','galaxy','celular','android'] },
  { id:'p-a55', n:'Samsung Galaxy A55 128GB', marca:'Samsung', mod:'SM-A556', rubro:'celulares', emo:'📱', usd:289, kg:0.5, dem:9,
    specs:{ Pantalla:'6.6" Super AMOLED', Cámara:'50 MP', Batería:'5000 mAh' }, tags:['samsung','galaxy','a55','gama media'] },
  { id:'p-redmi13', n:'Xiaomi Redmi Note 13 256GB', marca:'Xiaomi', mod:'2312DRA50G', rubro:'celulares', emo:'📱', usd:179, kg:0.45, dem:10,
    specs:{ Pantalla:'6.67" AMOLED', Cámara:'108 MP', Batería:'5000 mAh' }, tags:['xiaomi','redmi','celular','barato'] },
  { id:'p-motog', n:'Motorola Moto G84 256GB', marca:'Motorola', mod:'XT2347', rubro:'celulares', emo:'📱', usd:199, kg:0.45, dem:7,
    specs:{ Pantalla:'6.5" pOLED', Cámara:'50 MP', Batería:'5000 mAh' }, tags:['motorola','moto g','celular'] },

  // --- Tecnología
  { id:'p-air13', n:'Notebook Apple MacBook Air 13" M3 8/256', marca:'Apple', mod:'MRXN3', rubro:'tecnologia', emo:'💻', usd:999, kg:1.6, dem:8,
    specs:{ Chip:'Apple M3', RAM:'8 GB', SSD:'256 GB', Pantalla:'13.6" Liquid Retina' }, tags:['macbook','notebook','apple','laptop'] },
  { id:'p-lenovo', n:'Notebook Lenovo IdeaPad 3 i5 16/512', marca:'Lenovo', mod:'15IAU7', rubro:'tecnologia', emo:'💻', usd:459, kg:2.2, dem:8,
    specs:{ CPU:'Intel Core i5-1235U', RAM:'16 GB', SSD:'512 GB', Pantalla:'15.6" FHD' }, tags:['notebook','lenovo','laptop','ideapad'] },
  { id:'p-ipad10', n:'iPad 10ma gen 64GB WiFi', marca:'Apple', mod:'MPQ03', rubro:'tecnologia', emo:'📲', usd:349, kg:0.8, dem:8,
    specs:{ Pantalla:'10.9"', Chip:'A14 Bionic', Almacenamiento:'64 GB' }, tags:['ipad','tablet','apple'] },
  { id:'p-airpods', n:'Apple AirPods Pro 2 USB-C', marca:'Apple', mod:'MTJV3', rubro:'tecnologia', emo:'🎧', usd:189, kg:0.15, dem:10,
    specs:{ Tipo:'In-ear', Cancelación:'Activa', Estuche:'MagSafe USB-C' }, tags:['airpods','auriculares','apple','bluetooth'] },
  { id:'p-sony1000', n:'Auriculares Sony WH-1000XM5', marca:'Sony', mod:'WH1000XM5', rubro:'tecnologia', emo:'🎧', usd:299, kg:0.4, dem:8,
    specs:{ Tipo:'Vincha', Cancelación:'Activa', Batería:'30 h' }, tags:['sony','auriculares','noise cancelling'] },
  { id:'p-watch9', n:'Apple Watch Series 9 45mm GPS', marca:'Apple', mod:'MR9A3', rubro:'tecnologia', emo:'⌚', usd:379, kg:0.3, dem:7,
    specs:{ Caja:'45 mm aluminio', Chip:'S9 SiP' }, tags:['apple watch','smartwatch','reloj'] },
  { id:'p-mibandi', n:'Xiaomi Smart Band 8', marca:'Xiaomi', mod:'M2239B1', rubro:'tecnologia', emo:'⌚', usd:34, kg:0.1, dem:9,
    specs:{ Pantalla:'1.62" AMOLED', Batería:'16 días' }, tags:['xiaomi','smartband','reloj','barato'] },
  { id:'p-ssd1t', n:'SSD Samsung 990 EVO 1TB NVMe', marca:'Samsung', mod:'MZ-V9E1T0', rubro:'tecnologia', emo:'💾', usd:89, kg:0.1, dem:8,
    specs:{ Capacidad:'1 TB', Interfaz:'PCIe 4.0', Lectura:'5000 MB/s' }, tags:['ssd','disco','nvme','samsung'] },
  { id:'p-monitor27', n:'Monitor Samsung 27" 165Hz IPS', marca:'Samsung', mod:'LS27AG320', rubro:'tecnologia', emo:'🖥️', usd:189, kg:5.5, dem:7,
    specs:{ Tamaño:'27"', Resolución:'1920x1080', Refresco:'165 Hz' }, tags:['monitor','gamer','samsung'] },
  { id:'p-impresora', n:'Impresora Epson EcoTank L3250', marca:'Epson', mod:'L3250', rubro:'tecnologia', emo:'🖨️', usd:209, kg:4.2, dem:8,
    specs:{ Tipo:'Multifunción tinta continua', Conexión:'WiFi' }, tags:['impresora','epson','multifuncion'] },

  // --- Gaming
  { id:'p-ps5', n:'PlayStation 5 Slim Digital', marca:'Sony', mod:'CFI-2015B', rubro:'gaming', emo:'🎮', usd:449, kg:4.5, dem:10,
    specs:{ Almacenamiento:'1 TB SSD', Edición:'Digital' }, tags:['ps5','playstation','consola','sony'] },
  { id:'p-switch', n:'Nintendo Switch OLED', marca:'Nintendo', mod:'HEG-001', rubro:'gaming', emo:'🎮', usd:319, kg:1.2, dem:9,
    specs:{ Pantalla:'7" OLED', Almacenamiento:'64 GB' }, tags:['nintendo','switch','consola'] },
  { id:'p-dualsense', n:'Joystick DualSense PS5', marca:'Sony', mod:'CFI-ZCT1W', rubro:'gaming', emo:'🕹️', usd:69, kg:0.4, dem:9,
    specs:{ Conexión:'Bluetooth', Compatibilidad:'PS5 / PC' }, tags:['joystick','control','ps5','dualsense'] },
  { id:'p-rtx4060', n:'Placa de video RTX 4060 8GB', marca:'NVIDIA', mod:'RTX4060', rubro:'gaming', emo:'🎛️', usd:299, kg:1.1, dem:8,
    specs:{ VRAM:'8 GB GDDR6', Interfaz:'PCIe 4.0' }, tags:['rtx','placa de video','gpu','gamer'] },

  // --- Electrodomésticos
  { id:'p-airfryer', n:'Air Fryer 5.5L digital', marca:'Philips', mod:'HD9255', rubro:'electro', emo:'🍟', usd:119, kg:5.8, dem:10,
    specs:{ Capacidad:'5.5 L', Potencia:'1400 W', Control:'Digital' }, tags:['airfryer','freidora de aire','philips','cocina'] },
  { id:'p-cafetera', n:'Cafetera espresso automática', marca:'Oster', mod:'BVSTEM6603', rubro:'electro', emo:'☕', usd:139, kg:6.5, dem:8,
    specs:{ Presión:'15 bar', Vaporizador:'Sí' }, tags:['cafetera','espresso','oster','cafe'] },
  { id:'p-aspiradora', n:'Aspiradora robot con mapeo láser', marca:'Xiaomi', mod:'S10', rubro:'electro', emo:'🤖', usd:229, kg:4.8, dem:9,
    specs:{ Succión:'4000 Pa', Navegación:'LiDAR', Trapeador:'Sí' }, tags:['aspiradora','robot','xiaomi','limpieza'] },
  { id:'p-licuadora', n:'Licuadora de vaso 600W', marca:'Philips', mod:'HR2118', rubro:'electro', emo:'🥤', usd:49, kg:3.2, dem:7,
    specs:{ Potencia:'600 W', Vaso:'2 L vidrio' }, tags:['licuadora','philips','cocina'] },
  { id:'p-microondas', n:'Microondas 23L digital', marca:'BGH', mod:'B223D', rubro:'electro', emo:'📟', usd:129, kg:12, dem:7,
    specs:{ Capacidad:'23 L', Potencia:'800 W' }, tags:['microondas','bgh'] },
  { id:'p-lavarropas', n:'Lavarropas automático 8kg inverter', marca:'Drean', mod:'Next 8.14', rubro:'electro', emo:'🧺', usd:439, kg:62, dem:7,
    specs:{ Carga:'8 kg', Centrifugado:'1400 rpm', Motor:'Inverter' }, tags:['lavarropas','drean','lavado'] },
  { id:'p-heladera', n:'Heladera no frost 340L', marca:'Whirlpool', mod:'WRM39', rubro:'electro', emo:'🧊', usd:749, kg:70, dem:6,
    specs:{ Capacidad:'340 L', Tipo:'No Frost' }, tags:['heladera','whirlpool','no frost'] },
  { id:'p-aire', n:'Aire acondicionado split 3000F inverter', marca:'Surrey', mod:'553GIQ', rubro:'electro', emo:'❄️', usd:529, kg:45, dem:8,
    specs:{ Frigorías:'3000', Tipo:'Frío/Calor Inverter' }, tags:['aire acondicionado','split','inverter'] },
  { id:'p-tv55', n:'Smart TV 55" 4K UHD', marca:'TCL', mod:'55P635', rubro:'electro', emo:'📺', usd:329, kg:14, dem:9,
    specs:{ Tamaño:'55"', Resolución:'4K UHD', Sistema:'Google TV' }, tags:['tv','smart tv','4k','tcl'] },

  // --- Hogar
  { id:'p-colchon', n:'Colchón 2 plazas resortes pocket', marca:'Suavestar', mod:'Pocket 140', rubro:'hogar', emo:'🛏️', usd:289, kg:32, dem:6,
    specs:{ Medida:'140x190', Tipo:'Resortes pocket' }, tags:['colchon','cama','dormitorio'] },
  { id:'p-sillagamer', n:'Silla gamer ergonómica reclinable', marca:'Redragon', mod:'C602', rubro:'hogar', emo:'🪑', usd:159, kg:22, dem:8,
    specs:{ Reclinación:'180°', Apoyabrazos:'4D' }, tags:['silla','gamer','escritorio','ergonomica'] },
  { id:'p-juegosabanas', n:'Juego de sábanas 2 plazas 400 hilos', marca:'Arredo', mod:'400H', rubro:'hogar', emo:'🛌', usd:59, kg:1.6, dem:7,
    specs:{ Hilos:'400', Medida:'2 plazas' }, tags:['sabanas','ropa de cama'] },
  { id:'p-organizador', n:'Set 6 organizadores plásticos apilables', marca:'Colombraro', mod:'ORG6', rubro:'hogar', emo:'🗃️', usd:29, kg:2.4, dem:8,
    specs:{ Piezas:'6', Material:'Polipropileno' }, tags:['organizador','cajas','orden'] },

  // --- Supermercado
  { id:'p-aceite', n:'Aceite de girasol 1.5L', marca:'Natura', mod:'GIR15', rubro:'super', emo:'🫙', usd:3.2, kg:1.5, dem:10,
    specs:{ Contenido:'1.5 L' }, tags:['aceite','almacen','girasol'] },
  { id:'p-yerba', n:'Yerba mate 1kg', marca:'Playadito', mod:'YM1K', rubro:'super', emo:'🧉', usd:4.1, kg:1, dem:10,
    specs:{ Contenido:'1 kg', Tipo:'Con palo' }, tags:['yerba','mate','playadito'] },
  { id:'p-cafe', n:'Café molido 500g', marca:'La Virginia', mod:'CM500', rubro:'super', emo:'☕', usd:5.4, kg:0.5, dem:9,
    specs:{ Contenido:'500 g' }, tags:['cafe','molido','desayuno'] },
  { id:'p-panales', n:'Pañales talle M x60', marca:'Pampers', mod:'PM60', rubro:'bebes', emo:'🧷', usd:19, kg:1.8, dem:9,
    specs:{ Unidades:'60', Talle:'M' }, tags:['pañales','pampers','bebe'] },
  { id:'p-detergente', n:'Detergente concentrado 750ml', marca:'Magistral', mod:'D750', rubro:'super', emo:'🧴', usd:2.9, kg:0.8, dem:9,
    specs:{ Contenido:'750 ml' }, tags:['detergente','limpieza'] },

  // --- Moda
  { id:'p-nikeair', n:'Zapatillas Nike Air Max 90', marca:'Nike', mod:'CN8490', rubro:'moda', emo:'👟', usd:129, kg:1.1, dem:10,
    specs:{ Tipo:'Urbanas', Material:'Cuero/Malla' }, tags:['nike','zapatillas','air max','urbanas'] },
  { id:'p-adistan', n:'Zapatillas adidas Stan Smith', marca:'adidas', mod:'M20324', rubro:'moda', emo:'👟', usd:89, kg:1, dem:9,
    specs:{ Tipo:'Urbanas', Material:'Cuero' }, tags:['adidas','zapatillas','stan smith'] },
  { id:'p-camperap', n:'Campera puffer impermeable unisex', marca:'Montagne', mod:'PUF24', rubro:'moda', emo:'🧥', usd:79, kg:1.2, dem:8,
    specs:{ Relleno:'Sintético', Impermeable:'Sí' }, tags:['campera','puffer','abrigo','invierno'] },
  { id:'p-jean', n:'Jean slim elastizado hombre', marca:'Levi’s', mod:'511', rubro:'moda', emo:'👖', usd:69, kg:0.7, dem:8,
    specs:{ Corte:'Slim 511', Tela:'Denim elastizado' }, tags:['jean','levis','pantalon'] },
  { id:'p-mochila', n:'Mochila antirrobo para notebook 15.6"', marca:'Xiaomi', mod:'BHR4903', rubro:'moda', emo:'🎒', usd:39, kg:0.9, dem:9,
    specs:{ Capacidad:'26 L', USB:'Sí' }, tags:['mochila','notebook','antirrobo'] },

  // --- Belleza / Salud
  { id:'p-secador', n:'Secador de pelo iónico 2200W', marca:'Gama', mod:'IQ2', rubro:'belleza', emo:'💨', usd:69, kg:1.1, dem:8,
    specs:{ Potencia:'2200 W', Tecnología:'Iónica' }, tags:['secador','pelo','gama'] },
  { id:'p-serum', n:'Sérum facial vitamina C 30ml', marca:'The Ordinary', mod:'VC30', rubro:'belleza', emo:'🧪', usd:14, kg:0.1, dem:9,
    specs:{ Contenido:'30 ml', Activo:'Vitamina C 23%' }, tags:['serum','skincare','vitamina c'] },
  { id:'p-tensiometro', n:'Tensiómetro digital de brazo', marca:'Omron', mod:'HEM-7120', rubro:'salud', emo:'🩺', usd:49, kg:0.5, dem:7,
    specs:{ Tipo:'Automático de brazo', Memoria:'30 registros' }, tags:['tensiometro','presion','omron','salud'] },
  { id:'p-balanza', n:'Balanza digital con bioimpedancia', marca:'Xiaomi', mod:'Body Scale 2', rubro:'salud', emo:'⚖️', usd:29, kg:2, dem:8,
    specs:{ Máximo:'150 kg', App:'Mi Fit' }, tags:['balanza','peso','xiaomi'] },

  // --- Deportes
  { id:'p-bici', n:'Bicicleta MTB rodado 29 21v', marca:'Venzo', mod:'Raptor', rubro:'deportes', emo:'🚲', usd:339, kg:16, dem:7,
    specs:{ Rodado:'29"', Cambios:'21', Frenos:'Disco' }, tags:['bicicleta','mtb','rodado 29'] },
  { id:'p-mancuernas', n:'Set mancuernas ajustables 20kg', marca:'Sportex', mod:'ADJ20', rubro:'deportes', emo:'🏋️', usd:99, kg:21, dem:8,
    specs:{ Peso:'2x10 kg', Tipo:'Ajustable' }, tags:['mancuernas','pesas','gimnasio'] },
  { id:'p-cinta', n:'Cinta de correr plegable 2.5HP', marca:'Randers', mod:'ARG-455', rubro:'deportes', emo:'🏃', usd:549, kg:58, dem:6,
    specs:{ Motor:'2.5 HP', Velocidad:'16 km/h' }, tags:['cinta','correr','fitness'] },

  // --- Herramientas / Construcción
  { id:'p-taladro', n:'Taladro percutor inalámbrico 20V', marca:'Black+Decker', mod:'BDCDD12', rubro:'herramientas', emo:'🔩', usd:79, kg:2.1, dem:9,
    specs:{ Voltaje:'20 V', Baterías:'2 Li-ion' }, tags:['taladro','black decker','inalambrico'] },
  { id:'p-amoladora', n:'Amoladora angular 4.5" 820W', marca:'Bosch', mod:'GWS 850', rubro:'herramientas', emo:'⚙️', usd:69, kg:2.4, dem:8,
    specs:{ Potencia:'820 W', Disco:'115 mm' }, tags:['amoladora','bosch','herramienta'] },
  { id:'p-sethta', n:'Set de herramientas 150 piezas', marca:'Stanley', mod:'STMT150', rubro:'herramientas', emo:'🧰', usd:89, kg:6.5, dem:8,
    specs:{ Piezas:'150', Estuche:'Rígido' }, tags:['herramientas','set','stanley','caja'] },
  { id:'p-hidro', n:'Hidrolavadora 1500W 120 bar', marca:'Karcher', mod:'K3', rubro:'herramientas', emo:'💦', usd:149, kg:6, dem:8,
    specs:{ Presión:'120 bar', Potencia:'1500 W' }, tags:['hidrolavadora','karcher','limpieza'] },
  { id:'p-pinturaltx', n:'Pintura látex interior 20L', marca:'Alba', mod:'ALB20', rubro:'construccion', emo:'🎨', usd:79, kg:25, dem:7,
    specs:{ Contenido:'20 L', Uso:'Interior' }, tags:['pintura','latex','alba','obra'] },

  // --- Autos / Mascotas / Juguetes / Jardín / Libros
  { id:'p-cubiertas', n:'Cubierta 185/65 R15', marca:'Fate', mod:'Prisma HP', rubro:'autos', emo:'🛞', usd:99, kg:9, dem:7,
    specs:{ Medida:'185/65 R15' }, tags:['cubierta','neumatico','auto'] },
  { id:'p-dashcam', n:'Cámara para auto 4K con GPS', marca:'70mai', mod:'A810', rubro:'autos', emo:'📹', usd:129, kg:0.4, dem:8,
    specs:{ Resolución:'4K', GPS:'Integrado' }, tags:['dashcam','camara','auto','70mai'] },
  { id:'p-alimentoperro', n:'Alimento para perro adulto 15kg', marca:'Royal Canin', mod:'MAX15', rubro:'mascotas', emo:'🐕', usd:59, kg:15, dem:9,
    specs:{ Peso:'15 kg', Etapa:'Adulto' }, tags:['alimento','perro','royal canin'] },
  { id:'p-lego', n:'Set de bloques de construcción 1000 piezas', marca:'LEGO', mod:'CL1000', rubro:'juguetes', emo:'🧱', usd:69, kg:1.8, dem:9,
    specs:{ Piezas:'1000', Edad:'6+' }, tags:['lego','bloques','juguete','armar'] },
  { id:'p-dron', n:'Drone con cámara 4K y GPS', marca:'DJI', mod:'Mini 4K', rubro:'juguetes', emo:'🛸', usd:299, kg:0.6, dem:9,
    specs:{ Cámara:'4K', Autonomía:'31 min' }, tags:['drone','dji','camara','volar'] },
  { id:'p-bordeadora', n:'Bordeadora eléctrica 1000W', marca:'Gamma', mod:'G1900', rubro:'jardin', emo:'🌱', usd:69, kg:4.5, dem:7,
    specs:{ Potencia:'1000 W' }, tags:['bordeadora','jardin','pasto'] },
  { id:'p-parrilla', n:'Parrilla portátil a carbón plegable', marca:'Tramontina', mod:'TCH40', rubro:'jardin', emo:'🔥', usd:79, kg:7, dem:8,
    specs:{ Material:'Acero', Tipo:'Portátil' }, tags:['parrilla','asado','carbon'] },
  { id:'p-kindle', n:'Lector de libros electrónicos 6" 16GB', marca:'Amazon', mod:'Kindle 11', rubro:'libros', emo:'📖', usd:109, kg:0.3, dem:8,
    specs:{ Pantalla:'6" e-ink 300ppi', Memoria:'16 GB' }, tags:['kindle','ebook','lector','libro'] }
];

export const PRODUCTO_BY_ID = Object.fromEntries(PRODUCTOS.map(p => [p.id, p]));
