/* ============================================================
   NiJu — "Traelo por mí"
   Si el producto no está en la app, el cliente pega el link de
   CUALQUIER tienda del mundo. Lo leemos, lo traemos adentro, le
   decimos cuánto sale puesto en su casa —con impuestos y gestión—
   y NiJu se encarga de todos los trámites.
   ============================================================ */
import { el, plata, num, ic, toast, fecha, uid, debounce } from '../util.js';
import { CONFIG } from '../config.js';
import { RUBROS } from '../data/catalog.js';
import { calcularImportacion, mejorRegimen } from '../engine/taxes.js';
import { calcularFee, TARIFARIO } from '../engine/fees.js';
import { comprobanteGestion, ALICUOTAS } from '../engine/facturacion.js';
import { consecuenciasFiscales } from '../engine/fiscal.js';
import { aPesos, aUSD, FX } from '../engine/fx.js';
import { store } from '../state.js';
import { foto } from './components.js';

/* Pasos que NiJu se compromete a hacer por el cliente */
const TRAMITES = [
  ['Verificamos el vendedor',   'Chequeamos que la tienda y el vendedor sean confiables antes de poner un peso.'],
  ['Compramos por vos',         'Pagamos en la plataforma de origen con nuestros medios. Vos nos pagás en pesos, acá.'],
  ['Consolidamos el envío',     'Recibimos el paquete y lo preparamos para viajar.'],
  ['Hacemos la aduana',         'Declaración, franquicia y derechos: el trámite lo hacemos nosotros.'],
  ['Te lo llevamos a tu casa',  'Última milla y seguimiento hasta la puerta.'],
  ['Te dejamos la carpeta',     'Comprobantes y tratamiento impositivo listos para tu contador.']
];

export function vistaPedido(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div');

  let datos = null;          // lo que devolvió el resolver
  let manual = false;
  const form = { pesoKg:1, unidades:1, destino:'uso', rubro:'tecnologia' };

  /* ---------- Entrada ---------- */
  const link = el('input', { class:'inp', type:'url', placeholder:'Pegá acá el link del producto — Amazon, AliExpress, Mercado Libre, eBay, Alibaba, Temu, la tienda que sea' });
  const estado = el('div');
  const salida = el('div');

  const buscarLink = async () => {
    const u = link.value.trim();
    if (!u) return toast('Pegá primero el link del producto', 'bad');
    if (!/^https?:\/\//i.test(u)) return toast('El link tiene que empezar con http:// o https://', 'bad');

    estado.replaceChildren(el('div', { class:'card' },
      el('div', { class:'row' }, el('div', { class:'sk', style:{ width:'64px', height:'64px' } }),
        el('div', { class:'spacer col' },
          el('div', { class:'sk', style:{ height:'13px', width:'70%' } }),
          el('div', { class:'sk', style:{ height:'13px', width:'40%' } })))));
    salida.replaceChildren();

    try{
      const r = await fetch(`${CONFIG.api}/resolver?url=${encodeURIComponent(u)}`);
      const d = await r.json();
      datos = d;
      if (!d.ok || !d.titulo){
        // El backend puede devolver un error técnico: al cliente le hablamos claro.
        const tecnico = !d.sugerencia;
        estado.replaceChildren(el('div', { class:'notice' },
          el('b', {}, tecnico ? 'Todavía no podemos leer links automáticamente.' : (d.error || 'No pudimos leer esa página.')),
          el('div', { class:'tiny', style:{ marginTop:'5px' } },
            d.sugerencia || 'Cargá los datos a mano acá abajo y te cotizamos igual, con impuestos y gestión incluidos.'),
          tecnico ? el('div', { class:'tiny dim', style:{ marginTop:'4px' } }, 'Detalle técnico: ' + d.error) : null));
        manual = true;
        pintarManual(u, d.tienda);
        return;
      }
      manual = false;
      pintarEncontrado(d);
    }catch(e){
      estado.replaceChildren(el('div', { class:'notice notice-bad' },
        el('b', {}, 'No pudimos conectarnos para leer el link.'),
        el('div', { class:'tiny', style:{ marginTop:'5px' } },
          CONFIG.modoDatos === 'demo'
            ? 'El backend todavía no está encendido. Cargá los datos a mano y te cotizamos igual.'
            : String(e.message || e))));
      manual = true;
      pintarManual(link.value.trim(), null);
    }
  };

  link.addEventListener('keydown', e => { if (e.key === 'Enter') buscarLink(); });

  /* ---------- Producto encontrado ---------- */
  function pintarEncontrado(d){
    estado.replaceChildren(
      el('div', { class:'card' },
        el('div', { class:'row', style:{ alignItems:'flex-start', gap:'16px' } },
          foto({ imagen:d.imagen, titulo:d.titulo }, '', ),
          el('div', { class:'spacer' },
            el('div', { class:'row', style:{ gap:'7px', marginBottom:'4px' } },
              el('span', { class:'tag tag-ok' }, '✓ Encontrado'),
              el('span', { class:'tag ' + (d.tienda?.tipo === 'nacional' ? 'tag-nac' : 'tag-int') }, d.tienda?.nombre || 'Tienda externa'),
              d.fuente ? el('span', { class:'tiny dim' }, 'leído de ' + d.fuente) : null),
            el('h3', { style:{ marginBottom:'6px' } }, d.titulo),
            d.marca ? el('div', { class:'tiny dim' }, 'Marca: ' + d.marca) : null,
            d.precio != null
              ? el('div', { class:'price price-lg', style:{ marginTop:'6px' } }, plata(d.precio, d.moneda || 'USD'))
              : el('div', { class:'notice', style:{ marginTop:'8px' } }, 'La página no publica el precio de forma legible. Cargalo a mano abajo.'),
            d.aviso ? el('div', { class:'notice notice-bad', style:{ marginTop:'8px' } },
              el('b', {}, 'Revisá el precio. '), d.aviso) : null,
            d.candidatos && d.candidatos.length > 1
              ? el('div', { style:{ marginTop:'8px' } },
                  el('div', { class:'kicker', style:{ marginBottom:'5px' } }, 'Precios que encontramos en esa página'),
                  el('div', { class:'row wrapf' }, ...[...new Set(d.candidatos.map(c => c.valor))].sort((a,b) => a-b)
                    .map(v => el('button', {
                      class:'chip' + (v === form.precio ? ' on-win' : ''),
                      onclick:ev => {
                        form.precio = v;
                        [...ev.currentTarget.parentNode.children].forEach(x => x.classList.remove('on-win'));
                        ev.currentTarget.classList.add('on-win');
                        pintarCotizador();
                      } }, plata(v, d.moneda || 'USD')))))
              : null,
            el('a', { href:d.url, target:'_blank', rel:'noopener', class:'tiny' }, 'Ver en la tienda original ↗')))));

    const f = document.createElement('div');
    form.precio = d.precio ?? 0;
    form.moneda = d.moneda || (d.tienda?.moneda || 'USD');
    form.titulo = d.titulo;
    form.imagen = d.imagen;
    form.tienda = d.tienda;
    form.url = d.url;
    pintarCotizador();
  }

  /* ---------- Carga a mano ---------- */
  function pintarManual(u, tienda){
    form.url = u; form.tienda = tienda || { nombre:'Tienda externa', tipo:'internacional', moneda:'USD' };
    form.titulo = ''; form.precio = 0; form.moneda = form.tienda.moneda || 'USD'; form.imagen = null;

    const campo = (label, key, tipo = 'text', paso) => el('div', { class:'field' },
      el('label', {}, label),
      el('input', { class:'inp', type:tipo, step:paso, value:form[key] ?? '',
        oninput:e => { form[key] = tipo === 'number' ? (+e.target.value || 0) : e.target.value; pintarCotizador(); } }));

    salida.replaceChildren(el('div', { class:'card', style:{ marginTop:'14px' } },
      el('h3', { style:{ marginBottom:'12px' } }, 'Contanos qué querés que traigamos'),
      el('div', { class:'grid g-2' },
        campo('Qué es', 'titulo'),
        campo('Precio en la tienda', 'precio', 'number', '0.01'),
        el('div', { class:'field' }, el('label', {}, 'Moneda'),
          el('select', { class:'inp', onchange:e => { form.moneda = e.target.value; pintarCotizador(); } },
            ...['USD','ARS','EUR','CNY'].map(m => el('option', { value:m, selected:form.moneda === m || null }, m)))),
        campo('Link', 'url'))));
    pintarCotizador(true);
  }

  /* ---------- Cotización ---------- */
  function pintarCotizador(soloAgregar = false){
    const internacional = (form.tienda?.tipo || 'internacional') !== 'nacional';
    const valorUSD = aUSD(form.precio || 0, form.moneda || 'USD') * (form.unidades || 1);
    const fleteUSD = internacional
      ? Math.max(9, (form.pesoKg || 1) * (form.unidades || 1) * 11)
      : 0;

    const m = internacional ? mejorRegimen({
      valorUSD, fleteUSD, pesoKg:(form.pesoKg || 1) * (form.unidades || 1),
      rubro:form.rubro, unidades:form.unidades || 1
    }) : null;
    const imp = m ? m[m.elegido] : null;

    const fee = calcularFee({ valorUSD, fleteUSD, tipo: internacional ? 'internacional' : 'nacional' });
    const perfilId = store.get('usuario')?.perfilFiscal || 'consumidor_final';
    const comp = comprobanteGestion({
      feeARS: fee.feeUSD * FX.tarjeta, incluyeIVA:true, condicion:perfilId,
      jurisdiccion: store.get('config').provincia,
      cliente:{ nombre:store.get('usuario')?.nombre || 'Consumidor Final', cuit:store.get('usuario')?.cuit }
    });

    const productoARS  = aPesos(form.precio || 0, form.moneda || 'USD') * (form.unidades || 1);
    const fleteARS     = fleteUSD * FX.tarjeta;
    const impuestosARS = imp ? (imp.impuestos + (imp.gastos || 0)) * FX.tarjeta : 0;
    const totalARS     = Math.round(productoARS + fleteARS + impuestosARS + comp.total);

    const campoNum = (label, key, paso = '1') => el('div', { class:'field' },
      el('label', {}, label),
      el('input', { class:'inp', type:'number', step:paso, value:String(form[key]),
        oninput:e => { form[key] = +e.target.value || 0; pintarCotizador(); } }));

    const cotizacion = el('div', { class:'grid g-2', style:{ marginTop:'14px', alignItems:'start' } },
      el('div', { class:'card' },
        el('h3', { style:{ marginBottom:'12px' } }, 'Datos del envío'),
        el('div', { class:'grid g-2' },
          campoNum('Peso aproximado (kg)', 'pesoKg', '0.1'),
          campoNum('Cantidad', 'unidades'),
          el('div', { class:'field' }, el('label', {}, 'Rubro'),
            el('select', { class:'inp', onchange:e => { form.rubro = e.target.value; pintarCotizador(); } },
              ...RUBROS.map(r => el('option', { value:r.id, selected:form.rubro === r.id || null }, r.nombre)))),
          el('div', { class:'field' }, el('label', {}, 'Destino'),
            el('select', { class:'inp', onchange:e => { form.destino = e.target.value; pintarCotizador(); } },
              el('option', { value:'uso', selected:form.destino === 'uso' || null }, 'Uso personal'),
              el('option', { value:'reventa', selected:form.destino === 'reventa' || null }, 'Reventa')))),
        el('div', { class:'notice', style:{ marginTop:'12px' } },
          'El peso define el flete. Si no lo sabés, dejá 1 kg: al confirmar el pedido lo pesamos de verdad y te ajustamos la diferencia antes de cobrarte.')),

      el('div', { class:'card card-hard' },
        el('h3', { style:{ marginBottom:'4px' } }, 'Puesto en tu casa'),
        el('div', { class:'tiny dim', style:{ marginBottom:'12px' } }, 'Todo incluido. No hay sorpresas después.'),
        linea('Producto', productoARS, form.moneda !== 'ARS' ? `${plata(form.precio, form.moneda)} × ${form.unidades}` : null),
        internacional ? linea('Flete internacional', fleteARS, `estimado, ${form.pesoKg * form.unidades} kg`) : null,
        imp ? linea('Impuestos de importación', impuestosARS, imp.regimen === 'courier' ? 'courier puerta a puerta' : 'importación formal') : null,
        comp.condicion === 'responsable_inscripto'
          ? [linea('Gestión NiJu (neto)', comp.neto), linea(`IVA ${(ALICUOTAS.iva*100).toFixed(0)}%`, comp.iva)]
          : linea('Gestión NiJu', comp.total, `${fee.pctEfectivo || 0}% · IVA incluido`),
        el('div', { class:'cost-line total' }, el('span', {}, 'Total'), el('b', {}, plata(totalARS))),
        m ? el('div', { class:'notice notice-ok', style:{ marginTop:'10px' } }, m.motivo) : null,
        imp?.bloqueado ? el('div', { class:'notice notice-bad', style:{ marginTop:'8px' } },
          'Esta compra excede los límites del courier: hay que hacerla por importación formal, con despachante.') : null,
        el('button', {
          class:'btn btn-lg btn-win btn-block', style:{ marginTop:'12px' },
          disabled: (!form.titulo || !form.precio) || null,
          onclick:() => confirmar(totalARS, imp, fee, comp, ir)
        }, ic('envio'), 'Pedir que NiJu lo traiga'),
        el('div', { class:'tiny dim center' }, 'Sin cargo hasta que confirmes. Te mandamos la cotización final por mail.')));

    const nodos = [cotizacion];
    if (soloAgregar) salida.append(...nodos);
    else salida.replaceChildren(...nodos);
  }

  function confirmar(totalARS, imp, fee, comp, ir){
    const pedido = {
      id:'pd-' + uid(), creado:Date.now(), estado:'cotizado',
      titulo:form.titulo, imagen:form.imagen, url:form.url,
      tienda:form.tienda?.nombre || 'Tienda externa',
      precio:form.precio, moneda:form.moneda, unidades:form.unidades,
      pesoKg:form.pesoKg, rubro:form.rubro, destino:form.destino,
      totalARS, regimen:imp?.regimen || null, feeUSD:fee.feeUSD, ivaFeeARS:comp.iva
    };
    store.push('pedidos', pedido);
    store.push('comprasAnio', {
      fecha:Date.now(), titulo:form.titulo, tienda:pedido.tienda,
      tipo:(form.tienda?.tipo === 'nacional' ? 'nacional' : 'internacional'),
      regimen:pedido.regimen, totalARS, ivaFeeARS:comp.iva,
      valorUSD:aUSD(form.precio, form.moneda) * form.unidades, destino:form.destino
    });
    toast('¡Pedido creado! Lo vas a ver en Mis pedidos', 'win');
    pintar();
  }

  /* ---------- Pedidos existentes ---------- */
  function listaPedidos(){
    const p = store.get('pedidos') || [];
    if (!p.length) return null;
    return el('div', { class:'section' },
      el('h2', { style:{ marginBottom:'12px' } }, 'Mis pedidos especiales'),
      el('div', { class:'col' }, ...p.slice().reverse().map(x => el('div', { class:'card' },
        el('div', { class:'row', style:{ gap:'14px' } },
          foto({ imagen:x.imagen, titulo:x.titulo }, '', ),
          el('div', { class:'spacer' },
            el('div', { class:'row', style:{ gap:'7px' } },
              el('b', {}, x.titulo || 'Pedido'),
              el('span', { class:'tag tag-ok' }, x.estado)),
            el('div', { class:'tiny dim' }, `${x.tienda} · ${x.unidades} u. · ${fecha(x.creado)}`),
            x.url ? el('a', { href:x.url, target:'_blank', rel:'noopener', class:'tiny' }, 'Ver original ↗') : null),
          el('div', { style:{ textAlign:'right' } },
            el('div', { class:'price price-lg' }, plata(x.totalARS)),
            el('div', { class:'tiny dim' }, x.regimen || 'nacional')))))));
  }

  /* ---------- Armado ---------- */
  function pintar(){
    const nodos = [
      el('section', { class:'section' },
        el('div', { class:'kicker' }, 'Traelo por mí'),
        el('h1', { style:{ marginBottom:'8px' } }, '¿No lo encontrás? Lo traemos igual'),
        el('p', { class:'muted', style:{ maxWidth:'72ch', marginBottom:'18px' } },
          'Pegá el link del producto en cualquier tienda del mundo. Lo leemos, te decimos cuánto sale puesto en tu casa —con envío, impuestos y gestión— y nos encargamos de todos los trámites. Vos pagás en pesos, acá.'),
        el('div', { class:'row', style:{ gap:'8px', maxWidth:'820px' } },
          link, el('button', { class:'btn btn-win', onclick:buscarLink }, ic('buscar'), 'Traer')),
        el('div', { class:'sugg' },
          el('span', { class:'tiny dim', style:{ alignSelf:'center' } }, 'Funciona con:'),
          ...['Amazon','AliExpress','Mercado Libre','eBay','Alibaba','Temu','SHEIN','Walmart','y cualquier otra']
            .map(t => el('span', { class:'chip tiny' }, t))),
        el('div', { style:{ marginTop:'18px' } }, estado, salida)),

      listaPedidos(),

      el('section', { class:'section' },
        el('h2', { style:{ marginBottom:'12px' } }, 'De qué nos encargamos nosotros'),
        el('div', { class:'grid g-3' },
          ...TRAMITES.map(([t, d], i) => el('div', { class:'card' },
            el('div', { class:'row', style:{ marginBottom:'6px' } },
              el('span', { class:'step-n' }, String(i + 1)), el('b', {}, t)),
            el('p', { class:'tiny muted' }, d))))),

      el('div', { class:'notice', style:{ marginBottom:'24px' } },
        'Importante: en una compra internacional el importador es el cliente. NiJu gestiona la operación y responde por la gestión, pero la garantía del fabricante puede no ser válida en el país. Está todo explicado antes de que confirmes.')
    ];
    cuerpo.replaceChildren(...nodos.filter(Boolean));
  }

  pintar();
  raiz.append(cuerpo);
  return raiz;
}

const linea = (k, v, nota) => el('div', { class:'cost-line' },
  el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
  el('span', { class:'mono' }, v ? plata(v) : '—'));
