/* ============================================================
   NiJu — Estado global
   Store minimalista con suscripción y persistencia en
   localStorage. En producción, las claves marcadas con `sync`
   se replican a Firestore por usuario.
   ============================================================ */

const KEY = 'niju.state.v1';
const PERSISTIR = ['carrito','favoritos','alertas','usuario','historial','comprasAnio',
                   'nijuExtra','config','hilos','campanias','vistos','pedidos',
                   'pilotos','campaniasGrupales','cotizaciones',
                   'ordenes','ordenesDemanda','lotes'];

const INICIAL = {
  usuario: null,                  // { nombre, email, cuit, direccion, tipo }
  carrito: [],                    // { ofertaId, tiendaId, titulo, precio, moneda, cant, emo }
  favoritos: [],
  alertas: [],                    // { productoId, titulo, objetivo, creada }
  historial: [],                  // últimas búsquedas
  vistos: [],
  comprasAnio: [],                // para el control de franquicia
  nijuExtra: [],                  // productos propios cargados desde el panel
  pedidos: [],                    // "traelo por mí": productos pedidos por link
  ordenes: [],                    // compras asistidas: una orden, varias tiendas
  lotes: [],                      // compras hechas por el dueño en cada tienda (sin base de datos)
  ordenesDemanda: [],             // bolsa de demanda
  pilotos: [],                    // lotes de prueba antes de importar en serio
  cotizaciones: [],               // precios reales que mandaron los proveedores
  campaniasGrupales: [],          // compra grupal y preventa
  hilos: [],                      // conversaciones
  campanias: [],                  // marketing programado
  config: { tipoCambio:'tarjeta', regimen:'courier', provincia:'Buenos Aires', moneda:'auto' }
};

class Store {
  constructor(){
    this.d = { ...INICIAL };
    this.subs = new Set();
    this.cargar();
  }
  cargar(){
    try{
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.d, JSON.parse(raw));
    }catch{}
  }
  guardar(){
    try{
      const out = {};
      for (const k of PERSISTIR) out[k] = this.d[k];
      localStorage.setItem(KEY, JSON.stringify(out));
    }catch{}
  }
  get(k){ return k ? this.d[k] : this.d; }
  set(k, v){ this.d[k] = v; this.guardar(); this.emitir(k); }
  push(k, v){ this.d[k] = [...(this.d[k] || []), v]; this.guardar(); this.emitir(k); }
  quitar(k, fn){ this.d[k] = (this.d[k] || []).filter(x => !fn(x)); this.guardar(); this.emitir(k); }
  sub(fn){ this.subs.add(fn); return () => this.subs.delete(fn); }
  emitir(k){ for (const f of this.subs) f(k, this.d); }
}

export const store = new Store();

/* ---------- Acciones de carrito ---------- */
/* Cada talle es un renglón aparte: dos pares del 40 y uno del 42 son
   dos compras distintas para la tienda. */
const claveLinea = x => x.lineaId || x.ofertaId;

export function agregarAlCarrito(oferta, cant = 1, variante = null){
  const lineaId = oferta.id + (variante ? '#' + (variante.sku || variante.texto) : '');
  const c = [...store.get('carrito')];
  const i = c.findIndex(x => claveLinea(x) === lineaId);
  if (i >= 0) c[i] = { ...c[i], cant:c[i].cant + cant };
  else c.push({
    lineaId, variante,
    ofertaId:oferta.id, tiendaId:oferta.tiendaId, productoId:oferta.productoId,
    titulo:oferta.titulo, precio:oferta.precio, moneda:oferta.moneda, envio:oferta.envio,
    emo:oferta.emo, imagen:oferta.imagen || null, cant, propio:!!oferta.propio, pesoKg:oferta.pesoKg, rubro:oferta.rubro,
    url:oferta.url
  });
  store.set('carrito', c);
}
export function cambiarCant(lineaId, delta){
  const c = store.get('carrito').map(x => claveLinea(x) === lineaId ? { ...x, cant:Math.max(0, x.cant + delta) } : x)
                                .filter(x => x.cant > 0);
  store.set('carrito', c);
}
export const totalItems = () => store.get('carrito').reduce((a,x) => a + x.cant, 0);

export function alternarFavorito(productoId){
  const f = store.get('favoritos');
  store.set('favoritos', f.includes(productoId) ? f.filter(x => x !== productoId) : [...f, productoId]);
}
export const esFavorito = id => store.get('favoritos').includes(id);

export function registrarBusqueda(q){
  if (!q?.trim()) return;
  const h = [q.trim(), ...store.get('historial').filter(x => x !== q.trim())].slice(0, 12);
  store.set('historial', h);
}
