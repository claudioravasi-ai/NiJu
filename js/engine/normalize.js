/* ============================================================
   NiJu — Normalización y agrupado de productos
   El corazón del comparador: decidir que "iPhone 15 128GB negro"
   de una tienda y "Apple iPhone 15 128 GB Midnight" de otra son
   EL MISMO producto, y por lo tanto sus precios son comparables.
   ============================================================ */

const STOP = new Set([
  'de','la','el','los','las','con','sin','para','por','y','o','a','en','del','al',
  'nuevo','nueva','original','oficial','envio','gratis','cuotas','oferta','promo',
  'liquidacion','importado','garantia','sellado','caja','pack','unidad','uni',
  'the','for','with','and','new','free','shipping','brand','genuine'
]);

export const limpiar = s => (s || '')
  .toLowerCase()
  .replace(/(\d),(\d)/g, '$1.$2')          // "1,5 Lts" → "1.5 lts"
  .replace(/(\d)\s*['\u2019]\s*/g, '$1 ')  // apóstrofes sueltos
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9\s.+"/-]/g,' ')
  .replace(/\s+/g,' ')
  .trim();

export function tokens(s){
  return limpiar(s).split(' ').filter(t => t.length > 1 && !STOP.has(t));
}

/* Atributos que, si difieren, hacen que NO sea el mismo producto.
   Ojo con el castellano comercial: "1,5 Lts", "900 Ml", "500 grs",
   "x6 un". Si esto no se lee bien, el comparador termina poniendo el
   aceite de 1,5 L al lado del de 3 L y anunciando un ahorro que no existe. */
const RX = {
  capacidad: /\b(\d+)\s?(gb|tb|mb)\b/,
  volumen:   /\b(\d+(?:\.\d+)?)\s?(mililitros?|ml|cc|litros?|lts?|l)\b/,
  peso:      /\b(\d+(?:\.\d+)?)\s?(gramos?|grs?|kilos?|kgs?|kg|g)\b/,
  pulgadas:  /\b(\d+(?:\.\d+)?)\s?(?:"|''|pulgadas|inch|in)\b/,
  potencia:  /\b(\d+)\s?(w|hp|v)\b/,
  cantidad:  /\b(?:x\s?(\d+)|(\d+)\s?(?:unidades?|un|u)\b)/
};

/* Todo a una misma unidad, para que "1.5 lts" y "1500 ml" sean lo mismo. */
const A_ML = { ml:1, mililitro:1, mililitros:1, cc:1, l:1000, lt:1000, lts:1000, litro:1000, litros:1000 };
const A_G  = { g:1, gr:1, grs:1, gramo:1, gramos:1, kg:1000, kgs:1000, kilo:1000, kilos:1000 };

export function atributos(texto){
  const t = limpiar(texto);
  const a = {};

  const cap = t.match(RX.capacidad);       if (cap) a.capacidad = cap[1] + cap[2];
  const pul = t.match(RX.pulgadas);        if (pul) a.pulgadas  = pul[1] + '"';
  const pot = t.match(RX.potencia);        if (pot) a.potencia  = pot[1] + pot[2];
  const can = t.match(RX.cantidad);        if (can) a.cantidad  = 'x' + (can[1] || can[2]);

  const vol = t.match(RX.volumen);
  if (vol){ const f = A_ML[vol[2]]; if (f) a.volumen = Math.round(parseFloat(vol[1]) * f) + 'ml'; }

  const pes = t.match(RX.peso);
  if (pes){ const f = A_G[pes[2]]; if (f) a.peso = Math.round(parseFloat(pes[1]) * f) + 'g'; }

  return a;
}

/** Clave de agrupado: marca + modelo/atributos + núcleo del título. */
export function claveProducto({ titulo = '', marca = '', modelo = '' }){
  const a = atributos(titulo);
  const attr = Object.values(a).join('-');
  if (modelo) return limpiar(`${marca}-${modelo}-${attr}`).replace(/\s/g,'-');
  const nucleo = tokens(titulo).slice(0, 4).sort().join('-');
  return limpiar(`${marca}-${nucleo}-${attr}`).replace(/\s/g,'-');
}

/** Similitud entre dos ofertas.
    Jaccard de palabras + refuerzo por marca + castigo fuerte cuando los
    atributos duros difieren + castigo por "palabras que distinguen".
    Esto último es lo que evita que "Aceite de girasol 900 ml Cocinero" y
    "Aceite de oliva 900 ml Cocinero" terminen en la misma fila: comparten
    marca y tamaño, pero girasol NO es oliva. */
const UNIDADES = new Set(['ml','l','lt','lts','g','gr','grs','kg','cc','gb','tb','mb','w','v','hp','cm','mm','mt','mts']);
const esDistintiva = t => t.length >= 4 && !/^\d+$/.test(t) && !UNIDADES.has(t);

export function similitud(a, b){
  const ta = new Set(tokens(a.titulo)), tb = new Set(tokens(b.titulo));
  if (!ta.size || !tb.size) return 0;
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++;
  let s = inter / (ta.size + tb.size - inter);

  if (a.marca && b.marca) s += limpiar(a.marca) === limpiar(b.marca) ? 0.15 : -0.30;

  const aa = atributos(a.titulo), ab = atributos(b.titulo);
  const claves = new Set([...Object.keys(aa), ...Object.keys(ab)]);
  for (const k of claves){
    if (aa[k] && ab[k])      s += aa[k] === ab[k] ? 0.10 : -0.45;
    else if (aa[k] || ab[k]) s -= 0.12;
  }

  // palabras propias de uno que el otro no tiene (variedad, modelo, sabor…)
  let ajenas = 0;
  for (const t of ta) if (!tb.has(t) && esDistintiva(t)) ajenas++;
  for (const t of tb) if (!ta.has(t) && esDistintiva(t)) ajenas++;
  s -= Math.min(0.6, ajenas * 0.25);

  return Math.max(0, Math.min(1, s));
}

const UMBRAL = 0.62;

/** Agrupa ofertas sueltas en clusters de "mismo producto". */
export function agrupar(ofertas){
  const porClave = new Map();
  for (const of of ofertas){
    const k = of.productoId || claveProducto(of);
    if (!porClave.has(k)) porClave.set(k, []);
    porClave.get(k).push(of);
  }

  // Segunda pasada: fusiona claves distintas que en realidad son lo mismo.
  const grupos = [...porClave.entries()].map(([k, v]) => ({ clave:k, ofertas:v }));
  const fusionados = [];
  for (const g of grupos){
    const destino = fusionados.find(f => similitud(f.ofertas[0], g.ofertas[0]) >= UMBRAL);
    if (destino) destino.ofertas.push(...g.ofertas);
    else fusionados.push(g);
  }
  return fusionados;
}

/* Palabras que delatan un ACCESORIO, no el producto en sí.
   Si buscás "notebook" no querés una mochila para notebook, ni una
   funda, ni un cargador. Salvo que las nombres vos en la búsqueda. */
const ACCESORIO = new Set([
  'funda','fundas','mochila','mochilas','maletin','maletines','bolso','bolsos',
  'estuche','estuches','cargador','cargadores','cable','cables','adaptador','adaptadores',
  'soporte','soportes','base','bases','protector','protectores','film','films',
  'vidrio','templado','repuesto','repuestos','accesorio','accesorios','kit','kits',
  'cooler','ventilador','limpiador','limpia','pad','mouse','teclado','apoyo',
  'sticker','calcomania','tapa','carcasa','case','bateria','fuente','cargadora',
  /* los que aparecieron probando con gente de verdad */
  'adhesivo','adhesivos','pegamento','cola','cordon','cordones','plantilla','plantillas',
  'betun','pomada','cepillo','impermeabilizante','desodorante','limpieza','limpiador',
  'organizador','colgante','percha','bolsa','bolsas','etiqueta','etiquetas','porta',
  'toallita','toallitas','spray','aerosol','lubricante','grasa','aceitera'
]);

/* Estas palabras avisan que lo que sigue es el destino, no el producto:
   "mochila PARA notebook", "funda PARA iphone". */
const PREPOS = new Set(['para','compatible','tipo','estilo','apto','apta']);

/** Relevancia de una oferta frente a la consulta del usuario.
    Pesa más la cabeza del título (lo que el producto ES) que la cola
    (para qué sirve), y castiga los accesorios cuando no los pediste. */
export function relevancia(consulta, of){
  const q = tokens(consulta);
  if (!q.length) return 1;

  const tt = tokens(of.titulo);
  const corte = tt.findIndex(t => PREPOS.has(t));
  const cabeza = new Set(corte > 0 ? tt.slice(0, corte) : tt);
  const cola   = new Set(corte > 0 ? tt.slice(corte + 1) : []);
  const otros  = new Set([...tokens(of.marca || ''), ...(of.tags || [])]);

  const coincide = (w, conj) => {
    if (conj.has(w)) return 1;
    for (const x of conj) if (x.length > 3 && (x.startsWith(w) || w.startsWith(x))) return 0.6;
    return 0;
  };

  let puntos = 0;
  for (const w of q){
    const enCabeza = coincide(w, cabeza);
    if (enCabeza){ puntos += enCabeza; continue; }
    const enOtros = coincide(w, otros);
    if (enOtros){ puntos += enOtros * 0.7; continue; }
    puntos += coincide(w, cola) * 0.2;      // aparece solo como destino: vale poco
  }
  let r = puntos / q.length;

  // ¿Es un accesorio que no pediste?
  const pidioAccesorio = q.some(w => ACCESORIO.has(w));
  if (!pidioAccesorio){
    const esAccesorio = [...cabeza].some(t => ACCESORIO.has(t));
    if (esAccesorio) r *= 0.2;
  }
  return Math.max(0, Math.min(1, r));
}
