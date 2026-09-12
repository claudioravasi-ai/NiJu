/* ============================================================
   NiJu — Compra asistida: una sola compra, muchas tiendas
   ------------------------------------------------------------
   El cliente arma un carrito con cosas de Coto, de Vea y de La
   Anónima, paga UNA VEZ acá, y nosotros compramos en cada tienda
   a su nombre, juntamos todo y se lo mandamos.

   Por qué es así y no una integración directa: ninguna de esas
   tiendas abre su carrito a un tercero. La única forma legal y
   que funciona de verdad es que NiJu actúe por mandato del
   cliente: compramos por él, con nuestros medios de pago.

   Las tres cosas que hay que resolver sí o sí, y que están acá:
     · el precio puede cambiar entre que paga y que compramos
     · algo puede quedar sin stock
     · el cliente tiene que ver en qué anda su pedido
   ============================================================ */
import { store } from '../state.js';
import { uid } from '../util.js';
import { STORE_BY_ID } from '../data/stores.js';

/** Cuánto puede subir un precio sin tener que volver a preguntarle. */
export const TOLERANCIA = 0.05;

export const ESTADOS = {
  pagada:      { label:'Pagada',            desc:'Recibimos tu pago. Ya salimos a comprar.', color:'var(--accion)' },
  comprando:   { label:'Comprando',         desc:'Estamos comprando en cada tienda.', color:'var(--accion)' },
  consultando: { label:'Necesitamos tu OK', desc:'Algo cambió de precio o no hay stock. Decidí vos.', color:'var(--warn)' },
  consolidando:{ label:'Juntando el pedido',desc:'Ya compramos. Estamos armando un solo envío.', color:'var(--accion)' },
  enviada:     { label:'En camino',         desc:'Salió para tu domicilio.', color:'var(--ok)' },
  entregada:   { label:'Entregada',         desc:'Llegó. Gracias por comprar en NiJu.', color:'var(--ok)' },
  cancelada:   { label:'Cancelada',         desc:'Se anuló y se devolvió el dinero.', color:'var(--bad)' }
};

/**
 * Convierte el carrito en UNA orden con una sublista por tienda.
 * Cada sublista es lo que el operador de NiJu tiene que ir a comprar.
 */
export function crearOrden({ items, totalARS, entrega, pago, comprobante, direccion }){
  const porTienda = {};
  for (const it of items) (porTienda[it.tiendaId] ||= []).push(it);

  const tramos = Object.entries(porTienda).map(([tiendaId, lineas]) => {
    const t = STORE_BY_ID[tiendaId] || {};
    return {
      id: 't-' + uid(), tiendaId, tienda: t.nombre || tiendaId,
      tipo: t.tipo || 'nacional',
      propio: t.tipo === 'propio',
      lineas: lineas.map(l => ({
        ofertaId:l.ofertaId, titulo:l.titulo, cant:l.cant,
        precioAcordado:l.precio, moneda:l.moneda, url:l.url, imagen:l.imagen || null,
        estado:'pendiente', precioReal:null, nota:''
      })),
      estado:'pendiente', comprobante:null, seguimiento:null
    };
  });

  const orden = {
    id: 'OR-' + String(Date.now()).slice(-8),
    creada: Date.now(),
    cliente: {
      nombre: store.get('usuario')?.nombre || 'Cliente',
      email: store.get('usuario')?.email || null,
      cuit: store.get('usuario')?.cuit || null,
      perfilFiscal: store.get('usuario')?.perfilFiscal || 'consumidor_final'
    },
    direccion: direccion || null,
    entrega, pago, totalARS,
    comprobante: comprobante || null,
    tramos, estado:'pagada', historia:[{ ts:Date.now(), estado:'pagada', nota:'Pago acreditado.' }],
    tolerancia: TOLERANCIA
  };

  store.push('ordenes', orden);
  return orden;
}

export const ordenes = () => store.get('ordenes') || [];
export const ordenDe = id => ordenes().find(o => o.id === id);

function guardar(orden){
  store.set('ordenes', ordenes().map(o => o.id === orden.id ? orden : o));
  return orden;
}

/** El operador marca qué pasó con cada renglón al ir a comprarlo. */
export function marcarLinea(ordenId, tramoId, ofertaId, { estado, precioReal, nota }){
  const o = ordenDe(ordenId);
  if (!o) return null;
  for (const tr of o.tramos){
    if (tr.id !== tramoId) continue;
    for (const l of tr.lineas){
      if (l.ofertaId !== ofertaId) continue;
      l.estado = estado || l.estado;
      if (precioReal != null) l.precioReal = precioReal;
      if (nota) l.nota = nota;
    }
    tr.estado = tr.lineas.every(l => l.estado === 'comprado') ? 'comprado'
              : tr.lineas.some(l => l.estado === 'problema') ? 'con-problema'
              : 'pendiente';
  }
  recalcular(o);
  return guardar(o);
}

/** Estado general y diferencias de precio que hay que avisarle al cliente. */
export function recalcular(o){
  const todas = o.tramos.flatMap(t => t.lineas);
  const conProblema = todas.filter(l => l.estado === 'problema');
  const compradas = todas.filter(l => l.estado === 'comprado');

  o.diferencia = compradas.reduce((a, l) =>
    a + ((l.precioReal ?? l.precioAcordado) - l.precioAcordado) * l.cant, 0);
  o.diferenciaPct = o.totalARS ? o.diferencia / o.totalARS : 0;

  o.necesitaOK = conProblema.length > 0 || o.diferenciaPct > o.tolerancia;

  const nuevo = conProblema.length || o.necesitaOK ? 'consultando'
              : compradas.length === todas.length ? 'consolidando'
              : 'comprando';
  if (o.estado !== nuevo && !['enviada','entregada','cancelada'].includes(o.estado)){
    o.estado = nuevo;
    o.historia.push({ ts:Date.now(), estado:nuevo, nota:ESTADOS[nuevo]?.desc || '' });
  }
  return o;
}

export function cambiarEstado(ordenId, estado, nota = ''){
  const o = ordenDe(ordenId);
  if (!o) return null;
  o.estado = estado;
  o.historia.push({ ts:Date.now(), estado, nota: nota || ESTADOS[estado]?.desc || '' });
  return guardar(o);
}

/** La lista de compras del operador: qué comprar, dónde y hasta cuánto. */
export function listaDeCompras(){
  const pendientes = ordenes().filter(o => ['pagada','comprando','consultando'].includes(o.estado));
  const porTienda = {};
  for (const o of pendientes){
    for (const tr of o.tramos){
      if (tr.estado === 'comprado' || tr.propio) continue;
      (porTienda[tr.tiendaId] ||= { tiendaId:tr.tiendaId, tienda:tr.tienda, renglones:[] });
      for (const l of tr.lineas){
        if (l.estado === 'comprado') continue;
        porTienda[tr.tiendaId].renglones.push({ ...l, ordenId:o.id, tramoId:tr.id, cliente:o.cliente.nombre });
      }
    }
  }
  return Object.values(porTienda).map(t => ({
    ...t,
    unidades: t.renglones.reduce((a,r) => a + r.cant, 0),
    aPagar: t.renglones.reduce((a,r) => a + r.precioAcordado * r.cant, 0)
  })).sort((a,b) => b.aPagar - a.aPagar);
}

/** Lo que gana NiJu con la orden, ya descontado lo que paga en cada tienda. */
export function resultado(o){
  const mercaderia = o.tramos.flatMap(t => t.lineas)
    .reduce((a,l) => a + (l.precioReal ?? l.precioAcordado) * l.cant, 0);
  /* El envío que le cobramos al cliente también nos cuesta a nosotros:
     contarlo como ganancia sería engañarnos solos. */
  const envio = o.entrega?.costo ?? o.costoEnvio ?? 0;
  const costo = mercaderia + envio;
  return {
    cobrado:o.totalARS, mercaderia:Math.round(mercaderia), envio:Math.round(envio),
    costo:Math.round(costo),
    margen:Math.round(o.totalARS - costo),
    margenPct: o.totalARS ? Math.round((o.totalARS - costo) / o.totalARS * 100) : 0
  };
}
