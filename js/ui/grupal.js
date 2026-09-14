/* ============================================================
   NiJu — Compra grupal y preventa (vista pública)
   Cuanta más gente se suma, más barato para todos. El cliente
   invita porque le conviene: el marketing lo hacen ellos.
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import { campanias, estadoCampania, reservar, resultadoCampania, SENA_PCT, crearCampania, sincronizar, estadoSync,
  pendiente, olvidarPendiente, campaniaPara, proponerCampania } from '../engine/grupal.js';
import { FAMILIAS } from '../data/nicho-maquinas.js';
import { store } from '../state.js';
import { esDueno } from '../engine/sesion.js';
import { foto } from './components.js';

export function vistaGrupal(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div');

  function pintar(){
    const cs = campanias();
    const abiertas = cs.filter(c => ['abierta','alcanzada'].includes(estadoCampania(c).estado));
    const cerradas = cs.filter(c => !['abierta','alcanzada'].includes(estadoCampania(c).estado));
    const p = pendiente();

    cuerpo.replaceChildren(...[
      p ? seccionPendiente(p, ir, pintar) : null,
      el('section', { class:'section' },
        el('div', { class:'kicker' }, 'Comprá con otros'),
        avisoSync(),
        el('h1', { style:{ marginBottom:'8px' } }, 'Cuantos más somos, más barato'),
        el('p', { class:'muted', style:{ maxWidth:'74ch', marginBottom:'8px' } },
          'Juntamos a todos los que quieren lo mismo y compramos de una. Baja el flete por kilo, se alcanza el mínimo del proveedor, y el precio baja para todos: también para el que reservó primero.'),
        el('div', { class:'grid g-3', style:{ marginTop:'16px' } },
          comoFunciona('1', 'Reservás', 'Elegís cuántas unidades querés. En preventa dejás una seña del ' + Math.round(SENA_PCT * 100) + '%.'),
          comoFunciona('2', 'Se suma gente', 'Cada vez que alguien entra, el precio baja un escalón. Para todos, sin excepciones.'),
          comoFunciona('3', 'Compramos y llega', 'Al llegar al mínimo compramos. Si no se llega, te devolvemos el 100%.'))),

      abiertas.length ? el('section', { class:'section' },
        el('h2', { style:{ marginBottom:'14px' } }, 'Campañas abiertas'),
        el('div', { class:'grid g-2' }, ...abiertas.map(c => tarjeta(c, pintar)))) : null,

      /* Sin campañas: el cliente arma una desde su producto; el Panel es solo del dueño
         (antes el botón mandaba a todos a la clave del dueño). */
      !cs.length && !p ? el('div', { class:'card center', style:{ padding:'44px' } },
        el('div', { style:{ fontSize:'40px' } }, '🤝'),
        el('h3', { style:{ margin:'10px 0 6px' } }, 'Todavía no hay compras grupales abiertas'),
        el('p', { class:'muted tiny', style:{ maxWidth:'52ch', margin:'0 auto 14px' } },
          esDueno() ? 'Lanzá una desde el Panel, en Radar de oportunidades: elegís un producto y se arma sola con sus escalones de precio.'
            : 'Pegá el link de lo que querés en "Traelo por mí". Si traerlo solo sale caro, desde ahí abrís la compra grupal con tu producto ya calculado.'),
        esDueno() ? el('button', { class:'btn btn-win', onclick:() => ir('#/panel') }, 'Ir al Panel')
          : el('button', { class:'btn btn-win', onclick:() => ir('#/pedido') }, ic('mundo'), 'Cotizar un producto')) : null,

      cerradas.length ? el('section', { class:'section' },
        el('h2', { style:{ marginBottom:'14px' } }, 'Cerradas'),
        el('div', { class:'grid g-2' }, ...cerradas.map(c => tarjeta(c, pintar)))) : null
    ].filter(Boolean));
  }

  pintar();
  sincronizar().then(pintar);
  raiz.append(cuerpo);
  return raiz;
}

function avisoSync(){
  if (estadoSync.remoto) return null;
  return el('div', { class:'notice notice-bad', style:{ marginBottom:'12px' } },
    el('b', {}, 'Las campañas están guardadas solo en este dispositivo. '),
    'Para que varias personas puedan sumarse de verdad hay que crear el almacén KV en Cloudflare (está explicado en backend/DESPLIEGUE.md). ',
    estadoSync.error ? el('div', { class:'tiny dim', style:{ marginTop:'4px' } }, 'Detalle: ' + estadoSync.error) : null);
}

/* ---------------- El producto que viene de "Traelo por mí" ---------------- */
function seccionPendiente(p, ir, refrescar){
  const existente = campaniaPara({ titulo:p.titulo, url:p.url });
  const ahorro = p.soloARS > 0 ? Math.round((1 - p.grupoARS / p.soloARS) * 100) : 0;
  const irACampania = id => setTimeout(() => document.getElementById(`camp-${id}`)?.scrollIntoView({ behavior:'smooth', block:'center' }), 60);

  const nombre = el('input', { class:'inp', placeholder:'Tu nombre', value:store.get('usuario')?.nombre || '' });
  const email  = el('input', { class:'inp', type:'email', placeholder:'tu@email.com', value:store.get('usuario')?.email || '' });
  const cant   = el('input', { class:'inp', type:'number', min:'1', value:String(p.unidades || 1) });

  const abrir = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
    if (!nombre.value.trim()) return toast('Poné tu nombre para reservar tu lugar', 'bad');
    abrir.disabled = true;
    try{
      const c = await proponerCampania({ titulo:p.titulo, imagen:p.imagen, itemRef:p.url, precioSolo:p.soloARS, precioGrupo:p.grupoARS,
        meta:p.meta, nombre:nombre.value.trim(), email:email.value.trim(), cantidad:Math.max(1, +cant.value || 1), notas:p.motivo });
      olvidarPendiente();
      toast('¡Compra grupal abierta y tu lugar reservado! Invitá a otros para que baje el precio', 'win');
      refrescar(); irACampania(c.id);
    }catch(e){ toast(e.message || 'No se pudo abrir la compra grupal', 'bad'); abrir.disabled = false; }
  } }, ic('carrito'), 'Abrir la compra grupal y reservar mi lugar');

  return el('section', { class:'g-pend' },
    el('div', { class:'g-prod' },
      foto({ imagen:p.imagen, titulo:p.titulo }, 'g-prod-foto'),
      el('div', { class:'g-prod-txt' },
        el('small', {}, p.tienda ? `Tu producto en ${p.tienda}` : 'Tu producto'),
        el('h2', {}, p.titulo || 'Tu producto'),
        p.motivo ? el('p', {}, p.motivo) : null,
        el('div', { class:'g-comp' },
          el('div', {}, el('small', {}, 'Si lo traés solo'), el('b', { class:'g-solo' }, p.soloARS ? plata(p.soloARS) : '—'), el('span', {}, 'por unidad')),
          el('div', { class:'g-comp-grupo' }, el('small', {}, `Comprando entre ${p.meta}`), el('b', {}, p.grupoARS ? plata(p.grupoARS) : '—'),
            el('span', {}, ahorro > 0 ? `${ahorro}% menos por unidad, estimado` : 'estimado por unidad'))))),

    existente
      ? el('div', { class:'g-accion' },
          el('div', { class:'notice notice-ok' }, el('b', {}, 'Ya hay una compra grupal abierta de este producto. '),
            `Van ${estadoCampania(existente).reservadas} de ${existente.meta}: sumate y el precio baja para todos.`),
          el('div', { class:'row wrapf' },
            el('button', { class:'btn btn-lg btn-win spacer', onclick:() => abrirReserva(existente, () => { olvidarPendiente(); refrescar(); irACampania(existente.id); }) },
              ic('carrito'), 'Sumarme a esta compra grupal'),
            el('button', { class:'btn', onclick:() => irACampania(existente.id) }, 'Ver la campaña')))
      : el('div', { class:'g-accion' },
          el('h3', {}, 'Abrí la compra grupal de este producto'),
          el('p', { class:'tiny muted' }, `Queda abierta ${14} días para que se sume gente. Cada vez que alguien entra, el precio baja un escalón para todos. Si no se llega a ${p.meta} unidades, no se compra y no pagás nada.`),
          el('div', { class:'grid g-3' },
            el('div', { class:'field' }, el('label', {}, 'Nombre'), nombre),
            el('div', { class:'field' }, el('label', {}, 'Email para avisarte'), email),
            el('div', { class:'field' }, el('label', {}, 'Cuántas unidades querés'), cant)),
          abrir),

    el('div', { class:'row wrapf', style:{ marginTop:'10px', gap:'14px' } },
      el('button', { class:'p-link tiny', onclick:() => history.back() }, '← Volver al cálculo'),
      el('button', { class:'p-link tiny', onclick:() => { olvidarPendiente(); refrescar(); } }, 'Quitar este producto')),
    el('p', { class:'c-legal' }, 'El precio en grupo es una estimación con el mismo cálculo de "Traelo por mí" para todas las unidades juntas: el flete, el depósito y el despachante se reparten. El precio final lo confirmamos al cerrar la compra.'));
}

const comoFunciona = (n, t, d) => el('div', { class:'card' },
  el('div', { class:'row', style:{ marginBottom:'6px' } },
    el('span', { class:'step-n' }, n), el('b', {}, t)),
  el('p', { class:'tiny muted' }, d));

function tarjeta(c, refrescar){
  const e = estadoCampania(c);
  const fam = FAMILIAS.find(f => f.id === c.familiaId);
  const colorEstado = { abierta:'var(--accion)', alcanzada:'var(--win)', 'lista-para-comprar':'var(--win)',
                        'no-alcanzo':'var(--bad)', cerrada:'var(--tx-3)' }[e.estado];

  return el('div', { class:'card', id:`camp-${c.id}`, style:{ borderTop:`3px solid ${colorEstado}` } },
    el('div', { class:'row', style:{ gap:'14px', alignItems:'flex-start', marginBottom:'12px' } },
      foto({ imagen:c.imagen, titulo:c.titulo }, '', ),
      el('div', { class:'spacer' },
        el('div', { class:'row', style:{ gap:'7px', marginBottom:'4px' } },
          el('span', { class:'tag ' + (c.tipo === 'preventa' ? 'tag-niju' : 'tag-nac') },
            c.tipo === 'preventa' ? 'Preventa con seña' : 'Compra grupal'),
          e.estado === 'alcanzada' ? el('span', { class:'tag tag-win' }, '¡Mínimo alcanzado!') : null),
        el('h3', {}, c.titulo),
        fam ? el('div', { class:'tiny dim' }, fam.emo + ' ' + fam.nombre) : null)),

    el('div', { class:'row-b', style:{ marginBottom:'6px' } },
      el('div', {},
        el('span', { class:'tiny strike' }, plata(c.precioBase)),
        el('div', { class:'price price-xl', style:{ color:'var(--win-tx)' } }, plata(e.precio)),
        e.descuento ? el('div', { class:'saving' }, `${e.descuento}% menos que el precio de lista`) : null),
      el('div', { style:{ textAlign:'right' } },
        el('div', { class:'kicker' }, 'Reservadas'),
        el('b', { style:{ fontSize:'22px' } }, `${e.reservadas}/${e.meta}`),
        el('div', { class:'tiny dim' }, e.diasRestantes + ' días restantes'))),

    el('div', { class:'bar', style:{ marginBottom:'8px' } },
      el('i', { style:{ width:e.avance + '%', background:colorEstado } })),

    el('div', { class:'notice ' + (e.estado === 'no-alcanzo' ? 'notice-bad' : e.alcanzada ? 'notice-ok' : ''), style:{ marginBottom:'12px' } },
      e.mensaje),

    /* escalones de precio */
    el('div', { style:{ marginBottom:'12px' } },
      el('div', { class:'kicker', style:{ marginBottom:'6px' } }, 'Escalones de precio'),
      ...c.tramos.map(t => {
        const activo = e.tramo.desde === t.desde;
        const logrado = e.reservadas >= t.desde;
        return el('div', { class:'row-b tiny', style:{
          padding:'5px 8px', borderRadius:'var(--r)',
          background: activo ? 'var(--accion-suave)' : 'transparent',
          opacity: logrado || activo ? 1 : .55
        }},
          el('span', {}, (logrado ? '✓ ' : '') + `Desde ${t.desde} unidades`),
          el('b', { class:'mono', style:{ color: activo ? 'var(--accion)' : '' } }, plata(t.precio)));
      })),

    e.estado === 'abierta' || e.estado === 'alcanzada'
      ? el('div', { class:'row wrapf' },
          el('button', { class:'btn btn-win spacer', onclick:() => abrirReserva(c, refrescar) },
            ic('carrito'), c.tipo === 'preventa' ? `Reservar con ${Math.round(SENA_PCT*100)}% de seña` : 'Sumarme a la compra'),
          el('button', { class:'btn', title:'Copiar el enlace para invitar', onclick:() => {
            const txt = `Sumate a la compra grupal de ${c.titulo} en NiJu: cuantos más seamos, más barato para todos. Ahora está ${plata(e.precio)}.`;
            navigator.clipboard?.writeText(txt);
            toast('Mensaje copiado: mandáselo a quien quieras', 'win');
          } }, ic('megafono'), 'Invitar'))
      : null,

    /* lo que ve el dueño */
    resultadoDueno(c, e)
  );
}

/* Margen y capital: solo el dueño. Antes lo veía cualquier cliente con cuenta. */
function resultadoDueno(c, e){
  if (!esDueno()) return null;
  const fam = FAMILIAS.find(f => f.id === c.familiaId);
  const costoUnit = fam ? Math.round(c.precioBase * 0.42) : Math.round(c.precioBase * 0.55);
  const r = resultadoCampania(c, costoUnit);
  return el('details', { style:{ marginTop:'12px' } },
    el('summary', { class:'tiny dim', style:{ cursor:'pointer' } }, 'Ver números de la campaña (solo vos)'),
    el('div', { style:{ paddingTop:'8px' } },
      fila('Unidades comprometidas', String(r.unidades)),
      fila('Precio vigente', plata(r.precio)),
      fila('Ingreso', plata(r.ingreso)),
      fila('Costo estimado', plata(r.costo)),
      fila('Margen', plata(r.margen) + ` (${r.margenPct}%)`),
      fila(c.tipo === 'preventa' ? 'Capital que ponés vos (ya descontadas las señas)' : 'Capital que ponés vos', plata(r.capitalNecesario)),
      c.tipo === 'preventa' ? el('div', { class:'notice notice-ok', style:{ marginTop:'8px' } },
        'Con preventa el cliente financia parte de la compra. Ese es el truco: vendés antes de comprar.') : null));
}

function abrirReserva(c, refrescar){
  const e = estadoCampania(c);
  const nombre = el('input', { class:'inp', placeholder:'Tu nombre', value:store.get('usuario')?.nombre || '' });
  const email  = el('input', { class:'inp', type:'email', placeholder:'tu@email.com', value:store.get('usuario')?.email || '' });
  const cant   = el('input', { class:'inp', type:'number', min:'1', value:'1' });
  const resumen = el('div');

  const actualizar = () => {
    const n = Math.max(1, +cant.value || 1);
    const sena = c.tipo === 'preventa' ? Math.round(e.precio * n * SENA_PCT) : 0;
    resumen.replaceChildren(
      fila('Precio unitario de hoy', plata(e.precio)),
      fila('Cantidad', String(n)),
      fila('Total', plata(e.precio * n)),
      c.tipo === 'preventa' ? el('div', { class:'cost-line total' },
        el('span', {}, `Seña a pagar ahora (${Math.round(SENA_PCT*100)}%)`), el('b', {}, plata(sena))) : null,
      el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
        'Si el precio baja porque se suma más gente, te lo cobramos al precio más bajo. Nunca pagás más de lo que termina saliendo.'));
  };
  cant.addEventListener('input', actualizar);
  actualizar();

  const { cerrar } = hoja({ titulo:c.tipo === 'preventa' ? 'Reservar con seña' : 'Sumarme a la compra grupal',
    cuerpo: el('div', { class:'col' },
      el('div', { class:'field' }, el('label', {}, 'Nombre'), nombre),
      el('div', { class:'field' }, el('label', {}, 'Email'), email),
      el('div', { class:'field' }, el('label', {}, 'Cuántas unidades'), cant),
      resumen,
      el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
        if (!nombre.value.trim()) return toast('Poné tu nombre', 'bad');
        reservar(c.id, { nombre:nombre.value.trim(), email:email.value.trim(), cantidad:Math.max(1, +cant.value || 1) })
          .then(() => { toast('¡Reserva tomada! Te avisamos cuando se llegue al mínimo', 'win'); cerrar(); refrescar(); });
      } }, 'Confirmar reserva'),
      el('p', { class:'tiny dim center' },
        'Si no se llega al mínimo antes del cierre, te devolvemos el 100% sin preguntas.')) });
}

const fila = (k, v) => el('div', { class:'cost-line' },
  el('span', { class:'lbl' }, k), el('span', { class:'mono' }, v));
