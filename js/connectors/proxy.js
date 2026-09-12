/* ============================================================
   NiJu — Conector vía proxy propio
   El navegador NO puede llamar a Mercado Libre, Amazon o eBay
   directamente: lo bloquea CORS y además las claves de API no
   pueden viajar en el front. Por eso todas las tiendas reales
   pasan por un único backend nuestro:

      GET {api}/buscar?tienda=meli&q=...&rubro=...

   que devuelve exactamente el array de Ofertas del contrato.
   El backend es el que guarda las claves, respeta los límites de
   cada API, cachea y normaliza. Ver backend/README.md.
   ============================================================ */
import { Conector } from './base.js';
import { CONFIG } from '../config.js';

export class ConectorProxy extends Conector {
  async buscar(consulta, opts = {}){
    const u = new URL(CONFIG.api + '/buscar');
    u.searchParams.set('tienda', this.id);
    u.searchParams.set('q', consulta || '');
    if (opts.rubro)     u.searchParams.set('rubro', opts.rubro);
    if (opts.mayorista) u.searchParams.set('mayorista', '1');
    u.searchParams.set('limite', String(opts.limite || 24));
    if (opts.desde) u.searchParams.set('desde', String(opts.desde));

    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);
    try{
      const res = await fetch(u, { signal:ctrl.signal, headers:{ 'accept':'application/json' } });
      if (!res.ok) throw new Error(`${this.id}: HTTP ${res.status}`);
      const data = await res.json();
      return (data.ofertas || []).map(o => ({ ...o, tiendaId:this.id }));
    } finally { clearTimeout(to); }
  }

  async salud(){
    try{
      const res = await fetch(`${CONFIG.api}/salud/${this.id}`);
      return await res.json();
    }catch(e){ return { ok:false, error:String(e) }; }
  }
}
