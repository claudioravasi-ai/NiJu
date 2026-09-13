/* ============================================================
   NiJu — Cuenta del cliente
   Para comprar hay que entrar con cuenta y tener completos los
   datos de filiación y fiscales. Con base de datos la cuenta vive en
   el servidor (email + clave); sin base, queda en el dispositivo y
   se dice con todas las letras.
   ============================================================ */
import { el, plata, ic, toast, fecha, hoja } from '../util.js';
import { store } from '../state.js';
import { PERFILES, carpetaAnual } from '../engine/fiscal.js';
import { PRODUCTO_BY_ID } from '../data/catalog.js';
import { CANALES } from '../engine/marketing.js';
import { modo, hayCuenta, registrar, entrarCliente, guardarPerfilNube, salirCliente } from '../engine/nube.js';
import { PROVINCIAS, problemas, perfilCompleto, limpiar, nombreCompleto, nombreFactura, domicilioTexto, formatoCuit } from '../engine/perfil.js';

const avisoLocal = () => el('div', { class:'notice notice-bad', style:{ marginBottom:'12px' } },
  el('b', {}, 'Sin base de datos todavía. '),
  'Tus datos quedan solo en este dispositivo hasta que se active el servidor de NiJu (almacén KV en Cloudflare).');

export function vistaCuenta(ir){
  const raiz = el('div', { class:'wrap' });
  const cuerpo = el('div', { class:'section' });
  raiz.append(cuerpo);

  async function pintar(){
    const m = await modo();
    if (m === 'sin-conexion'){
      cuerpo.replaceChildren(el('div', { class:'card center', style:{ padding:'30px' } },
        el('p', {}, 'No hay conexión con el servidor de NiJu.'),
        el('button', { class:'btn btn-win', onclick:pintar }, 'Probar de nuevo')));
      return;
    }
    const u = store.get('usuario');
    if ((m === 'nube' && !hayCuenta()) || !u){
      cuerpo.replaceChildren(ingreso({ modo:m, onListo:pintar }));
      return;
    }

    const cfg = store.get('config');
    const perfil = PERFILES[u.perfilFiscal || 'consumidor_final'] || PERFILES.consumidor_final;
    const compras = store.get('comprasAnio');
    const carpeta = carpetaAnual(compras, u.perfilFiscal || 'consumidor_final');
    const favs = store.get('favoritos');
    const faltan = problemas(u);

    cuerpo.replaceChildren(
      m === 'local' ? avisoLocal() : '',      /* replaceChildren escribe "null" si le pasás null */
      el('div', { class:'row-b wrapf', style:{ marginBottom:'18px' } },
        el('div', { class:'row' },
          el('div', { class:'brand-mark', style:{ width:'52px', height:'52px', fontSize:'20px' } }, (u.nombre || 'N')[0].toUpperCase()),
          el('div', {}, el('h2', {}, nombreCompleto(u) || u.nombre), el('div', { class:'tiny dim' }, u.email || ''),
            el('span', { class:'tag', style:{ color:perfil.color, marginTop:'4px' } }, perfil.label))),
        el('div', { class:'row wrapf' },
          el('button', { class:'btn btn-sm btn-win', onclick:() => ir('#/compras') }, ic('caja'), 'Mis compras'),
          el('button', { class:'btn btn-sm', onclick:() => {
            if (m === 'nube') salirCliente(); else store.set('usuario', null);
            toast('Cerraste la sesión'); pintar();
          } }, 'Cerrar sesión'))),

      Object.keys(faltan).length ? el('div', { class:'notice notice-bad', style:{ marginBottom:'16px' } },
        el('b', {}, 'Completá tus datos para poder comprar. '), `Falta: ${Object.values(faltan).join(' ')}`,
        el('div', { style:{ marginTop:'8px' } }, el('button', { class:'btn btn-sm btn-win', onclick:() => editar(u, m, pintar) }, 'Completar ahora'))) : '',

      el('div', { class:'grid g-4', style:{ marginBottom:'20px' } },
        kpi('Compras del año', String(compras.length)),
        kpi('Total gastado', plata(carpeta.totales.gastado)),
        kpi('A favor en ARCA', plata(carpeta.totales.saldoACuenta), 'percepciones', 'var(--nac)'),
        kpi('Favoritos', String(favs.length))),

      el('div', { class:'grid g-2' },
        el('div', { class:'card' },
          el('div', { class:'row-b', style:{ marginBottom:'10px' } },
            el('div', { class:'kicker' }, 'Tus datos'),
            el('button', { class:'btn btn-sm', onclick:() => editar(u, m, pintar) }, 'Editar')),
          fila('Nombre', nombreCompleto(u)),
          fila('DNI', u.dni || '—'),
          fila('Nacimiento', u.fechaNac ? new Date(u.fechaNac + 'T00:00:00').toLocaleDateString('es-AR') : '—'),
          fila('Teléfono', u.telefono || '—'),
          fila('Entrega en', domicilioTexto(u.domicilio) || '—'),
          el('hr', { class:'rule', style:{ margin:'8px 0' } }),
          fila('Facturar a', nombreFactura(u)),
          fila('CUIT / CUIL', formatoCuit(u.cuit) || '—'),
          fila('Condición', perfil.label),
          el('div', { class:'field', style:{ marginTop:'8px' } }, el('label', {}, 'Provincia para calcular IIBB y plazos'),
            el('select', { class:'inp', onchange:e => store.set('config', { ...cfg, provincia:e.target.value }) },
              ...PROVINCIAS.map(p => el('option', { value:p, selected:cfg.provincia === p || null }, p)))),
          el('div', { class:'notice', style:{ marginTop:'10px' } }, perfil.desc),
          el('button', { class:'btn btn-block', style:{ marginTop:'10px' }, onclick:() => ir('#/impuestos') },
            ic('calc'), 'Ver mi carpeta impositiva')),

        el('div', { class:'card' },
          el('div', { class:'kicker', style:{ marginBottom:'10px' } }, 'Avisos y marketing'),
          el('p', { class:'tiny dim', style:{ marginBottom:'10px' } },
            'Las novedades de tus compras te llegan siempre dentro de la app. Elegí además por dónde querés enterarte de ofertas.'),
          ...CANALES.filter(c => ['email', 'push', 'whatsapp'].includes(c.id)).map(c =>
            el('label', { class:'switch', style:{ padding:'7px 0' } },
              el('input', { type:'checkbox', checked:(u.canales || ['email']).includes(c.id) || null,
                onchange:e => {
                  const s = new Set(u.canales || ['email']);
                  e.target.checked ? s.add(c.id) : s.delete(c.id);
                  actualizarCanales([...s]);
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
            el('b', { class:'tiny' }, `${p.marca} ${p.n}`)) : null;
        }))) : '',

      compras.length ? el('div', { style:{ marginTop:'20px' } },
        el('h3', { style:{ marginBottom:'10px' } }, 'Resumen para tu carpeta fiscal'),
        el('div', { class:'tbl-wrap' }, el('table', { class:'tbl' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Fecha'), el('th', {}, 'Detalle'), el('th', {}, 'Tienda'), el('th', {}, 'Total'))),
          el('tbody', {}, ...compras.slice().reverse().map(c => el('tr', {},
            el('td', { class:'tiny' }, fecha(c.fecha)),
            el('td', { class:'tiny' }, c.titulo),
            el('td', { class:'tiny dim' }, c.tienda),
            el('td', { class:'mono tiny' }, plata(c.totalARS)))))))) : ''
    );

    async function actualizarCanales(canales){
      try{ await guardarPerfil({ ...store.get('usuario'), canales }, m); }
      catch(e){ toast(e.message, 'bad'); }
    }
  }

  pintar();
  return raiz;
}

async function guardarPerfil(perfil, m){
  if (m === 'nube') return guardarPerfilNube(perfil);
  store.set('usuario', perfil);
  return perfil;
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
    if (listo()) return resolve(store.get('usuario'));

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
        selector('Provincia', 'domicilio.provincia', [['', 'Elegí…'], ...PROVINCIAS.map(p => [p, p])])),
      campo('Referencias para el repartidor', 'domicilio.referencias', { ph:'Opcional: timbre, entre calles…' })),

    titulo('Datos fiscales'),
    el('div', { class:'grid g-2' },
      campo('CUIT o CUIL', 'cuit', { ph:'20-12345678-3', ayuda:'La tienda lo pide para facturar y ARCA para las compras al exterior.' }),
      selector('Condición ante ARCA', 'perfilFiscal', Object.entries(PERFILES).map(([id, p]) => [id, p.label])),
      campo('Razón social', 'razonSocial', { ph:'Solo si facturás como empresa', ayuda:'Si lo dejás vacío, facturamos a tu nombre.' })),

    el('div', { style:{ marginTop:'16px' } },
      envolver('aceptaTerminos', null, el('label', { class:'switch' },
        el('input', { type:'checkbox', checked:f.aceptaTerminos ? true : null,
          onchange:e => f.aceptaTerminos = e.target.checked ? Date.now() : null }),
        el('span', { class:'tiny' }, 'Acepto los términos y autorizo a NiJu a comprar en mi nombre en las tiendas que elija (mandato de compra).'))),
      el('label', { class:'switch', style:{ marginTop:'8px' } },
        el('input', { type:'checkbox', checked:f.aceptaMarketing || null, onchange:e => f.aceptaMarketing = e.target.checked }),
        el('span', { class:'tiny' }, 'Quiero recibir ofertas. Me puedo dar de baja cuando quiera.')),
      el('p', { class:'tiny dim', style:{ marginTop:'8px' } },
        'Usamos tus datos solo para comprar, facturar y entregar tus pedidos (Ley 25.326). Podés pedir verlos, corregirlos o borrarlos cuando quieras.')),
    boton);
}

const kpi = (t, v, d, col) => el('div', { class:'kpi' },
  el('div', { class:'kicker' }, t), el('b', { style:{ color:col || '' } }, v), d ? el('div', { class:'d dim' }, d) : null);

const fila = (k, v) => el('div', { class:'cost-line' }, el('span', { class:'lbl' }, k), el('span', { class:'tiny', style:{ textAlign:'right' } }, v));
