/* ============================================================
   NiJu — Panel → Solicitudes
   Consultas de "Vendé al mundo" y pedidos de presupuesto de
   "Apps y webs a medida". El dueño las lee y las marca atendidas.
   ============================================================ */
import { el, fecha, toast } from '../util.js';
import { listarSolicitudes, marcarAtendida, TIPOS_SOLICITUD } from '../engine/solicitudes.js';

export function vistaSolicitudes(){
  const cont = el('div', { class:'section' }, el('div', { class:'card v-sk', style:{ minHeight:'120px' } }));
  let filtro = 'pendientes';

  async function pintar(){
    let lista;
    try{ lista = await listarSolicitudes(); }
    catch(e){ cont.replaceChildren(el('div', { class:'notice notice-bad' }, 'No pudimos leer las solicitudes: ' + e.message)); return; }
    const visibles = lista.filter(s => filtro === 'todas' || !s.atendida);
    cont.replaceChildren(
      el('div', { class:'k2-chips', style:{ marginBottom:'12px' } },
        ...[['pendientes', `Pendientes (${lista.filter(s => !s.atendida).length})`], ['todas', `Todas (${lista.length})`]].map(([id, t]) =>
          el('button', { class:'v-chip' + (filtro === id ? ' on' : ''), onclick:() => { filtro = id; pintar(); } }, t))),
      visibles.length
        ? el('div', { class:'col' }, ...visibles.map(s => el('details', { class:'card' },
            el('summary', { style:{ cursor:'pointer' } },
              el('b', {}, `${TIPOS_SOLICITUD[s.tipo] || s.tipo} · ${s.datos?.nombre || 'Sin nombre'}`),
              el('span', { class:'tiny dim' }, ` · ${fecha(s.creada)} · ${s.id}${s.atendida ? ' · atendida' : ''}`)),
            el('dl', { class:'c-datos', style:{ marginTop:'10px' } },
              ...Object.entries(s.datos || {}).filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))
                .flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, Array.isArray(v) ? v.join(', ') : String(v))])),
            s.cliente ? el('p', { class:'tiny dim' }, 'Cliente con cuenta: ' + s.cliente) : null,
            s.atendida ? null : el('button', { class:'btn btn-sm btn-win', onclick:async () => {
              try{ await marcarAtendida(s.id); toast('Marcada como atendida', 'win'); pintar(); }
              catch(e){ toast(e.message, 'bad'); }
            } }, 'Marcar como atendida'))))
        : el('p', { class:'muted' }, filtro === 'pendientes' ? 'No hay solicitudes pendientes.' : 'Todavía no llegó ninguna solicitud.'));
  }
  pintar();
  return cont;
}
