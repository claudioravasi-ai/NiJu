/* ============================================================
   NiJu — Conector de venta propia
   Lee el catálogo que carga el dueño desde el Panel. En producción
   esto es una consulta a Firestore; acá lee el módulo local.
   ============================================================ */
import { Conector } from './base.js';
import { NIJU_PRODUCTOS } from '../data/niju-directo.js';
import { PRODUCTO_BY_ID } from '../data/catalog.js';
import { relevancia } from '../engine/normalize.js';
import { store } from '../state.js';

export class ConectorNiju extends Conector {
  async buscar(consulta, opts = {}){
    await new Promise(r => setTimeout(r, 90));
    const propios = [...NIJU_PRODUCTOS, ...(store.get('nijuExtra') || [])];
    const q = (consulta || '').trim();

    return propios
      .filter(p => {
        if (opts.rubro && p.rubro !== opts.rubro) return false;
        if (!q) return true;
        return relevancia(q, { titulo:p.n, marca:'NiJu', tags:[p.rubro] }) >= 0.3;
      })
      .map(p => {
        const ref = PRODUCTO_BY_ID[p.ref] || {};
        return {
          id:`niju-${p.id}`, tiendaId:'niju', productoId:p.ref || p.id,
          titulo:p.n, marca:ref.marca || 'NiJu', modelo:ref.mod || '', emo:p.emo,
          precio:p.precio, precioLista:p.precioTachado, moneda:'ARS',
          envio: p.envioGratis ? 0 : 3900,
          descuento: p.precioTachado ? Math.round((1 - p.precio / p.precioTachado) * 100) : 0,
          entregaDias:[1,4], stock:p.stock, cuotas:p.cuotas, reputacion:5.0,
          vendidos:Math.round(200 + p.stock * 7), url:`#/producto/${p.ref || p.id}`,
          rubro:p.rubro, pesoKg:ref.kg || 1, specs:ref.specs || {}, tags:[p.rubro],
          demanda:9, vendedor:'NiJu', propio:true, descripcion:p.desc, nijuId:p.id
        };
      });
  }
}
