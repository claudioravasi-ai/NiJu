/* ============================================================
   NiJu — "Vendé al mundo"
   ------------------------------------------------------------
   Desde el Decreto 604/2026 y la RG 5886/2026 de ARCA, exportar
   mercadería con fin comercial por correo no tiene límite de valor
   y se declara con un trámite digital simplificado (DESP).
   Esta pantalla lo explica para alguien que nunca exportó, calcula
   cuánto le queda en pesos y le deja pedir que NiJu lo acompañe.
   Todo lo que dice sale de la norma o de la fuente enlazada; lo que
   no está publicado se marca como "a confirmar".
   ============================================================ */
import { el, plata, ic, toast, hoja } from '../util.js';
import { FX } from '../engine/fx.js';
import { store } from '../state.js';
import { botonVolver } from './components.js';
import { enviarSolicitud, textoSolicitud } from '../engine/solicitudes.js';

const FUENTES = [
  { titulo:'RG 5886/2026 de ARCA (texto oficial)', url:'https://www.argentina.gob.ar/normativa/nacional/norma-428496/texto' },
  { titulo:'Decreto 604/2026 (Boletín Oficial)', url:'https://www.boletinoficial.gob.ar/detalleAviso/primera/344470/20260717' },
  { titulo:'Gobierno nacional: cómo funciona la exportación por correo', url:'https://www.argentina.gob.ar/noticias/el-gobierno-reglamenta-el-regimen-simplificado-para-exportaciones-comerciales-por-postal' },
  { titulo:'Correo Argentino: nuevo régimen de exportación', url:'https://www.correoargentino.com.ar/nuevo-regimen-de-importacion-y-exportacion-por-postal' },
  { titulo:'Factura E para monotributistas (Contablix)', url:'https://contablix.ar/blog/factura-e-exportacion-servicios-2026' },
  { titulo:'Comisiones de PayPal en Argentina (MyContador)', url:'https://blog.mycontador.com.ar/como-retirar-dinero-de-paypal-en-argentina-prex-bancos-y-factura-e/' }
];

const PASOS = [
  { quien:'Vos', t:'Conseguís el comprador', d:'En tu tienda online, en un marketplace del exterior o por redes. El comprador te paga en dólares.', ayuda:'NiJu te ayuda a elegir dónde publicar y a armar la publicación en inglés.' },
  { quien:'Vos, una sola vez', t:'Habilitás tu perfil exportador en ARCA', d:'Es un requisito de la norma para usar este régimen. Se hace con tu CUIT y clave fiscal.', ayuda:'Te guiamos en el trámite; si lo preferís, lo hacés con tu contador.' },
  { quien:'Vos', t:'Emitís la factura E', d:'Es la factura de exportación. La puede emitir un monotributista de cualquier categoría, y lo que facturás suma a tu tope anual del Monotributo.', ayuda:'Te decimos qué datos poner y en qué moneda.' },
  { quien:'Vos, con NiJu', t:'Buscás la posición arancelaria', d:'Es el código de 8 dígitos que dice qué es tu producto para la Aduana. Va en la declaración.', ayuda:'La buscamos juntos en el Arancel Integrado de ARCA.' },
  { quien:'Vos, con NiJu', t:'Completás la DESP en la web del Correo', d:'La Declaración de Exportación Simplificada Postal pide: quién manda y quién recibe, qué es, cuántas unidades, el valor FOB en dólares, la posición arancelaria, tu CUIT y el número de factura E. Incluye los datos del formulario postal internacional (CN22 o CN23).', ayuda:'La cargamos con vos o te la dejamos lista para revisar.' },
  { quien:'Vos', t:'Pagás la tasa del correo y los tributos', d:'La norma dice que se paga la tasa de servicio y, si corresponden, los tributos de exportación. El monto de la tasa no está publicado en la página del régimen: lo ves al declarar.', ayuda:'Te avisamos antes cuánto va a salir, para que lo pongas en tu precio.' },
  { quien:'Vos o NiJu', t:'Llevás el paquete al Correo', d:'El Correo verifica que lo recibió, le asigna un número y le pasa la declaración a ARCA en el momento. El paquete va al Centro Postal Internacional, la Aduana lo controla y sale.', ayuda:'Te decimos cómo embalarlo y etiquetarlo; podemos retirarlo y llevarlo.' },
  { quien:'Vos', t:'Cobrás, liquidás y guardás los papeles', d:'Si cobrás en dólares, la liquidación de las divisas sigue las reglas del Banco Central vigentes. Guardá factura E, DESP y comprobante de envío.', ayuda:'Todo queda en tu carpeta de NiJu para tu contador.' }
];

export function vistaExportar(ir){
  const raiz = el('div', { class:'wrap c-cuenta' });

  const pregunta = (titulo, ...contenido) => el('details', {}, el('summary', {}, titulo), el('div', { class:'c-faq-body' }, ...contenido));

  raiz.append(
    botonVolver(ir),
    el('section', { class:'c-hero' },
      el('span', { class:'c-hero-kicker' }, 'Nuevo · desde agosto de 2026'),
      el('h1', {}, 'Vendé al mundo desde tu casa'),
      el('p', {}, 'Si hacés o vendés algo en Argentina, ahora podés mandarlo a clientes de otros países por correo, sin límite de valor y con un trámite digital. NiJu te explica cada paso y, si querés, lo hace con vos.'),
      el('div', { class:'c-acciones', style:{ marginTop:'12px' } },
        el('button', { class:'btn btn-win btn-lg', onclick:() => document.getElementById('exp-form')?.scrollIntoView({ behavior:'smooth' }) }, ic('mundo'), 'Quiero vender afuera'),
        el('button', { class:'btn btn-lg', onclick:() => document.getElementById('exp-calc')?.scrollIntoView({ behavior:'smooth' }) }, ic('calc'), 'Calcular cuánto me queda'))),

    el('h2', { class:'c-seccion' }, 'Explicado fácil'),
    el('div', { class:'c-conceptos' },
      concepto('mundo', '¿Qué cambió?', 'Antes, mandar mercadería a otro país para venderla tenía límites de valor por correo o requería un despacho de exportación completo. Desde el Decreto 604/2026 y la RG 5886/2026 de ARCA, exportar por correo con fin comercial no tiene límite de valor y se declara con un formulario simplificado.'),
      concepto('usuario', '¿Quién puede?', 'Quien tenga CUIT y el perfil exportador habilitado en ARCA: un emprendedor, un monotributista, una pyme o una empresa. Tenés que emitir factura E y declarar el envío antes de despacharlo.'),
      concepto('caja', '¿Qué se puede mandar?', 'Mercadería que no tenga controles aduaneros especiales, que no esté sujeta a cupos de exportación y que no necesite permisos de otros organismos. Alimentos, cosméticos, medicamentos, plantas o animales suelen necesitarlos: consultá antes.'),
      concepto('etiqueta', '¿Qué ganás y qué resignás?', 'Ganás un trámite corto, digital y sin tope de valor. Resignás los beneficios a la exportación (por ejemplo, reintegros): la norma dice que elegir este camino implica renunciar a ellos.')),

    el('h2', { class:'c-seccion' }, 'Paso a paso'),
    el('ol', { class:'v-vacio-pasos' }, ...PASOS.map((p, i) => el('li', {},
      el('span', { class:'v-vacio-n', 'aria-hidden':'true' }, String(i + 1)),
      el('div', {},
        el('span', { class:'sv-quien' }, p.quien),
        el('b', { style:{ display:'block' } }, p.t),
        el('p', {}, p.d),
        el('p', { class:'tiny', style:{ color:'var(--win-tx)', margin:0 } }, ic('check'), ' ', p.ayuda))))),

    el('h2', { class:'c-seccion' }, 'Qué hace NiJu por vos'),
    el('div', { class:'grid g-2' },
      el('div', { class:'card' },
        el('b', {}, 'Te acompañamos'),
        el('p', { class:'tiny muted' }, 'Vos exportás a tu nombre y NiJu hace el trabajo pesado con vos: posición arancelaria, DESP, cálculo de costos, embalaje y etiqueta, retiro y entrega en el Correo, seguimiento del envío y carpeta con todos los papeles.')),
      el('div', { class:'card' },
        el('b', {}, 'Llegar a compradores de afuera'),
        el('p', { class:'tiny muted' }, 'Te ayudamos a elegir el marketplace o el canal donde conviene publicar tu producto, a armar la publicación en inglés y a fijar un precio que cubra correo, comisiones e impuestos.'))),
    el('p', { class:'c-legal' }, 'El precio del acompañamiento depende de lo que necesites y del volumen: te lo pasamos después de ver tu caso. Sin compromiso.'),

    calculadora(),

    el('h2', { class:'c-seccion' }, 'Preguntas frecuentes'),
    el('div', { class:'c-faq' },
      pregunta('¿Soy monotributista, puedo?',
        el('p', {}, 'Sí, podés emitir factura E en cualquier categoría. Ojo: lo que facturás al exterior suma a tu tope anual igual que una venta en el país, así que puede cambiarte la categoría. Hablalo con tu contador.')),
      pregunta('¿Hay un peso máximo por paquete?',
        el('p', {}, 'La RG 5886/2026 no fija límites de peso o medidas propios del régimen. Sí rigen los del servicio de correo internacional que uses: te los confirmamos al cotizar.')),
      pregunta('¿Pago derechos de exportación?',
        el('p', {}, 'La norma dice que se pagan "los tributos que correspondan". Si tu producto paga derechos de exportación depende de su posición arancelaria: lo confirmamos con la posición exacta antes de que vendas.')),
      pregunta('¿Cómo cobro?',
        el('p', {}, 'Como te pague el comprador: tarjeta internacional, plataformas como PayPal o transferencia. Cada una cobra su comisión (PayPal publica 5,4% más US$ 0,30 por venta en dólares para cuentas comerciales argentinas). La liquidación de divisas sigue las reglas del Banco Central del momento.')),
      pregunta('¿Y si el comprador lo devuelve?',
        el('p', {}, 'La vuelta al país es otro trámite (una reimportación). Conviene que tu política de devoluciones lo diga clarito antes de vender: te ayudamos a escribirla.'))),

    formulario(),

    el('h2', { class:'c-seccion' }, 'Fuentes'),
    el('div', { class:'c-links' }, ...FUENTES.map(f => el('a', { class:'c-fuente', href:f.url, target:'_blank', rel:'noopener' }, f.titulo))),
    el('p', { class:'c-legal' }, 'Información orientativa con la norma vigente al 14/09/2026. No reemplaza a un contador ni a un despachante de aduana.'));

  return raiz;
}

function concepto(icono, titulo, texto){
  return el('article', { class:'c-concepto' },
    el('div', { class:'c-concepto-head' }, el('span', { class:'c-ic' }, ic(icono)), el('h3', {}, titulo)),
    el('p', {}, texto));
}

/* ---------------- Envío internacional estimado ----------------
   Correo Argentino, Encomienda Internacional vía aérea: tarifa publicada
   en pesos (consultada el 14-09-2026), hasta 20 kg, 12 a 15 días. Se pasa
   a dólares con el oficial del día, así que el estimado sigue la cotización.
   El 30% de descuento vigente es solo para ayuda familiar, obsequios y
   muestras: una venta no lo tiene. */
const CORREO_INTERNACIONAL = {
  url:'https://www.correoargentino.com.ar/servicios/paqueteria/encomienda-internacional-aerea',
  zonas:[['mercosur', 'Mercosur'], ['sudamerica', 'Resto de Sudamérica'], ['america', 'Resto de América (EE.UU., México)'], ['europa', 'Europa'], ['mundo', 'Resto del mundo']],
  tabla:[[1, 66700, 102100, 125000, 133900, 141000], [3, 122400, 176600, 190600, 225500, 237100], [5, 176600, 215000, 248300, 292200, 311000],
    [10, 287700, 389400, 473500, 511000, 604200], [15, 413700, 539500, 604200, 719200, 766900], [20, 511000, 594300, 670700, 793600, 900900]]
};
function envioCorreo(pesoKg, zona){
  const fila = CORREO_INTERNACIONAL.tabla.find(([kg]) => pesoKg <= kg);
  const i = CORREO_INTERNACIONAL.zonas.findIndex(([id]) => id === zona);
  return fila && i >= 0 ? { ars:fila[i + 1], hastaKg:fila[0] } : null;
}

/* ---------------- ¿Cuánto me queda? ---------------- */
function calculadora(){
  const d = { precioUSD:40, unidades:1, costoARS:15000, envioUSD:null, pesoKg:0.5, zona:'america', comisionPct:5.4, comisionFijaUSD:0.30, derechoPct:0 };
  const salida = el('div');

  const campo = (etiqueta, clave, { pref = 'US$', ayuda = '', paso = '0.01' } = {}) => el('label', { class:'k2-campo' },
    el('span', {}, etiqueta),
    el('div', { class:'k2-input' }, el('b', {}, pref),
      el('input', { type:'number', inputmode:'decimal', min:'0', step:paso, value:d[clave] ?? '', placeholder:d[clave] == null ? 'cotizalo' : null,
        oninput:e => { d[clave] = e.target.value === '' ? null : +e.target.value; calcular(); } })),
    ayuda ? el('small', {}, ayuda) : null);

  function calcular(){
    const bruto = (d.precioUSD || 0) * (d.unidades || 1);
    const comision = bruto * (d.comisionPct || 0) / 100 + (d.comisionFijaUSD || 0);
    const derecho = bruto * (d.derechoPct || 0) / 100;
    const peso = (d.pesoKg || 0) * (d.unidades || 1);
    const correo = d.envioUSD == null ? envioCorreo(peso, d.zona) : null;
    const envioUSD = d.envioUSD ?? (correo ? correo.ars / FX.oficial : null);
    const zonaTxt = CORREO_INTERNACIONAL.zonas.find(([id]) => id === d.zona)?.[1] || '';
    const notaEnvio = d.envioUSD != null ? 'lo cargaste vos'
      : correo ? `estimado: Correo Argentino aéreo hasta ${correo.hastaKg} kg a ${zonaTxt}, ${plata(correo.ars)} al oficial`
      : 'más de 20 kg: el Correo no lo lleva, cotizá un courier';
    const netoUSD = bruto - comision - derecho - (envioUSD || 0);
    const netoARS = netoUSD * FX.oficial;
    const costo = (d.costoARS || 0) * (d.unidades || 1);
    const ganancia = netoARS - costo;
    const linea = (k, v, nota) => el('div', { class:'cost-line' },
      el('span', { class:'lbl' }, k, nota ? el('i', { class:'tiny dim', style:{ fontStyle:'normal' } }, ' · ' + nota) : null),
      el('span', { class:'mono' }, v));
    const usd = v => `US$ ${v.toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
    salida.replaceChildren(
      el('div', { class:'sv-resultado', 'aria-live':'polite' },
        el('small', {}, 'Te queda de ganancia, aproximada'),
        el('b', {}, plata(Math.round(ganancia))),
        el('span', { class:'tiny' }, bruto ? `${Math.round(ganancia / (bruto * FX.oficial) * 100)}% de lo que vendés` : '')),
      el('div', { class:'t-lineas', style:{ marginTop:'10px' } },
        linea('Vendés', usd(bruto), `${d.unidades || 1} u.`),
        linea('Comisión de cobro', '− ' + usd(comision),
          `${(d.comisionPct || 0).toLocaleString('es-AR')}% + US$ ${(d.comisionFijaUSD || 0).toLocaleString('es-AR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`),
        d.derechoPct ? linea('Derecho de exportación', '− ' + usd(derecho), `${d.derechoPct}%`) : null,
        linea('Envío internacional', envioUSD == null ? 'falta cotizar' : '− ' + usd(envioUSD), notaEnvio),
        linea('Te queda en dólares', usd(netoUSD)),
        linea('En pesos', plata(Math.round(netoARS)), `dólar oficial $ ${Math.round(FX.oficial).toLocaleString('es-AR')}`),
        linea('Menos lo que te cuesta', '− ' + plata(costo)),
        el('div', { class:'cost-line total' }, el('span', {}, 'Ganancia'), el('b', {}, plata(Math.round(ganancia))))),
      el('p', { class:'c-legal' }, 'El envío estimado sale de la ',
        el('a', { href:CORREO_INTERNACIONAL.url, target:'_blank', rel:'noopener' }, 'tarifa publicada de Correo Argentino'),
        ', pasada a dólares con el oficial de hoy; un courier (DHL, FedEx) cotiza aparte y suele ser más rápido y más caro. No incluye la tasa de servicio del Correo (se ve al declarar), tus impuestos (Monotributo o IVA e Ingresos Brutos) ni el acompañamiento de NiJu.'));
  }
  calcular();

  return el('section', { id:'exp-calc', class:'section' },
    el('h2', { class:'c-seccion' }, '¿Cuánto me queda?'),
    el('div', { class:'k2' },
      el('div', { class:'k2-form' },
        campo('Precio de venta por unidad', 'precioUSD'),
        campo('Unidades', 'unidades', { pref:'u.', paso:'1' }),
        campo('Lo que te cuesta cada unidad', 'costoARS', { pref:'$', paso:'1', ayuda:'Materiales, mano de obra y embalaje.' }),
        campo('Peso de cada unidad, con embalaje', 'pesoKg', { pref:'kg', paso:'0.1' }),
        el('label', { class:'k2-campo' }, el('span', {}, 'Destino'),
          el('select', { class:'inp', onchange:e => { d.zona = e.target.value; calcular(); } },
            ...CORREO_INTERNACIONAL.zonas.map(([id, t]) => el('option', { value:id, selected:id === d.zona || null }, t)))),
        campo('Envío internacional', 'envioUSD', { ayuda:'Vacío usa la tarifa publicada del Correo según peso y destino. Si te cotizaron otro, escribilo.' }),
        campo('Comisión de cobro', 'comisionPct', { pref:'%', ayuda:'La plataforma con la que cobrás (PayPal publica 5,4%).' }),
        campo('Cargo fijo por venta', 'comisionFijaUSD', { ayuda:'PayPal publica US$ 0,30 por venta en dólares.' }),
        campo('Derecho de exportación', 'derechoPct', { pref:'%', ayuda:'Depende de la posición arancelaria: confirmalo antes.' })),
      salida));
}

/* ---------------- Formulario ---------------- */
function formulario(){
  const u = store.get('usuario');
  const d = { nombre:[u?.nombre, u?.apellido].filter(Boolean).join(' '), contacto:u?.email || u?.telefono || '', necesita:[] };
  const campo = (etiqueta, clave, { ph = '', tipo = 'text', area = false } = {}) => el('label', { class:'k2-campo' },
    el('span', {}, etiqueta),
    el(area ? 'textarea' : 'input', { class:'inp', type:area ? null : tipo, placeholder:ph, value:area ? null : (d[clave] || ''),
      oninput:e => d[clave] = e.target.value }, area ? d[clave] || '' : null));
  const elegir = (etiqueta, clave, opciones) => {
    const cont = el('div', { class:'k2-chips' });
    const pintar = () => cont.replaceChildren(...opciones.map(o => el('button', { type:'button', class:'v-chip' + (d[clave] === o ? ' on' : ''),
      onclick:() => { d[clave] = o; pintar(); } }, o)));
    pintar();
    return el('div', { class:'k2-campo' }, el('span', {}, etiqueta), cont);
  };
  const necesita = () => {
    const cont = el('div', { class:'k2-chips' });
    const opciones = ['Entender si me conviene', 'La posición arancelaria', 'Hacer la DESP', 'Calcular precios', 'Embalaje y llevarlo al Correo', 'Publicar para compradores de afuera', 'Todo'];
    const pintar = () => cont.replaceChildren(...opciones.map(o => el('button', { type:'button', class:'v-chip' + (d.necesita.includes(o) ? ' on' : ''),
      onclick:() => { d.necesita = d.necesita.includes(o) ? d.necesita.filter(x => x !== o) : [...d.necesita, o]; pintar(); } }, o)));
    pintar();
    return el('div', { class:'k2-campo' }, el('span', {}, '¿En qué te ayudamos? (podés elegir varias)'), cont);
  };

  const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick:async () => {
    if (!d.nombre?.trim() || !d.contacto?.trim()) return toast('Poné tu nombre y un teléfono o email', 'bad');
    if (!d.producto?.trim()) return toast('Contanos qué querés vender', 'bad');
    boton.disabled = true;
    try{
      const r = await enviarSolicitud('exportar', d);
      toast(`Recibimos tu consulta (${r.id}). Te contactamos pronto.`, 'win');
    }catch(e){
      if (e.sinRuta) copiarPorAhora('exportar', d, e.message); else toast(e.message, 'bad');
    }finally{ boton.disabled = false; }
  } }, 'Enviar mi consulta');

  return el('section', { id:'exp-form', class:'section' },
    el('h2', { class:'c-seccion' }, 'Quiero vender al mundo'),
    el('div', { class:'card' },
      el('div', { class:'grid g-2' },
        campo('Tu nombre', 'nombre'),
        campo('Teléfono o email', 'contacto'),
        campo('¿Qué querés vender?', 'producto', { ph:'Ej: mates de calabaza grabados' }),
        campo('¿A qué países te gustaría llegar?', 'paises', { ph:'Ej: Estados Unidos, España' })),
      elegir('¿Tenés CUIT?', 'cuit', ['Sí, Monotributo', 'Sí, Responsable Inscripto', 'Tengo empresa', 'Todavía no']),
      elegir('¿Ya vendés por internet?', 'vende', ['Sí, en el país', 'Sí, también afuera', 'Todavía no']),
      campo('¿Cuántas unidades por mes, más o menos?', 'volumen', { ph:'Ej: 20' }),
      necesita(),
      campo('Algo más que quieras contarnos', 'notas', { area:true }),
      boton,
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } }, 'Usamos estos datos solo para responderte (Ley 25.326).')));
}

export function copiarPorAhora(tipo, datos, motivo){
  const texto = textoSolicitud(tipo, datos);
  const h = hoja({ titulo:'No se pudo enviar todavía', ancho:480, cuerpo:el('div', { class:'col' },
    el('div', { class:'notice notice-bad' }, motivo),
    el('p', {}, 'Tu consulta no se perdió: copiala y mandánosla por WhatsApp o email.'),
    el('textarea', { class:'inp', rows:'8', readonly:true }, texto),
    el('button', { class:'btn btn-win btn-block', onclick:() => navigator.clipboard?.writeText(texto).then(() => toast('Copiada', 'win')) }, 'Copiar mi consulta'),
    el('button', { class:'btn btn-block', onclick:() => h.cerrar() }, 'Cerrar')) });
}
