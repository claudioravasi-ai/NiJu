/* ============================================================
   NiJu — Bandeja única
   El cliente habla con la tienda local, con el vendedor del
   exterior y con nosotros desde el mismo lugar. Cada hilo sabe
   qué canal usa por detrás (WhatsApp, mail, chat de la tienda).
   ============================================================ */
import { el, ic, toast, fecha, uid } from '../util.js';
import { store } from '../state.js';
import { logoTienda } from './components.js';

const SEMILLA = [
  { id:'h1', quien:'Soporte NiJu', tiendaId:'niju', canal:'chat', asunto:'¿Cómo funciona el precio final?',
    msgs:[{ de:'them', t:'¡Hola! Soy del equipo de NiJu. El precio que ves ya incluye producto, envío, impuestos de importación y nuestra gestión. No hay sorpresas al final.', ts:Date.now() - 7200000 }] },
  { id:'h2', quien:'Vendedor — AliExpress', tiendaId:'aliexpress', canal:'tienda', asunto:'Consulta por stock',
    msgs:[{ de:'them', t:'Hello! Yes, we have stock. Shipping to Argentina takes 15-25 days.', ts:Date.now() - 86400000 }] },
  { id:'h3', quien:'Frávega', tiendaId:'fravega', canal:'email', asunto:'Retiro en sucursal',
    msgs:[{ de:'them', t:'Tu pedido puede retirarse en la sucursal que elijas dentro de las 48 h hábiles.', ts:Date.now() - 172800000 }] }
];

export function vistaMensajes(){
  if (!store.get('hilos').length) store.set('hilos', SEMILLA);
  let activo = store.get('hilos')[0]?.id;

  const raiz = el('div', { class:'wrap' });
  const lista = el('div', { class:'col' });
  const panel = el('div');

  function pintar(){
    const hilos = store.get('hilos');
    lista.replaceChildren(...hilos.map(h => el('div', { class:'thread' + (h.id === activo ? ' on' : ''), onclick:() => { activo = h.id; pintar(); } },
      logoTienda(h.tiendaId, true),
      el('div', { class:'spacer' },
        el('b', { class:'tiny' }, h.quien),
        el('div', { class:'tiny dim' }, h.asunto),
        el('div', { class:'tiny', style:{ color:'var(--tx-3)' } }, canalNom(h.canal))),
      el('span', { class:'tiny dim' }, fecha(h.msgs.at(-1)?.ts)))));

    const h = hilos.find(x => x.id === activo);
    if (!h){ panel.replaceChildren(); return; }

    const cuerpo = el('div', { class:'chat-body' },
      ...h.msgs.map(m => el('div', { class:'msg ' + (m.de === 'me' ? 'me' : 'them') },
        el('span', { class:'who' }, m.de === 'me' ? 'Vos' : h.quien), m.t)));

    const input = el('input', { class:'inp', placeholder:'Escribí tu mensaje…' });
    const enviar = () => {
      const t = input.value.trim(); if (!t) return;
      h.msgs.push({ de:'me', t, ts:Date.now() });
      store.set('hilos', hilos);
      input.value = '';
      pintar();
      setTimeout(() => {
        h.msgs.push({ de:'them', t:respuesta(h), ts:Date.now() });
        store.set('hilos', hilos); pintar();
      }, 900);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });

    panel.replaceChildren(el('div', { class:'chat' },
      el('div', { class:'cart-group-head' },
        logoTienda(h.tiendaId, true),
        el('div', { class:'spacer' }, el('b', {}, h.quien), el('div', { class:'tiny dim' }, h.asunto)),
        el('span', { class:'chip tiny' }, canalNom(h.canal))),
      cuerpo,
      el('div', { class:'chat-foot' }, input, el('button', { class:'btn btn-win', onclick:enviar }, 'Enviar'))));
    cuerpo.scrollTop = cuerpo.scrollHeight;
  }

  raiz.append(el('section', { class:'section' },
    el('div', { class:'kicker' }, 'Un solo lugar para hablar'),
    el('h1', { style:{ marginBottom:'16px' } }, 'Mensajes'),
    el('div', { class:'res-layout' }, lista, panel)));
  pintar();
  return raiz;
}

const canalNom = c => ({ chat:'💬 Chat NiJu', tienda:'🏪 Chat de la tienda', email:'✉️ Email', whatsapp:'📱 WhatsApp' }[c] || c);

function respuesta(h){
  const r = {
    niju:['Lo reviso y te confirmo en un rato.', 'Ya lo estamos viendo. Cualquier cosa te avisamos por acá.'],
    default:['Gracias por tu consulta, respondemos a la brevedad.', 'Recibido. Te contestamos dentro de las 24 h.']
  };
  const arr = r[h.tiendaId] || r.default;
  return arr[Math.floor(Math.random() * arr.length)];
}
