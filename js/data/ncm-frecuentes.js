/* ============================================================
   NiJu — Productos frecuentes y su posición NCM
   ------------------------------------------------------------
   Sale de la calculadora de importación que armó Claudio con
   DeepSeek (17-09-2026). Sirve para marcar la NCM AL INSTANTE,
   apenas el cliente elige el producto, mientras baja el Arancel
   Integrado de ARCA. El porcentaje "di" de esta lista NO es la
   fuente: cuando el Arancel carga, el derecho se toma de ahí por
   el código (porCodigo) y reemplaza al de esta lista.
   ============================================================ */
import { normalizar } from '../engine/arancel.js';

export const NCM_FRECUENTES = [
  { nombre:"Auriculares (incl. Bluetooth)", ncm:'8518.30.00', di:20, cat:'Electrónica' },
  { nombre:"Auriculares de casco", ncm:'8518.30.00', di:20, cat:'Electrónica' },
  { nombre:"Parlantes / altavoces", ncm:'8518.21.00', di:20, cat:'Electrónica' },
  { nombre:"Micrófonos", ncm:'8518.10.10', di:20, cat:'Electrónica' },
  { nombre:"Amplificadores de audio", ncm:'8518.40.00', di:20, cat:'Electrónica' },
  { nombre:"Smartphones / celulares", ncm:'8517.13.00', di:0, cat:'Electrónica' },
  { nombre:"Celulares portátiles (otros)", ncm:'8517.14.31', di:0, cat:'Electrónica' },
  { nombre:"Televisores LED / LCD", ncm:'8528.72.00', di:16, cat:'Electrónica' },
  { nombre:"Monitores para PC", ncm:'8528.52.00', di:16, cat:'Electrónica' },
  { nombre:"Cargadores / conversores", ncm:'8504.40.90', di:20, cat:'Electrónica' },
  { nombre:"Cables USB / cargadores", ncm:'8544.42.00', di:20, cat:'Electrónica' },
  { nombre:"Pendrives / memorias USB", ncm:'8523.51.10', di:20, cat:'Electrónica' },
  { nombre:"Discos externos / SSD", ncm:'8471.70.00', di:8, cat:'Informática' },
  { nombre:"Notebooks / laptops", ncm:'8471.30.19', di:8, cat:'Informática' },
  { nombre:"Notebooks < 3.5 kg", ncm:'8471.30.12', di:16, cat:'Informática' },
  { nombre:"Tablets", ncm:'8471.30.19', di:8, cat:'Informática' },
  { nombre:"Teclados", ncm:'8471.60.10', di:20, cat:'Informática' },
  { nombre:"Mouse / ratones", ncm:'8471.60.90', di:20, cat:'Informática' },
  { nombre:"Impresoras", ncm:'8443.32.00', di:16, cat:'Informática' },
  { nombre:"Cámaras digitales", ncm:'8525.80.00', di:16, cat:'Electrónica' },
  { nombre:"Drones con cámara", ncm:'8802.20.00', di:35, cat:'Electrónica' },
  { nombre:"Consolas de videojuegos", ncm:'9504.50.00', di:20, cat:'Electrónica' },
  { nombre:"Smartwatches / relojes inteligentes", ncm:'8517.62.00', di:16, cat:'Electrónica' },
  { nombre:"Cámaras de seguridad / webcams", ncm:'8525.80.00', di:16, cat:'Electrónica' },
  { nombre:"Routers / módems WiFi", ncm:'8517.62.00', di:16, cat:'Electrónica' },
  { nombre:"Parlantes Bluetooth portátiles", ncm:'8518.22.00', di:20, cat:'Electrónica' },
  { nombre:"Remeras de algodón", ncm:'6109.10.00', di:35, cat:'Textil' },
  { nombre:"Remeras de otras fibras", ncm:'6109.90.00', di:35, cat:'Textil' },
  { nombre:"Pantalones de algodón", ncm:'6204.62.00', di:35, cat:'Textil' },
  { nombre:"Pantalones de mezclilla / jeans", ncm:'6203.42.00', di:35, cat:'Textil' },
  { nombre:"Camisas de algodón", ncm:'6205.20.00', di:20, cat:'Textil' },
  { nombre:"Buzos / hoodies de algodón", ncm:'6110.20.00', di:20, cat:'Textil' },
  { nombre:"Camperas / abrigos", ncm:'6201.40.00', di:35, cat:'Textil' },
  { nombre:"Ropa interior", ncm:'6108.21.00', di:20, cat:'Textil' },
  { nombre:"Medias / calcetines", ncm:'6115.95.00', di:20, cat:'Textil' },
  { nombre:"Vestidos de mujer", ncm:'6204.44.00', di:35, cat:'Textil' },
  { nombre:"Faldas", ncm:'6204.52.00', di:35, cat:'Textil' },
  { nombre:"Ropa de bebé", ncm:'6111.20.00', di:20, cat:'Textil' },
  { nombre:"Calzado de cuero", ncm:'6403.99.90', di:35, cat:'Calzado' },
  { nombre:"Zapatillas deportivas", ncm:'6404.11.00', di:35, cat:'Calzado' },
  { nombre:"Calzado de plástico / goma", ncm:'6402.99.90', di:35, cat:'Calzado' },
  { nombre:"Zapatos de vestir", ncm:'6403.59.00', di:35, cat:'Calzado' },
  { nombre:"Botas / botinetas", ncm:'6403.91.00', di:35, cat:'Calzado' },
  { nombre:"Ojotas / sandalias", ncm:'6402.20.00', di:35, cat:'Calzado' },
  { nombre:"Artículos para gimnasia / fitness", ncm:'9506.91.00', di:16, cat:'Deportes' },
  { nombre:"Pelotas inflables", ncm:'9506.62.00', di:20, cat:'Deportes' },
  { nombre:"Bicicletas", ncm:'8712.00.10', di:20, cat:'Deportes' },
  { nombre:"Raquetas de tenis / pádel", ncm:'9506.51.00', di:20, cat:'Deportes' },
  { nombre:"Patines / patinetas", ncm:'9506.70.00', di:20, cat:'Deportes' },
  { nombre:"Café tostado", ncm:'0901.21.00', di:14, cat:'Alimentos' },
  { nombre:"Chocolates / bombones", ncm:'1806.32.00', di:16, cat:'Alimentos' },
  { nombre:"Golosinas / caramelos", ncm:'1704.90.10', di:14, cat:'Alimentos' },
  { nombre:"Yerba mate", ncm:'0903.00.00', di:10, cat:'Alimentos' },
  { nombre:"Aceite de oliva", ncm:'1509.10.00', di:14, cat:'Alimentos' },
  { nombre:"Vinos", ncm:'2204.21.00', di:20, cat:'Alimentos' },
  { nombre:"Cervezas", ncm:'2203.00.00', di:20, cat:'Alimentos' },
  { nombre:"Whisky / bebidas destiladas", ncm:'2208.30.00', di:20, cat:'Alimentos' },
  { nombre:"Artículos de plástico para hogar", ncm:'3924.90.00', di:20, cat:'Hogar' },
  { nombre:"Vajilla de cerámica", ncm:'6912.00.00', di:16, cat:'Hogar' },
  { nombre:"Muebles de madera", ncm:'9403.60.00', di:20, cat:'Hogar' },
  { nombre:"Colchones", ncm:'9404.21.00', di:20, cat:'Hogar' },
  { nombre:"Ventiladores", ncm:'8414.51.00', di:16, cat:'Hogar' },
  { nombre:"Aires acondicionados", ncm:'8415.10.00', di:16, cat:'Hogar' },
  { nombre:"Heladeras / refrigeradores", ncm:'8418.10.00', di:16, cat:'Hogar' },
  { nombre:"Microondas", ncm:'8516.50.00', di:16, cat:'Hogar' },
  { nombre:"Licuadoras / batidoras", ncm:'8509.40.00', di:20, cat:'Hogar' },
  { nombre:"Cafeteras eléctricas", ncm:'8516.71.00', di:20, cat:'Hogar' },
  { nombre:"Aspiradoras", ncm:'8508.11.00', di:16, cat:'Hogar' },
  { nombre:"Juguetes infantiles", ncm:'9503.00.10', di:20, cat:'Juguetes' },
  { nombre:"Muñecas / muñecos", ncm:'9503.00.21', di:20, cat:'Juguetes' },
  { nombre:"Rompecabezas", ncm:'9503.00.60', di:20, cat:'Juguetes' },
  { nombre:"Juegos de mesa", ncm:'9504.90.00', di:20, cat:'Juguetes' },
  { nombre:"Autopartes / carrocería", ncm:'8708.29.90', di:35, cat:'Autopartes' },
  { nombre:"Otras partes de vehículos", ncm:'8708.99.90', di:35, cat:'Autopartes' },
  { nombre:"Neumáticos / cubiertas", ncm:'4011.10.00', di:35, cat:'Autopartes' },
  { nombre:"Baterías para autos", ncm:'8507.10.00', di:20, cat:'Autopartes' },
  { nombre:"Filtros de aceite / aire", ncm:'8421.23.00', di:20, cat:'Autopartes' },
  { nombre:"Bujías", ncm:'8511.10.00', di:20, cat:'Autopartes' },
  { nombre:"Amortiguadores", ncm:'8708.80.00', di:35, cat:'Autopartes' },
  { nombre:"Perfumes", ncm:'3303.00.10', di:14, cat:'Químicos' },
  { nombre:"Cosméticos / maquillaje", ncm:'3304.99.10', di:20, cat:'Químicos' },
  { nombre:"Cremas para la piel", ncm:'3304.99.90', di:20, cat:'Químicos' },
  { nombre:"Shampoo / productos capilares", ncm:'3305.10.00', di:20, cat:'Químicos' },
  { nombre:"Jabones", ncm:'3401.11.00', di:20, cat:'Químicos' },
  { nombre:"Medicamentos", ncm:'3004.90.00', di:0, cat:'Químicos' },
  { nombre:"Vitaminas / suplementos", ncm:'2936.27.00', di:0, cat:'Químicos' },
  { nombre:"Herramientas de mano", ncm:'8205.59.00', di:20, cat:'Herramientas' },
  { nombre:"Taladros / herramientas eléctricas", ncm:'8467.29.00', di:20, cat:'Herramientas' },
  { nombre:"Soldadoras", ncm:'8515.80.00', di:20, cat:'Herramientas' },
  { nombre:"Compresores de aire", ncm:'8414.80.00', di:16, cat:'Herramientas' },
  { nombre:"Máquinas de cortar césped", ncm:'8433.11.00', di:16, cat:'Herramientas' },
  { nombre:"Guitarras", ncm:'9202.90.00', di:20, cat:'Instrumentos' },
  { nombre:"Teclados / pianos digitales", ncm:'9207.10.00', di:20, cat:'Instrumentos' },
  { nombre:"Baterías / sets de percusión", ncm:'9206.00.00', di:20, cat:'Instrumentos' },
  { nombre:"Micrófonos profesionales", ncm:'8518.10.10', di:20, cat:'Instrumentos' },
  { nombre:"Motocicletas", ncm:'8711.20.00', di:20, cat:'Vehículos' },
  { nombre:"Cuatriciclos / ATVs", ncm:'8703.21.00', di:35, cat:'Vehículos' },
  { nombre:"Autos usados", ncm:'8703.23.00', di:35, cat:'Vehículos' },
  { nombre:"Repuestos de motos", ncm:'8714.10.00', di:20, cat:'Vehículos' },
  { nombre:"Libros", ncm:'4901.99.00', di:0, cat:'Papelería' },
  { nombre:"Cuadernos / agendas", ncm:'4820.10.00', di:20, cat:'Papelería' },
  { nombre:"Bolígrafos / lapiceras", ncm:'9608.10.00', di:20, cat:'Papelería' },
  { nombre:"Cartuchos de tinta", ncm:'3215.11.00', di:20, cat:'Papelería' },
  { nombre:"Relojes de pulsera", ncm:'9102.11.00', di:20, cat:'Joyería' },
  { nombre:"Joyas de plata", ncm:'7113.11.00', di:20, cat:'Joyería' },
  { nombre:"Joyas de oro", ncm:'7113.19.00', di:20, cat:'Joyería' },
  { nombre:"Bijouterie / bisutería", ncm:'7117.19.00', di:20, cat:'Joyería' },
  { nombre:"Alimento para mascotas", ncm:'2309.10.00', di:16, cat:'Mascotas' },
  { nombre:"Juguetes para mascotas", ncm:'9503.00.10', di:20, cat:'Mascotas' },
  { nombre:"Camas / accesorios para mascotas", ncm:'6307.90.00', di:20, cat:'Mascotas' },
  { nombre:"Gafas de sol", ncm:'9004.10.00', di:20, cat:'Otros' },
  { nombre:"Mochilas / bolsos", ncm:'4202.92.00', di:35, cat:'Otros' },
  { nombre:"Valijas / equipaje", ncm:'4202.12.00', di:35, cat:'Otros' },
  { nombre:"Paraguas", ncm:'6601.91.00', di:20, cat:'Otros' },
  { nombre:"Encendedores", ncm:'9613.10.00', di:20, cat:'Otros' },
  { nombre:"Artículos de pesca", ncm:'9507.30.00', di:20, cat:'Otros' },
  { nombre:"Artículos de camping", ncm:'6306.40.00', di:20, cat:'Otros' },
  { nombre:"Filtros de agua / purificadores", ncm:'8421.21.00', di:20, cat:'Otros' },
  { nombre:"Paneles solares", ncm:'8541.40.00', di:16, cat:'Otros' },
  { nombre:"Baterías de litio", ncm:'8507.60.00', di:20, cat:'Otros' },
  { nombre:"Impresoras 3D", ncm:'8477.80.00', di:16, cat:'Otros' }
];

/* Palabras que la gente usa y no están en el nombre de la lista */
const SINONIMOS = {
  celular:'smartphones', telefono:'smartphones', iphone:'smartphones', samsung:'smartphones', xiaomi:'smartphones',
  laptop:'notebooks', notebook:'notebooks', macbook:'notebooks', ipad:'tablets', tablet:'tablets',
  audifonos:'auriculares', headphones:'auriculares', earbuds:'auriculares', airpods:'auriculares',
  parlante:'parlantes', speaker:'parlantes', tv:'televisores', smart:'televisores', monitor:'monitores',
  zapatilla:'zapatillas', sneakers:'zapatillas', botin:'zapatillas', remera:'remeras', camiseta:'remeras',
  jean:'jeans', hoodie:'buzos', buzo:'buzos', campera:'camperas', reloj:'relojes', smartwatch:'smartwatches',
  drone:'drones', consola:'consolas', playstation:'consolas', xbox:'consolas', nintendo:'consolas',
  taladro:'taladros', amoladora:'taladros', muñeco:'muñecas', peluche:'juguetes', lego:'juguetes',
  perfume:'perfumes', maquillaje:'cosmeticos', crema:'cremas', mochila:'mochilas', valija:'valijas',
  bici:'bicicletas', bicicleta:'bicicletas', cubierta:'neumaticos', neumatico:'neumaticos', impresora3d:'impresoras 3d',
  cafetera:'cafeteras', licuadora:'licuadoras', aspiradora:'aspiradoras', ventilador:'ventiladores', heladera:'heladeras',
  panel:'paneles', solar:'paneles', bateria:'baterias', mouse:'mouse', teclado:'teclados', camara:'camaras'
};

/** La mejor coincidencia para un título, o null. */
export function sugerirFrecuente(titulo){
  const palabras = normalizar(titulo).split(' ').filter(p => p.length > 2).map(p => SINONIMOS[p] || p);
  if (!palabras.length) return null;
  let mejor = null, puntos = 0;
  for (const item of NCM_FRECUENTES){
    const nombre = normalizar(item.nombre);
    let p = 0;
    palabras.forEach((w, i) => {
      const raiz = w.replace(/(es|s)$/, '');
      if (raiz.length > 2 && nombre.includes(raiz)) p += i === 0 ? 3 : 1;
    });
    if (p > puntos){ puntos = p; mejor = item; }
  }
  return puntos ? mejor : null;
}
