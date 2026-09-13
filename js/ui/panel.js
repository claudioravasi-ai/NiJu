/* ============================================================
   NiJu — Panel del dueño
   Productos propios, marketing automático, contabilidad y
   tarifario. Es la trastienda del negocio.
   ============================================================ */
import { el, plata, num, ic, toast, fecha, hoja, uid } from '../util.js';
import { NIJU_PRODUCTOS } from '../data/niju-directo.js';
import { RUBROS } from '../data/catalog.js';
import { store } from '../state.js';
import { buscar } from '../engine/search.js';
import { CANALES, planDelDia, generarPieza, segmentos, programar } from '../engine/marketing.js';
import { TARIFARIO, calcularFee } from '../engine/fees.js';
import { comprobanteGestion, liquidacionPeriodo, csvLibroIVAVentas, EMISOR, ALICUOTAS } from '../engine/facturacion.js';
import { descargarCSV } from '../engine/fiscal.js';
import { salir } from '../engine/sesion.js';
import { vistaOportunidades } from './oportunidades.js';
import { vistaOperacion } from './ordenes.js';
import { FX } from '../engine/fx.js';

/* Confirmación de salida dentro de la app. Antes usaba confirm() del
   navegador: si el navegador bloquea esos cuadros (o la app instalada
   no los muestra), devolvía "no" sin preguntar y el botón no hacía nada. */
export function confirmarSalida(){
  const h = hoja({ titulo:'¿Salir del modo dueño?', ancho:420, cuerpo: el('div', { class:'col' },
    el('p', { class:'muted' }, 'El Panel y los Conectores dejan de verse. Para volver a entrar, tocá cinco veces el logo NiJu y poné tu clave.'),
    el('div', { class:'row', style:{ justifyContent:'flex-end', gap:'8px' } },
      el('button', { class:'btn', onclick:() => h.cerrar() }, 'Cancelar'),
      el('button', { class:'btn btn-win', onclick:() => {
        salir();
        h.cerrar();
        toast('Saliste del modo dueño');
        location.hash = '#/';
        location.reload();
      } }, 'Salir'))) });
}

export function vistaPanel(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div');
  let tab = 'resumen';

  const tabs = el('div', { class:'tabs' },
    ...[['resumen','Resumen'],['operacion','Órdenes para comprar'],['radar','Radar de oportunidades'],
        ['productos','Mis productos'],['marketing','Marketing automático'],
        ['contable','Contabilidad ARCA'],['tarifas','Tarifario']]
      .map(([id, n]) => el('button', { class:'tab' + (tab === id ? ' on' : ''), onclick:e => {
        tab = id; [...tabs.children].forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); pintar();
      } }, n)));

  raiz.append(el('section', { class:'section' },
    el('div', { class:'row-b wrapf', style:{ marginBottom:'14px' } },
      el('div', {},
        el('div', { class:'kicker' }, 'Solo para vos'),
        el('h1', {}, 'Panel NiJu')),
      /* Estado y salida en una sola píldora chica: la salida no compite
         con las acciones del Panel y recién se tiñe de rojo al pasar el mouse. */
      el('div', { class:'duenio-pill' },
        el('span', { class:'duenio-estado' }, el('i'), 'Modo dueño'),
        el('button', {
          class:'duenio-salir',
          title:'Salir del modo dueño: oculta el Panel y los Conectores hasta que vuelvas a entrar',
          'aria-label':'Salir del modo dueño',
          onclick:() => confirmarSalida()
        }, ic('salir'), 'Salir'))),
    tabs, cuerpo));

  function pintar(){
    cuerpo.replaceChildren(
      tab === 'resumen'   ? resumen() :
      tab === 'operacion' ? vistaOperacion(pintar) :
      tab === 'radar'     ? vistaOportunidades(ir) :
      tab === 'productos' ? productos(pintar) :
      tab === 'marketing' ? marketing() :
      tab === 'contable'  ? contable() : tarifas());
  }
  pintar();
  return raiz;
}

/* Lo que falta conectar para que la app deje de ser una demo.
   Está acá, a la vista, para que no se pierda entre mensajes. */
const PENDIENTES = [
  { q:'Crear el almacén KV y volver a subir el worker', listo:false,
    d:'Es la base de datos de clientes, órdenes y compras, y la que guarda campañas y demanda. Sin esto cada pedido queda en el teléfono del cliente y vos no lo ves.',
    donde:'backend/DESPLIEGUE.md → pasos B y E' },
  { q:'Conectar Mercado Pago', listo:false,
    d:'Hoy el cliente confirma y el pedido queda "pendiente de pago" hasta que vos lo confirmás a mano. Con Mercado Pago se cobra en la app y los reintegros salen solos.',
    donde:'Checkout Pro + MP_ACCESS_TOKEN en el backend' },
  { q:'Emails de seguimiento', listo:false,
    d:'Las novedades de cada compra ya se ven dentro de la app. Para que además lleguen por email hace falta un remitente con dominio verificado.',
    donde:'RESEND_API_KEY y AVISOS_DESDE en el Worker (paso F)' },
  { q:'Conectar Mercado Libre', listo:false,
    d:'Es la tienda que valida precios del nicho de insumos. Sin ella el radar no puede contrastar contra el mercado.',
    donde:'MELI_APP_ID y MELI_SECRET en el Worker' },
  { q:'Definir el depósito para las compras "todo junto"', listo:false,
    d:'Las tiendas despachan a una sola dirección. Sin depósito propio, conviene ofrecer solo "cada tienda te lo manda".',
    donde:'dirección, horario y quién recibe' },
  { q:'Validar los parámetros impositivos con un contador', listo:false,
    d:'Están cargados pero marcados como no verificados. No se publican hasta que alguien los confirme.',
    donde:'Impuestos → Parámetros vigentes' },
  { q:'Sociedad, CUIT y certificado digital de ARCA', listo:false,
    d:'Hace falta para emitir facturas con CAE. Hasta entonces los comprobantes son borradores.',
    donde:'lo gestiona el contador' },
  { q:'Cotizaciones reales de proveedores', listo:false,
    d:'Los precios FOB del nicho son rangos de referencia, no cotizaciones. Cambian toda la cuenta.',
    donde:'Radar → Cotizaciones' }
];

/* ---------------- Resumen ---------------- */
function resumen(){
  const compras = store.get('comprasAnio');
  const ingreso = compras.reduce((a, c) => a + (c.totalARS || 0) * 0.06, 0);
  const campanias = store.get('campanias');

  return el('div', { class:'section' },
    el('div', { class:'grid g-4', style:{ marginBottom:'18px' } },
      kpi('Operaciones', String(compras.length), 'este período'),
      kpi('GMV', plata(compras.reduce((a,c) => a + (c.totalARS || 0), 0)), 'volumen transaccionado'),
      kpi('Ingreso NiJu', plata(ingreso), 'comisión de gestión', 'var(--win)'),
      kpi('Piezas programadas', String(campanias.length), 'marketing')),
    el('div', { class:'grid g-2' },
      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'De dónde sale la plata'),
        ...[['Comisión de gestión internacional', 'El comprador paga por que le resolvamos la compra completa.'],
            ['Comisión de afiliado nacional', 'La paga la tienda. El comprador no ve recargo.'],
            ['Margen de NiJu Directo', 'Producto propio: el margen entero es nuestro.'],
            ['Servicios opcionales', 'Inspección, seguro, despacho prioritario, carpeta fiscal.'],
            ['Publicidad de terceros', 'Posiciones destacadas para vendedores verificados.']]
          .map(([t, d], i) => el('div', { class:'step' },
            el('span', { class:'step-n' }, String(i + 1)),
            el('div', {}, el('b', { class:'tiny' }, t), el('div', { class:'tiny dim' }, d))))),
      el('div', { class:'card', style:{ borderLeft:'4px solid var(--warn)' } },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Pendientes para que esto funcione de verdad'),
        ...PENDIENTES.map(p => el('div', { class:'step' },
          el('span', { class:'step-n', style:{ background: p.listo ? 'var(--win)' : 'var(--accion-suave)', color: p.listo ? 'var(--win-ink)' : 'var(--accion)' } },
            p.listo ? '✓' : '!'),
          el('div', { class:'spacer' },
            el('b', { class:'tiny' }, p.q),
            el('div', { class:'tiny dim' }, p.d),
            p.donde ? el('div', { class:'tiny', style:{ color:'var(--accion)' } }, p.donde) : null)))),

      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Estado del negocio'),
        el('div', { class:'notice' }, 'Modo DEMO: los datos de arriba salen de tu actividad local en este dispositivo. Al conectar Firebase y el backend, pasan a ser reales y compartidos.'),
        el('div', { style:{ marginTop:'12px' } },
          fila('Razón social', EMISOR.razonSocial), fila('CUIT', EMISOR.cuit),
          fila('Condición', 'Responsable Inscripto'), fila('Jurisdicción', EMISOR.jurisdiccion),
          fila('Punto de venta', String(EMISOR.ptoVta).padStart(5,'0')),
          fila('Actividad', `${EMISOR.actividad.codigo} — ${EMISOR.actividad.desc}`)),
        el('div', { class:'notice notice-bad', style:{ marginTop:'10px' } },
          'Faltan los datos reales de la sociedad y el certificado digital de ARCA para emitir comprobantes.'))));
}

/* ---------------- Productos propios ---------------- */
function productos(refrescar){
  const extra = store.get('nijuExtra');
  const todos = [...NIJU_PRODUCTOS, ...extra];

  const nuevo = () => {
    const f = {};
    const campo = (l, k, tipo = 'text') => el('div', { class:'field' }, el('label', {}, l),
      el('input', { class:'inp', type:tipo, oninput:e => f[k] = tipo === 'number' ? +e.target.value : e.target.value }));
    const { cerrar } = hoja({ titulo:'Cargar producto propio', cuerpo:el('div', { class:'col' },
      campo('Nombre del producto', 'n'),
      el('div', { class:'grid g-2' }, campo('Precio de venta (ARS)', 'precio', 'number'), campo('Precio tachado', 'precioTachado', 'number')),
      el('div', { class:'grid g-2' }, campo('Stock', 'stock', 'number'), campo('Cuotas', 'cuotas', 'number')),
      el('div', { class:'field' }, el('label', {}, 'Rubro'),
        el('select', { class:'inp', onchange:e => f.rubro = e.target.value }, ...RUBROS.map(r => el('option', { value:r.id }, r.nombre)))),
      el('div', { class:'field' }, el('label', {}, 'Emoji / imagen'), el('input', { class:'inp', value:'📦', oninput:e => f.emo = e.target.value })),
      el('div', { class:'field' }, el('label', {}, 'Descripción'), el('textarea', { class:'inp', oninput:e => f.desc = e.target.value })),
      el('label', { class:'switch' }, el('input', { type:'checkbox', onchange:e => f.envioGratis = e.target.checked }), el('span', {}, 'Envío gratis')),
      el('button', { class:'btn btn-win btn-block', onclick:() => {
        if (!f.n || !f.precio) return toast('Falta nombre o precio', 'bad');
        store.push('nijuExtra', { id:'nj-' + uid(), emo:f.emo || '📦', rubro:f.rubro || 'hogar',
          n:f.n, precio:f.precio, precioTachado:f.precioTachado || null, stock:f.stock || 0,
          cuotas:f.cuotas || 0, envioGratis:!!f.envioGratis, desc:f.desc || '', destacado:false });
        toast('Producto cargado', 'win'); cerrar(); refrescar();
      } }, 'Guardar producto'))});
  };

  return el('div', { class:'section' },
    el('div', { class:'row-b', style:{ marginBottom:'14px' } },
      el('div', {}, el('div', { class:'kicker' }, 'NiJu Directo'), el('h2', {}, `${todos.length} productos propios`)),
      el('button', { class:'btn btn-niju', onclick:nuevo }, '+ Cargar producto')),
    el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Producto'), el('th', {}, 'Rubro'),
        el('th', {}, 'Precio'), el('th', {}, 'Margen est.'), el('th', {}, 'Stock'), el('th', {}, ''))),
      el('tbody', {}, ...todos.map(p => {
        const margen = p.precio * TARIFARIO.propio.margenObjetivo;
        return el('tr', {},
          el('td', { style:{ fontSize:'22px' } }, p.emo),
          el('td', {}, el('b', { class:'tiny' }, p.n), el('div', { class:'tiny dim' }, (p.desc || '').slice(0, 60))),
          el('td', { class:'tiny dim' }, p.rubro),
          el('td', { class:'mono tiny' }, plata(p.precio),
            p.precioTachado ? el('div', { class:'tiny strike' }, plata(p.precioTachado)) : null),
          el('td', { class:'mono tiny', style:{ color:'var(--win-tx)' } }, plata(margen)),
          el('td', { class:'mono tiny', style:{ color: p.stock < 10 ? 'var(--bad)' : '' } }, num(p.stock)),
          el('td', {}, store.get('nijuExtra').some(x => x.id === p.id)
            ? el('button', { class:'btn btn-sm', onclick:() => { store.quitar('nijuExtra', x => x.id === p.id); refrescar(); } }, 'Borrar')
            : el('span', { class:'tiny dim' }, 'base')));
      })))));
}

/* ---------------- Marketing ---------------- */
function marketing(){
  const cont = el('div');
  const programadas = store.get('campanias');

  cont.append(el('div', { class:'card center', style:{ padding:'30px' } }, 'Analizando ofertas para armar el plan…'));

  buscar('', { orden:'ahorro' }, () => {}).then(({ grupos }) => {
    const top = grupos.filter(g => g.ahorroPct > 12).slice(0, 40);
    const plan = planDelDia(top);

    cont.replaceChildren(
      el('div', { class:'grid g-4', style:{ marginBottom:'18px' } },
        ...CANALES.slice(0, 4).map(c => el('div', { class:'kpi' },
          el('div', { class:'kicker' }, `${c.emo} ${c.nombre}`),
          el('b', {}, String(plan.filter(p => p.canal === c.id).length)),
          el('div', { class:'d dim' }, c.hora + ' h · ' + c.api)))),

      el('div', { class:'notice', style:{ marginBottom:'16px' } },
        'Publicar en redes requiere backend: los tokens de Meta, TikTok y del proveedor de email no pueden vivir en el navegador. La app arma la pieza, la programa y el backend la publica. Ver backend/README.md.'),

      el('div', { class:'row-b', style:{ marginBottom:'12px' } },
        el('h3', {}, 'Plan automático de hoy'),
        el('button', { class:'btn btn-win', onclick:() => {
          plan.forEach(programar); toast(`${plan.length} piezas programadas`, 'win');
        } }, ic('megafono'), 'Programar todo')),

      el('div', { class:'grid g-3' }, ...plan.map(pz => pieza(pz))),

      el('h3', { style:{ margin:'26px 0 12px' } }, 'Segmentos de clientes'),
      el('div', { class:'grid g-3' }, ...segmentos().map(s => el('div', { class:'card' },
        el('div', { class:'row-b' }, el('b', { class:'tiny' }, s.nombre), el('b', { class:'mono' }, num(s.n))),
        el('p', { class:'tiny dim', style:{ marginTop:'5px' } }, s.desc),
        el('button', { class:'btn btn-sm btn-block', style:{ marginTop:'8px' },
          onclick:() => toast('Campaña encolada para ' + s.nombre) }, 'Enviar campaña')))),

      programadas.length ? el('div', { style:{ marginTop:'26px' } },
        el('h3', { style:{ marginBottom:'10px' } }, 'Cola de publicación'),
        el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Canal'), el('th', {}, 'Pieza'), el('th', {}, 'Cuándo'), el('th', {}, 'Estado'))),
          el('tbody', {}, ...programadas.slice(-12).reverse().map(p => el('tr', {},
            el('td', {}, CANALES.find(c => c.id === p.canal)?.emo + ' ' + p.canal),
            el('td', { class:'tiny' }, p.titulo),
            el('td', { class:'tiny dim' }, fecha(p.programada)),
            el('td', {}, el('span', { class:'tag tag-ok' }, p.estado)))))))) : null);
  });

  return el('div', { class:'section' }, cont);
}

function pieza(pz){
  const c = CANALES.find(x => x.id === pz.canal);
  return el('div', { class:'post' },
    el('div', { class:'post-head' },
      el('span', { style:{ fontSize:'17px' } }, c?.emo),
      el('b', { class:'tiny spacer' }, c?.nombre),
      el('span', { class:'tiny dim' }, fecha(pz.programada))),
    el('div', { class:'post-canvas' },
      el('span', { class:'pill' }, pz.gancho),
      el('div', {},
        el('div', { style:{ fontSize:'40px', marginBottom:'8px' } }, pz.emo || '📦'),
        el('div', { class:'big' }, pz.titulo)),
      el('div', {},
        el('div', { class:'price price-lg price-win' }, plata(pz.precio)),
        el('div', { class:'tiny dim' }, `comparado en ${pz.tiendas} tiendas`))),
    el('div', { class:'post-foot' }, pz.texto.slice(0, 150) + '…'),
    el('div', { style:{ padding:'10px' } },
      el('button', { class:'btn btn-sm btn-block', onclick:() => {
        programar(pz); toast('Programada para ' + fecha(pz.programada), 'win');
      } }, 'Programar')));
}

/* ---------------- Contabilidad ---------------- */
function contable(){
  const compras = store.get('comprasAnio');

  /* Reconstruimos los comprobantes emitidos por la gestión */
  const comprobantes = compras.map(c => comprobanteGestion({
    feeARS: (c.totalARS || 0) * 0.06, incluyeIVA:true,
    condicion: store.get('usuario')?.perfilFiscal || 'consumidor_final',
    jurisdiccion: store.get('config').provincia,
    cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit,
              jurisdiccion:store.get('config').provincia },
    operacionId:c.fecha
  }));

  const gastosDemo = [{ neto: comprobantes.reduce((a,c) => a + c.neto, 0) * 0.28, iva: comprobantes.reduce((a,c) => a + c.neto, 0) * 0.28 * 0.21 }];
  const L = liquidacionPeriodo(comprobantes, gastosDemo);

  return el('div', { class:'section' },
    el('div', { class:'notice', style:{ marginBottom:'16px' } },
      'Así se discrimina la ganancia de NiJu: la comisión es un servicio gravado. Se factura con IVA, genera débito fiscal, paga IIBB por jurisdicción y tributa Ganancias sobre la utilidad.'),

    el('div', { class:'grid g-4', style:{ marginBottom:'18px' } },
      kpi('Ventas netas', plata(L.ventasNeto), 'base imponible'),
      kpi('Débito fiscal IVA', plata(L.debito), '21% s/ ventas'),
      kpi('Crédito fiscal', plata(L.credito), 'compras y gastos', 'var(--ok)'),
      kpi('Saldo IVA a pagar', plata(L.saldoIVA), 'F.2002', L.saldoIVA > 0 ? 'var(--warn)' : 'var(--ok)')),

    el('div', { class:'grid g-2' },
      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Estado de resultados del período'),
        fila('Ingresos netos (sin IVA)', plata(L.ventasNeto)),
        fila('Costos y gastos netos', '−' + plata(L.gastosNeto)),
        fila(`IIBB (${Object.keys(L.iibbPorJur).join(', ') || 'sin jurisdicción'})`, '−' + plata(L.iibbTotal)),
        el('div', { class:'cost-line total' }, el('span', {}, 'Utilidad antes de Ganancias'), el('b', {}, plata(L.utilidad))),
        fila(`Impuesto a las Ganancias (${ALICUOTAS.gananciasSociedades * 100}%)`, '−' + plata(L.ganancias)),
        el('div', { class:'cost-line total' }, el('span', {}, 'Utilidad neta'),
          el('b', { style:{ color:'var(--win-tx)' } }, plata(L.utilidadDespuesImp)))),

      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Obligaciones del período'),
        ...L.vencimientos.map(v => el('div', { class:'step' },
          el('span', { class:'step-n' }, '!'),
          el('div', { class:'spacer' }, el('b', { class:'tiny' }, v.nombre), el('div', { class:'tiny dim' }, v.cuando)),
          v.base !== null ? el('b', { class:'mono tiny' }, plata(v.base)) : null)),
        el('hr', { class:'rule', style:{ margin:'12px 0' } }),
        el('div', { class:'kicker', style:{ marginBottom:'8px' } }, 'IIBB por jurisdicción'),
        ...(Object.entries(L.iibbPorJur).length
          ? Object.entries(L.iibbPorJur).map(([j, v]) => fila(j, plata(v)))
          : [el('p', { class:'tiny dim' }, 'Sin operaciones todavía.')]),
        el('button', { class:'btn btn-win btn-block', style:{ marginTop:'12px' }, onclick:() => {
          descargarCSV('niju-libro-iva-ventas.csv', csvLibroIVAVentas(comprobantes)); toast('Libro IVA Ventas exportado', 'win');
        } }, ic('caja'), 'Exportar Libro IVA Ventas'))),

    el('div', { class:'notice notice-bad', style:{ marginTop:'16px' } },
      'Ninguno de estos comprobantes tiene CAE: son borradores. Para emitir de verdad hace falta el certificado digital de ARCA y el web service WSFEv1 corriendo en el backend. Validá alícuotas y encuadre con tu contador.'));
}

/* ---------------- Tarifario ---------------- */
function tarifas(){
  const ej = [50, 150, 400, 900, 2500];
  return el('div', { class:'section' },
    el('p', { class:'muted', style:{ marginBottom:'16px', maxWidth:'74ch' } },
      'Lo que NiJu cobra por gestionar. Está deliberadamente por debajo de la comisión de un marketplace: nosotros cobramos por resolver la operación completa, no por dejar publicar.'),

    el('div', { class:'tbl-wrap', style:{ marginBottom:'18px' } }, el('table', { class:'tbl' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Ticket'), el('th', {}, '% gestión'), el('th', {}, 'Mínimo'),
        el('th', {}, 'Logística'), el('th', {}, 'Fee total'), el('th', {}, '% efectivo'), el('th', {}, 'Neto + IVA'))),
      el('tbody', {}, ...ej.map(v => {
        const f = calcularFee({ valorUSD:v, tipo:'internacional' });
        const comp = comprobanteGestion({ feeARS:f.feeUSD * FX.tarjeta, incluyeIVA:true, condicion:'responsable_inscripto' });
        const tr = TARIFARIO.internacional.tramos.find(t => v <= t.hasta);
        return el('tr', {},
          el('td', { class:'mono' }, 'US$ ' + v),
          el('td', { class:'mono' }, (tr.pct * 100).toFixed(1) + '%'),
          el('td', { class:'mono' }, 'US$ ' + tr.minUSD),
          el('td', { class:'mono' }, 'US$ ' + TARIFARIO.internacional.logisticaFijaUSD),
          el('td', { class:'mono' }, el('b', {}, 'US$ ' + f.feeUSD.toFixed(2))),
          el('td', { class:'mono', style:{ color:'var(--win-tx)' } }, f.pctEfectivo + '%'),
          el('td', { class:'mono tiny' }, `${plata(comp.neto)} + ${plata(comp.iva)}`));
      })))),

    el('div', { class:'grid g-2' },
      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Otras fuentes'),
        fila('Compra nacional (comprador)', 'sin cargo'),
        fila('Comisión de afiliado nacional', (TARIFARIO.nacional.comisionAfiliadoPromedio * 100) + '% promedio'),
        fila('Mayorista / importación formal', (TARIFARIO.mayorista.pctSobreCIF * 100) + '% del CIF (mín. US$ ' + TARIFARIO.mayorista.minUSD + ')'),
        fila('NiJu Directo', 'margen objetivo ' + (TARIFARIO.propio.margenObjetivo * 100) + '%')),
      el('div', { class:'card' },
        el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Servicios opcionales'),
        ...TARIFARIO.extras.map(x => el('div', { class:'row-b', style:{ padding:'7px 0', borderBottom:'1px solid var(--line-soft)' } },
          el('div', {}, el('b', { class:'tiny' }, x.nombre), el('div', { class:'tiny dim' }, x.desc)),
          el('b', { class:'mono tiny' }, x.pct ? (x.pct * 100) + '%' : 'US$ ' + x.precioUSD))))),

    el('div', { class:'notice', style:{ marginTop:'16px' } },
      'Todos estos valores son parámetros en js/engine/fees.js. Cambiarlos ahí cambia la app entera, incluidas las facturas.'));
}

const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);
const fila = (k, v) => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, k), el('span', { class:'mono' }, v));
