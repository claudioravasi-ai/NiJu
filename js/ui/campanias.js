/* ============================================================
   NiJu — Panel: campañas por fecha y beneficios a clientes
   Las campañas se arman solas con el calendario. Una semana antes
   quedan para revisar; en su fecha arrancan solas salvo que las
   frenes. Los beneficios de "Más comprás, más ahorrás" no se
   otorgan nunca solos: aparecen acá y los aprobás vos.
   ============================================================ */
import { el, plata, ic, toast, hoja } from '../util.js';
import { listarOrdenes } from '../engine/ordenes.js';
import { campaniasCalculadas, leerPromosDueno, guardarPromosDueno, candidatos, NIVELES_INICIALES, aTextoFecha } from '../engine/promos.js';

const ESTADO = {
  'programada':   { texto:'Programada', clase:'' },
  'por-arrancar': { texto:'Para revisar', clase:'warn' },
  'en-curso':     { texto:'En curso', clase:'ok' },
  'frenada':      { texto:'Frenada', clase:'bad' },
  'terminada':    { texto:'Terminada', clase:'' }
};
const diaMes = f => f.toLocaleDateString('es-AR', { day:'numeric', month:'long' });

export function vistaCampanias(){
  const cont = el('div', { class:'section' }, el('div', { class:'v-sk', style:{ height:'240px' } }));
  let datos = null, ordenes = [];

  async function cargar(){
    try{
      [datos, ordenes] = await Promise.all([leerPromosDueno(), listarOrdenes({ dueno:true }).catch(() => [])]);
      pintar();
    }catch(e){
      cont.replaceChildren(el('div', { class:'notice notice-bad' },
        el('b', {}, 'Falta activar las promociones en el servidor. '),
        'Volvé a pegar backend/worker.js en Cloudflare (Edit code → pegar → Deploy). Mientras tanto el cartel no muestra ninguna campaña y no se otorga ningún beneficio.',
        el('div', { class:'tiny dim', style:{ marginTop:'6px' } }, String(e.message || e))));
    }
  }

  async function guardar(mensaje){
    try{
      datos = await guardarPromosDueno(datos);
      toast(mensaje, 'win');
      window.dispatchEvent(new Event('niju:campanias'));
      pintar();
    }catch(e){ toast(e.message || 'No se pudo guardar', 'bad'); }
  }

  const decidir = (c, estado, mensaje) => {
    datos.campanias[c.id] = { ...(datos.campanias[c.id] || {}), estado, decidida:Date.now() };
    guardar(mensaje);
  };

  function editar(c){
    const f = { titulo:c.titulo, texto:c.texto, busqueda:c.busqueda, inicio:aTextoFecha(c.inicio), fin:aTextoFecha(c.fin) };
    const campo = (etiqueta, clave, tipo = 'text', ayuda = '') => el('div', { class:'field' }, el('label', {}, etiqueta),
      tipo === 'area'
        ? el('textarea', { class:'inp', oninput:e => f[clave] = e.target.value }, f[clave])
        : el('input', { class:'inp', type:tipo, value:f[clave], oninput:e => f[clave] = e.target.value }),
      ayuda ? el('div', { class:'tiny dim' }, ayuda) : null);
    let ventana = null;
    ventana = hoja({ titulo:`Editar: ${c.nombre}`, ancho:620, cuerpo:el('div', { class:'col' },
      campo('Título del cartel', 'titulo'),
      campo('Texto', 'texto', 'area', 'Contá qué incluye. Si prometés un descuento, tiene que poder cumplirse.'),
      campo('Qué busca al tocarlo', 'busqueda', 'text', 'Por ejemplo: perfume, taladro, juguete.'),
      el('div', { class:'grid g-2' }, campo('Empieza', 'inicio', 'date'), campo('Termina', 'fin', 'date')),
      c.confirmar ? el('div', { class:'notice' }, 'La fecha de esta campaña la define cada año la Cámara Argentina de Comercio Electrónico. Confirmala y corregila acá.') : null,
      el('button', { class:'btn btn-win btn-lg btn-block', onclick:() => {
        if (!f.titulo.trim() || !f.inicio || !f.fin || f.fin < f.inicio) return toast('Revisá el título y las fechas', 'bad');
        datos.campanias[c.id] = { ...(datos.campanias[c.id] || {}), ...f, estado:'aprobada', decidida:Date.now() };
        ventana.cerrar();
        guardar('Campaña editada y aprobada');
      } }, 'Guardar y aprobar')) });
  }

  function pintarCampania(c){
    const e = ESTADO[c.estado];
    const cuando = c.estado === 'en-curso' ? `Hasta el ${diaMes(c.fin)}`
      : c.estado === 'frenada' ? `Iba del ${diaMes(c.inicio)} al ${diaMes(c.fin)}`
      : `Arranca ${c.diasParaArrancar <= 1 ? 'mañana' : `en ${c.diasParaArrancar} días`}: del ${diaMes(c.inicio)} al ${diaMes(c.fin)}`;
    const aprobada = c.decision === 'aprobada';
    return el('article', { class:'k-camp', style:`--cc:${c.color}` },
      el('div', { class:'k-camp-banda' }),
      el('div', { class:'k-camp-cuerpo' },
        el('div', { class:'k-camp-head' },
          el('div', {}, el('h3', {}, c.nombre), el('small', {}, `${c.alcance} · ${cuando}`)),
          el('span', { class:'k-estado ' + e.clase }, e.texto)),
        el('div', { class:'k-vista' }, el('b', {}, c.titulo), el('span', {}, c.texto), el('small', {}, `Al tocarlo busca: “${c.busqueda}”`)),
        c.confirmar && !c.editada ? el('p', { class:'k-ojo' }, ic('alerta'), 'Fecha estimada: confirmala con la CACE.') : null,
        el('p', { class:'k-decision' },
          c.estado === 'frenada' ? 'La frenaste: no se muestra.'
          : aprobada ? `Aprobada${c.editada ? ' con cambios' : ''}.`
          : c.estado === 'en-curso' ? 'Arrancó sola porque no la frenaste.'
          : c.estado === 'por-arrancar' ? 'Si no la frenás, arranca sola en su fecha.' : 'Todavía falta: podés dejarla aprobada.'),
        el('div', { class:'c-acciones' },
          c.estado === 'frenada'
            ? el('button', { class:'btn btn-sm btn-win', onclick:() => decidir(c, 'aprobada', 'Campaña reactivada') }, ic('check'), 'Reactivar')
            : [ !aprobada ? el('button', { class:'btn btn-sm btn-win', onclick:() => decidir(c, 'aprobada', 'Campaña aprobada') }, ic('check'), 'Aprobar') : null,
                el('button', { class:'btn btn-sm', onclick:() => decidir(c, 'frenada', 'Campaña frenada') }, ic('x'), 'Frenar') ],
          el('button', { class:'btn btn-sm', onclick:() => editar(c) }, 'Editar'))));
  }

  function editarNiveles(){
    const niveles = structuredClone(datos.niveles || NIVELES_INICIALES);
    let ventana = null;
    const fila = n => el('div', { class:'grid g-4', style:{ alignItems:'end' } },
      ...[['Nombre', 'nombre', 'text'], ['Compras pagadas', 'compras', 'number'], ['Gasto mínimo ($)', 'gastoARS', 'number'], ['Descuento en gestión (%)', 'pct', 'number']]
        .map(([etiqueta, clave, tipo]) => el('div', { class:'field' }, el('label', {}, etiqueta),
          el('input', { class:'inp', type:tipo, value:n[clave], oninput:e => n[clave] = tipo === 'number' ? +e.target.value : e.target.value }))));
    ventana = hoja({ titulo:'Niveles de "Más comprás, más ahorrás"', ancho:760, cuerpo:el('div', { class:'col' },
      el('p', { class:'c-sub' }, 'Son un punto de partida para ajustar a tu margen. El descuento se aplica sobre la gestión de NiJu, nunca sobre el precio de la tienda.'),
      ...niveles.map(fila),
      el('button', { class:'btn btn-win btn-lg btn-block', onclick:() => {
        if (niveles.some(n => !n.nombre || n.compras < 1 || n.pct < 0 || n.pct > 100)) return toast('Revisá los valores', 'bad');
        datos.niveles = niveles; ventana.cerrar(); guardar('Niveles guardados');
      } }, 'Guardar niveles')) });
  }

  function pintar(){
    const todas = campaniasCalculadas(datos.campanias);
    const vigentes = todas.filter(c => c.estado !== 'terminada');
    const revisar = vigentes.filter(c => (c.estado === 'por-arrancar' || c.estado === 'en-curso') && !c.decision);
    const proximas = vigentes.slice(0, 12);
    const niveles = datos.niveles || NIVELES_INICIALES;
    const clientes = candidatos(ordenes, niveles, datos.beneficios);
    const pendientes = clientes.filter(c => c.pendiente);

    cont.replaceChildren(
      el('div', { class:'k-resumen' },
        el('div', { class:'c-kpi ' + (revisar.length ? 'warn' : '') }, el('span', { class:'c-kpi-txt' },
          el('small', {}, 'Campañas para revisar'), el('b', {}, String(revisar.length)), el('span', {}, 'arrancan en 7 días o menos'))),
        el('div', { class:'c-kpi ok' }, el('span', { class:'c-kpi-txt' },
          el('small', {}, 'En curso'), el('b', {}, String(vigentes.filter(c => c.estado === 'en-curso').length)), el('span', {}, 'se ven en el cartel'))),
        el('div', { class:'c-kpi ' + (pendientes.length ? 'warn' : '') }, el('span', { class:'c-kpi-txt' },
          el('small', {}, 'Beneficios para aprobar'), el('b', {}, String(pendientes.length)), el('span', {}, 'clientes que alcanzaron un nivel')))),

      el('h2', { class:'c-seccion' }, 'Campañas por fecha'),
      el('p', { class:'c-sub' }, 'Se arman solas con el calendario comercial. Una semana antes aparecen para revisar; en su fecha arrancan solas salvo que las frenes. Te avisamos cuando se arma y cuando arranca cada una.'),
      el('div', { class:'k-camps' }, ...proximas.map(pintarCampania)),

      el('div', { class:'row-b wrapf', style:{ marginTop:'26px' } },
        el('div', {}, el('h2', { class:'c-seccion', style:{ margin:'0' } }, 'Más comprás, más ahorrás'),
          el('p', { class:'c-sub' }, 'Ningún beneficio se otorga solo: los clientes que alcanzan un nivel aparecen acá y vos decidís.')),
        el('button', { class:'btn btn-sm', onclick:editarNiveles }, 'Editar niveles')),
      el('div', { class:'k-niveles' }, ...niveles.map(n => el('div', { class:'k-nivel' },
        el('b', {}, n.nombre), el('span', {}, `${n.compras}+ compras pagadas y ${plata(n.gastoARS)} gastados`), el('em', {}, `${n.pct}% menos en la gestión`)))),

      clientes.length ? el('div', { class:'tbl-wrap', style:{ marginTop:'12px' } }, el('table', { class:'tbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Cliente'), el('th', {}, 'Compras pagadas'), el('th', {}, 'Gastado'), el('th', {}, 'Nivel'), el('th', {}, ''))),
        el('tbody', {}, ...clientes.map(c => el('tr', { class:c.pendiente ? 'is-win' : '' },
          el('td', {}, el('b', {}, c.nombre), el('div', { class:'tiny dim' }, c.email)),
          el('td', { class:'mono' }, String(c.compras)),
          el('td', { class:'mono' }, plata(c.gastoARS)),
          el('td', {}, c.nivel ? c.nivel.nombre : el('span', { class:'dim' }, 'Todavía no'),
            c.otorgado ? el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, `Otorgado: ${c.otorgado.nombre} (${c.otorgado.pct}%)`) : null),
          el('td', {},
            c.pendiente ? el('button', { class:'btn btn-sm btn-win', onclick:() => {
              datos.beneficios[c.email] = { nivel:c.nivel.id, nombre:c.nivel.nombre, pct:c.nivel.pct, otorgado:Date.now(), compras:c.compras, gastoARS:c.gastoARS };
              guardar(`Beneficio otorgado a ${c.nombre}`);
            } }, `Otorgar ${c.nivel.pct}%`) : null,
            c.otorgado ? el('button', { class:'btn btn-sm', onclick:() => { delete datos.beneficios[c.email]; guardar('Beneficio quitado'); } }, 'Quitar') : null)))))
      ) : el('p', { class:'c-sub' }, 'Todavía no hay clientes con compras pagadas.'));
  }

  cargar();
  return cont;
}
