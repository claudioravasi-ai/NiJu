/* ============================================================
   NiJu — Arancel Integrado de ARCA, leído en vivo
   ------------------------------------------------------------
   ARCA publica todo el Arancel en un ZIP que actualiza a diario
   (serviciosweb.afip.gob.ar/aduana/arancelintegrado). El servidor
   de ARCA responde con CORS abierto, así que el navegador lo baja
   directo, lo descomprime y lo lee: la alícuota que ve el cliente
   es la de ARCA de hoy, no una copia vieja.
   Si ARCA no responde, se pide por el worker (/v1/arancel.zip).

   Diseño oficial del archivo nomenclador (separado por @):
     2 @ posición @ derecho de exportación @ reintegro extrazona
       @ DERECHO DE IMPORTACIÓN EXTRAZONA @ reintegro intrazona
       @ derecho de importación intrazona @ derecho específico mínimo
       @ unidad estadística @ unidad de derecho específico @ texto
   ============================================================ */
import { CONFIG } from '../config.js';
import { NORMAS } from '../data/normas-importacion.js';

let datos = null;        // { fecha, posiciones }
let enCurso = null;

export function cargarArancel(){
  if (datos) return Promise.resolve(datos);
  return enCurso ||= leer().then(d => (datos = d)).finally(() => { enCurso = null; });
}

export const arancelListo = () => datos;

async function leer(){
  const buf = await bajarZip();
  const archivos = listarZip(buf);
  const nom = archivos.find(f => /^nomenclador_\d{8}\.txt$/i.test(f.nombre));
  if (!nom) throw new Error('El archivo de ARCA no trae el nomenclador');
  const texto = new TextDecoder('latin1').decode(await extraer(buf, nom));
  const [, dd, mm, aaaa] = nom.nombre.match(/(\d{2})(\d{2})(\d{4})/);
  return { fecha:`${dd}/${mm}/${aaaa}`, posiciones:parsear(texto) };
}

async function bajarZip(){
  const clave = `${NORMAS.arancel.zip}?dia=${new Date().toISOString().slice(0, 10)}`;
  let cache = null;
  try{
    cache = await caches.open('niju-arancel');
    const hit = await cache.match(clave);
    if (hit) return await hit.arrayBuffer();
  }catch{}

  let buf;
  try{
    const r = await fetch(NORMAS.arancel.zip, { cache:'no-store' });
    if (!r.ok) throw new Error('ARCA respondió ' + r.status);
    buf = await r.arrayBuffer();
  }catch{
    const r = await fetch(`${CONFIG.api}/arancel.zip`);
    if (!r.ok) throw new Error('No pudimos bajar el Arancel Integrado de ARCA. Probá en un rato.');
    buf = await r.arrayBuffer();
  }
  try{
    if (cache){
      for (const k of await cache.keys()) await cache.delete(k);
      await cache.put(clave, new Response(buf.slice(0)));
    }
  }catch{}
  return buf;
}

/* ---- ZIP mínimo: directorio central + deflate del navegador ----
   ARCA lo genera en formato ZIP64 (el directorio central marca 0xFFFFFFFF
   y los valores reales van en el registro final ZIP64 y en el campo
   extra 0x0001 de cada archivo). Verificado contra el ZIP del 14-09-2026. */
const LLENO32 = 0xFFFFFFFF;

function listarZip(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  const u64 = p => Number(dv.getBigUint64(p, true));
  let fin = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--)
    if (dv.getUint32(i, true) === 0x06054b50){ fin = i; break; }
  if (fin < 0) throw new Error('El archivo de ARCA no es un ZIP válido');

  let total = dv.getUint16(fin + 10, true);
  let p = dv.getUint32(fin + 16, true);
  const localizador = fin - 20;
  if ((p === LLENO32 || total === 0xFFFF) && localizador >= 0 && dv.getUint32(localizador, true) === 0x07064b50){
    const z64 = u64(localizador + 8);
    if (dv.getUint32(z64, true) !== 0x06064b50) throw new Error('El ZIP64 de ARCA no tiene el registro final esperado');
    total = u64(z64 + 32);
    p = u64(z64 + 48);
  }

  const lista = [];
  for (let k = total; k > 0; k--){
    if (p + 46 > buf.byteLength || dv.getUint32(p, true) !== 0x02014b50) break;
    const largoNombre = dv.getUint16(p + 28, true), largoExtra = dv.getUint16(p + 30, true);
    let comprimido = dv.getUint32(p + 20, true), original = dv.getUint32(p + 24, true), desde = dv.getUint32(p + 42, true);

    /* Campo extra ZIP64: trae, en este orden, solo los valores marcados como llenos. */
    for (let q = p + 46 + largoNombre, finExtra = q + largoExtra; q + 4 <= finExtra;){
      const id = dv.getUint16(q, true), largo = dv.getUint16(q + 2, true);
      if (id === 0x0001){
        let r = q + 4;
        if (original === LLENO32){ original = u64(r); r += 8; }
        if (comprimido === LLENO32){ comprimido = u64(r); r += 8; }
        if (desde === LLENO32){ desde = u64(r); }
      }
      q += 4 + largo;
    }

    lista.push({ metodo:dv.getUint16(p + 10, true), comprimido, original, desde,
      nombre:new TextDecoder().decode(u8.subarray(p + 46, p + 46 + largoNombre)) });
    p += 46 + largoNombre + largoExtra + dv.getUint16(p + 32, true);
  }
  return lista;
}

async function extraer(buf, f){
  const dv = new DataView(buf);
  const inicio = f.desde + 30 + dv.getUint16(f.desde + 26, true) + dv.getUint16(f.desde + 28, true);
  const crudo = new Uint8Array(buf, inicio, f.comprimido);
  if (f.metodo === 0) return crudo;
  if (f.metodo !== 8) throw new Error('Compresión del ZIP no soportada');
  const flujo = new Blob([crudo]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

/* ---- Nomenclador ---- */
const limpiarTexto = s => s.replace(/\s+/g, ' ').replace(/^[\s-]+/, '').trim();
const alicuota = s => (s = s.trim()) ? parseFloat(s) : null;

function parsear(texto){
  const posiciones = [];
  const pila = [];      // ancestros: { digitos, texto }
  for (const linea of texto.split(/\r?\n/)){
    if (!linea.startsWith('2@')) continue;
    const c = linea.split('@');
    if (c.length < 11) continue;
    const codigo = c[1].trim();
    const digitos = codigo.replace(/\D/g, '');
    const desc = limpiarTexto(c.slice(10).join('@'));

    while (pila.length && !(digitos.startsWith(pila.at(-1).digitos) && digitos.length > pila.at(-1).digitos.length)) pila.pop();

    const die = alicuota(c[4]);
    /* Los códigos que empiezan con "00" son códigos internos de ARCA (por
       ejemplo "Pequeño envío franquiciado"), no posiciones de productos. */
    if (die !== null && !digitos.startsWith('00')){
      posiciones.push({
        codigo, ncm:codigo.slice(0, 10), die, dii:alicuota(c[6]), texto:desc,
        ruta:pila.map(x => x.texto), buscable:normalizar(pila.map(x => x.texto).join(' ') + ' ' + desc)
      });
    }
    pila.push({ digitos, texto:desc });
  }
  return posiciones;
}

export const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ.]+/g, ' ');

const raiz = t => t.length > 5 ? t.replace(/(es|s)$/, '') : t;

/* Cómo lo escriben las tiendas (en inglés o en rioplatense) → cómo lo dice
   el Arancel. Si una palabra no está acá, se busca tal cual. */
const SINONIMOS = {
  headphones:'auriculares', headphone:'auriculares', earphones:'auriculares', earbuds:'auriculares', headset:'auriculares', airpods:'auriculares',
  speaker:'altavoces', speakers:'altavoces', parlante:'altavoces', parlantes:'altavoces',
  phone:'telefonos', smartphone:'telefonos', cellphone:'telefonos', celular:'telefonos', celulares:'telefonos', iphone:'telefonos',
  laptop:'portatiles', notebook:'portatiles', tablet:'tabletas', ipad:'tabletas',
  smartwatch:'relojes', watch:'relojes', reloj:'relojes',
  charger:'cargadores', cargador:'cargadores', cable:'cables', keyboard:'teclados', monitor:'monitores',
  camera:'camaras', camara:'camaras', printer:'impresoras', impresora:'impresoras', ink:'tintas',
  tv:'television', television:'television', console:'videojuegos', videogame:'videojuegos',
  sneakers:'calzado', sneaker:'calzado', shoes:'calzado', shoe:'calzado', trainers:'calzado', boots:'calzado',
  zapatillas:'calzado', zapatilla:'calzado', zapatos:'calzado', botas:'calzado',
  running:'deporte', deportivas:'deporte', deportiva:'deporte', sport:'deporte', sports:'deporte',
  tshirt:'shirts', remera:'shirts', remeras:'shirts', shirt:'camisas', jacket:'chaquetas', campera:'chaquetas',
  pants:'pantalones', jeans:'pantalones', dress:'vestidos', socks:'calcetines', medias:'calcetines',
  sweater:'sueteres', hoodie:'sueteres', buzo:'sueteres',
  bag:'bolsos', handbag:'bolsos', cartera:'bolsos', wallet:'billeteras', backpack:'mochilas',
  sunglasses:'gafas', glasses:'gafas', anteojos:'gafas', lentes:'gafas',
  perfume:'perfumes', lipstick:'labios', makeup:'maquillaje', cream:'cremas', crema:'cremas',
  toy:'juguetes', toys:'juguetes', juguete:'juguetes', doll:'munecas', muneca:'munecas', lego:'juguetes',
  bicycle:'bicicletas', bike:'bicicletas', bici:'bicicletas',
  drill:'taladros', taladro:'taladros', vacuum:'aspiradoras', aspiradora:'aspiradoras',
  mug:'tazas', taza:'tazas', knife:'cuchillos', book:'libros', guitar:'guitarras'
};
const VACIAS = new Set(['para', 'con', 'sin', 'los', 'las', 'del', 'que', 'una', 'uno', 'por', 'the', 'and', 'for', 'with']);

/** Posiciones cuyo código empieza con ese número (con o sin puntos). */
export function porCodigo(codigo){
  if (!datos) return [];
  const d = String(codigo).replace(/\D/g, '');
  if (d.length < 4) return [];
  return datos.posiciones.filter(p => p.codigo.replace(/\D/g, '').startsWith(d));
}

/** Búsqueda por palabras en la descripción oficial (en castellano).
    Cada palabra pesa según lo rara que es en el Arancel: "auriculares"
    aparece en pocas posiciones y decide; "inalámbricos" aparece en muchas
    y apenas suma. Antes se exigía que coincidiera el 60% de las palabras,
    y "auriculares inalámbricos bluetooth" devolvía teléfonos. */
export function buscarPosiciones(consulta, max = 15){
  if (!datos) return [];
  if (/^\s*\d{4}[.\d]*\s*$/.test(consulta)) return porCodigo(consulta).slice(0, max);
  const crudas = normalizar(consulta.replace(/t-shirt/gi, 'tshirt')).split(' ').filter(t => t.length > 1 && !VACIAS.has(t));
  const palabras = [...new Set(crudas.map(t => SINONIMOS[t] || t).filter(t => t.length > 2).map(raiz))];
  if (!palabras.length) return [];

  /* Palabras enteras (con su plural): "auricular" no tiene que encontrar
     "Auricularia", que es un hongo. */
  const juego = s => new Set(s.split(' ').filter(Boolean).map(raiz));
  const indice = datos.posiciones.map(p => ({ p, propio:juego(normalizar(p.texto)), todo:juego(p.buscable) }));

  const total = indice.length;
  const peso = Object.fromEntries(palabras.map(w => {
    const n = indice.reduce((a, x) => a + (x.todo.has(w) ? 1 : 0), 0);
    return [w, n ? Math.log(1 + total / n) : 0];
  }));

  /* La primera palabra suele ser el producto ("auriculares inalámbricos
     bluetooth"): pesa el triple que las que lo describen. */
  const cabeza = palabras[0];
  /* "Viras PARA calzado" o "máquinas DE calzado" no son calzado: cuando la
     palabra aparece como destino, vale mucho menos. Y si está en el título
     de la partida ("CALZADO CON SUELA…"), es lo que el producto ES: suma. */
  const comoDestino = (texto, w) => new RegExp(`\\b(para|de|del)( el| la| los| las)? ${w}`).test(texto);
  const res = [];
  for (const { p, propio, todo } of indice){
    const textoPropio = normalizar(p.texto);
    const partida = normalizar(p.ruta[0] || '');
    let puntos = 0;
    for (const w of palabras){
      if (!peso[w]) continue;
      const factor = w === cabeza ? 3 : 1;
      if (propio.has(w)) puntos += 3 * peso[w] * factor * (comoDestino(textoPropio, w) ? 0.3 : 1);
      else if (todo.has(w)) puntos += peso[w] * factor;
      if (partida && new RegExp(`\\b${w}`).test(partida) && !comoDestino(partida, w)) puntos += 2 * peso[w] * factor;
    }
    if (puntos > 0) res.push({ p, puntos:puntos * (/^las? dem[aá]s/i.test(p.texto) ? 0.9 : 1) });
  }
  /* Como mucho dos aperturas por NCM: si no, diez variantes del mismo
     código tapan las otras posiciones posibles. */
  const porNCM = {};
  return res.sort((a, b) => b.puntos - a.puntos)
    .filter(x => (porNCM[x.p.ncm] = (porNCM[x.p.ncm] || 0) + 1) <= 2)
    .slice(0, max).map(x => x.p);
}

/** Texto completo de la posición, de lo general a lo particular. */
export const descripcionCompleta = p => [...p.ruta, p.texto].filter(Boolean).join(' › ');
