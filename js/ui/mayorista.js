/* ============================================================
   NiJu — Compra por mayor
   Directorio de importadores con verificación real y cotizador
   de importación formal.
   ============================================================ */
import { el, plata, num, ic, toast, hoja } from '../util.js';
import { IMPORTADORES, CHECKS_VERIFICACION, puntajeConfianza, ROLES_LOGISTICA } from '../data/importers.js';
import { RUBROS } from '../data/catalog.js';
import { STORES } from '../data/stores.js';
import { calcularImportacion } from '../engine/taxes.js';
import { calcularFee } from '../engine/fees.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';
import { logoTienda } from './components.js';

export function vistaMayorista(ir){
  const raiz = el('div', { class:'wrap' });
  let rubro = null;
  const listado = el('div');

  const mayoristas = STORES.filter(s => s.mayorista);

  function pintar(){
    const items = IMPORTADORES.filter(i => !rubro || i.rubro === rubro);
    listado.replaceChildren(...[
      el('div', { class:'grid g-2' }, ...items.map(tarjeta)),
      items.length ? null : el('div', { class:'card center', style:{ padding:'30px' } }, 'Sin proveedores en ese rubro todavía.')
    ].filter(Boolean));
  }

  function tarjeta(i){
    const p = puntajeConfianza(i.checks);
    return el('div', { class:'imp' },
      el('div', { class:'imp-av', style:{ background:i.color } }, i.nombre.slice(0,2).toUpperCase()),
      el('div', { class:'spacer' },
        el('div', { class:'row', style:{ gap:'7px' } },
          el('b', {}, i.nombre),
          i.estado === 'demo' ? el('span', { class:'tag tag-warn' }, 'Demo — sin verificar')
            : p.habilitado ? el('span', { class:'tag tag-ok' }, 'Verificado') : el('span', { class:'tag tag-warn' }, 'En revisión')),
        el('div', { class:'tiny dim', style:{ margin:'5px 0' } }, i.desc),
        el('div', { class:'row wrapf tiny' },
          el('span', { class:'chip tiny' }, '📦 MOQ ' + i.moq),
          el('span', { class:'chip tiny' }, '⏱ ' + i.lead),
          el('span', { class:'chip tiny' }, '🌎 ' + i.origen),
          ...i.pago.map(x => el('span', { class:'chip tiny' }, '💳 ' + x))),
        el('div', { style:{ marginTop:'9px' } },
          el('div', { class:'row-b tiny', style:{ marginBottom:'3px' } },
            el('span', { class:'dim' }, 'Puntaje de confianza'),
            el('b', { class:'mono' }, p.puntaje + '/100')),
          el('div', { class:'bar' }, el('i', { style:{ width:p.puntaje + '%', background: p.habilitado ? 'var(--ok)' : 'var(--warn)' } }))),
        el('div', { class:'row', style:{ marginTop:'10px' } },
          el('button', { class:'btn btn-sm', onclick:() => verChecks(i, p) }, 'Ver verificación'),
          el('button', { class:'btn btn-sm btn-win', disabled:!p.habilitado || null,
            onclick:() => toast('Pedido de cotización enviado', 'win') }, 'Pedir cotización'))));
  }

  function verChecks(i, p){
    hoja({ titulo:'Verificación de ' + i.nombre, cuerpo:el('div', {},
      el('p', { class:'muted tiny', style:{ marginBottom:'12px' } },
        'Un proveedor se publica como verificado solo si suma 70 puntos y cumple TODOS los controles críticos.'),
      ...CHECKS_VERIFICACION.map(c => el('div', { class:'row', style:{ padding:'8px 0', borderBottom:'1px solid var(--line-soft)' } },
        el('span', { style:{ color: i.checks[c.id] ? 'var(--ok)' : 'var(--tx-3)', fontSize:'16px' } }, i.checks[c.id] ? '✔' : '○'),
        el('span', { class:'spacer tiny' }, c.label, c.critico ? el('b', { style:{ color:'var(--bad)' } }, ' · crítico') : null),
        el('b', { class:'tiny mono' }, '+' + c.peso))),
      el('div', { class:'notice' + (p.habilitado ? ' notice-ok' : ' notice-bad'), style:{ marginTop:'12px' } },
        p.habilitado ? 'Proveedor habilitado para operar en NiJu.'
          : p.faltaCritico ? 'No habilitado: falta al menos un control crítico.' : 'No habilitado: puntaje insuficiente.'))});
  }

  raiz.append(el('section', { class:'section' },
    el('div', { class:'kicker' }, 'Del deseo al contenedor'),
    el('h1', { style:{ marginBottom:'10px' } }, 'Comprá por mayor'),
    el('p', { class:'muted', style:{ maxWidth:'72ch', marginBottom:'18px' } },
      'Plataformas mayoristas conectadas, importadores verificados y el costo real de nacionalizar puesto sobre la mesa antes de que pongas un peso.'),

    el('div', { class:'notice notice-bad', style:{ marginBottom:'18px' } },
      'Los proveedores listados abajo son registros DE EJEMPLO. Ninguno está verificado todavía: el alta real exige CUIT activo, inscripción en el Registro de Importadores, referencias comerciales chequeadas y contrato firmado.'),

    el('h3', { style:{ marginBottom:'10px' } }, 'Plataformas mayoristas conectadas'),
    el('div', { class:'grid g-4', style:{ marginBottom:'24px' } },
      ...mayoristas.map(t => el('div', { class:'card hoverable', onclick:() => ir(`#/buscar?mayorista=1&tienda=${t.id}`) },
        el('div', { class:'row' }, logoTienda(t.id, true),
          el('div', {}, el('b', {}, t.nombre), el('div', { class:'tiny dim' }, t.pais + ' · MOQ ' + (t.moq || 1)))),
        el('p', { class:'tiny dim', style:{ marginTop:'8px' } }, t.integracion.notas)))),

    el('h3', { style:{ marginBottom:'10px' } }, 'Cotizador de importación formal'),
    cotizador(),

    el('div', { class:'row-b', style:{ margin:'28px 0 12px' } },
      el('h3', {}, 'Importadores'),
      el('select', { class:'inp', style:{ width:'auto' }, onchange:e => { rubro = e.target.value || null; pintar(); } },
        el('option', { value:'' }, 'Todos los rubros'),
        ...RUBROS.map(r => el('option', { value:r.id }, r.nombre)))),
    listado,

    el('h3', { style:{ margin:'28px 0 10px' } }, 'Quién hace qué en una importación'),
    el('div', { class:'grid g-4' }, ...ROLES_LOGISTICA.map(r => el('div', { class:'card' },
      el('b', {}, r.nombre), el('p', { class:'tiny dim', style:{ marginTop:'5px' } }, r.desc))))
  ));

  pintar();
  return raiz;
}

function cotizador(){
  const e = { unidades:100, precioUnitUSD:8.5, pesoUnitKg:0.4, fleteUSD:900, rubro:'hogar' };
  const out = el('div');

  const campo = (l, k, paso = '1') => el('div', { class:'field' }, el('label', {}, l),
    el('input', { class:'inp', type:'number', step:paso, value:String(e[k]), oninput:ev => { e[k] = +ev.target.value || 0; calc(); } }));

  function calc(){
    const valorUSD = e.unidades * e.precioUnitUSD;
    const pesoKg = e.unidades * e.pesoUnitKg;
    const r = calcularImportacion({ valorUSD, fleteUSD:e.fleteUSD, pesoKg, rubro:e.rubro, unidades:e.unidades, regimen:'general' });
    const fee = calcularFee({ valorUSD, fleteUSD:e.fleteUSD, tipo:'mayorista' });
    const totalUSD = r.total + fee.feeUSD;
    const unitario = totalUSD / e.unidades;

    out.replaceChildren(
      el('div', { class:'grid g-4', style:{ marginBottom:'12px' } },
        kpi('Costo unitario final', 'US$ ' + unitario.toFixed(2), plata(unitario * FX.tarjeta)),
        kpi('Inversión total', 'US$ ' + totalUSD.toFixed(0), plata(totalUSD * FX.tarjeta)),
        kpi('Carga impositiva', r.tasaEfectiva + '%', 'sobre el valor FOB'),
        kpi('Recuperable (RI)', 'US$ ' + r.recuperable.toFixed(0), 'IVA y percepciones', 'var(--ok)')),
      el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
        el('tbody', {}, ...r.lineas.map(l => el('tr', {},
          el('td', {}, l.k, l.recuperable ? el('span', { class:'tag tag-ok', style:{ marginLeft:'6px' } }, 'recuperable') : null),
          el('td', { class:'mono', style:{ textAlign:'right' } }, 'US$ ' + l.v.toFixed(2)))),
          el('tr', {}, el('td', {}, 'Gestión NiJu (3,5% del CIF)'), el('td', { class:'mono', style:{ textAlign:'right' } }, 'US$ ' + fee.feeUSD.toFixed(2))),
          el('tr', { class:'is-win' }, el('td', {}, el('b', {}, 'Total puesto en depósito')),
            el('td', { class:'mono', style:{ textAlign:'right' } }, el('b', {}, 'US$ ' + totalUSD.toFixed(2))))))),
      el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
        `Si sos Responsable Inscripto, el costo real baja a US$ ${(totalUSD - r.recuperable).toFixed(0)} — US$ ${((totalUSD - r.recuperable) / e.unidades).toFixed(2)} por unidad.`));
  }

  const form = el('div', { class:'card card-hard' },
    el('div', { class:'grid g-3' },
      campo('Unidades', 'unidades'),
      campo('Precio unitario FOB (USD)', 'precioUnitUSD', '0.1'),
      campo('Peso unitario (kg)', 'pesoUnitKg', '0.01'),
      campo('Flete total (USD)', 'fleteUSD'),
      el('div', { class:'field' }, el('label', {}, 'Rubro'),
        el('select', { class:'inp', onchange:ev => { e.rubro = ev.target.value; calc(); } },
          ...RUBROS.map(r => el('option', { value:r.id, selected:r.id === e.rubro || null }, r.nombre))))));

  calc();
  return el('div', {}, form, el('div', { style:{ marginTop:'14px' } }, out));
}

const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);
