/* ============================================================
   NiJu — Cuenta del cliente
   Para comprar hay que entrar con cuenta y tener completos los
   datos de filiación y fiscales. Con base de datos la cuenta vive en
   el servidor (email + clave); sin base, queda en el dispositivo y
   se dice con todas las letras.
   Los números de la cuenta salen de los pedidos reales: lo pagado
   por un lado y lo pendiente de pago por otro. Nada se cuenta como
   compra antes de que se acredite el pago.
   ============================================================ */
import { el, plata, ic, toast, hoja } from '../util.js';
import { store } from '../state.js';
import { PERFILES, carpetaAnual } from '../engine/fiscal.js';
import { CANALES } from '../engine/marketing.js';
import { modo, hayCuenta, registrar, entrarCliente, guardarPerfilNube, salirCliente } from '../engine/nube.js';
import { comprasDelCliente } from '../engine/ordenes.js';
import { PROVINCIAS, problemas, perfilCompleto, limpiar, nombreCompleto, nombreFactura, domicilioTexto, formatoCuit } from '../engine/perfil.js';
import { puntosDePerfil } from '../data/fuentes-fiscales.js';
import { descargarResumenPDF } from './resumen-pdf.js';
import { botonVolver } from './components.js';
import { abrirTerminos } from './info.js';
import { progreso, leerPromosPublicas, miBeneficio } from '../engine/promos.js';

const avisoLocal = () => el('div', { class:'notice notice-bad', style:{ marginBottom:'12px' } },
  el('b', {}, 'Sin base de datos todavía. '),
  'Tus datos quedan solo en este dispositivo hasta que se active el servidor de NiJu (almacén KV en Cloudflare).');

/** La provincia sale del domicilio que se cargó al registrarse: con ella
    se calculan plazos e impuestos provinciales. No se vuelve a pedir. */
export function sincronizarProvincia(u = store.get('usuario')){
  const p = u?.domicilio?.provincia;
  const cfg = store.get('config');
  if (p && cfg.provincia !== p) store.set('config', { ...cfg, provincia:p });
}

export function vistaCuenta(ir){
  const raiz = el('div', { class:'wrap c-cuenta' });
  const cuerpo = el('div');
  raiz.append(botonVolver(ir), cuerpo);

  async function pintar(){
    const m = await modo();
    if (m === 'sin-conexion'){
      cuerpo.replaceChildren(el('div', { class:'c-card center', style:{ padding:'30px', marginTop:'14px' } },
        el('p', {}, 'No hay conexión con el servidor de NiJu.'),
        el('button', { class:'btn btn-win', onclick:pintar }, 'Probar de nuevo')));
      return;
    }
    const u = store.get('usuario');
    if ((m === 'nube' && !hayCuenta()) || !u){
      cuerpo.replaceChildren(ingreso({ modo:m, onListo:pintar }));
      return;
    }
    sincronizarProvincia(u);

    const perfil = PERFILES[u.perfilFiscal || 'consumidor_final'] || PERFILES.consumidor_final;
    const faltan = problemas(u);
    const favs = store.get('favoritos');

    /* Los números llegan del servidor: mientras tanto, el esqueleto. */
    const kpis = el('div', { class:'c-kpis' }, ...[0, 1, 2, 3].map(() => el('div', { class:'c-kpi v-sk', style:{ minHeight:'92px' } })));
    const situacion = el('div', {}, el('div', { class:'c-card v-sk', style:{ minHeight:'320px' } }));
    const fidelidad = el('div');

    cuerpo.replaceChildren(
      m === 'local' ? avisoLocal() : '',      /* replaceChildren escribe "null" si le pasás null */
      cabecera(u, perfil, m, ir, pintar),
      Object.keys(faltan).length ? el('div', { class:'notice notice-bad', style:{ marginTop:'14px' } },
        el('b', {}, 'Completá tus datos para poder comprar. '), `Falta: ${Object.values(faltan).join(' ')}`,
        el('div', { style:{ marginTop:'8px' } }, el('button', { class:'btn btn-sm btn-win', onclick:() => editar(u, m, pintar) }, 'Completar ahora'))) : '',
      kpis,
      el('div', { class:'c-grid' },
        tarjetaDatos(u, perfil, () => editar(u, m, pintar)),
        el('div', { class:'c-col' }, fidelidad, situacion, tarjetaAvisos(u, m, pintar))));

    const anio = new Date().getFullYear();
    try{
      const [{ pagadas, pendientes }, publicas, beneficio] = await Promise.all([comprasDelCliente(), leerPromosPublicas(), miBeneficio()]);
      if (!raiz.isConnected) return;
      const carpeta = carpetaAnual(pagadas, u.perfilFiscal || 'consumidor_final', anio);
      const nPagadas = carpeta.operaciones.length;
      const aPagar = pendientes.reduce((a, o) => a + (o.totalARS || 0), 0);
      kpis.replaceChildren(
        kpi('check', 'Compras pagadas', String(nPagadas), nPagadas ? `en ${anio}` : 'todavía ninguna', () => ir('#/compras')),
        kpi('alerta', 'Pendientes de pago', String(pendientes.length), pendientes.length ? `${plata(aPagar)} por pagar` : 'nada pendiente',
            () => ir('#/compras'), pendientes.length ? 'warn' : ''),
        kpi('etiqueta', 'Total pagado', plata(carpeta.totales.gastado), 'solo lo ya acreditado'),
        kpi('corazon', 'Favoritos', String(favs.length), favs.length ? 'productos guardados' : 'tocá el corazón en un producto'));
      situacion.replaceChildren(tarjetaImpositiva(u, perfil, carpeta, pendientes, ir));
      fidelidad.replaceChildren(tarjetaFidelidad(pagadas, publicas?.niveles, beneficio));
    }catch(e){
      if (!raiz.isConnected) return;
      kpis.replaceChildren(el('div', { class:'notice notice-bad' }, 'No pudimos leer tus compras: ' + (e.message || e)));
      situacion.replaceChildren(tarjetaImpositiva(u, perfil, carpetaAnual([], u.perfilFiscal || 'consumidor_final', anio), [], ir));
    }
  }

  pintar();
  return raiz;
}

/* ---------------- Piezas de la cuenta ---------------- */
function cabecera(u, perfil, m, ir, repintar){
  const iniciales = (((u.nombre || '')[0] || '') + ((u.apellido || '')[0] || '')) || (u.email || 'N')[0];
  const alta = u.creada ? new Date(u.creada).toLocaleDateString('es-AR', { month:'long', year:'numeric' }) : null;
  return el('header', { class:'c-cab' },
    el('div', { class:'c-cab-banda' }),
    el('div', { class:'c-cab-info' },
      el('div', { class:'c-avatar', 'aria-hidden':'true' }, iniciales.toUpperCase()),
      el('div', { class:'c-cab-txt' },
        el('h1', {}, nombreCompleto(u) || u.nombre || 'Tu cuenta'),
        el('div', { class:'c-cab-meta' },
          el('span', {}, u.email || ''),
          el('button', { class:'c-perfil', style:`--pc:${perfil.color}`, title:'Qué significa tu condición', onclick:() => ir('#/impuestos?tab=perfil') }, perfil.label, ' ›'),
          alta ? el('span', {}, `Cliente desde ${alta}`) : null)),
      el('div', { class:'c-cab-acciones' },
        el('button', { class:'btn btn-win', onclick:() => ir('#/compras') }, ic('caja'), 'Mis compras'),
        el('button', { class:'btn', onclick:() => {
          if (m === 'nube') salirCliente(); else store.set('usuario', null);
          toast('Cerraste la sesión'); repintar();
        } }, ic('salir'), 'Cerrar sesión'))));
}

function tarjetaDatos(u, perfil, alEditar){
  const bloque = (icono, titulo, filas, nota) => el('div', { class:'c-bloque' },
    el('div', { class:'c-bloque-tit' }, el('span', { class:'c-ic' }, ic(icono)), titulo),
    el('dl', { class:'c-datos' }, ...filas.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v || '—')])),
    nota ? el('p', { class:'c-nota' }, nota) : null);
  const nacimiento = u.fechaNac ? new Date(u.fechaNac + 'T00:00:00').toLocaleDateString('es-AR') : null;
  const provincia = u.domicilio?.provincia;
  return el('section', { class:'c-card' },
    el('div', { class:'c-card-head' }, el('h2', {}, 'Tus datos'),
      el('button', { class:'btn btn-sm', onclick:alEditar }, 'Editar')),
    bloque('usuario', 'Personales', [['Nombre', nombreCompleto(u)], ['DNI', u.dni], ['Nacimiento', nacimiento], ['Celular', u.telefono]]),
    bloque('envio', 'Entrega',
      [['Domicilio', domicilioTexto(u.domicilio)], ...(u.domicilio?.referencias ? [['Referencias', u.domicilio.referencias]] : [])],
      provincia ? `Los plazos de entrega y los impuestos provinciales se calculan con ${provincia}. Para cambiarla, editá tu domicilio.` : null),
    bloque('calc', 'Facturación',
      [['Se factura a', nombreFactura(u)], ['CUIT / CUIL', formatoCuit(u.cuit)], ['Condición ante ARCA', perfil.label]]));
}

function tarjetaImpositiva(u, perfil, carpeta, pendientes, ir){
  const saldo = (titulo, valor, explicacion) => el('div', { class:'c-saldo' },
    el('small', {}, titulo), el('b', {}, valor), el('span', {}, explicacion));
  return el('section', { class:'c-card' },
    el('div', { class:'c-card-head' },
      el('h2', {}, 'Tu situación impositiva'),
      el('span', { class:'c-perfil', style:`--pc:${perfil.color}` }, perfil.label)),
    el('p', { class:'c-sub' }, perfil.desc),
    el('ul', { class:'c-puntos' }, ...puntosDePerfil(perfil).map(p =>
      el('li', { class:p.si ? 'si' : 'no' }, ic(p.si ? 'check' : 'alerta'), el('span', {}, el('b', {}, p.titulo), p.texto)))),
    el('div', { class:'c-saldos' },
      saldo(`Pagado en ${carpeta.anio}`, plata(carpeta.totales.gastado), 'compras acreditadas'),
      saldo('IVA que recuperás', plata(carpeta.totales.creditoFiscal), perfil.computaIVA ? 'va a tu DDJJ' : 'no aplica'),
      saldo('A tu favor', plata(carpeta.totales.saldoACuenta), 'percepciones')),
    pendientes.length ? el('p', { class:'c-nota' },
      `${pendientes.length === 1 ? 'Tenés un pedido pendiente' : `Tenés ${pendientes.length} pedidos pendientes`} de pago: no cuenta${pendientes.length === 1 ? '' : 'n'} hasta que se acredite el pago.`) : null,
    el('div', { class:'c-acciones' },
      el('button', { class:'btn btn-win', onclick:() => descargarResumenPDF({ usuario:u, carpeta, pendientes }) }, ic('caja'), 'Descargar resumen (PDF)'),
      el('button', { class:'btn', onclick:() => ir('#/impuestos?tab=carpeta') }, ic('calc'), 'Ver mi carpeta'),
      el('button', { class:'p-link', onclick:() => ir('#/impuestos?tab=guia') }, '¿Qué significa cada cosa?', ic('der'))),
    el('p', { class:'c-legal' }, 'NiJu ordena la información de tus compras; no reemplaza a tu contador.'));
}

/** "Más comprás, más ahorrás": cuánto falta para el próximo beneficio. */
function tarjetaFidelidad(pagadas, niveles, beneficio){
  const gasto = pagadas.reduce((a, x) => a + (x.totalARS || 0), 0);
  const p = progreso(pagadas.length, gasto, niveles);
  const falta = [
    p.faltanCompras ? `${p.faltanCompras} compra${p.faltanCompras === 1 ? '' : 's'} pagada${p.faltanCompras === 1 ? '' : 's'}` : null,
    p.faltaGasto ? `${plata(p.faltaGasto)} en compras` : null
  ].filter(Boolean).join(' y ');
  return el('section', { class:'c-card f-card' },
    el('div', { class:'c-card-head' }, el('h2', {}, 'Más comprás, más ahorrás'), el('span', { class:'c-ic' }, ic('estrella'))),
    beneficio ? el('p', { class:'f-logrado' }, el('b', {}, `Sos ${beneficio.nombre}. `),
      `Tenés ${beneficio.pct}% menos en la gestión de NiJu en cada compra: se descuenta solo en el carrito.`) : null,
    p.proximo
      ? [ el('p', { class:'c-sub' }, `Tu próximo nivel: ${p.proximo.nombre}, con ${p.proximo.pct}% menos en la gestión.`),
          el('div', { class:'f-barra', role:'progressbar', 'aria-valuemin':'0', 'aria-valuemax':'100', 'aria-valuenow':String(Math.round(p.avance * 100)) },
            el('i', { style:{ width:Math.round(p.avance * 100) + '%' } })),
          el('p', { class:'c-sub' }, falta ? `Te falta: ${falta}.` : 'Ya lo alcanzaste: lo estamos revisando para otorgártelo.') ]
      : el('p', { class:'c-sub' }, 'Llegaste al nivel más alto. ¡Gracias por confiar en nosotros!'),
    el('p', { class:'c-legal' }, 'Cada beneficio lo revisa y lo aprueba una persona de NiJu.'));
}

function tarjetaAvisos(u, m, repintar){
  const canales = new Set(u.canales || ['email']);
  const alertas = store.get('alertas');
  return el('section', { class:'c-card' },
    el('div', { class:'c-card-head' }, el('h2', {}, 'Avisos')),
    el('p', { class:'c-sub' }, 'Las novedades de tus compras te llegan siempre dentro de la app. Elegí además por dónde enterarte de ofertas.'),
    ...CANALES.filter(c => ['email', 'push', 'whatsapp'].includes(c.id)).map(c =>
      el('label', { class:'v-switch' },
        el('span', {}, `${c.emo} ${c.nombre}`, el('small', { class:'c-canal-fmt' }, c.formato)),
        el('input', { type:'checkbox', checked:canales.has(c.id) || null, onchange: async e => {
          e.target.checked ? canales.add(c.id) : canales.delete(c.id);
          try{ await guardarPerfil({ ...store.get('usuario'), canales:[...canales] }, m); toast('Preferencia guardada', 'win'); }
          catch(err){ toast(err.message, 'bad'); }
        } }),
        el('i'))),
    el('div', { class:'c-bloque-tit', style:{ marginTop:'16px' } }, el('span', { class:'c-ic' }, ic('campana')), 'Alertas de precio'),
    ...(alertas.length
      ? alertas.map(a => el('div', { class:'c-alerta' },
          el('span', {}, a.titulo),
          el('b', {}, plata(a.objetivo)),
          el('button', { class:'iconbtn', 'aria-label':'Borrar alerta', onclick:() => { store.quitar('alertas', x => x.productoId === a.productoId); repintar(); } }, ic('x'))))
      : [el('p', { class:'c-sub' }, 'Todavía no creaste ninguna. Entrá a un producto y pedí aviso cuando baje.')]));
}

async function guardarPerfil(perfil, m){
  const guardado = m === 'nube' ? await guardarPerfilNube(perfil) : (store.set('usuario', perfil), perfil);
  sincronizarProvincia(store.get('usuario') || perfil);
  return guardado;
}

function editar(u, m, alTerminar){
  const h = hoja({ titulo:'Tus datos', ancho:700, cuerpo:formPerfil({ perfil:u, modo:'editar', emailFijo:m === 'nube',
    onGuardar: async p => { await guardarPerfil(p, m); toast('Datos guardados', 'win'); h.cerrar(); alTerminar(); } }) });
}

/* ------------------------------------------------------------------
   Antes de confirmar un pedido: sesión abierta y datos completos.
   Devuelve el perfil, o null si la persona cerró sin terminar.
   ------------------------------------------------------------------ */
export function asegurarCuenta(){
  return new Promise(async resolve => {
    let m;
    try{ m = await modo(); }catch{ m = 'sin-conexion'; }
    if (m === 'sin-conexion'){ toast('No hay conexión con el servidor de NiJu. Probá de nuevo.', 'bad'); return resolve(null); }
    const listo = () => (m === 'local' || hayCuenta()) && perfilCompleto(store.get('usuario'));
    if (listo()){ sincronizarProvincia(); return resolve(store.get('usuario')); }

    let terminado = false;
    const cuerpo = el('div');
    const h = hoja({ titulo:'Para comprar necesitamos saber quién sos', ancho:720, cuerpo,
                     alCerrar:() => { if (!terminado) resolve(null); } });
    const paso = () => {
      const u = store.get('usuario');
      if ((m === 'nube' && !hayCuenta()) || !u){
        cuerpo.replaceChildren(ingreso({ modo:m, onListo:paso, dentroDeHoja:true }));
      } else if (!perfilCompleto(u)){
        cuerpo.replaceChildren(
          el('div', { class:'notice', style:{ marginBottom:'12px' } },
            el('b', {}, 'Faltan datos para comprar. '),
            'La tienda factura y despacha con estos datos, y ARCA los pide en las compras al exterior.'),
          formPerfil({ perfil:u, modo:'editar', emailFijo:m === 'nube', onGuardar: async p => { await guardarPerfil(p, m); paso(); } }));
      } else {
        terminado = true;
        sincronizarProvincia(u);
        h.cerrar();
        resolve(u);
      }
    };
    paso();
  });
}

/* ---------------- Entrar / crear cuenta ---------------- */
function ingreso({ modo:m, onListo, dentroDeHoja = false }){
  let pestania = m === 'nube' ? 'entrar' : 'registro';
  const cont = el('div', dentroDeHoja ? {} : { class:'card card-hard', style:{ maxWidth:'720px', margin:'24px auto' } });

  function pintar(){
    cont.replaceChildren(
      dentroDeHoja ? '' : el('div', { class:'kicker' }, 'Tu cuenta NiJu'),
      dentroDeHoja ? '' : el('h2', { style:{ marginBottom:'10px' } }, pestania === 'entrar' ? 'Entrá para comprar' : 'Creá tu cuenta'),
      m === 'local' ? avisoLocal() : '',
      m === 'nube' ? el('div', { class:'tabs', style:{ marginBottom:'14px' } },
        ...[['entrar', 'Ya tengo cuenta'], ['registro', 'Crear cuenta']].map(([id, n]) =>
          el('button', { class:'tab' + (pestania === id ? ' on' : ''), onclick:() => { pestania = id; pintar(); } }, n))) : '',
      pestania === 'entrar'
        ? formEntrar(onListo)
        : formPerfil({ perfil:{}, modo:'registro', conClave:m === 'nube',
            onGuardar: async (p, cred) => {
              if (m === 'nube') await registrar({ email:p.email, clave:cred.clave, perfil:p });
              else store.set('usuario', { ...p, creada:Date.now() });
              sincronizarProvincia(p);
              toast('¡Bienvenido a NiJu!', 'win');
              onListo();
            } }));
  }
  pintar();
  return cont;
}

function formEntrar(onListo){
  const email = el('input', { class:'inp', type:'email', autocomplete:'email', placeholder:'tu@email.com' });
  const clave = el('input', { class:'inp', type:'password', autocomplete:'current-password', placeholder:'Tu clave' });
  const boton = el('button', { class:'btn btn-lg btn-win btn-block', onclick: async () => {
    if (!email.value.trim() || !clave.value) return toast('Poné tu email y tu clave', 'bad');
    boton.disabled = true; boton.textContent = 'Entrando…';
    try{
      await entrarCliente(email.value.trim().toLowerCase(), clave.value);
      sincronizarProvincia();
      toast('¡Hola de nuevo!', 'win');
      onListo();
    }catch(e){ toast(e.message, 'bad'); }
    finally{ boton.disabled = false; boton.textContent = 'Entrar'; }
  } }, 'Entrar');
  clave.addEventListener('keydown', e => { if (e.key === 'Enter') boton.click(); });
  return el('div', { class:'col', style:{ maxWidth:'420px' } },
    el('div', { class:'field' }, el('label', {}, 'Email'), email),
    el('div', { class:'field' }, el('label', {}, 'Clave'), clave),
    boton,
    el('p', { class:'tiny dim' }, 'Si te olvidaste la clave, escribinos desde Mensajes: la recuperación por email llega cuando se active el envío de emails.'));
}

/* ---------------- Formulario de datos ---------------- */
export function formPerfil({ perfil = {}, modo = 'editar', conClave = false, emailFijo = false, onGuardar }){
  const f = structuredClone({ perfilFiscal:'consumidor_final', canales:['email'], ...perfil });
  f.domicilio = { ...(f.domicilio || {}) };
  if (!f.apellido && f.nombre && !perfil.domicilio){      // cuentas viejas: "Nombre Apellido" en un solo campo
    const [n, ...resto] = String(f.nombre).trim().split(/\s+/);
    if (resto.length){ f.nombre = n; f.apellido = resto.join(' '); }
  }
  const cred = { clave:'', repetir:'' };
  const nodos = {};
  const get = r => r.split('.').reduce((o, k) => o?.[k], f);
  const set = (r, v) => { const ks = r.split('.'); let o = f; for (const k of ks.slice(0, -1)) o = o[k] ||= {}; o[ks.at(-1)] = v; };

  const envolver = (ruta, label, control, ayuda) => {
    const msg = el('div', { class:'tiny', style:{ color:'var(--bad)' }, hidden:true });
    const wrap = el('div', { class:'field' }, label ? el('label', {}, label) : null, control, ayuda ? el('div', { class:'tiny dim' }, ayuda) : null, msg);
    nodos[ruta] = { msg, control };
    return wrap;
  };
  const campo = (label, ruta, { tipo = 'text', ph = '', ayuda = '', auto = null, fijo = false } = {}) =>
    envolver(ruta, label, el('input', { class:'inp', type:tipo, value:get(ruta) ?? '', placeholder:ph, autocomplete:auto,
      disabled:fijo || null, oninput:e => set(ruta, e.target.value) }), ayuda);
  const selector = (label, ruta, opciones, ayuda) =>
    envolver(ruta, label, el('select', { class:'inp', onchange:e => set(ruta, e.target.value) },
      ...opciones.map(([v, t]) => el('option', { value:v, selected:(get(ruta) ?? '') === v || null }, t))), ayuda);
  const credencial = (label, k, auto) => envolver(k, label,
    el('input', { class:'inp', type:'password', autocomplete:auto, oninput:e => cred[k] = e.target.value }));
  const titulo = t => el('div', { class:'kicker', style:{ margin:'16px 0 8px' } }, t);

  const boton = el('button', { class:'btn btn-lg btn-win btn-block', style:{ marginTop:'14px' }, onclick: async () => {
    const errs = problemas(f);
    if (conClave){
      if (cred.clave.length < 8) errs.clave = 'Mínimo 8 caracteres.';
      else if (cred.clave !== cred.repetir) errs.repetir = 'Las claves no coinciden.';
    }
    for (const [ruta, n] of Object.entries(nodos)){
      const m = errs[ruta];
      n.msg.hidden = !m; n.msg.textContent = m || '';
      n.control.classList.toggle('inp-error', !!m);
    }
    const primero = Object.keys(nodos).find(r => errs[r]);
    if (primero){
      toast('Revisá los datos marcados en rojo', 'bad');
      nodos[primero].control.scrollIntoView({ block:'center', behavior:'smooth' });
      nodos[primero].control.focus({ preventScroll:true });
      return;
    }
    const texto = boton.textContent;
    boton.disabled = true; boton.textContent = 'Guardando…';
    try{ await onGuardar(limpiar(f), { clave:cred.clave }); }
    catch(e){ toast(e.message || 'No se pudo guardar', 'bad'); }
    finally{ boton.disabled = false; boton.textContent = texto; }
  } }, modo === 'registro' ? 'Crear cuenta' : 'Guardar mis datos');

  return el('div', {},
    titulo('Acceso'),
    el('div', { class:'grid g-2' },
      campo('Email', 'email', { tipo:'email', ph:'tu@email.com', auto:'email', fijo:emailFijo,
        ayuda:emailFijo ? 'Es tu usuario: no se puede cambiar.' : 'Te mandamos las novedades de tus compras.' }),
      conClave ? el('div') : null),
    conClave ? el('div', { class:'grid g-2' },
      credencial('Clave (mínimo 8)', 'clave', 'new-password'),
      credencial('Repetí la clave', 'repetir', 'new-password')) : null,

    titulo('Datos personales'),
    el('div', { class:'grid g-2' },
      campo('Nombre', 'nombre', { auto:'given-name' }),
      campo('Apellido', 'apellido', { auto:'family-name' }),
      campo('DNI', 'dni', { ph:'Sin puntos', auto:'off' }),
      campo('Fecha de nacimiento', 'fechaNac', { tipo:'date', auto:'bday' }),
      campo('Celular', 'telefono', { tipo:'tel', ph:'11 5555 5555', auto:'tel', ayuda:'Para coordinar la entrega.' })),

    titulo('Domicilio de entrega'),
    el('div', { class:'grid g-2' },
      campo('Calle', 'domicilio.calle', { auto:'address-line1' }),
      el('div', { class:'grid g-2' },
        campo('Número', 'domicilio.numero'),
        campo('Piso / depto', 'domicilio.piso', { ph:'Opcional' })),
      campo('Localidad', 'domicilio.localidad', { auto:'address-level2' }),
      el('div', { class:'grid g-2' },
        campo('Código postal', 'domicilio.cp', { ph:'1414 o C1414AAB', auto:'postal-code' }),
        selector('Provincia', 'domicilio.provincia', [['', 'Elegí…'], ...PROVINCIAS.map(p => [p, p])],
          'Con esta provincia calculamos plazos de entrega e impuestos provinciales.')),
      campo('Referencias para el repartidor', 'domicilio.referencias', { ph:'Opcional: timbre, entre calles…' })),

    titulo('Datos fiscales'),
    el('div', { class:'grid g-2' },
      campo('CUIT o CUIL', 'cuit', { ph:'20-12345678-3', ayuda:'La tienda lo pide para facturar y ARCA para las compras al exterior.' }),
      selector('Condición ante ARCA', 'perfilFiscal', Object.entries(PERFILES).map(([id, p]) => [id, p.label]),
        'Tiene que coincidir con tu constancia de inscripción. Si no estás inscripto, sos Consumidor Final.'),
      campo('Razón social', 'razonSocial', { ph:'Solo si facturás como empresa', ayuda:'Si lo dejás vacío, facturamos a tu nombre.' })),

    el('div', { style:{ marginTop:'16px' } },
      envolver('aceptaTerminos', null, el('label', { class:'switch' },
        el('input', { type:'checkbox', checked:f.aceptaTerminos ? true : null,
          onchange:e => f.aceptaTerminos = e.target.checked ? Date.now() : null }),
        el('span', { class:'tiny' }, 'Acepto los ',
          el('button', { type:'button', class:'p-link', style:{ fontSize:'inherit', padding:'0' }, onclick:e => { e.preventDefault(); abrirTerminos(); } }, 'términos y condiciones'),
          ' y autorizo a NiJu a comprar en mi nombre en las tiendas que elija (mandato de compra).'))),
      el('label', { class:'switch', style:{ marginTop:'8px' } },
        el('input', { type:'checkbox', checked:f.aceptaMarketing || null, onchange:e => f.aceptaMarketing = e.target.checked }),
        el('span', { class:'tiny' }, 'Quiero recibir ofertas. Me puedo dar de baja cuando quiera.')),
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
        'Usamos tus datos solo para comprar, facturar y entregar tus pedidos (Ley 25.326). Podés pedir verlos, corregirlos o borrarlos cuando quieras.')),
    boton);
}

/** Número de la cuenta con su ícono. Si tiene destino, se puede tocar. */
function kpi(icono, titulo, valor, explicacion, alTocar = null, tono = ''){
  return el(alTocar ? 'button' : 'div', { class:'c-kpi' + (tono ? ' ' + tono : ''), onclick:alTocar },
    el('span', { class:'c-ic' }, ic(icono)),
    el('span', { class:'c-kpi-txt' }, el('small', {}, titulo), el('b', {}, valor), el('span', {}, explicacion)));
}
