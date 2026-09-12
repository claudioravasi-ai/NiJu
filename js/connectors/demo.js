/* ============================================================
   NiJu — Conector DEMO
   Genera ofertas realistas y ESTABLES (mismo precio en cada
   búsqueda) a partir del catálogo semilla. Sirve para:
     · desarrollar y demostrar la app completa sin backend,
     · tener un banco de pruebas del comparador y del motor fiscal.
   En producción se reemplaza tienda por tienda por su conector
   real sin tocar una línea de la interfaz.
   ============================================================ */
import { Conector, hash, entre } from './base.js';
import { PRODUCTOS } from '../data/catalog.js';
import { relevancia } from '../engine/normalize.js';
import { FX } from '../engine/fx.js';

/* Cuán caro/barato es cada tienda respecto del precio de referencia. */
const SESGO = {
  meli:1.08, coto:1.18, anonima:1.16, jumbo:1.15, carrefour:1.13, easy:1.22, sodimac:1.21,
  fravega:1.12, musimundo:1.17, compragamer:1.02, farmacity:1.20, dexter:1.19, tiendanube:1.10,
  amazon:1.00, ebay:0.94, aliexpress:0.72, alibaba:0.55, '1688':0.44, temu:0.68, shein:0.70,
  walmart:0.98, bestbuy:1.03, etsy:1.15, dhgate:0.66,
  tiktokshop:0.78, instagram:1.14, fbmarket:0.92, whatsapp:1.05, niju:1.04
};

/* Los nacionales venden en pesos con la carga impositiva local ya adentro. */
const MARKUP_LOCAL = 1.62;

export class ConectorDemo extends Conector {
  async buscar(consulta, opts = {}){
    const t = this.tienda;
    // latencia simulada, distinta por tienda pero estable
    await new Promise(r => setTimeout(r, 180 + hash(t.id) * 900));

    // 1 de cada 14 búsquedas falla, para que la interfaz sepa tolerarlo
    if (hash(t.id + consulta + '|fail') > 0.93) throw new Error('timeout del proveedor');

    const q = (consulta || '').trim();
    const rubro = opts.rubro;

    const candidatos = PRODUCTOS.filter(p => {
      if (!t.rubros.includes(p.rubro) && !(t.rubros.includes('mayorista') && opts.mayorista)) return false;
      if (rubro && p.rubro !== rubro) return false;
      if (!q) return true;
      return relevancia(q, { titulo:`${p.marca} ${p.n}`, marca:p.marca, tags:p.tags }) >= 0.34;
    });

    const ofertas = [];
    for (const p of candidatos){
      const seed = t.id + '|' + p.id;
      // no todas las tiendas tienen todo
      if (hash(seed + 'stock') > (t.tipo === 'internacional' ? 0.90 : 0.78)) continue;

      const sesgo = (SESGO[t.id] || 1) * entre(seed + 'v', 0.90, 1.12);
      const esLocal = t.moneda === 'ARS';
      let precio, moneda = t.moneda;

      if (esLocal){
        precio = Math.round(p.usd * FX.oficial * MARKUP_LOCAL * sesgo / 100) * 100;
      } else if (moneda === 'CNY'){
        precio = Math.round(p.usd * sesgo / FX.cny * 10) / 10;
      } else {
        precio = Math.round(p.usd * sesgo * 100) / 100;
      }

      const promo = hash(seed + 'promo');
      const descuento = promo > 0.72 ? Math.round(entre(seed + 'd', 8, 45)) : 0;
      const precioLista = descuento ? Math.round(precio / (1 - descuento / 100)) : null;

      const envioGratis = hash(seed + 'eg') > (t.tipo === 'internacional' ? 0.55 : 0.62);
      const envio = envioGratis ? 0 : Math.round(t.envioBase * entre(seed + 'e', 0.8, 1.5) * (esLocal ? 1 : 1));

      ofertas.push({
        id: `${t.id}-${p.id}`,
        tiendaId: t.id,
        productoId: p.id,
        titulo: `${p.marca} ${p.n}`,
        marca: p.marca,
        modelo: p.mod,
        emo: p.emo,
        precio, precioLista, moneda, envio,
        descuento,
        entregaDias: t.envioDias,
        stock: Math.round(entre(seed + 's', 1, 60)),
        cuotas: t.cuotas || 0, cuotaValor: null,
        reputacion: Math.round((t.reputacion + entre(seed + 'r', -0.4, 0.3)) * 10) / 10,
        vendidos: Math.round(entre(seed + 'vd', 5, 4200)),
        url: urlTienda(t, p),
        rubro: p.rubro,
        pesoKg: p.kg,
        specs: p.specs,
        tags: p.tags,
        demanda: p.dem,
        mayorista: !!t.mayorista,
        moq: t.moq || 1,
        vendedor: nombreVendedor(t, seed),
        demo: true
      });
    }

    return ofertas.sort((a,b) => a.precio - b.precio);
  }
}

function urlTienda(t, p){
  const q = encodeURIComponent(`${p.marca} ${p.n}`);
  const base = {
    meli:`https://listado.mercadolibre.com.ar/${q}`,
    amazon:`https://www.amazon.com/s?k=${q}&tag=niju-20`,
    ebay:`https://www.ebay.com/sch/i.html?_nkw=${q}&campid=NIJU`,
    aliexpress:`https://es.aliexpress.com/w/wholesale-${q}.html?aff_platform=niju`,
    alibaba:`https://www.alibaba.com/trade/search?SearchText=${q}`,
    '1688':`https://s.1688.com/selloffer/offer_search.htm?keywords=${q}`,
    temu:`https://www.temu.com/search_result.html?search_key=${q}`,
    walmart:`https://www.walmart.com/search?q=${q}`,
    bestbuy:`https://www.bestbuy.com/site/searchpage.jsp?st=${q}`,
    jumbo:`https://www.jumbo.com.ar/${q}`,
    easy:`https://www.easy.com.ar/${q}`,
    coto:`https://www.cotodigital.com.ar/sitios/cdigi/browse?Ntt=${q}`
  }[t.id];
  return base || `https://www.google.com/search?q=${q}+${encodeURIComponent(t.nombre)}`;
}

function nombreVendedor(t, seed){
  if (t.tipo === 'propio') return 'NiJu';
  const pool = ['TecnoStore','MegaShop','DistriSur','ImportPlus','CasaCentral','BazarExpress','GlobalTrade','PuntoVenta'];
  return t.id === 'meli' || t.id === 'tiendanube' || t.tipo === 'social'
    ? pool[Math.floor(hash(seed + 'nm') * pool.length)]
    : t.nombre;
}
