/* ============================================================
   NiJu — Centro impositivo del cliente
   Dos cosas: la calculadora antes de comprar, y la carpeta con
   todo lo que hay que declarar después.
   ============================================================ */
import { el, plata, num, ic, toast } from '../util.js';
import { calcularImportacion, mejorRegimen, REGLAS } from '../engine/taxes.js';
import { calcularFee, comparadorDeFee } from '../engine/fees.js';
import { PERFILES, carpetaAnual, csvCarpeta, descargarCSV, consecuenciasFiscales } from '../engine/fiscal.js';
import { RUBROS } from '../data/catalog.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';

export function vistaImpuestos(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div');
  let tab = 'calc';

  const tabs = el('div', { class:'tabs' },
    ...[['calc','Calculadora'],['carpeta','Mi carpeta ARCA'],['perfil','Mi condición fiscal'],['reglas','Parámetros vigentes']]
      .map(([id, n]) => el('button', { class:'tab' + (tab === id ? ' on' : ''), onclick:e => {
        tab = id;
        [...tabs.children].forEach(c => c.classList.remove('on'));
        e.currentTarget.classList.add('on');
        pintar();
      } }, n)));

  raiz.append(el('section', { class:'section' },
    el('div', { class:'kicker' }, 'Sin trámites, sin sorpresas'),
    el('h1', { style:{ marginBottom:'10px' } }, 'Lo impositivo, resuelto'),
    el('p', { class:'muted', style:{ maxWidth:'70ch', marginBottom:'18px' } },
      'Antes de comprar te decimos cuánto vas a pagar de verdad. Después te dejamos armada la carpeta con lo que tenés que declarar, según tu condición ante ARCA.'),
    tabs, cuerpo));

  function pintar(){
    cuerpo.replaceChildren(
      tab === 'calc'    ? calculadora() :
      tab === 'carpeta' ? carpeta() :
      tab === 'perfil'  ? perfil() : reglas());
  }
  pintar();
  return raiz;
}

/* ---------------- Calculadora ---------------- */
function calculadora(){
  const estado = { valorUSD:350, fleteUSD:35, pesoKg:2, rubro:'tecnologia', unidades:1, destino:'uso', usadoAnualUSD:0 };
  const salida = el('div');

  const campo = (label, key, tipo = 'number', paso = '1') => el('div', { class:'field' },
    el('label', {}, label),
    el('input', { class:'inp', type:tipo, step:paso, value:String(estado[key]),
      oninput:e => { estado[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value; calcular(); } }));

  const form = el('div', { class:'card card-hard' },
    el('div', { class:'kicker', style:{ marginBottom:'12px' } }, 'Datos de la compra'),
    el('div', { class:'grid g-2' },
      campo('Valor del producto (USD)', 'valorUSD'),
      campo('Envío internacional (USD)', 'fleteUSD'),
      campo('Peso (kg)', 'pesoKg', 'number', '0.1'),
      campo('Unidades', 'unidades'),
      el('div', { class:'field' }, el('label', {}, 'Rubro'),
        el('select', { class:'inp', onchange:e => { estado.rubro = e.target.value; calcular(); } },
          ...RUBROS.map(r => el('option', { value:r.id, selected:r.id === estado.rubro || null }, r.nombre)))),
      el('div', { class:'field' }, el('label', {}, 'Destino'),
        el('select', { class:'inp', onchange:e => { estado.destino = e.target.value; calcular(); } },
          el('option', { value:'uso' }, 'Uso personal'),
          el('option', { value:'reventa' }, 'Reventa / comercial'))),
      el('div', { class:'field' }, el('label', {}, 'Franquicia ya usada este año (USD)'),
        el('input', { class:'inp', type:'number', value:'0', oninput:e => { estado.usadoAnualUSD = +e.target.value || 0; calcular(); } }))));

  function calcular(){
    const m = mejorRegimen(estado);
    const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';

    const tarjetas = ['courier','general'].map(rg => {
      const r = m[rg];
      const fee = calcularFee({ valorUSD:estado.valorUSD, fleteUSD:estado.fleteUSD,
        tipo: rg === 'general' ? 'mayorista' : 'internacional' });
      const totalUSD = r.total + fee.feeUSD;
      const elegido = m.elegido === rg;
      return el('div', { class:'card card-hard', style:{ borderColor: elegido ? 'var(--win)' : '' } },
        el('div', { class:'row-b', style:{ marginBottom:'10px' } },
          el('div', {}, el('div', { class:'kicker' }, rg === 'courier' ? 'Régimen simplificado' : 'Con despachante'),
            el('h3', {}, REGLAS[rg].nombre)),
          elegido ? el('span', { class:'tag tag-win' }, 'Conviene') : null),
        ...r.lineas.map(l => el('div', { class:'cost-line' },
          el('span', { class:'lbl' }, l.k, l.detalle ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + l.detalle) : null),
          el('span', { class:'mono' + (l.recuperable ? '' : '') }, l.v ? 'US$ ' + l.v.toFixed(2) : '—'))),
        el('div', { class:'cost-line' },
          el('span', { class:'lbl' }, 'Gestión NiJu', el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ` · ${fee.pctEfectivo || 0}%`)),
          el('span', { class:'mono' }, 'US$ ' + fee.feeUSD.toFixed(2))),
        el('div', { class:'cost-line total' },
          el('span', {}, 'Total'),
          el('span', {}, 'US$ ' + totalUSD.toFixed(2))),
        el('div', { class:'tiny dim center', style:{ marginTop:'4px' } }, '≈ ' + plata(totalUSD * FX.tarjeta) + ` al dólar tarjeta`),
        r.recuperable ? el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
          `US$ ${r.recuperable} recuperables si sos Responsable Inscripto. Costo real: US$ ${(totalUSD - r.recuperable).toFixed(2)}.`) : null,
        ...r.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : a.t === 'ok' ? 'notice-ok' : ''), style:{ marginTop:'8px' } }, a.m)));
    });

    const c = m.courier;
    const usado = c.franquicia.usado, tope = c.franquicia.tope;
    const medidor = el('div', { class:'card' },
      el('div', { class:'gauge' },
        el('div', { class:'gauge-head' },
          el('span', {}, 'Franquicia del envío'),
          el('span', { class:'mono' }, `US$ ${c.franquicia.aplicada} de US$ ${tope}`)),
        el('div', { class:'bar' }, el('i', { style:{ width: Math.min(100, c.franquicia.aplicada / tope * 100) + '%' } })),
        el('div', { class:'tiny dim' }, REGLAS.courier.nota)));

    const fiscal = consecuenciasFiscales({
      tipo:'internacional', regimen:m.elegido,
      totalARS:(m[m.elegido].total) * FX.tarjeta,
      impuestosImportARS:m[m.elegido].impuestos * FX.tarjeta,
      ivaFeeARS:0, valorUSD:estado.valorUSD, destino:estado.destino
    }, perfilId);

    salida.replaceChildren(
      el('div', { class:'notice', style:{ marginBottom:'14px' } }, m.motivo),
      medidor,
      el('div', { class:'grid g-2', style:{ marginTop:'14px' } }, ...tarjetas),
      el('div', { class:'card', style:{ marginTop:'14px' } },
        el('div', { class:'kicker', style:{ marginBottom:'8px' } }, `Según tu condición: ${fiscal.perfil.label}`),
        ...fiscal.costo.map(x => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, x.k), el('span', { class:'mono' }, plata(x.v)))),
        ...fiscal.computable.map(x => el('div', { class:'cost-line' }, el('span', { class:'lbl', style:{ color:'var(--ok)' } }, x.k), el('span', { class:'mono' }, plata(x.v)))),
        ...fiscal.avisos.map(a => el('div', { class:'notice ' + (a.t === 'bad' ? 'notice-bad' : ''), style:{ marginTop:'8px' } }, a.m))),
      comparativaFee(estado.valorUSD));
  }
  calcular();

  return el('div', { class:'section' }, el('div', { class:'tax-grid' }, form, salida));
}

function comparativaFee(valorUSD){
  const filas = comparadorDeFee(valorUSD);
  return el('div', { class:'card', style:{ marginTop:'14px' } },
    el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'Cuánto cobra cada uno por gestionarte la compra'),
    ...filas.map(f => el('div', { class:'row', style:{ padding:'6px 0' } },
      el('b', { style:{ width:'170px', color: f.destacar ? 'var(--win)' : '' } }, f.quien),
      el('div', { class:'bar', style:{ flex:'1' } }, el('i', { style:{ width:(f.pct / 16 * 100) + '%', background: f.destacar ? 'var(--win)' : 'var(--line)' } })),
      el('span', { class:'mono tiny', style:{ width:'110px', textAlign:'right' } }, `${f.pct}% · US$ ${f.usd}`))),
    el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
      'Valores de referencia del mercado, parametrizables desde el Panel. NiJu cobra por gestionar la operación, no por publicar.'));
}

/* ---------------- Carpeta ---------------- */
function carpeta(){
  const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
  const compras = store.get('comprasAnio');
  const c = carpetaAnual(compras, perfilId);

  if (!compras.length){
    return el('div', { class:'section' },
      el('div', { class:'card center', style:{ padding:'40px' } },
        el('div', { style:{ fontSize:'40px' } }, '🗂️'),
        el('h3', { style:{ margin:'10px 0 6px' } }, 'Todavía no hay operaciones en tu carpeta'),
        el('p', { class:'muted tiny' }, 'Cada compra que hagas por NiJu se registra acá con su tratamiento fiscal, lista para tu contador.')));
  }

  const kpi = (t, v, d, col) => el('div', { class:'kpi' },
    el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);

  return el('div', { class:'section' },
    el('div', { class:'row-b', style:{ marginBottom:'14px' } },
      el('div', {}, el('div', { class:'kicker' }, 'Ejercicio ' + c.anio), el('h2', {}, 'Carpeta impositiva')),
      el('button', { class:'btn btn-win', onclick:() => {
        descargarCSV(`niju-carpeta-${c.anio}.csv`, csvCarpeta(c)); toast('Carpeta descargada', 'win');
      } }, ic('caja'), 'Descargar para el contador')),
    el('div', { class:'grid g-4', style:{ marginBottom:'16px' } },
      kpi('Total comprado', plata(c.totales.gastado)),
      kpi('Crédito fiscal IVA', plata(c.totales.creditoFiscal), 'computable', 'var(--ok)'),
      kpi('Costo no computable', plata(c.totales.costoNoComputable), 'no se recupera', 'var(--warn)'),
      kpi('Percepciones a favor', plata(c.totales.saldoACuenta), 'a cuenta', 'var(--nac)')),
    ...c.alertas.map(a => el('div', { class:'notice ' + (a.t === 'ok' ? 'notice-ok' : ''), style:{ marginBottom:'10px' } }, a.m)),
    el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Fecha'), el('th', {}, 'Operación'), el('th', {}, 'Régimen'),
        el('th', {}, 'Total'), el('th', {}, 'Computable'), el('th', {}, 'Costo'), el('th', {}, 'A favor'))),
      el('tbody', {}, ...c.operaciones.map(({ compra:x, fiscal:f }) => el('tr', {},
        el('td', { class:'tiny' }, new Date(x.fecha).toLocaleDateString('es-AR')),
        el('td', {}, el('b', { class:'tiny' }, x.titulo), el('div', { class:'tiny dim' }, x.tienda)),
        el('td', { class:'tiny' }, x.regimen || '—'),
        el('td', { class:'mono tiny' }, plata(x.totalARS)),
        el('td', { class:'mono tiny', style:{ color:'var(--ok)' } }, plata(f.totalComputable)),
        el('td', { class:'mono tiny', style:{ color:'var(--warn)' } }, plata(f.totalCosto)),
        el('td', { class:'mono tiny', style:{ color:'var(--nac)' } }, plata(f.totalACuenta)))))))
  );
}

/* ---------------- Perfil ---------------- */
function perfil(){
  const u = store.get('usuario') || {};
  const actual = u.perfilFiscal || 'consumidor_final';

  const tarjetas = Object.entries(PERFILES).map(([id, p]) => el('div', {
    class:'card hoverable', style:{ borderColor: id === actual ? p.color : '' },
    onclick:() => {
      store.set('usuario', { ...(store.get('usuario') || { nombre:'Invitado' }), perfilFiscal:id });
      toast('Condición fiscal actualizada: ' + p.label, 'win');
      location.hash = '#/impuestos';
    }
  },
    el('div', { class:'row-b' },
      el('div', {}, el('div', { class:'kicker', style:{ color:p.color } }, p.corto),
        el('h3', {}, p.label)),
      id === actual ? el('span', { class:'tag tag-win' }, 'Tu condición') : null),
    el('p', { class:'tiny muted', style:{ margin:'8px 0' } }, p.desc),
    el('div', { class:'row wrapf' },
      el('span', { class:'tag ' + (p.computaIVA ? 'tag-ok' : 'tag-warn') }, p.computaIVA ? 'Computa IVA' : 'IVA es costo'),
      p.requiereCUIT ? el('span', { class:'tag' }, 'Requiere CUIT') : null,
      p.puedeReventa ? el('span', { class:'tag tag-ok' }, 'Puede revender') : null),
    p.alerta ? el('div', { class:'notice', style:{ marginTop:'10px' } }, p.alerta) : null,
    el('div', { class:'kicker', style:{ margin:'12px 0 5px' } }, 'Te alcanzan'),
    el('div', { class:'row wrapf' }, ...p.formularios.map(f => el('span', { class:'chip tiny' }, f)))));

  return el('div', { class:'section' },
    el('p', { class:'muted', style:{ marginBottom:'14px' } },
      'Elegí tu condición ante ARCA. Con eso calculamos, en cada compra, qué podés computar, qué es costo y qué te queda a favor.'),
    el('div', { class:'grid g-2' }, ...tarjetas),
    el('div', { class:'notice', style:{ marginTop:'16px' } },
      'NiJu organiza tu información. No es asesoramiento impositivo ni reemplaza a tu contador.'));
}

/* ---------------- Reglas ---------------- */
function reglas(){
  const bloque = (t, obj) => el('div', { class:'card', style:{ marginBottom:'14px' } },
    el('div', { class:'kicker', style:{ marginBottom:'8px' } }, t),
    ...Object.entries(obj).filter(([k, v]) => typeof v !== 'object' || v === null).map(([k, v]) =>
      el('div', { class:'cost-line' }, el('span', { class:'lbl' }, k), el('span', { class:'mono' }, String(v)))));

  return el('div', { class:'section' },
    el('div', { class:'notice notice-bad', style:{ marginBottom:'14px' } },
      `Parámetros cargados el ${REGLAS.actualizado} y AÚN NO VERIFICADOS contra el texto oficial. Antes de salir a producción hay que contrastarlos con ARCA y marcar verificado:true.`),
    bloque('Courier puerta a puerta', REGLAS.courier),
    bloque('Importación general', REGLAS.general),
    bloque('Compras con tarjeta al exterior', REGLAS.tarjeta),
    el('div', { class:'card' },
      el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'Aranceles por rubro (régimen general)'),
      el('div', { class:'grid g-3' }, ...Object.entries(REGLAS.arancelPorRubro).filter(([k]) => k !== '_default')
        .map(([k, v]) => el('div', { class:'row-b tiny', style:{ borderBottom:'1px solid var(--line-soft)', padding:'5px 0' } },
          el('span', { class:'dim' }, k), el('b', { class:'mono' }, v + '%'))))));
}
