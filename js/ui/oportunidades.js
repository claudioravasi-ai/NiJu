/* ============================================================
   NiJu — Radar de oportunidades (Panel)
   Tres pestañas: qué conviene traer, el nicho elegido con sus
   números, y los pilotos en curso.
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja } from '../util.js';
import { FAMILIAS, economia, lote, costoPuesto, viaSugerida, valorPorKg, FLETE } from '../data/nicho-maquinas.js';
import { radar, senales, UMBRAL_OPORTUNIDAD, crearPiloto, registrarVenta, evaluarPiloto, graduarANijuDirecto } from '../engine/oportunidades.js';
import { crearCampania } from '../engine/grupal.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';
import { foto } from './components.js';
import { buscar } from '../engine/search.js';
import { PREGUNTAS, mensajeIngles, mensajeCastellano, guardarCotizacion, cotizaciones,
         cotizacionDe, elegir, familiaConCotizaciones, cobertura, comparar } from '../engine/rfq.js';
import { STORE_BY_ID } from '../data/stores.js';

export function vistaOportunidades(ir){
  const cont = el('div');
  let sub = 'nicho';

  const tabs = el('div', { class:'row wrapf', style:{ marginBottom:'16px' } },
    ...[['nicho','Máquinas + insumos'],['cotizar','Cotizaciones'],['radar','Qué conviene traer'],['piloto','Pilotos en curso']]
      .map(([id, n]) => el('button', { class:'chip' + (sub === id ? ' on-win' : ''), onclick:e => {
        sub = id;
        [...e.currentTarget.parentNode.children].forEach(c => c.classList.remove('on-win'));
        e.currentTarget.classList.add('on-win');
        pintar();
      } }, n)));

  function pintar(){
    cont.replaceChildren(tabs,
      sub === 'nicho' ? vistaNicho(ir) :
      sub === 'cotizar' ? vistaCotizar(pintar) :
      sub === 'radar' ? vistaRadar() : vistaPilotos(pintar));
  }
  pintar();
  return cont;
}

/* ============================================================
   1) EL NICHO: máquinas chicas + insumos
   ============================================================ */
function vistaNicho(ir){
  const raiz = el('div');
  let famId = FAMILIAS[0].id;
  const detalle = el('div');

  const selector = el('div', { class:'grid g-3', style:{ marginBottom:'16px' } },
    ...FAMILIAS.map(f => el('div', {
      class:'card hoverable', style:{ borderLeft:'4px solid var(--accion)' },
      onclick:() => { famId = f.id; pintarDetalle(); }
    },
      el('div', { class:'row' }, el('span', { style:{ fontSize:'26px' } }, f.emo),
        el('div', {}, el('b', {}, f.nombre), el('div', { class:'tiny dim' }, f.publico))),
      el('p', { class:'tiny muted', style:{ marginTop:'8px' } }, f.porQue))));

  function pintarDetalle(){
    const base = FAMILIAS.find(x => x.id === famId);
    const f = familiaConCotizaciones(base);
    const cob = cobertura(base);
    const e = economia(f, FX.tarjeta);

    /* --- la cuenta que define el negocio --- */
    const cuenta = el('div', { class:'grid g-4', style:{ marginBottom:'16px' } },
      kpi('Margen de la máquina', plata(e.maquina.margen), `${e.maquina.margenPct}% · el anzuelo`),
      kpi('Margen del insumo, por mes', plata(e.margenMensual), 'por cada cliente activo', 'var(--win-tx)'),
      kpi('Vale un cliente a 24 meses', plata(e.ltv), e.mesesRecupero ? `recuperás la máquina en ${e.mesesRecupero} mes${e.mesesRecupero>1?'es':''}` : '', 'var(--win-tx)'),
      kpi('Retención supuesta', Math.round(e.retencion * 100) + '%', 'clientes que siguen comprando'));

    const veredicto = el('div', {}, 
      el('div', { class:'notice ' + (e.margenMensual > e.maquina.margen ? 'notice-ok' : ''), style:{ marginBottom:'8px' } },
        el('b', {}, e.veredicto)),
      el('div', { class:'notice', style:{ marginBottom:'16px' } },
        'El "precio sugerido" sale del costo real más el margen objetivo (18% la máquina, 55% el insumo). No es un precio de mercado: contrastalo con el buscador de la app antes de publicarlo.'));

    /* --- curva de valor del cliente --- */
    const max = e.serie[e.serie.length - 1].acumulado;
    const curva = el('div', { class:'card', style:{ marginBottom:'16px' } },
      el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Lo que deja un cliente, mes a mes'),
      el('div', { style:{ display:'flex', alignItems:'flex-end', gap:'2px', height:'110px' } },
        ...e.serie.map(s => el('div', {
          title:`Mes ${s.mes}: ${plata(s.acumulado)}`,
          style:{ flex:'1', height:Math.max(2, s.acumulado / max * 100) + '%',
                  background: s.mes === 1 ? 'var(--tx-3)' : 'var(--accion)', borderRadius:'2px 2px 0 0' } }))),
      el('div', { class:'row-b tiny dim', style:{ marginTop:'6px' } },
        el('span', {}, 'Mes 1: ' + plata(e.serie[0].acumulado) + ' (solo la máquina)'),
        el('span', {}, 'Mes 24: ' + plata(e.ltv))));

    /* --- insumos, uno por uno --- */
    const avisoMercado = el('div', { class:'notice', style:{ marginBottom:'12px' } },
      el('b', {}, 'Para validar estos precios falta conectar Mercado Libre. '),
      'Las tiendas que están en vivo hoy son supermercados, y ahí no se venden insumos de sublimación ni film DTF. Sin esa referencia, el "precio sugerido" es una cuenta de costos, no un precio de mercado comprobado.');

    const tabla = el('div', { class:'tbl-wrap', style:{ marginBottom:'16px' } },
      el('table', { class:'tbl' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Insumo'), el('th', {}, 'FOB'), el('th', {}, 'US$/kg'), el('th', {}, 'Cómo viaja'),
          el('th', {}, 'Costo real'), el('th', {}, 'Precio sugerido'), el('th', {}, 'Margen'), el('th', {}, 'En el mercado'), el('th', {}, 'Por mes'))),
        el('tbody', {},
          el('tr', { class:'is-win' },
            el('td', {}, el('b', {}, '🔧 ' + f.maquina.nombre), el('div', { class:'tiny dim' }, 'la máquina (anzuelo)')),
            el('td', { class:'mono' }, 'US$ ' + f.maquina.fob),
            el('td', { class:'mono' }, e.maquina.valorKg),
            el('td', {}, via(e.maquina.via)),
            el('td', { class:'mono' }, plata(e.maquina.costoARS)),
            el('td', { class:'mono' }, plata(e.maquina.pvp)),
            el('td', { class:'mono' }, plata(e.maquina.margen), el('div', { class:'tiny dim' }, e.maquina.margenPct + '%')),
            el('td', {}, el('button', { class:'btn btn-sm btn-ghost',
              onclick:ev => contrastar(ev.currentTarget, { nombre:f.maquina.nombre, pvp:e.maquina.pvp, costoARS:e.maquina.costoARS }) }, 'Ver mercado')),
            el('td', { class:'tiny dim' }, 'una vez')),
          ...e.consumibles.map(c => {
            const celdaMercado = el('td', {},
              el('button', { class:'btn btn-sm btn-ghost', onclick:ev => contrastar(ev.currentTarget, c) }, 'Ver mercado'));
            return el('tr', {},
              el('td', {}, c.nombre,
                c.cotizado ? el('div', { class:'tiny', style:{ color:'var(--win-tx)' } }, '✓ cotizado · ' + (c.proveedor || ''))
                           : el('div', { class:'tiny dim' }, 'valor estimado')),
              el('td', { class:'mono' }, 'US$ ' + c.fob),
              el('td', { class:'mono' }, c.valorKg),
              el('td', {}, via(c.via)),
              el('td', { class:'mono' }, plata(c.costoARS)),
              el('td', { class:'mono' }, plata(c.pvp)),
              el('td', { class:'mono', style:{ color:'var(--win-tx)' } }, plata(c.margenUnit), el('div', { class:'tiny dim' }, c.margenPct + '%')),
              celdaMercado,
              el('td', { class:'mono' }, `${c.porMes} u · ` + plata(c.margenMes)));
          }))));

    /* --- simulador de lote inicial --- */
    let maquinas = 20, meses = 3;
    const simul = el('div');
    const pintarSimul = () => {
      const L = lote(f, maquinas, FX.tarjeta, meses);
      simul.replaceChildren(
        el('div', { class:'grid g-2', style:{ marginBottom:'12px' } },
          el('div', { class:'field' }, el('label', {}, 'Máquinas del lote de prueba'),
            el('input', { class:'inp', type:'number', value:String(maquinas), min:'5',
              oninput:ev => { maquinas = +ev.target.value || 1; pintarSimul(); } })),
          el('div', { class:'field' }, el('label', {}, 'Meses de insumo que traés'),
            el('input', { class:'inp', type:'number', value:String(meses), min:'1',
              oninput:ev => { meses = +ev.target.value || 1; pintarSimul(); } }))),
        linea('Inversión en origen', 'US$ ' + L.inversionUSD),
        linea('Inversión en pesos', plata(L.inversionARS)),
        linea('Venta estimada del lote', plata(L.ventaEstimadaARS)),
        el('div', { class:'cost-line total' }, el('span', {}, 'Margen del lote'), el('b', {}, plata(L.margenARS))),
        el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } },
          `Si esos ${maquinas} clientes siguen comprando insumo, a 24 meses el lote vale ${plata(L.ltvLote)}. Ese es el negocio: no la máquina, la recompra.`),
        el('div', { class:'row wrapf', style:{ marginTop:'12px' } },
          el('button', { class:'btn btn-win', onclick:() => {
            crearPiloto({ nombre:f.maquina.nombre, familiaId:f.id, unidades:maquinas,
              costoUnitARS:e.maquina.costoARS, pvpARS:e.maquina.pvp,
              notas:`Piloto de ${f.nombre}. ${meses} meses de insumo incluidos.` });
            toast('Piloto creado. Seguilo en "Pilotos en curso"', 'win');
          } }, ic('caja'), 'Arrancar piloto con ' + maquinas + ' unidades'),
          el('button', { class:'btn', onclick:() => {
            crearCampania({ tipo:'grupal', titulo:f.maquina.nombre, familiaId:f.id,
              precioBase:e.maquina.pvp, meta:maquinas,
              notas:'Compra grupal: cuanta más gente se suma, más barato para todos.' })
              .then(() => { toast('Compra grupal creada', 'win'); ir('#/grupal'); });
          } }, ic('megafono'), 'Lanzar compra grupal'),
          el('button', { class:'btn', onclick:() => {
            crearCampania({ tipo:'preventa', titulo:f.maquina.nombre, familiaId:f.id,
              precioBase:e.maquina.pvp, meta:Math.max(10, Math.round(maquinas / 2)),
              notas:'Preventa con seña: no compramos nada hasta llegar al mínimo.' })
              .then(() => { toast('Preventa creada', 'win'); ir('#/grupal'); });
          } }, ic('etiqueta'), 'Abrir preventa con seña')));
    };
    pintarSimul();

    detalle.replaceChildren(
      el('div', { class:'row-b wrapf', style:{ marginBottom:'12px' } },
        el('div', {}, el('div', { class:'kicker' }, 'Familia elegida'),
          el('h2', {}, f.emo + ' ' + f.nombre)),
        el('div', { class:'row wrapf' },
          el('span', { class:'tag ' + (cob.pct === 100 ? 'tag-ok' : cob.pct > 0 ? 'tag-warn' : '') },
            `${cob.cotizados}/${cob.total} cotizados de verdad`),
          el('span', { class:'chip' }, f.estacional))),
      cuenta, veredicto, curva, avisoMercado, tabla,
      el('div', { class:'card card-hard' },
        el('h3', { style:{ marginBottom:'12px' } }, 'Simulador de lote inicial'),
        simul),
      avisoHomologacion());
  }

  raiz.append(
    el('div', { class:'notice', style:{ marginBottom:'16px' } },
      el('b', {}, 'Los precios FOB son valores de referencia. '),
      'Sirven para que el modelo calcule, no para que les creas. Reemplazalos por cotizaciones reales antes de comprometer un peso.'),
    selector, detalle);
  pintarDetalle();
  return raiz;
}

/* Contrasta el precio sugerido contra lo que realmente se vende hoy.
   Sin esto, el modelo te puede estar proponiendo un precio que nadie paga. */
async function contrastar(boton, item){
  const celda = boton.parentNode;
  celda.replaceChildren(el('span', { class:'tiny dim' }, 'buscando…'));
  try{
    const { grupos } = await buscar(item.nombre, { orden:'precio' }, () => {});
    let local = null;
    for (const g of grupos){
      for (const o of g.ofertas){
        const t = STORE_BY_ID[o.tiendaId];
        if (!t || (t.tipo !== 'nacional' && t.tipo !== 'propio')) continue;
        if (!local || o.costo.finalARS < local.precio) local = { precio:o.costo.finalARS, tienda:t.nombre, titulo:g.titulo };
      }
    }
    if (!local){
      celda.replaceChildren(
        el('span', { class:'tiny dim' }, 'sin referencia'),
        el('div', { class:'tiny', style:{ color:'var(--warn)' },
          title:'Las tiendas conectadas hoy son supermercados. Este tipo de insumo se vende en Mercado Libre: hasta que no esté conectado, el precio sugerido no se puede validar contra el mercado.' },
          'falta Mercado Libre'));
      return;
    }
    const margenReal = local.precio - item.costoARS;
    const pctReal = Math.round(margenReal / local.precio * 100);
    const arriba = item.pvp > local.precio;
    celda.replaceChildren(
      el('div', { class:'mono tiny', title:`${local.titulo} — ${local.tienda}` }, plata(local.precio)),
      el('div', { class:'tiny', style:{ color: pctReal >= 35 ? 'var(--win-tx)' : pctReal > 0 ? 'var(--warn)' : 'var(--bad)', fontWeight:'600' } },
        `margen real ${pctReal}%`),
      arriba ? el('div', { class:'tiny', style:{ color:'var(--bad)' } }, 'tu precio está por encima') : null);
  }catch{
    celda.replaceChildren(el('span', { class:'tiny dim' }, 'no se pudo'));
  }
}

function via(v){
  const m = { aereo:['✈️ Avión','var(--win-tx)'], mixto:['🔀 Mixto','var(--warn)'], maritimo:['🚢 Barco','var(--nac)'] }[v.via];
  return el('span', { class:'tag', style:{ color:m[1] }, title:v.nota }, m[0]);
}

function avisoHomologacion(){
  return el('div', { class:'card', style:{ marginTop:'16px', borderLeft:'4px solid var(--warn)' } },
    el('h3', { style:{ marginBottom:'8px' } }, 'La trampa de este nicho, y cómo esquivarla'),
    el('p', { class:'tiny muted' },
      'Casi todas estas máquinas se enchufan a 220 V, así que para importarlas formalmente y venderlas hay que certificar seguridad eléctrica: cuesta y tarda. Además son pesadas, así que por avión el flete se come el margen.'),
    el('p', { class:'tiny', style:{ marginTop:'8px', fontWeight:'600' } },
      'La salida: la máquina va por barco (o se compra a un importador local ya certificado) y el consumible —que es liviano, caro, de recompra mensual y NO necesita homologación— viaja por avión. El negocio real nunca fue la máquina.'));
}


/* ============================================================
   COTIZACIONES: pedir precios reales y cargarlos
   ============================================================ */
function vistaCotizar(refrescar){
  const raiz = el('div');
  let famId = FAMILIAS[0].id;
  const cuerpo = el('div');

  const selector = el('div', { class:'row wrapf', style:{ marginBottom:'14px' } },
    ...FAMILIAS.map(f => el('button', { class:'chip' + (famId === f.id ? ' on-win' : ''), onclick:ev => {
      famId = f.id;
      [...ev.currentTarget.parentNode.children].forEach(c => c.classList.remove('on-win'));
      ev.currentTarget.classList.add('on-win');
      pintar();
    } }, f.emo + ' ' + f.nombre)));

  function pintar(){
    const f = FAMILIAS.find(x => x.id === famId);
    const items = [
      { nombre:f.maquina.nombre, detalle:'la máquina' },
      ...f.consumibles.map(c => ({ nombre:c.nombre, detalle:`consumo estimado ${c.porMes}/mes por cliente` }))
    ];
    const cob = cobertura(f);

    const ingles = mensajeIngles(f, items);
    const espanol = mensajeCastellano(f, items);

    cuerpo.replaceChildren(
      el('div', { class:'grid g-3', style:{ marginBottom:'16px' } },
        kpi('Ítems de la familia', String(cob.total)),
        kpi('Ya cotizados de verdad', String(cob.cotizados), cob.pct + '% de la familia', cob.pct === 100 ? 'var(--win-tx)' : 'var(--warn)'),
        kpi('Cotizaciones cargadas', String(cotizaciones().filter(c => c.familiaId === f.id).length))),

      el('div', { class:'card', style:{ marginBottom:'16px' } },
        el('h3', { style:{ marginBottom:'8px' } }, 'Qué hay que preguntar, y por qué'),
        el('p', { class:'tiny muted', style:{ marginBottom:'10px' } },
          'Un "US$ 0,50" suelto no sirve para nada: no sabés a qué cantidad, cuánto pesa la caja ni qué posición arancelaria tiene. Sin eso el cálculo del costo real es imposible.'),
        ...PREGUNTAS.map((p, i) => el('div', { class:'step' },
          el('span', { class:'step-n' }, String(i + 1)),
          el('div', {}, el('b', { class:'tiny' }, p.q), el('div', { class:'tiny dim' }, p.porque))))),

      el('div', { class:'grid g-2', style:{ marginBottom:'16px' } },
        bloqueMensaje('Para Alibaba / 1688 (inglés)', ingles, 'Pegalo en el chat del proveedor. Pedíselo a 5 proveedores distintos, no a uno.'),
        bloqueMensaje('Para proveedores locales (castellano)', espanol, 'Sirve para importadores argentinos que ya tienen el producto acá.')),

      el('div', { class:'card card-hard', style:{ marginBottom:'16px' } },
        el('h3', { style:{ marginBottom:'10px' } }, 'Cargar una cotización que te llegó'),
        formulario(f, items, refrescar)),

      listaCotizaciones(f, refrescar)
    );
  }

  function formulario(f, items, refrescar){
    const d = { familiaId:f.id, item:items[0].nombre };
    const campo = (label, key, tipo = 'text', paso) => el('div', { class:'field' },
      el('label', {}, label),
      el('input', { class:'inp', type:tipo, step:paso,
        oninput:e => d[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value }));

    return el('div', {},
      el('div', { class:'grid g-3' },
        el('div', { class:'field' }, el('label', {}, 'Ítem'),
          el('select', { class:'inp', onchange:e => d.item = e.target.value },
            ...items.map(i => el('option', { value:i.nombre }, i.nombre)))),
        campo('Proveedor', 'proveedor'),
        campo('Precio FOB (US$)', 'fob', 'number', '0.01'),
        campo('Mínimo de compra', 'moq', 'number'),
        campo('Peso por unidad (kg)', 'kg', 'number', '0.01'),
        campo('Unidades por caja', 'cajaUnidades', 'number'),
        campo('Medidas de la caja (cm)', 'cajaCm'),
        campo('Posición arancelaria', 'ncm'),
        campo('Plazo de producción', 'lead'),
        campo('Condiciones de pago', 'pago'),
        campo('Muestra', 'muestra'),
        campo('Notas', 'notas')),
      el('button', { class:'btn btn-win', style:{ marginTop:'12px' }, onclick:() => {
        if (!d.proveedor || !d.fob) return toast('Falta el proveedor o el precio', 'bad');
        guardarCotizacion(d);
        toast('Cotización guardada. El modelo ya la está usando.', 'win');
        pintar();
      } }, ic('check'), 'Guardar cotización'));
  }

  function listaCotizaciones(f, refrescar){
    const items = [f.maquina.nombre, ...f.consumibles.map(c => c.nombre)];
    const bloques = items.map(nombre => {
      const cs = comparar(nombre);
      if (!cs.length) return null;
      const elegidaId = (cotizacionDe(nombre) || {}).id;
      return el('div', { class:'card', style:{ marginBottom:'12px' } },
        el('h3', { style:{ marginBottom:'8px', fontSize:'14px' } }, nombre),
        el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Proveedor'), el('th', {}, 'FOB'), el('th', {}, 'US$/kg'),
            el('th', {}, 'MOQ'), el('th', {}, 'Plazo'), el('th', {}, 'Pago'), el('th', {}, ''))),
          el('tbody', {}, ...cs.map(c => el('tr', { class: c.id === elegidaId ? 'is-win' : '' },
            el('td', {}, el('b', {}, c.proveedor), c.ncm ? el('div', { class:'tiny dim' }, 'NCM ' + c.ncm) : null),
            el('td', { class:'mono' }, 'US$ ' + c.fob),
            el('td', { class:'mono' }, c.usdPorKg ?? '—'),
            el('td', { class:'mono' }, c.moq || '—'),
            el('td', { class:'tiny' }, c.lead || '—'),
            el('td', { class:'tiny' }, c.pago || '—'),
            el('td', {}, c.id === elegidaId
              ? el('span', { class:'tag tag-win' }, 'Elegida')
              : el('button', { class:'btn btn-sm', onclick:() => { elegir(c.id); pintar(); } }, 'Usar esta'))))))));
    }).filter(Boolean);

    if (!bloques.length) return el('div', { class:'notice' },
      'Todavía no cargaste ninguna cotización de esta familia. Hasta que lo hagas, el modelo usa mis valores de referencia, que son rangos típicos y no cotizaciones reales.');

    return el('div', {}, el('h3', { style:{ margin:'0 0 10px' } }, 'Cotizaciones recibidas'), ...bloques);
  }

  raiz.append(selector, cuerpo);
  pintar();
  return raiz;
}

function bloqueMensaje(titulo, texto, ayuda){
  const ta = el('textarea', { class:'inp', style:{ minHeight:'230px', fontFamily:'var(--fm)', fontSize:'12px' } });
  ta.value = texto;
  return el('div', { class:'card' },
    el('div', { class:'row-b', style:{ marginBottom:'8px' } },
      el('b', {}, titulo),
      el('button', { class:'btn btn-sm btn-win', onclick:() => {
        navigator.clipboard?.writeText(ta.value);
        toast('Mensaje copiado', 'win');
      } }, 'Copiar')),
    ta,
    el('p', { class:'tiny dim', style:{ marginTop:'6px' } }, ayuda));
}

/* ============================================================
   2) RADAR: qué conviene traer, según lo que pasa en la app
   ============================================================ */
function vistaRadar(){
  const raiz = el('div');
  const salida = el('div');
  const progreso = el('div');

  const s = senales();
  if (!s.length){
    return el('div', { class:'card center', style:{ padding:'40px' } },
      el('div', { style:{ fontSize:'38px' } }, '📡'),
      el('h3', { style:{ margin:'10px 0 6px' } }, 'Todavía no hay señales'),
      el('p', { class:'muted tiny', style:{ maxWidth:'56ch', margin:'0 auto' } },
        'El radar se alimenta de lo que hace la gente en la app: qué busca, qué pide por "Traelo por mí", qué deja en el carrito y a qué producto le pone alerta de precio. Usá la app un rato y volvé.'));
  }

  const correr = async () => {
    salida.replaceChildren();
    await radar(12, p => {
      progreso.replaceChildren(el('div', { class:'card' },
        el('div', { class:'row-b tiny', style:{ marginBottom:'6px' } },
          el('span', {}, p.listo ? 'Listo' : 'Midiendo brechas de precio… ' + (p.termino || '')),
          el('b', { class:'mono' }, `${p.hecho}/${p.total}`)),
        el('div', { class:'bar' }, el('i', { style:{ width:(p.hecho / p.total * 100) + '%' } }))));
    }).then(res => {
      progreso.replaceChildren();
      const conNegocio = res.filter(r => r.hayNegocio);
      salida.replaceChildren(
        el('div', { class:'grid g-3', style:{ marginBottom:'16px' } },
          kpi('Señales analizadas', String(res.length)),
          kpi('Con margen para traer', String(conNegocio.length), `índice mayor a ${UMBRAL_OPORTUNIDAD}`, 'var(--win-tx)'),
          kpi('Pedidos con nombre', String(res.reduce((a,r) => a + (r.pedidos || 0), 0)), 'gente que ya lo pidió')),
        el('div', { class:'col' }, ...res.map(fila)));
    });
  };

  function fila(r){
    return el('div', { class:'card', style:{ borderLeft:`4px solid ${r.hayNegocio ? 'var(--win)' : 'var(--line-firme)'}` } },
      el('div', { class:'row', style:{ gap:'14px', alignItems:'flex-start' } },
        r.imagen ? foto({ imagen:r.imagen, titulo:r.termino }, '', ) : null,
        el('div', { class:'spacer' },
          el('div', { class:'row', style:{ gap:'7px' } },
            el('b', { style:{ textTransform:'capitalize' } }, r.termino),
            r.hayNegocio ? el('span', { class:'tag tag-win' }, 'Hay negocio') : null,
            r.pedidos ? el('span', { class:'tag tag-niju' }, `${r.pedidos} pedido${r.pedidos > 1 ? 's' : ''} directo${r.pedidos > 1 ? 's' : ''}`) : null),
          el('div', { class:'tiny dim', style:{ marginTop:'4px' } },
            `${r.busquedas || 0} búsquedas · ${r.alertas || 0} alertas · ${r.carritos || 0} en carrito`),
          r.indice ? el('div', { class:'tiny', style:{ marginTop:'6px' } },
            `Acá cuesta ${plata(r.local.final)} (${r.local.tienda}) · trayéndolo sale ${plata(r.importado.final)} (${r.importado.tienda})`) : null),
        el('div', { style:{ textAlign:'right', flex:'0 0 auto' } },
          r.indice
            ? [el('div', { class:'price price-lg', style:{ color: r.hayNegocio ? 'var(--win-tx)' : '' } }, r.indice + '×'),
               el('div', { class:'tiny dim' }, 'más caro acá'),
               el('div', { class:'tiny', style:{ fontWeight:'600' } }, plata(r.margenARS) + ' por unidad')]
            : el('div', { class:'tiny dim' }, 'sin comparación')),
      ),
      r.hayNegocio ? el('div', { class:'row wrapf', style:{ marginTop:'10px' } },
        el('button', { class:'btn btn-sm btn-win', onclick:() => {
          crearCampania({ tipo:'preventa', titulo:r.termino, imagen:r.imagen,
            precioBase:Math.round(r.local.final * 0.85), meta:15 })
            .then(() => toast('Preventa abierta para "' + r.termino + '"', 'win'));
        } }, 'Abrir preventa'),
        el('button', { class:'btn btn-sm', onclick:() => {
          crearPiloto({ nombre:r.termino, unidades:30,
            costoUnitARS:r.importado.final, pvpARS:Math.round(r.local.final * 0.88),
            notas:`Detectado por el radar. Índice ${r.indice}×.` });
          toast('Piloto creado', 'win');
        } }, 'Probar con 30 unidades')) : null);
  }

  raiz.append(
    el('div', { class:'row-b', style:{ marginBottom:'14px' } },
      el('div', {}, el('div', { class:'kicker' }, 'Señales de la app'),
        el('h2', {}, 'Qué conviene traer')),
      el('button', { class:'btn btn-win', onclick:correr }, ic('rayo'), 'Correr el radar')),
    el('p', { class:'muted tiny', style:{ marginBottom:'14px', maxWidth:'80ch' } },
      'Cruza lo que la gente busca, lo que pide por "Traelo por mí", lo que deja en el carrito y a qué le pone alerta, contra la diferencia entre el precio local y el de traerlo. Cuando acá cuesta más de ' + UMBRAL_OPORTUNIDAD + ' veces lo que sale importarlo, hay margen.'),
    progreso, salida);
  correr();
  return raiz;
}

/* ============================================================
   3) PILOTOS
   ============================================================ */
function vistaPilotos(refrescar){
  const ps = store.get('pilotos') || [];
  if (!ps.length){
    return el('div', { class:'card center', style:{ padding:'40px' } },
      el('div', { style:{ fontSize:'38px' } }, '🧪'),
      el('h3', { style:{ margin:'10px 0 6px' } }, 'Sin pilotos todavía'),
      el('p', { class:'muted tiny' }, 'Un piloto es traer 20 o 50 unidades para ver si rota, antes de arriesgar plata en serio. Creá uno desde el nicho o desde el radar.'));
  }

  return el('div', { class:'col' }, ...ps.slice().reverse().map(p => {
    const v = evaluarPiloto(p);
    const color = { aprobado:'var(--win)', dudoso:'var(--warn)', rechazado:'var(--bad)', 'sin-datos':'var(--line-firme)' }[v.veredicto.estado];
    return el('div', { class:'card', style:{ borderLeft:`4px solid ${color}` } },
      el('div', { class:'row-b wrapf', style:{ marginBottom:'10px' } },
        el('div', {}, el('b', { style:{ fontSize:'15px' } }, p.nombre),
          el('div', { class:'tiny dim' }, `${p.unidades} unidades · desde ${fecha(p.inicio)} · ${p.estado}`)),
        el('div', { style:{ textAlign:'right' } },
          el('div', { class:'price price-lg', style:{ color } }, v.avance + '%'),
          el('div', { class:'tiny dim' }, `${v.vendidas} de ${p.unidades} vendidas`))),
      el('div', { class:'bar', style:{ marginBottom:'10px' } }, el('i', { style:{ width:v.avance + '%', background:color } })),
      el('div', { class:'grid g-4', style:{ marginBottom:'10px' } },
        mini('Ritmo', v.porSemana + ' /sem'),
        mini('Se agota en', v.semanasParaAgotar ? v.semanasParaAgotar + ' sem' : '—'),
        mini('Margen por unidad', plata(v.margenUnit)),
        mini('Resultado', plata(v.resultado), v.resultado >= 0 ? 'var(--win-tx)' : 'var(--bad)')),
      el('div', { class:'notice ' + (v.veredicto.estado === 'aprobado' ? 'notice-ok' : v.veredicto.estado === 'rechazado' ? 'notice-bad' : '') },
        v.veredicto.texto),
      el('div', { class:'row wrapf', style:{ marginTop:'10px' } },
        el('button', { class:'btn btn-sm', onclick:() => { registrarVenta(p.id, 1); refrescar(); } }, '+1 venta'),
        el('button', { class:'btn btn-sm', onclick:() => { registrarVenta(p.id, 5); refrescar(); } }, '+5 ventas'),
        v.veredicto.estado === 'aprobado' && p.estado !== 'graduado'
          ? el('button', { class:'btn btn-sm btn-win', onclick:() => {
              graduarANijuDirecto(p);
              toast('Pasó a NiJu Directo. Ahora importalo en serio.', 'win'); refrescar();
            } }, ic('check'), 'Pasar a NiJu Directo e importar formal') : null,
        p.estado === 'graduado' ? el('span', { class:'tag tag-ok' }, 'Ya está en NiJu Directo') : null));
  }));
}

/* ---------- utilitarios ---------- */
const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);
const mini = (t, v, col) => el('div', {},
  el('div', { class:'kicker' }, t), el('b', { style:{ fontSize:'15px', color:col || '' } }, v));
const linea = (k, v) => el('div', { class:'cost-line' },
  el('span', { class:'lbl' }, k), el('span', { class:'mono' }, v));
