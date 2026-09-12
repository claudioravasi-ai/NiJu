/* ============================================================
   NiJu — Cuenta del cliente
   ============================================================ */
import { el, plata, num, ic, toast, fecha } from '../util.js';
import { store } from '../state.js';
import { PERFILES, carpetaAnual } from '../engine/fiscal.js';
import { PRODUCTO_BY_ID } from '../data/catalog.js';
import { CANALES } from '../engine/marketing.js';
import { misOrdenes } from './ordenes.js';

const PROVINCIAS = ['Ciudad Autónoma de Buenos Aires','Buenos Aires','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];

export function vistaCuenta(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div', { class:'section' });
  raiz.append(cuerpo);

  function pintar(){
    const u = store.get('usuario');
    if (!u){ cuerpo.replaceChildren(ingreso(pintar)); return; }

    const cfg = store.get('config');
    const perfil = PERFILES[u.perfilFiscal || 'consumidor_final'];
    const compras = store.get('comprasAnio');
    const carpeta = carpetaAnual(compras, u.perfilFiscal || 'consumidor_final');
    const favs = store.get('favoritos');

    cuerpo.replaceChildren(
      el('div', { class:'row-b', style:{ marginBottom:'18px' } },
        el('div', { class:'row' },
          el('div', { class:'brand-mark', style:{ width:'52px', height:'52px', fontSize:'20px' } }, (u.nombre || 'N')[0].toUpperCase()),
          el('div', {}, el('h2', {}, u.nombre), el('div', { class:'tiny dim' }, u.email || ''),
            el('span', { class:'tag', style:{ color:perfil.color, marginTop:'4px' } }, perfil.label))),
        el('button', { class:'btn btn-sm', onclick:() => { store.set('usuario', null); pintar(); } }, 'Cerrar sesión')),

      el('div', { class:'grid g-4', style:{ marginBottom:'20px' } },
        kpi('Compras del año', String(compras.length)),
        kpi('Total gastado', plata(carpeta.totales.gastado)),
        kpi('A favor en ARCA', plata(carpeta.totales.saldoACuenta), 'percepciones', 'var(--nac)'),
        kpi('Favoritos', String(favs.length))),

      el('div', { class:'grid g-2' },
        el('div', { class:'card' },
          el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Datos fiscales'),
          campo('Nombre o razón social', u.nombre, v => actualizar({ nombre:v })),
          campo('Email', u.email || '', v => actualizar({ email:v })),
          campo('CUIT / CUIL', u.cuit || '', v => actualizar({ cuit:v })),
          el('div', { class:'field' }, el('label', {}, 'Condición ante ARCA'),
            el('select', { class:'inp', onchange:e => actualizar({ perfilFiscal:e.target.value }) },
              ...Object.entries(PERFILES).map(([id, p]) => el('option', { value:id, selected:(u.perfilFiscal || 'consumidor_final') === id || null }, p.label)))),
          el('div', { class:'field' }, el('label', {}, 'Provincia (para IIBB)'),
            el('select', { class:'inp', onchange:e => { store.set('config', { ...cfg, provincia:e.target.value }); } },
              ...PROVINCIAS.map(p => el('option', { value:p, selected:cfg.provincia === p || null }, p)))),
          el('div', { class:'notice', style:{ marginTop:'10px' } }, perfil.desc),
          el('button', { class:'btn btn-win btn-block', style:{ marginTop:'10px' }, onclick:() => ir('#/impuestos') },
            ic('calc'), 'Ver mi carpeta impositiva')),

        el('div', { class:'card' },
          el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Avisos y marketing'),
          el('p', { class:'tiny dim', style:{ marginBottom:'10px' } },
            'Elegí por dónde querés que te avisemos cuando baje algo que te interesa. Podés darte de baja cuando quieras.'),
          ...CANALES.filter(c => ['email','push','whatsapp'].includes(c.id)).map(c =>
            el('label', { class:'switch', style:{ padding:'7px 0' } },
              el('input', { type:'checkbox', checked:(u.canales || ['email']).includes(c.id) || null,
                onchange:e => {
                  const s = new Set(u.canales || ['email']);
                  e.target.checked ? s.add(c.id) : s.delete(c.id);
                  actualizar({ canales:[...s] });
                } }),
              el('span', {}, `${c.emo} ${c.nombre}`, el('div', { class:'tiny dim' }, c.formato)))),
          el('hr', { class:'rule', style:{ margin:'12px 0' } }),
          el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'Alertas de precio'),
          ...(store.get('alertas').length
            ? store.get('alertas').map(a => el('div', { class:'row-b', style:{ padding:'7px 0', borderBottom:'1px solid var(--line-soft)' } },
                el('span', { class:'tiny' }, a.titulo),
                el('b', { class:'tiny mono' }, plata(a.objetivo)),
                el('button', { class:'btn btn-sm btn-ghost', onclick:() => { store.quitar('alertas', x => x.productoId === a.productoId); pintar(); } }, '✕')))
            : [el('p', { class:'tiny dim' }, 'Todavía no creaste ninguna. Entrá a un producto y pedí aviso cuando baje.')]))),

      favs.length ? el('div', { style:{ marginTop:'20px' } },
        el('h3', { style:{ marginBottom:'10px' } }, 'Tus favoritos'),
        el('div', { class:'grid g-auto' }, ...favs.map(id => {
          const p = PRODUCTO_BY_ID[id];
          return p ? el('div', { class:'card hoverable', onclick:() => ir(`#/producto/${id}`) },
            el('div', { style:{ fontSize:'30px' } }, p.emo),
            el('b', { class:'tiny' }, `${p.marca} ${p.n}`)) : null;
        }))) : null,

      misOrdenes(pintar),

      compras.length ? el('div', { style:{ marginTop:'20px' } },
        el('h3', { style:{ marginBottom:'10px' } }, 'Tus compras'),
        el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Fecha'), el('th', {}, 'Detalle'), el('th', {}, 'Tienda'), el('th', {}, 'Total'))),
          el('tbody', {}, ...compras.slice().reverse().map(c => el('tr', {},
            el('td', { class:'tiny' }, fecha(c.fecha)),
            el('td', { class:'tiny' }, c.titulo),
            el('td', { class:'tiny dim' }, c.tienda),
            el('td', { class:'mono tiny' }, plata(c.totalARS)))))))) : null
    );

    function actualizar(patch){ store.set('usuario', { ...store.get('usuario'), ...patch }); pintar(); }
  }

  pintar();
  return raiz;
}

function ingreso(onListo){
  const nombre = el('input', { class:'inp', placeholder:'Tu nombre o razón social' });
  const email  = el('input', { class:'inp', type:'email', placeholder:'tu@email.com' });
  const cuit   = el('input', { class:'inp', placeholder:'CUIT / CUIL (opcional)' });
  const perfil = el('select', { class:'inp' }, ...Object.entries(PERFILES).map(([id, p]) => el('option', { value:id }, p.label)));

  return el('div', { class:'card card-hard', style:{ maxWidth:'440px', margin:'40px auto' } },
    el('div', { class:'kicker' }, 'Entrá a NiJu'),
    el('h2', { style:{ marginBottom:'14px' } }, 'Tu cuenta'),
    el('p', { class:'tiny dim', style:{ marginBottom:'14px' } },
      'Con tu condición fiscal podemos calcular, en cada compra, qué podés computar y qué tenés que declarar.'),
    el('div', { class:'col' },
      el('div', { class:'field' }, el('label', {}, 'Nombre'), nombre),
      el('div', { class:'field' }, el('label', {}, 'Email'), email),
      el('div', { class:'field' }, el('label', {}, 'CUIT / CUIL'), cuit),
      el('div', { class:'field' }, el('label', {}, 'Condición ante ARCA'), perfil),
      el('button', { class:'btn btn-lg btn-win btn-block', onclick:() => {
        if (!nombre.value.trim()) return toast('Poné al menos tu nombre', 'bad');
        store.set('usuario', { nombre:nombre.value.trim(), email:email.value.trim(), cuit:cuit.value.trim(),
          perfilFiscal:perfil.value, canales:['email'], creada:Date.now() });
        toast('¡Bienvenido a NiJu!', 'win'); onListo();
      } }, 'Entrar'),
      el('p', { class:'tiny dim center' },
        'En producción esto es Firebase Authentication (email, Google y teléfono). Acá queda en tu dispositivo.')));
}

const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);

const campo = (label, valor, onChange) => el('div', { class:'field' },
  el('label', {}, label),
  el('input', { class:'inp', value:valor, onchange:e => onChange(e.target.value) }));
