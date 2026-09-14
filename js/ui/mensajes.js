/* ============================================================
   NiJu — Mensajes
   El asistente de NiJu responde de verdad (engine/asesor.js): usa
   tu condición ante ARCA, tu provincia y tu carrito, y si algo no
   lo sabe lo dice. Antes contestaba frases al azar ("lo reviso y
   te confirmo") a cualquier cosa, incluso a un "hola".
   Los chats con tiendas no están conectados todavía: se dice así,
   en vez de simular que la tienda responde.
   ============================================================ */
import { el, uid } from '../util.js';
import { store } from '../state.js';
import { logoTienda, botonVolver, destino } from './components.js';
import { preguntarAsesor } from '../engine/asesor.js';
import { PERFILES } from '../engine/fiscal.js';
import { STORE_BY_ID } from '../data/stores.js';

const ASISTENTE = {
  id:'asistente', quien:'Asistente NiJu', tiendaId:'niju', canal:'chat', asunto:'Preguntá lo que quieras',
  msgs:[{ de:'them', t:'¡Hola! Soy el asistente de NiJu. Preguntame por precios, envíos, impuestos de importación, trámites de Aduana o cómo usar la app.', ts:Date.now() }]
};

/* Conversaciones de ejemplo que tenían versiones anteriores: eran inventadas. */
const DE_EJEMPLO = new Set(['h1', 'h2', 'h3']);

const SUGERENCIAS = ['¿Cuánto puedo traer por courier?', '¿Por qué pago IVA si entra en la franquicia?', '¿Qué es la NCM?', '¿Qué me conviene si es para vender?'];

function hilos(){
  let h = (store.get('hilos') || []).filter(x => !DE_EJEMPLO.has(x.id));
  if (!h.some(x => x.id === ASISTENTE.id)) h = [structuredClone(ASISTENTE), ...h];
  return h;
}

function contextoGeneral(){
  const u = store.get('usuario');
  const carrito = store.get('carrito') || [];
  return {
    condicionAnteARCA: (PERFILES[u?.perfilFiscal] || PERFILES.consumidor_final).label,
    entroConSuCuenta: !!u,
    provincia: destino(),
    carrito: carrito.map(i => ({ producto:i.titulo, tienda:STORE_BY_ID[i.tiendaId]?.nombre || i.tiendaId,
      origen:STORE_BY_ID[i.tiendaId]?.tipo || 'desconocido', precio:i.precio, moneda:i.moneda, cantidad:i.cant }))
  };
}

export function vistaMensajes(ir){
  store.set('hilos', hilos());
  let activo = ASISTENTE.id;
  let pensando = false;

  const raiz = el('div', { class:'wrap' });
  const lista = el('div', { class:'col' });
  const panel = el('div');

  function pintar(){
    const todos = store.get('hilos');
    lista.replaceChildren(...todos.map(h => el('button', { class:'thread' + (h.id === activo ? ' on' : ''), onclick:() => { activo = h.id; pintar(); } },
      logoTienda(h.tiendaId, true),
      el('div', { class:'spacer', style:{ textAlign:'left' } },
        el('b', { class:'tiny' }, h.quien),
        el('div', { class:'tiny dim' }, h.asunto)))));

    const h = todos.find(x => x.id === activo);
    if (!h){ panel.replaceChildren(''); return; }
    const esAsistente = h.id === ASISTENTE.id;

    const cuerpo = el('div', { class:'chat-body', 'aria-live':'polite' },
      ...h.msgs.map(m => el('div', { class:'msg ' + (m.de === 'me' ? 'me' : 'them') + (m.de === 'aviso' ? ' aviso' : '') },
        el('span', { class:'who' }, m.de === 'me' ? 'Vos' : m.de === 'aviso' ? 'Aviso' : h.quien), m.t)),
      pensando && esAsistente ? el('div', { class:'msg them' }, el('span', { class:'who' }, h.quien), 'Pensando la respuesta…') : null);

    const input = el('input', { class:'inp', placeholder: esAsistente ? 'Escribí tu pregunta…' : 'Escribí tu mensaje…', 'aria-label':'Mensaje' });

    const enviar = async texto => {
      const t = (texto ?? input.value).trim();
      if (!t || pensando) return;
      h.msgs.push({ de:'me', t, ts:Date.now() });
      input.value = '';
      if (!esAsistente){
        h.msgs.push({ de:'aviso', t:`Este chat todavía no está conectado con ${h.quien}: tu mensaje no le llega. Escribile desde su página.`, ts:Date.now() });
        store.set('hilos', todos); pintar();
        return;
      }
      pensando = true; store.set('hilos', todos); pintar();
      const historial = h.msgs.slice(0, -1).filter(m => m.de !== 'aviso').slice(-8)
        .map(m => ({ rol:m.de === 'me' ? 'cliente' : 'niju', texto:m.t }));
      const r = await preguntarAsesor({ pregunta:t, contexto:contextoGeneral(), historial });
      pensando = false;
      h.msgs.push({ de:'them', t:r.texto, ts:Date.now(), origen:r.origen });
      store.set('hilos', todos); pintar();
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

    panel.replaceChildren(el('div', { class:'chat' },
      el('div', { class:'cart-group-head' },
        logoTienda(h.tiendaId, true),
        el('div', { class:'spacer' }, el('b', {}, h.quien), el('div', { class:'tiny dim' }, h.asunto))),
      cuerpo,
      esAsistente && h.msgs.length < 3 ? el('div', { class:'k2-chips', style:{ padding:'8px 12px' } },
        ...SUGERENCIAS.map(s => el('button', { class:'v-chip', onclick:() => enviar(s) }, s))) : null,
      el('div', { class:'chat-foot' }, input,
        el('button', { class:'btn btn-win', disabled:pensando ? true : null, onclick:() => enviar() }, 'Enviar'))));
    cuerpo.scrollTop = cuerpo.scrollHeight;
  }

  raiz.append(
    botonVolver(ir),
    el('section', { class:'section' },
      el('div', { class:'kicker' }, 'Un solo lugar para hablar'),
      el('h1', { style:{ marginBottom:'16px' } }, 'Mensajes'),
      el('div', { class:'res-layout' }, lista, panel)));
  pintar();
  return raiz;
}

export const nuevoHilo = (quien, tiendaId, asunto) => {
  const h = { id:'h-' + uid(), quien, tiendaId, canal:'tienda', asunto, msgs:[] };
  store.set('hilos', [...hilos(), h]);
  return h.id;
};
