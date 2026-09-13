/* ============================================================
   NiJu — Compra asistida: una sola compra, muchas tiendas
   ------------------------------------------------------------
   El cliente arma un carrito con cosas de varias tiendas, confirma
   UNA vez acá, y NiJu compra en cada tienda a su nombre.

   Por qué es así y no una integración directa: ninguna de esas
   tiendas abre su carrito a un tercero. La única forma legal y que
   funciona de verdad es que NiJu actúe por mandato del cliente.

   El recorrido completo:
     1. Pedido      → el cliente confirma (queda pendiente de pago)
     2. Pago        → el dueño confirma que se acreditó
     3. Compra      → el dueño junta TODO lo que hay que comprar en
                      cada tienda, de todos los clientes, lo simula
                      (precio y stock de ahora) y lo compra de una vez
     4. Envío       → carga empresa y número de seguimiento de cada
                      compra; cada cliente recibe el aviso de lo suyo
     5. Entrega

   Dos formas de recibir:
     · directo     → cada tienda despacha al domicilio del cliente.
                      Llega antes; el cliente sigue cada envío aparte.
     · consolidado → las tiendas mandan a NiJu y NiJu arma un solo
                      paquete. Tarda más; permite juntar clientes en
                      una misma compra por tienda.
   ============================================================ */
import { store } from '../state.js';
import { uid, plata } from '../util.js';
import { STORE_BY_ID } from '../data/stores.js';
import { llamar, modoOError, hayCuenta, variantesDe } from './nube.js';
import { nombreCompleto } from './perfil.js';

/** Cuánto puede subir un precio sin tener que volver a preguntarle. */
export const TOLERANCIA = 0.05;
export const DIAS_ARREPENTIMIENTO = 10;

export const MODALIDADES = {
  directo:     { nombre:'Cada tienda te lo manda a tu casa',
                 desc:'Llega antes. Cada tienda despacha por su lado y seguís cada envío por separado.' },
  consolidado: { nombre:'Todo junto en un solo paquete',
                 desc:'Las tiendas nos mandan todo a NiJu y te lo llevamos en un envío. Tarda más.' }
};

export const ESTADOS = {
  pendiente_pago:{ label:'Pendiente de pago', color:'var(--warn)',
    desc:'Recibimos tu pedido. Te contactamos para coordinar el pago; apenas se acredite, salimos a comprar.' },
  pagada:       { label:'Pago acreditado', color:'var(--accion)', desc:'Ya tenemos tu pago. En breve compramos en cada tienda.' },
  comprando:    { label:'Comprando', color:'var(--accion)', desc:'Estamos comprando en cada tienda.' },
  consultando:  { label:'Necesitamos tu OK', color:'var(--warn)', desc:'Algo cambió de precio o no hay stock. Decidí vos antes de que sigamos.' },
  preparando:   { label:'En preparación', color:'var(--accion)', desc:'Ya compramos todo. Las tiendas están preparando y despachando.' },
  en_deposito:  { label:'Armando tu paquete', color:'var(--accion)', desc:'Llegó todo a NiJu. Estamos armando un solo paquete.' },
  enviada:      { label:'En camino', color:'var(--ok)', desc:'Tus productos salieron para tu domicilio.' },
  entregada:    { label:'Entregada', color:'var(--ok)', desc:'Llegó. Gracias por comprar en NiJu.' },
  cancelada:    { label:'Cancelada', color:'var(--bad)', desc:'Se anuló y se devuelve el dinero.' }
};

/** Estado de cada tramo (lo de una tienda) y de cada envío. */
export const ENVIO = {
  pendiente:   { label:'Por comprar',          rango:0, color:'var(--tx-3)' },
  problema:    { label:'Con problema',         rango:0, color:'var(--bad)' },
  comprado:    { label:'Comprado',             rango:1, color:'var(--accion)' },
  preparando:  { label:'La tienda lo prepara', rango:2, color:'var(--accion)' },
  despachado:  { label:'Despachado',           rango:3, color:'var(--ok)' },
  en_camino:   { label:'En camino',            rango:4, color:'var(--ok)' },
  en_deposito: { label:'Llegó a NiJu',         rango:5, color:'var(--ok)' },
  entregado:   { label:'Entregado',            rango:6, color:'var(--ok)' },
  cancelado:   { label:'Cancelado',            rango:9, color:'var(--bad)' }
};
const POR_RANGO = { 1:'comprado', 2:'preparando', 3:'despachado', 4:'en_camino', 5:'en_deposito', 6:'entregado' };

/** Los pasos que se pueden cargar, según a dónde va el envío. */
export const PASOS_ENVIO = {
  deposito:['preparando', 'despachado', 'en_camino', 'en_deposito'],
  cliente: ['preparando', 'despachado', 'en_camino', 'entregado']
};

export const EMPRESAS_ENVIO = ['Andreani', 'OCA', 'Correo Argentino', 'Mercado Envíos', 'Urbano', 'Cruz del Sur',
  'Vía Cargo', 'Integral Pack', 'Envío propio de la tienda', 'Moto / mensajería'];

const clonar = o => structuredClone(o);
export const destinoDe = o => o.modalidad === 'consolidado' ? 'deposito' : 'cliente';
export const urlSegura = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const listaLineas = ls => ls.map(l => `${l.cant}× ${l.titulo}${l.variante?.texto ? ` (${l.variante.texto})` : ''}`).join(', ');

function avisar(o, titulo, texto, extra = {}){
  o.avisos = [...(o.avisos || []), { id:'a-' + uid(), ts:Date.now(), titulo, texto, leido:false, ...extra }];
}
function anotar(o, nota, estado = o.estado){
  o.historia = [...(o.historia || []), { ts:Date.now(), estado, nota }];
}
function buscarLinea(o, id){
  for (const tr of o.tramos){
    const l = tr.lineas.find(x => x.id === id);
    if (l) return { tr, l };
  }
  return {};
}

/* Las órdenes guardadas por versiones anteriores no tenían id de renglón
   ni lista de envíos: se completan al leerlas. */
function normalizar(o){
  let cambio = false;
  const poner = (obj, k, v) => { if (obj[k] === undefined){ obj[k] = v; cambio = true; } };
  poner(o, 'avisos', []); poner(o, 'respuestas', []); poner(o, 'historia', []); poner(o, 'modalidad', 'consolidado');
  if (o.estado === 'consolidando'){ o.estado = 'preparando'; cambio = true; }
  for (const tr of o.tramos || []){
    poner(tr, 'envios', []);
    if (tr.estado === 'con-problema'){ tr.estado = 'problema'; cambio = true; }
    for (const l of tr.lineas || []) poner(l, 'id', 'l-' + uid());
  }
  return cambio;
}

/* ================= Crear y guardar ================= */

function armarOrden({ items, totalARS, entrega, costoEntrega, envioTiendas, pago, comprobante, modalidad }){
  const porTienda = {};
  for (const it of items) (porTienda[it.tiendaId] ||= []).push(it);
  const tramos = Object.entries(porTienda).map(([tiendaId, lineas]) => {
    const t = STORE_BY_ID[tiendaId] || {};
    return {
      id:'t-' + uid(), tiendaId, tienda:t.nombre || tiendaId, tipo:t.tipo || 'nacional', propio:t.tipo === 'propio',
      lineas:lineas.map(l => ({
        id:'l-' + uid(), ofertaId:l.ofertaId, titulo:l.titulo, cant:l.cant,
        precioAcordado:l.precio, moneda:l.moneda, url:l.url, imagen:l.imagen || null,
        variante:l.variante || null, estado:'pendiente', precioReal:null, loteId:null, nota:''
      })),
      estado:'pendiente', envios:[]
    };
  });
  return { entrega, costoEntrega:costoEntrega || 0, envioTiendas:envioTiendas || 0, pago, totalARS,
           comprobante:comprobante || null, modalidad, tramos, tolerancia:TOLERANCIA, avisos:[], respuestas:[] };
}

/** El cliente confirma el carrito. Devuelve la orden guardada. */
export async function crearOrden(datos){
  const base = armarOrden(datos);
  if (await modoOError() === 'nube'){
    return (await llamar('/ordenes', { metodo:'POST', cuerpo:{ orden:base } })).orden;
  }
  const u = store.get('usuario') || {};
  const ahora = Date.now();
  const orden = {
    ...base, local:true,
    id:'OR-' + ahora.toString(36).toUpperCase(), creada:ahora,
    cliente:{ email:u.email || null, nombre:nombreCompleto(u) || u.nombre || 'Cliente', dni:u.dni || null,
              cuit:u.cuit || null, telefono:u.telefono || null, perfilFiscal:u.perfilFiscal || 'consumidor_final',
              razonSocial:u.razonSocial || null },
    direccion:u.domicilio ? { ...u.domicilio } : null,
    estado:'pendiente_pago',
    historia:[{ ts:ahora, estado:'pendiente_pago', nota:'Pedido recibido. Falta acreditar el pago.' }]
  };
  store.push('ordenes', orden);
  return orden;
}

/** dueno:true trae todas; si no, las del cliente que entró. */
export async function listarOrdenes({ dueno = false } = {}){
  if (await modoOError() === 'nube'){
    if (!dueno && !hayCuenta()) return [];
    const os = (await llamar('/ordenes', { comoDueno:dueno })).ordenes || [];
    os.forEach(normalizar);
    return os;
  }
  const os = store.get('ordenes') || [];
  if (os.map(normalizar).some(Boolean)) store.set('ordenes', os);
  return os.slice().sort((a, b) => b.creada - a.creada);
}

export async function guardarOrden(o){
  if (await modoOError() === 'nube'){
    return (await llamar('/ordenes/' + encodeURIComponent(o.id), { metodo:'PUT', cuerpo:{ orden:o }, comoDueno:true })).orden;
  }
  store.set('ordenes', (store.get('ordenes') || []).map(x => x.id === o.id ? o : x));
  return o;
}

export async function listarLotes(){
  if (await modoOError() === 'nube') return (await llamar('/lotes', { comoDueno:true })).lotes || [];
  return (store.get('lotes') || []).slice().sort((a, b) => b.creado - a.creado);
}

export async function guardarLote(lote){
  if (await modoOError() === 'nube'){
    return (await llamar('/lotes/' + encodeURIComponent(lote.id), { metodo:'PUT', cuerpo:{ lote }, comoDueno:true })).lote;
  }
  const ls = store.get('lotes') || [];
  store.set('lotes', ls.some(x => x.id === lote.id) ? ls.map(x => x.id === lote.id ? lote : x) : [...ls, lote]);
  return lote;
}

/* ================= Lo que hace el cliente ================= */

export function puedeArrepentirse(o){
  if (!o || o.estado === 'cancelada') return false;
  if ((o.respuestas || []).some(r => r.tipo === 'arrepentimiento')) return false;
  const entrega = (o.historia || []).filter(h => h.estado === 'entregada').at(-1)?.ts || 0;
  return Date.now() - Math.max(o.creada, entrega) <= DIAS_ARREPENTIMIENTO * 864e5;
}

const TEXTO_RESPUESTA = {
  acepto:'El cliente aceptó el cambio', cancelo:'El cliente pidió cancelar',
  arrepentimiento:'El cliente usó el botón de arrepentimiento', consulta:'Consulta del cliente'
};

/** tipo: 'leido' | 'acepto' | 'cancelo' | 'arrepentimiento' | 'consulta' */
export async function responder(o, tipo, { nota = '', lineaId = null } = {}){
  if (await modoOError() === 'nube'){
    return (await llamar(`/ordenes/${encodeURIComponent(o.id)}/responder`, { metodo:'POST', cuerpo:{ tipo, nota, lineaId } })).orden;
  }
  const c = clonar(o);
  if (tipo === 'leido') c.avisos = (c.avisos || []).map(a => ({ ...a, leido:true }));
  else {
    if (tipo === 'arrepentimiento' && !puedeArrepentirse(c)) throw new Error('El plazo de 10 días para arrepentirte ya pasó.');
    const ts = Date.now();
    c.respuestas = [...(c.respuestas || []), { ts, tipo, lineaId, nota, atendida:false }];
    c.historia = [...(c.historia || []), { ts, estado:c.estado, de:'cliente', nota:TEXTO_RESPUESTA[tipo] + (nota ? ': ' + nota : '.') }];
  }
  store.set('ordenes', (store.get('ordenes') || []).map(x => x.id === c.id ? c : x));
  return c;
}

/* ================= Estado de cada cosa ================= */

function estadoTramo(tr){
  const ls = tr.lineas.filter(l => l.estado !== 'cancelado');
  if (!ls.length) return 'cancelado';
  if (ls.some(l => l.estado === 'problema')) return 'problema';
  if (ls.some(l => l.estado === 'pendiente')) return 'pendiente';
  const envios = tr.envios || [];
  const rango = Math.min(...ls.map(l => {
    const e = envios.find(x => x.loteId === (l.loteId || 'tramo'));
    return e ? (ENVIO[e.estado]?.rango || 1) : 1;
  }));
  return POR_RANGO[rango] || 'comprado';
}

/** Recalcula tramos, diferencias de precio y el estado general. */
export function recalcular(o){
  for (const tr of o.tramos) tr.estado = estadoTramo(tr);
  const activas = o.tramos.flatMap(t => t.lineas).filter(l => l.estado !== 'cancelado');
  const compradas = activas.filter(l => l.estado !== 'pendiente' && l.estado !== 'problema');

  o.diferencia = compradas.reduce((a, l) => a + ((l.precioReal ?? l.precioAcordado) - l.precioAcordado) * l.cant, 0);
  o.diferenciaPct = o.totalARS ? o.diferencia / o.totalARS : 0;
  o.necesitaOK = activas.some(l => l.estado === 'problema')
              || (o.diferenciaPct > (o.tolerancia ?? TOLERANCIA) && !o.diferenciaAceptada);

  if (['pendiente_pago', 'cancelada'].includes(o.estado)) return o;

  const tramos = o.tramos.filter(t => t.estado !== 'cancelado');
  let nuevo;
  if (!tramos.length) nuevo = 'cancelada';
  else if (o.necesitaOK) nuevo = 'consultando';
  else {
    const min = Math.min(...tramos.map(t => ENVIO[t.estado]?.rango ?? 0));
    if (o.modalidad === 'consolidado' && min >= 5){
      const ef = o.envioFinal?.estado;
      nuevo = ef === 'entregado' ? 'entregada' : ['despachado', 'en_camino'].includes(ef) ? 'enviada' : 'en_deposito';
    }
    else if (min >= 6) nuevo = 'entregada';
    else if (min >= 3 && o.modalidad !== 'consolidado') nuevo = 'enviada';
    else if (min >= 1) nuevo = 'preparando';
    else nuevo = compradas.length ? 'comprando' : 'pagada';
  }
  if (nuevo !== o.estado){
    o.estado = nuevo;
    anotar(o, ESTADOS[nuevo].desc, nuevo);
    /* Los avisos de despacho y entrega los manda cada acción con su
       detalle; acá solo avisamos lo que no tiene otro aviso. */
    if (['consultando', 'en_deposito'].includes(nuevo)) avisar(o, ESTADOS[nuevo].label, ESTADOS[nuevo].desc);
  }
  return o;
}

/** Lo que gana NiJu con la orden, descontado lo que paga en cada tienda. */
export function resultado(o){
  const lineas = o.tramos.flatMap(t => t.lineas).filter(l => l.estado !== 'cancelado');
  const mercaderia = lineas.reduce((a, l) => a + (l.precioReal ?? l.precioAcordado) * l.cant, 0);
  /* El envío que le cobramos al cliente también nos cuesta: contarlo
     como ganancia sería engañarnos solos. */
  const envio = (o.costoEntrega || 0) + (o.envioTiendas || 0);
  const reintegros = (o.reintegros || []).reduce((a, r) => a + r.monto, 0);
  const cobrado = o.totalARS - reintegros;
  const costo = mercaderia + envio;
  return {
    cobrado:Math.round(cobrado), mercaderia:Math.round(mercaderia), envio:Math.round(envio), costo:Math.round(costo),
    margen:Math.round(cobrado - costo), margenPct: cobrado ? Math.round((cobrado - costo) / cobrado * 100) : 0
  };
}

/* ================= Lo que hace el dueño ================= */

function atenderRespuestas(o, filtro){
  o.respuestas = (o.respuestas || []).map(r => filtro(r) ? { ...r, atendida:true } : r);
}

export async function confirmarPago(original, nota = ''){
  const o = clonar(original);
  o.estado = 'pagada';
  o.pagoConfirmado = { ts:Date.now(), nota };
  anotar(o, 'Pago acreditado' + (nota ? ` (${nota})` : '') + '.', 'pagada');
  avisar(o, 'Acreditamos tu pago', 'Ya salimos a comprar en cada tienda. Te avisamos a medida que compremos y despachen.');
  recalcular(o);
  return guardarOrden(o);
}

export async function cancelarOrden(original, motivo = ''){
  const o = clonar(original);
  for (const tr of o.tramos) for (const l of tr.lineas)
    if (l.estado === 'pendiente' || l.estado === 'problema') l.estado = 'cancelado';
  o.estado = 'cancelada';
  anotar(o, 'Pedido cancelado' + (motivo ? `: ${motivo}` : '.'), 'cancelada');
  avisar(o, 'Cancelamos tu pedido', (motivo ? motivo + '. ' : '') + 'Te devolvemos el dinero por el mismo medio con el que pagaste.');
  atenderRespuestas(o, r => ['arrepentimiento', 'cancelo'].includes(r.tipo) && !r.lineaId);
  return guardarOrden(o);
}

export async function cancelarLinea(original, lineaId, motivo = 'No había stock'){
  const o = clonar(original);
  const { tr, l } = buscarLinea(o, lineaId);
  if (!l) return original;
  l.estado = 'cancelado'; l.nota = motivo;
  const monto = Math.round(l.precioAcordado * l.cant);
  o.reintegros = [...(o.reintegros || []), { ts:Date.now(), lineaId, titulo:l.titulo, monto, motivo }];
  anotar(o, `Cancelado: ${l.titulo} (${motivo}). Reintegro de ${plata(monto)}.`);
  avisar(o, `Cancelamos un producto de ${tr.tienda}`, `${l.titulo}: ${motivo}. Te devolvemos ${plata(monto)}.`, { tramoId:tr.id });
  atenderRespuestas(o, r => r.lineaId === lineaId);
  recalcular(o);
  return guardarOrden(o);
}

export async function reintentarLinea(original, lineaId){
  const o = clonar(original);
  const { l } = buscarLinea(o, lineaId);
  if (!l) return original;
  l.estado = 'pendiente'; l.nota = '';
  anotar(o, `Se vuelve a intentar comprar ${l.titulo}.`);
  recalcular(o);
  return guardarOrden(o);
}

export async function aceptarDiferencia(original){
  const o = clonar(original);
  o.diferenciaAceptada = true;
  anotar(o, 'Se toma el OK del cliente por la diferencia de precio.');
  atenderRespuestas(o, r => r.tipo === 'acepto');
  recalcular(o);
  return guardarOrden(o);
}

export async function atenderRespuesta(original, ts){
  const o = clonar(original);
  atenderRespuestas(o, r => r.ts === ts);
  return guardarOrden(o);
}

/* ----------------------------------------------------------------
   La lista de compras: TODO lo que hay que comprar, de todos los
   clientes, agrupado por tienda. Dentro de cada tienda se separa por
   destino, porque una compra se despacha a UNA dirección:
     · lo que va al depósito de NiJu se compra todo junto
     · lo que va directo al cliente, una compra por cliente
   ---------------------------------------------------------------- */
export function armarCompras(ordenes){
  const tiendas = {};
  for (const o of ordenes){
    if (!['pagada', 'comprando', 'consultando'].includes(o.estado)) continue;
    const tipo = destinoDe(o);
    for (const tr of o.tramos){
      if (tr.propio) continue;
      for (const l of tr.lineas){
        if (l.estado !== 'pendiente') continue;
        const T = tiendas[tr.tiendaId] ||= { tiendaId:tr.tiendaId, tienda:tr.tienda, grupos:{} };
        const clave = tipo === 'deposito' ? 'deposito' : 'cliente-' + o.id;
        const G = T.grupos[clave] ||= { clave, tipo, ordenId:tipo === 'cliente' ? o.id : null,
          cliente:tipo === 'cliente' ? o.cliente : null, direccion:tipo === 'cliente' ? o.direccion : null, renglones:[] };
        G.renglones.push({ ...l, tiendaId:tr.tiendaId, tienda:tr.tienda, ordenId:o.id, tramoId:tr.id,
                           cliente:o.cliente?.nombre || 'Cliente', clienteDatos:o.cliente });
      }
    }
  }
  const suma = (rs, f) => rs.reduce((a, r) => a + f(r), 0);
  return Object.values(tiendas).map(T => {
    const grupos = Object.values(T.grupos).map(G => ({ ...G,
      unidades:suma(G.renglones, r => r.cant),
      aPagar:suma(G.renglones, r => r.precioAcordado * r.cant),
      clientes:new Set(G.renglones.map(r => r.ordenId)).size
    })).sort((a, b) => (a.tipo === 'deposito' ? 0 : 1) - (b.tipo === 'deposito' ? 0 : 1));
    const renglones = grupos.flatMap(g => g.renglones);
    return { ...T, grupos, renglones, aPagar:suma(grupos, g => g.aPagar), unidades:suma(grupos, g => g.unidades),
             clientes:new Set(renglones.map(r => r.ordenId)).size };
  }).sort((a, b) => b.aPagar - a.aPagar);
}

/** Carrito armado en la tienda con todo junto (VTEX y Shopify lo permiten). */
export function enlaceCarrito(renglones){
  const items = new Map();
  let plataforma = null, host = null;
  for (const r of renglones){
    const sku = r.sku ?? r.variante?.sku;
    const h = r.host ?? r.variante?.host;
    const p = r.plataforma ?? r.variante?.plataforma;
    if (!sku || !h || !['vtex', 'shopify'].includes(p)) continue;
    plataforma = p; host = h;
    const seller = r.seller ?? r.variante?.seller ?? '1';
    const k = sku + '|' + seller;
    const previo = items.get(k);
    items.set(k, { sku, seller, cant:(previo?.cant || 0) + r.cant, n:(previo?.n || 0) + 1 });
  }
  if (!items.size) return null;
  const xs = [...items.values()];
  const url = plataforma === 'vtex'
    ? `https://${host}/checkout/cart/add?` + xs.map(x => `sku=${encodeURIComponent(x.sku)}&qty=${x.cant}&seller=${encodeURIComponent(x.seller)}&sc=1`).join('&')
    : `https://${host}/cart/` + xs.map(x => `${encodeURIComponent(x.sku)}:${x.cant}`).join(',');
  return { url, cubre:xs.reduce((a, x) => a + x.n, 0), plataforma };
}

/** Link para un solo renglón: agrega al carrito si la tienda lo permite. */
export function enlaceRenglon(r){
  const sku = r.sku ?? r.variante?.sku, host = r.host ?? r.variante?.host, p = r.plataforma ?? r.variante?.plataforma;
  if (sku && host && p === 'woo') return `https://${host}/?add-to-cart=${encodeURIComponent(sku)}&quantity=${r.cant}`;
  return r.url || null;
}

/* ----------------------------------------------------------------
   Simulación: consulta a la tienda, renglón por renglón, el precio y
   el stock de ESTE momento. No compra ni avisa nada.
   ---------------------------------------------------------------- */
export async function simular(renglones){
  const res = await Promise.all(renglones.map(consultarRenglon));
  const vale = r => r.precioHoy ?? r.precioAcordado;
  const conStock = res.filter(r => !r.faltaStock);
  return {
    renglones:res, hecha:Date.now(),
    totalAcordado:Math.round(res.reduce((a, r) => a + r.precioAcordado * r.cant, 0)),
    totalHoy:Math.round(conStock.reduce((a, r) => a + vale(r) * r.cant, 0)),
    diferencia:Math.round(conStock.reduce((a, r) => a + (vale(r) - r.precioAcordado) * r.cant, 0)),
    sinStock:res.filter(r => r.faltaStock).length,
    sinVerificar:res.filter(r => !r.verificado).length,
    suben:res.filter(r => r.subePct > TOLERANCIA * 100).length,
    enlace:enlaceCarrito(conStock)
  };
}

async function consultarRenglon(r){
  const v0 = r.variante || {};
  const base = { ...r, verificado:false, precioHoy:null, stockHoy:null, faltaStock:false, subePct:0, motivo:'',
                 sku:v0.sku ?? null, seller:v0.seller ?? null, plataforma:v0.plataforma ?? null, host:v0.host ?? null };
  try{
    const v = await variantesDe({ tiendaId:r.tiendaId, id:r.ofertaId, url:r.url }, { fresco:true });
    if (!v.soportado) return { ...base, motivo:'Esta tienda no deja leer el stock: confirmalo al entrar.' };
    if (v.error) return { ...base, motivo:'La tienda no respondió: ' + v.error };
    const igual = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    let s = v0.sku ? v.skus.find(x => String(x.sku) === String(v0.sku)) : null;
    if (!s && v0.valores) s = v.skus.find(x => Object.entries(v0.valores).every(([k, val]) => !x.valores?.[k] || igual(x.valores[k], val)));
    if (!s && !v0.valores && v.skus.length === 1) s = v.skus[0];
    if (!s) return { ...base, motivo: v0.manual
      ? `Talle escrito a mano (${v0.texto}): no coincide con lo que publica la tienda, revisalo.`
      : 'No encontramos esa variante en la tienda.' };
    const precioHoy = s.precio ?? null;
    const corto = s.stock != null && s.stock < r.cant;
    return { ...base, verificado:true, sku:String(s.sku), seller:s.seller || null, plataforma:v.plataforma, host:v.host,
      precioHoy, stockHoy:s.stock,
      subePct: precioHoy && r.precioAcordado ? Math.round((precioHoy / r.precioAcordado - 1) * 1000) / 10 : 0,
      faltaStock: s.disponible === false || corto,
      motivo: s.disponible === false ? 'Sin stock' : corto ? `Solo quedan ${s.stock}` : '' };
  }catch(e){
    return { ...base, motivo:'No pudimos consultar la tienda (' + (e.message || e) + ').' };
  }
}

/* ----------------------------------------------------------------
   Registrar la compra hecha en una tienda. Queda como "lote" en la
   base, marca cada renglón de cada cliente y les avisa.
   ---------------------------------------------------------------- */
export async function registrarCompra({ tienda, grupo, renglones, pedidoTienda, totalPagado, medioPago, notas }, ordenes){
  const ahora = Date.now();
  const lote = {
    id:'LC-' + ahora.toString(36).toUpperCase(), creado:ahora,
    tiendaId:tienda.tiendaId, tienda:tienda.tienda,
    destino:{ tipo:grupo.tipo, ordenId:grupo.ordenId, cliente:grupo.cliente?.nombre || null },
    pedidoTienda:String(pedidoTienda || '').trim(), totalPagado:Number(totalPagado) || null,
    medioPago:String(medioPago || '').trim(), notas:String(notas || '').trim(),
    estado:'comprado', envio:{ estado:'comprado', empresa:'', numero:'', url:'' },
    renglones:renglones.map(r => ({ lineaId:r.id, ordenId:r.ordenId, tramoId:r.tramoId, titulo:r.titulo,
      variante:r.variante?.texto || '', cant:r.cant, precioAcordado:r.precioAcordado,
      precioReal:r.conseguido ? (Number(r.precioReal) || r.precioAcordado) : null,
      conseguido:!!r.conseguido, cliente:r.cliente })),
    eventos:[{ ts:ahora, estado:'comprado', nota:'Compra registrada' + (pedidoTienda ? ` · pedido ${pedidoTienda}` : '') }]
  };

  const actualizadas = [];
  for (const id of new Set(renglones.map(r => r.ordenId))){
    const original = ordenes.find(x => x.id === id);
    if (!original) continue;
    const o = clonar(original);
    const tocados = new Map();
    for (const r of renglones.filter(x => x.ordenId === id)){
      const { tr, l } = buscarLinea(o, r.id);
      if (!l) continue;
      if (r.conseguido){ l.estado = 'comprado'; l.precioReal = Number(r.precioReal) || l.precioAcordado; l.loteId = lote.id; l.nota = ''; }
      else { l.estado = 'problema'; l.nota = r.motivo || 'Sin stock en la tienda'; }
      if (!tocados.has(tr)) tocados.set(tr, { ok:[], mal:[] });
      tocados.get(tr)[r.conseguido ? 'ok' : 'mal'].push(l);
    }
    for (const [tr, { ok, mal }] of tocados){
      if (ok.length){
        tr.envios = [...(tr.envios || []).filter(e => e.loteId !== lote.id),
                     { loteId:lote.id, estado:'comprado', empresa:'', numero:'', url:'', ts:ahora }];
        avisar(o, `Compramos tu pedido en ${tr.tienda}`, `${listaLineas(ok)}. Te avisamos cuando lo despachen.`, { tramoId:tr.id });
      }
      if (mal.length) avisar(o, `Sin stock en ${tr.tienda}`,
        `${listaLineas(mal)}. Decidí si lo cancelamos y te devolvemos esa parte.`, { tramoId:tr.id, requiere:true });
      anotar(o, `Compra en ${tr.tienda} registrada (${lote.id}): ${ok.length} comprado(s), ${mal.length} sin stock.`);
    }
    recalcular(o);
    actualizadas.push(await guardarOrden(o));
  }
  await guardarLote(lote);
  return { lote, ordenes:actualizadas };
}

const TEXTO_ENVIO = {
  preparando: t => `${t} está preparando tu compra.`,
  despachado: (t, e, dest) => dest === 'deposito'
    ? `${t} despachó tus productos hacia NiJu. Cuando lleguen, armamos tu paquete.`
    : `${t} despachó tu compra${e.empresa ? ' por ' + e.empresa : ''}${e.numero ? ' · número de seguimiento ' + e.numero : ''}.`,
  en_camino: (t, e, dest) => dest === 'deposito'
    ? `Tus productos de ${t} están viajando a NiJu.`
    : `Tu compra de ${t} está en camino${e.empresa ? ' con ' + e.empresa : ''}.`,
  en_deposito: t => `Llegaron a NiJu tus productos de ${t}.`,
  entregado: t => `Se entregó tu compra de ${t}.`
};

function datosEnvio(d){
  return { estado:d.estado, empresa:String(d.empresa || '').trim(), numero:String(d.numero || '').trim(),
           url:urlSegura(d.url), ts:Date.now() };
}

/** Empresa, número y estado del envío de una compra; avisa a cada cliente. */
export async function actualizarEnvioLote(lote, datos, ordenes){
  const l2 = clonar(lote);
  const envio = datosEnvio(datos);
  l2.envio = envio; l2.estado = envio.estado;
  l2.eventos = [...(l2.eventos || []), { ts:envio.ts, estado:envio.estado,
    nota:(datos.nota || ENVIO[envio.estado]?.label) + (envio.numero ? ` · ${envio.empresa} ${envio.numero}` : '') }];

  for (const id of new Set(l2.renglones.filter(r => r.conseguido).map(r => r.ordenId))){
    const original = ordenes.find(x => x.id === id);
    if (!original) continue;
    const o = clonar(original);
    const dest = l2.destino?.tipo || destinoDe(o);
    for (const tr of o.tramos){
      if (!tr.lineas.some(l => l.loteId === l2.id)) continue;
      tr.envios = [...(tr.envios || []).filter(e => e.loteId !== l2.id), { loteId:l2.id, ...envio }];
      const seguimiento = dest === 'cliente' && (envio.numero || envio.url) ? { empresa:envio.empresa, numero:envio.numero, url:envio.url } : null;
      avisar(o, `${tr.tienda}: ${ENVIO[envio.estado].label.toLowerCase()}`,
        (TEXTO_ENVIO[envio.estado] || (() => ENVIO[envio.estado].label))(tr.tienda, envio, dest),
        { tramoId:tr.id, seguimiento });
      anotar(o, `${tr.tienda} · ${ENVIO[envio.estado].label}${envio.numero ? ' · ' + envio.numero : ''}`);
    }
    recalcular(o);
    await guardarOrden(o);
  }
  return guardarLote(l2);
}

/** Envío de un tramo sin lote: productos de NiJu Directo o compra cargada a mano. */
export async function actualizarEnvioTramo(original, tramoId, datos){
  const o = clonar(original);
  const tr = o.tramos.find(t => t.id === tramoId);
  if (!tr) return original;
  const envio = datosEnvio(datos);
  for (const l of tr.lineas) if (l.estado === 'pendiente'){ l.estado = 'comprado'; l.precioReal ??= l.precioAcordado; }
  tr.envios = [...(tr.envios || []).filter(e => e.loteId !== 'tramo'), { loteId:'tramo', ...envio }];
  const dest = destinoDe(o);
  const nombre = tr.propio ? 'NiJu' : tr.tienda;
  avisar(o, `${nombre}: ${ENVIO[envio.estado].label.toLowerCase()}`,
    (TEXTO_ENVIO[envio.estado] || (() => ENVIO[envio.estado].label))(nombre, envio, dest),
    { tramoId, seguimiento: dest === 'cliente' && (envio.numero || envio.url) ? { empresa:envio.empresa, numero:envio.numero, url:envio.url } : null });
  anotar(o, `${nombre} · ${ENVIO[envio.estado].label}${envio.numero ? ' · ' + envio.numero : ''}`);
  recalcular(o);
  return guardarOrden(o);
}

/** Envío final de NiJu al cliente, cuando se consolidó todo. */
export async function actualizarEnvioFinal(original, datos){
  const o = clonar(original);
  const e = datosEnvio(datos);
  o.envioFinal = e;
  const seguimiento = e.numero || e.url ? { empresa:e.empresa, numero:e.numero, url:e.url } : null;
  if (e.estado === 'entregado') avisar(o, 'Entregamos tu pedido', 'Llegó todo. ¡Gracias por comprar en NiJu!');
  else avisar(o, 'Tu paquete está en camino',
    `Sale tu paquete con todo${e.empresa ? ' por ' + e.empresa : ''}${e.numero ? ' · número de seguimiento ' + e.numero : ''}.`, { seguimiento });
  anotar(o, `Envío final · ${ENVIO[e.estado]?.label || e.estado}${e.numero ? ' · ' + e.numero : ''}`);
  recalcular(o);
  return guardarOrden(o);
}
