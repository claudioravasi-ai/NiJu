/* ============================================================
   NiJu — Asistente de compra
   Mira lo que la persona tiene en el carrito y su condición ante
   ARCA, y lo traduce a tres listas en castellano simple:
   qué PODÉS, qué NO PODÉS y qué TE CONVIENE.
   Usa los mismos parámetros que el cálculo de precios, así el
   consejo nunca contradice el número que ve en el carrito.
   ============================================================ */
import { STORE_BY_ID } from '../data/stores.js';
import { PERFILES } from './fiscal.js';
import { REGLAS } from './taxes.js';
import { aUSD } from './fx.js';
import { DIAS_ARREPENTIMIENTO } from './ordenes.js';

export function analizarCompra({ items = [], perfilId = 'consumidor_final', destino = 'uso', resumen = null }){
  const P = PERFILES[perfilId] || PERFILES.consumidor_final;
  const cr = REGLAS.courier;
  const podes = [], noPodes = [], conviene = [];

  const porTienda = {};
  for (const it of items) (porTienda[it.tiendaId] ||= []).push(it);
  const exterior = [], pais = [];
  for (const [id, lineas] of Object.entries(porTienda)){
    const t = STORE_BY_ID[id] || {};
    const envio = {
      tienda:t.nombre || id,
      valorUSD:lineas.reduce((a, l) => a + aUSD(l.precio, l.moneda) * l.cant, 0),
      pesoKg:lineas.reduce((a, l) => a + (l.pesoKg || 1) * l.cant, 0),
      iguales:Math.max(0, ...lineas.map(l => l.cant))
    };
    (t.tipo === 'internacional' ? exterior : pais).push(envio);
  }
  const hayCarrito = items.length > 0;
  const tiendas = Object.keys(porTienda).length;

  /* ---- El IVA, según la condición ---- */
  if (P.computaIVA) podes.push({ t:'Recuperar el IVA', d:'Pedí que cada tienda te facture a tu CUIT: ese IVA lo descontás en tu declaración mensual.', fuente:'iva' });
  else noPodes.push({ t:'Recuperar el IVA', d:`Como ${P.label}, el IVA queda dentro del precio. Por eso te mostramos siempre el precio final: comparás lo que de verdad vas a pagar.`, fuente:'iva' });

  /* ---- Para qué es la compra ---- */
  if (destino === 'reventa'){
    if (!P.puedeReventa){
      noPodes.push({ t:'Revender sin estar inscripto', d:'Para vender lo que comprás tenés que estar inscripto ante ARCA. Así como estás, la compra es para uso propio.' });
      conviene.push({ t:'Inscribite antes de vender', d:'El Monotributo suele ser el primer paso para vender en pequeño. Consultalo con un contador.', fuente:'monotributo' });
    } else {
      podes.push({ t:'Comprar para revender', d:'Registrá la compra y facturá cada venta.' });
      if (perfilId === 'monotributo') conviene.push({ t:'Cuidá tu categoría', d:'Lo que comprás para vender cuenta en la recategorización. Si crece mucho, revisalo con tu contador.', fuente:'monotributo' });
    }
  } else {
    podes.push({ t:'Comprar para vos o tu familia', d:'Para uso personal, sin fines de venta: es el camino más simple.' });
  }

  /* ---- Lo que viene del exterior, envío por envío ---- */
  for (const e of exterior){
    const valor = `US$ ${Math.round(e.valorUSD).toLocaleString('es-AR')}`;
    if (destino === 'reventa'){
      noPodes.push({ t:`Traer lo de ${e.tienda} por courier`, d:'El courier puerta a puerta es solo para uso personal. Para vender corresponde una importación con despachante.', grande:true, fuente:'envios' });
    } else if (e.valorUSD > cr.topeValorUSD || e.pesoKg > cr.topePesoKg){
      noPodes.push({ t:`Traer lo de ${e.tienda} por courier`, d:`Vale ${valor} y pesa unos ${Math.round(e.pesoKg)} kg: pasa el límite de US$ ${cr.topeValorUSD} o ${cr.topePesoKg} kg por envío. Se hace como compra grande, con despachante.`, grande:true, fuente:'envios' });
    } else if (e.iguales > cr.unidadesPorItem){
      conviene.push({ t:`Ojo con las unidades iguales de ${e.tienda}`, d:`Más de ${cr.unidadesPorItem} unidades del mismo producto se toman como compra comercial. Si es para vender, pasalo a compra grande.`, grande:true, fuente:'envios' });
    } else if (e.valorUSD <= cr.franquiciaUSD){
      podes.push({ t:`Traer lo de ${e.tienda} dentro de la franquicia`, d:`Vale ${valor}: entra en los US$ ${cr.franquiciaUSD} por envío que no pagan derechos, según los valores que usa la app.`, fuente:'envios' });
    } else {
      conviene.push({ t:`Lo de ${e.tienda} pasa la franquicia`, d:`Vale ${valor}. Sobre lo que supera US$ ${cr.franquiciaUSD} se paga un ${Math.round(cr.derechoExcedente * 100)}%, y ya está sumado en tu total. Si querés que lo miremos juntos, escribinos antes de confirmar.`, fuente:'envios' });
    }
  }
  if (exterior.length && !P.computaPercepciones)
    conviene.push({ t:'Guardá los comprobantes del exterior', d:'Si te cobran percepciones, se piden en devolución con un trámite en ARCA y te van a pedir esos papeles.', fuente:'tramites' });

  /* ---- La gestión de NiJu ---- */
  if (resumen?.detalleAsistida?.noConviene)
    conviene.push({ t:'Esta compra te conviene hacerla directo', d:resumen.detalleAsistida.avisoCliente || 'La gestión pesa mucho sobre un monto chico: comprando vos en la tienda ahorrás.' });
  if (tiendas > 1) podes.push({ t:'Pagar una sola vez', d:`Aunque sean ${tiendas} tiendas, confirmás acá y compramos en cada una por vos.` });
  if (hayCarrito) podes.push({ t:'Arrepentirte', d:`Tenés ${DIAS_ARREPENTIMIENTO} días desde que lo recibís. Se hace con un botón en Mis compras.`, fuente:'consumidor' });

  /* ---- Papeles, según la condición ---- */
  if (perfilId === 'monotributo') conviene.push({ t:'Guardá cada factura', d:'ARCA cruza lo que comprás con lo que facturás para la recategorización.' });
  else if (perfilId !== 'consumidor_final') conviene.push({ t:'Guardá cada factura', d:'Las vas a necesitar para tu contabilidad y tus declaraciones.' });
  else if (hayCarrito) conviene.push({ t:'Mirá el precio final, no el de lista', d:'El total del carrito ya incluye envío, impuestos y gestión: es lo que vas a pagar de verdad.' });

  return { perfil:P, podes, noPodes, conviene, hayCarrito,
           tiendasPais:pais.length, tiendasExterior:exterior.length,
           grande:[...noPodes, ...conviene].some(x => x.grande) };
}
