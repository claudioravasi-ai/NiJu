/* ============================================================
   NiJu — Contrato de conector
   Todo conector (API oficial, afiliado, feed o proxy propio)
   devuelve SIEMPRE este mismo objeto Oferta. Así el comparador
   no sabe ni le importa de dónde salió el precio.
   ============================================================ */

/**
 * @typedef {Object} Oferta
 * @property {string} id
 * @property {string} tiendaId
 * @property {string} titulo
 * @property {string} marca
 * @property {string} [modelo]
 * @property {string} [productoId]  clave del catálogo de conocimiento (agrupa)
 * @property {number} precio         en la moneda de la tienda
 * @property {number} [precioLista]  precio tachado
 * @property {'ARS'|'USD'|'CNY'|'EUR'} moneda
 * @property {number} envio          costo de envío en la misma moneda (0 = gratis)
 * @property {[number,number]} entregaDias
 * @property {number} stock
 * @property {number} cuotas
 * @property {number} reputacion     0-5
 * @property {number} vendidos
 * @property {string} url            deep link (con parámetros de afiliado)
 * @property {string} rubro
 * @property {number} pesoKg
 * @property {string[]} tags
 * @property {boolean} [mayorista]
 * @property {number} [moq]
 */

export class Conector {
  constructor(tienda){ this.tienda = tienda; }
  get id(){ return this.tienda.id; }
  /** @returns {Promise<Oferta[]>} */
  async buscar(){ throw new Error('buscar() no implementado en ' + this.id); }
  /** Estado de salud, para el panel de conectores. */
  async salud(){ return { ok:true, modo:this.tienda.integracion.modo }; }
}

/** Hash determinista: la misma tienda + producto da siempre el mismo precio. */
export function hash(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
export const entre = (seed, min, max) => min + hash(seed) * (max - min);
